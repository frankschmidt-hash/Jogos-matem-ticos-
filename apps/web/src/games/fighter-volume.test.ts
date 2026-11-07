import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FighterFigure, type FighterPose } from "./FighterFigure";
import { FIGHTER_STYLES, fighterStyles } from "./fighter-styles";

const POSES: FighterPose[] = [
  "idle", "step", "retreat", "jab", "cross", "kick",
  "block", "hit", "victory", "defeat"
];
const css = readFileSync(fileURLToPath(new URL("./fighter-figure.css",import.meta.url)),"utf8");
const setupCss = readFileSync(fileURLToPath(new URL("./math-fight-phase4.css",import.meta.url)),"utf8");

describe("Luta Matemática — lutadores 2.5D",()=>{
  it("renderiza todas as seis modalidades em todas as dez poses",()=>{
    for(const style of FIGHTER_STYLES){
      for(const pose of POSES){
        const markup=renderToStaticMarkup(createElement(FighterFigure,{
          color:"#c25840",fighterStyle:style,pose,label:"Lutador acessível"
        }));
        expect(markup).toContain("mf-figure--style-"+fighterStyles[style].slug);
        expect(markup).toContain("mf-figure--pose-"+pose);
        expect(markup).toContain('aria-label="Lutador acessível"');
        expect(markup).toContain("volume-light");
        expect(markup).toContain("fabric-sheen");
        expect(markup).toContain("mf-volume-face");
        expect(markup).toContain("mf-volume-fist");
        expect(markup).not.toContain("fight-pose-picker");
      }
    }
  });
  it("mantém o mesmo personagem e a cor customizável nos dois contextos",()=>{
    const pose=renderToStaticMarkup(createElement(FighterFigure,{
      color:"#138a81",fighterStyle:"Capoeira",pose:"idle"
    }));
    const fight=renderToStaticMarkup(createElement(FighterFigure,{
      color:"#138a81",fighterStyle:"Capoeira",pose:"kick"
    }));
    expect(pose).toContain("mf-fabric-trail--cord");
    expect(fight).toContain("mf-fabric-trail--cord");
    expect(pose).toContain("#138a81");
    expect(fight).toContain("#138a81");
  });
  it("mantém pivôs e movimento reduzido sem controles internos publicados",()=>{
    const markup=renderToStaticMarkup(createElement(FighterFigure,{color:"#514bc8",fighterStyle:"Jiu-jítsu"}));
    for(const joint of [
      "hip-back","hip-front","knee-back","knee-front","waist","neck",
      "shoulder-back","shoulder-front","elbow-back","elbow-front",
      "wrist-back","wrist-front"
    ]) expect(markup).toContain('data-joint="'+joint+'"');
    for(const animation of [
      "mf-cloth-inertia","mf-boxing-jab-release","mf-thai-whip",
      "mf-capoeira-counterbalance","mf-karate-straight-strike",
      "mf-jiujitsu-base-block","mf-street-hook"
    ]) expect(css).toContain(animation);
    expect(css).toContain("html.reduce-motion .mf-fabric-trail");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(setupCss).not.toContain("fight-pose-picker");
  });
});
