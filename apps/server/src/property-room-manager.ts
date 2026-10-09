import { randomInt } from "node:crypto";
import {
  activePlayer, buyPendingProperty, createGame, endTurn, resolveMathMove, rollDice,
  sellProperty, upgradeProperty, type GameState, type MatchMode
} from "@jogos/property-game";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import {
  ROOM_TTL_MS, roomInfrastructure, type CoreRoomMember, type MemberInput,
  type RoomInfrastructure, type StoredPassword
} from "./room-infrastructure";

export type PropertyRoom = {
  code:string;
  pin:StoredPassword;
  hostSessionId:string;
  members:CoreRoomMember[];
  status:"waiting"|"playing"|"finished";
  mode:MatchMode;
  shortRounds:number;
  gradeLevel:5|6|7|8|9|"mixed";
  game:GameState|null;
  question:MathQuestion|null;
  lastResolution:{playerId:string;correct:boolean;correctAnswer:string|null;position:number;at:number}|null;
  lastDie:number|null;
  updatedAt:number;
};

export type PropertyAction = {
  action:"roll"|"answer"|"buy"|"end"|"upgrade"|"sell";
  questionId?:string;
  answer?:string;
  buy?:boolean;
  spaceIndex?:number;
  submissionId?:string;
};

const PIN_PATTERN=/^[0-9]{3}$/;
export class PropertyRoomManager {
  private rooms=new Map<string,PropertyRoom>();
  constructor(private infra:RoomInfrastructure=roomInfrastructure){}

  createRoom(host:MemberInput,pin:string,gradeLevel:5|6|7|8|9|"mixed",mode:MatchMode,shortRounds:number,now=Date.now()):PropertyRoom{
    if(!PIN_PATTERN.test(pin)) throw new Error("A senha deve conter exatamente 3 números.");
    this.infra.assertActionRate("property-create",host.sessionId,now,3,60_000);
    if([...this.rooms.values()].some(r=>r.hostSessionId===host.sessionId&&r.status!=="finished")) throw new Error("Você já criou uma sala ativa.");
    const code=this.infra.allocateCode("property");
    const room:PropertyRoom={
      code,pin:this.infra.createPassword("P"+pin),hostSessionId:host.sessionId,
      members:[this.infra.createMember(host,now)],
      status:"waiting",mode,shortRounds,gradeLevel,game:null,question:null,
      lastResolution:null,lastDie:null,updatedAt:now
    };
    this.rooms.set(code,room);
    return room;
  }

  listWaiting(){
    return [...this.rooms.values()].filter(r=>r.status==="waiting")
      .map(r=>({
        code:r.code,
        hostName:r.members.find(m=>m.sessionId===r.hostSessionId)?.nickname??"Jogador",
        players:r.members.length,capacity:4,
        mode:r.mode
      }));
  }

  joinRoom(code:string,pin:string,input:MemberInput,now=Date.now()):PropertyRoom{
    const room=this.must(code);
    if(room.status!=="waiting") throw new Error("Essa partida já começou.");
    if(!PIN_PATTERN.test(pin)) throw new Error("Senha de 3 dígitos inválida.");
    // Limites por sala e por jogador: impedem adivinhação de PINs curtos.
    this.infra.assertActionRate("property-pin:"+room.code,"shared",now,10,60_000);
    this.infra.verifyPassword("property",room.code,input.sessionId,"P"+pin,room.pin,now);
    const existing=room.members.find(m=>m.sessionId===input.sessionId);
    if(existing) this.infra.reconnectMember(existing,now);
    else {
      if(room.members.length>=4) throw new Error("Sala cheia.");
      room.members.push(this.infra.createMember(input,now));
    }
    room.updatedAt=now;
    return room;
  }

  reconnect(code:string,sessionId:string,now=Date.now()):PropertyRoom{
    const room=this.must(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Você não faz parte desta sala.");
    this.infra.reconnectMember(member,now);
    room.updatedAt=now;
    return room;
  }

  disconnect(code:string,sessionId:string,now=Date.now()):void{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    const member=room?.members.find(m=>m.sessionId===sessionId);
    if(member&&room){
      this.infra.disconnectMember(member,now);
      room.updatedAt=now;
    }
  }

  startRoom(code:string,sessionId:string,now=Date.now()):PropertyRoom{
    const room=this.must(code);
    if(room.status!=="waiting") throw new Error("A partida já começou.");
    if(room.hostSessionId!==sessionId) throw new Error("Só quem criou a sala pode iniciar.");
    if(room.members.length<2) throw new Error("Aguarde pelo menos dois jogadores.");
    if(room.members.some(m=>!m.connected||m.presence!=="connected")) throw new Error("Aguarde os jogadores se reconectarem.");
    const size=room.members.length as 2|3|4;
    const base=createGame({humanName:room.members[0]!.nickname,totalPlayers:size,mode:room.mode,shortRounds:room.shortRounds});
    room.game={...base,players:base.players.map((p,i)=>({
      ...p,id:room.members[i]!.sessionId,name:room.members[i]!.nickname,kind:"human" as const,npcSkill:undefined
    }))};
    room.status="playing";
    room.question=null;
    room.lastResolution=null;
    room.lastDie=null;
    room.updatedAt=now;
    return room;
  }

  action(code:string,sessionId:string,input:PropertyAction,now=Date.now()):PropertyRoom{
    const room=this.must(code);
    if(room.status!=="playing"||!room.game) throw new Error("A partida não está em andamento.");
    if(!room.members.some(m=>m.sessionId===sessionId&&m.presence==="connected")) throw new Error("Jogador não conectado.");
    if(activePlayer(room.game).id!==sessionId) throw new Error("Aguarde sua vez.");
    this.infra.assertActionRate("property-action:"+room.code,sessionId,now,25,10_000);
    const game=room.game;
    switch(input.action){
      case "roll": {
        const die=randomInt(1,7);
        room.game=rollDice(game,die);
        room.lastDie=die;
        room.question=generateQuestion(room.gradeLevel,{
          difficulty:game.round<4?1:game.round<9?2:3,
          seed:"property:"+room.code+":"+game.round+":"+game.activePlayerIndex+":"+now+":"+die
        });
        room.lastResolution=null;
        break;
      }
      case "answer": {
        if(!input.questionId||!input.answer||!input.submissionId||room.question?.id!==input.questionId)
          throw new Error("Questão inválida ou já respondida.");
        if(this.infra.isReplay("property-answer:"+room.code,sessionId,input.submissionId,now)) return room;
        const correct=validateAnswer(room.question,input.answer);
        const correctAnswer=correct?null:room.question.correctAnswer;
        room.game=resolveMathMove(game,correct);
        room.lastResolution={
          playerId:sessionId,correct,correctAnswer,
          position:room.game.players.find(p=>p.id===sessionId)!.position,at:now
        };
        room.question=null;
        break;
      }
      case "buy":
        if(typeof input.buy!=="boolean") throw new Error("Decisão de compra inválida.");
        room.game=buyPendingProperty(game,input.buy);
        break;
      case "end":
        room.game=endTurn(game);
        room.question=null;
        break;
      case "upgrade":
      case "sell":
        if(!Number.isInteger(input.spaceIndex)) throw new Error("Imóvel inválido.");
        room.game=input.action==="upgrade"
          ?upgradeProperty(game,sessionId,input.spaceIndex!)
          :sellProperty(game,sessionId,input.spaceIndex!);
        break;
    }
    if(room.game.phase==="finished") room.status="finished";
    room.updatedAt=now;
    return room;
  }

  private forfeit(room:PropertyRoom,sessionId:string):void{
    if(!room.game||room.status!=="playing") return;
    const player=room.game.players.find(p=>p.id===sessionId);
    if(!player||player.bankrupt) return;
    const players=room.game.players.map(p=>p.id===sessionId?{...p,bankrupt:true,balance:0}:p);
    const properties=Object.fromEntries(Object.entries(room.game.properties).map(([id,p])=>[
      id,p.ownerId===sessionId?{...p,ownerId:null,level:0 as const}:p
    ]));
    room.game={...room.game,players,properties};
    const survivors=players.filter(p=>!p.bankrupt);
    if(survivors.length<=1){
      room.game={...room.game,phase:"finished",winnerId:survivors[0]?.id??null};
      room.status="finished";
    }else if(activePlayer(room.game).id===sessionId){
      room.game=endTurn({...room.game,phase:"turn-end",pendingMove:null,pendingPropertyIndex:null});
      room.question=null;
    }
  }

  leaveRoom(code:string,sessionId:string,now=Date.now()):PropertyRoom|null{
    const room=this.must(code);
    const member=room.members.find(m=>m.sessionId===sessionId);
    if(!member) throw new Error("Você não está nesta sala.");
    this.infra.abandonMember(member,now);
    if(room.status==="waiting"){
      room.members=room.members.filter(m=>m.sessionId!==sessionId);
      if(!room.members.length){
        this.rooms.delete(room.code);
        this.infra.releaseCode(room.code);
        return null;
      }
      if(room.hostSessionId===sessionId) room.hostSessionId=room.members[0]!.sessionId;
    }else this.forfeit(room,sessionId);
    room.updatedAt=now;
    return room;
  }

  publicSnapshot(code:string){
    const room=this.must(code);
    return {
      code:room.code,hostSessionId:room.hostSessionId,
      members:room.members.map(m=>({...m})),status:room.status,
      mode:room.mode,shortRounds:room.shortRounds,gradeLevel:room.gradeLevel,
      game:room.game,question:room.question?{
        id:room.question.id,expression:room.question.expression
      }:null,
      lastResolution:room.lastResolution,lastDie:room.lastDie,updatedAt:room.updatedAt
    };
  }

  getRoom(code:string){return this.rooms.get(this.infra.normalizeCode(code));}
  cleanup(now=Date.now(),ttl=ROOM_TTL_MS):string[]{
    const changed:string[]=[];
    for(const [code,room] of this.rooms){
      const swept=this.infra.sweepPresence(room.members,now);
      if(swept){
        if(room.status==="waiting"){
          room.members=room.members.filter(m=>m.presence!=="abandoned");
          if(room.members.length&& !room.members.some(m=>m.sessionId===room.hostSessionId))
            room.hostSessionId=room.members[0]!.sessionId;
        } else for(const member of room.members.filter(m=>m.presence==="abandoned"))
          this.forfeit(room,member.sessionId);
        changed.push(code);
      }
      if(!room.members.some(m=>m.presence!=="abandoned") || now-room.updatedAt>ttl){
        this.rooms.delete(code);
        this.infra.releaseCode(code);
        changed.push(code);
      }
    }
    return changed;
  }

  private must(code:string):PropertyRoom{
    const room=this.rooms.get(this.infra.normalizeCode(code));
    if(!room) throw new Error("Sala não encontrada ou encerrada.");
    return room;
  }
}
