import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read=(file:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+file,import.meta.url)),"utf8");
const registry=read("fighter-styles.ts");
const outfit=read("FighterClothingPiece.tsx");
const figure=read("FighterFigure.tsx");
const game=read("MathFight.tsx");
const stage=read("FightStage.tsx");
const css=read("fighter-figure.css");
const names=["Boxe","Muay Thai","Capoeira","Karatê","Jiu-jítsu","Luta de rua"];

describe("Luta Matemática — seis modalidades visuais",()=>{
  it("preserva IDs antigos, perfis e cores do usuário",()=>{
    for(const name of names)expect(registry).toContain('"'+name+'"');
    expect(registry).toContain("resolveFighterStyle");
    expect(game).toContain('profileKey(session.nickname)');
    expect(game).toContain('localStorage.setItem');
    expect(game).toContain("color:e.target.value");
    expect(game).toContain("style:e.target.value as Style");
  });
  it("aplica roupas articuladas e modifica a arena com a escolha do jogador",()=>{
    expect(figure).toContain("fighterStyles[fighterStyle]");
    expect(figure).toContain("mf-figure--style-");
    for(const part of ["torso","head","back-thigh","front-thigh","back-shin","front-shin","back-arm","front-arm"]){
      expect(figure).toContain('piece="'+part+'"');
    }
    expect(outfit).toContain('fighterStyle==="Capoeira"');
    expect(outfit).toContain('fighterStyle==="Karatê"');
    expect(outfit).toContain('fighterStyle==="Jiu-jítsu"');
    expect(outfit).toContain('fighterStyle==="Muay Thai"');
    expect(outfit).toContain('fighterStyle==="Boxe"');
    expect(outfit).toContain('fighterStyle==="Luta de rua"');
    expect(game).toContain('fighterStyle={fighter.style} pose="idle"');
    expect(game).toContain('fighterStyle={fighter.style}/>');
    expect(stage).toContain('fighterStyle={fighterStyle} pose={motion.player}');
  });
  it("preserva as dez poses e acessibilidade, variando as guardas",()=>{
    for(const p of ["idle","step","retreat","jab","cross","kick","block","hit","victory","defeat"])expect(figure).toContain('"'+p+'"');
    for(const slug of ["boxing","muay-thai","capoeira","karate","jiujitsu","street"])expect(css).toContain(".mf-figure--style-"+slug);
    expect(css).toContain("mf-capoeira-ginga");
    expect(css).toContain("mf-thai-roundhouse");
    expect(css).toContain("mf-karate-frontkick");
    expect(css).toContain("prefers-reduced-motion");
  });
});
