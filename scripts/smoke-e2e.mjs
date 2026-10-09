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

// A verificação externa é estritamente de leitura. Não criar usuários nem
// partidas no servidor real: corridas abertas acabam poluindo o Top 10.
if(process.env.DEPLOYED_VERSION_SMOKE==="true"){
  const response=await fetch(base+"/api/leaderboards",{headers:{accept:"application/json"}});
  assert(response.ok,"Ranking público não respondeu 2xx");
  const payload=await response.json();
  assert(payload.ok===true&&payload.rankings,"Ranking público inválido");
  for(const game of ["property-math","crazy-race","number-race","math-football"]){
    assert(Array.isArray(payload.rankings[game]),"Ranking ausente: "+game);
  }
  console.log("Smoke público somente leitura OK:",base);
  process.exit(0);
}

const first=await post("/api/session/claim",{nickname:"ReleaseA"+unique,gradeLevel:process.env.DEPLOYED_VERSION_SMOKE==="true"?5:8});
assert(first.response.ok&&first.data.session,"falha ao criar sessão A");
const duplicate=await post("/api/session/claim",{nickname:" releasea"+unique+" ",gradeLevel:6});
assert(duplicate.response.status===409,"nickname duplicado não foi rejeitado");
const second=await post("/api/session/claim",{nickname:"ReleaseB"+unique,gradeLevel:process.env.DEPLOYED_VERSION_SMOKE==="true"?6:9});
assert(second.response.ok&&second.data.session,"falha ao criar sessão B");
// Em smoke de versão publicada antiga não exigir ainda os novos anos.
if(process.env.DEPLOYED_VERSION_SMOKE!=="true"){
  assert(first.data.session.gradeLevel===8,"5º a 9º: sessão de 8º ano não persistiu");
  assert(second.data.session.gradeLevel===9,"5º a 9º: sessão de 9º ano não persistiu");
}

const a=first.data.session,b=second.data.session;
const host=await connect();
let guest=await connect();

async function createJoinStart(prefix,createEvent,joinEvent,startEvent,extraCreate={}){
  let roomPassword=createEvent==="football:create-room"?"358":password;
  let created=await ack(host,createEvent,{...auth(a),password:roomPassword,...extraCreate});
  // Published-URL smoke can point to either side of the PIN migration.
  if(!created?.ok&&createEvent==="football:create-room"&&process.env.DEPLOYED_VERSION_SMOKE==="true"){
    roomPassword=password;
    created=await ack(host,createEvent,{...auth(a),password:roomPassword,...extraCreate});
  }
  assert(created?.ok&&created.room?.code,prefix+": criação de sala falhou");
  const code=created.room.code;
  const credential=createEvent==="crazy:create-room"&&created.pin?{pin:created.pin}:{password:roomPassword};
  const joined=await ack(guest,joinEvent,{...auth(b),code,...credential});
  assert(joined?.ok,prefix+": entrada do segundo jogador falhou");
  const started=await ack(host,startEvent,{...auth(a),code});
  assert(started?.ok&&started.room?.question,prefix+": partida/questão não iniciou");
  return {code,room:started.room};
}

const crazy=await createJoinStart("Corrida Maluca","crazy:create-room","crazy:join-room","crazy:start");
assert(crazy.room.race?.racers?.length===6,"Corrida Maluca não iniciou com 6 competidores");
const crazyWindow=crazy.room.question.deadlineAt-crazy.room.question.startedAt;
const validCrazyWindows=process.env.DEPLOYED_VERSION_SMOKE==="true"?[300000,20000]:[300000];
assert(validCrazyWindows.includes(crazyWindow),"Corrida Maluca sem cronômetro de 5 minutos");
if(crazyWindow===300000){
  const firstQuestion=crazy.room.question;
  const response=await ack(host,"crazy:answer",{...auth(a),code:crazy.code,questionId:firstQuestion.id,answer:"0",clientSubmissionId:"crazy-continuous-01"});
  assert(response?.ok&&response.room?.question?.id!==firstQuestion.id,"Corrida Maluca não gerou próxima conta imediatamente");
}

const number=await createJoinStart("Corrida Numérica","number:create-room","number:join-room","number:start",{gradeLevel:"mixed"});
assert(number.room.race?.racers?.length===6,"Corrida Numérica não iniciou com 6 competidores");
const numberTimeWindow=number.room.question.deadlineAt-number.room.question.startedAt;
const allowedNumberDurations=process.env.DEPLOYED_VERSION_SMOKE==="true"?[300000,10000]:[300000];
assert(allowedNumberDurations.includes(numberTimeWindow),"Corrida Numérica sem relógio de 5 minutos");
if(numberTimeWindow===300000){
  const firstQuestion=number.room.question;
  const firstResponse=await ack(host,"number:answer",{...auth(a),code:number.code,questionId:firstQuestion.id,answer:"0",clientSubmissionId:"number-continuous-01"});
  assert(firstResponse?.ok && firstResponse.room?.question?.id!==firstQuestion.id,"Corrida Numérica não gerou outra questão imediatamente");
}

guest.close();
await new Promise(r=>setTimeout(r,150));
guest=await connect();
const reconnected=await ack(guest,"number:reconnect-room",{...auth(b),code:number.code});
assert(reconnected?.ok&&reconnected.room?.code===number.code,"reconexão da Corrida Numérica falhou");

const football=await createJoinStart("Futebol Matemático","football:create-room","football:join-room","football:start",{gradeLevel:process.env.DEPLOYED_VERSION_SMOKE==="true"?6:9});
assert(football.room.members?.length===2,"Futebol não iniciou PvP com dois humanos");
assert(football.room.question.deadlineAt!==null,"Futebol online sem deadline");
if(process.env.DEPLOYED_VERSION_SMOKE!=="true"){
  assert(football.room.gradeLevel===9,"Futebol online não preservou 9º ano");
  assert(number.room.gradeLevel==="mixed","Corrida Numérica não preservou modo misto");
}

host.close();
guest.close();
console.log("Smoke E2E OK:",base);
