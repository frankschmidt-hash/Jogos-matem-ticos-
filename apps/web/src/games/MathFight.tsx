import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { generateQuestion, validateAnswer, type MathQuestion } from "@jogos/math-engine";
import type { ClientSession } from "../session";
import { FighterFigure, type FighterPose } from "./FighterFigure";
import { FIGHTER_STYLES, resolveFighterStyle, type FighterStyle } from "./fighter-styles";
import { FightStage, type ArenaImpact } from "./FightStage";
import { FightHud } from "./FightHud";
import { createImpactCue, exchangeTotalDuration, IMPACT_EFFECT_MS } from "./fight-impact";
import { playSound } from "../experience";
import { planExchange, EXCHANGE_DURATION_MS, RECOVERY_DURATION_MS } from "./fight-choreography";
import "./math-fight.css";
import "./math-fight-phase4.css";

type Style = FighterStyle;
type Fighter = { name: string; style: Style; color: string; coins: number; wins: number; losses: number; level: number; xp: number; gloves: number };
type Phase = "setup" | "playing" | "finished";
type Target = "Cabeça" | "Tronco" | "Pernas";
const STYLES = FIGHTER_STYLES;
const DEFAULT = (nickname:string):Fighter=>({name:nickname,style:"Boxe",color:"#514bc8",coins:0,wins:0,losses:0,level:1,xp:0,gloves:0});
const profileKey=(nickname:string)=>"jogos-math-fight-v1:"+nickname.trim().toLowerCase();
function readProfile(nickname:string):Fighter {
  try {
    const raw=localStorage.getItem(profileKey(nickname));
    if (!raw) return DEFAULT(nickname);
    const data=JSON.parse(raw) as Partial<Fighter>;
    return {...DEFAULT(nickname),...data,name:typeof data.name==="string"?data.name.slice(0,20):nickname,
      style:resolveFighterStyle(data.style),
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
  const [duration,setDuration]=useState(30);
  const [playerHp,setPlayerHp]=useState(100);
  const [cpuHp,setCpuHp]=useState(100);
  const [turn,setTurn]=useState<"attack"|"defend">("attack");
  const [question,setQuestion]=useState(()=>newQuestion(session.gradeLevel));
  const [answer,setAnswer]=useState("");
  const [target,setTarget]=useState<Target>("Tronco");
  const [remaining,setRemaining]=useState(30);
  const [feedback,setFeedback]=useState("Responda corretamente para acertar!");
  const [feedbackTone,setFeedbackTone]=useState<"neutral"|"correct"|"blocked"|"timeout"|"damage">("neutral");
  const [motion,setMotion]=useState<{player:FighterPose;cpu:FighterPose;caption:string;seq:number}>({
    player:"idle",cpu:"idle",caption:"",seq:0
  });
  const [result,setResult]=useState<"victory"|"defeat"|null>(null);
  const [impact,setImpact]=useState<ArenaImpact|null>(null);
  const deadline=useRef(0);
  const handled=useRef(false);
  const phaseRef=useRef(phase);
  const turnRef=useRef(turn);
  const questionRef=useRef(question);
  const playerHpRef=useRef(playerHp);
  const cpuHpRef=useRef(cpuHp);
  const fighterRef=useRef(fighter);
  const visualSeq=useRef(0);
  const cpuAttackCount=useRef(0);
  const matchId=useRef(0);
  const animationTimers=useRef<number[]>([]);
  phaseRef.current=phase;turnRef.current=turn;questionRef.current=question;
  playerHpRef.current=playerHp;cpuHpRef.current=cpuHp;fighterRef.current=fighter;

  useEffect(()=>{localStorage.setItem(profileKey(session.nickname),JSON.stringify(fighter));},[fighter,session.nickname]);

  // Evita que coreografias atrasadas afetem outra luta ou a tela de configuração.
  function clearAnimationTimers() {
    animationTimers.current.forEach(id=>window.clearTimeout(id));
    animationTimers.current=[];
  }
  function queueMotion(delay:number, callback:()=>void) {
    const currentMatch=matchId.current;
    const id=window.setTimeout(()=>{
      animationTimers.current=animationTimers.current.filter(item=>item!==id);
      if(matchId.current===currentMatch)callback();
    },delay);
    animationTimers.current.push(id);
  }
  useEffect(()=>()=>{matchId.current++;animationTimers.current.forEach(id=>window.clearTimeout(id));animationTimers.current=[];},[]);
  function showMotion(player:FighterPose,cpu:FighterPose,caption="") {
    setMotion({player,cpu,caption,seq:++visualSeq.current});
  }
  function beginTurn(next:"attack"|"defend") {
    handled.current=false;
    setAnswer("");setTurn(next);turnRef.current=next;
    const q=newQuestion(session.gradeLevel);setQuestion(q);questionRef.current=q;
    deadline.current=Date.now()+duration*1000;setRemaining(duration);
    setFeedback(next==="attack"?"Sua vez: resolva para atacar!":"Defenda-se: resolva para bloquear!");
    setFeedbackTone("neutral");
    setImpact(null);
    showMotion("idle","idle");
  }
  function finish(victory:boolean) {
    handled.current=true;setResult(victory?"victory":"defeat");setPhase("finished");phaseRef.current="finished";
    setFeedback(victory?"Vitória! Você venceu a luta.":"Fim de luta! Treine e tente novamente.");
    setFeedbackTone(victory?"correct":"damage");
    setImpact(null);
    showMotion(victory?"victory":"defeat",victory?"defeat":"victory",victory?"VITÓRIA":"FIM DE LUTA");
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
    setFeedbackTone(timeout?"timeout":currentTurn==="attack"?(correct?"correct":"blocked"):(correct?"blocked":"damage"));
    let damage=0;
    let winner:"player"|"cpu"|null=null;
    let nextHp=100;
    if(currentTurn==="attack"){
      damage=correct?limitDamage(left,duration,fighterRef.current.gloves):0;
      nextHp=Math.max(0,cpuHpRef.current-damage);
      setFeedback(correct?`Acertou! Golpe no(a) ${target}: -${damage} HP.`:
        timeout?`Tempo esgotado! Resposta: ${questionRef.current.correctAnswer}.`:
        `Golpe defendido! Resposta: ${questionRef.current.correctAnswer}.`);
      if(nextHp===0)winner="player";
    }else{
      damage=correct?0:14;
      nextHp=Math.max(0,playerHpRef.current-damage);
      setFeedback(correct?"Defesa perfeita! Nenhum dano recebido.":
        `Defesa falhou: -${damage} HP. Resposta: ${questionRef.current.correctAnswer}.`);
      if(nextHp===0)winner="cpu";
    }

    // A resposta e o dano são calculados uma vez. A barra de HP só muda
    // quando o golpe chega ao alvo (sem alterar a pontuação ou os valores).
    const exchange=planExchange({
      turn:currentTurn,correct,timedOut:timeout,target,damage,
      cpuAttackCount:cpuAttackCount.current
    });
    if(currentTurn==="defend")cpuAttackCount.current++;
    const cue=createImpactCue(exchange,currentTurn,target);
    const reducedMotion=document.documentElement.classList.contains("reduce-motion")
      ||window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hitStopMs=cue&&!reducedMotion?cue.hitStopMs:0;
    showMotion(exchange.player,exchange.cpu,cue?"":exchange.caption);
    setImpact(null);

    if(cue){
      const settledHp=nextHp;
      const settledDamage=damage;
      queueMotion(cue.contactAtMs,()=>{
        if(phaseRef.current!=="playing")return;
        // Este é o único momento em que o dano entra nas barras.
        if(settledDamage>0){
          if(cue.defender==="cpu"){
            cpuHpRef.current=settledHp;setCpuHp(settledHp);
          }else{
            playerHpRef.current=settledHp;setPlayerHp(settledHp);
          }
        }
        setImpact({cue,damage:settledDamage,frozen:hitStopMs>0});
        playSound(cue.blocked?"fight-block":"fight-hit");
        if(hitStopMs>0){
          queueMotion(hitStopMs,()=>{
            setImpact(previous=>previous?{...previous,frozen:false}:null);
          });
        }
        queueMotion(hitStopMs+IMPACT_EFFECT_MS,()=>setImpact(null));
      });
    }

    const endResult=winner;
    queueMotion(exchangeTotalDuration(EXCHANGE_DURATION_MS,cue,reducedMotion),()=>{
      if(phaseRef.current!=="playing")return;
      if(endResult){
        finish(endResult==="player");
        return;
      }
      setImpact(null);
      showMotion("retreat","retreat","Recompondo a guarda");
      queueMotion(RECOVERY_DURATION_MS,()=>{
        if(phaseRef.current==="playing")beginTurn(currentTurn==="attack"?"defend":"attack");
      });
    });
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
    clearAnimationTimers();matchId.current++;cpuAttackCount.current=0;setImpact(null);
    setPlayerHp(100);setCpuHp(100);playerHpRef.current=100;cpuHpRef.current=100;
    setResult(null);setPhase("playing");phaseRef.current="playing";beginTurn("attack");
  }
  function backToSetup(){
    clearAnimationTimers();matchId.current++;setImpact(null);
    setPhase("setup");phaseRef.current="setup";
    showMotion("idle","idle");
  }
  function submit(e:FormEvent){e.preventDefault();resolve(answer);}
  function buyGloves(){
    setFighter(old=>old.gloves>=3||old.coins<(old.gloves+1)*150?old:
      {...old,coins:old.coins-(old.gloves+1)*150,gloves:old.gloves+1});
  }
  return <main id="main-content" className="fight-shell">
    <header className="fight-top"><Link className="button button-secondary" to="/lobby">← Voltar aos jogos</Link>
      <div><span className="eyebrow">Quinto jogo · Matemática em Movimento</span><h1>Luta Matemática</h1></div>
      <div className="fight-top-coins"><small>MOEDAS DE COMBATE</small><strong>{fighter.coins.toLocaleString("pt-BR")} ◈</strong></div></header>
    {phase==="setup"?<section className="fight-setup">
      <div className="fight-panel"><h2>Meu lutador</h2>
        <label>Nome do lutador<input maxLength={20} value={fighter.name} onChange={e=>setFighter(f=>({...f,name:e.target.value}))}/></label>
        <label>Arte marcial<select value={fighter.style} onChange={e=>setFighter(f=>({...f,style:e.target.value as Style}))}>
          {STYLES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Cor do uniforme<select value={fighter.color} onChange={e=>setFighter(f=>({...f,color:e.target.value}))}>
          <option value="#514bc8">Azul</option><option value="#138a81">Verde</option>
          <option value="#c25840">Vermelho</option><option value="#9946a7">Roxo</option></select></label>
        <p>Nível {fighter.level} · XP {fighter.xp}/300 · Vitórias {fighter.wins} · Derrotas {fighter.losses}</p>
        <div className="fight-preview"><FighterFigure color={fighter.color} style={fighter.style} pose="idle" label={`Prévia: ${fighter.style}`}/></div>
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
      <FightHud playerName={fighter.name||session.nickname} playerHp={playerHp} cpuHp={cpuHp}
        remaining={remaining} duration={duration} turn={turn} active={phase==="playing"} resolving={handled.current}
        impact={impact?{defender:impact.cue.defender,blocked:impact.cue.blocked}:null}/>
      <div className="fight-arena">
        <FightStage motion={motion} impact={impact} color={fighter.color} fighterStyle={fighter.style}/>
      </div>
      {phase==="playing"?<div className="fight-math">
        <p className="eyebrow">{turn==="attack"?"Seu ataque":"Defesa contra a CPU"}</p>
        <div className="fight-prompt-timer"><span>RESPONDA À OPERAÇÃO</span><strong>{handled.current?"Golpe em andamento":`${remaining}s restantes`}</strong></div>
        <div className="math-expression">{question.expression} = ?</div>
        {turn==="attack"&&<fieldset className="fight-targets"><legend>Mira do golpe</legend>
          {(["Cabeça","Tronco","Pernas"] as Target[]).map(t=><label key={t}>
            <input type="radio" checked={target===t} onChange={()=>setTarget(t)}/>{t}</label>)}</fieldset>}
        <form onSubmit={submit} className="fight-answer"><input aria-label="Resposta matemática" inputMode="decimal" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={handled.current} placeholder="Sua resposta"/>
          <button disabled={handled.current||!answer.trim()}>Confirmar</button></form>
      </div>:<div className={`fight-math fight-result fight-result--${result}`}>
        <span className="fight-result-eyebrow">RESULTADO DA BATALHA</span>
        <h2>{result==="victory"?"VITÓRIA!":"DERROTA"}</h2>
        <p>{result==="victory"?"Seu desempenho na matemática garantiu a vitória.":"Continue treinando as operações para melhorar na próxima luta."}</p>
        <div className="fight-result-rewards" aria-label="Recompensas recebidas">
          <div><small>MOEDAS</small><strong>+{result==="victory"?"100":"20"}</strong></div>
          <div><small>EXPERIÊNCIA</small><strong>+{result==="victory"?"100":"30"} XP</strong></div>
        </div>
        <div className="fight-result-actions">
          <button onClick={start}>Lutar novamente</button>
          <button className="button-secondary" onClick={backToSetup}>Lutador e loja</button>
        </div>
      </div>}
      <p className={`fight-feedback fight-feedback--${feedbackTone}`} role="status">{feedback}</p>
    </section>}
  </main>;
}
