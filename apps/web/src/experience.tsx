import { useEffect, useState } from "react";

export type SoundKind=
  | "click"
  | "dice"
  | "engine"
  | "correct"
  | "incorrect"
  | "goal"
  | "save"
  | "purchase"
  | "victory";

const MUTE_KEY="jogos:audio-muted";
const MOTION_KEY="jogos:reduce-motion";
const DEFAULT_VOLUME=0.14;

let context:AudioContext|null=null;
let ambientTimer:number|null=null;
let ambientArmed=false;

function getContext():AudioContext|null{
  if(typeof window==="undefined"||!("AudioContext" in window)) return null;
  try{
    context??=new AudioContext();
    return context;
  }catch{
    return null;
  }
}

function muted():boolean{
  try{return localStorage.getItem(MUTE_KEY)==="true";}catch{return false;}
}

function tone(
  frequency:number,duration:number,
  options:{type?:OscillatorType;gain?:number;slideTo?:number;delay?:number}={}
):void{
  if(muted()) return;
  const ctx=getContext();
  if(!ctx) return;
  const start=ctx.currentTime+(options.delay??0);
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=options.type??"sine";
  osc.frequency.setValueAtTime(frequency,start);
  if(options.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20,options.slideTo),start+duration);
  const volume=(options.gain??1)*DEFAULT_VOLUME;
  gain.gain.setValueAtTime(0.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,volume),start+0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start+duration+0.02);
}

export function playSound(kind:SoundKind):void{
  if(muted()) return;
  const ctx=getContext();
  if(!ctx) return;
  if(ctx.state==="suspended") void ctx.resume().catch(()=>{});
  switch(kind){
    case "click":
      tone(520,.045,{type:"triangle",gain:.32,slideTo:620}); break;
    case "dice":
      tone(160,.08,{type:"square",gain:.32,slideTo:110});
      tone(230,.07,{type:"triangle",gain:.24,delay:.07,slideTo:170}); break;
    case "engine":
      tone(105,.16,{type:"sawtooth",gain:.18,slideTo:190}); break;
    case "correct":
      tone(523.25,.10,{type:"triangle",gain:.42});
      tone(659.25,.13,{type:"triangle",gain:.38,delay:.08}); break;
    case "incorrect":
      tone(220,.13,{type:"sine",gain:.34,slideTo:155}); break;
    case "goal":
      tone(523.25,.12,{type:"triangle",gain:.45});
      tone(659.25,.12,{type:"triangle",gain:.45,delay:.08});
      tone(783.99,.18,{type:"triangle",gain:.48,delay:.16}); break;
    case "save":
      tone(310,.10,{type:"square",gain:.28,slideTo:190});
      tone(190,.16,{type:"triangle",gain:.30,delay:.08}); break;
    case "purchase":
      tone(740,.06,{type:"sine",gain:.32});
      tone(988,.12,{type:"sine",gain:.34,delay:.06}); break;
    case "victory":
      tone(392,.12,{type:"triangle",gain:.38});
      tone(523.25,.12,{type:"triangle",gain:.42,delay:.10});
      tone(659.25,.24,{type:"triangle",gain:.46,delay:.20}); break;
  }
}

function ambientPulse():void{
  if(muted()||document.visibilityState==="hidden") return;
  tone(196,.8,{type:"sine",gain:.055});
  tone(293.66,.9,{type:"sine",gain:.035,delay:.18});
}

export function armAmbientAudio():void{
  if(ambientArmed||muted()) return;
  const ctx=getContext();
  if(!ctx) return;
  ambientArmed=true;
  if(ctx.state==="suspended") void ctx.resume().catch(()=>{});
  ambientPulse();
  ambientTimer=window.setInterval(ambientPulse,7500);
}

export function stopAmbientAudio():void{
  if(ambientTimer!==null) window.clearInterval(ambientTimer);
  ambientTimer=null;
  ambientArmed=false;
}

export function applyMotionPreference(reduce:boolean):void{
  document.documentElement.classList.toggle("reduce-motion",reduce);
}

export function ExperienceControls(){
  const [isMuted,setMuted]=useState(()=>muted());
  const [reduceMotion,setReduceMotion]=useState(()=>{
    try{
      const saved=localStorage.getItem(MOTION_KEY);
      return saved===null?window.matchMedia("(prefers-reduced-motion: reduce)").matches:saved==="true";
    }catch{return false;}
  });

  useEffect(()=>{
    applyMotionPreference(reduceMotion);
    try{localStorage.setItem(MOTION_KEY,String(reduceMotion));}catch{}
  },[reduceMotion]);

  useEffect(()=>{
    const arm=()=>{
      if(!isMuted) armAmbientAudio();
      window.removeEventListener("pointerdown",arm);
      window.removeEventListener("keydown",arm);
    };
    window.addEventListener("pointerdown",arm,{once:true});
    window.addEventListener("keydown",arm,{once:true});
    return ()=>{
      window.removeEventListener("pointerdown",arm);
      window.removeEventListener("keydown",arm);
    };
  },[isMuted]);

  useEffect(()=>{
    const click=(event:PointerEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest("button,a,[role='button']")) playSound("click");
    };
    document.addEventListener("pointerdown",click);
    return ()=>document.removeEventListener("pointerdown",click);
  },[]);

  const toggleMute=()=>{
    const next=!isMuted;
    setMuted(next);
    try{localStorage.setItem(MUTE_KEY,String(next));}catch{}
    if(next) stopAmbientAudio();
    else armAmbientAudio();
  };

  return <div className="experience-controls" role="toolbar" aria-label="Preferências de experiência">
    <button
      type="button"
      className="experience-button"
      aria-pressed={isMuted}
      onClick={toggleMute}
      title={isMuted?"Ativar áudio":"Mutar áudio"}
    >
      <span aria-hidden="true">{isMuted?"🔇":"🔊"}</span>
      <span>{isMuted?"Som desligado":"Som ligado"}</span>
    </button>
    <button
      type="button"
      className="experience-button"
      aria-pressed={reduceMotion}
      onClick={()=>setReduceMotion(value=>!value)}
      title="Reduzir animações"
    >
      <span aria-hidden="true">◫</span>
      <span>{reduceMotion?"Movimento reduzido":"Animações"}</span>
    </button>
  </div>;
}
