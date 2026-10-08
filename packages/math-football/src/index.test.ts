import { describe, expect, it } from "vitest";
import {
  INITIAL_KICKS, ONLINE_KICK_MS, abandonMatch, createPenaltyMatch, npcDecision,
  openNextKick, startKick, statsFor, submitKick, timeoutKick, type PenaltyMatchState
} from "./index";

const base=()=>createPenaltyMatch([
  {id:"a",name:"Aluno A",kind:"human"},
  {id:"b",name:"Aluno B",kind:"human"}
]);

function take(state:PenaltyMatchState,correct:boolean,now:number):PenaltyMatchState{
  const opened=state.phase==="waiting"
    ?startKick(state,now,ONLINE_KICK_MS)
    :state.phase==="kick-resolution"
      ?openNextKick(state,now,ONLINE_KICK_MS)
      :state;
  return submitKick(opened,opened.currentShooterId,correct,now+1000);
}

describe("Futebol Matemático",()=>{
  it("inicia com cinco cobranças previstas por lado",()=>{
    expect(INITIAL_KICKS).toBe(5);
    const s=base();
    expect(s.shots.a).toBe(0);
    expect(s.shots.b).toBe(0);
  });

  it("acerto vira gol",()=>{
    const s=take(base(),true,0);
    expect(s.goals.a).toBe(1);
    expect(s.lastKick?.goal).toBe(true);
  });

  it("erro vira defesa e não marca gol",()=>{
    const s=take(base(),false,0);
    expect(s.goals.a).toBe(0);
    expect(s.errors.a).toBe(1);
    expect(s.lastKick?.goal).toBe(false);
  });

  it("alterna as cobranças",()=>{
    const s=take(base(),true,0);
    expect(s.currentShooterId).toBe("b");
  });

  it("encerra cedo quando a reação é matematicamente impossível",()=>{
    let s=base();
    for(let i=0;i<3;i++){
      s=take(s,true,i*5000);
      if(s.phase!=="finished") s=take(s,false,i*5000+2000);
    }
    expect(s.phase).toBe("finished");
    expect(s.winnerId).toBe("a");
    expect(s.history.length).toBeLessThan(10);
  });

  it("entra em morte súbita quando termina 5 a 5 em cobranças",()=>{
    let s=base();
    for(let i=0;i<10;i++) s=take(s,false,i*4000);
    expect(s.phase).toBe("kick-resolution");
    expect(s.suddenDeath).toBe(true);
    expect(s.shots.a).toBe(5);
    expect(s.shots.b).toBe(5);
  });

  it("morte súbita só decide após ambos cobrarem na rodada",()=>{
    let s=base();
    for(let i=0;i<10;i++) s=take(s,false,i*4000);
    s=take(s,true,50_000);
    expect(s.phase).not.toBe("finished");
    s=take(s,false,53_000);
    expect(s.phase).toBe("finished");
    expect(s.winnerId).toBe("a");
  });

  it("timeout conta como erro e defesa",()=>{
    let s=startKick(base(),1000,ONLINE_KICK_MS);
    s=timeoutKick(s,31_000);
    expect(s.lastKick?.reason).toBe("timeout");
    expect(s.goals.a).toBe(0);
    expect(s.errors.a).toBe(1);
  });

  it("NPC possui níveis coerentes de acerto",()=>{
    expect(npcDecision("easy",()=>0.6).correct).toBe(false);
    expect(npcDecision("medium",()=>0.6).correct).toBe(true);
    expect(npcDecision("hard",()=>0.8).correct).toBe(true);
  });

  it("calcula estatísticas pedagógicas",()=>{
    let s=take(base(),true,0);
    s=take(s,false,3000);
    s=take(s,true,6000);
    const stats=statsFor(s,"a");
    expect(stats.goals).toBe(2);
    expect(stats.correctAnswers).toBe(2);
    expect(stats.accuracy).toBe(100);
  });

  it("abandono entrega a vitória ao adversário",()=>{
    const s=abandonMatch(base(),"a");
    expect(s.phase).toBe("finished");
    expect(s.winnerId).toBe("b");
    expect(s.finishReason).toBe("abandonment");
  });
  it("salva canto escolhido e defesa segue a bola apenas quando há erro",()=>{
    let match=startKick(base(),0,null);
    match=submitKick(match,"a",true,1000,"answer",8);
    expect(match.lastKick?.target).toBe(8);
    expect(match.lastKick?.keeperTarget).not.toBe(8);
    match=openNextKick(match,2000,null);
    match=submitKick(match,"b",false,3000,"answer",0);
    expect(match.lastKick?.target).toBe(0);
    expect(match.lastKick?.keeperTarget).toBe(0);
  });
});
