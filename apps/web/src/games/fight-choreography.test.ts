import { describe, expect, it } from "vitest";
import {
  choosePlayerStrike, chooseCpuStrike, planExchange,
  EXCHANGE_DURATION_MS, RECOVERY_DURATION_MS
} from "./fight-choreography";

describe("Luta Matemática — coreografia visual fase 2", () => {
  it("seleciona jab, direto e chute sem modificar o dano", () => {
    expect(choosePlayerStrike("Tronco", 15)).toBe("jab");
    expect(choosePlayerStrike("Tronco", 25)).toBe("cross");
    expect(choosePlayerStrike("Cabeça", 12)).toBe("cross");
    expect(choosePlayerStrike("Pernas", 30)).toBe("kick");
  });

  it("alterna três golpes da CPU de forma reprodutível", () => {
    expect([0,1,2,3,4,5].map(chooseCpuStrike)).toEqual([
      "jab","cross","kick","jab","cross","kick"
    ]);
  });

  it("resposta certa gera golpe e reação a dano", () => {
    const move=planExchange({turn:"attack",correct:true,timedOut:false,target:"Pernas",damage:24,cpuAttackCount:0});
    expect(move).toMatchObject({player:"kick",cpu:"hit",hasStrike:true,hasHit:true});
  });

  it("resposta errada gera golpe bloqueado sem reação de dano", () => {
    const move=planExchange({turn:"attack",correct:false,timedOut:false,target:"Tronco",damage:0,cpuAttackCount:0});
    expect(move).toMatchObject({player:"jab",cpu:"block",hasStrike:true,hasHit:false});
  });

  it("tempo esgotado no ataque cancela a ação fictícia", () => {
    const move=planExchange({turn:"attack",correct:false,timedOut:true,target:"Cabeça",damage:0,cpuAttackCount:0});
    expect(move).toMatchObject({player:"idle",cpu:"idle",hasStrike:false,hasHit:false});
  });

  it("defesa correta bloqueia ataque da CPU, errada recebe dano", () => {
    const base={turn:"defend" as const,timedOut:false,target:"Tronco" as const,damage:0,cpuAttackCount:2};
    expect(planExchange({...base,correct:true})).toMatchObject({
      player:"block",cpu:"kick",hasStrike:true,hasHit:false
    });
    expect(planExchange({...base,correct:false})).toMatchObject({
      player:"hit",cpu:"kick",hasStrike:true,hasHit:true
    });
  });

  it("janela de coreografia permite recuperação e não interfere no cronômetro da questão", () => {
    expect(EXCHANGE_DURATION_MS).toBeGreaterThanOrEqual(850);
    expect(RECOVERY_DURATION_MS).toBeGreaterThanOrEqual(200);
    expect(RECOVERY_DURATION_MS).toBeLessThan(EXCHANGE_DURATION_MS);
  });
});
