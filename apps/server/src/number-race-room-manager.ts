import {
  EMPTY_ROOM_TTL_MS, NETWORK_GRACE_MS, ROOM_TTL_MS, roomInfrastructure,
  type CoreRoomMember, type LifecycleCarrier, type MemberInput, type RoomInfrastructure,
  type RoomLifecycleState, type StoredPassword
} from "./room-infrastructure";
import {
  createNumberRace, startTimedRace, answerTimedRace, finishTimedRace, tickTimedNpcs,
  type NumberRaceState
} from "@jogos/number-race";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";
import type { NumberCarChoice } from "@jogos/protocol";

export type NumberRoomMember=CoreRoomMember;
export type NumberRoomMemberInput=MemberInput;

export type NumberRoom=LifecycleCarrier & {
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:NumberRoomMember[];
  carChoices:Record<string,NumberCarChoice>;
  status:"waiting"|"playing"|"finished";
  race:NumberRaceState|null;
  question:MathQuestion|null; // compatibilidade com auditorias administrativas
  questions:Record<string,MathQuestion>;
  questionStartedAt:Record<string,number>;
  questionNumbers:Record<string,number>;
  lastCorrectAnswer:string|null;
  createdAt:number;
  updatedAt:number;
};

export type PublicNumberRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:NumberRoomMember[];
  carChoices:Record<string,NumberCarChoice>;
  status:"waiting"|"playing"|"finished";
  lifecycleState:RoomLifecycleState;
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  race:(Omit<NumberRaceState,"submissions"> & {answeredIds:string[]})|null;
  question:null|{
    id:string;
    expression:string;
    gradeLevel:number;
    difficulty:number;
    deadlineAt:number|null;
    startedAt:number|null;
  };
  lastCorrectAnswer:string|null;
  updatedAt:number;
};

function difficultyForRound(_round:number):1|2|3{
  return 1; // contas curtas, sem enunciados extensos
}

export class NumberRaceRoomManager{
  private rooms=new Map<string,NumberRoom>();

  constructor(private infra:RoomInfrastructure=roomInfrastructure){}

  createRoom(
    host:NumberRoomMemberInput,password:string,gradeLevel:GradeLevel,now=Date.now(),carChoice?:NumberCarChoice
  ):NumberRoom{
    const code=this.infra.allocateCode("number-race");
    const member=this.infra.createMember(host,now);
    const room:NumberRoom={
      code,password:this.infra.createPassword(password),hostSessionId:member.sessionId,gradeLevel,
      members:[member],carChoices:carChoice?{[member.sessionId]:carChoice}:{},
       questions:{},questionStartedAt:{},questionNumbers:{},
       status:"waiting",race:null,question:null,lastCorrectAnswer:null,
      lifecycleState:"ready",lifecycleHistory:["ready"],createdAt:now,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,memberInput:NumberRoomMemberInput,now=Date.now(),carChoice?:NumberCarChoice):NumberRoom{
    const room=this.mustRoom(code);
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    this.infra.verifyPassword("number-race",room.code,memberInput.sessionId,password,room.password,now);
    const existing=room.members.find(m=>m.sessionId===memberInput.sessionId);
    if(existing){
      this.infra.reconnectMember(existing,now);
      if(carChoice) room.carChoices[existing.sessionId]=carChoice;
      this.syncWaitingLifecycle(room);
      room.updatedAt=now;
      return room;
    }
    if(this.infra.capacity(room.members,6).available<=0) throw new Error("A sala está cheia.");
    room.members.push(this.infra.createMember(memberInput,now));
    if(carChoice) room.carChoices[memberInput.sessionId]=carChoice;
    this.syncWaitingLifecycle(room);
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now(),carChoice?:NumberCarChoice):NumberRoom{
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");
    this.infra.reconnectMember(member,now);
    if(carChoice) room.carChoices[sessionId]=carChoice;
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

  leaveRoom(code:string,sessionId:string,now=Date.now()):NumberRoom|null{
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");

    if(room.status==="waiting"){
      room.members=room.members.filter(m=>m.sessionId!==sessionId);
      delete room.carChoices[sessionId];
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

  startRoom(code:string,hostSessionId:string,now=Date.now()):NumberRoom{
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A sala já foi iniciada.");
    this.syncWaitingLifecycle(room);
    if(room.lifecycleState!=="ready") throw new Error("A sala ainda não está pronta.");
    const humans=room.members.filter(m=>m.connected&&m.presence==="connected");
    if(humans.length<1) throw new Error("Nenhum jogador conectado.");

    this.infra.transition(room,"countdown");
    room.race=startTimedRace(createNumberRace(humans.map(m=>({id:m.sessionId,name:m.nickname}))),now);
    room.status="playing";
    this.infra.transition(room,"playing");
    room.updatedAt=now;
    for(const member of humans) this.makeNextQuestion(room,member.sessionId,now);
    room.question=room.questions[room.hostSessionId]??null;
    return room;
  }

  /** Questões individuais: cada aluno continua no próprio ritmo, sem esperar os demais. */
  private makeNextQuestion(room:NumberRoom,sessionId:string,now:number):void{
    const count=(room.questionNumbers[sessionId]??0)+1;
    room.questionNumbers[sessionId]=count;
    room.questions[sessionId]=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForRound(count),
      seed:"number:"+room.code+":"+sessionId+":question:"+count
    });
    room.questionStartedAt[sessionId]=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,
    clientSubmissionId:string,now=Date.now()
  ):NumberRoom{
    const room=this.mustPlaying(code);
    if(!room.race||room.race.matchDeadlineAt==null) throw new Error("Corrida indisponível.");
    // Nenhuma resposta conta após 05:00, mesmo sob latência ou reconexão.
    if(now>room.race.matchDeadlineAt) throw new Error("O tempo da corrida terminou.");
    if(this.infra.isReplay("number-answer:"+room.code+":"+questionId,sessionId,clientSubmissionId,now)) return room;
    const question=room.questions[sessionId];
    if(!question||question.id!==questionId) throw new Error("Questão não pertence à rodada atual.");
    this.infra.assertActionRate("number-answer:"+room.code,sessionId,now);
    const correct=validateAnswer(question,answer);
    const elapsed=Math.max(0,now-(room.questionStartedAt[sessionId]??now));
    room.race=answerTimedRace(room.race,sessionId,correct,elapsed,now);
    room.race.submissions[sessionId]={racerId:sessionId,correct,responseMs:elapsed,submittedAt:now};
    this.makeNextQuestion(room,sessionId,now);
    room.question=room.questions[room.hostSessionId]??null;
    room.updatedAt=now;
    return room;
  }

  /** Um pulso de movimentação dos NPCs, independente da resposta dos alunos. */
  updateNpcProgress(code:string,now=Date.now()):NumberRoom{
    const room=this.mustPlaying(code);
    if(room.race && room.race.matchDeadlineAt!=null && now<room.race.matchDeadlineAt){
      room.race=tickTimedNpcs(room.race,now);
      room.updatedAt=now;
    }
    return room;
  }

  finalizeRound(code:string,now=Date.now()):NumberRoom{
    const room=this.mustPlaying(code);
    if(!room.race||room.race.matchDeadlineAt==null) throw new Error("Corrida indisponível.");
    room.race=finishTimedRace(room.race,now);
    room.lastCorrectAnswer=null;
    room.question=null;
    room.questions={};
    room.status="finished";
    room.updatedAt=now;
    this.infra.transition(room,"finished");
    return room;
  }

  /** Não há troca de rodada coletiva no desafio contínuo. */
  openNextRound(_code:string,_now=Date.now()):NumberRoom{
    throw new Error("As questões agora são individuais, sem rodadas coletivas.");
  }

  publicSnapshot(code:string,viewerSessionId?:string):PublicNumberRoom{
    const room=this.mustRoom(code);
    const race=room.race?{
      racers:room.race.racers,
      round:room.race.round,
      phase:room.race.phase,
      roundStartedAt:room.race.roundStartedAt,
      roundDeadlineAt:room.race.roundDeadlineAt,
      matchStartedAt:room.race.matchStartedAt,
      matchDeadlineAt:room.race.matchDeadlineAt,
      winnerId:room.race.winnerId,
      tieBreaker:room.race.tieBreaker,
      finishLine:room.race.finishLine,
      log:room.race.log,
      nextLogId:room.race.nextLogId,
      answeredIds:[]
    }:null;

    return {
      code:room.code,
      hostSessionId:room.hostSessionId,
      gradeLevel:room.gradeLevel,
      members:room.members.map(m=>({...m})),
      carChoices:{...room.carChoices},
      status:room.status,
      lifecycleState:room.lifecycleState,
      capacity:this.infra.capacity(room.members,6),
      serverNow:Date.now(),
      race,
      question:room.race && room.race.phase==="round-open" &&
        room.questions[viewerSessionId??room.hostSessionId]?{
        id:room.questions[viewerSessionId??room.hostSessionId]!.id,
        expression:room.questions[viewerSessionId??room.hostSessionId]!.expression,
        gradeLevel:room.questions[viewerSessionId??room.hostSessionId]!.gradeLevel,
        difficulty:room.questions[viewerSessionId??room.hostSessionId]!.difficulty,
        deadlineAt:room.race.matchDeadlineAt??null,
        startedAt:room.race.matchStartedAt??null
      }:null,
      lastCorrectAnswer:room.race?.phase==="round-resolution"||room.status==="finished"
        ? room.lastCorrectAnswer
        : null,
      updatedAt:room.updatedAt
    };
  }

  getRoom(code:string):NumberRoom|undefined{
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

  private syncWaitingLifecycle(room:NumberRoom):void{
    if(room.status!=="waiting") return;
    const desired=this.infra.waitingState(room.members,1);
    if(room.lifecycleState!==desired) this.infra.transition(room,desired);
  }

  private mustRoom(code:string):NumberRoom{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):NumberRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A corrida ainda não está em andamento.");
    return room;
  }
}
