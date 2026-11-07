import {readFileSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";

const root=fileURLToPath(new URL("../../web/",import.meta.url));
const cards=["property-math","crazy-race","number-race","math-football","math-fight"] as const;
const app=readFileSync(root+"src/App.tsx","utf8");
const css=readFileSync(root+"src/styles.css","utf8");

describe("Catálogo de jogos — cinco banners panorâmicos",()=>{
  it("tem um recurso WebP real para cada um dos cinco jogos",()=>{
    for(const id of cards){
      const path=root+"public/assets/game-cards/"+id+".webp";
      const bytes=readFileSync(path);
      expect(statSync(path).size).toBeGreaterThan(2500);
      expect(bytes.subarray(0,4).toString()).toBe("RIFF");
      expect(bytes.subarray(8,12).toString()).toBe("WEBP");
      expect(app).toContain('/assets/game-cards/'+id+'.webp');
    }
  });
  it("mantém o catálogo, destinos e os textos dos jogos",()=>{
    expect(app).toContain("GAME_CATALOG.map(game=>");
    expect(app).toContain("href={\"/game/\"+game.id}");
    expect(app).toContain("name={game.name}");
    expect(app).toContain("description={game.description}");
    expect(app).toContain("imageSrc={art.src}");
  });
  it("usa imagem de capa inteira, com enquadramento e opção de reduzir movimento",()=>{
    expect(css).toContain("object-fit:cover");
    expect(css).toContain(".game-card:hover .game-art img");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain("html.reduce-motion");
    expect(css).toContain(".game-art-fallback");
  });
});
