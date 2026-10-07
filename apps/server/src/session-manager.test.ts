import { describe, expect, it } from "vitest";
import { SessionManager, normalizeNickname } from "./session-manager";

describe("SessionManager", () => {
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
