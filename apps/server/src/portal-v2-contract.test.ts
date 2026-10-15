import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const path=(relative:string)=>fileURLToPath(new URL("../../web/"+relative,import.meta.url));
const app=readFileSync(path("src/App.tsx"),"utf8");
const styles=readFileSync(path("src/styles.css"),"utf8");
const heroStyles=styles.split("/* Portal V2: capa imersiva para estudantes do 5º ao 9º ano */")[1]??"";

describe("Portal V2: capa e entrada legíveis",()=>{
  it("usa a arte local como fundo da faixa superior e mantém fallback",()=>{
    expect(existsSync(path("public/assets/portal/matematica-em-movimento-hero.webp"))).toBe(true);
    expect(app).toContain('className="portal-hero-band"');
    expect(app).toContain('className="portal-visual"');
    expect(app).toContain("matematica-em-movimento-hero.webp");
    expect(app).toContain("math-portal.svg");
    expect(heroStyles).toContain(".portal-visual img,.portal-visual .portal-hero-art");
    expect(heroStyles).toContain("object-fit:cover");
  });

  it("preserva formulario, rankings e controles sem mexer no fluxo de jogo",()=>{
    expect(app).toContain('className="panel login-panel"');
    expect(app).toContain('onSubmit={submit}');
    expect(app).toContain('disabled={loading||nickname.trim().length<2}');
    expect(app).toContain('id="nickname"');
    expect(app).toContain('id="grade"');
    expect(app).toContain("<HomeRankings/>");
    expect(app).toContain('aria-labelledby="rankings-title"');
  });

  it("protege contraste e foco da area de login",()=>{
    expect(heroStyles).toContain("background:#fff;");
    expect(heroStyles).toContain("border:2px solid #7655ce");
    expect(heroStyles).toContain(".login-panel input:focus-visible");
    expect(heroStyles).toContain("color:#fff");
    expect(heroStyles).toContain(".login-panel .primary-cta:disabled");
  });

  it("mantem adaptacao visual para celular e telas estreitas",()=>{
    expect(heroStyles).toContain("@media(max-width:1100px)");
    expect(heroStyles).toContain("@media(max-width:720px)");
    expect(heroStyles).toContain("@media(max-width:390px)");
    expect(heroStyles).toContain("min-width:0");
    expect(heroStyles).toContain("max-width:none");
  });
});
