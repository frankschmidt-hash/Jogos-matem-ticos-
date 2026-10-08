import { describe, expect, it } from "vitest";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";

const host={sessionId:"host-session",nickname:"Host",gradeLevel:6 as const,connected:true};
const guest=(n:number)=>({sessionId:"guest-session-"+n,nickname:"Guest "+n,gradeLevel:6 as const,connected:true});

describe("CrazyRaceRoomManager",()=>{
  it("cria sala com PIN de três dígitos e rejeita código errado",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"123",100);
    expect(room.code).toHaveLength(6);
    expect(()=>manager.joinRoom(room.code,"999",guest(1),200)).toThrow(/inválidos/i);
    expect(manager.joinRoom(room.code,"123",guest(1),200).members).toHaveLength(2);
  });

  it("aceita até 6 humanos e substitui NPCs no início",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    for(let i=1;i<=5;i++) manager.joinRoom(room.code,"456",guest(i),i);
    expect(room.members).toHaveLength(6);
    expect(()=>manager.joinRoom(room.code,"456",guest(6),10)).toThrow(/cheia/i);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="npc")).toHaveLength(0);
  });

  it("mantém 6 competidores preenchendo NPCs",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.joinRoom(room.code,"456",guest(1),1);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="npc")).toHaveLength(4);
  });

  it("questão e deadline são definidos pelo servidor",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const snap=manager.publicSnapshot(room.code);
    expect(snap.question?.expression.length).toBeGreaterThan(0);
    expect(snap.question?.deadlineAt).toBe(21000);
  });

  it("rejeita resposta após deadline",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",22000)).toThrow(/tempo/i);
  });

  it("trata clientSubmissionId repetido de forma idempotente",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",2000);
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submission-123",2500)).not.toThrow();
    expect(Object.keys(room.race!.submissions).filter(id=>id===host.sessionId)).toHaveLength(1);
  });

  it("reconexão preserva membro e sala",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.disconnect(room.code,host.sessionId,100);
    expect(room.members[0]!.connected).toBe(false);
    manager.reconnect(room.code,host.sessionId,200);
    expect(room.members[0]!.connected).toBe(true);
    expect(manager.publicSnapshot(room.code).code).toBe(room.code);
  });

  it("somente host inicia a corrida",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
    manager.joinRoom(room.code,"456",guest(1),1);
    expect(()=>manager.startRoom(room.code,guest(1).sessionId,1000)).toThrow(/host/i);
  });

  it("finaliza rodada, libera correção somente depois do deadline e abre a próxima",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"456",0);
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
    const room=manager.createRoom(host,"456",0);
    manager.joinRoom(room.code,"456",guest(1),1);
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

describe("Novas regras da Corrida Maluca online",()=>{
  it("lista salas de espera sem expor os PINs e remove após iniciar",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom({...host,carModel:"buggy",carColor:"#ab1234"},"007",100);
    expect(manager.listWaitingRooms()).toEqual([{
      code:room.code,hostNickname:host.nickname,occupied:1,max:6,createdAt:100
    }]);
    const snapshot=manager.publicSnapshot(room.code);
    expect(JSON.stringify(snapshot)).not.toContain("007");
    expect(manager.joinRoom(room.code,"007",guest(1),200).members).toHaveLength(2);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(manager.listWaitingRooms()).toHaveLength(0);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.carModel).toBe("buggy");
  });

  it("gera pergunta surpresa da primeira bomba e aplica explosão no servidor",()=>{
    const manager=new CrazyRaceRoomManager();
    const room=manager.createRoom(host,"208",0);
    manager.startRoom(room.code,host.sessionId,1000);
    for(let i=0;i<2;i++){
      const q=room.question!;
      manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"answer-track-"+i,1500+i*22000);
      manager.finalizeRound(room.code,21000+i*22000);
      if(i===0) manager.openNextRound(room.code,23000);
    }
    const challenge=manager.trackQuestionFor(room.code,host.sessionId);
    expect(challenge?.checkpoint).toBe(220);
    expect(challenge?.expression).toBeTruthy();
    const result=manager.submitTrackBombAnswer(room.code,host.sessionId,challenge!.id,"999999","track-bomb-01",44000);
    expect(result.correct).toBe(false);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.progress).toBe(0);
    expect(manager.trackQuestionFor(room.code,host.sessionId)).toBeNull();
  });
});
