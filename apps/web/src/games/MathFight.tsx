import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import type { ClientSession } from "../session";
import { FighterFigure, type FighterPose } from "./FighterFigure";
import "./math-fight.css";

type Style = "Boxe" | "Muay Thai" | "Capoeira" | "Karatê" | "Jiu-jítsu" | "Luta de rua";
type Fighter = { name: string; style: Style; color: string; coins: number; wins: number; losses: number; level: number; xp: number; gloves: number };
type Phase = "setup" | "playing" | "finished";
type Target = "Cabeça" | "Tronco" | "Pernas";
const STYLES: Style[] = ["Boxe","Muay Thai","Capoeira","Karatê","Jiu-jítsu","Luta de rua"];
const DEFAULT = (nickname:string):Fighter=>({name:nickname,style:"Boxe",color:"#514bc8",coins:0,wins:0,losses:0,level:1,xp:0,gloves:0});
const profileKey=(nickname:string)=>"jogos-math-fight-v1:"+nickname.trim().toLowerCase();
function readProfile(nickname:string):Fighter {
  try {
    const raw=localStorage.getItem(profileKey(nickname));
    if (!raw) return DEFAULT(nickname);
    const data=JSON.parse(raw) as Partial<Fighter>;
    return {...DEFAULT(nickname),...data,name:typeof data.name==="string"?data.name.slice(0,20):nickname,
      style:STYLES.includes(data.style as Style)?data.style as Style:"Boxe",
      color:["#514bc8","#138a81","#c25840","#9946a7"].includes(data.color||"")?data.color!:"#514bc8",
      coins:Math.max(0,Number(data.coins)||0),wins:Math.max(0,Number(data.wins)||0),
      losses:Math.max(0,Number(data.losses)||0),level:Math.max(1,Number(data.level)||1),
      xp:Math.max(0,Number(data.xp)||0),gloves:Math.min(3,Math.max(0,Number(data.gloves)||0))};
  } catch {return DEFAULT(nickname);}
}
function newQuestion(grade:ClientSession["gradeLevel"]):MathQuestion {
  return generateQuestion(grade,{difficulty:1,seed:crypto.randomUUID()});
}
const limitDamage=(secondsLeft:number,total:number,gloves:number)=>
  Math.min(30,12+Math.floor(12*Math.max(0,secondsLeft)/total)+gloves*2);
export function MathFight({session}:{session:ClientSession}) {
  const [fighter,setFighter]=useState<Fighter>(()=>readProfile(session.nickname));
  const [phase,setPhase]=useState<Phase>("setup");
  const [previewPose,setPreviewPose]=useState<FighterPose>("idle");
  const [duration,setDuration]=useState(30);
  const [playerHp,setPlayerHp]=useState(100);
  const [cpuHp,setCpuHp]=useState(100);
  const [turn,setTurn]=useState<"attack"|"defend">("attack");
  const [question,setQuestion]=useState(()=>newQuestion(session.gradeLevel));
  const [answer,setAnswer]=useState("");
  const [target,setTarget]=useState<Target>("Tronco");
  const [remaining,setRemaining]=useState(30);
  const [feedback,setFeedback]=useState("Responda corretamente para acertar!");
  const [animation,setAnimation]=useState("idle");
  const [result,setResult]=useState<"victory"|"defeat"|null>(null);
  const deadline=useRef(0);
  const handled=useRef(false);
  const phaseRef=useRef(phase);
  const turnRef=useRef(turn);
  const questionRef=useRef(question);
  const playerHpRef=useRef(playerHp);
  const cpuHpRef=useRef(cpuHp);
  const fighterRef=useRef(fighter);
  phaseRef.current=phase;turnRef.current=turn;questionRef.current=question;
  playerHpRef.current=playerHp;cpuHpRef.current=cpuHp;fighterRef.current=fighter;

  useEffect(()=>{localStorage.setItem(profileKey(session.nickname),JSON.stringify(fighter));},[fighter,session.nickname]);
  function beginTurn(next:"attack"|"defend") {
    handled.current=false;
    setAnswer("");setTurn(next);turnRef.current=next;
    const q=newQuestion(session.gradeLevel);setQuestion(q);questionRef.current=q;
    deadline.current=Date.now()+duration*1000;setRemaining(duration);
    setFeedback(next==="attack"?"Sua vez: resolva para atacar!":"Defenda-se: resolva para bloquear!");
    setAnimation("idle");
  }
  function finish(victory:boolean) {
    handled.current=true;setResult(victory?"victory":"defeat");setPhase("finished");phaseRef.current="finished";
    setFeedback(victory?"Vitória! Você venceu a luta.":"Fim de luta! Treine e tente novamente.");
    setFighter(old=>{
      const xp=old.xp+(victory?100:30);
      const gainedLevels=Math.floor(xp/300);
      return {...old,coins:old.coins+(victory?100:20),wins:old.wins+(victory?1:0),
        losses:old.losses+(victory?0:1),level:old.level+gainedLevels,xp:xp%300};
    });
  }
  function resolve(raw:string,timeout=false) {
    if(phaseRef.current!=="playing"||handled.current)return;
    const left=Math.max(0,(deadline.current-Date.now())/1000);
    if(!timeout&&left<=0)timeout=true;
    handled.current=true;
    const correct=!timeout&&validateAnswer(questionRef.current,raw);
    const currentTurn=turnRef.current;
    if(currentTurn==="attack"){
      const damage=correct?limitDamage(left,duration,fighterRef.current.gloves):0;
      const newHp=Math.max(0,cpuHpRef.current-damage);
      setCpuHp(newHp);cpuHpRef.current=newHp;
      setAnimation(correct?"strike":"block");
      setFeedback(correct?`Acertou! Golpe no(a) ${target}: -${damage} HP.`:
        timeout?`Tempo esgotado! Resposta: ${questionRef.current.correctAnswer}.`:
        `Golpe defendido! Resposta: ${questionRef.current.correctAnswer}.`);
      if(newHp===0){finish(true);return;}
    }else{
      const damage=correct?0:14;
      const newHp=Math.max(0,playerHpRef.current-damage);
      setPlayerHp(newHp);playerHpRef.current=newHp;
      setAnimation(correct?"block":"hit");
      setFeedback(correct?"Defesa perfeita! Nenhum dano recebido.":
        `Defesa falhou: -${damage} HP. Resposta: ${questionRef.current.correctAnswer}.`);
      if(newHp===0){finish(false);return;}
    }
    // A pequena pausa exibe o resultado antes de iniciar outra questão.
    window.setTimeout(()=>{
      if(phaseRef.current==="playing")beginTurn(currentTurn==="attack"?"defend":"attack");
    },1400);
  }
  useEffect(()=>{
    if(phase!=="playing")return;
    const timer=window.setInterval(()=>{
      if(handled.current)return;
      const left=Math.max(0,(deadline.current-Date.now())/1000);
      setRemaining(Math.ceil(left));
      if(left<=0)resolve("",true);
    },100);
    return ()=>window.clearInterval(timer);
  },[phase,duration,turn,question.id]);
  function start(){
    setPlayerHp(100);setCpuHp(100);playerHpRef.current=100;cpuHpRef.current=100;
    setResult(null);setPhase("playing");phaseRef.current="playing";beginTurn("attack");
  }
  function submit(e:FormEvent){e.preventDefault();resolve(answer);}
  function buyGloves(){
    setFighter(old=>old.gloves>=3||old.coins<(old.gloves+1)*150?old:
      {...old,coins:old.coins-(old.gloves+1)*150,gloves:old.gloves+1});
  }
  const playerPose:FighterPose = animation==="idle"?"idle":turn==="attack"?"step":animation==="hit"?"hit":"block";
  const cpuPose:FighterPose = animation==="idle"?"idle":turn==="attack"?(animation==="strike"?"hit":"block"):"step";
  return <main id="main-content" className="fight-shell">
    <header className="fight-top"><Link className="button button-secondary" to="/lobby">← Voltar aos jogos</Link>
      <div><span className="eyebrow">Quinto jogo · Matemática em Movimento</span><h1>Luta Matemática</h1></div>
      <strong>{fighter.coins} moedas</strong></header>
    {phase==="setup"?<section className="fight-setup">
      <div className="fight-panel"><h2>Meu lutador</h2>
        <label>Nome do lutador<input maxLength={20} value={fighter.name} onChange={e=>setFighter(f=>({...f,name:e.target.value}))}/></label>
        <label>Arte marcial<select value={fighter.style} onChange={e=>setFighter(f=>({...f,style:e.target.value as Style}))}>
          {STYLES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Cor do uniforme<select value={fighter.color} onChange={e=>setFighter(f=>({...f,color:e.target.value}))}>
          <option value="#514bc8">Azul</option><option value="#138a81">Verde</option>
          <option value="#c25840">Vermelho</option><option value="#9946a7">Roxo</option></select></label>
        <p>Nível {fighter.level} · XP {fighter.xp}/300 · Vitórias {fighter.wins} · Derrotas {fighter.losses}</p>
        <div className="fight-preview"><FighterFigure color={fighter.color} pose={previewPose} label="Prévia do lutador personalizado"/></div>
        <div className="fight-pose-picker" role="group" aria-label="Visualizar posturas do lutador">
          {([{pose:"idle",name:"Guarda"},{pose:"step",name:"Avanço"},{pose:"block",name:"Bloqueio"}] as const).map(item=><button
            type="button" key={item.pose} className={previewPose===item.pose?"fight-pose-active":"button-secondary"} aria-pressed={previewPose===item.pose}
            onClick={()=>setPreviewPose(item.pose)}>{item.name}</button>)}
        </div>
      </div>
      <div className="fight-panel"><h2>Preparar combate</h2>
        <p>Questões do <strong>{session.gradeLevel==="mixed"?"modo misto":session.gradeLevel+"º ano"}</strong>, compartilhado com o portal.</p>
        <label>Tempo por golpe<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>
          {[20,30,40,60].map(n=><option value={n} key={n}>{n} segundos</option>)}</select></label>
        <p>Resposta certa: acerta. Resposta errada ou fora do prazo: golpe defendido. Respostas rápidas causam mais dano.</p>
        <button onClick={start}>Iniciar luta contra o computador</button>
        <h3>Loja de equipamentos</h3>
        <p>Luvas +{fighter.gloves} · Bônus de {fighter.gloves*2} de dano · Máximo +3</p>
        <button className="button-secondary" disabled={fighter.gloves>=3||fighter.coins<(fighter.gloves+1)*150} onClick={buyGloves}>
          {fighter.gloves>=3?"Luvas no nível máximo":`Melhorar luvas · ${(fighter.gloves+1)*150} moedas`}
        </button>
        <p className="muted">Primeira fase: modo solo disponível. Multiplayer e campeonatos ainda não estão implementados.</p>
      </div>
    </section>:<section className="fight-panel fight-battle">
      <div className="fight-health">
        <div><strong>{fighter.name||session.nickname}</strong><span> {playerHp}/100 HP</span><progress max={100} value={playerHp}/></div>
        <div><strong>Desafiante CPU</strong><span> {cpuHp}/100 HP</span><progress max={100} value={cpuHp}/></div>
      </div>
      <div className="fight-arena"><FighterFigure color={fighter.color} pose={playerPose} label="Seu lutador"/>
        <span className="fight-versus">VS</span><FighterFigure color="#de7651" enemy pose={cpuPose} label="Desafiante CPU"/></div>
      {phase==="playing"?<div className="fight-math">
        <p className="eyebrow">{turn==="attack"?"Seu ataque":"Defesa contra a CPU"}</p>
        <strong className="fight-timer" aria-live="off">{remaining}s</strong>
        <div className="math-expression">{question.expression} = ?</div>
        {turn==="attack"&&<fieldset className="fight-targets"><legend>Mira do golpe</legend>
          {(["Cabeça","Tronco","Pernas"] as Target[]).map(t=><label key={t}>
            <input type="radio" checked={target===t} onChange={()=>setTarget(t)}/>{t}</label>)}</fieldset>}
        <form onSubmit={submit} className="fight-answer"><input aria-label="Resposta matemática" inputMode="decimal" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={handled.current} placeholder="Sua resposta"/>
          <button disabled={handled.current||!answer.trim()}>Confirmar</button></form>
      </div>:<div className="fight-math"><h2>{result==="victory"?"Vitória!":"Derrota!"}</h2><p>{result==="victory"?"Você ganhou 100 moedas e 100 XP.":"Você ganhou 20 moedas e 30 XP pela participação."}</p>
        <button onClick={start}>Nova luta</button><button className="button-secondary" onClick={()=>setPhase("setup")}>Meu lutador e loja</button></div>}
      <p className="fight-feedback" role="status">{feedback}</p>
    </section>}
  </main>;
}
