import { describe, expect, it } from "vitest";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";
import { RoomInfrastructure } from "./room-infrastructure";
import { BOMB_PENALTY_MS, MATCH_DURATION_MS, TIMED_BOMBS } from "@jogos/crazy-race";

const host={sessionId:"host-session",nickname:"Host",gradeLevel:6 as const,connected:true};
const guest=(n:number)=>({sessionId:"guest-session-"+n,nickname:"Guest "+n,gradeLevel:6 as const,connected:true});
const make=()=>{
  const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
  const room=manager.createRoom(host,"123",0);
  manager.startRoom(room.code,host.sessionId,1000);
  return {manager,room};
};

describe("Corrida Maluca — modo contínuo de cinco minutos",()=>{
  it("mantém PIN privado de três dígitos e seis competidores",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(host,"007",0);
    expect(room.code).toHaveLength(6);
    expect(()=>manager.joinRoom(room.code,"123",guest(1),200)).toThrow(/inválidos/i);
    manager.joinRoom(room.code,"007",guest(1),200);
    expect(manager.publicSnapshot(room.code,host.sessionId).members).toHaveLength(2);
    expect(JSON.stringify(manager.publicSnapshot(room.code,host.sessionId))).not.toContain('"007"');
    manager.startRoom(room.code,host.sessionId,1000);
    expect(room.race?.racers).toHaveLength(6);
    expect(room.race?.racers.filter(r=>r.kind==="human")).toHaveLength(2);
  });

  it("aplica prazo único de 05:00 e disponibiliza conta individual",()=>{
    const {manager,room}=make();
    expect(room.race?.matchDeadlineAt).toBe(1000+MATCH_DURATION_MS);
    expect(room.race?.roundDeadlineAt).toBe(1000+MATCH_DURATION_MS);
    expect(manager.publicSnapshot(room.code,host.sessionId).question?.expression.length).toBeGreaterThan(0);
    expect(manager.publicSnapshot(room.code,host.sessionId).question?.deadlineAt).toBe(301000);
    expect(manager.publicSnapshot(room.code,guest(1).sessionId).question).toBeNull();
  });

  it("a cada acerto gera outra conta imediatamente e soma pontos e metros",()=>{
    const {manager,room}=make();
    const q=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"answer-01",2000);
    expect(room.race!.racers.find(r=>r.id===host.sessionId)?.correctAnswers).toBe(1);
    expect(room.race!.racers.find(r=>r.id===host.sessionId)?.progress).toBeGreaterThan(0);
    expect(room.questions[host.sessionId]?.id).not.toBe(q.id);
    const q2=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,q2.id,q2.correctAnswer,"answer-02",3000);
    expect(room.race!.racers.find(r=>r.id===host.sessionId)?.correctAnswers).toBe(2);
  });

  it("a cada erro também entrega imediatamente a próxima conta",()=>{
    const {manager,room}=make();
    const q=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,q.id,"999999","answer-error-01",2000);
    const racer=room.race!.racers.find(r=>r.id===host.sessionId)!;
    expect(racer.errors).toBe(1);
    expect(racer.correctAnswers).toBe(0);
    expect(room.questions[host.sessionId]?.id).not.toBe(q.id);
  });

  it("rejeita resposta fora do prazo e reenvio de id reconhecido não duplica",()=>{
    const {manager,room}=make();
    const q=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"answer-replay-01",2000);
    const score=room.race!.racers.find(r=>r.id===host.sessionId)!.correctAnswers;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"answer-replay-01",2500)).not.toThrow();
    expect(room.race!.racers.find(r=>r.id===host.sessionId)!.correctAnswers).toBe(score);
    const q2=room.questions[host.sessionId]!;
    expect(()=>manager.submitAnswer(room.code,host.sessionId,q2.id,q2.correctAnswer,"answer-late-01",301001)).toThrow(/tempo/i);
  });

  it("questões de dois jogadores não se misturam",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(host,"456",0);
    manager.joinRoom(room.code,"456",guest(1),10);
    manager.startRoom(room.code,host.sessionId,1000);
    const hostQ=manager.publicSnapshot(room.code,host.sessionId).question!;
    const guestQ=manager.publicSnapshot(room.code,guest(1).sessionId).question!;
    manager.submitAnswer(room.code,host.sessionId,hostQ.id,room.questions[host.sessionId]!.correctAnswer,"human-01",2000);
    expect(manager.publicSnapshot(room.code,guest(1).sessionId).question?.id).toBe(guestQ.id);
    expect(manager.publicSnapshot(room.code,host.sessionId).question?.id).not.toBe(hostQ.id);
  });

  it("apresenta exatamente três bombas aos 01:15, 02:30 e 03:45",()=>{
    const {manager,room}=make();
    expect(TIMED_BOMBS).toEqual([75000,150000,225000]);
    for(const [i,elapsed] of TIMED_BOMBS.entries()){
      manager.advanceTimedRace(room.code,1000+elapsed);
      const pending=room.race!.racers.find(r=>r.id===host.sessionId)!.pendingTrackBomb;
      expect(pending).toBe(elapsed);
      const q=manager.trackQuestionFor(room.code,host.sessionId)!;
      manager.submitTrackBombAnswer(room.code,host.sessionId,q.id,room.trackQuestions[host.sessionId]!.correctAnswer,"bomb-correct-"+i,2000+elapsed);
    }
    const racer=room.race!.racers.find(r=>r.id===host.sessionId)!;
    expect(racer.clearedTrackBombs).toEqual([...TIMED_BOMBS]);
    expect(racer.timePenaltyMs).toBe(0);
  });

  it("bomba incorreta desconta 10 segundos sem apagar avanço ou acertos",()=>{
    const {manager,room}=make();
    const initial=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,initial.id,initial.correctAnswer,"score-before-bomb",2000);
    const before=room.race!.racers.find(r=>r.id===host.sessionId)!;
    manager.advanceTimedRace(room.code,76000);
    const q=manager.trackQuestionFor(room.code,host.sessionId)!;
    const result=manager.submitTrackBombAnswer(room.code,host.sessionId,q.id,"999999","bomb-wrong-01",77000);
    expect(result.correct).toBe(false);
    const after=room.race!.racers.find(r=>r.id===host.sessionId)!;
    expect(after.timePenaltyMs).toBe(BOMB_PENALTY_MS);
    expect(after.progress).toBe(before.progress);
    expect(after.correctAnswers).toBe(before.correctAnswers);
    expect(manager.publicSnapshot(room.code,host.sessionId).question?.deadlineAt).toBe(291000);
    expect(()=>manager.submitAnswer(room.code,host.sessionId,room.questions[host.sessionId]!.id,"0","out-after-penalty",291001)).toThrow(/tempo/i);
  });

  it("o tempo comum termina em 05:00 e a vitória depende de mais acertos",()=>{
    const {manager,room}=make();
    expect(()=>manager.finalizeRound(room.code,300999)).toThrow(/cinco minutos/i);
    room.race!.racers=room.race!.racers.map(r=>r.id===host.sessionId?{...r,correctAnswers:50,progress:5500}:r);
    manager.finalizeRound(room.code,301000);
    expect(room.status).toBe("finished");
    expect(room.race!.winnerId).toBe(host.sessionId);
    expect(manager.publicSnapshot(room.code,host.sessionId).question).toBeNull();
  });

  it("somente host inicia a partida e reconexão conserva a pontuação",()=>{
    const manager=new CrazyRaceRoomManager(new RoomInfrastructure());
    const room=manager.createRoom(host,"456",0);
    manager.joinRoom(room.code,"456",guest(1),1);
    expect(()=>manager.startRoom(room.code,guest(1).sessionId,1000)).toThrow(/host/i);
    manager.startRoom(room.code,host.sessionId,1000);
    const q=room.questions[host.sessionId]!;
    manager.submitAnswer(room.code,host.sessionId,q.id,q.correctAnswer,"connected-answer",2000);
    manager.disconnect(room.code,host.sessionId,3000);
    manager.reconnect(room.code,host.sessionId,3200);
    expect(manager.publicSnapshot(room.code,host.sessionId).race?.racers.find(r=>r.id===host.sessionId)?.correctAnswers).toBe(1);
  });
});
