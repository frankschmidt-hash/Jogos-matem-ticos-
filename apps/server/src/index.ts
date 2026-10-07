import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import {
  claimNicknameSchema, crazyAnswerSchema, crazyBombAnswerSchema, crazyBombSchema,
  crazyCreateRoomSchema, crazyJoinRoomSchema, crazyRoomActionSchema,
  disconnectSchema, heartbeatSchema, reconnectSchema
} from "@jogos/protocol";
import { SessionManager } from "./session-manager";
import { CrazyRaceRoomManager } from "./crazy-race-room-manager";

const app = Fastify({ logger: true, bodyLimit: 16_384 });
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
await app.register(cors, { origin: webOrigin, methods:["GET","POST"] });

const manager = new SessionManager(
  Number(process.env.SESSION_RECONNECT_GRACE_MS ?? 30_000),
  Number(process.env.SESSION_TTL_MS ?? 90_000)
);
const crazyRooms=new CrazyRaceRoomManager();

app.get("/health", async () => ({ ok:true, service:"jogos-matematicos-server" }));

app.post("/api/session/claim", async (request, reply) => {
  const parsed = claimNicknameSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ok:false,error:"Dados de entrada inválidos."});
  try { return {ok:true, session:manager.claim(parsed.data.nickname, parsed.data.gradeLevel)}; }
  catch (error) { return reply.code(409).send({ok:false,error:error instanceof Error?error.message:"Não foi possível entrar."}); }
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

const io = new Server(app.server, { cors:{origin:webOrigin,methods:["GET","POST"]} });
const sessionSockets=new Map<string,string>();
const raceTimers=new Map<string,ReturnType<typeof setTimeout>>();

type Ack=(response:unknown)=>void;

const errorMessage=(error:unknown)=>error instanceof Error?error.message:"Operação não concluída.";

const emitCrazyState=(code:string)=>{
  const room=crazyRooms.getRoom(code);
  if(!room) return;
  io.to("crazy:"+code).emit("crazy:room-state",crazyRooms.publicSnapshot(code));
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
      if(resolved.status==="playing" && resolved.race?.phase==="round-resolution"){
        const next=setTimeout(()=>{
          try{
            crazyRooms.openNextRound(code,Date.now());
            emitCrazyState(code);
            scheduleRaceRound(code);
          }catch(error){
            app.log.error({err:error,code},"Falha ao abrir próxima rodada da Corrida Maluca");
          }
        },1200);
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

  socket.on("crazy:create-room",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyCreateRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Dados da sala inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.createRoom({
        sessionId:session.sessionId,nickname:session.nickname,gradeLevel:session.gradeLevel,connected:true
      },parsed.data.password);
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.crazyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("crazy:"+room.code);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code)});
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("crazy:join-room",(payload:unknown,ack?:Ack)=>{
    const parsed=crazyJoinRoomSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Código ou senha inválidos."});
    try{
      const session=manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken);
      const room=crazyRooms.joinRoom(parsed.data.code.toUpperCase(),parsed.data.password,{
        sessionId:session.sessionId,nickname:session.nickname,gradeLevel:session.gradeLevel,connected:true
      });
      sessionSockets.set(session.sessionId,socket.id);
      socket.data.crazyCode=room.code;
      socket.data.sessionId=session.sessionId;
      void socket.join("crazy:"+room.code);
      emitCrazyState(room.code);
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
        bombQuestion:crazyRooms.bombQuestionFor(room.code,session.sessionId)
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
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.direction
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
      const room=crazyRooms.submitBombAnswer(
        parsed.data.code.toUpperCase(),session.sessionId,parsed.data.questionId,parsed.data.answer
      );
      emitCrazyState(room.code);
      ack?.({ok:true,room:crazyRooms.publicSnapshot(room.code)});
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
        bombQuestion:crazyRooms.bombQuestionFor(parsed.data.code.toUpperCase(),session.sessionId)
      });
    }catch(error){
      ack?.({ok:false,error:errorMessage(error)});
    }
  });

  socket.on("disconnect",()=>{
    const sessionId=socket.data.sessionId as string|undefined;
    const code=socket.data.crazyCode as string|undefined;
    if(sessionId && sessionSockets.get(sessionId)===socket.id) sessionSockets.delete(sessionId);
    if(sessionId && code){
      crazyRooms.disconnect(code,sessionId);
      emitCrazyState(code);
    }
  });
});

setInterval(() => {
  manager.cleanup();
  crazyRooms.cleanup();
}, 15_000).unref();

const port=Number(process.env.PORT ?? 3001);
await app.listen({port,host:"0.0.0.0"});
