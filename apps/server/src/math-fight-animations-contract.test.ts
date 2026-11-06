import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+path,import.meta.url)),"utf8");

describe("Luta Matemática — integração das animações da Fase 2",()=>{
  const game=read("MathFight.tsx");
  const figure=read("FighterFigure.tsx");
  const css=read("fighter-figure.css");
  const ui=read("math-fight.css");
  const choreography=read("fight-choreography.ts");

  it("dez estados visuais estão disponíveis sem depender de assets externos",()=>{
    for(const pose of ["idle","step","retreat","jab","cross","kick","block","hit","victory","defeat"]){
      expect(figure).toContain('"'+pose+'"');
      expect(css).toContain(".mf-figure--pose-"+pose);
    }
    expect(figure).toContain('<svg className="mf-figure-svg"');
    expect(figure).not.toContain("<image");
  });

  it("cada golpe usa os braços e pernas articulados da Fase 1",()=>{
    for(const name of ["mf-jab-arm","mf-cross-arm","mf-kick-thigh","mf-kick-shin",
      "mf-block-front-arm","mf-hit-torso","mf-hit-head","mf-knockdown","mf-victory-hop",
      "mf-step-back","mf-footwork"]){
      expect(css).toContain("@keyframes "+name);
    }
    for(const joint of ["shoulder-back","shoulder-front","elbow-back","elbow-front","hip-front","knee-front"]){
      expect(figure).toContain('data-joint="'+joint+'"');
    }
  });

  it("o resultado matemático decide o golpe antes da coreografia",()=>{
    expect(game).toContain("validateAnswer(questionRef.current,raw)");
    expect(game).toContain("const exchange=planExchange(");
    expect(game).toContain("const newHp=Math.max(0,cpuHpRef.current-damage)");
    expect(game).toContain("const newHp=Math.max(0,playerHpRef.current-damage)");
    expect(game).toContain("queueMotion(EXCHANGE_DURATION_MS");
    expect(game).toContain("queueMotion(RECOVERY_DURATION_MS");
    expect(game).toContain("finish(endResult===\"player\")");
    expect(choreography).toContain("if (timedOut)");
  });

  it("protege cronômetro, nova luta e transições contra timers obsoletos",()=>{
    expect(game).toContain("if(phaseRef.current!==\"playing\"||handled.current)return");
    expect(game).toContain("clearAnimationTimers();matchId.current++;cpuAttackCount.current=0");
    expect(game).toContain("if(matchId.current===currentMatch)callback()");
    expect(game).toContain("if(handled.current)return");
  });

  it("prévia inclui controles das poses e movimento reduzido",()=>{
    for(const label of ["Jab","Direto","Chute","Recuo","Bloqueio","Reação","Vitória","Derrota"]){
      expect(game).toContain('name:"'+label+'"');
    }
    expect(game).toContain("setPreviewTick(t=>t+1)");
    expect(css).toContain("html.reduce-motion .mf-figure");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(ui).toContain(".fight-motion-caption");
  });
});
