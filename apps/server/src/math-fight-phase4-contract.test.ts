import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(fileURLToPath(new URL("../../web/src/games/"+path,import.meta.url)),"utf8");
const backdrop=read("../../public/assets/math-fight/arena-urbana.svg");
const css=read("math-fight-phase4.css");
const hud=read("FightHud.tsx");
const game=read("MathFight.tsx");
const stage=read("FightStage.tsx");

describe("Fase 4 — arena e HUD arcade",()=>{
  it("exibe uma arena original local sem URLs externas",()=>{
    expect(backdrop).toContain('viewBox="0 0 1200 500"');
    expect(backdrop).toContain("ARENA DE LUTA");
    expect(backdrop).toContain("MATEMÁTICA");
    expect(backdrop).not.toContain("<image");
    expect(backdrop).not.toContain("href=");
    expect(css).toContain('url("/assets/math-fight/arena-urbana.svg")');
    expect(css).toContain(".fight-arena");
  });
  it("apresenta HUD acessível, espelhado e com HP real",()=>{
    expect(hud).toContain('role="progressbar"');
    expect(hud).toContain("aria-valuenow={safe}");
    expect(hud).toContain("fight-hud-healthbar--flipped");
    expect(hud).toContain("fight-hud-healthbar--critical");
    expect(hud).toContain("playerHp");
    expect(hud).toContain("cpuHp");
    expect(hud).toContain("remaining");
    expect(game).toContain("<FightHud");
    expect(game).toContain("resolving={handled.current}");
    expect(css).toContain(".fight-hud-clock--urgent");
  });
  it("preserva a arena interativa, matemática e recompensa",()=>{
    expect(game).toContain("<FightStage motion={motion} impact={impact} color={fighter.color}/>");
    expect(stage).toContain("fight-stage-actor--");
    expect(game).toContain("validateAnswer(questionRef.current,raw)");
    expect(game).toContain("limitDamage(left,duration,fighterRef.current.gloves)");
    expect(game).toContain("100");
    expect(game).toContain("30");
    expect(game).toContain("fight-result-rewards");
    expect(game).toContain("setFighter(old=>");
  });
  it("usa mensagens diferentes para acerto, bloqueio, dano e timeout",()=>{
    for (const name of ["correct","blocked","timeout","damage"]){
      expect(css).toContain(".fight-feedback--"+name);
    }
    expect(game).toContain("setFeedbackTone(");
    expect(game).toContain('role="status"');
  });
  it("mantém suporte a celulares e movimento reduzido",()=>{
    expect(css).toContain("@media(max-width:700px)");
    expect(css).toContain("@media(max-width:390px)");
    expect(css).toContain("html.reduce-motion");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain("fight-answer button{width:100%}");
  });
});
