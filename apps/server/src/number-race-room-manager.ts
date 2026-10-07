import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createNumberRace, resolveRound, startRound, submitAnswer, submitNpcAnswers,
  type NumberRaceState
} from "@jogos/number-race";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";

export type NumberRoomMember={
  sessionId:string;
  nickname:string;
  connected:boolean;
};

type StoredPassword={salt:string;hash:string};

export type NumberRoom={
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:NumberRoomMember[];
  status:"waiting"|"playing"|"finished";
  race:NumberRaceState|null;
  question:MathQuestion|null;
  submissionIds:Set<string>;
  createdAt:number;
  updatedAt:number;
};

export type PublicNumberRoom={
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:NumberRoomMember[];
  status:"waiting"|"playing"|"finished";
  race:(Omit<NumberRaceState,"submissions"> & {answeredIds:string[]})|null;
  question:null|{
    id:string;
    expression:string;
    gradeLevel:number;
    difficulty:number;
    deadlineAt:number|null;
  };
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

function difficultyForRound(round:number):1|2|3{
  return round<4?1:round<8?2:3;
}

export class NumberRaceRoomManager{
  private rooms=new Map<string,NumberRoom>();

  private makeCode():string{
    for(let attempt=0;attempt<50;attempt++){
      const bytes=randomBytes(6);
      let code="";
      for(let i=0;i<6;i++) code+=ALPHABET[bytes[i]!%ALPHABET.length]!;
      if(!this.rooms.has(code)) return code;
    }
    throw new Error("Não foi possível gerar código de sala.");
  }

  createRoom(
    host:NumberRoomMember,password:string,gradeLevel:GradeLevel,now=Date.now()
  ):NumberRoom{
    if(password.length<4||password.length>32) throw new Error("A senha deve ter entre 4 e 32 caracteres.");
    const code=this.makeCode();
    const room:NumberRoom={
      code,password:hashPassword(password),hostSessionId:host.sessionId,gradeLevel,
      members:[{...host,connected:true}],status:"waiting",race:null,question:null,
      submissionIds:new Set(),createdAt:now,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,member:NumberRoomMember,now=Date.now()):NumberRoom{
    const room=this.mustRoom(code);
    if(room.status!=="waiting") throw new Error("A partida já foi iniciada.");
    if(!verifyPassword(password,room.password)) throw new Error("Código ou senha inválidos.");
    const existing=room.members.find(m=>m.sessionId===member.sessionId);
    if(existing){
      existing.connected=true;
      room.updatedAt=now;
      return room;
    }
    if(room.members.length>=6) throw new Error("A sala está cheia.");
    room.members.push({...member,connected:true});
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now()):NumberRoom{
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

  startRoom(code:string,hostSessionId:string,now=Date.now()):NumberRoom{
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A sala já foi iniciada.");
    room.race=createNumberRace(room.members.map(m=>({id:m.sessionId,name:m.nickname})));
    room.status="playing";
    room.updatedAt=now;
    this.openRound(room,now);
    return room;
  }

  private openRound(room:NumberRoom,now:number):void{
    if(!room.race||room.race.phase==="finished") return;
    room.race=startRound(room.race,now);
    room.race=submitNpcAnswers(room.race);
    room.question=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForRound(room.race.round),
      seed:"number:"+room.code+":round:"+room.race.round
    });
    room.submissionIds.clear();
    room.updatedAt=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,
    clientSubmissionId:string,now=Date.now()
  ):NumberRoom{
    const room=this.mustPlaying(code);
    if(!room.race||!room.question||room.race.roundStartedAt===null||room.race.roundDeadlineAt===null){
      throw new Error("Rodada indisponível.");
    }
    if(room.question.id!==questionId) throw new Error("Questão não pertence à rodada atual.");
    if(room.submissionIds.has(clientSubmissionId)) return room;
    if(now>room.race.roundDeadlineAt) throw new Error("O tempo da rodada terminou.");

    const correct=validateAnswer(room.question,answer);
    room.race=submitAnswer(room.race,sessionId,correct,now-room.race.roundStartedAt,now);
    room.submissionIds.add(clientSubmissionId);
    room.updatedAt=now;
    return room;
  }

  finalizeRound(code:string,now=Date.now()):NumberRoom{
    const room=this.mustPlaying(code);
    if(!room.race||room.race.roundDeadlineAt===null) throw new Error("Rodada indisponível.");
    room.race=resolveRound(room.race,Math.max(now,room.race.roundDeadlineAt));
    room.question=null;
    room.updatedAt=now;
    if(room.race.phase==="finished") room.status="finished";
    return room;
  }

  openNextRound(code:string,now=Date.now()):NumberRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing"||!room.race||room.race.phase!=="round-resolution"){
      throw new Error("A próxima rodada ainda não pode começar.");
    }
    this.openRound(room,now);
    return room;
  }

  publicSnapshot(code:string):PublicNumberRoom{
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
      answeredIds:Object.keys(room.race.submissions)
    }:null;

    return {
      code:room.code,
      hostSessionId:room.hostSessionId,
      gradeLevel:room.gradeLevel,
      members:room.members.map(m=>({...m})),
      status:room.status,
      race,
      question:room.question&&room.race?{
        id:room.question.id,
        expression:room.question.expression,
        gradeLevel:room.question.gradeLevel,
        difficulty:room.question.difficulty,
        deadlineAt:room.race.roundDeadlineAt
      }:null,
      updatedAt:room.updatedAt
    };
  }

  getRoom(code:string):NumberRoom|undefined{
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

  private mustRoom(code:string):NumberRoom{
    const room=this.rooms.get(code.toUpperCase());
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):NumberRoom{
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A corrida ainda não está em andamento.");
    return room;
  }
}
