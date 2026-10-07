import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createRace, resolveBombAnswer, resolveNpcBombIfNeeded, resolveRound, startRound,
  submitNpcAnswers, submitRoundAnswer, useBomb, type BombDirection, type RaceState
} from "@jogos/crazy-race";
import { generateQuestion, validateAnswer, type GradeLevel, type MathQuestion } from "@jogos/math-engine";

export type CrazyRoomMember = {
  sessionId:string;
  nickname:string;
  gradeLevel:GradeLevel;
  connected:boolean;
};

type StoredPassword = {salt:string;hash:string};

export type CrazyRoom = {
  code:string;
  password:StoredPassword;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:CrazyRoomMember[];
  status:"waiting"|"playing"|"finished";
  race:RaceState | null;
  question:MathQuestion | null;
  bombQuestions:Record<string,MathQuestion>;
  submissionIds:Set<string>;
  createdAt:number;
  updatedAt:number;
};

export type PublicCrazyRoom = {
  code:string;
  hostSessionId:string;
  gradeLevel:GradeLevel;
  members:CrazyRoomMember[];
  status:"waiting"|"playing"|"finished";
  race:Omit<RaceState,"submissions"|"bombChallenges"> & {
    answeredIds:string[];
    bombTargets:string[];
  } | null;
  question:null | {
    id:string;
    expression:string;
    gradeLevel:number;
    difficulty:number;
    deadlineAt:number | null;
  };
  updatedAt:number;
};

const ROOM_ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashPassword(password:string,salt=randomBytes(16).toString("hex")):StoredPassword {
  return {salt,hash:scryptSync(password,salt,32).toString("hex")};
}

function verifyPassword(password:string,stored:StoredPassword):boolean {
  const candidate=scryptSync(password,stored.salt,32);
  const expected=Buffer.from(stored.hash,"hex");
  return candidate.length===expected.length && timingSafeEqual(candidate,expected);
}

function difficultyForRound(round:number):1|2|3 {
  return round<4?1:round<8?2:3;
}

export class CrazyRaceRoomManager {
  private rooms=new Map<string,CrazyRoom>();

  private makeCode():string {
    for(let attempt=0;attempt<50;attempt++){
      const bytes=randomBytes(6);
      let code="";
      for(let i=0;i<6;i++) code+=ROOM_ALPHABET[bytes[i]!%ROOM_ALPHABET.length]!;
      if(!this.rooms.has(code)) return code;
    }
    throw new Error("Não foi possível gerar um código de sala.");
  }

  createRoom(host:CrazyRoomMember,password:string,now=Date.now()):CrazyRoom {
    if(password.length<4 || password.length>32) throw new Error("A senha deve ter entre 4 e 32 caracteres.");
    const code=this.makeCode();
    const room:CrazyRoom={
      code,
      password:hashPassword(password),
      hostSessionId:host.sessionId,
      gradeLevel:host.gradeLevel,
      members:[{...host,connected:true}],
      status:"waiting",
      race:null,
      question:null,
      bombQuestions:{},
      submissionIds:new Set(),
      createdAt:now,
      updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  joinRoom(code:string,password:string,member:CrazyRoomMember,now=Date.now()):CrazyRoom {
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

  reconnect(code:string,sessionId:string,now=Date.now()):CrazyRoom {
    const room=this.mustRoom(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Jogador não pertence a esta sala.");
    member.connected=true;
    room.updatedAt=now;
    return room;
  }

  disconnect(code:string,sessionId:string,now=Date.now()):void {
    const room=this.rooms.get(code.toUpperCase());
    const member=room?.members.find(m=>m.sessionId===sessionId);
    if(member){
      member.connected=false;
      room!.updatedAt=now;
    }
  }

  startRoom(code:string,hostSessionId:string,now=Date.now()):CrazyRoom {
    const room=this.mustRoom(code);
    if(room.hostSessionId!==hostSessionId) throw new Error("Somente o host pode iniciar.");
    if(room.status!=="waiting") throw new Error("A sala já foi iniciada.");
    room.race=createRace(room.members.map(m=>({id:m.sessionId,name:m.nickname})));
    room.status="playing";
    room.updatedAt=now;
    this.openRound(room,now);
    return room;
  }

  private openRound(room:CrazyRoom,now:number):void {
    if(!room.race || room.race.phase==="finished") return;
    room.race=startRound(room.race,now);
    room.race=submitNpcAnswers(room.race);
    room.question=generateQuestion(room.gradeLevel,{
      difficulty:difficultyForRound(room.race.round),
      seed:"crazy:"+room.code+":round:"+room.race.round
    });
    room.bombQuestions={};
    room.submissionIds.clear();
    room.updatedAt=now;
  }

  submitAnswer(
    code:string,sessionId:string,questionId:string,answer:string,clientSubmissionId:string,now=Date.now()
  ):CrazyRoom {
    const room=this.mustPlaying(code);
    if(!room.race || !room.question || room.race.roundStartedAt===null || room.race.roundDeadlineAt===null) {
      throw new Error("Rodada indisponível.");
    }
    if(room.question.id!==questionId) throw new Error("Questão não pertence à rodada atual.");
    if(room.submissionIds.has(clientSubmissionId)) return room;
    if(now>room.race.roundDeadlineAt) throw new Error("O tempo da rodada terminou.");

    const responseMs=now-room.race.roundStartedAt;
    const correct=validateAnswer(room.question,answer);
    room.race=submitRoundAnswer(room.race,sessionId,correct,responseMs,now);
    room.submissionIds.add(clientSubmissionId);
    room.updatedAt=now;
    return room;
  }

  useBomb(code:string,sessionId:string,direction:BombDirection,now=Date.now()):{
    room:CrazyRoom;
    targetId:string;
    targetKind:"human"|"npc";
  } {
    const room=this.mustPlaying(code);
    if(!room.race) throw new Error("Corrida indisponível.");
    const before=new Set(Object.keys(room.race.bombChallenges));
    room.race=useBomb(room.race,sessionId,direction,now);
    const challenge=Object.values(room.race.bombChallenges).find(c=>!before.has(c.targetId) && c.attackerId===sessionId);
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

    room.updatedAt=now;
    return {room,targetId:challenge.targetId,targetKind:target.kind};
  }

  submitBombAnswer(
    code:string,sessionId:string,questionId:string,answer:string,now=Date.now()
  ):CrazyRoom {
    const room=this.mustPlaying(code);
    if(!room.race) throw new Error("Corrida indisponível.");
    const question=room.bombQuestions[sessionId];
    if(!question || question.id!==questionId) throw new Error("Bomba matemática inválida.");
    const correct=validateAnswer(question,answer);
    room.race=resolveBombAnswer(room.race,sessionId,correct,now);
    delete room.bombQuestions[sessionId];
    room.updatedAt=now;
    return room;
  }

  finalizeRound(code:string,now=Date.now()):CrazyRoom {
    const room=this.mustPlaying(code);
    if(!room.race || room.race.roundDeadlineAt===null) throw new Error("Rodada indisponível.");
    room.race=resolveRound(room.race,Math.max(now,room.race.roundDeadlineAt));
    room.question=null;
    room.bombQuestions={};
    room.updatedAt=now;
    if(room.race.phase==="finished") room.status="finished";
    return room;
  }

  openNextRound(code:string,now=Date.now()):CrazyRoom {
    const room=this.mustRoom(code);
    if(room.status!=="playing" || !room.race || room.race.phase!=="round-resolution") {
      throw new Error("A próxima rodada ainda não pode começar.");
    }
    this.openRound(room,now);
    return room;
  }

  publicSnapshot(code:string):PublicCrazyRoom {
    const room=this.mustRoom(code);
    const race=room.race ? {
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
    } : null;

    return {
      code:room.code,
      hostSessionId:room.hostSessionId,
      gradeLevel:room.gradeLevel,
      members:room.members.map(m=>({...m})),
      status:room.status,
      race,
      question:room.question && room.race ? {
        id:room.question.id,
        expression:room.question.expression,
        gradeLevel:room.question.gradeLevel,
        difficulty:room.question.difficulty,
        deadlineAt:room.race.roundDeadlineAt
      } : null,
      updatedAt:room.updatedAt
    };
  }

  bombQuestionFor(code:string,sessionId:string):null|{id:string;expression:string;deadlineAt:number} {
    const room=this.mustRoom(code);
    const question=room.bombQuestions[sessionId];
    const challenge=room.race?.bombChallenges[sessionId];
    if(!question || !challenge || challenge.resolved) return null;
    return {id:question.id,expression:question.expression,deadlineAt:challenge.deadlineAt};
  }

  memberIds(code:string):string[] {
    return this.mustRoom(code).members.map(m=>m.sessionId);
  }

  getRoom(code:string):CrazyRoom|undefined {
    return this.rooms.get(code.toUpperCase());
  }

  cleanup(now=Date.now(),ttlMs=2*60*60*1000):number {
    let removed=0;
    for(const [code,room] of this.rooms){
      if(now-room.updatedAt>ttlMs){
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  private mustRoom(code:string):CrazyRoom {
    const room=this.rooms.get(code.toUpperCase());
    if(!room) throw new Error("Sala não encontrada.");
    return room;
  }

  private mustPlaying(code:string):CrazyRoom {
    const room=this.mustRoom(code);
    if(room.status!=="playing") throw new Error("A corrida ainda não está em andamento.");
    return room;
  }
}
