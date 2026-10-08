export type RacerKind = "human" | "npc";
export type NpcSkill = "beginner" | "intermediate" | "advanced";
export type RacePhase = "waiting" | "round-open" | "round-resolution" | "finished";
export type BombDirection = "ahead" | "behind";
export const CAR_MODELS=["esportivo","sedan","hatch","suv","picape","buggy","formula","classico","jipe","van"] as const;
export type CarModel=typeof CAR_MODELS[number];
export type CarSelection={carModel:CarModel;carColor:string};
export const DEFAULT_CAR:CarSelection={carModel:"esportivo",carColor:"#3378dc"};

export type Racer = {
  id:string;
  name:string;
  kind:RacerKind;
  npcSkill?:NpcSkill;
  progress:number;
  correctAnswers:number;
  errors:number;
  timePenaltyMs:number;
  totalCorrectResponseMs:number;
  bombCharges:number;
  bombCooldownUntilRound:number;
  protectedUntilRound:number;
  blockedRound:number | null;
  carModel:CarModel;
  carColor:string;
  clearedTrackBombs:number[];
  pendingTrackBomb:number|null;
};

export type RoundSubmission = {
  racerId:string;
  correct:boolean;
  responseMs:number;
  submittedAt:number;
};

export type BombChallenge = {
  attackerId:string;
  targetId:string;
  createdAt:number;
  deadlineAt:number;
  resolved:boolean;
  correct:boolean | null;
};

export type RaceLog = {id:number; message:string};

export type RaceState = {
  racers:Racer[];
  round:number;
  phase:RacePhase;
  roundStartedAt:number | null;
  roundDeadlineAt:number | null;
  matchStartedAt?:number | null;
  matchDeadlineAt?:number | null;
  submissions:Record<string,RoundSubmission>;
  bombChallenges:Record<string,BombChallenge>;
  winnerId:string | null;
  tieBreaker:boolean;
  finishLine:number;
  log:RaceLog[];
  nextLogId:number;
};

export type RaceHuman = {id:string; name:string; carModel?:CarModel; carColor?:string};

export const TOTAL_RACERS=6;
export const ROUND_DURATION_MS=20_000;
export const BOMB_DURATION_MS=8_000;
export const BASE_ADVANCE=110;
export const FINISH_LINE=880;
export const MAX_BOMB_CHARGES=2;
export const CHECKPOINTS=[220,440,660] as const;
export const TRACK_BOMBS=CHECKPOINTS;
export const MATCH_DURATION_MS=300_000;
export const BOMB_PENALTY_MS=10_000;
export const TIMED_BOMBS=[75_000,150_000,225_000] as const;
export const TIMED_ADVANCE=110;
const NPC_CAR_COLORS=["#e55835","#29a784","#e2a328","#904fe3","#e54a82"];

const NPC_NAMES=["Vega","Turbo","Pixel","Nébula","Raio","Órbita"] as const;
const NPC_SKILLS:NpcSkill[]=["beginner","intermediate","advanced","intermediate","advanced","beginner"];

function pushLog(state:RaceState,message:string):RaceState {
  const entry={id:state.nextLogId,message};
  return {...state,nextLogId:state.nextLogId+1,log:[entry,...state.log].slice(0,10)};
}

export function createRace(humans:RaceHuman[],finishLine=FINISH_LINE):RaceState {
  if(humans.length<1 || humans.length>TOTAL_RACERS) throw new Error("A corrida precisa de 1 a 6 jogadores humanos.");
  const humanRacers:Racer[]=humans.map(h=>({
    id:h.id,name:h.name,kind:"human",progress:0,correctAnswers:0,errors:0,timePenaltyMs:0,totalCorrectResponseMs:0,
    bombCharges:0,bombCooldownUntilRound:0,protectedUntilRound:0,blockedRound:null,
    carModel:h.carModel??DEFAULT_CAR.carModel,carColor:h.carColor??DEFAULT_CAR.carColor,
    clearedTrackBombs:[],pendingTrackBomb:null
  }));
  const npcs:Racer[]=[];
  for(let i=humans.length;i<TOTAL_RACERS;i++){
    const npcIndex=i-humans.length;
    npcs.push({
      id:"npc-"+(npcIndex+1),
      name:NPC_NAMES[npcIndex] ?? "NPC "+(npcIndex+1),
      kind:"npc",
      npcSkill:NPC_SKILLS[npcIndex] ?? "intermediate",
      progress:0,correctAnswers:0,errors:0,timePenaltyMs:0,totalCorrectResponseMs:0,
      bombCharges:0,bombCooldownUntilRound:0,protectedUntilRound:0,blockedRound:null,
      carModel:CAR_MODELS[(npcIndex+1)%CAR_MODELS.length]!,carColor:NPC_CAR_COLORS[npcIndex%NPC_CAR_COLORS.length]!,
      clearedTrackBombs:[],pendingTrackBomb:null
    });
  }
  return {
    racers:[...humanRacers,...npcs],
    round:0,
    phase:"waiting",
    roundStartedAt:null,
    roundDeadlineAt:null,
    submissions:{},
    bombChallenges:{},
    winnerId:null,
    tieBreaker:false,
    finishLine,
    log:[{id:0,message:"Corrida preparada com 6 competidores."}],
    nextLogId:1
  };
}

export function ranking(state:RaceState):Racer[] {
  return [...state.racers].sort((a,b)=>{
    if(state.matchDeadlineAt!=null){
      return b.correctAnswers-a.correctAnswers || a.errors-b.errors ||
        a.totalCorrectResponseMs-b.totalCorrectResponseMs || a.name.localeCompare(b.name,"pt-BR");
    }
    if(b.progress!==a.progress) return b.progress-a.progress;
    if(b.correctAnswers!==a.correctAnswers) return b.correctAnswers-a.correctAnswers;
    if(a.totalCorrectResponseMs!==b.totalCorrectResponseMs) return a.totalCorrectResponseMs-b.totalCorrectResponseMs;
    return a.name.localeCompare(b.name,"pt-BR");
  });
}

export function positionOf(state:RaceState,racerId:string):number {
  const index=ranking(state).findIndex(r=>r.id===racerId);
  return index<0 ? 0 : index+1;
}

export function startRound(state:RaceState,now:number):RaceState {
  if(state.phase==="finished") throw new Error("A corrida já terminou.");
  if(state.phase==="round-open") throw new Error("Já existe uma rodada aberta.");
  const nextRound=state.round+1;
  let next:RaceState={
    ...state,
    round:nextRound,
    phase:"round-open",
    roundStartedAt:now,
    roundDeadlineAt:now+ROUND_DURATION_MS,
    submissions:{},
    bombChallenges:{},
    tieBreaker:state.tieBreaker
  };
  next=pushLog(next,state.tieBreaker
    ? "Rodada extra de desempate iniciada."
    : "Rodada "+nextRound+" iniciada: 20 segundos para responder.");
  return next;
}

export function submitRoundAnswer(
  state:RaceState,racerId:string,correct:boolean,responseMs:number,submittedAt:number
):RaceState {
  if(state.phase!=="round-open" || state.roundStartedAt===null || state.roundDeadlineAt===null) {
    throw new Error("Não há rodada aberta.");
  }
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer) throw new Error("Competidor inválido.");
  if(racer.pendingTrackBomb!==null) throw new Error("Resolva primeiro a bomba da pista.");
  if(state.submissions[racerId]) throw new Error("Resposta já enviada nesta rodada.");

  const timedOut=submittedAt>state.roundDeadlineAt;
  const safeResponse=Math.max(0,Math.min(ROUND_DURATION_MS,responseMs));
  const submission:RoundSubmission={
    racerId,
    correct:timedOut?false:correct,
    responseMs:timedOut?ROUND_DURATION_MS:safeResponse,
    submittedAt
  };
  return {
    ...state,
    submissions:{...state.submissions,[racerId]:submission}
  };
}

export function npcDecision(skill:NpcSkill,rng:()=>number=Math.random):{correct:boolean;responseMs:number} {
  const chance=skill==="advanced"?0.86:skill==="intermediate"?0.75:0.63;
  const min=skill==="advanced"?4_000:skill==="intermediate"?5_500:7_000;
  const max=skill==="advanced"?11_000:skill==="intermediate"?14_000:17_500;
  return {
    correct:rng()<chance,
    responseMs:Math.floor(min+rng()*(max-min))
  };
}

export function submitNpcAnswers(state:RaceState,rng:()=>number=Math.random):RaceState {
  if(state.phase!=="round-open" || state.roundStartedAt===null) return state;
  let next=state;
  for(const racer of state.racers){
    if(racer.kind!=="npc" || racer.pendingTrackBomb!==null || next.submissions[racer.id]) continue;
    const decision=npcDecision(racer.npcSkill ?? "intermediate",rng);
    next=submitRoundAnswer(
      next,racer.id,decision.correct,decision.responseMs,state.roundStartedAt+decision.responseMs
    );
  }
  return next;
}

function adjacentTarget(state:RaceState,attackerId:string,direction:BombDirection):Racer|null {
  const ordered=ranking(state);
  const index=ordered.findIndex(r=>r.id===attackerId);
  if(index<0) return null;
  const targetIndex=direction==="ahead"?index-1:index+1;
  return ordered[targetIndex] ?? null;
}

export function bombTarget(state:RaceState,attackerId:string,direction:BombDirection):Racer|null {
  return adjacentTarget(state,attackerId,direction);
}

export function useBomb(
  state:RaceState,attackerId:string,direction:BombDirection,now:number
):RaceState {
  if(state.phase!=="round-open" || state.roundDeadlineAt===null) throw new Error("A bomba só pode ser usada durante uma rodada.");
  if(now>=state.roundDeadlineAt-1_000) throw new Error("A rodada está encerrando; aguarde a próxima.");
  const attacker=state.racers.find(r=>r.id===attackerId);
  if(!attacker) throw new Error("Competidor inválido.");
  if(attacker.pendingTrackBomb!==null) throw new Error("Desarme primeiro a bomba do percurso.");
  if(attacker.bombCharges<=0) throw new Error("Você não possui bomba matemática.");
  if(state.round<attacker.bombCooldownUntilRound) throw new Error("Bomba em cooldown.");
  if(state.bombChallenges[attackerId] && !state.bombChallenges[attackerId]!.resolved) {
    throw new Error("Resolva a bomba recebida antes de atacar.");
  }

  const target=adjacentTarget(state,attackerId,direction);
  if(!target) throw new Error("Não há alvo nessa direção.");
  if(target.pendingTrackBomb!==null) throw new Error("O alvo está desarmando uma bomba do percurso.");
  if(target.protectedUntilRound>=state.round) throw new Error("O alvo está protegido.");
  if(state.bombChallenges[target.id] && !state.bombChallenges[target.id]!.resolved) {
    throw new Error("O alvo já está resolvendo uma bomba.");
  }

  const challenge:BombChallenge={
    attackerId,targetId:target.id,createdAt:now,
    deadlineAt:Math.min(state.roundDeadlineAt,now+BOMB_DURATION_MS),
    resolved:false,correct:null
  };

  const racers=state.racers.map(r=>r.id===attackerId
    ? {...r,bombCharges:r.bombCharges-1,bombCooldownUntilRound:state.round+2}
    : r
  );

  return pushLog({
    ...state,
    racers,
    bombChallenges:{...state.bombChallenges,[target.id]:challenge}
  },attacker.name+" lançou uma bomba matemática em "+target.name+".");
}

export function resolveBombAnswer(
  state:RaceState,targetId:string,correct:boolean,answeredAt:number
):RaceState {
  const challenge=state.bombChallenges[targetId];
  if(!challenge || challenge.resolved) throw new Error("Não há bomba pendente para este competidor.");
  const target=state.racers.find(r=>r.id===targetId);
  if(!target) throw new Error("Competidor inválido.");

  const effectiveCorrect=answeredAt<=challenge.deadlineAt && correct;
  const racers=state.racers.map(r=>{
    if(r.id!==targetId) return r;
    return {
      ...r,
      blockedRound:state.matchDeadlineAt!=null?r.blockedRound:(effectiveCorrect?r.blockedRound:state.round),
      timePenaltyMs:r.timePenaltyMs+(state.matchDeadlineAt!=null&&!effectiveCorrect?BOMB_PENALTY_MS:0),
      protectedUntilRound:Math.max(r.protectedUntilRound,state.round+1)
    };
  });

  const nextChallenge={...challenge,resolved:true,correct:effectiveCorrect};
  return pushLog({
    ...state,
    racers,
    bombChallenges:{...state.bombChallenges,[targetId]:nextChallenge}
  },effectiveCorrect
    ? target.name+" neutralizou a bomba matemática."
    : target.name+(state.matchDeadlineAt!=null?" errou a bomba e perdeu 10 segundos.":" errou a bomba e ficou sem avanço nesta rodada.")
  );
}

export function resolveNpcBombIfNeeded(state:RaceState,targetId:string,rng:()=>number=Math.random):RaceState {
  const target=state.racers.find(r=>r.id===targetId);
  const challenge=state.bombChallenges[targetId];
  if(!target || target.kind!=="npc" || !challenge || challenge.resolved) return state;
  const decision=npcDecision(target.npcSkill ?? "intermediate",rng);
  return resolveBombAnswer(state,targetId,decision.correct,challenge.createdAt+decision.responseMs);
}

export function resolveTrackBomb(state:RaceState,racerId:string,correct:boolean):RaceState {
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer||racer.pendingTrackBomb===null) throw new Error("Não há bomba da pista pendente.");
  const checkpoint=racer.pendingTrackBomb;
  const racers=state.racers.map(r=>r.id!==racerId?r:{
    ...r,
    progress:correct?r.progress:0,
    pendingTrackBomb:null,
    clearedTrackBombs:correct?[...r.clearedTrackBombs,checkpoint]:[]
  });
  return pushLog({...state,racers},correct
    ?racer.name+" desarmou a bomba do km "+checkpoint+" e pode continuar."
    :"BOOM! "+racer.name+" errou a bomba do km "+checkpoint+" e voltou ao início.");
}

export function resolveNpcTrackBombs(state:RaceState,rng:()=>number=Math.random):RaceState {
  let next=state;
  for(const racer of state.racers){
    if(racer.kind!=="npc" || racer.pendingTrackBomb===null) continue;
    const decision=npcDecision(racer.npcSkill??"intermediate",rng);
    next=resolveTrackBomb(next,racer.id,decision.correct);
  }
  return next;
}

function checkpointReward(before:number,after:number):number {
  return CHECKPOINTS.filter(point=>before<point && after>=point).length;
}

function applyRoundMovement(state:RaceState):RaceState {
  let racers=state.racers.map(r=>({...r}));
  const unresolved=Object.values(state.bombChallenges).filter(c=>!c.resolved);
  for(const challenge of unresolved){
    racers=racers.map(r=>r.id===challenge.targetId
      ? {...r,blockedRound:state.round,protectedUntilRound:Math.max(r.protectedUntilRound,state.round+1)}
      : r
    );
  }

  racers=racers.map(racer=>{
    const submission=state.submissions[racer.id];
    if(!submission || !submission.correct || racer.blockedRound===state.round || racer.pendingTrackBomb!==null) return racer;

    const before=racer.progress;
    const after=Math.min(state.finishLine+BASE_ADVANCE,racer.progress+BASE_ADVANCE);
    const newCorrect=racer.correctAnswers+1;
    const checkpointCharges=checkpointReward(before,after);
    const comboCharge=newCorrect%3===0?1:0;
    const reachedBomb=CHECKPOINTS.find(point=>
      point<state.finishLine && point>before && point<=after && !racer.clearedTrackBombs.includes(point)
    )??null;
    return {
      ...racer,
      progress:reachedBomb??after,
      pendingTrackBomb:reachedBomb,
      correctAnswers:newCorrect,
      totalCorrectResponseMs:racer.totalCorrectResponseMs+submission.responseMs,
      bombCharges:Math.min(MAX_BOMB_CHARGES,racer.bombCharges+checkpointCharges+comboCharge)
    };
  });
  return {...state,racers};
}

function winnerAfterRound(state:RaceState):{winnerId:string|null;tie:boolean} {
  const finishers=state.racers.filter(r=>r.progress>=state.finishLine);
  if(!finishers.length) return {winnerId:null,tie:false};
  const ordered=[...finishers].sort((a,b)=>
    b.progress-a.progress ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs ||
    b.correctAnswers-a.correctAnswers
  );
  const top=ordered[0]!;
  const tied=ordered.filter(r=>
    r.progress===top.progress &&
    r.totalCorrectResponseMs===top.totalCorrectResponseMs &&
    r.correctAnswers===top.correctAnswers
  );
  return tied.length>1?{winnerId:null,tie:true}:{winnerId:top.id,tie:false};
}

export function resolveRound(state:RaceState,now:number):RaceState {
  if(state.phase!=="round-open" || state.roundDeadlineAt===null) throw new Error("Não há rodada aberta.");
  if(now<state.roundDeadlineAt) throw new Error("A rodada ainda não terminou.");

  const beforePositions=new Map(ranking(state).map((r,index)=>[r.id,index+1]));
  let next=applyRoundMovement(state);
  const afterOrder=ranking(next);
  for(const [index,racer] of afterOrder.entries()){
    const before=beforePositions.get(racer.id) ?? index+1;
    const after=index+1;
    if(after<before){
      next=pushLog(next,racer.name+" ganhou "+(before-after)+" posição(ões) nesta rodada.");
    }
  }
  const result=winnerAfterRound(next);

  if(result.winnerId){
    const winner=next.racers.find(r=>r.id===result.winnerId)!;
    next={...next,phase:"finished",winnerId:result.winnerId,tieBreaker:false};
    return pushLog(next,winner.name+" venceu a Corrida Maluca!");
  }

  if(result.tie){
    next={...next,phase:"round-resolution",winnerId:null,tieBreaker:true};
    return pushLog(next,"Empate total na chegada: haverá uma rodada extra.");
  }

  next={...next,phase:"round-resolution",winnerId:null,tieBreaker:false};
  return pushLog(next,"Rodada "+state.round+" concluída.");
}

export function allHumansSubmitted(state:RaceState):boolean {
  return state.racers.filter(r=>r.kind==="human").every(r=>Boolean(state.submissions[r.id]));
}

export function progressPercent(state:RaceState,racerId:string):number {
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer) return 0;
  return Math.min(100,Math.round((racer.progress/state.finishLine)*100));
}

/** Cronômetro global de 05:00, com desconto individual por erro nas bombas. */
export function startTimedRace(state:RaceState,now:number):RaceState{
  if(state.phase!=="waiting") throw new Error("A corrida já começou.");
  return pushLog({...state,round:1,phase:"round-open",roundStartedAt:now,
    roundDeadlineAt:now+MATCH_DURATION_MS,matchStartedAt:now,
    matchDeadlineAt:now+MATCH_DURATION_MS,submissions:{},winnerId:null},
  "Desafio de 05:00 iniciado: vence quem acertar mais contas.");
}
export function racerDeadline(state:RaceState,racerId:string):number{
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer||state.matchDeadlineAt==null) throw new Error("Competidor ou corrida inválidos.");
  return state.matchDeadlineAt-racer.timePenaltyMs;
}
export function answerTimedRace(state:RaceState,racerId:string,correct:boolean,responseMs:number,now:number):RaceState{
  if(state.phase!=="round-open"||state.matchDeadlineAt==null||now>=racerDeadline(state,racerId)){
    throw new Error("O tempo da corrida terminou para este jogador.");
  }
  if(!Number.isFinite(responseMs)||responseMs<0) throw new Error("Tempo de resposta inválido.");
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer) throw new Error("Competidor inválido.");
  if(racer.pendingTrackBomb!==null) throw new Error("Desarme a bomba antes de continuar.");
  if(Object.values(state.bombChallenges).some(c=>c.targetId===racerId&&!c.resolved)){
    throw new Error("Neutralize a bomba recebida para continuar.");
  }
  const racers=state.racers.map(r=>{
    if(r.id!==racerId) return r;
    if(!correct) return {...r,errors:r.errors+1};
    const newCorrect=r.correctAnswers+1;
    return {...r,correctAnswers:newCorrect,progress:newCorrect*TIMED_ADVANCE,
      totalCorrectResponseMs:r.totalCorrectResponseMs+Math.min(responseMs,MATCH_DURATION_MS),
      bombCharges:Math.min(MAX_BOMB_CHARGES,r.bombCharges+(newCorrect%3===0?1:0))};
  });
  return {...state,racers};
}
/** Três bombas por competidor disparadas pelo tempo de prova, não pelos metros. */
export function triggerTimedTrackBombs(state:RaceState,now:number):RaceState{
  if(state.phase!=="round-open"||state.matchStartedAt==null||state.matchDeadlineAt==null) return state;
  const elapsed=now-state.matchStartedAt;
  const racers=state.racers.map(r=>{
    if(r.pendingTrackBomb!==null||now>=racerDeadline(state,r.id)) return r;
    const checkpoint=TIMED_BOMBS.find(t=>elapsed>=t&&!r.clearedTrackBombs.includes(t));
    return checkpoint===undefined?r:{...r,pendingTrackBomb:checkpoint};
  });
  return {...state,racers};
}
/** Erro na bomba desconta 10 segundos; não remove acertos nem metros acumulados. */
export function resolveTimedTrackBomb(state:RaceState,racerId:string,correct:boolean):RaceState{
  const racer=state.racers.find(r=>r.id===racerId);
  if(!racer||racer.pendingTrackBomb===null) throw new Error("Não há bomba pendente.");
  const bomb=racer.pendingTrackBomb;
  const racers=state.racers.map(r=>r.id===racerId?{...r,pendingTrackBomb:null,
    clearedTrackBombs:[...r.clearedTrackBombs,bomb],
    timePenaltyMs:r.timePenaltyMs+(correct?0:BOMB_PENALTY_MS)}:r);
  return pushLog({...state,racers},correct
    ?racer.name+" desarmou a bomba "+(TIMED_BOMBS.indexOf(bomb as typeof TIMED_BOMBS[number])+1)+"."
    :racer.name+" errou a bomba e perdeu 10 segundos de prova.");
}
export function tickTimedNpcs(state:RaceState,now:number,rng:()=>number=Math.random):RaceState{
  if(state.phase!=="round-open"||state.matchDeadlineAt==null||now>=state.matchDeadlineAt) return state;
  let next={...state,round:state.round+1};
  for(const npc of state.racers.filter(r=>r.kind==="npc")){
    if(now>=racerDeadline(next,npc.id)) continue;
    if(npc.pendingTrackBomb!==null){
      const decision=npcDecision(npc.npcSkill??"intermediate",rng);
      next=resolveTimedTrackBomb(next,npc.id,decision.correct);
      continue;
    }
    const decision=npcDecision(npc.npcSkill??"intermediate",rng);
    next=answerTimedRace(next,npc.id,decision.correct,decision.responseMs,now);
  }
  return next;
}
export function finishTimedRace(state:RaceState,now:number):RaceState{
  if(state.phase!=="round-open"||state.matchDeadlineAt==null) throw new Error("Corrida não iniciada.");
  if(now<state.matchDeadlineAt) throw new Error("Os cinco minutos ainda não acabaram.");
  const sorted=ranking(state);
  const first=sorted[0]!;
  const second=sorted[1];
  const tied=!!second&&first.correctAnswers===second.correctAnswers &&
    first.errors===second.errors&&first.totalCorrectResponseMs===second.totalCorrectResponseMs;
  const winnerId=tied?null:first.id;
  return pushLog({...state,phase:"finished",winnerId,tieBreaker:tied},
    winnerId?first.name+" venceu com "+first.correctAnswers+" acertos!":"Corrida encerrada em empate!");
}
