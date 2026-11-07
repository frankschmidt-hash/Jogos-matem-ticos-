import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FighterFigure, type FighterPose } from "./FighterFigure";
import { FIGHTER_STYLES } from "./fighter-styles";

const css=readFileSync(fileURLToPath(new URL("./fighter-figure.css",import.meta.url)),"utf8");
const snippet=(style:typeof FIGHTER_STYLES[number],pose:FighterPose="idle",color="#298cd9")=>
  renderToStaticMarkup(createElement(FighterFigure,{fighterStyle:style,color,pose}));

describe("Luta Matemática — revisão de anatomia e figurinos",()=>{
  it("une tronco, cabeça e braços no mesmo pivô da coluna, preservando quadris fora dele",()=>{
    for(const pose of ["idle","kick","step","retreat","hit"] as FighterPose[]){
      const html=snippet("Capoeira",pose);
      const spine=html.indexOf('data-joint="spine-root"');
      expect(spine).toBeGreaterThan(0);
      expect(html.indexOf('data-joint="hip-front"')).toBeLessThan(spine);
      expect(html.indexOf('data-joint="shoulder-back"')).toBeGreaterThan(spine);
      expect(html.indexOf('data-joint="waist"')).toBeGreaterThan(spine);
      expect(html.indexOf('data-joint="neck"')).toBeGreaterThan(spine);
      expect(html.indexOf('data-joint="shoulder-front"')).toBeGreaterThan(spine);
      expect(html).toContain('data-art-signature="Capoeira"');
      expect(html).toContain("#298cd9");
    }
    expect(css).toContain("mf-capoeira-connected-ginga");
    expect(css).toContain("mf-capoeira-connected-kick");
    expect(css).toContain(".mf-figure--style-capoeira .mf-rig-torso{");
    expect(css).toContain("animation:none!important");
    expect(css).not.toContain("@keyframes mf-capoeira-ginga");
  });
  it("renderiza seis assinaturas de traje, roupas e cores para todas as poses",()=>{
    const styles=FIGHTER_STYLES;
    for(const style of styles){
      for(const pose of ["idle","step","retreat","jab","cross","kick","block","hit","victory","defeat"] as FighterPose[]){
        const html=snippet(style,pose,"#5dca77");
        expect(html).toContain('data-art-signature="'+style+'"');
        expect(html).toContain("#5dca77");
        expect(html).toContain('data-joint="spine-root"');
        expect(html).not.toContain("fight-pose-picker");
      }
    }
  });
  it("as roupas permanecem vinculadas ao rig e respeitam movimento reduzido",()=>{
    for(const className of ["mf-art-sleeve","mf-art-leg-panel","mf-art-shin","mf-art-hand","mf-art-head"]){
      expect(snippet("Karatê")).toContain(className);
    }
    expect(snippet("Capoeira")).toContain("mf-fabric-trail--cord");
    expect(snippet("Jiu-jítsu")).toContain("mf-fabric-trail--belt");
    expect(css).toContain("html.reduce-motion .mf-rig-upper");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
