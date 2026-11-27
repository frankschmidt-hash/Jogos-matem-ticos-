import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FootballRoomManager } from "./football-room-manager";
import { RoomInfrastructure } from "./room-infrastructure";

const webSource=readFileSync(fileURLToPath(new URL("../../web/src/games/MathFootball.tsx",import.meta.url)),"utf8");
const dockerSource=readFileSync(fileURLToPath(new URL("../../../Dockerfile",import.meta.url)),"utf8");

describe("Regressão: criação e entrada no Futebol Matemático online",()=>{
  it("gera um código visível de seis caracteres, separado do PIN de três dígitos",()=>{
    const manager=new FootballRoomManager(new RoomInfrastructure());
    const host={sessionId:"football-contract-host",nickname:"Host",connected:true};
    const guest={sessionId:"football-contract-guest",nickname:"Convidado",connected:true};
    const room=manager.createRoom(host,"007",7,100);
    const lobby=manager.publicSnapshot(room.code);
    expect(lobby.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(lobby).not.toHaveProperty("password");
    expect(manager.listWaiting()).toEqual([{code:room.code,hostName:"Host",players:1,capacity:2}]);
    expect(()=>manager.joinRoom(room.code,"123",guest,101)).toThrow(/inválidos/i);
    manager.joinRoom(room.code,"007",guest,102);
    expect(manager.publicSnapshot(room.code).capacity.occupied).toBe(2);
  });

  it("usa HTTP para todas as ações do futebol, sem depender de WebSocket",()=>{
    expect(webSource).not.toContain('from "socket.io-client"');
    expect(webSource).toContain('/api/football/action');
    expect(webSource).toContain('window.setInterval(()=>void poll(),1_000)');
    expect(webSource).toContain('Aguardando confirmação...');
    expect(dockerSource).toContain("NODE_ENV=production npm run build");
  });

  it("informa onde encontrar e como compartilhar o código e a senha",()=>{
    expect(webSource).toContain("Código da sala (6 caracteres)");
    expect(webSource).toContain("Senha de acesso (3 dígitos)");
    expect(webSource).toContain("Copiar convite completo");
    expect(webSource).toContain("Ex.: ABC234");
    expect(webSource).toContain("selecione uma sala disponível abaixo.");
  });
});

describe("Descoberta e recuperação",()=>{
  it("não anuncia sala de anfitrião desconectado e restaura após reconexão",()=>{
    const manager=new FootballRoomManager(new RoomInfrastructure());
    const host={sessionId:"discovery-host",nickname:"Host"};
    const room=manager.createRoom(host,"123",5,0);
    expect(manager.listWaiting().map(r=>r.code)).toContain(room.code);
    manager.disconnect(room.code,host.sessionId,100);
    expect(manager.listWaiting()).toHaveLength(0);
    manager.reconnect(room.code,host.sessionId,200);
    expect(manager.listWaiting().map(r=>r.code)).toContain(room.code);
  });
  it("faz consulta HTTP independente do socket e mantém recuperação e atualização automática",()=>{
    expect(webSource).toContain('/api/football/rooms');
    expect(webSource).toContain('window.setInterval(fetchRooms,5_000)');
    expect(webSource).toContain('ensureActiveSession(activeSession.current)');
    expect(webSource).toContain('JSON.stringify({action,...payload,...auth(active)})');
  });
});

describe("Criação idempotente por HTTP",()=>{
  it("recupera a mesma sala se a resposta se perder, sem trocar a senha nem a série",()=>{
    const manager=new FootballRoomManager(new RoomInfrastructure());
    const host={sessionId:"http-create-host",nickname:"Host"};
    const room=manager.createOrRecoverRoom(host,"123",5,0);
    expect(manager.createOrRecoverRoom(host,"123",5,1).code).toBe(room.code);
    expect(()=>manager.createOrRecoverRoom(host,"999",5,2)).toThrow(/inválidos/i);
    expect(()=>manager.createOrRecoverRoom(host,"123",6,3)).toThrow(/nível/);
    expect(manager.listWaiting()).toHaveLength(1);
  });
});
