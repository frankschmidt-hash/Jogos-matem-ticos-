import {
  EMPTY_ROOM_TTL_MS, NETWORK_GRACE_MS, ROOM_TTL_MS, roomInfrastructure,
  type CoreRoomMember, type LifecycleCarrier, type MemberInput, type RoomInfrastructure,
  type RoomLifecycleState, type StoredPassword
} from "./room-infrastructure";
import {
  ONLINE_KICK_MS, abandonMatch, createPenaltyMatch, openNextKick, startKick,
  submitKick, timeoutKick, type PenaltyMatchState
} from "@jogos/math-football";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";

export type FootballRoomMember=CoreRoomMember;
export type FootballRoomMemberInput=MemberInput;

export type FootballRoom=LifecycleCarrier & {
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:FootballRoomMember[];
  status:"waiting"|"playing"|"finished";
  match:PenaltyMatchState|null;
  question:MathQuestion|null;
  lastCorrectAnswer:string|null;
  createdAt:number;
  updatedAt:number;
};

export type PublicFootballRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:FootballRoomMember[];
  status:"waiting"|"playing"|"finished";
  lifecycleState:RoomLifecycleState;
  capacity:{max:number;occupied:number;available:number};
  serverNow:number;
  match:PenaltyMatchState|null;
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

function difficultyForKick(kick:number):1|2|3{
  return kick<4?1:kick<8?2:3;
}

export class FootballRoomManager{
  private rooms=new Map<string,FootballRoom>();

  constructor(private infra:RoomInfrastructure=roomInfrastructure){}

  createRoom(host:FootballRoomMemberInput,password:string,gradeLevel:GradeLevel,now=Date.now()):FootballRoom{
    const code=this.infra.allocateCode("math-football");
    const member=this.infra.createMember(host,now);
    const room:FootballRoom={
      code,password:this.infra.createPassword(password),hostSessionId:member.sessionId,gradeLevel,
      members:[member],status:"waiting",match:null,question:null,lastCorrectAnswer:null,
      lifecycleState:"waiting",lifecycleHistory:["waiting"],createdAt:now,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,input:FootballRoomMemberInput,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    this.infra.verifyPassword("math-football",room.code,input.sessionId,password,room.password,now);
    const existing=room.members.find(m=>m.sessionId===input.sessionId);
    if(existing){
      this.infra.reconnectMember(existing,now);
      this.syncWaitingLifecycle(room);
      room.updatedAt=now;
      return room;
    }
    if(this.infra.capacity(room.members,2).available<=0) throw new Error("A sala está cheia.");
    room.members.push(this.infra.createMember(input,now));
    this.syncWaitingLifecycle(room);
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now()):FootballRoom{
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

  startRoom(code:string,hostSessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    this.syncWaitingLifecycle(room);
    if(room.lifecycleState!=="ready") throw new Error("Aguardando o segundo jogador.");
    const humans=room.members.filter(m=>m.connected&&m.presence==="connected");
    if(humans.length!==2) throw new Error("Aguardando o segundo jogador.");

    this.infra.transition(room,"countdown");
    room.match=createPenaltyMatch(humans.map(m=>({id:m.sessionId,name:m.nickname,kind:"human"})));
    room.status="playing";
    this.infra.transition(room,"playing");
    this.openKick(room,now);
    return room;
  }

  private openKick(room:FootballRoom,now:number):void{
    if(!room.match||room.match.phase==="finished") return;
    room.match=room.match.phase==="waiting"
      ?startKick(room.match,now,ONLINE_KICK_MS)
      :openNextKick(room.match,now,ONLINE_KICK_MS);
    room.question=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForKick(room.match.kickNumber),
      seed:"football:"+room.code+":kick:"+room.match.kickNumber
    });
    room.lastCorrectAnswer=null;
    room.updatedAt=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,
    clientSubmissionId:string,now=Date.now()
  ):FootballRoom{
    const room=this.mustRoom(code);
    this.infra.assertActionRate("football-answer:"+room.code,sessionId,now);
    if(this.infra.isReplay("football-answer:"+room.code+":"+questionId,sessionId,clientSubmissionId,now)) return room;
    if(room.status!=="playing"||!room.match||!room.question||room.match.phase!=="kick-open"){
      throw new Error("Cobrança indisponível.");
    }
    if(room.match.currentShooterId!==sessionId) throw new Error("Aguarde sua vez de cobrar.");
    if(room.question.id!==questionId) throw new Error("Questão não pertence à cobrança atual.");
    if(room.match.kickDeadlineAt!==null&&now>room.match.kickDeadlineAt+NETWORK_GRACE_MS){
      throw new Error("O tempo da cobrança terminou.");
    }

    const deadline=room.match.kickDeadlineAt;
    const acceptedAt=deadline===null?now:Math.min(now,deadline);
    const correct=validateAnswer(room.question,answer);
    room.lastCorrectAnswer=room.question.correctAnswer;
    room.match=submitKick(room.match,sessionId,correct,acceptedAt,"answer");
    room.question=null;
    room.updatedAt=now;
    if(room.match.phase==="finished"){
      room.status="finished";
      this.infra.transition(room,"finished");
    }else{
      this.infra.transition(room,"round-resolution");
    }
    return room;
  }

  timeoutCurrentKick(code:string,now=Date.now()):FootballRoom{
    const room=this.mustPlaying(code);
    if(!room.match||!room.question||room.match.phase!=="kick-open") throw new Error("Cobrança indisponível.");
    room.lastCorrectAnswer=room.question.correctAnswer;
    room.match=timeoutKick(room.match,now);
    room.question=null;
    room.updatedAt=now;
    if(room.match.phase==="finished"){
      room.status="finished";
      this.infra.transition(room,"finished");
    }else{
      this.infra.transition(room,"round-resolution");
    }
    return room;
  }

  openNextKick(code:string,now=Date.now()):FootballRoom{
    const room=this.mustPlaying(code);
    if(!room.match||room.match.phase!=="kick-resolution") throw new Error("A próxima cobrança ainda não pode começar.");
    this.infra.transition(room,"playing");
    this.openKick(room,now);
    return room;
  }

  rematch(code:string,sessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(!room.members.some(m=>m.sessionId===sessionId&&m.presence!=="abandoned")){
      throw new Error("Jogador não pertence a esta sala.");
    }
    if(room.status!=="finished") throw new Error("A partida atual ainda não terminou.");
    const humans=room.members.filter(m=>m.connected&&m.presence==="connected");
    if(humans.length!==2) throw new Error("A sala precisa de dois jogadores conectados.");

    this.infra.transition(room,"ready");
    this.infra.transition(room,"countdown");
    room.match=createPenaltyMatch(humans.map(m=>({id:m.sessionId,name:m.nickname,kind:"human"})));
    room.status="playing";
    room.question=null;
    room.lastCorrectAnswer=null;
    this.infra.transition(room,"playing");
    this.openKick(room,now);
    return room;
  }

  abandon(code:string,sessionId:string,now=Date.now()):FootballRoom|null{
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
      room.updatedAt=now;
      return room;
    }

    this.infra.abandonMember(member,now);
    if(room.status==="playing"&&room.match){
      room.match=abandonMatch(room.match,sessionId);
      room.status="finished";
      room.question=null;
      room.lastCorrectAnswer=null;
      this.infra.transition(room,"finished");
    }
    if(room.hostSessionId===sessionId){
      room.hostSessionId=this.infra.nextHost(room.members,sessionId)??room.hostSessionId;
    }
    room.updatedAt=now;
    return room;
  }

  publicSnapshot(code:string):PublicFootballRoom{
    const room=this.mustRoom(code);
    return {
      code:room.code,
      hostSessionId:room.hostSessionId,
      gradeLevel:room.gradeLevel,
      members:room.members.map(m=>({...m})),
      status:room.status,
      lifecycleState:room.lifecycleState,
      capacity:this.infra.capacity(room.members,2),
      serverNow:Date.now(),
      match:room.match?{
        ...room.match,
        players:room.match.players.map(p=>({...p})) as typeof room.match.players,
        shots:{...room.match.shots},
        goals:{...room.match.goals},
        correctAnswers:{...room.match.correctAnswers},
        errors:{...room.match.errors},
        history:room.match.history.map(k=>({...k})),
        lastKick:room.match.lastKick?{...room.match.lastKick}:null
      }:null,
      question:room.question&&room.match?{
        id:room.question.id,
        expression:room.question.expression,
        gradeLevel:room.question.gradeLevel,
        difficulty:room.question.difficulty,
        deadlineAt:room.match.kickDeadlineAt,
        startedAt:room.match.kickStartedAt
      }:null,
      lastCorrectAnswer:room.lastCorrectAnswer,
      updatedAt:room.updatedAt
    };
  }

  getRoom(code:string):FootballRoom|undefined{
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
      }else if(room.status==="playing"){
        const abandoned=room.members.find(m=>m.presence==="abandoned");
        if(abandoned&&room.match){
          room.match=abandonMatch(room.match,abandoned.sessionId);
          room.status="finished";
          room.question=null;
          room.lastCorrectAnswer=null;
          this.infra.transition(room,"finished");
          roomChanged=true;
        }
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

  private syncWaitingLifecycle(room:FootballRoom):void{
    if(room.status!=="waiting") return;
    const desired=this.infra.waitingState(room.members,2);
    if(room.lifecycleState!==desired) this.infra.transition(room,desired);
  }

  private mustRoom(code:string):FootballRoom{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):FootballRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A partida ainda não está em andamento.");
    return room;
  }
}
