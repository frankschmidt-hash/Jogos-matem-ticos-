import { describe, expect, it } from "vitest";
import { SessionManager, normalizeNickname, validateNickname, hasOffensiveNickname } from "./session-manager";

describe("SessionManager", () => {
  it("bloqueia termos obscenos, variações com números e nomes ofensivos em todas as sessões",()=>{
    const forbidden=["merda","P0RR4","CAR4LH0","vagabundo","xX_idiota_Xx","b0sta",
      "m3rda_123","f.d.p","p u t a","fDp","pqp","Cuzão","buceta","arrombada","p0rrra"];
    // Caracteres especiais já são rejeitados antes da moderação.
    for(const nickname of forbidden) expect(validateNickname(nickname).ok,nickname).toBe(false);
    const manager=new SessionManager();
    expect(()=>manager.claim("M3rDa",5)).toThrow(/inadequada/);
  });
  it("não bloqueia apelidos escolares legítimos por partes de palavras",()=>{
    for(const nickname of ["Mestre7","Jogador123","Paulo","Computador","Maria","Júlia",
      "Ana Clara","Matematico","Luiza_10","Calculadora"])
      expect(validateNickname(nickname).ok,nickname).toBe(true);
    expect(hasOffensiveNickname("porra")).toBe(true);
    expect(hasOffensiveNickname("computador")).toBe(false);
  });
  it("normaliza apelidos para exclusividade", () => {
    expect(normalizeNickname(" FRANK ")).toBe("frank");
  });
  it("impede apelidos equivalentes simultâneos", () => {
    const manager = new SessionManager();
    manager.claim("Frank",5,0);
    expect(() => manager.claim(" frank ",6,1)).toThrow(/uso/);
  });
  it("mantém nome reservado na janela de reconexão e libera depois", () => {
    const manager = new SessionManager(1000, 5000);
    const s = manager.claim("Julia",5,0);
    manager.disconnect(s.sessionId,s.reconnectToken,100);
    expect(() => manager.claim("JULIA",6,500)).toThrow();
    manager.cleanup(1101);
    expect(() => manager.claim("JULIA",6,1101)).not.toThrow();
  });
  it("reconecta com token correto", () => {
    const manager = new SessionManager(1000,5000);
    const s=manager.claim("Aluno 1",7,0);
    manager.disconnect(s.sessionId,s.reconnectToken,100);
    const r=manager.reconnect(s.sessionId,s.reconnectToken,500);
    expect(r.connectionState).toBe("connected");
  });
});
