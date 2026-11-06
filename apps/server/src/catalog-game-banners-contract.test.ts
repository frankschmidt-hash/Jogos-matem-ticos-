import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../web/", import.meta.url));
const app = readFileSync(root + "src/App.tsx", "utf8");
const styles = readFileSync(root + "src/styles.css", "utf8");

const images = [
  { id: "property-math", file: "property-math.webp" },
  { id: "crazy-race", file: "crazy-race.webp" },
  { id: "number-race", file: "number-race.webp" },
  { id: "math-football", file: "math-football.webp" },
  { id: "math-fight", file: "math-fight.webp" }
] as const;

describe("Catálogo — cinco artes panorâmicas originais", () => {
  it("os cinco cartões apontam para arquivos locais do projeto", () => {
    for (const image of images) {
      expect(app).toContain(`"${image.id}":{src:"/assets/game-cards/${image.file}"`);
      const bytes = readFileSync(root + "public/assets/game-cards/" + image.file);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(bytes.length).toBeGreaterThan(20_000);
      expect(statSync(root + "public/assets/game-cards/" + image.file).size).toBeLessThan(250_000);
    }
  });
  it("usa imagens em largura total com movimento sutil e acessibilidade", () => {
    expect(styles).toContain(".game-art img{width:100%;height:100%;object-fit:cover");
    expect(styles).toContain(".game-card:hover .game-art img");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
    expect(styles).toContain("html.reduce-motion");
  });
  it("preserva os links, perfis e seleção dos cinco jogos", () => {
    expect(app).toContain('href={"/game/"+game.id}');
    expect(app).toContain("GAME_CATALOG.map(game=>");
    expect(app).toContain("imageSrc={art.src}");
    expect(app).toContain("theme={art.theme}");
  });
});
