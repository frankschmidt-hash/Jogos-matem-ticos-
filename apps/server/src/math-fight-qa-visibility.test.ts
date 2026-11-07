import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+path,import.meta.url)),"utf8");
const game=read("MathFight.tsx");
const css=read("math-fight.css");
const stage=read("FightStage.tsx");

describe("Luta Matemática — isolamento definitivo do painel interno",()=>{
  it("retira de fato o painel de QA do componente público",()=>{
    expect(game).not.toContain("fight-pose-picker");
    expect(game).not.toContain("import.meta.env.DEV");
    expect(game).not.toContain("setPreviewPose");
    expect(game).not.toContain("setPreviewTick");
    expect(game).not.toContain("Visualizar posturas do lutador");
    expect(css).not.toContain("fight-pose-picker");
    expect(css).not.toContain("fight-pose-active");
  });
  it("preserva prévia, combates automáticos e seleciona personagem para arena",()=>{
    expect(game).toContain('className="fight-preview"');
    expect(game).toContain('fighterStyle={fighter.style} pose="idle"');
    expect(game).toContain('fighterStyle={fighter.style}/>');
    expect(stage).toContain('fighterStyle={fighterStyle} pose={motion.player}');
    expect(game).toContain('onClick={start}>Iniciar luta contra o computador');
    expect(game).toContain("validateAnswer(questionRef.current,raw)");
  });
});
