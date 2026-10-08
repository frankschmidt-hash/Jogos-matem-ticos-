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

  it("sincroniza modelo e cor de cada jogador no multiplayer",()=>{
    const manager=new NumberRaceRoomManager();
    const hostCar={modelId:"rally",color:"#e84843"} as const;
    const guestCar={modelId:"van",color:"#2389dc"} as const;
    const room=manager.createRoom(host,"1234",5,0,hostCar);
    manager.joinRoom(room.code,"1234",guest(1),1,guestCar);
    expect(manager.publicSnapshot(room.code).carChoices[host.sessionId]).toEqual(hostCar);
    expect(manager.publicSnapshot(room.code).carChoices[guest(1).sessionId]).toEqual(guestCar);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(manager.publicSnapshot(room.code).carChoices[guest(1).sessionId]).toEqual(guestCar);
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
    expect(snap.question?.deadlineAt).toBe(301000);
    expect(snap.race?.matchDeadlineAt).toBe(301000);
    expect(snap.question?.expression.length).toBeGreaterThan(0);
  });

  it("rejeita resposta após deadline",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",6,0);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,"0","submit-0001",301001)).toThrow(/tempo/i);
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

  it("questões particulares avançam imediatamente, sem aguardar outro jogador",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    manager.joinRoom(room.code,"1234",guest(1),2);
    manager.startRoom(room.code,host.sessionId,1000);
    const first=manager.publicSnapshot(room.code,host.sessionId).question!;
    const guestFirst=manager.publicSnapshot(room.code,guest(1).sessionId).question!;
    expect(guestFirst.id).not.toBe(first.id);
    const expected=room.questions[host.sessionId]!.correctAnswer;
    manager.submitAnswer(room.code,host.sessionId,first.id,expected,"correct-one",2000);
    const second=manager.publicSnapshot(room.code,host.sessionId).question!;
    expect(second.id).not.toBe(first.id);
    expect(manager.publicSnapshot(room.code,guest(1).sessionId).question!.id).toBe(guestFirst.id);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.correctAnswers).toBe(1);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.progress).toBe(100);
    manager.submitAnswer(room.code,host.sessionId,second.id,"-99999","incorrect-two",3000);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.progress).toBe(100);
    expect(room.race?.racers.find(r=>r.id===host.sessionId)?.errors).toBe(1);
  });

  it("NPCs competem sem bloquear o cronômetro",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    manager.startRoom(room.code,host.sessionId,1000);
    manager.updateNpcProgress(room.code,7000);
    const npc=room.race?.racers.filter(r=>r.kind==="npc")??[];
    expect(npc.every(r=>r.correctAnswers+r.errors===1)).toBe(true);
    expect(room.race?.matchDeadlineAt).toBe(301000);
  });

  it("finaliza somente após 5 minutos, sem começar novas rodadas",()=>{
    const manager=new NumberRaceRoomManager();
    const room=manager.createRoom(host,"1234",5,0);
    manager.startRoom(room.code,host.sessionId,1000);
    expect(()=>manager.finalizeRound(room.code,300999)).toThrow(/ainda não terminou/i);
    manager.finalizeRound(room.code,301000);
    expect(room.race?.phase).toBe("finished");
    expect(room.status).toBe("finished");
    expect(manager.publicSnapshot(room.code).question).toBeNull();
    expect(()=>manager.openNextRound(room.code,302000)).toThrow(/individuais/i);
  });

});
