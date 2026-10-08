import { io } from "socket.io-client";

const base=(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const claim=async nickname=>{
  const response=await fetch(base+"/api/session/claim",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({nickname,gradeLevel:6})
  });
  assert(response.ok,"Falha ao iniciar sessão de "+nickname);
  return (await response.json()).session;
};
const openSocket=()=>new Promise((resolve,reject)=>{
  const socket=io(base,{transports:["websocket"],timeout:5000,reconnection:false});
  const timer=setTimeout(()=>reject(new Error("Socket.IO não conectou")),7000);
  socket.once("connect",()=>{clearTimeout(timer);resolve(socket);});
  socket.once("connect_error",error=>{clearTimeout(timer);reject(error);});
});
const send=(socket,name,payload)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("Timeout em "+name)),6000);
  socket.emit(name,payload,answer=>{clearTimeout(timer);resolve(answer);});
});
const auth=s=>({sessionId:s.sessionId,reconnectToken:s.reconnectToken});

const stamp=Date.now().toString(36).slice(-6);
const a=await claim("PropHost"+stamp);
const b=await claim("PropGuest"+stamp);
const host=await openSocket();
let guest=await openSocket();
try{
  const created=await send(host,"property:create-room",{...auth(a),pin:"007",mode:"short",shortRounds:8});
  assert(created.ok&&created.room?.status==="waiting","Host não criou sala");
  const code=created.room.code;
  const directory=await send(guest,"property:list-rooms",auth(b));
  assert(directory.ok&&directory.rooms?.some(r=>r.code===code),"Sala ausente da listagem pública");
  assert(!JSON.stringify(directory.rooms).includes("007"),"PIN exposto em lista pública");
  const denied=await send(guest,"property:join-room",{...auth(b),code,pin:"008"});
  assert(!denied.ok,"Senha incorreta foi aceita");
  const joined=await send(guest,"property:join-room",{...auth(b),code,pin:"007"});
  assert(joined.ok&&joined.room.members.length===2,"Segundo jogador não entrou");
  const forbiddenStart=await send(guest,"property:start",{...auth(b),code});
  assert(!forbiddenStart.ok,"Visitante conseguiu iniciar sala");
  const started=await send(host,"property:start",{...auth(a),code});
  assert(started.ok&&started.room.game?.players.length===2,"Criador não iniciou jogo sincronizado");
  assert(started.room.game.players.every(p=>p.kind==="human"),"Partida online contém NPC");
  const forbiddenRoll=await send(guest,"property:action",{...auth(b),code,action:"roll"});
  assert(!forbiddenRoll.ok,"Jogador fora da vez rolou dado");
  const rolled=await send(host,"property:action",{...auth(a),code,action:"roll"});
  assert(rolled.ok&&rolled.room.lastDie>=1&&rolled.room.lastDie<=6,"Dado não foi sorteado pelo servidor");
  assert(rolled.room.question?.id&&rolled.room.question?.expression,"Questão não foi entregue");
  assert(!("correctAnswer" in rolled.room.question),"Servidor expôs resposta antes do envio");
  const moved=await send(host,"property:action",{
    ...auth(a),code,action:"answer",questionId:rolled.room.question.id,
    answer:"999999",submissionId:"smoke-prop-001"
  });
  assert(moved.ok&&moved.room.lastResolution?.correct===false,"Resposta incorreta não foi processada");
  assert(moved.room.game?.phase==="turn-end","Movimento não concluiu o turno");
  const finished=await send(host,"property:action",{...auth(a),code,action:"end"});
  assert(finished.ok&&finished.room.game.activePlayerIndex===1,"Troca de turno não ocorreu");
  guest.close();
  await new Promise(resolve=>setTimeout(resolve,100));
  guest=await openSocket();
  const again=await send(guest,"property:reconnect-room",{...auth(b),code});
  assert(again.ok&&again.room.game.activePlayerIndex===1,"Reconexão não recuperou partida");
  const left=await send(guest,"property:leave",{...auth(b),code});
  assert(left.ok&&left.room?.status==="finished","Abandono não encerrou disputa com dois jogadores");
  console.log("Smoke de Banco Imobiliário multiplayer OK:",base);
}finally{host.close();guest.close();}
