import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {describe,expect,it} from "vitest";

const file=fileURLToPath(new URL("../../web/src/games/MathFight.tsx",import.meta.url));
const source=readFileSync(file,"utf8");

describe("Luta Matemática — painel de animação reservado ao QA",()=>{
  it("restringe os controles de teste à compilação de desenvolvimento",()=>{
    expect(source).toContain('{import.meta.env.DEV && <div className="fight-pose-picker"');
    expect(source).toMatch(/\{import\.meta\.env\.DEV && <div className="fight-pose-picker"[\s\S]*?<\/div>\}/);
  });
  it("mantém a prévia do personagem, mas não exige botões de QA para jogar",()=>{
    expect(source).toContain('className="fight-preview"');
    expect(source).toContain('className="fight-pose-picker"');
    expect(source).toContain('<FightStage motion={motion} impact={impact} color={fighter.color}/>');
    expect(source).toContain('onClick={start}>Iniciar luta contra o computador');
    expect(source).toContain("validateAnswer(questionRef.current,raw)");
  });
});
