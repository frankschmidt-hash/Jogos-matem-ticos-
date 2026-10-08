import { describe, expect, it } from "vitest";
import { RoomInfrastructure } from "./room-infrastructure";
import { PropertyRoomManager } from "./property-room-manager";

const host={sessionId:"property-host-111",nickname:"Criador"};
const guest={sessionId:"property-guest-222",nickname:"Colega"};
const another={sessionId:"property-third-333",nickname:"Terceiro"};
const last={sessionId:"property-fourth-444",nickname:"Quarto"};

function newManager(){return new PropertyRoomManager(new RoomInfrastructure());}
function started(){
  const manager=newManager();
  const room=manager.createRoom(host,"007",6,"short",8,100);
  manager.joinRoom(room.code,"007",guest,200);
  manager.startRoom(room.code,host.sessionId,300);
  return {manager,room};
}

describe("Cidade Prisma — salas multiplayer",()=>{
  it("PIN deve ter exatamente três dígitos e não vaza no lobby",()=>{
    const m=newManager();
    expect(()=>m.createRoom(host,"1234",5,"short",8,1)).toThrow(/3 números/);
    const room=m.createRoom(host,"007",6,"short",8,2);
    const listing=m.listWaiting();
    expect(listing).toHaveLength(1);
    expect(JSON.stringify(listing)).not.toContain("007");
    expect(JSON.stringify(m.publicSnapshot(room.code))).not.toContain("hash");
    expect(()=>m.joinRoom(room.code,"999",guest,3)).toThrow(/inválidos/);
    m.joinRoom(room.code,"007",guest,4);
    expect(room.members).toHaveLength(2);
  });

  it("só o criador inicia e deve haver pelo menos dois jogadores",()=>{
    const m=newManager();
    const r=m.createRoom(host,"123",6,"full",8,100);
    expect(()=>m.startRoom(r.code,host.sessionId,110)).toThrow(/dois jogadores/);
    m.joinRoom(r.code,"123",guest,200);
    expect(()=>m.startRoom(r.code,guest.sessionId,300)).toThrow(/criou/);
    m.startRoom(r.code,host.sessionId,350);
    expect(r.status).toBe("playing");
    expect(r.game?.players.map(p=>p.name)).toEqual(["Criador","Colega"]);
  });

  it("sala permite no máximo quatro usuários",()=>{
    const m=newManager();
    const r=m.createRoom(host,"812",7,"short",8,0);
    m.joinRoom(r.code,"812",guest,1);
    m.joinRoom(r.code,"812",another,2);
    m.joinRoom(r.code,"812",last,3);
    expect(()=>m.joinRoom(r.code,"812",{sessionId:"property-fifth-555",nickname:"Quinto"},4)).toThrow(/cheia/);
  });

  it("o servidor sorteia dado, cria questão e apenas o jogador da vez responde",()=>{
    const {manager:m,room:r}=started();
    expect(()=>m.action(r.code,guest.sessionId,{action:"roll"},400)).toThrow(/vez/);
    m.action(r.code,host.sessionId,{action:"roll"},450);
    expect(r.lastDie).toBeGreaterThanOrEqual(1);
    expect(r.lastDie).toBeLessThanOrEqual(6);
    expect(r.question).not.toBeNull();
    const publicState=m.publicSnapshot(r.code);
    expect(publicState.question?.expression).toBeTruthy();
    expect(JSON.stringify(publicState.question)).not.toContain("correctAnswer");
    expect(()=>m.action(r.code,guest.sessionId,{action:"answer",questionId:r.question!.id,answer:"0",submissionId:"submit-guest-001"},500)).toThrow(/vez/);
    m.action(r.code,host.sessionId,{
      action:"answer",questionId:r.question!.id,answer:r.question!.correctAnswer,submissionId:"submit-host-001"
    },550);
    expect(r.lastResolution?.correct).toBe(true);
    expect(r.game!.players[0]!.position).toBe(r.lastResolution?.position);
    expect(r.game!.log.some(item=>item.message.includes("avançou "+r.lastDie))).toBe(true);
    expect(r.question).toBeNull();
  });

  it("ações de compra e turno preservam o estado e pertencimento",()=>{
    const {manager:m,room:r}=started();
    r.game={...r.game!,players:r.game!.players.map((p,i)=>i===0?{...p,position:35}:p)};
    m.action(r.code,host.sessionId,{action:"roll"},1000);
    m.action(r.code,host.sessionId,{
      action:"answer",questionId:r.question!.id,answer:r.question!.correctAnswer,submissionId:"submit-host-002"
    },1100);
    if(r.game!.phase==="awaiting-purchase"){
      expect(()=>m.action(r.code,guest.sessionId,{action:"buy",buy:true},1200)).toThrow(/vez/);
      m.action(r.code,host.sessionId,{action:"buy",buy:false},1250);
    }
    expect(r.game!.phase).toBe("turn-end");
    m.action(r.code,host.sessionId,{action:"end"},1300);
    expect(r.game!.activePlayerIndex).toBe(1);
  });

  it("reconexão preserva partida e saída do jogador produz vencedor",()=>{
    const {manager:m,room:r}=started();
    m.disconnect(r.code,guest.sessionId,900);
    expect(r.members[1]?.connected).toBe(false);
    m.reconnect(r.code,guest.sessionId,1100);
    expect(r.members[1]?.connected).toBe(true);
    m.leaveRoom(r.code,guest.sessionId,1200);
    expect(r.status).toBe("finished");
    expect(r.game?.winnerId).toBe(host.sessionId);
  });
});
