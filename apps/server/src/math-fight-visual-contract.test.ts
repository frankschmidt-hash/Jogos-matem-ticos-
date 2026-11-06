import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read=(name:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+name,import.meta.url)),"utf8");

describe("Luta Matemática Fase 1 — rig vetorial",()=>{
  const rig=read("FighterFigure.tsx");
  const rigCss=read("fighter-figure.css");
  const game=read("MathFight.tsx");
  const gameCss=read("math-fight.css");

  it("substitui o boneco de seis formas CSS por SVG local em camadas",()=>{
    expect(rig).toContain('<svg className="mf-figure-svg"');
    expect(rig).toContain('viewBox="0 0 230 350"');
    expect(rig).toContain("useId()");
    expect(game).toContain("FighterFigure");
    expect(game).not.toContain("function Figure(");
    expect(gameCss).not.toContain(".fight-head{");
    expect(rig).not.toMatch(/https?:\/\//);
  });

  it("mantém grupos articulados para braços, pernas, punhos e pescoço",()=>{
    for(const joint of [
      "hip-back","hip-front","knee-back","knee-front","waist","neck",
      "shoulder-back","shoulder-front","elbow-back","elbow-front",
      "wrist-back","wrist-front"
    ]) expect(rig).toContain(`data-joint="${joint}"`);
    expect(rig).toContain('className="mf-rig-head"');
    expect(rig).toContain('className="mf-rig-torso"');
  });

  it("implementa guarda, avanço, bloqueio e reação com pivôs distintos",()=>{
    for(const pose of ["idle","step","block"]){
      expect(rig).toContain(`"${pose}"`);
      expect(rigCss).toContain(`.mf-figure--pose-${pose}`);
    }
    expect(rigCss).toContain(".mf-figure--pose-hit");
    expect(game).toContain("setPreviewPose(item.pose)");
    expect(game).toContain('aria-pressed={previewPose===item.pose}');
  });

  it("preserva desafio matemático, HP e economia",()=>{
    expect(game).toContain("generateQuestion(");
    expect(game).toContain("validateAnswer(");
    expect(game).toContain("limitDamage(");
    expect(game).toContain("setPlayerHp(");
    expect(game).toContain("setCpuHp(");
    expect(game).toContain("setFighter(old=>");
  });

  it("respeita telas pequenas e preferência por menos movimento",()=>{
    expect(rigCss).toContain("@media(max-width:700px)");
    expect(rigCss).toContain("@media(prefers-reduced-motion:reduce)");
    expect(gameCss).toContain(".fight-arena{height:280px");
  });
});
