import { describe, expect, it } from "vitest";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";

const host={sessionId:"host-session",nickname:"Host",gradeLevel:6 as const,connected:true};
const guest=(n:number)=>({sessionId:"guest-session-"+n,nickname:"Guest "+n,gradeLevel:6 as const,connected:true});

describe("CrazyRaceRoomManager",()=>{
  it("cria sala protegida e rejeita senha errada",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"1234",100);
    expect(room.code).toHaveLength(6);
    expect(()=>manager.joinRoom(room.code,"xxxx",guest(1),200)).toThrow(/inválidos/i);
    expect(manager.joinRoom(room.code,"1234",guest(1),200).members).toHaveLength(2);
  });

  it("aceita até 6 humanos e substitui NPCs no início",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    for(let i=1;i<=5;i++) manager.joinRoom(room.code,"abcd",guest(i),i);
    expect(room.members).toHaveLength(6);
    expect(()=>manager.joinRoom(room.code,"abcd",guest(6),10)).toThrow(/cheia/i);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="npc")).toHaveLength(0);
  });

  it("mantém 6 competidores preenchendo NPCs",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.joinRoom(room.code,"abcd",guest(1),1);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="npc")).toHaveLength(4);
  });

  it("questão e deadline são definidos pelo servidor",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const snap=manager.publicSnapshot(room.code);
    expect(snap.question?.expression.length).toBeGreaterThan(0);
    expect(snap.question?.deadlineAt).toBe(21000);
  });

  it("rejeita resposta após deadline",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",22000)).toThrow(/tempo/i);
  });

  it("trata clientSubmissionId repetido de forma idempotente",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",2000);
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",2500)).not.toThrow();
    expect(Object.keys(room.race!.submissions).filter(id=>id===host.sessionId)).toHaveLength(1);
  });

  it("reconexão preserva membro e sala",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.disconnect(room.code,host.sessionId,100);
    expect(room.members[0]!.connected).toBe(false);
    manager.reconnect(room.code,host.sessionId,200);
    expect(room.members[0]!.connected).toBe(true);
    expect(manager.publicSnapshot(room.code).code).toBe(room.code);
  });

  it("somente host inicia a corrida",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.joinRoom(room.code,"abcd",guest(1),1);
    expect(()=>manager.startRoom(room.code,guest(1).sessionId,1000)).toThrow(/host/i);
  });

  it("finaliza rodada, libera correção somente depois do deadline e abre a próxima",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeNull();
    manager.finalizeRound(room.code,21000);
    expect(room.race?.phase).toBe("round-resolution");
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeTruthy();
    manager.openNextRound(room.code,22000);
    expect(room.race?.round).toBe(2);
    expect(room.race?.roundDeadlineAt).toBe(42000);
    expect(manager.publicSnapshot(room.code).lastCorrectAnswer).toBeNull();
  });
  it("resposta da bomba é idempotente e corrige somente após a tentativa",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"abcd",0);
    manager.joinRoom(room.code,"abcd",guest(1),1);
    manager.startRoom(room.code,host.sessionId,1000);
    room.race!.racers=room.race!.racers.map(r=>r.id===host.sessionId?{...r,bombCharges:1}:r);
    const attack=manager.useBomb(room.code,host.sessionId,"ahead","bomb-action-answer-01",2000);
    expect(attack.targetId).toBe(guest(1).sessionId);
    const q=manager.bombQuestionFor(room.code,attack.targetId)!;
    const first=manager.submitBombAnswer(room.code,attack.targetId,q.id,"999999","bomb-answer-01",3000);
    expect(first.correct).toBe(false);
    expect(first.correctAnswer).toBeTruthy();
    const duplicate=manager.submitBombAnswer(room.code,attack.targetId,q.id,"999999","bomb-answer-01",3100);
    expect(duplicate.correct).toBeNull();
    expect(room.race!.bombChallenges[attack.targetId]?.resolved).toBe(true);
  });

});
