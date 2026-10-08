import { describe, expect, it } from "vitest";
import { LeaderboardStore, LEADERBOARD_GAMES } from "./leaderboard";

describe("Rankings Top 10 globais",()=>{
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
