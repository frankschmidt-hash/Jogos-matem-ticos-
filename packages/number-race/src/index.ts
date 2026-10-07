export type RacerKind = "human" | "npc";
export type NpcSkill = "beginner" | "intermediate" | "advanced";
export type RacePhase = "waiting" | "round-open" | "round-resolution" | "finished";

export type Racer = {
  id:string;
  name:string;
  kind:RacerKind;
  npcSkill?:NpcSkill;
  progress:number;
  correctAnswers:number;
  errors:number;
  streak:number;
  bestStreak:number;
  totalCorrectResponseMs:number;
};

export type RoundSubmission = {
  racerId:string;
  correct:boolean;
  responseMs:number;
  submittedAt:number;
};

export type RaceLog = {id:number;message:string};

export type NumberRaceState = {
  racers:Racer[];
  round:number;
  phase:RacePhase;
  roundStartedAt:number|null;
  roundDeadlineAt:number|null;
  submissions:Record<string,RoundSubmission>;
  winnerId:string|null;
  tieBreaker:boolean;
  finishLine:number;
  log:RaceLog[];
  nextLogId:number;
};

export type RaceHuman={id:string;name:string};

export type RacerStats={
  racerId:string;
  position:number;
  correctAnswers:number;
  errors:number;
  accuracy:number;
  bestStreak:number;
  averageCorrectResponseMs:number|null;
  progress:number;
};

export const TOTAL_RACERS=6;
export const ROUND_DURATION_MS=20_000;
export const BASE_ADVANCE=100;
export const MAX_BONUS=20;
export const FINISH_LINE=900;

const NPC_NAMES=["Sigma","Delta","Nexo","Prisma","Ábaco","Vetor"] as const;
const NPC_SKILLS:NpcSkill[]=["beginner","intermediate","advanced","intermediate","advanced","beginner"];

function pushLog(state:NumberRaceState,message:string):NumberRaceState{
  const item={id:state.nextLogId,message};
  return {...state,nextLogId:state.nextLogId+1,log:[item,...state.log].slice(0,10)};
}

export function createNumberRace(humans:RaceHuman[],finishLine=FINISH_LINE):NumberRaceState{
  if(humans.length<1||humans.length>TOTAL_RACERS) throw new Error("A corrida precisa de 1 a 6 jogadores humanos.");
  const humanRacers:Racer[]=humans.map(h=>({
    id:h.id,name:h.name,kind:"human",progress:0,correctAnswers:0,errors:0,
    streak:0,bestStreak:0,totalCorrectResponseMs:0
  }));
  const npcs:Racer[]=[];
  for(let i=humans.length;i<TOTAL_RACERS;i++){
    const j=i-humans.length;
    npcs.push({
      id:"number-npc-"+(j+1),
      name:NPC_NAMES[j]??"NPC "+(j+1),
      kind:"npc",
      npcSkill:NPC_SKILLS[j]??"intermediate",
      progress:0,correctAnswers:0,errors:0,streak:0,bestStreak:0,totalCorrectResponseMs:0
    });
  }
  return {
    racers:[...humanRacers,...npcs],round:0,phase:"waiting",
    roundStartedAt:null,roundDeadlineAt:null,submissions:{},
    winnerId:null,tieBreaker:false,finishLine,
    log:[{id:0,message:"Corrida Numérica preparada com 6 competidores."}],nextLogId:1
  };
}

export function ranking(state:NumberRaceState):Racer[]{
  return [...state.racers].sort((a,b)=>
    b.progress-a.progress ||
    b.correctAnswers-a.correctAnswers ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs ||
    a.name.localeCompare(b.name,"pt-BR")
  );
}

export function startRound(state:NumberRaceState,now:number):NumberRaceState{
  if(state.phase==="finished") throw new Error("A corrida já terminou.");
  if(state.phase==="round-open") throw new Error("Já existe uma rodada aberta.");
  const next={...state,round:state.round+1,phase:"round-open" as const,
    roundStartedAt:now,roundDeadlineAt:now+ROUND_DURATION_MS,submissions:{}};
  return pushLog(next,next.tieBreaker?"Rodada extra de desempate iniciada.":"Rodada "+next.round+" iniciada.");
}

export function submitAnswer(
  state:NumberRaceState,racerId:string,correct:boolean,responseMs:number,submittedAt:number
):NumberRaceState{
  if(state.phase!=="round-open"||state.roundStartedAt===null||state.roundDeadlineAt===null) throw new Error("Não há rodada aberta.");
  if(!state.racers.some(r=>r.id===racerId)) throw new Error("Competidor inválido.");
  if(state.submissions[racerId]) throw new Error("Resposta já enviada nesta rodada.");
  const timedOut=submittedAt>state.roundDeadlineAt;
  const safeMs=Math.max(0,Math.min(ROUND_DURATION_MS,responseMs));
  return {...state,submissions:{...state.submissions,[racerId]:{
    racerId,correct:timedOut?false:correct,responseMs:timedOut?ROUND_DURATION_MS:safeMs,submittedAt
  }}};
}

export function npcDecision(skill:NpcSkill,rng:()=>number=Math.random):{correct:boolean;responseMs:number}{
  const chance=skill==="advanced"?0.87:skill==="intermediate"?0.76:0.64;
  const min=skill==="advanced"?4200:skill==="intermediate"?5600:7200;
  const max=skill==="advanced"?11000:skill==="intermediate"?14500:17800;
  return {correct:rng()<chance,responseMs:Math.floor(min+rng()*(max-min))};
}

export function submitNpcAnswers(state:NumberRaceState,rng:()=>number=Math.random):NumberRaceState{
  if(state.phase!=="round-open"||state.roundStartedAt===null) return state;
  let next=state;
  for(const racer of state.racers){
    if(racer.kind!=="npc"||next.submissions[racer.id]) continue;
    const decision=npcDecision(racer.npcSkill??"intermediate",rng);
    next=submitAnswer(next,racer.id,decision.correct,decision.responseMs,state.roundStartedAt+decision.responseMs);
  }
  return next;
}

export function impulseBonus(streakAfterCorrect:number,responseMs:number):number{
  let streakBonus=0;
  if(streakAfterCorrect>=5) streakBonus=12;
  else if(streakAfterCorrect>=3) streakBonus=6;

  let speedBonus=0;
  if(responseMs<=5_000) speedBonus=8;
  else if(responseMs<=10_000) speedBonus=4;

  return Math.min(MAX_BONUS,streakBonus+speedBonus);
}

export function advanceForCorrect(streakAfterCorrect:number,responseMs:number):number{
  return BASE_ADVANCE+impulseBonus(streakAfterCorrect,responseMs);
}

function applyRound(state:NumberRaceState):NumberRaceState{
  const racers=state.racers.map(racer=>{
    const submission=state.submissions[racer.id];
    if(!submission||!submission.correct){
      return {...racer,errors:racer.errors+1,streak:0};
    }
    const streak=racer.streak+1;
    const advance=advanceForCorrect(streak,submission.responseMs);
    return {
      ...racer,
      progress:Math.min(state.finishLine+BASE_ADVANCE,racer.progress+advance),
      correctAnswers:racer.correctAnswers+1,
      streak,
      bestStreak:Math.max(racer.bestStreak,streak),
      totalCorrectResponseMs:racer.totalCorrectResponseMs+submission.responseMs
    };
  });
  return {...state,racers};
}

function finishResult(state:NumberRaceState):{winnerId:string|null;tie:boolean}{
  const finishers=state.racers.filter(r=>r.progress>=state.finishLine);
  if(!finishers.length) return {winnerId:null,tie:false};
  const ordered=[...finishers].sort((a,b)=>
    b.progress-a.progress ||
    b.correctAnswers-a.correctAnswers ||
    a.totalCorrectResponseMs-b.totalCorrectResponseMs
  );
  const top=ordered[0]!;
  const tied=ordered.filter(r=>
    r.progress===top.progress &&
    r.correctAnswers===top.correctAnswers &&
    r.totalCorrectResponseMs===top.totalCorrectResponseMs
  );
  return tied.length>1?{winnerId:null,tie:true}:{winnerId:top.id,tie:false};
}

export function resolveRound(state:NumberRaceState,now:number):NumberRaceState{
  if(state.phase!=="round-open"||state.roundDeadlineAt===null) throw new Error("Não há rodada aberta.");
  if(now<state.roundDeadlineAt) throw new Error("A rodada ainda não terminou.");

  const before=new Map(ranking(state).map((r,i)=>[r.id,i+1]));
  let next=applyRound(state);
  for(const [i,racer] of ranking(next).entries()){
    const old=before.get(racer.id)??i+1;
    const pos=i+1;
    if(pos<old) next=pushLog(next,racer.name+" avançou "+(old-pos)+" posição(ões).");
  }

  const result=finishResult(next);
  if(result.winnerId){
    const winner=next.racers.find(r=>r.id===result.winnerId)!;
    return pushLog({...next,phase:"finished",winnerId:result.winnerId,tieBreaker:false},winner.name+" venceu a Corrida Numérica!");
  }
  if(result.tie){
    return pushLog({...next,phase:"round-resolution",winnerId:null,tieBreaker:true},"Empate total: rodada extra.");
  }
  return pushLog({...next,phase:"round-resolution",winnerId:null,tieBreaker:false},"Rodada "+state.round+" concluída.");
}

export function statsFor(state:NumberRaceState,racerId:string):RacerStats{
  const ordered=ranking(state);
  const racer=ordered.find(r=>r.id===racerId);
  if(!racer) throw new Error("Competidor inválido.");
  const attempts=racer.correctAnswers+racer.errors;
  return {
    racerId,
    position:ordered.findIndex(r=>r.id===racerId)+1,
    correctAnswers:racer.correctAnswers,
    errors:racer.errors,
    accuracy:attempts?Math.round((racer.correctAnswers/attempts)*100):0,
    bestStreak:racer.bestStreak,
    averageCorrectResponseMs:racer.correctAnswers?Math.round(racer.totalCorrectResponseMs/racer.correctAnswers):null,
    progress:racer.progress
  };
}

export function progressPercent(state:NumberRaceState,racerId:string):number{
  const racer=state.racers.find(r=>r.id===racerId);
  return racer?Math.min(100,Math.round(racer.progress/state.finishLine*100)):0;
}
