import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  ONLINE_KICK_MS, abandonMatch, createPenaltyMatch, openNextKick, startKick,
  submitKick, timeoutKick, type PenaltyMatchState
} from "@jogos/math-football";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";

export type FootballRoomMember={
  sessionId:string;
  nickname:string;
  connected:boolean;
};

type StoredPassword={salt:string;hash:string};

export type FootballRoom={
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:FootballRoomMember[];
  status:"waiting"|"playing"|"finished";
  match:PenaltyMatchState|null;
  question:MathQuestion|null;
  lastCorrectAnswer:string|null;
  submissionIds:Set<string>;
  createdAt:number;
  updatedAt:number;
};

export type PublicFootballRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:FootballRoomMember[];
  status:"waiting"|"playing"|"finished";
  match:PenaltyMatchState|null;
  question:null|{
    id:string;
    expression:string;
    gradeLevel:number;
    difficulty:number;
    deadlineAt:number|null;
  };
  lastCorrectAnswer:string|null;
  updatedAt:number;
};

const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashPassword(password:string,salt=randomBytes(16).toString("hex")):StoredPassword{
  return {salt,hash:scryptSync(password,salt,32).toString("hex")};
}

function verifyPassword(password:string,stored:StoredPassword):boolean{
  const candidate=scryptSync(password,stored.salt,32);
  const expected=Buffer.from(stored.hash,"hex");
  return candidate.length===expected.length && timingSafeEqual(candidate,expected);
}

function difficultyForKick(kick:number):1|2|3{
  return kick<4?1:kick<8?2:3;
}

export class FootballRoomManager{
  private rooms=new Map<string,FootballRoom>();

  private makeCode():string{
    for(let attempt=0;attempt<50;attempt++){
      const bytes=randomBytes(6);
      let code="";
      for(let i=0;i<6;i++) code+=ALPHABET[bytes[i]!%ALPHABET.length]!;
      if(!this.rooms.has(code)) return code;
    }
    throw new Error("Não foi possível gerar código de sala.");
  }

  createRoom(host:FootballRoomMember,password:string,gradeLevel:GradeLevel,now=Date.now()):FootballRoom{
    if(password.length<4||password.length>32) throw new Error("A senha deve ter entre 4 e 32 caracteres.");
    const code=this.makeCode();
    const room:FootballRoom={
      code,password:hashPassword(password),hostSessionId:host.sessionId,gradeLevel,
      members:[{...host,connected:true}],status:"waiting",match:null,question:null,
      lastCorrectAnswer:null,submissionIds:new Set(),createdAt:now,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,member:FootballRoomMember,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    if(!verifyPassword(password,room.password)) throw new Error("Código ou senha inválidos.");
    const existing=room.members.find(m=>m.sessionId===member.sessionId);
    if(existing){
      existing.connected=true;
      room.updatedAt=now;
      return room;
    }
    if(room.members.length>=2) throw new Error("A sala está cheia.");
    room.members.push({...member,connected:true});
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");
    member.connected=true;
    room.updatedAt=now;
    return room;
  }

  disconnect(code:string,sessionId:string,now=Date.now()):void{
    const room=this.rooms.get(code.toUpperCase());
    const member=room?.members.find(m=>m.sessionId===sessionId);
    if(member){
      member.connected=false;
      room!.updatedAt=now;
    }
  }

  startRoom(code:string,hostSessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    if(room.members.length!==2) throw new Error("Aguardando o segundo jogador.");
    room.match=createPenaltyMatch(room.members.map(m=>({id:m.sessionId,name:m.nickname,kind:"human"})));
    room.status="playing";
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
    room.submissionIds.clear();
    room.updatedAt=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,
    clientSubmissionId:string,now=Date.now()
  ):FootballRoom{
    const room=this.mustPlaying(code);
    if(!room.match||!room.question||room.match.phase!=="kick-open") throw new Error("Cobrança indisponível.");
    if(room.match.currentShooterId!==sessionId) throw new Error("Aguarde sua vez de cobrar.");
    if(room.question.id!==questionId) throw new Error("Questão não pertence à cobrança atual.");
    if(room.submissionIds.has(clientSubmissionId)) return room;
    if(room.match.kickDeadlineAt!==null && now>room.match.kickDeadlineAt) throw new Error("O tempo da cobrança terminou.");

    const correct=validateAnswer(room.question,answer);
    room.lastCorrectAnswer=room.question.correctAnswer;
    room.match=submitKick(room.match,sessionId,correct,now,"answer");
    room.question=null;
    room.submissionIds.add(clientSubmissionId);
    room.updatedAt=now;
    if(room.match.phase==="finished") room.status="finished";
    return room;
  }

  timeoutCurrentKick(code:string,now=Date.now()):FootballRoom{
    const room=this.mustPlaying(code);
    if(!room.match||!room.question||room.match.phase!=="kick-open") throw new Error("Cobrança indisponível.");
    room.lastCorrectAnswer=room.question.correctAnswer;
    room.match=timeoutKick(room.match,now);
    room.question=null;
    room.updatedAt=now;
    if(room.match.phase==="finished") room.status="finished";
    return room;
  }

  openNextKick(code:string,now=Date.now()):FootballRoom{
    const room=this.mustPlaying(code);
    if(!room.match||room.match.phase!=="kick-resolution") throw new Error("A próxima cobrança ainda não pode começar.");
    this.openKick(room,now);
    return room;
  }

  rematch(code:string,sessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(!room.members.some(m=>m.sessionId===sessionId)) throw new Error("Jogador não pertence a esta sala.");
    if(room.status!=="finished") throw new Error("A partida atual ainda não terminou.");
    if(room.members.length!==2) throw new Error("A sala precisa de dois jogadores.");
    room.match=createPenaltyMatch(room.members.map(m=>({id:m.sessionId,name:m.nickname,kind:"human"})));
    room.status="playing";
    room.question=null;
    room.lastCorrectAnswer=null;
    room.submissionIds.clear();
    this.openKick(room,now);
    return room;
  }

  abandon(code:string,sessionId:string,now=Date.now()):FootballRoom{
    const room=this.mustRoom(code);
    if(!room.members.some(m=>m.sessionId===sessionId)) throw new Error("Jogador não pertence a esta sala.");
    if(room.status==="playing"&&room.match){
      room.match=abandonMatch(room.match,sessionId);
      room.status="finished";
      room.question=null;
      room.lastCorrectAnswer=null;
      room.updatedAt=now;
    }
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
        deadlineAt:room.match.kickDeadlineAt
      }:null,
      lastCorrectAnswer:room.lastCorrectAnswer,
      updatedAt:room.updatedAt
    };
  }

  getRoom(code:string):FootballRoom|undefined{
    return this.rooms.get(code.toUpperCase());
  }

  cleanup(now=Date.now(),ttlMs=2*60*60*1000):number{
    let removed=0;
    for(const [code,room] of this.rooms){
      if(now-room.updatedAt>ttlMs){
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  private mustRoom(code:string):FootballRoom{
    const room=this.rooms.get(code.toUpperCase());
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):FootballRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A partida ainda não está em andamento.");
    return room;
  }
}
