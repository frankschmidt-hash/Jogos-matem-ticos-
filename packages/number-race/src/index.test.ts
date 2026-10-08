import { describe, expect, it } from "vitest";
import {
  BASE_ADVANCE, MAX_BONUS, ROUND_DURATION_MS, advanceForCorrect, createNumberRace,
  impulseBonus, npcDecision, resolveRound, startRound, statsFor, submitAnswer,
  submitNpcAnswers, MATCH_DURATION_MS, TIMED_ADVANCE, startTimedRace,
  answerTimedRace, tickTimedNpcs, finishTimedRace
} from "./index";

const race=()=>createNumberRace([{id:"h1",name:"Aluno"}]);

describe("Corrida Numérica",()=>{
  it("usa cronômetro de 10 segundos",()=>{
    expect(ROUND_DURATION_MS).toBe(10_000);
    const s=startRound(race(),1000);
    expect(s.roundDeadlineAt!-s.roundStartedAt!).toBe(ROUND_DURATION_MS);
  });

  it("acerto gera avanço base",()=>{
    let s=startRound(race(),0);
    s=submitAnswer(s,"h1",true,8000,8000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.racers[0]!.progress).toBe(BASE_ADVANCE);
  });

  it("erro não avança e quebra combo",()=>{
    let s=race();
    s={...s,racers:s.racers.map(r=>r.id==="h1"?{...r,streak:4}:r)};
    s=startRound(s,0);
    s=submitAnswer(s,"h1",false,5000,5000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.racers[0]!.progress).toBe(0);
    expect(s.racers[0]!.streak).toBe(0);
  });

  it("timeout não avança",()=>{
    let s=startRound(race(),0);
    s=submitAnswer(s,"h1",true,11000,11000);
    s=resolveRound(s,ROUND_DURATION_MS+1000);
    expect(s.racers[0]!.progress).toBe(0);
  });

  it("3 acertos seguidos geram pequeno bônus",()=>{
    expect(advanceForCorrect(3,8000)).toBeGreaterThan(BASE_ADVANCE);
  });

  it("5 acertos seguidos geram bônus maior, ainda limitado",()=>{
    expect(advanceForCorrect(5,8000)).toBeGreaterThan(advanceForCorrect(3,8000));
    expect(advanceForCorrect(5,8000)-BASE_ADVANCE).toBeLessThanOrEqual(MAX_BONUS);
  });

  it("resposta rápida gera bônus leve",()=>{
    expect(impulseBonus(1,4000)).toBeGreaterThan(0);
    expect(impulseBonus(1,4000)).toBeLessThan(BASE_ADVANCE/2);
  });

  it("bônus total nunca ultrapassa o limite",()=>{
    expect(impulseBonus(99,0)).toBe(MAX_BONUS);
  });

  it("sempre possui 6 competidores",()=>{
    expect(race().racers).toHaveLength(6);
    expect(createNumberRace([{id:"1",name:"A"},{id:"2",name:"B"},{id:"3",name:"C"}]).racers).toHaveLength(6);
  });

  it("humanos substituem NPCs",()=>{
    const s=createNumberRace(Array.from({length:5},(_,i)=>({id:String(i),name:"H"+i})));
    expect(s.racers.filter(r=>r.kind==="human")).toHaveLength(5);
    expect(s.racers.filter(r=>r.kind==="npc")).toHaveLength(1);
  });

  it("NPCs têm chance e reação controladas",()=>{
    for(const skill of ["beginner","intermediate","advanced"] as const){
      const d=npcDecision(skill,()=>0.4);
      expect(d.responseMs).toBeGreaterThanOrEqual(1600);
      expect(d.responseMs).toBeLessThan(ROUND_DURATION_MS);
    }
  });

  it("preenche respostas dos NPCs",()=>{
    let s=startRound(race(),0);
    s=submitNpcAnswers(s,()=>0.2);
    expect(Object.keys(s.submissions)).toHaveLength(5);
  });

  it("define vencedor ao concluir percurso",()=>{
    let s=createNumberRace([{id:"h1",name:"Aluno"}],90);
    s=startRound(s,0);
    s=submitAnswer(s,"h1",true,8000,8000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.phase).toBe("finished");
    expect(s.winnerId).toBe("h1");
  });

  it("empate exato cria rodada extra",()=>{
    let s=createNumberRace([{id:"a",name:"A"},{id:"b",name:"B"}],90);
    s=startRound(s,0);
    s=submitAnswer(s,"a",true,8000,8000);
    s=submitAnswer(s,"b",true,8000,8000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.phase).toBe("round-resolution");
    expect(s.tieBreaker).toBe(true);
  });

  it("estatísticas incluem posição, acertos, erros, aproveitamento, sequência e média",()=>{
    let s=race();
    s={...s,racers:s.racers.map(r=>r.id==="h1"?{
      ...r,progress:200,correctAnswers:4,errors:1,bestStreak:3,totalCorrectResponseMs:24000
    }:r)};
    const stats=statsFor(s,"h1");
    expect(stats.correctAnswers).toBe(4);
    expect(stats.errors).toBe(1);
    expect(stats.accuracy).toBe(80);
    expect(stats.bestStreak).toBe(3);
    expect(stats.averageCorrectResponseMs).toBe(6000);
  });

  it("rejeita resposta duplicada",()=>{
    let s=startRound(race(),0);
    s=submitAnswer(s,"h1",true,1000,1000);
    expect(()=>submitAnswer(s,"h1",true,1200,1200)).toThrow(/já enviada/i);
  });
  it("inicia cinco minutos compartilhados, sem limite antecipado de acertos",()=>{
    const started=startTimedRace(race(),1000);
    expect(MATCH_DURATION_MS).toBe(300000);
    expect(started.matchDeadlineAt).toBe(301000);
    expect(started.roundDeadlineAt).toBe(301000);
    let current=started;
    for(let i=0;i<90;i++) current=answerTimedRace(current,"h1",true,1800,2000+i);
    expect(current.racers[0]!.correctAnswers).toBe(90);
    expect(current.racers[0]!.progress).toBe(90*TIMED_ADVANCE);
    expect(current.phase).toBe("round-open");
  });

  it("aplica erro imediatamente sem avanço e não permite pontuar após cinco minutos",()=>{
    let current=startTimedRace(race(),500);
    current=answerTimedRace(current,"h1",false,1200,1100);
    expect(current.racers[0]!.errors).toBe(1);
    expect(current.racers[0]!.progress).toBe(0);
    expect(()=>answerTimedRace(current,"h1",true,1200,300501)).toThrow(/tempo/i);
    expect(()=>finishTimedRace(current,300499)).toThrow(/ainda não terminou/i);
  });

  it("vence quem tem mais acertos, sem bônus de velocidade ou combos",()=>{
    let current=startTimedRace(createNumberRace([{id:"h1",name:"Um"},{id:"h2",name:"Dois"}]),0);
    current=answerTimedRace(current,"h1",true,90,100);
    current=answerTimedRace(current,"h1",true,90,200);
    current=answerTimedRace(current,"h2",true,10,200);
    expect(current.racers.find(r=>r.id==="h1")!.progress).toBe(200);
    expect(current.racers.find(r=>r.id==="h2")!.progress).toBe(100);
    current=finishTimedRace(current,300000);
    expect(current.winnerId).toBe("h1");
  });

  it("NPCs movimentam-se em tempo real sem bloquear as respostas",()=>{
    const current=startTimedRace(race(),0);
    const next=tickTimedNpcs(current,6000,()=>0);
    expect(next.racers.filter(r=>r.kind==="npc").every(r=>r.correctAnswers===1)).toBe(true);
    expect(next.racers[0]!.correctAnswers).toBe(0);
    expect(tickTimedNpcs(next,300001)).toBe(next);
  });

});
