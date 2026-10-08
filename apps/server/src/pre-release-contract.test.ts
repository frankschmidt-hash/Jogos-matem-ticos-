import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SOLO_KICK_MS, ONLINE_KICK_MS } from "@jogos/math-football";

const web=(relative:string)=>readFileSync(
  fileURLToPath(new URL("../../web/"+relative,import.meta.url)),
  "utf8"
);
const server=(relative:string)=>readFileSync(
  fileURLToPath(new URL("./"+relative,import.meta.url)),
  "utf8"
);

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
    expect(web("src/games/CrazyRace.tsx")).toContain('},1600);');
    // Corrida Numérica: 10s de conta + transição curta de 450ms, sem bloquear a próxima questão.
    expect(web("src/games/NumberRace.tsx")).toContain('},450);');
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
    expect(crazy).toContain("Resposta correta da rodada:");
    expect(crazy).toContain("Bomba matemática — resposta correta:");
    expect(number).toContain("Resposta correta:");
    expect(number).toContain("Resposta correta da rodada:");
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
