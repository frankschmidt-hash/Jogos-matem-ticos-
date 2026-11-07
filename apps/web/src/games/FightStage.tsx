import { type CSSProperties } from "react";
import { FighterFigure, type FighterPose } from "./FighterFigure";
import type { FighterStyle } from "./fighter-styles";
import type { ImpactCue, ImpactSide } from "./fight-impact";
import "./fight-impact.css";

export type ArenaMotion = {
  player:FighterPose;
  cpu:FighterPose;
  caption:string;
  seq:number;
};

export type ArenaImpact = {
  cue:ImpactCue;
  damage:number;
  frozen:boolean;
};

type FightStageProps = {
  motion:ArenaMotion;
  impact:ArenaImpact|null;
  color:string;
  fighterStyle:FighterStyle;
};

function isStrike(pose:FighterPose) {
  return pose==="jab"||pose==="cross"||pose==="kick";
}

function actorClasses(side:ImpactSide,pose:FighterPose) {
  return [
    "fight-stage-actor",
    "fight-stage-actor--"+side,
    isStrike(pose)?"fight-stage-actor--attack":"",
    isStrike(pose)?"fight-stage-actor--"+pose:"",
    pose==="hit"?"fight-stage-actor--hit":"",
    pose==="block"?"fight-stage-actor--block":"",
    pose==="retreat"?"fight-stage-actor--retreat":""
  ].filter(Boolean).join(" ");
}

export function FightStage({motion,impact,color,fighterStyle}:FightStageProps) {
  const cue=impact?.cue;
  const isExchange=isStrike(motion.player)||isStrike(motion.cpu);
  const className=[
    "fight-stage",
    isExchange?"fight-stage--exchange":"",
    impact?.frozen?"fight-stage--hitstop":"",
    cue&&!cue.blocked&&cue.shakePx>0?"fight-stage--shake-"+cue.grade:""
  ].filter(Boolean).join(" ");
  const style={
    "--mf-knockback-distance":(cue?.knockbackPx??19)+"px"
  } as CSSProperties;
  const side=cue?.defender;
  const zone=cue?.target==="Cabeça"?"head":cue?.target==="Pernas"?"legs":"body";

  return <div className={className} style={style} data-impact={cue?.grade??"none"}>
    <div className={actorClasses("player",motion.player)}>
      <FighterFigure key={`player-${motion.seq}`} color={color} style={fighterStyle} pose={motion.player} label="Seu lutador"/>
    </div>
    <span className="fight-stage-vs" aria-hidden="true">VS</span>
    <div className={actorClasses("cpu",motion.cpu)}>
      <FighterFigure key={`cpu-${motion.seq}`} color="#de7651" style="Boxe" enemy pose={motion.cpu} label="Desafiante CPU"/>
    </div>
    {cue&&<div key={motion.seq} className="fight-impact-layer" aria-hidden="true">
      <span className={`fight-impact-burst fight-impact-burst--${cue.grade} fight-impact-burst--${side} fight-impact-burst--${zone}`}/>
      {!cue.blocked&&impact.damage>0&&<span className={`fight-impact-number fight-impact-number--${side}`}>-{impact.damage} HP</span>}
      <span className={`fight-impact-label fight-impact-label--${cue.grade}`}>{cue.label}</span>
    </div>}
    {motion.caption&&<span className="fight-motion-caption" aria-hidden="true">{motion.caption}</span>}
  </div>;
}
