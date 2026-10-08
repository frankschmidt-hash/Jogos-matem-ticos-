import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { Server } from "socket.io";
import {
  claimNicknameSchema, crazyAnswerSchema, crazyBombAnswerSchema, crazyBombSchema,
  crazyCreateRoomSchema, crazyJoinRoomSchema, crazyRoomActionSchema, crazyTrackAnswerSchema,
  numberAnswerSchema, numberCreateRoomSchema, numberJoinRoomSchema, numberRoomActionSchema,
  footballAnswerSchema, footballCreateRoomSchema, footballJoinRoomSchema, footballRoomActionSchema,
  propertyCreateRoomSchema, propertyJoinRoomSchema, propertyRoomActionSchema, propertyGameActionSchema,
  disconnectSchema, heartbeatSchema, reconnectSchema
} from "@jogos/protocol";
import { SessionManager } from "./session-manager";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";
import { NumberRaceRoomManager } from "./number-race-room-manager";
import { FootballRoomManager } from "./football-room-manager";
import { PropertyRoomManager } from "./property-room-manager";
import { roomInfrastructure } from "./room-infrastructure";
import { pruneMissingTimers } from "./timer-registry";

const app = Fastify({ logger: true, bodyLimit: 16_384, trustProxy:true });
const configuredOrigins=(process.env.WEB_ORIGIN ?? "http://localhost:5173").split(",").map(x=>x.trim()).filter(Boolean);
// Railway serves frontend and API from the same public host. Honor it even if WEB_ORIGIN is stale.
const railwayOrigin=process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;
const allowedOrigins=[...new Set([...configuredOrigins,...(railwayOrigin?[railwayOrigin]:[])])];
await app.register(cors, { origin: allowedOrigins, methods:["GET","POST"] });
await app.register(helmet,{
  contentSecurityPolicy:{
    directives:{
      defaultSrc:["'self'"],
      baseUri:["'self'"],
      objectSrc:["'none'"],
      frameAncestors:["'none'"],
      imgSrc:["'self'","data:"],
      scriptSrc:["'self'"],
      styleSrc:["'self'","'unsafe-inline'"],
      connectSrc:["'self'","ws:","wss:"]
    }
  }
});

// HTML must be revalidated after each release; hashed static assets remain cacheable.
app.addHook("onSend", async (request, reply, payload) => {
  if (request.method==="GET" && reply.getHeader("content-type")?.toString().includes("text/html")) {
    reply.header("Cache-Control","no-store, max-age=0");
  }
  return payload;
});

const serveWeb=process.env.SERVE_WEB==="true";
if(serveWeb){
  const webRoot=fileURLToPath(new URL("../../web/dist",import.meta.url));
  await app.register(fastifyStatic,{root:webRoot,prefix:"/"});
}

const manager = new SessionManager(
  Number(process.env.SESSION_RECONNECT_GRACE_MS ?? 30_000),
  Number(process.env.SESSION_TTL_MS ?? 90_000)
);
const crazyRooms=new CrazyRaceRoomManager();
const numberRooms=new NumberRaceRoomManager();
const footballRooms=new FootballRoomManager();
const propertyRooms=new PropertyRoomManager();

app.get("/health", async () => ({ ok:true, service:"jogos-matematicos-server" }));

app.post("/api/session/claim", async (request, reply) => {
  const parsed = claimNicknameSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ok:false,error:"Dados de entrada inválidos."});
  try {
    roomInfrastructure.assertActionRate("session-claim",request.ip,Date.now(),20,60_000);
    return {ok:true, session:manager.claim(parsed.data.nickname, parsed.data.gradeLevel)};
  }
  catch (error) {
    const message=error instanceof Error?error.message:"Não foi possível entrar.";
    const status=/Muitas ações/i.test(message)?429:409;
    return reply.code(status).send({ok:false,error:message});
  }
});

app.post("/api/session/heartbeat", async (request, reply) => {
  const parsed=heartbeatSchema.safeParse(request.body);
  if(!parsed.success) return reply.code(400).send({ok:false,error:"Sessão inválida."});
  try { return {ok:true,session:manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken)}; }
  catch { return reply.code(401).send({ok:false,error:"Sessão inválida ou expirada."}); }
});

app.post("/api/session/disconnect", async (request, reply) => {
  const parsed=disconnectSchema.safeParse(request.body);
  if(!parsed.success) return reply.code(400).send({ok:false,error:"Sessão inválida."});
  try { return {ok:true,session:manager.disconnect(parsed.data.sessionId,parsed.data.reconnectToken)}; }
  catch { return reply.code(401).send({ok:false,error:"Sessão inválida ou expirada."}); }
});

app.post("/api/session/reconnect", async (request, reply) => {
  const parsed=reconnectSchema.safeParse(request.body);
  if(!parsed.success) return reply.code(400).send({ok:false,error:"Sessão inválida."});
  try { return {ok:true,session:manager.reconnect(parsed.data.sessionId,parsed.data.reconnectToken)}; }
  catch { return reply.code(401).send({ok:false,error:"Sessão inválida ou expirada."}); }
});

const io = new Server(app.server, { cors:{origin:allowedOrigins,methods:["GET","POST"]}, maxHttpBufferSize:16_384 });
const sessionSockets=new Map<string,string>();
const raceTimers=new Map<string,ReturnType<typeof setTimeout>>();
const numberRaceTimers=new Map<string,ReturnType<typeof setTimeout>>();
const footballKickTimers=new Map<string,ReturnType<typeof setTimeout>>();

type Ack=(response:unknown)=>void;

const errorMessage=(error:unknown)=>error instanceof Error?error.message:"Operação não concluída.";

const emitCrazyState=(code:string)=>{
  const room=crazyRooms.getRoom(code);
  if(!room) return;
  io.to("crazy:"+code).emit("crazy:room-state",crazyRooms.publicSnapshot(code));
};

const broadcastCrazyRoomList=()=>io.emit("crazy:rooms-changed");
const sendTrackQuestions=(code:string)=>{
  for(const sessionId of crazyRooms.memberIds(code)){
    const question=crazyRooms.trackQuestionFor(code,sessionId);
    const socketId=sessionSockets.get(sessionId);
    if(question&&socketId) io.to(socketId).emit("crazy:track-question",question);
  }
};

const sendBombQuestion=(code:string,targetId:string)=>{
  const socketId=sessionSockets.get(targetId);
  const question=crazyRooms.bombQuestionFor(code,targetId);
  if(socketId && question) io.to(socketId).emit("crazy:bomb-question",question);
};

const scheduleRaceRound=(code:string)=>{
  const room=crazyRooms.getRoom(code);
  const deadline=room?.race?.roundDeadlineAt;
  if(!room || room.status!=="playing" || deadline===null || deadline===undefined) return;
  const old=raceTimers.get(code);
  if(old) clearTimeout(old);

  const delay=Math.max(0,deadline-Date.now()+25);
  const timer=setTimeout(()=>{
    try{
      const resolved=crazyRooms.finalizeRound(code,Date.now());
      emitCrazyState(code);
      sendTrackQuestions(code);
      if(resolved.status==="playing" && resolved.race?.phase==="round-resolution"){
        const next=setTimeout(()=>{
          try{
            crazyRooms.openNextRound(code,Date.now());
            emitCrazyState(code);
            scheduleRaceRound(code);
          }catch(error){
            app.log.error({err:error,code},"Falha ao abrir próxima rodada da Corrida Maluca");
          }
        },1600);
        raceTimers.set(code,next);
      }else{
        raceTimers.delete(code);
      }
    }catch(error){
      app.log.error({err:error,code},"Falha ao finalizar rodada da Corrida Maluca");
      raceTimers.delete(code);
    }
  },delay);
  raceTimers.set(code,timer);
};


const emitNumberState=(code:string)=>{
  const room=numberRooms.getRoom(code);
  if(!room) return;
  io.to("number:"+code).emit("number:room-state",numberRooms.publicSnapshot(code));
};

const scheduleNumberRound=(code:string)=>{
  const room=numberRooms.getRoom(code);
  const deadline=room?.race?.roundDeadlineAt;
  if(!room || room.status!=="playing" || deadline===null || deadline===undefined) return;
  const old=numberRaceTimers.get(code);
  if(old) clearTimeout(old);

  const delay=Math.max(0,deadline-Date.now()+25);
  const timer=setTimeout(()=>{
    try{
      const resolved=numberRooms.finalizeRound(code,Date.now());
      emitNumberState(code);
      if(resolved.status==="playing" && resolved.race?.phase==="round-resolution"){
        const next=setTimeout(()=>{
          try{
            numberRooms.openNextRound(code,Date.now());
            emitNumberState(code);
            scheduleNumberRound(code);
          }catch(error){
            app.log.error({err:error,code},"Falha ao abrir próxima rodada da Corrida Numérica");
          }
        },450);
        numberRaceTimers.set(code,next);
      }else{
        numberRaceTimers.delete(code);
      }
    }catch(error){
      app.log.error({err:error,code},"Falha ao finalizar rodada da Corrida Numérica");
      numberRaceTimers.delete(code);
    }
  },delay);
  numberRaceTimers.set(code,timer);
};



const emitPropertyRooms=()=>io.emit("property:rooms",propertyRooms.listWaiting());
const emitPropertyState=(code:string)=>{
  const room=propertyRooms.getRoom(code);
  if(room) io.to("property:"+code).emit("property:room-state",propertyRooms.publicSnapshot(code));
};

const emitFootballRooms=()=>io.emit("football:rooms-changed");
const emitFootballState=(code:string)=>{
  const room=footballRooms.getRoom(code);
  if(!room) return;
  io.to("football:"+code).emit("football:room-state",footballRooms.publicSnapshot(code));
};

function scheduleFootballAdvance(code:string){
  const previous=footballKickTimers.get(code);
  if(previous) clearTimeout(previous);
  const timer=setTimeout(()=>{
    try{
      const room=footballRooms.getRoom(code);
      if(!room||room.status!=="playing"||room.match?.phase!=="kick-resolution"){
        footballKickTimers.delete(code);
        return;
      }
      footballRooms.openNextKick(code,Date.now());
      emitFootballState(code);
      scheduleFootballKick(code);
    }catch(error){
      app.log.error({err:error,code},"Falha ao abrir próxima cobrança do Futebol Matemático");
      footballKickTimers.delete(code);
    }
  },2600);
  footballKickTimers.set(code,timer);
}

function scheduleFootballKick(code:string){
  const room=footballRooms.getRoom(code);
  const deadline=room?.match?.kickDeadlineAt;
  if(!room||room.status!=="playing"||room.match?.phase!=="kick-open"||deadline===null||deadline===undefined) return;
  const old=footballKickTimers.get(code);
  if(old) clearTimeout(old);
  const timer=setTimeout(()=>{
    try{
      const resolved=footballRooms.timeoutCurrentKick(code,Date.now());
      emitFootballState(code);
      if(resolved.status==="playing") scheduleFootballAdvance(code);
      else footballKickTimers.delete(code);
    }catch(error){
      app.log.error({err:error,code},"Falha ao aplicar timeout do Futebol Matemático");
      footballKickTimers.delete(code);
    }
  },Math.max(0,deadline-Date.now()+25));
  footballKickTimers.set(code,timer);
}

io.on("connection", socket => {
  socket.on("session:heartbeat", (payload:unknown, ack?:Ack) => {
    const parsed=heartbeatSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Payload inválido."});
    try {
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      sessionSockets.set(session.sessionId,socket.id);
      ack?.({ok:true,session});
    } catch {
      ack?.({ok:false,error:"Sessão inválida ou expirada."});
    }
  });

  socket.on("crazy:list-rooms",(_payload:unknown,ack?:Ack)=>{
    ack?.({ok:true,rooms:crazyRooms.listWaitingRooms()});
  });

  socket.on("crazy:create-room",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyCreateRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados da sala inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const pin=randomInt(0,1000).toString().padStart(3,"0");
      const room=crazyRooms.createRoom({
        sessionId:session.sessionId,nickname:session.nickname,gradeLevel:session.gradeLevel,
        carModel:parsed.data.carModel,carColor:parsed.data.carColor,connected:true
      },pin);
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.crazyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("crazy:"+room.code);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code),pin});
      broadcastCrazyRoomList();
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:join-room",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyJoinRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Código ou senha inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.joinRoom(parsed.data.code.toUpperCase(),parsed.data.pin,{
        sessionId:session.sessionId,nickname:session.nickname,gradeLevel:session.gradeLevel,
        carModel:parsed.data.carModel,carColor:parsed.data.carColor,connected:true
      });
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.crazyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("crazy:"+room.code);
      emitCrazyState(room.code);
      broadcastCrazyRoomList();
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:reconnect-room",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId);
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.crazyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("crazy:"+room.code);
      ack?.({
        ok:true,
        room:crazyRooms.publicSnapshot(room.code),
        bombQuestion:crazyRooms.bombQuestionFor(room.code,session.sessionId),
        trackQuestion:crazyRooms.trackQuestionFor(room.code,session.sessionId)
      });
      emitCrazyState(room.code);
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:start",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.startRoom(parsed.data.code.toUpperCase(),session.sessionId);
      emitCrazyState(room.code);
      scheduleRaceRound(room.code);
      broadcastCrazyRoomList();
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:answer",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyAnswerSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Resposta inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.submitAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,
        parsed.data.answer,parsed.data.clientSubmissionId
      );
      emitCrazyState(room.code);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:bomb",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyBombSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Ataque inválido."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const result=crazyRooms.useBomb(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.direction,parsed.data.clientSubmissionId
      );
      emitCrazyState(result.room.code);
      if(result.targetKind==="human") sendBombQuestion(result.room.code,result.targetId);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(result.room.code),targetId:result.targetId});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:bomb-answer",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyBombAnswerSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Resposta da bomba inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const result=crazyRooms.submitBombAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,
        parsed.data.answer,parsed.data.clientSubmissionId
      );
      emitCrazyState(result.room.code);
      ack?.({
        ok:true,
        room:crazyRooms.publicSnapshot(result.room.code),
        bombCorrection:result.correct===false?result.correctAnswer:null
      });
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });


  socket.on("crazy:track-answer",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyTrackAnswerSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Resposta da bomba da pista inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const result=crazyRooms.submitTrackBombAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,
        parsed.data.answer,parsed.data.clientSubmissionId
      );
      emitCrazyState(result.room.code);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(result.room.code),
        trackCorrect:result.correct,trackCorrection:result.correct===false?result.correctAnswer:null});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("crazy:leave",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.leaveRoom(parsed.data.code.toUpperCase(),session.sessionId);
      void socket.leave("crazy:"+parsed.data.code.toUpperCase());
      if(room) emitCrazyState(room.code);
      broadcastCrazyRoomList();
      ack?.({ok:true,room:room?crazyRooms.publicSnapshot(room.code):null});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:sync",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      crazyRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId);
      ack?.({
        ok:true,
        room:crazyRooms.publicSnapshot(parsed.data.code.toUpperCase()),
        bombQuestion:crazyRooms.bombQuestionFor(parsed.data.code.toUpperCase(),session.sessionId),
        trackQuestion:crazyRooms.trackQuestionFor(parsed.data.code.toUpperCase(),session.sessionId)
      });
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });


  socket.on("number:create-room",(payload:unknown,ack?:Ack)=>{
    const parsed=numberCreateRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados da sala inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.createRoom(
        {sessionId:session.sessionId,nickname:session.nickname,connected:true},
        parsed.data.password,
        parsed.data.gradeLevel,
        Date.now(),parsed.data.carChoice
      );
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.numberCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("number:"+room.code);
      ack?.({ok:true,room:numberRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("number:join-room",(payload:unknown,ack?:Ack)=>{
    const parsed=numberJoinRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Código ou senha inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.joinRoom(
        parsed.data.code.toUpperCase(),parsed.data.password,
        {sessionId:session.sessionId,nickname:session.nickname,connected:true},
        Date.now(),parsed.data.carChoice
      );
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.numberCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("number:"+room.code);
      emitNumberState(room.code);
      ack?.({ok:true,room:numberRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("number:reconnect-room",(payload:unknown,ack?:Ack)=>{
    const parsed=numberRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId,Date.now(),parsed.data.carChoice);
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.numberCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("number:"+room.code);
      ack?.({ok:true,room:numberRooms.publicSnapshot(room.code)});
      emitNumberState(room.code);
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("number:start",(payload:unknown,ack?:Ack)=>{
    const parsed=numberRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.startRoom(parsed.data.code.toUpperCase(),session.sessionId);
      emitNumberState(room.code);
      scheduleNumberRound(room.code);
      ack?.({ok:true,room:numberRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("number:answer",(payload:unknown,ack?:Ack)=>{
    const parsed=numberAnswerSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Resposta inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.submitAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,
        parsed.data.answer,parsed.data.clientSubmissionId
      );
      emitNumberState(room.code);
      ack?.({ok:true,room:numberRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });


  socket.on("number:leave",(payload:unknown,ack?:Ack)=>{
    const parsed=numberRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=numberRooms.leaveRoom(parsed.data.code.toUpperCase(),session.sessionId);
      void socket.leave("number:"+parsed.data.code.toUpperCase());
      if(room) emitNumberState(room.code);
      ack?.({ok:true,room:room?numberRooms.publicSnapshot(room.code):null});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("number:sync",(payload:unknown,ack?:Ack)=>{
    const parsed=numberRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      numberRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId);
      ack?.({ok:true,room:numberRooms.publicSnapshot(parsed.data.code.toUpperCase())});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });




  socket.on("property:list-rooms",(payload:unknown,ack?:Ack)=>{
    const parsed=heartbeatSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Sessão inválida."});
    try{
      manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      ack?.({ok:true,rooms:propertyRooms.listWaiting()});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:create-room",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyCreateRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Defina uma senha de 3 números e um modo de partida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.createRoom(
        {sessionId:session.sessionId,nickname:session.nickname},
        parsed.data.pin,session.gradeLevel,parsed.data.mode,parsed.data.shortRounds
      );
      socket.data.propertyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("property:"+room.code);
      ack?.({ok:true,room:propertyRooms.publicSnapshot(room.code)});
      emitPropertyRooms();
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:join-room",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyJoinRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Informe a senha de 3 dígitos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.joinRoom(
        parsed.data.code.toUpperCase(),parsed.data.pin,
        {sessionId:session.sessionId,nickname:session.nickname}
      );
      socket.data.propertyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("property:"+room.code);
      emitPropertyState(room.code);
      emitPropertyRooms();
      ack?.({ok:true,room:propertyRooms.publicSnapshot(room.code)});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:reconnect-room",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados de reconexão inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.reconnect(parsed.data.code,session.sessionId);
      socket.data.propertyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("property:"+room.code);
      ack?.({ok:true,room:propertyRooms.publicSnapshot(room.code)});
      emitPropertyState(room.code);
      emitPropertyRooms();
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:start",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Sala inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.startRoom(parsed.data.code,session.sessionId);
      emitPropertyState(room.code);
      emitPropertyRooms();
      ack?.({ok:true,room:propertyRooms.publicSnapshot(room.code)});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:action",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyGameActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Ação inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.action(parsed.data.code,session.sessionId,parsed.data);
      emitPropertyState(room.code);
      ack?.({ok:true,room:propertyRooms.publicSnapshot(room.code)});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("property:leave",(payload:unknown,ack?:Ack)=>{
    const parsed=propertyRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Sala inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=propertyRooms.leaveRoom(parsed.data.code,session.sessionId);
      void socket.leave("property:"+parsed.data.code.toUpperCase());
      delete socket.data.propertyCode;
      if(room) emitPropertyState(room.code);
      emitPropertyRooms();
      ack?.({ok:true,room:room?propertyRooms.publicSnapshot(room.code):null});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("football:list-rooms",(payload:unknown,ack?:Ack)=>{
    const parsed=heartbeatSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Sessão inválida."});
    try{
      manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      ack?.({ok:true,rooms:footballRooms.listWaiting()});
    }catch(error){ack?.({ok:false,error:errorMessage(error)});}
  });

  socket.on("football:create-room",(payload:unknown,ack?:Ack)=>{
    const parsed=footballCreateRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados da sala inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.createRoom(
        {sessionId:session.sessionId,nickname:session.nickname,connected:true},
        parsed.data.password,parsed.data.gradeLevel
      );
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.footballCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("football:"+room.code);
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
      emitFootballRooms();
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:join-room",(payload:unknown,ack?:Ack)=>{
    const parsed=footballJoinRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Código ou senha inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.joinRoom(
        parsed.data.code.toUpperCase(),parsed.data.password,
        {sessionId:session.sessionId,nickname:session.nickname,connected:true}
      );
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.footballCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("football:"+room.code);
      emitFootballState(room.code);
      emitFootballRooms();
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:reconnect-room",(payload:unknown,ack?:Ack)=>{
    const parsed=footballRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId);
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.footballCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("football:"+room.code);
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
      emitFootballState(room.code);
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:start",(payload:unknown,ack?:Ack)=>{
    const parsed=footballRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.startRoom(parsed.data.code.toUpperCase(),session.sessionId);
      emitFootballState(room.code);
      scheduleFootballKick(room.code);
      emitFootballRooms();
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:answer",(payload:unknown,ack?:Ack)=>{
    const parsed=footballAnswerSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Resposta inválida."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.submitAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,
        parsed.data.answer,parsed.data.clientSubmissionId,Date.now(),parsed.data.target
      );
      emitFootballState(room.code);
      if(room.status==="playing") scheduleFootballAdvance(room.code);
      else{
        const old=footballKickTimers.get(room.code);
        if(old) clearTimeout(old);
        footballKickTimers.delete(room.code);
      }
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:sync",(payload:unknown,ack?:Ack)=>{
    const parsed=footballRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      footballRooms.reconnect(parsed.data.code.toUpperCase(),session.sessionId);
      ack?.({ok:true,room:footballRooms.publicSnapshot(parsed.data.code.toUpperCase())});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:rematch",(payload:unknown,ack?:Ack)=>{
    const parsed=footballRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.rematch(parsed.data.code.toUpperCase(),session.sessionId);
      emitFootballState(room.code);
      scheduleFootballKick(room.code);
      ack?.({ok:true,room:footballRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("football:leave",(payload:unknown,ack?:Ack)=>{
    const parsed=footballRoomActionSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=footballRooms.abandon(parsed.data.code.toUpperCase(),session.sessionId);
      void socket.leave("football:"+parsed.data.code.toUpperCase());
      if(room){
        const old=footballKickTimers.get(room.code);
        if(old) clearTimeout(old);
        footballKickTimers.delete(room.code);
        emitFootballState(room.code);
      }
      emitFootballRooms();
      ack?.({ok:true,room:room?footballRooms.publicSnapshot(room.code):null});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("disconnect",()=>{
    const sessionId=socket.data.sessionId as string|undefined;
    const crazyCode=socket.data.crazyCode as string|undefined;
    const numberCode=socket.data.numberCode as string|undefined;
    const footballCode=socket.data.footballCode as string|undefined;
    const propertyCode=socket.data.propertyCode as string|undefined;
    if(sessionId && sessionSockets.get(sessionId)===socket.id) sessionSockets.delete(sessionId);
    if(sessionId && crazyCode){
      crazyRooms.disconnect(crazyCode,sessionId);
      emitCrazyState(crazyCode);
    }
    if(sessionId && numberCode){
      numberRooms.disconnect(numberCode,sessionId);
      emitNumberState(numberCode);
    }
    if(sessionId && footballCode){
      footballRooms.disconnect(footballCode,sessionId);
      emitFootballState(footballCode);
    }
    if(sessionId && propertyCode){
      propertyRooms.disconnect(propertyCode,sessionId);
      emitPropertyState(propertyCode);
      emitPropertyRooms();
    }
  });
});

setInterval(() => {
  manager.cleanup();
  for(const code of crazyRooms.cleanup()) emitCrazyState(code);
  for(const code of numberRooms.cleanup()) emitNumberState(code);
  const propertyChanges=propertyRooms.cleanup();
  for(const code of propertyChanges) emitPropertyState(code);
  if(propertyChanges.length) emitPropertyRooms();
  for(const code of footballRooms.cleanup()){
    const room=footballRooms.getRoom(code);
    if(room?.status!=="playing"){
      const timer=footballKickTimers.get(code);
      if(timer) clearTimeout(timer);
      footballKickTimers.delete(code);
    }
    emitFootballState(code);
  }

  emitFootballRooms();
  pruneMissingTimers(raceTimers,code=>Boolean(crazyRooms.getRoom(code)),timer=>clearTimeout(timer));
  pruneMissingTimers(numberRaceTimers,code=>Boolean(numberRooms.getRoom(code)),timer=>clearTimeout(timer));
  pruneMissingTimers(footballKickTimers,code=>Boolean(footballRooms.getRoom(code)),timer=>clearTimeout(timer));
  roomInfrastructure.cleanup();
}, 15_000).unref();

if(serveWeb){
  app.setNotFoundHandler((request,reply)=>{
    if(request.method==="GET" && request.headers.accept?.includes("text/html")){
      return reply.type("text/html; charset=utf-8").sendFile("index.html");
    }
    return reply.code(404).send({ok:false,error:"Rota não encontrada."});
  });
}

const port=Number(process.env.PORT ?? 3001);
await app.listen({port,host:"0.0.0.0"});
