import { io } from "socket.io-client";

const base=(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const unique=Date.now().toString(36).slice(-6);
const password="4321";

const assert=(condition,message)=>{ if(!condition) throw new Error(message); };
const post=async(path,body)=>{
  const response=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  let data={};
  try{ data=await response.json(); }catch{}
  return {response,data};
};
const connect=()=>new Promise((resolve,reject)=>{
  const socket=io(base,{transports:["websocket"],timeout:5000,reconnection:false});
  const timer=setTimeout(()=>{socket.close();reject(new Error("Timeout conectando Socket.IO"));},7000);
  socket.once("connect",()=>{clearTimeout(timer);resolve(socket);});
  socket.once("connect_error",error=>{clearTimeout(timer);reject(error);});
});
const ack=(socket,event,payload)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("Timeout no evento "+event)),7000);
  socket.emit(event,payload,response=>{clearTimeout(timer);resolve(response);});
});
const auth=session=>({sessionId:session.sessionId,reconnectToken:session.reconnectToken});

const health=await fetch(base+"/health");
assert(health.ok,"/health não respondeu 2xx");
assert((await health.json()).ok===true,"/health retornou payload inválido");

for(const route of ["/","/lobby","/game/property-math","/game/crazy-race","/game/number-race","/game/math-football"]){
  const response=await fetch(base+route,{headers:{accept:"text/html"}});
  assert(response.ok,route+" não respondeu 2xx");
  const html=await response.text();
  assert(html.includes('id="root"'),route+" não retornou o shell React");
  assert(response.headers.get("content-security-policy"),route+" sem CSP");
}

const first=await post("/api/session/claim",{nickname:"ReleaseA"+unique,gradeLevel:5});
assert(first.response.ok&&first.data.session,"falha ao criar sessão A");
const duplicate=await post("/api/session/claim",{nickname:" releasea"+unique+" ",gradeLevel:6});
assert(duplicate.response.status===409,"nickname duplicado não foi rejeitado");
const second=await post("/api/session/claim",{nickname:"ReleaseB"+unique,gradeLevel:6});
assert(second.response.ok&&second.data.session,"falha ao criar sessão B");

const a=first.data.session,b=second.data.session;
const host=await connect();
let guest=await connect();

async function createJoinStart(prefix,createEvent,joinEvent,startEvent,extraCreate={}){
  const created=await ack(host,createEvent,{...auth(a),password,...extraCreate});
  assert(created?.ok&&created.room?.code,prefix+": criação de sala falhou");
  const code=created.room.code;
  const joined=await ack(guest,joinEvent,{...auth(b),code,password});
  assert(joined?.ok,prefix+": entrada do segundo jogador falhou");
  const started=await ack(host,startEvent,{...auth(a),code});
  assert(started?.ok&&started.room?.question,prefix+": partida/questão não iniciou");
  return {code,room:started.room};
}

const crazy=await createJoinStart("Corrida Maluca","crazy:create-room","crazy:join-room","crazy:start");
assert(crazy.room.race?.racers?.length===6,"Corrida Maluca não iniciou com 6 competidores");
assert(crazy.room.question.deadlineAt-crazy.room.question.startedAt===20000,"Corrida Maluca sem janela de 20s");

const number=await createJoinStart("Corrida Numérica","number:create-room","number:join-room","number:start",{gradeLevel:"mixed"});
assert(number.room.race?.racers?.length===6,"Corrida Numérica não iniciou com 6 competidores");
assert(number.room.question.deadlineAt-number.room.question.startedAt===20000,"Corrida Numérica sem janela de 20s");

guest.close();
await new Promise(r=>setTimeout(r,150));
guest=await connect();
const reconnected=await ack(guest,"number:reconnect-room",{...auth(b),code:number.code});
assert(reconnected?.ok&&reconnected.room?.code===number.code,"reconexão da Corrida Numérica falhou");

const football=await createJoinStart("Futebol Matemático","football:create-room","football:join-room","football:start",{gradeLevel:6});
assert(football.room.members?.length===2,"Futebol não iniciou PvP com dois humanos");
assert(football.room.question.deadlineAt!==null,"Futebol online sem deadline");

host.close();
guest.close();
console.log("Smoke E2E OK:",base);
