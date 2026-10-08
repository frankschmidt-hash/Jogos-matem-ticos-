import { describe, expect, it } from "vitest";
import { bombTarget } from "@jogos/crazy-race";
import { crazyBombSchema, numberAnswerSchema } from "@jogos/protocol";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";
import { FootballRoomManager } from "./football-room-manager";
import { NumberRaceRoomManager } from "./number-race-room-manager";
import { RECONNECT_GRACE_MS, ROOM_TTL_MS, RoomInfrastructure } from "./room-infrastructure";
import { SessionManager } from "./session-manager";

const crazyHost={sessionId:"crazy-host-01",nickname:"Host",gradeLevel:6 as const,connected:true};
const crazyGuest={sessionId:"crazy-guest-01",nickname:"Guest",gradeLevel:6 as const,connected:true};
const numberHost={sessionId:"number-host-01",nickname:"Host",connected:true};
const numberGuest={sessionId:"number-guest-01",nickname:"Guest",connected:true};
const footballHost={sessionId:"football-host-01",nickname:"Host",connected:true};
const footballGuest={sessionId:"football-guest-01",nickname:"Guest",connected:true};

describe("Prompt 06 multiplayer consolidado",()=>{
  it("duas abas da mesma sessão não duplicam jogador",()=>{
    const manager=new NumberRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(numberHost,"1234",6,0);
    manager.joinRoom(room.code,"1234",numberGuest,1);
    manager.joinRoom(room.code,"1234",numberGuest,2);
    expect(room.members.filter(m=>m.sessionId===numberGuest.sessionId)).toHaveLength(1);
  });

  it("dois navegadores simulados entram na sala correta",()=>{
    const manager=new FootballRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(footballHost,"1234",7,0);
    const joined=manager.joinRoom(room.code,"1234",footballGuest,1);
    expect(joined.code).toBe(room.code);
    expect(joined.members.map(m=>m.sessionId)).toEqual([footballHost.sessionId,footballGuest.sessionId]);
    expect(joined.lifecycleState).toBe("ready");
  });

  it("mesmo nickname simultâneo é bloqueado pela sessão",()=>{
    const sessions=new SessionManager();
    sessions.claim("Aluno",5,0);
    expect(()=>sessions.claim(" aluno ",6,1)).toThrow(/uso/i);
  });

  it("senha errada não revela detalhes",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(crazyHost,"123",0);
    expect(()=>manager.joinRoom(room.code,"999",crazyGuest,1)).toThrow(/^Código ou senha inválidos\.$/);
  });

  it("host desconectado antes da partida transfere liderança após a janela",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(crazyHost,"123",0);
    manager.joinRoom(room.code,"123",crazyGuest,1);
    manager.disconnect(room.code,crazyHost.sessionId,100);
    manager.cleanup(100+RECONNECT_GRACE_MS);
    expect(manager.getRoom(room.code)?.hostSessionId).toBe(crazyGuest.sessionId);
    expect(manager.getRoom(room.code)?.members.some(m=>m.sessionId===crazyHost.sessionId)).toBe(false);
  });

  it("reconexão dentro da janela recupera sala sem duplicar estado",()=>{
    const manager=new NumberRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(numberHost,"1234",5,0);
    manager.joinRoom(room.code,"1234",numberGuest,1);
    manager.startRoom(room.code,numberHost.sessionId,1000);
    manager.disconnect(room.code,numberGuest.sessionId,2000);
    const before=room.race?.racers.length;
    manager.reconnect(room.code,numberGuest.sessionId,2000+RECONNECT_GRACE_MS-1);
    expect(room.members.find(m=>m.sessionId===numberGuest.sessionId)?.presence).toBe("connected");
    expect(room.race?.racers.length).toBe(before);
  });

  it("relógio de cinco minutos rejeita envio após o fim para todos",()=>{
    const manager=new NumberRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(numberHost,"1234",6,0);
    manager.startRoom(room.code,numberHost.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(q.deadlineAt).toBe(301000);
    expect(()=>manager.submitAnswer(room.code,numberHost.sessionId,q.id,"0","early-submit-01",300999)).not.toThrow();

    const other=new NumberRaceRoomManager(new RoomInfrastructure());
    const room2=other.createRoom({...numberHost,sessionId:"number-host-02"},"1234",6,0);
    other.startRoom(room2.code,"number-host-02",1000);
    const q2=other.publicSnapshot(room2.code).question!;
    expect(()=>other.submitAnswer(room2.code,"number-host-02",q2.id,"0","late-submit-01",301001)).toThrow(/tempo/i);
  });

  it("mensagem de resposta duplicada é idempotente",()=>{
    const manager=new NumberRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(numberHost,"1234",6,0);
    manager.startRoom(room.code,numberHost.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    manager.submitAnswer(room.code,numberHost.sessionId,q.id,"0","duplicate-submit-01",2000);
    expect(()=>manager.submitAnswer(room.code,numberHost.sessionId,q.id,"0","duplicate-submit-01",2500)).not.toThrow();
    expect(Object.keys(room.race!.submissions).filter(id=>id===numberHost.sessionId)).toHaveLength(1);
  });

  it("schemas recusam payload inválido e exigem idempotência na bomba",()=>{
    expect(numberAnswerSchema.safeParse({
      sessionId:"short",reconnectToken:"short",code:"!!!",questionId:"x",answer:"1",clientSubmissionId:"x"
    }).success).toBe(false);
    expect(crazyBombSchema.safeParse({
      sessionId:"session-valid",reconnectToken:"1234567890123456",code:"ABC234",direction:"ahead"
    }).success).toBe(false);
  });

  it("corrida com múltiplos humanos mantém seis competidores e NPC fill estável",()=>{
    const manager=new NumberRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(numberHost,"1234","mixed",0);
    manager.joinRoom(room.code,"1234",numberGuest,1);
    manager.startRoom(room.code,numberHost.sessionId,1000);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(2);
    manager.disconnect(room.code,numberGuest.sessionId,2000);
    manager.cleanup(2000+RECONNECT_GRACE_MS);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(2);
  });

  it("futebol PvP mantém placar e vez sob autoridade do servidor",()=>{
    const manager=new FootballRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(footballHost,"1234",6,0);
    manager.joinRoom(room.code,"1234",footballGuest,1);
    manager.startRoom(room.code,footballHost.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    manager.submitAnswer(room.code,footballHost.sessionId,q.id,"0","football-submit-01",2000);
    expect(room.match?.history).toHaveLength(1);
    expect(room.match?.currentShooterId).toBe(footballGuest.sessionId);
    expect(room.lifecycleState==="round-resolution"||room.lifecycleState==="finished").toBe(true);
  });

  it("bomba multiplayer é idempotente e servidor escolhe o alvo válido",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(crazyHost,"123",0);
    manager.joinRoom(room.code,"123",crazyGuest,1);
    manager.startRoom(room.code,crazyHost.sessionId,1000);
    room.race!.racers=room.race!.racers.map(r=>r.id===crazyHost.sessionId?{...r,bombCharges:1}:r);
    const direction=bombTarget(room.race!,crazyHost.sessionId,"ahead")?"ahead":"behind";
    const first=manager.useBomb(room.code,crazyHost.sessionId,direction,"bomb-action-01",2000);
    const second=manager.useBomb(room.code,crazyHost.sessionId,direction,"bomb-action-01",2100);
    expect(second.targetId).toBe(first.targetId);
    expect(room.race!.racers.find(r=>r.id===crazyHost.sessionId)?.bombCharges).toBe(0);
  });

  it("sala expira e libera seu código no cleanup",()=>{
    const infra=new RoomInfrastructure();
    const manager=new NumberRaceRoomManager(infra);
    const room=manager.createRoom(numberHost,"1234",5,0);
    manager.cleanup(ROOM_TTL_MS+1);
    expect(manager.getRoom(room.code)).toBeUndefined();
    expect(()=>infra.releaseCode(room.code)).not.toThrow();
  });
});
