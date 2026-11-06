import {describe, expect, it} from "vitest";
import {planExchange} from "./fight-choreography";
import {createImpactCue,exchangeTotalDuration,IMPACT_EFFECT_MS,impactGrade} from "./fight-impact";

const attack=(correct:boolean,target:"Cabeça"|"Tronco"|"Pernas",damage=24,timedOut=false)=>{
  const exchange=planExchange({turn:"attack",correct,timedOut,target,damage:correct?damage:0,cpuAttackCount:0});
  return createImpactCue(exchange,"attack",target);
};

describe("Fase 3 — contato sincronizado independente do HP",()=>{
  it("um golpe acertado tem atacante, defensor e mira corretos",()=>{
    expect(attack(true,"Tronco",15)).toMatchObject({
      attacker:"player",defender:"cpu",strike:"jab",target:"Tronco",
      grade:"light",blocked:false,knockbackPx:19,shakePx:0,label:"ACERTOU!"
    });
    expect(attack(true,"Cabeça",28)).toMatchObject({strike:"cross",grade:"medium",knockbackPx:36});
    expect(attack(true,"Pernas",30)).toMatchObject({strike:"kick",grade:"heavy",knockbackPx:52,shakePx:5});
  });
  it("bloqueio sempre gera pouco knockback e hitstop mais curto",()=>{
    const blocked=attack(false,"Cabeça");
    expect(blocked).toMatchObject({attacker:"player",defender:"cpu",blocked:true,grade:"block",knockbackPx:9,shakePx:0,label:"BLOQUEADO"});
    expect(blocked!.hitStopMs).toBeLessThan(attack(true,"Cabeça")!.hitStopMs);
  });
  it("a CPU ataca e o jogador bloqueia ou sofre impacto",()=>{
    const input={turn:"defend" as const,target:"Tronco" as const,damage:0,timedOut:false,cpuAttackCount:2};
    const blocked=createImpactCue(planExchange({...input,correct:true}),"defend","Tronco");
    const hit=createImpactCue(planExchange({...input,correct:false}),"defend","Tronco");
    expect(blocked).toMatchObject({attacker:"cpu",defender:"player",strike:"kick",target:"Pernas",blocked:true});
    expect(hit).toMatchObject({attacker:"cpu",defender:"player",strike:"kick",grade:"heavy",blocked:false});
  });
  it("tempo esgotado no ataque não gera colisão nem recompensa visual",()=>{
    expect(attack(false,"Cabeça",0,true)).toBeNull();
  });
  it("efeitos permanecem curtos, legíveis e sem dano duplicado",()=>{
    const light=attack(true,"Tronco",15)!;
    const medium=attack(true,"Cabeça")!;
    const heavy=attack(true,"Pernas")!;
    expect(light.contactAtMs).toBeLessThan(medium.contactAtMs);
    expect(medium.contactAtMs).toBeLessThan(heavy.contactAtMs);
    expect(light.hitStopMs).toBeLessThan(medium.hitStopMs);
    expect(medium.hitStopMs).toBeLessThan(heavy.hitStopMs);
    expect(exchangeTotalDuration(1080,heavy,false)).toBe(1188);
    expect(exchangeTotalDuration(1080,heavy,true)).toBe(1080);
    expect(exchangeTotalDuration(1080,null,false)).toBe(1080);
    expect(IMPACT_EFFECT_MS).toBeLessThan(350);
    expect(impactGrade("cross",true)).toBe("block");
  });
});
