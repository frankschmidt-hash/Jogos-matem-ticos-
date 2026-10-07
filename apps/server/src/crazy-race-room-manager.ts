import {
  EMPTY_ROOM_TTL_MS, NETWORK_GRACE_MS, ROOM_TTL_MS, roomInfrastructure,
  type CoreRoomMember, type LifecycleCarrier, type RoomInfrastructure,
  type RoomLifecycleState, type StoredPassword
} from "./room-infrastructure";
import {
  createRace, resolveBombAnswer, resolveNpcBombIfNeeded, resolveRound, startRound,
  submitNpcAnswers, submitRoundAnswer, useBomb, type BombDirection, type RaceState
} from "@jogos/crazy-race";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";

export type CrazyRoomMember=CoreRoomMember & {gradeLevel:GradeLevel};
export type CrazyRoomMemberInput={
  sessionId:string;
  nickname:string;
  gradeLevel:GradeLevel;
  connected?:boolean;
};

type BombActionResult={targetId:string;targetKind:"human"|"npc"};

export type CrazyRoom=LifecycleCarrier & {
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:CrazyRoomMember[];
  status:"waiting"|"playing"|"finished";
  race:RaceState|null;
  question:MathQuestion|null;
  bombQuestions:Record<string,MathQuestion>;
  bombActionResults:Map<string,BombActionResult>;
  createdAt:number;
  updatedAt:number;
};

export type PublicCrazyRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:CrazyRoomMember[];
  status:"waiting"|"playing"|"finished";
  lifecycleState:RoomLifecycleState;
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  race:Omit<RaceState,"submissions"|"bombChallenges"> & {
    answeredIds:string[];
    bombTargets:string[];
  }|null;
  question:null|{
    id:string;
    expression:string;
    gradeLevel:number;
    difficulty:number;
    deadlineAt:number|null;
    startedAt:number|null;
  };
  updatedAt:number;
};

function difficultyForRound(round:number):1|2|3{
  return round<4?1:round<8?2:3;
}

export class CrazyRaceRoomManager{
  private rooms=new Map<string,CrazyRoom>();

  constructor(private infra:RoomInfrastructure=roomInfrastructure){}

  createRoom(host:CrazyRoomMemberInput,password:string,now=Date.now()):CrazyRoom{
    const code=this.infra.allocateCode("crazy-race");
    const core=this.infra.createMember(host,now);
    const member:CrazyRoomMember={...core,gradeLevel:host.gradeLevel};
    const room:CrazyRoom={
      code,password:this.infra.createPassword(password),hostSessionId:member.sessionId,
      gradeLevel:host.gradeLevel,members:[member],status:"waiting",race:null,question:null,
      bombQuestions:{},bombActionResults:new Map(),
      lifecycleState:"ready",lifecycleHistory:["ready"],createdAt:now,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,input:CrazyRoomMemberInput,now=Date.now()):CrazyRoom{
    const room=this.mustRoom(code);
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    this.infra.verifyPassword("crazy-race",room.code,input.sessionId,password,room.password,now);
    const existing=room.members.find(m=>m.sessionId===input.sessionId);
    if(existing){
      this.infra.reconnectMember(existing,now);
      this.syncWaitingLifecycle(room);
      room.updatedAt=now;
      return room;
    }
    if(this.infra.capacity(room.members,6).available<=0) throw new Error("A sala está cheia.");
    const core=this.infra.createMember(input,now);
    room.members.push({...core,gradeLevel:input.gradeLevel});
    this.syncWaitingLifecycle(room);
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now()):CrazyRoom{
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");
    this.infra.reconnectMember(member,now);
    this.syncWaitingLifecycle(room);
    room.updatedAt=now;
    return room;
  }

  disconnect(code:string,sessionId:string,now=Date.now()):void{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    const member=room?.members.find(m=>m.sessionId===sessionId);
    if(member&&room){
      this.infra.disconnectMember(member,now);
      this.syncWaitingLifecycle(room);
      room.updatedAt=now;
    }
  }

  leaveRoom(code:string,sessionId:string,now=Date.now()):CrazyRoom|null{
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");

    if(room.status==="waiting"){
      room.members=room.members.filter(m=>m.sessionId!==sessionId);
      if(room.members.length===0){
        this.infra.transition(room,"closed");
        this.rooms.delete(room.code);
        this.infra.releaseCode(room.code);
        return null;
      }
      if(room.hostSessionId===sessionId){
        room.hostSessionId=this.infra.nextHost(room.members,sessionId)??room.members[0]!.sessionId;
      }
      this.syncWaitingLifecycle(room);
    }else{
      this.infra.abandonMember(member,now);
      if(room.hostSessionId===sessionId){
        room.hostSessionId=this.infra.nextHost(room.members,sessionId)??room.hostSessionId;
      }
    }
    room.updatedAt=now;
    return room;
  }

  startRoom(code:string,hostSessionId:string,now=Date.now()):CrazyRoom{
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A sala já foi iniciada.");
    this.syncWaitingLifecycle(room);
    if(room.lifecycleState!=="ready") throw new Error("A sala ainda não está pronta.");
    const humans=room.members.filter(m=>m.connected&&m.presence==="connected");
    if(humans.length<1) throw new Error("Nenhum jogador conectado.");

    this.infra.transition(room,"countdown");
    room.race=createRace(humans.map(m=>({id:m.sessionId,name:m.nickname})));
    room.status="playing";
    this.infra.transition(room,"playing");
    room.updatedAt=now;
    this.openRound(room,now);
    return room;
  }

  private openRound(room:CrazyRoom,now:number):void{
    if(!room.race||room.race.phase==="finished") return;
    room.race=startRound(room.race,now);
    room.race=submitNpcAnswers(room.race);
    room.question=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForRound(room.race.round),
      seed:"crazy:"+room.code+":round:"+room.race.round
    });
    room.bombQuestions={};
    room.bombActionResults.clear();
    room.updatedAt=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,clientSubmissionId:string,now=Date.now()
  ):CrazyRoom{
    const room=this.mustPlaying(code);
    if(!room.race||!room.question||room.race.roundStartedAt===null||room.race.roundDeadlineAt===null){
      throw new Error("Rodada indisponível.");
    }
    if(room.question.id!==questionId) throw new Error("Questão não pertence à rodada atual.");
    this.infra.assertActionRate("crazy-answer:"+room.code,sessionId,now);
    if(this.infra.isReplay("crazy-answer:"+room.code+":"+questionId,sessionId,clientSubmissionId,now)) return room;
    if(now>room.race.roundDeadlineAt+NETWORK_GRACE_MS) throw new Error("O tempo da rodada terminou.");

    const acceptedAt=Math.min(now,room.race.roundDeadlineAt);
    const responseMs=acceptedAt-room.race.roundStartedAt;
    const correct=validateAnswer(room.question,answer);
    room.race=submitRoundAnswer(room.race,sessionId,correct,responseMs,acceptedAt);
    room.updatedAt=now;
    return room;
  }

  useBomb(
    code:string,sessionId:string,direction:BombDirection,clientSubmissionId:string,now=Date.now()
  ): {room:CrazyRoom;targetId:string;targetKind:"human"|"npc"}{
    const room=this.mustPlaying(code);
    if(!room.race) throw new Error("Corrida indisponível.");
    this.infra.assertActionRate("crazy-bomb:"+room.code,sessionId,now,12,10_000);
    const replayKey=sessionId+":"+clientSubmissionId;
    const previous=room.bombActionResults.get(replayKey);
    if(previous) return {room,...previous};
    if(this.infra.isReplay("crazy-bomb:"+room.code,sessionId,clientSubmissionId,now)){
      throw new Error("Ação já processada.");
    }

    const before=new Set(Object.keys(room.race.bombChallenges));
    room.race=useBomb(room.race,sessionId,direction,now);
    const challenge=Object.values(room.race.bombChallenges).find(c=>!before.has(c.targetId)&&c.attackerId===sessionId);
    if(!challenge) throw new Error("Não foi possível identificar o alvo.");

    const target=room.race.racers.find(r=>r.id===challenge.targetId)!;
    const question=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForRound(room.race.round),
      seed:"crazy:"+room.code+":bomb:"+room.race.round+":"+sessionId+":"+challenge.targetId
    });
    room.bombQuestions[challenge.targetId]=question;

    if(target.kind==="npc"){
      room.race=resolveNpcBombIfNeeded(room.race,target.id);
      delete room.bombQuestions[target.id];
    }

    const result:BombActionResult={targetId:challenge.targetId,targetKind:target.kind};
    room.bombActionResults.set(replayKey,result);
    room.updatedAt=now;
    return {room,...result};
  }

  submitBombAnswer(
    code:string,sessionId:string,questionId:string,answer:string,clientSubmissionId:string,now=Date.now()
  ):CrazyRoom{
    const room=this.mustPlaying(code);
    if(!room.race) throw new Error("Corrida indisponível.");
    const question=room.bombQuestions[sessionId];
    const challenge=room.race.bombChallenges[sessionId];
    if(!question||question.id!==questionId||!challenge||challenge.resolved) throw new Error("Bomba matemática inválida.");
    this.infra.assertActionRate("crazy-bomb-answer:"+room.code,sessionId,now);
    if(this.infra.isReplay("crazy-bomb-answer:"+room.code+":"+questionId,sessionId,clientSubmissionId,now)) return room;
    if(now>challenge.deadlineAt+NETWORK_GRACE_MS) throw new Error("O tempo da bomba terminou.");

    const acceptedAt=Math.min(now,challenge.deadlineAt);
    const correct=validateAnswer(question,answer);
    room.race=resolveBombAnswer(room.race,sessionId,correct,acceptedAt);
    delete room.bombQuestions[sessionId];
    room.updatedAt=now;
    return room;
  }

  finalizeRound(code:string,now=Date.now()):CrazyRoom{
    const room=this.mustPlaying(code);
    if(!room.race||room.race.roundDeadlineAt===null) throw new Error("Rodada indisponível.");
    room.race=resolveRound(room.race,Math.max(now,room.race.roundDeadlineAt));
    room.question=null;
    room.bombQuestions={};
    room.bombActionResults.clear();
    room.updatedAt=now;
    if(room.race.phase==="finished"){
      room.status="finished";
      this.infra.transition(room,"finished");
    }else{
      this.infra.transition(room,"round-resolution");
    }
    return room;
  }

  openNextRound(code:string,now=Date.now()):CrazyRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing"||!room.race||room.race.phase!=="round-resolution"){
      throw new Error("A próxima rodada ainda não pode começar.");
    }
    this.infra.transition(room,"playing");
    this.openRound(room,now);
    return room;
  }

  publicSnapshot(code:string):PublicCrazyRoom{
    const room=this.mustRoom(code);
    const race=room.race?{
      racers:room.race.racers,
      round:room.race.round,
      phase:room.race.phase,
      roundStartedAt:room.race.roundStartedAt,
      roundDeadlineAt:room.race.roundDeadlineAt,
      winnerId:room.race.winnerId,
      tieBreaker:room.race.tieBreaker,
      finishLine:room.race.finishLine,
      log:room.race.log,
      nextLogId:room.race.nextLogId,
      answeredIds:Object.keys(room.race.submissions),
      bombTargets:Object.values(room.race.bombChallenges).filter(c=>!c.resolved).map(c=>c.targetId)
    }:null;

    return {
      code:room.code,
      hostSessionId:room.hostSessionId,
      gradeLevel:room.gradeLevel,
      members:room.members.map(m=>({...m})),
      status:room.status,
      lifecycleState:room.lifecycleState,
      capacity:this.infra.capacity(room.members,6),
      serverNow:Date.now(),
      race,
      question:room.question&&room.race?{
        id:room.question.id,
        expression:room.question.expression,
        gradeLevel:room.question.gradeLevel,
        difficulty:room.question.difficulty,
        deadlineAt:room.race.roundDeadlineAt,
        startedAt:room.race.roundStartedAt
      }:null,
      updatedAt:room.updatedAt
    };
  }

  bombQuestionFor(code:string,sessionId:string):null|{id:string;expression:string;deadlineAt:number}{
    const room=this.mustRoom(code);
    const question=room.bombQuestions[sessionId];
    const challenge=room.race?.bombChallenges[sessionId];
    if(!question||!challenge||challenge.resolved) return null;
    return {id:question.id,expression:question.expression,deadlineAt:challenge.deadlineAt};
  }

  memberIds(code:string):string[]{
    return this.mustRoom(code).members.filter(m=>m.presence!=="abandoned").map(m=>m.sessionId);
  }

  getRoom(code:string):CrazyRoom|undefined{
    return this.rooms.get(this.infra.normalizeCode(code));
  }

  cleanup(now=Date.now(),ttlMs=ROOM_TTL_MS):string[]{
    const changed:string[]=[];
    for(const [code,room] of this.rooms){
      let roomChanged=this.infra.sweepPresence(room.members,now);

      if(room.status==="waiting"){
        const before=room.members.length;
        room.members=room.members.filter(m=>m.presence!=="abandoned");
        roomChanged=roomChanged||room.members.length!==before;
        if(room.members.length===0){
          if(now-room.updatedAt>=EMPTY_ROOM_TTL_MS||before>0){
            this.infra.transition(room,"closed");
            this.rooms.delete(code);
            this.infra.releaseCode(code);
            continue;
          }
        }else{
          const nextHost=this.infra.nextHost(room.members,room.hostSessionId);
          if(nextHost&&nextHost!==room.hostSessionId){
            room.hostSessionId=nextHost;
            roomChanged=true;
          }
          const beforeState=room.lifecycleState;
          this.syncWaitingLifecycle(room);
          roomChanged=roomChanged||beforeState!==room.lifecycleState;
        }
      }else{
        const nextHost=this.infra.nextHost(room.members,room.hostSessionId);
        if(nextHost&&nextHost!==room.hostSessionId){
          room.hostSessionId=nextHost;
          roomChanged=true;
        }
      }

      if(now-room.updatedAt>ttlMs){
        if(room.lifecycleState!=="closed") this.infra.transition(room,"closed");
        this.rooms.delete(code);
        this.infra.releaseCode(code);
        continue;
      }
      if(roomChanged){
        room.updatedAt=now;
        changed.push(code);
      }
    }
    return changed;
  }

  private syncWaitingLifecycle(room:CrazyRoom):void{
    if(room.status!=="waiting") return;
    const desired=this.infra.waitingState(room.members,1);
    if(room.lifecycleState!==desired) this.infra.transition(room,desired);
  }

  private mustRoom(code:string):CrazyRoom{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):CrazyRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A corrida ainda não está em andamento.");
    return room;
  }
}
