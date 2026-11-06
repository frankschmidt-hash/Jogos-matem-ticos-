import {existsSync,readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";

const url=(p:string)=>fileURLToPath(new URL("../../web/src/games/"+p,import.meta.url));
const read=(p:string)=>readFileSync(url(p),"utf8");

describe("Fase 3 — contato, hitstop, knockback e feedback",()=>{
  const game=read("MathFight.tsx");
  const stage=read("FightStage.tsx");
  const impact=read("fight-impact.ts");
  const css=read("fight-impact.css");
  const figure=read("fighter-figure.css");
  const sound=read("../experience.tsx");

  it("mantém renderização local sem dependências de animação remotas",()=>{
    expect(existsSync(url("FightStage.tsx"))).toBe(true);
    expect(stage).toContain("FighterFigure");
    expect(stage).toContain("fight-stage-actor--");
    expect(stage).toContain("fight-impact-burst");
    expect(stage).toContain("fight-impact-number");
    expect(stage).not.toContain("<image");
  });

  it("recalcula HP somente pela matemática e mostra impacto na janela de contato",()=>{
    expect(game).toContain("validateAnswer(questionRef.current,raw)");
    expect(game).toContain("limitDamage(left,duration,fighterRef.current.gloves)");
    expect(game).toContain("const cue=createImpactCue(exchange,currentTurn,target)");
    expect(game).toContain("queueMotion(cue.contactAtMs");
    expect(game).toContain("setImpact({cue,damage:settledDamage,frozen:hitStopMs>0})");
    expect(game).toContain("cpuHpRef.current=settledHp;setCpuHp(settledHp)");
    expect(game).toContain("playerHpRef.current=settledHp;setPlayerHp(settledHp)");
    expect(game).toContain("queueMotion(exchangeTotalDuration(EXCHANGE_DURATION_MS");
  });

  it("implementa pausa dos corpos, recuo e brilho com feedback diferente em bloqueios",()=>{
    expect(css).toContain(".fight-stage--hitstop .fight-stage-actor");
    expect(css).toContain("animation-play-state:paused!important");
    expect(css).toContain("@keyframes mf-stage-approach");
    expect(css).toContain("@keyframes mf-stage-damage");
    expect(css).toContain("@keyframes mf-stage-block");
    expect(css).toContain(".fight-impact-burst--block");
    expect(css).toContain(".fight-impact-burst--heavy");
    expect(css).toContain("@keyframes mf-stage-shake-medium");
    expect(css).toContain("@keyframes mf-stage-shake-heavy");
    expect(css).toContain(".fight-health-impact");
    expect(css).toContain(".fight-health-block");
    expect(impact).toContain("hitStopMs:HIT_STOP_MS[grade]");
    expect(impact).toContain("knockbackPx:KNOCKBACK_PX[grade]");
  });

  it("sincroniza reação de cabeça e tronco após contato",()=>{
    expect(css).toContain("@keyframes mf-stage-hit-torso");
    expect(css).toContain("@keyframes mf-stage-hit-head");
    expect(css).toContain("0%,41%,100%{transform:none}");
    expect(figure).toContain(".mf-figure--pose-hit");
  });

  it("cancela timers de combate em reinícios e mantém som opcional",()=>{
    expect(game).toContain("clearAnimationTimers();matchId.current++;cpuAttackCount.current=0");
    expect(game).toContain("if(matchId.current===currentMatch)callback()");
    expect(game).toContain('playSound(cue.blocked?"fight-block":"fight-hit")');
    expect(sound).toContain('case "fight-hit":');
    expect(sound).toContain('case "fight-block":');
    expect(css).toContain("html.reduce-motion .fight-stage");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
