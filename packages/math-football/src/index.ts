export type PlayerKind="human"|"npc";
export type NpcSkill="easy"|"medium"|"hard";
export type MatchPhase="waiting"|"kick-open"|"kick-resolution"|"finished";
export type FinishReason="score"|"abandonment"|null;
export type KickReason="answer"|"timeout"|"npc";
export type PenaltyTarget=0|1|2|3|4|5|6|7|8;
export const PENALTY_TARGETS=[0,1,2,3,4,5,6,7,8] as const;
export function validPenaltyTarget(target:unknown):target is PenaltyTarget{
  return typeof target==="number" && Number.isInteger(target) && target>=0 && target<=8;
}

export type PenaltyPlayer={
  id:string;
  name:string;
  kind:PlayerKind;
  npcSkill?:NpcSkill;
};

export type PenaltyKick={
  number:number;
  shooterId:string;
  shooterName:string;
  correct:boolean;
  goal:boolean;
  reason:KickReason;
  suddenDeath:boolean;
  target:PenaltyTarget;
  keeperTarget:PenaltyTarget;
};

export type PenaltyMatchState={
  players:[PenaltyPlayer,PenaltyPlayer];
  phase:MatchPhase;
  currentShooterId:string;
  shots:Record<string,number>;
  goals:Record<string,number>;
  correctAnswers:Record<string,number>;
  errors:Record<string,number>;
  suddenDeath:boolean;
  winnerId:string|null;
  finishReason:FinishReason;
  kickNumber:number;
  kickStartedAt:number|null;
  kickDeadlineAt:number|null;
  history:PenaltyKick[];
  lastKick:PenaltyKick|null;
};

export type PenaltyStats={
  playerId:string;
  goals:number;
  shots:number;
  correctAnswers:number;
  errors:number;
  accuracy:number;
};

export const ONLINE_KICK_MS=30_000;
export const DEFAULT_SOLO_KICK_MS=30_000;
export const INITIAL_KICKS=5;

export function createPenaltyMatch(players:PenaltyPlayer[]):PenaltyMatchState{
  if(players.length!==2) throw new Error("A disputa precisa de exatamente dois participantes.");
  if(players[0]!.id===players[1]!.id) throw new Error("Os participantes precisam ser diferentes.");
  const pair=[players[0]!,players[1]!] as [PenaltyPlayer,PenaltyPlayer];
  return {
    players:pair,
    phase:"waiting",
    currentShooterId:pair[0].id,
    shots:{[pair[0].id]:0,[pair[1].id]:0},
    goals:{[pair[0].id]:0,[pair[1].id]:0},
    correctAnswers:{[pair[0].id]:0,[pair[1].id]:0},
    errors:{[pair[0].id]:0,[pair[1].id]:0},
    suddenDeath:false,
    winnerId:null,
    finishReason:null,
    kickNumber:1,
    kickStartedAt:null,
    kickDeadlineAt:null,
    history:[],
    lastKick:null
  };
}

export function startKick(state:PenaltyMatchState,now:number,durationMs:number|null):PenaltyMatchState{
  if(state.phase==="finished") throw new Error("A disputa já terminou.");
  if(state.phase==="kick-open") throw new Error("Já existe uma cobrança aberta.");
  return {
    ...state,
    phase:"kick-open",
    kickNumber:state.history.length+1,
    kickStartedAt:now,
    kickDeadlineAt:durationMs&&durationMs>0?now+durationMs:null,
    lastKick:null
  };
}

export function openNextKick(state:PenaltyMatchState,now:number,durationMs:number|null):PenaltyMatchState{
  if(state.phase!=="kick-resolution") throw new Error("A próxima cobrança ainda não pode começar.");
  return startKick(state,now,durationMs);
}

function opponentId(state:PenaltyMatchState,playerId:string):string{
  const player=state.players.find(p=>p.id===playerId);
  if(!player) throw new Error("Participante inválido.");
  return state.players[0].id===playerId?state.players[1].id:state.players[0].id;
}

function winnerAfterKick(state:PenaltyMatchState):{winnerId:string|null;suddenDeath:boolean}{
  const [a,b]=state.players;
  const sa=state.shots[a.id]??0;
  const sb=state.shots[b.id]??0;
  const ga=state.goals[a.id]??0;
  const gb=state.goals[b.id]??0;

  if(state.suddenDeath){
    if(sa===sb && ga!==gb) return {winnerId:ga>gb?a.id:b.id,suddenDeath:true};
    return {winnerId:null,suddenDeath:true};
  }

  const remainingA=Math.max(0,INITIAL_KICKS-sa);
  const remainingB=Math.max(0,INITIAL_KICKS-sb);
  if(ga>gb+remainingB) return {winnerId:a.id,suddenDeath:false};
  if(gb>ga+remainingA) return {winnerId:b.id,suddenDeath:false};

  if(sa>=INITIAL_KICKS && sb>=INITIAL_KICKS){
    if(ga!==gb) return {winnerId:ga>gb?a.id:b.id,suddenDeath:false};
    return {winnerId:null,suddenDeath:true};
  }
  return {winnerId:null,suddenDeath:false};
}

export function submitKick(
  state:PenaltyMatchState,
  shooterId:string,
  correct:boolean,
  now:number,
  reason:KickReason="answer",
  target:PenaltyTarget=4
):PenaltyMatchState{
  if(!validPenaltyTarget(target)) throw new Error("Canto do chute inválido.");
  if(state.phase!=="kick-open") throw new Error("Não há cobrança aberta.");
  if(state.currentShooterId!==shooterId) throw new Error("Não é a vez deste jogador.");
  const shooter=state.players.find(p=>p.id===shooterId);
  if(!shooter) throw new Error("Participante inválido.");

  const timedOut=state.kickDeadlineAt!==null && now>state.kickDeadlineAt;
  const effectiveCorrect=timedOut?false:correct;
  const effectiveReason:KickReason=timedOut?"timeout":reason;
  const kick:PenaltyKick={
    number:state.history.length+1,
    shooterId,
    shooterName:shooter.name,
    correct:effectiveCorrect,
    goal:effectiveCorrect,
    reason:effectiveReason,
    suddenDeath:state.suddenDeath,
    target,
    keeperTarget:effectiveCorrect?((target+1+(state.history.length%8))%9) as PenaltyTarget:target
  };

  let next:PenaltyMatchState={
    ...state,
    phase:"kick-resolution",
    shots:{...state.shots,[shooterId]:(state.shots[shooterId]??0)+1},
    goals:{...state.goals,[shooterId]:(state.goals[shooterId]??0)+(effectiveCorrect?1:0)},
    correctAnswers:{...state.correctAnswers,[shooterId]:(state.correctAnswers[shooterId]??0)+(effectiveCorrect?1:0)},
    errors:{...state.errors,[shooterId]:(state.errors[shooterId]??0)+(effectiveCorrect?0:1)},
    history:[...state.history,kick],
    lastKick:kick,
    kickStartedAt:null,
    kickDeadlineAt:null
  };

  const result=winnerAfterKick(next);
  if(result.winnerId){
    return {
      ...next,
      phase:"finished",
      winnerId:result.winnerId,
      suddenDeath:result.suddenDeath,
      finishReason:"score"
    };
  }

  next={
    ...next,
    suddenDeath:result.suddenDeath,
    currentShooterId:opponentId(next,shooterId),
    kickNumber:next.history.length+1
  };
  return next;
}

export function timeoutKick(state:PenaltyMatchState,now:number):PenaltyMatchState{
  if(state.kickDeadlineAt===null) throw new Error("Esta cobrança não possui cronômetro.");
  if(now<state.kickDeadlineAt) throw new Error("O tempo da cobrança ainda não terminou.");
  return submitKick(state,state.currentShooterId,false,now,"timeout");
}

export function abandonMatch(state:PenaltyMatchState,playerId:string):PenaltyMatchState{
  if(state.phase==="finished") return state;
  const winnerId=opponentId(state,playerId);
  return {
    ...state,
    phase:"finished",
    winnerId,
    finishReason:"abandonment",
    kickStartedAt:null,
    kickDeadlineAt:null
  };
}

export function npcDecision(skill:NpcSkill,rng:()=>number=Math.random):{correct:boolean;thinkingMs:number}{
  const chance=skill==="hard"?0.86:skill==="medium"?0.72:0.56;
  const min=skill==="hard"?900:skill==="medium"?1200:1500;
  const max=skill==="hard"?2300:skill==="medium"?2900:3400;
  return {
    correct:rng()<chance,
    thinkingMs:Math.floor(min+rng()*(max-min))
  };
}

export function statsFor(state:PenaltyMatchState,playerId:string):PenaltyStats{
  if(!state.players.some(p=>p.id===playerId)) throw new Error("Participante inválido.");
  const shots=state.shots[playerId]??0;
  const correctAnswers=state.correctAnswers[playerId]??0;
  const errors=state.errors[playerId]??0;
  return {
    playerId,
    goals:state.goals[playerId]??0,
    shots,
    correctAnswers,
    errors,
    accuracy:shots?Math.round(correctAnswers/shots*100):0
  };
}
