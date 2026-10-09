import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LeaderboardStore, LEADERBOARD_GAMES, isAutomatedSmokeNickname } from "./leaderboard";

describe("Rankings Top 10 globais",()=>{
  it("ignora zero pontos e apelidos automáticos de release sem afetar alunos",()=>{
    const board=new LeaderboardStore(null);
    for(const game of LEADERBOARD_GAMES){
      expect(board.record(game,"ReleaseA08csdy",0)).toBe(false);
      expect(board.record(game,"ReleaseB08csdy",25)).toBe(false);
      expect(board.record(game,"ALUNO",0)).toBe(false);
      expect(board.record(game,"Aluno",1)).toBe(true);
      expect(board.snapshot()[game].map(x=>x.nickname)).toEqual(["Aluno"]);
    }
    expect(isAutomatedSmokeNickname("ReleaseA08csdy")).toBe(true);
    expect(isAutomatedSmokeNickname("ReleaseB08csdy")).toBe(true);
    expect(isAutomatedSmokeNickname("ReleaseProfessor")).toBe(false);
    expect(isAutomatedSmokeNickname("Aluno8")).toBe(false);
  });

  it("limpa histórico antigo de testes sem excluir pontuações reais",()=>{
    const dir=mkdtempSync(join(tmpdir(),"ranking-safety-"));
    const file=join(dir,"leaderboards.json");
    try{
      const oldData={
        "property-math":[],
        "crazy-race":[
          {nickname:"ReleaseA08csdy",score:0,secondary:0,achievedAt:1},
          {nickname:"ReleaseB08csdy",score:10,secondary:0,achievedAt:2},
          {nickname:"Maria",score:18,secondary:-2,achievedAt:3}
        ],
        "number-race":[
          {nickname:"ReleaseA08csdy",score:0,secondary:0,achievedAt:1},
          {nickname:"Pedro",score:0,secondary:0,achievedAt:2},
          {nickname:"João",score:12,secondary:-1,achievedAt:3}
        ],
        "math-football":[{nickname:"Ana",score:2,secondary:0,achievedAt:5}]
      };
      writeFileSync(file,JSON.stringify(oldData),"utf8");
      const expected={
        ...oldData,
        "crazy-race":[oldData["crazy-race"][2]],
        "number-race":[oldData["number-race"][2]]
      };
      expect(new LeaderboardStore(file).snapshot()).toEqual(expected);
      expect(JSON.parse(readFileSync(file,"utf8"))).toEqual(expected);
      expect(new LeaderboardStore(file).snapshot()).toEqual(expected);
    }finally{
      rmSync(dir,{recursive:true,force:true});
    }
  });

  it("mostra no máximo 10 pessoas por jogo em ordem de pontuação",()=>{
    const board=new LeaderboardStore(null);
    for(const game of LEADERBOARD_GAMES){
      for(let n=0;n<18;n++) board.record(game,"Jogador"+n,n+1,0,n);
      const ranking=board.snapshot()[game];
      expect(ranking).toHaveLength(10);
      expect(ranking[0]?.nickname).toBe("Jogador17");
      expect(ranking.at(-1)?.nickname).toBe("Jogador8");
    }
  });
  it("retém a melhor marca por nickname normalizado e desempata por acertos/erros",()=>{
    const board=new LeaderboardStore(null);
    expect(board.record("number-race","Aluno",12,-5,10)).toBe(true);
    expect(board.record("number-race","aluno",9,0,11)).toBe(false);
    expect(board.record("number-race","aLuNo",12,-3,12)).toBe(true);
    expect(board.record("number-race","Maria",12,-2,8)).toBe(true);
    expect(board.snapshot()["number-race"].map(x=>x.nickname)).toEqual(["Maria","aLuNo"]);
    expect(board.record("number-race","Aluno",13,-6,14)).toBe(true);
    expect(board.snapshot()["number-race"][0]?.nickname).toBe("Aluno");
  });
  it("recusa nicknames ofensivos no histórico público de resultados",()=>{
    const board=new LeaderboardStore(null);
    expect(board.record("crazy-race","P0RR4",100)).toBe(false);
    expect(board.record("crazy-race","M3RDA",90)).toBe(false);
    expect(board.record("crazy-race","Mestre7",100)).toBe(true);
    expect(board.snapshot()["crazy-race"].map(row=>row.nickname)).toEqual(["Mestre7"]);
  });
  it("recusa valores impossíveis e não devolve referências mutáveis",()=>{
    const board=new LeaderboardStore(null);
    expect(board.record("math-football","A",5)).toBe(false);
    expect(board.record("math-football","Aluno",Number.POSITIVE_INFINITY)).toBe(false);
    expect(board.record("math-football","Aluno",-1)).toBe(false);
    expect(board.record("math-football","Aluno",1_001)).toBe(false);
    expect(board.record("math-football","Aluno",5)).toBe(true);
    const copy=board.snapshot();
    copy["math-football"].push({nickname:"Falso",score:900,secondary:0,achievedAt:1});
    expect(board.snapshot()["math-football"]).toHaveLength(1);
  });
});
