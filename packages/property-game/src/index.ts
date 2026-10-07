import { BOARD, getSpace, groupPropertyIndexes, type BoardSpace } from "./board";
export { BOARD, GROUP_LABELS, getSpace, groupPropertyIndexes, type BoardSpace, type PropertyGroup } from "./board";

export type PlayerKind = "human" | "npc";
export type GamePhase = "awaiting-roll" | "awaiting-answer" | "awaiting-purchase" | "turn-end" | "finished";
export type MatchMode = "short" | "full";

export type PlayerState = {
  id:string;
  name:string;
  kind:PlayerKind;
  position:number;
  balance:number;
  bankrupt:boolean;
  npcSkill?: "beginner" | "intermediate" | "advanced";
};

export type PropertyState = {
  spaceIndex:number;
  ownerId:string | null;
  level:0|1|2|3;
};

export type GameLog = {
  id:number;
  message:string;
};

export type PendingMove = {
  die:number;
};

export type GameState = {
  players:PlayerState[];
  properties:Record<number,PropertyState>;
  activePlayerIndex:number;
  phase:GamePhase;
  mode:MatchMode;
  round:number;
  maxRounds:number | null;
  pendingMove:PendingMove | null;
  pendingPropertyIndex:number | null;
  winnerId:string | null;
  nextLogId:number;
  log:GameLog[];
};

export type GameOptions = {
  humanName:string;
  totalPlayers:2|3|4;
  mode:MatchMode;
  shortRounds?:number;
};

export const INITIAL_BALANCE=1800;
export const START_REWARD=150;
export const WRONG_NEAR_START_PENALTY=200;
export const NPC_RESERVE=350;

const NPC_NAMES=["Nina Vetor","Theo Prisma","Lia Órbita"] as const;

const propertyMap=():Record<number,PropertyState> => Object.fromEntries(
  BOARD.filter(space=>space.type==="property").map(space=>[space.index,{spaceIndex:space.index,ownerId:null,level:0}])
);

function withLog(state:GameState,message:string):GameState {
  const entry={id:state.nextLogId,message};
  return {...state,nextLogId:state.nextLogId+1,log:[entry,...state.log].slice(0,8)};
}

export function createGame(options:GameOptions):GameState {
  const players:PlayerState[]=[{
    id:"human-1",name:options.humanName,kind:"human",position:0,balance:INITIAL_BALANCE,bankrupt:false
  }];
  for(let i=1;i<options.totalPlayers;i++){
    players.push({
      id:`npc-${i}`,
      name:NPC_NAMES[i-1] ?? `NPC ${i}`,
      kind:"npc",
      position:0,
      balance:INITIAL_BALANCE,
      bankrupt:false,
      npcSkill:i===1?"beginner":i===2?"intermediate":"advanced"
    });
  }
  return {
    players,
    properties:propertyMap(),
    activePlayerIndex:0,
    phase:"awaiting-roll",
    mode:options.mode,
    round:1,
    maxRounds:options.mode==="short" ? Math.max(4,options.shortRounds ?? 12) : null,
    pendingMove:null,
    pendingPropertyIndex:null,
    winnerId:null,
    nextLogId:1,
    log:[{id:0,message:"Partida iniciada na Cidade Prisma."}]
  };
}

export function activePlayer(state:GameState):PlayerState {
  const player=state.players[state.activePlayerIndex];
  if(!player) throw new Error("Jogador ativo inválido.");
  return player;
}

function replacePlayer(state:GameState, player:PlayerState):GameState {
  return {...state,players:state.players.map(p=>p.id===player.id?player:p)};
}

function releaseProperty(state:GameState,index:number):GameState {
  return {...state,properties:{...state.properties,[index]:{spaceIndex:index,ownerId:null,level:0}}};
}

export function propertyAssetValue(state:GameState,index:number):number {
  const space=getSpace(index);
  if(space.type!=="property") return 0;
  const property=state.properties[index];
  if(!property) return 0;
  return space.price + property.level*space.upgradeCost;
}

export function liquidationValue(state:GameState,index:number):number {
  return Math.floor(propertyAssetValue(state,index)*0.7);
}

export function netWorth(state:GameState,playerId:string):number {
  const player=state.players.find(p=>p.id===playerId);
  if(!player) return 0;
  return player.balance + Object.values(state.properties)
    .filter(p=>p.ownerId===playerId)
    .reduce((sum,p)=>sum+propertyAssetValue(state,p.spaceIndex),0);
}

function chargePlayer(state:GameState,playerId:string,amount:number):{state:GameState; paid:number} {
  let next=state;
  let player=next.players.find(p=>p.id===playerId);
  if(!player || player.bankrupt || amount<=0) return {state:next,paid:0};

  const owned=Object.values(next.properties)
    .filter(p=>p.ownerId===playerId)
    .sort((a,b)=>liquidationValue(next,b.spaceIndex)-liquidationValue(next,a.spaceIndex));

  for(const property of owned){
    if(player.balance>=amount) break;
    const value=liquidationValue(next,property.spaceIndex);
    player={...player,balance:player.balance+value};
    next=replacePlayer(next,player);
    next=releaseProperty(next,property.spaceIndex);
    next=withLog(next,`${player.name} vendeu um imóvel ao banco por ${value} CP para cobrir uma dívida.`);
  }

  const paid=Math.min(player.balance,amount);
  player={...player,balance:player.balance-paid};
  next=replacePlayer(next,player);

  if(paid<amount){
    player={...player,balance:0,bankrupt:true};
    next=replacePlayer(next,player);
    for(const property of Object.values(next.properties).filter(p=>p.ownerId===playerId)){
      next=releaseProperty(next,property.spaceIndex);
    }
    next=withLog(next,`${player.name} ficou insolvente e saiu da disputa.`);
  }

  return {state:next,paid};
}

function creditPlayer(state:GameState,playerId:string,amount:number):GameState {
  const player=state.players.find(p=>p.id===playerId);
  if(!player || player.bankrupt) return state;
  return replacePlayer(state,{...player,balance:player.balance+Math.max(0,amount)});
}

function moveForward(state:GameState,playerId:string,steps:number,rewardStart=true):GameState {
  const player=state.players.find(p=>p.id===playerId);
  if(!player) return state;
  const raw=player.position+steps;
  const laps=Math.floor(raw/BOARD.length);
  const position=((raw%BOARD.length)+BOARD.length)%BOARD.length;
  let next=replacePlayer(state,{...player,position});
  if(rewardStart && laps>0){
    next=creditPlayer(next,playerId,laps*START_REWARD);
    next=withLog(next,`${player.name} passou pelo Portal de Partida e recebeu ${laps*START_REWARD} CP.`);
  }
  return next;
}

function moveBackwardForWrong(state:GameState,playerId:string,steps:number):GameState {
  const player=state.players.find(p=>p.id===playerId);
  if(!player) return state;
  if(player.position-steps<0){
    let next=replacePlayer(state,{...player,position:0});
    next=withLog(next,`${player.name} não tinha casas suficientes para recuar e parou no início.`);
    const charged=chargePlayer(next,playerId,WRONG_NEAR_START_PENALTY);
    next=withLog(charged.state,`${player.name} pagou ${charged.paid} CP ao banco pela penalidade de retorno ao início.`);
    return next;
  }
  return replacePlayer(state,{...player,position:player.position-steps});
}

export type CityEvent = {title:string; description:string; kind:"credit"|"debit"|"move"; amount:number};

export const EVENTS: readonly CityEvent[] = [
  {title:"Projeto Premiado",description:"Seu projeto escolar recebeu apoio da cidade.",kind:"credit",amount:120},
  {title:"Manutenção de Fachada",description:"Uma reforma inesperada gerou despesas.",kind:"debit",amount:90},
  {title:"Atalho da Biblioteca",description:"Você encontrou um caminho mais rápido.",kind:"move",amount:2},
  {title:"Feira Comunitária",description:"Sua participação rendeu créditos extras.",kind:"credit",amount:80},
  {title:"Conserto de Equipamentos",description:"Foi necessário fazer uma manutenção.",kind:"debit",amount:70},
  {title:"Rota Interditada",description:"Uma obra obrigou você a retornar.",kind:"move",amount:-2}
] as const;

function resolveEvent(state:GameState,playerId:string,rng:()=>number):GameState {
  const event=EVENTS[Math.min(EVENTS.length-1,Math.floor(rng()*EVENTS.length))]!;
  let next=withLog(state,`Evento — ${event.title}: ${event.description}`);
  if(event.kind==="credit") next=creditPlayer(next,playerId,event.amount);
  if(event.kind==="debit"){
    const charged=chargePlayer(next,playerId,event.amount);
    next=charged.state;
  }
  if(event.kind==="move"){
    if(event.amount>=0) next=moveForward(next,playerId,event.amount,false);
    else {
      const player=next.players.find(p=>p.id===playerId);
      if(player) next=replacePlayer(next,{...player,position:Math.max(0,player.position+event.amount)});
    }
  }
  return next;
}

function rentFor(space:Extract<BoardSpace,{type:"property"}>,level:number):number {
  return Math.floor(space.rent*(1+level*1.25));
}

function resolveLanding(state:GameState,playerId:string,rng:()=>number):GameState {
  const player=state.players.find(p=>p.id===playerId);
  if(!player || player.bankrupt) return {...state,phase:"turn-end"};
  const space=getSpace(player.position);
  let next=state;

  if(space.type==="property"){
    const property=next.properties[space.index]!;
    if(property.ownerId===null){
      return withLog({...next,phase:"awaiting-purchase",pendingPropertyIndex:space.index},`${player.name} chegou a ${space.name}, disponível por ${space.price} CP.`);
    }
    if(property.ownerId!==playerId){
      const owner=next.players.find(p=>p.id===property.ownerId);
      if(owner && !owner.bankrupt){
        const rent=rentFor(space,property.level);
        const charged=chargePlayer(next,playerId,rent);
        next=charged.state;
        next=creditPlayer(next,owner.id,charged.paid);
        next=withLog(next,`${player.name} pagou ${charged.paid} CP de aluguel a ${owner.name}.`);
      }
    }
  } else if(space.type==="tax" || space.type==="penalty" || space.type==="service"){
    const charged=chargePlayer(next,playerId,space.amount);
    next=withLog(charged.state,`${player.name} pagou ${charged.paid} CP em ${space.name}.`);
  } else if(space.type==="bonus" || space.type==="transport"){
    next=creditPlayer(next,playerId,space.amount);
    next=withLog(next,`${player.name} recebeu ${space.amount} CP em ${space.name}.`);
  } else if(space.type==="event"){
    next=resolveEvent(next,playerId,rng);
  } else if(space.type==="rest"){
    next=withLog(next,`${player.name} fez uma pausa em ${space.name}.`);
  } else {
    next=withLog(next,`${player.name} está no ${space.name}.`);
  }
  return {...next,phase:"turn-end",pendingPropertyIndex:null};
}

export function rollDice(state:GameState,die:number):GameState {
  if(state.phase!=="awaiting-roll") throw new Error("Não é possível lançar os dados agora.");
  if(!Number.isInteger(die) || die<1 || die>6) throw new Error("Valor do dado inválido.");
  const player=activePlayer(state);
  return withLog({...state,phase:"awaiting-answer",pendingMove:{die}},`${player.name} tirou ${die} no dado. Resolva a conta para mover.`);
}

export function resolveMathMove(state:GameState,correct:boolean,rng:()=>number=Math.random):GameState {
  if(state.phase!=="awaiting-answer" || !state.pendingMove) throw new Error("Não há movimento aguardando resposta.");
  const player=activePlayer(state);
  const die=state.pendingMove.die;
  let next={...state,pendingMove:null} as GameState;
  if(correct){
    next=moveForward(next,player.id,die,true);
    next=withLog(next,`Resposta correta: ${player.name} avançou ${die} casa(s).`);
  } else {
    next=moveBackwardForWrong(next,player.id,die);
    next=withLog(next,`Resposta incorreta: ${player.name} recuou até a posição ${next.players.find(p=>p.id===player.id)!.position}.`);
  }
  return resolveLanding(next,player.id,rng);
}

export function buyPendingProperty(state:GameState,buy:boolean):GameState {
  if(state.phase!=="awaiting-purchase" || state.pendingPropertyIndex===null) throw new Error("Não há propriedade aguardando decisão.");
  const player=activePlayer(state);
  const index=state.pendingPropertyIndex;
  const space=getSpace(index);
  if(space.type!=="property") throw new Error("Casa inválida para compra.");
  let next=state;
  if(buy && player.balance>=space.price && !player.bankrupt){
    next=replacePlayer(next,{...player,balance:player.balance-space.price});
    next={...next,properties:{...next.properties,[index]:{spaceIndex:index,ownerId:player.id,level:0}}};
    next=withLog(next,`${player.name} comprou ${space.name} por ${space.price} CP.`);
  } else {
    next=withLog(next,buy?`${player.name} não possui saldo suficiente para comprar ${space.name}.`:`${player.name} decidiu não comprar ${space.name}.`);
  }
  return {...next,phase:"turn-end",pendingPropertyIndex:null};
}

export function ownsFullGroup(state:GameState,playerId:string,spaceIndex:number):boolean {
  const space=getSpace(spaceIndex);
  if(space.type!=="property") return false;
  return groupPropertyIndexes(space.group).every(index=>state.properties[index]?.ownerId===playerId);
}

export function upgradeProperty(state:GameState,playerId:string,spaceIndex:number):GameState {
  if(state.phase!=="awaiting-roll") throw new Error("Melhorias só podem ser feitas antes de lançar os dados.");
  const space=getSpace(spaceIndex);
  if(space.type!=="property") throw new Error("Esta casa não pode ser melhorada.");
  const property=state.properties[spaceIndex];
  const player=state.players.find(p=>p.id===playerId);
  if(!property || !player || property.ownerId!==playerId) throw new Error("Esta propriedade não pertence ao jogador.");
  if(property.level>=3) throw new Error("A propriedade já está no nível máximo.");
  if(!ownsFullGroup(state,playerId,spaceIndex)) throw new Error("É necessário possuir todo o grupo para melhorar.");
  if(player.balance<space.upgradeCost) throw new Error("Saldo insuficiente para melhorar.");

  let next=replacePlayer(state,{...player,balance:player.balance-space.upgradeCost});
  next={...next,properties:{...next.properties,[spaceIndex]:{...property,level:(property.level+1) as 1|2|3}}};
  return withLog(next,`${player.name} melhorou ${space.name} para o nível ${property.level+1}.`);
}

export function sellProperty(state:GameState,playerId:string,spaceIndex:number):GameState {
  if(state.phase!=="awaiting-roll") throw new Error("Vendas só podem ser feitas antes de lançar os dados.");
  const property=state.properties[spaceIndex];
  const player=state.players.find(p=>p.id===playerId);
  if(!property || !player || property.ownerId!==playerId) throw new Error("Esta propriedade não pertence ao jogador.");
  const value=liquidationValue(state,spaceIndex);
  let next=replacePlayer(state,{...player,balance:player.balance+value});
  next=releaseProperty(next,spaceIndex);
  return withLog(next,`${player.name} vendeu ${getSpace(spaceIndex).name} ao banco por ${value} CP.`);
}

function livingPlayers(state:GameState):PlayerState[] {
  return state.players.filter(p=>!p.bankrupt);
}

function winnerByWealth(state:GameState):string|null {
  const candidates=livingPlayers(state);
  if(!candidates.length) return null;
  return [...candidates].sort((a,b)=>netWorth(state,b.id)-netWorth(state,a.id) || b.balance-a.balance)[0]!.id;
}

function finishIfNeeded(state:GameState):GameState {
  const living=livingPlayers(state);
  if(living.length<=1){
    return {...state,phase:"finished",winnerId:living[0]?.id ?? null};
  }
  if(state.mode==="short" && state.maxRounds!==null && state.round>state.maxRounds){
    return {...state,phase:"finished",winnerId:winnerByWealth(state)};
  }
  return state;
}

export function endTurn(state:GameState):GameState {
  if(state.phase!=="turn-end") throw new Error("O turno ainda não pode ser encerrado.");
  let next=finishIfNeeded(state);
  if(next.phase==="finished") return next;

  let index=next.activePlayerIndex;
  let wrapped=false;
  do {
    index=(index+1)%next.players.length;
    if(index===0) wrapped=true;
  } while(next.players[index]?.bankrupt && index!==next.activePlayerIndex);

  next={...next,activePlayerIndex:index,phase:"awaiting-roll",pendingMove:null,pendingPropertyIndex:null,round:next.round+(wrapped?1:0)};
  return finishIfNeeded(next);
}

export function npcShouldBuy(state:GameState):boolean {
  if(state.phase!=="awaiting-purchase" || state.pendingPropertyIndex===null) return false;
  const player=activePlayer(state);
  const space=getSpace(state.pendingPropertyIndex);
  return player.kind==="npc" && space.type==="property" && player.balance-space.price>=NPC_RESERVE;
}

export function npcAnswerCorrect(player:PlayerState,rng:()=>number=Math.random):boolean {
  const chance=player.npcSkill==="advanced"?0.84:player.npcSkill==="intermediate"?0.76:0.68;
  return rng()<chance;
}

export function npcImproveBest(state:GameState):GameState {
  const player=activePlayer(state);
  if(player.kind!=="npc" || state.phase!=="awaiting-roll") return state;
  const candidates=Object.values(state.properties)
    .filter(p=>p.ownerId===player.id && p.level<3 && ownsFullGroup(state,player.id,p.spaceIndex))
    .sort((a,b)=>propertyAssetValue(state,b.spaceIndex)-propertyAssetValue(state,a.spaceIndex));
  const choice=candidates[0];
  if(!choice) return state;
  const space=getSpace(choice.spaceIndex);
  if(space.type!=="property" || player.balance-space.upgradeCost<NPC_RESERVE) return state;
  return upgradeProperty(state,player.id,choice.spaceIndex);
}

export function currentRent(state:GameState,spaceIndex:number):number {
  const space=getSpace(spaceIndex);
  const property=state.properties[spaceIndex];
  return space.type==="property" && property ? rentFor(space,property.level) : 0;
}
