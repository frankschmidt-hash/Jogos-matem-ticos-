import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { claimNicknameSchema, disconnectSchema, heartbeatSchema, reconnectSchema } from "@jogos/protocol";
import { SessionManager } from "./session-manager";

const app = Fastify({ logger: true, bodyLimit: 16_384 });
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
await app.register(cors, { origin: webOrigin, methods:["GET","POST"] });

const manager = new SessionManager(
  Number(process.env.SESSION_RECONNECT_GRACE_MS ?? 30_000),
  Number(process.env.SESSION_TTL_MS ?? 90_000)
);

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
io.on("connection", socket => {
  socket.on("session:heartbeat", (payload, ack) => {
    const parsed=heartbeatSchema.safeParse(payload);
    if(!parsed.success) return ack?.({ok:false,error:"Payload inválido."});
    try { ack?.({ok:true,session:manager.heartbeat(parsed.data.sessionId,parsed.data.reconnectToken)}); }
    catch { ack?.({ok:false,error:"Sessão inválida ou expirada."}); }
  });
});

setInterval(() => manager.cleanup(), 15_000).unref();
const port=Number(process.env.PORT ?? 3001);
await app.listen({port,host:"0.0.0.0"});
