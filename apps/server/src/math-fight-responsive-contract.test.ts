import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read=(file:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+file,import.meta.url)),"utf8");

describe("Luta Matemática — enquadramento responsivo",()=>{
  const game=read("MathFight.tsx");
  const css=read("math-fight-phase4.css");
  const impact=read("fight-impact.css");

  it("ativa layout compacto apenas durante a batalha, sem afetar preparação",()=>{
    expect(game).toContain('phase!=="setup"?" fight-shell--battle":""');
    expect(game).toContain('<FightHud');
    expect(game).toContain('<FightStage');
    expect(css).toContain(".fight-shell--battle .fight-top");
    expect(css).toContain(".fight-shell--battle .fight-math");
  });

  it("usa largura real da arena para tamanho e posicionamento dos dois lutadores",()=>{
    expect(css).toContain("container-type:inline-size");
    for(const variable of [
      "--mf-stage-fighter-width","--mf-stage-fighter-height",
      "--mf-guard-gap","--mf-contact-travel","--mf-impact-offset"
    ])expect(css).toContain(variable+":");
    expect(css).toContain(".fight-arena .fight-stage-actor");
    expect(css).toContain("calc(100% - 12px)");
    expect(css).toContain("5cqw");
    expect(impact).toContain("var(--mf-contact-travel)");
  });

  it("tem modos para celular estreito e janela horizontal de pouca altura",()=>{
    expect(css).toContain("@media(max-width:700px)");
    expect(css).toContain("@media(max-width:390px)");
    expect(css).toContain("@media(min-width:701px) and (max-height:720px)");
    expect(css).toContain("height:clamp(175px,min(52vw,29dvh),255px)");
    expect(css).toContain("flex-direction:row");
  });

  it("preserva respostas, cronômetro, impactos e as dez poses vetoriais",()=>{
    expect(game).toContain("validateAnswer(");
    expect(game).toContain("remaining");
    expect(game).toContain("createImpactCue(");
    expect(impact).toContain("@keyframes mf-stage-approach");
    expect(css).not.toContain("display:none!important");
  });
});
