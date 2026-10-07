import { describe, expect, it } from "vitest";
import {
  BOARD, WRONG_NEAR_START_PENALTY, activePlayer, buyPendingProperty, createGame,
  currentRent, endTurn, netWorth, npcShouldBuy, resolveMathMove, rollDice,
  sellProperty, upgradeProperty
} from "./index";

const game=()=>createGame({humanName:"Aluno",totalPlayers:2,mode:"short",shortRounds:4});

describe("Banco Imobiliário Matemático",()=>{
  it("acerto avança exatamente o valor do dado",()=>{
    const s=resolveMathMove(rollDice(game(),4),true,()=>0);
    expect(s.players[0]!.position).toBe(4);
  });

  it("erro recua exatamente o valor do dado quando há espaço",()=>{
    let s=game();
    s={...s,players:s.players.map((p,i)=>i===0?{...p,position:10}:p)};
    s=resolveMathMove(rollDice(s,4),false,()=>0);
    expect(s.players[0]!.position).toBe(6);
  });

  it("erro perto do início leva ao início e cobra 200 CP",()=>{
    let s=game();
    s={...s,players:s.players.map((p,i)=>i===0?{...p,position:2}:p)};
    s=resolveMathMove(rollDice(s,5),false,()=>0);
    expect(s.players[0]!.position).toBe(0);
    expect(s.players[0]!.balance).toBe(1800-WRONG_NEAR_START_PENALTY);
  });

  it("dívida vende patrimônio automaticamente antes de falir",()=>{
    let s=game();
    s={...s,players:s.players.map((p,i)=>i===0?{...p,balance:130}:p)};
    s=resolveMathMove(rollDice(s,1),true,()=>0);
    s=buyPendingProperty(s,true);
    expect(s.players[0]!.balance).toBe(10);
    s=endTurn(s);
    s=endTurn({...s,activePlayerIndex:0,phase:"turn-end"});
    expect(s.players[0]!.bankrupt).toBe(false);
  });

  it("compra propriedade disponível",()=>{
    let s=resolveMathMove(rollDice(game(),1),true,()=>0);
    expect(s.phase).toBe("awaiting-purchase");
    s=buyPendingProperty(s,true);
    expect(s.properties[1]!.ownerId).toBe("human-1");
  });

  it("cobra aluguel uma única vez ao resolver a jogada",()=>{
    let s=game();
    s={...s,properties:{...s.properties,1:{spaceIndex:1,ownerId:"npc-1",level:0}}};
    const before=s.players[0]!.balance;
    s=resolveMathMove(rollDice(s,1),true,()=>0);
    expect(s.players[0]!.balance).toBe(before-currentRent(s,1));
    expect(()=>resolveMathMove(s,true,()=>0)).toThrow();
  });

  it("melhora imóvel quando possui todo o grupo",()=>{
    let s=game();
    for(const index of [1,3,28]) s={...s,properties:{...s.properties,[index]:{spaceIndex:index,ownerId:"human-1",level:0}}};
    const before=s.players[0]!.balance;
    s=upgradeProperty(s,"human-1",1);
    expect(s.properties[1]!.level).toBe(1);
    expect(s.players[0]!.balance).toBeLessThan(before);
  });

  it("evento de crédito altera saldo",()=>{
    let s=game();
    s={...s,players:s.players.map((p,i)=>i===0?{...p,position:34}:p)};
    const before=s.players[0]!.balance;
    s=resolveMathMove(rollDice(s,2),true,()=>0);
    expect(s.players[0]!.balance).toBeGreaterThan(before);
  });

  it("falência ocorre quando patrimônio e caixa não cobrem dívida",()=>{
    let s=game();
    s={...s,players:s.players.map((p,i)=>i===0?{...p,position:3,balance:20}:p)};
    s=resolveMathMove(rollDice(s,1),true,()=>0);
    expect(s.players[0]!.bankrupt).toBe(true);
  });

  it("turno passa ao próximo jogador",()=>{
    let s=resolveMathMove(rollDice(game(),4),true,()=>0);
    expect(s.phase).toBe("turn-end");
    s=endTurn(s);
    expect(activePlayer(s).id).toBe("npc-1");
  });

  it("NPC compra se preservar a reserva mínima",()=>{
    let s=game();
    s={...s,activePlayerIndex:1};
    s=resolveMathMove(rollDice(s,1),true,()=>0);
    expect(npcShouldBuy(s)).toBe(true);
  });

  it("partida curta termina por patrimônio ao exceder rodadas",()=>{
    let s=game();
    s={...s,round:5,phase:"turn-end"};
    s=endTurn(s);
    expect(s.phase).toBe("finished");
    expect(s.winnerId).not.toBeNull();
  });

  it("venda devolve imóvel ao banco e aumenta caixa",()=>{
    let s=game();
    s={...s,properties:{...s.properties,1:{spaceIndex:1,ownerId:"human-1",level:0}}};
    const before=s.players[0]!.balance;
    s=sellProperty(s,"human-1",1);
    expect(s.properties[1]!.ownerId).toBeNull();
    expect(s.players[0]!.balance).toBeGreaterThan(before);
  });

  it("tabuleiro possui 36 casas originais",()=>{
    expect(BOARD).toHaveLength(36);
    expect(new Set(BOARD.map(s=>s.name)).size).toBe(36);
  });

  it("patrimônio considera caixa e propriedades",()=>{
    let s=game();
    s={...s,properties:{...s.properties,1:{spaceIndex:1,ownerId:"human-1",level:0}}};
    expect(netWorth(s,"human-1")).toBe(1920);
  });
});
