import { describe, expect, it } from "vitest";
import { NumberRaceRoomManager } from "./number-race-room-manager";

const host={sessionId:"number-host",nickname:"Host",connected:true};
const guest=(n:number)=>({sessionId:"number-guest-"+n,nickname:"Guest "+n,connected:true});

describe("NumberRaceRoomManager",()=>{
  it("host escolhe o nível da sala antes da largada",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",7,0);
    expect(room.gradeLevel).toBe(7);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(manager.publicSnapshot(room.code).gradeLevel).toBe(7);
  });

  it("cria e entra por código/senha",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    expect(()=>manager.joinRoom(room.code,"errada",guest(1),1)).toThrow(/inválidos/i);
    manager.joinRoom(room.code,"1234",guest(1),2);
    expect(room.members).toHaveLength(2);
  });

  it("mantém 6 competidores e substitui NPCs por humanos",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234","mixed",0);
    for(let i=1;i<=3;i++) manager.joinRoom(room.code,"1234",guest(i),i);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(4);
    expect(room.race?.racers.filter(r=>r.kind==="npc")).toHaveLength(2);
  });

  it("não aceita mais que 6 humanos",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    for(let i=1;i<=5;i++) manager.joinRoom(room.code,"1234",guest(i),i);
    expect(()=>manager.joinRoom(room.code,"1234",guest(6),10)).toThrow(/cheia/i);
  });

  it("somente host inicia",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    manager.joinRoom(room.code,"1234",guest(1),1);
    expect(()=>manager.startRoom(room.code,guest(1).sessionId,1000)).toThrow(/host/i);
  });

  it("deadline e questão são servidor-autoritativos",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    manager.startRoom(room.code,host.sessionId,1000);
    const snap=manager.publicSnapshot(room.code);
    expect(snap.question?.deadlineAt).toBe(11000);
    expect(snap.question?.expression.length).toBeGreaterThan(0);
  });

  it("rejeita resposta após deadline",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submit-0001",12000)).toThrow(/tempo/i);
  });

  it("clientSubmissionId repetido é idempotente",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    manager.submitAnswer(room.code,host.sessionId,q.id,"0","submit-0001",2000);
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submit-0001",2500)).not.toThrow();
    expect(Object.keys(room.race!.submissions).filter(x=>x===host.sessionId)).toHaveLength(1);
  });

  it("reconexão preserva membro",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    manager.disconnect(room.code,host.sessionId,100);
    expect(room.members[0]!.connected).toBe(false);
    manager.reconnect(room.code,host.sessionId,200);
    expect(room.members[0]!.connected).toBe(true);
  });

  it("finaliza, libera correção somente depois do deadline e abre próxima rodada",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeNull();
    manager.finalizeRound(room.code,11000);
    expect(room.race?.phase).toBe("round-resolution");
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeTruthy();
    manager.openNextRound(room.code,12000);
    expect(room.race?.round).toBe(2);
    expect(room.race?.roundDeadlineAt).toBe(22000);
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeNull();
  });
});
