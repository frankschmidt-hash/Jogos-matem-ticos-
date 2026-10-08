import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const file=(relative:string)=>fileURLToPath(new URL("../../web/"+relative,import.meta.url));
const read=(relative:string)=>readFileSync(file(relative),"utf8");

describe("Prompt 07 UI/UX accessibility contracts",()=>{
  const styles=read("src/styles.css");
  const crazyCss=read("src/games/crazy-race.css");
  const numberCss=read("src/games/number-race.css");
  const footballCss=read("src/games/math-football.css");
  const ui=read("../../packages/ui/src/index.tsx");
  const app=read("src/App.tsx");
  const experience=read("src/experience.tsx");

  it("portal e lobby possuem arte original com fallback",()=>{
    expect(existsSync(file("public/assets/portal/math-portal.svg"))).toBe(true);
    expect(app).toContain("math-portal.svg");
    expect(ui).toContain("game-art-fallback");
    expect(ui).toContain("onError");
  });

  it("layouts possuem contratos mobile para 360/390 e desktop amplo",()=>{
    expect(styles).toContain("@media(max-width:390px)");
    expect(styles).toContain("@media(max-width:720px)");
    expect(crazyCss).toContain("@media(max-width:420px)");
    expect(numberCss).toContain("@media(max-width:420px)");
    expect(footballCss).toContain("@media(max-width:420px)");
    expect(footballCss).toContain("@media(min-width:1500px)");
  });

  it("touch targets e teclado numérico permanecem acessíveis",()=>{
    expect(styles).toMatch(/button,.button\{min-height:44px\}/);
    expect(styles).toMatch(/input,select\{min-height:46px\}/);
    expect(read("src/games/PropertyGame.tsx")).toContain('inputMode="decimal"');
    expect(read("src/games/CrazyRace.tsx")).toContain('inputMode="decimal"');
    expect(read("src/games/NumberRace.tsx")).toContain('inputMode="decimal"');
    expect(read("src/games/MathFootball.tsx")).toContain('inputMode="decimal"');
  });

  it("foco visível e navegação de salto estão presentes",()=>{
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain(".skip-link");
    expect(app).toContain('href="#main-content"');
    expect(read("src/games/MathFootball.tsx")).toContain('id="main-content"');
  });

  it("redução de movimento respeita sistema e opção manual",()=>{
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
    expect(styles).toContain("html.reduce-motion");
    expect(crazyCss).toContain("html.reduce-motion");
    expect(numberCss).toContain("html.reduce-motion");
    expect(footballCss).toContain("html.reduce-motion");
    expect(experience).toContain("jogos:reduce-motion");
  });

  it("modal matemático usa ARIA e não corta conteúdo",()=>{
    expect(ui).toContain('aria-modal="true"');
    expect(ui).toContain('role="dialog"');
    expect(styles).toContain("max-height:min(720px,calc(100dvh - 36px))");
    expect(styles).toContain("overflow:auto");
  });

  it("tabuleiro Cidade Prisma cabe na altura da janela sem rolagem interna",()=>{
    expect(styles).toContain(".property-board-wrap{width:min(100%,calc(100dvh - 88px),980px)");
    expect(styles).toContain("max-height:none");
    expect(styles).toContain("overflow:hidden");
    expect(styles).toContain(".property-board{position:relative");
  });

  it("nomes dos peões usam linhas coloridas e acompanham posições",()=>{
    const board=read("src/games/PropertyGame.tsx");
    expect(board).toContain("const callouts=game.players.flatMap");
    expect(board).toContain("boardCoordinate(player.position)");
    expect(board).toContain('className="pawn-identity-layer"');
    expect(board).toContain("stroke={item.ink}");
    expect(board).toContain("{item.name}");
    expect(styles).toContain(".pawn-identity-name{");
    expect(board).not.toContain('className="pawn-name"');
  });

  it("HUDs de corrida preservam legibilidade em telas pequenas",()=>{
    expect(crazyCss).toContain(".crazy-hud{grid-template-columns:repeat(2,1fr)}");
    expect(numberCss).toContain(".number-hud{grid-template-columns:repeat(2,1fr)}");
    expect(crazyCss).toContain("text-overflow:ellipsis");
    expect(numberCss).toContain("text-overflow:ellipsis");
  });

  it("estádio impede overflow e reduz dimensões no mobile",()=>{
    expect(footballCss).toContain(".football-stadium{position:relative");
    expect(footballCss).toContain("overflow:hidden");
    expect(footballCss).toContain(".football-goal{width:220px");
    expect(footballCss).toContain(".football-stadium{height:285px");
  });

  it("assets fundamentais existem e arte não depende de serviço remoto",()=>{
    const assets=[
      "public/assets/property-game/cidade-prisma.svg",
      "public/assets/property-game/dado-prisma.svg",
      "public/assets/property-game/peao-prisma.svg",
      "public/assets/property-game/carta-prisma.svg",
      "public/assets/crazy-race/math-bomb.svg",
      "public/assets/number-race/number-emblem.svg",
      "public/assets/math-football/football-emblem.svg"
    ];
    for(const asset of assets) expect(existsSync(file(asset))).toBe(true);
    expect(styles).not.toMatch(/https?:\/\//);
  });

  it("áudio é opcional, baixo, mutável e não carrega mídia externa",()=>{
    expect(experience).toContain('const DEFAULT_VOLUME=0.14');
    expect(experience).toContain('jogos:audio-muted');
    expect(experience).toContain('aria-pressed={isMuted}');
    for(const sound of ["click","dice","engine","correct","incorrect","goal","save","purchase","victory"]){
      expect(experience).toContain('"'+sound+'"');
    }
    expect(experience).not.toMatch(/https?:\/\//);
  });

  it("reconexão e estados essenciais permanecem visíveis em texto",()=>{
    expect(app).toContain("Recuperando sua sessão");
    expect(ui).toContain("Reconectando");
    expect(ui).toContain("Tempo encerrado");
    expect(ui).toContain("Incorreto");
    expect(ui).toContain("Correto!");
  });
});
