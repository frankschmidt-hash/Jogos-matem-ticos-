import { describe, expect, it } from "vitest";
import { RoomInfrastructure, RECONNECT_GRACE_MS } from "./room-infrastructure";

describe("RoomInfrastructure",()=>{
  it("gera códigos únicos mesmo entre jogos diferentes",()=>{
    const infra=new RoomInfrastructure();
    const a=infra.allocateCode("crazy");
    const b=infra.allocateCode("football");
    expect(a).toHaveLength(6);
    expect(b).toHaveLength(6);
    expect(a).not.toBe(b);
  });

  it("armazena apenas hash e valida senha com comparação segura",()=>{
    const infra=new RoomInfrastructure();
    const stored=infra.createPassword("segredo");
    expect(stored.hash).not.toContain("segredo");
    expect(()=>infra.verifyPassword("x","ABC123","session-a","segredo",stored,0)).not.toThrow();
    expect(()=>infra.verifyPassword("x","ABC123","session-b","errada",stored,0)).toThrow(/inválidos/i);
  });

  it("limita tentativas de senha",()=>{
    const infra=new RoomInfrastructure();
    const stored=infra.createPassword("1234");
    for(let i=0;i<5;i++){
      expect(()=>infra.verifyPassword("x","ABC123","session-a","xxxx",stored,i)).toThrow(/inválidos/i);
    }
    expect(()=>infra.verifyPassword("x","ABC123","session-a","xxxx",stored,6)).toThrow(/tentativas/i);
  });

  it("modela connected, reconnecting, disconnected e abandoned",()=>{
    const infra=new RoomInfrastructure();
    const member=infra.createMember({sessionId:"session-a",nickname:"Aluno"},0);
    expect(member.presence).toBe("connected");
    infra.disconnectMember(member,100);
    expect(member.presence).toBe("reconnecting");
    infra.sweepPresence([member],100+RECONNECT_GRACE_MS/2);
    expect(member.presence).toBe("disconnected");
    infra.sweepPresence([member],100+RECONNECT_GRACE_MS);
    expect(member.presence).toBe("abandoned");
  });

  it("preserva a vaga durante a janela de reconexão",()=>{
    const infra=new RoomInfrastructure();
    const member=infra.createMember({sessionId:"session-a",nickname:"Aluno"},0);
    infra.disconnectMember(member,100);
    infra.reconnectMember(member,100+RECONNECT_GRACE_MS-1);
    expect(member.connected).toBe(true);
    expect(member.presence).toBe("connected");
  });

  it("transfere host deterministicamente depois de abandono",()=>{
    const infra=new RoomInfrastructure();
    const a=infra.createMember({sessionId:"a",nickname:"A"},0);
    const b=infra.createMember({sessionId:"b",nickname:"B"},1);
    const c=infra.createMember({sessionId:"c",nickname:"C"},2);
    infra.abandonMember(a,10);
    expect(infra.nextHost([c,b,a],"a")).toBe("b");
  });

  it("registra máquina de estados e rejeita transição inválida",()=>{
    const infra=new RoomInfrastructure();
    const room={lifecycleState:"waiting" as const,lifecycleHistory:["waiting" as const]};
    infra.transition(room,"ready");
    infra.transition(room,"countdown");
    infra.transition(room,"playing");
    infra.transition(room,"round-resolution");
    infra.transition(room,"finished");
    expect(room.lifecycleHistory).toEqual(["waiting","ready","countdown","playing","round-resolution","finished"]);
    expect(()=>infra.transition(room,"playing")).toThrow(/transição/i);
  });

  it("detecta replay por clientSubmissionId",()=>{
    const infra=new RoomInfrastructure();
    expect(infra.isReplay("answer","a","submission-123",0)).toBe(false);
    expect(infra.isReplay("answer","a","submission-123",1)).toBe(true);
    expect(infra.isReplay("answer","b","submission-123",1)).toBe(false);
  });
});
