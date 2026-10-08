import { describe, expect, it } from "vitest";
import { ONLINE_KICK_MS } from "@jogos/math-football";
import { FootballRoomManager } from "./football-room-manager";

const host={sessionId:"football-host",nickname:"Host",connected:true};
const guest={sessionId:"football-guest",nickname:"Guest",connected:true};

function started(now=1000){
  const manager=new FootballRoomManager();
  const room=manager.createRoom(host,"123",6,0);
  manager.joinRoom(room.code,"123",guest,10);
  manager.startRoom(room.code,host.sessionId,now);
  return {manager,room};
}

describe("FootballRoomManager",()=>{
  it("cria sala e exige senha correta",()=>{
    const manager=new FootballRoomManager();
    const room=manager.createRoom(host,"123",5,0);
    expect(()=>manager.joinRoom(room.code,"000",guest,1)).toThrow(/inválidos/i);
    manager.joinRoom(room.code,"123",guest,2);
    expect(room.members).toHaveLength(2);
  });

  it("exibe salas disponíveis sem revelar senha e exige PIN de 3 dígitos",()=>{
    const manager=new FootballRoomManager();
    expect(()=>manager.createRoom(host,"1234",5,0)).toThrow(/3 dígitos/);
    const room=manager.createRoom(host,"012",5,0);
    expect(manager.listWaiting()).toEqual([{code:room.code,hostName:"Host",players:1,capacity:2}]);
    manager.joinRoom(room.code,"012",guest,10);
    expect(manager.listWaiting()).toHaveLength(0);
  });

  it("registra canto escolhido na jogada sincronizada",()=>{
    const {manager,room}=started(1000);
    const q=room.question!;
    manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"target-valid-001",2000,2);
    expect(room.match?.lastKick?.target).toBe(2);
    expect(room.match?.lastKick?.keeperTarget).not.toBe(2);
  });

  it("limita a sala a dois jogadores",()=>{
    const manager=new FootballRoomManager();
    const room=manager.createRoom(host,"123",5,0);
    manager.joinRoom(room.code,"123",guest,1);
    expect(()=>manager.joinRoom(room.code,"123",{sessionId:"third-player",nickname:"Terceiro",connected:true},2)).toThrow(/cheia/i);
  });

  it("somente host inicia e precisa de dois jogadores",()=>{
    const manager=new FootballRoomManager();
    const room=manager.createRoom(host,"123",5,0);
    expect(()=>manager.startRoom(room.code,host.sessionId,1)).toThrow(/segundo/i);
    manager.joinRoom(room.code,"123",guest,2);
    expect(()=>manager.startRoom(room.code,guest.sessionId,3)).toThrow(/host/i);
  });

  it("questão e deadline de 30 segundos são servidor-autoritativos",()=>{
    const {manager,room}=started(1000);
    const snap=manager.publicSnapshot(room.code);
    expect(snap.question?.expression.length).toBeGreaterThan(0);
    expect(snap.question?.deadlineAt).toBe(1000+ONLINE_KICK_MS);
  });

  it("somente o cobrador atual pode responder",()=>{
    const {manager,room}=started(1000);
    const q=manager.publicSnapshot(room.code).question!;
    expect(()=>manager.submitAnswer(room.code,guest.sessionId,q.id,"0","submit-guest-0001",2000)).toThrow(/vez/i);
  });

  it("timeout online registra defesa e erro",()=>{
    const {manager,room}=started(1000);
    manager.timeoutCurrentKick(room.code,1000+ONLINE_KICK_MS);
    const snap=manager.publicSnapshot(room.code);
    expect(snap.match?.lastKick?.reason).toBe("timeout");
    expect(snap.match?.goals[host.sessionId]).toBe(0);
    expect(snap.match?.errors[host.sessionId]).toBe(1);
  });

  it("reconexão preserva o jogador",()=>{
    const {manager,room}=started();
    manager.disconnect(room.code,guest.sessionId,2000);
    expect(room.members[1]!.connected).toBe(false);
    manager.reconnect(room.code,guest.sessionId,2500);
    expect(room.members[1]!.connected).toBe(true);
  });

  it("abandono encerra a partida a favor do adversário",()=>{
    const {manager,room}=started();
    manager.abandon(room.code,host.sessionId,2000);
    expect(room.status).toBe("finished");
    expect(room.match?.winnerId).toBe(guest.sessionId);
  });

  it("revanche após término normal reinicia placar e abre nova cobrança",()=>{
    const {manager,room}=started(1000);
    let now=2000;
    let submission=0;
    while(room.status!=="finished"&&submission<10){
      const q=room.question!;
      const shooter=room.match!.currentShooterId;
      const answer=shooter===host.sessionId?q.correctAnswer:"resposta-incorreta";
      manager.submitAnswer(room.code,shooter,q.id,answer,"finish-submit-"+String(submission).padStart(4,"0"),now);
      submission++;
      now+=2000;
      if(room.status==="playing") manager.openNextKick(room.code,now);
    }
    expect(room.status).toBe("finished");
    manager.rematch(room.code,guest.sessionId,now+1000);
    expect(room.status).toBe("playing");
    expect(room.match?.goals[host.sessionId]).toBe(0);
    expect(room.match?.phase).toBe("kick-open");
    expect(room.question).not.toBeNull();
  });
});
