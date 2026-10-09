import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SOLO_KICK_MS, ONLINE_KICK_MS } from "@jogos/math-football";
import { gradeLevelSchema } from "@jogos/protocol";

const web=(relative:string)=>readFileSync(
  fileURLToPath(new URL("../../web/"+relative,import.meta.url)),
  "utf8"
);
const server=(relative:string)=>readFileSync(
  fileURLToPath(new URL("./"+relative,import.meta.url)),
  "utf8"
);

describe("Seletor escolar 5º ao 9º + misto em todos os jogos",()=>{
  it("aceita somente os anos de 5 a 9 e o misto em sessões e salas",()=>{
    for(const grade of [5,6,7,8,9,"mixed"] as const)expect(gradeLevelSchema.safeParse(grade).success).toBe(true);
    for(const invalid of [4,10,"5","8","9",null,"all"])expect(gradeLevelSchema.safeParse(invalid).success).toBe(false);
  });
  it("expõe 5º a 9º e misto tanto no portal quanto na criação de salas",()=>{
    for(const path of ["src/App.tsx","src/games/NumberRace.tsx","src/games/MathFootball.tsx"]){
      const source=web(path);
      for(const grade of [5,6,7,8,9]){
        expect(source).toContain("<option value={"+grade+"}>"+grade+"º ano</option>");
      }
      expect(source).toContain('<option value="mixed">Misto');
    }
    expect(web("src/App.tsx")).toContain("5º ao 9º ano");
  });
});

describe("Prompt 08 pre-release contracts",()=>{
  it("usa padrões de aula curtos sem remover opções pedagógicas",()=>{
    const property=web("src/games/PropertyGame.tsx");
    const football=web("src/games/MathFootball.tsx");
    expect(property).toContain('useState(8)');
    expect(property).toContain('<option value={8}>8 rodadas</option>');
    expect(property).toContain('<option value={12}>12 rodadas</option>');
    expect(DEFAULT_SOLO_KICK_MS).toBe(30_000);
    expect(ONLINE_KICK_MS).toBe(30_000);
    expect(football).toContain('30 segundos — padrão de aula');
    expect(football).toContain('<option value={60000}>60 segundos</option>');
    expect(football).toContain('<option value={0}>Sem cronômetro</option>');
  });

  it("mantém feedback de rodada legível antes de reiniciar",()=>{
    expect(web("src/games/CrazyRace.tsx")).toContain("setQuestion(makeNextQuestion");
    // Corrida Numérica: questões imediatas durante os cinco minutos.
    expect(web("src/games/NumberRace.tsx")).toContain("questionNumber.current+=1");
    expect(web("src/games/MathFootball.tsx")).toContain('},2600);');
  });

  it("limpa timer curto do dado quando a tela é desmontada",()=>{
    const property=web("src/games/PropertyGame.tsx");
    expect(property).toContain('const rollTimer=useRef<number|null>(null)');
    expect(property).toContain('window.clearTimeout(rollTimer.current)');
  });

  it("servidor poda timers de salas removidas",()=>{
    const index=server("index.ts");
    expect(index).toContain('pruneMissingTimers(raceTimers');
    expect(index).toContain('pruneMissingTimers(numberRaceTimers');
    expect(index).toContain('pruneMissingTimers(footballKickTimers');
  });

  it("feedback pedagógico informa a resposta correta nos quatro jogos",()=>{
    const property=web("src/games/PropertyGame.tsx");
    const crazy=web("src/games/CrazyRace.tsx");
    const number=web("src/games/NumberRace.tsx");
    const football=web("src/games/MathFootball.tsx");
    expect(property).toContain("Resposta correta:");
    expect(crazy).toContain("Resposta correta:");
    expect(crazy).toContain("10 segundos");
    expect(crazy).toContain("Bomba matemática — resposta correta:");
    expect(number).toContain("Resposta correta:");
    expect(number).toContain("Errou. Continue na próxima conta.");
    expect(football).toContain("Resposta correta:");
  });


  it("não expõe chat livre nem exige cadastro no fluxo escolar",()=>{
    const app=web("src/App.tsx");
    const index=server("index.ts");
    expect(app).toContain('sem cadastro');
    expect(index).not.toMatch(/socket\.on\(["']chat:/);
    expect(index).not.toMatch(/socket\.emit\(["']chat:/);
  });
});
