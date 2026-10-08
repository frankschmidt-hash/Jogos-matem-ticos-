import { describe, expect, it } from "vitest";
import {
  BOMB_DURATION_MS, CAR_MODELS, FINISH_LINE, ROUND_DURATION_MS, allHumansSubmitted, bombTarget,
  createRace, npcDecision, positionOf, resolveBombAnswer, resolveNpcBombIfNeeded,
  resolveRound, resolveTrackBomb, startRound, submitNpcAnswers, submitRoundAnswer, useBomb
} from "./index";

const oneHuman=()=>createRace([{id:"h1",name:"Aluno"}]);

describe("Corrida Maluca",()=>{
  it("usa rodadas de 20 segundos",()=>{
    const s=startRound(oneHuman(),1000);
    expect(s.roundDeadlineAt!-s.roundStartedAt!).toBe(ROUND_DURATION_MS);
  });

  it("acerto avança somente ao resolver a rodada",()=>{
    let s=startRound(oneHuman(),0);
    s=submitRoundAnswer(s,"h1",true,4000,4000);
    expect(s.racers[0]!.progress).toBe(0);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.racers[0]!.progress).toBeGreaterThan(0);
  });

  it("erro não avança",()=>{
    let s=startRound(oneHuman(),0);
    s=submitRoundAnswer(s,"h1",false,5000,5000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.racers[0]!.progress).toBe(0);
  });

  it("timeout conta como erro",()=>{
    let s=startRound(oneHuman(),0);
    s=submitRoundAnswer(s,"h1",true,21000,21000);
    s=resolveRound(s,ROUND_DURATION_MS+1000);
    expect(s.racers[0]!.progress).toBe(0);
  });

  it("sempre cria 6 competidores",()=>{
    expect(oneHuman().racers).toHaveLength(6);
    expect(createRace([{id:"1",name:"A"},{id:"2",name:"B"},{id:"3",name:"C"}]).racers).toHaveLength(6);
  });

  it("humanos substituem NPCs",()=>{
    const s=createRace(Array.from({length:5},(_,i)=>({id:String(i),name:"H"+i})));
    expect(s.racers.filter(r=>r.kind==="human")).toHaveLength(5);
    expect(s.racers.filter(r=>r.kind==="npc")).toHaveLength(1);
  });

  it("seleciona alvo imediatamente à frente e atrás",()=>{
    let s=createRace([{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"}]);
    s={...s,racers:s.racers.map(r=>r.id==="a"?{...r,progress:100}:r.id==="b"?{...r,progress:200}:r.id==="c"?{...r,progress:50}:r)};
    expect(bombTarget(s,"a","ahead")?.id).toBe("b");
    expect(bombTarget(s,"a","behind")?.id).toBe("c");
  });

  it("bomba correta é neutralizada e gera proteção",()=>{
    let s=startRound(createRace([{id:"a",name:"A"},{id:"b",name:"B"}]),0);
    s={...s,racers:s.racers.map(r=>r.id==="a"?{...r,bombCharges:1}:r)};
    s=useBomb(s,"a","behind",2000);
    const target=bombTarget({...s,bombChallenges:{}},"a","behind")!;
    s=resolveBombAnswer(s,target.id,true,2000+BOMB_DURATION_MS-1);
    expect(s.racers.find(r=>r.id===target.id)!.blockedRound).not.toBe(s.round);
    expect(s.racers.find(r=>r.id===target.id)!.protectedUntilRound).toBeGreaterThanOrEqual(s.round+1);
  });

  it("erro da bomba bloqueia avanço da rodada",()=>{
    let s=startRound(createRace([{id:"a",name:"A"},{id:"b",name:"B"}]),0);
    s={...s,racers:s.racers.map(r=>r.id==="a"?{...r,bombCharges:1}:r)};
    s=useBomb(s,"a","behind",2000);
    const target=bombTarget({...s,bombChallenges:{}},"a","behind")!;
    s=submitRoundAnswer(s,target.id,true,5000,5000);
    s=resolveBombAnswer(s,target.id,false,6000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.racers.find(r=>r.id===target.id)!.progress).toBe(0);
  });

  it("aplica cooldown e proteção contra spam",()=>{
    let s=startRound(createRace([{id:"a",name:"A"},{id:"b",name:"B"}]),0);
    s={...s,racers:s.racers.map(r=>r.id==="a"?{...r,bombCharges:2}:r)};
    s=useBomb(s,"a","behind",2000);
    const target=bombTarget({...s,bombChallenges:{}},"a","behind")!;
    s=resolveBombAnswer(s,target.id,true,3000);
    expect(()=>useBomb(s,"a","behind",4000)).toThrow(/cooldown|protegido/i);
  });

  it("NPCs têm reação não instantânea",()=>{
    for(const skill of ["beginner","intermediate","advanced"] as const){
      const d=npcDecision(skill,()=>0.4);
      expect(d.responseMs).toBeGreaterThanOrEqual(4000);
    }
  });

  it("NPCs recebem submissões simuladas",()=>{
    let s=startRound(oneHuman(),0);
    s=submitNpcAnswers(s,()=>0.2);
    expect(Object.keys(s.submissions).length).toBe(5);
    expect(allHumansSubmitted(s)).toBe(false);
  });

  it("NPC resolve bomba com desempenho simulado",()=>{
    let s=startRound(oneHuman(),0);
    s={...s,racers:s.racers.map(r=>r.id==="h1"?{...r,bombCharges:1}:r)};
    s=useBomb(s,"h1","behind",1000);
    const target=bombTarget({...s,bombChallenges:{}},"h1","behind")!;
    s=resolveNpcBombIfNeeded(s,target.id,()=>0.1);
    expect(s.bombChallenges[target.id]!.resolved).toBe(true);
  });

  it("define vencedor após cruzar a chegada",()=>{
    let s=createRace([{id:"h1",name:"Aluno"}],100);
    s=startRound(s,0);
    s=submitRoundAnswer(s,"h1",true,3000,3000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.phase).toBe("finished");
    expect(s.winnerId).toBe("h1");
  });

  it("empate exato na chegada abre rodada extra",()=>{
    let s=createRace([{id:"a",name:"A"},{id:"b",name:"B"}],100);
    s=startRound(s,0);
    s=submitRoundAnswer(s,"a",true,3000,3000);
    s=submitRoundAnswer(s,"b",true,3000,3000);
    s=resolveRound(s,ROUND_DURATION_MS);
    expect(s.phase).toBe("round-resolution");
    expect(s.tieBreaker).toBe(true);
    expect(s.winnerId).toBeNull();
  });

  it("posição usa progresso e desempates",()=>{
    let s=oneHuman();
    s={...s,racers:s.racers.map((r,i)=>({...r,progress:(5-i)*10}))};
    expect(positionOf(s,"h1")).toBe(1);
  });

  it("impede resposta duplicada",()=>{
    let s=startRound(oneHuman(),0);
    s=submitRoundAnswer(s,"h1",true,1000,1000);
    expect(()=>submitRoundAnswer(s,"h1",true,1200,1200)).toThrow(/já enviada/i);
  });

  it("linha de chegada padrão é positiva",()=>{
    expect(FINISH_LINE).toBeGreaterThan(0);
  });
});

describe("Bombas do percurso e garagem",()=>{
  it("contém dez modelos selecionáveis com cor própria",()=>{
    expect(CAR_MODELS).toHaveLength(10);
    expect(new Set(CAR_MODELS).size).toBe(10);
    const race=createRace([{id:"h",name:"Teste",carModel:"picape",carColor:"#ef2134"}]);
    expect(race.racers[0]?.carModel).toBe("picape");
    expect(race.racers[0]?.carColor).toBe("#ef2134");
  });

  it("bloqueia o carro na primeira bomba aos 220 metros e devolve à largada quando erra",()=>{
    let race=oneHuman();
    for(let round=0;round<2;round++){
      race=startRound(race,round*25000);
      race=submitRoundAnswer(race,"h1",true,1000,round*25000+1000);
      race=resolveRound(race,round*25000+ROUND_DURATION_MS);
    }
    expect(race.racers[0]?.progress).toBe(220);
    expect(race.racers[0]?.pendingTrackBomb).toBe(220);
    race=startRound(race,51000);
    expect(()=>submitRoundAnswer(race,"h1",true,2000,53000)).toThrow(/bomba da pista/i);
    race=resolveTrackBomb(race,"h1",false);
    expect(race.racers[0]?.progress).toBe(0);
    expect(race.racers[0]?.clearedTrackBombs).toEqual([]);
    expect(race.racers[0]?.pendingTrackBomb).toBeNull();
    expect(race.log[0]?.message).toMatch(/BOOM/i);
  });

  it("acerto desarma obstáculo e libera avanço, chegando às três bombas",()=>{
    let race=oneHuman();
    let now=0;
    for(const checkpoint of [220,440,660]){
      while(race.racers[0]!.pendingTrackBomb===null){
        race=startRound(race,now);
        race=submitRoundAnswer(race,"h1",true,1000,now+1000);
        race=resolveRound(race,now+ROUND_DURATION_MS);
        now+=25000;
      }
      expect(race.racers[0]?.progress).toBe(checkpoint);
      race=resolveTrackBomb(race,"h1",true);
      expect(race.racers[0]?.pendingTrackBomb).toBeNull();
    }
    expect(race.racers[0]?.clearedTrackBombs).toEqual([220,440,660]);
  });
});
