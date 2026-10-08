import { type CSSProperties, type ReactNode } from "react";
import { FootballAthlete as Athlete } from "./FootballAthlete";
import { PENALTY_TARGETS, type PenaltyKick, type PenaltyMatchState, type PenaltyTarget } from "@jogos/math-football";

const targetNames=[
  "canto superior esquerdo","centro superior","canto superior direito",
  "meio esquerdo","centro","meio direito",
  "canto inferior esquerdo","centro inferior","canto inferior direito"
];

function Spectators(){
  const fans=Array.from({length:156},(_,i)=>i);
  return <div className="football-stands" aria-hidden="true">
    <div className="football-stand-tier tier-top">
      {fans.map(i=><i key={i} className={"football-fan "+(i%7===0?"waving":"")} style={{"--shirt": ["#fbd04f","#fae8ac","#15985e","#58a8e6","#f97359"][i%5],"--fan-delay":String((i%11)*-.13)+"s"} as CSSProperties}/>)}
    </div>
    <div className="football-stadium-banner football-banner-left">FUTEBOL MATEMÁTICO</div>
    <div className="football-stadium-banner football-banner-right">APRENDER É UMA GRANDE JOGADA!</div>
    <div className="football-stand-tier tier-bottom">
      {fans.slice(0,55).map(i=><i key={i} className={"football-fan "+(i%4===0?"waving":"")} style={{"--shirt": ["#fde047","#15803d","#93c5fd","#f9b870"][i%4],"--fan-delay":String((i%7)*-.15)+"s"} as CSSProperties}/>)}
    </div>
    <div className="football-adboard">FUTEBOL <strong>MATEMÁTICO</strong> <span>•</span> MATEMÁTICA EM CAMPO <span>•</span> FUTEBOL <strong>MATEMÁTICO</strong></div>
  </div>;
}

function targetVariables(target:PenaltyTarget,keeperTarget:PenaltyTarget):CSSProperties{
  const col=target%3,row=Math.floor(target/3);
  const keeperCol=keeperTarget%3,keeperRow=Math.floor(keeperTarget/3);
  const x=(c:number,left:number,width:number)=>left+(c+.5)*(width/3)+"%";
  const y=(r:number,top:number,height:number)=>top+(r+.5)*(height/3)+"%";
  return {
    "--shot-x-desktop":x(col,21,54), "--shot-y-desktop":y(row,34,32),
    "--shot-x-mobile":x(col,12,76), "--shot-y-mobile":y(row,27,23),
    "--keeper-x-desktop":x(keeperCol,21,54), "--keeper-y-desktop":y(keeperRow,34,32),
    "--keeper-x-mobile":x(keeperCol,12,76), "--keeper-y-mobile":y(keeperRow,27,23),
    "--keeper-turn":keeperCol===0?"-65deg":keeperCol===2?"65deg":"0deg"
  } as CSSProperties;
}

export function FootballStadium({
  match,selectedTarget,onSelectTarget,canAim,children
}:{
  match:PenaltyMatchState;selectedTarget:PenaltyTarget;onSelectTarget:(target:PenaltyTarget)=>void;
  canAim:boolean;children:ReactNode
}){
  const kick:PenaltyKick|null=match.lastKick;
  const resolution=Boolean(kick && (match.phase==="kick-resolution"||match.phase==="finished"));
  const target=kick?.target??selectedTarget;
  const keeperTarget=kick?.keeperTarget??4;
  const style=targetVariables(target,keeperTarget);
  return <section className={"football-stadium football-stadium-v2"+(resolution?(kick?.goal?" is-goal":" is-save"):"")} style={style}
    key={"football-scene-"+match.history.length} aria-label="Estádio de futebol e cobrança de pênalti">
    <div className="football-sky"><div className="football-floodlight left"/><div className="football-floodlight right"/></div>
    <Spectators/>
    <div className="football-pitch">
      <div className="football-pitch-stripes"/><div className="football-grass-texture"/><div className="football-field-arc"/>
      <div className="football-penalty-mark"/>
    </div>
    <div className="football-goal-v2" aria-label="Gol dividido em nove setores">
      <div className="football-goal-depth"/>
      <div className="football-net-v2"/><div className="football-net-shading"/>
      <div className="football-target-grid">
        {PENALTY_TARGETS.map(n=><button type="button" key={n} disabled={!canAim||resolution}
          onClick={()=>onSelectTarget(n)}
          aria-label={"Mirar no "+targetNames[n]}
          aria-pressed={canAim&&n===selectedTarget}
          className={"football-target"+(n===selectedTarget&&canAim?" selected":"")}>
          <span aria-hidden="true">⊕</span>
        </button>)}
      </div>
    </div>
    <div className="football-goalkeeper-v2"><Athlete keeper/></div>
    <div className="football-player-v2"><Athlete celebrating={Boolean(resolution&&kick?.goal)} disappointed={Boolean(resolution&&!kick?.goal)}/></div>
    <div className="football-ball-v2" aria-label="Bola de futebol"><span/></div>
    <div className="football-impact"/>
    {resolution&&<div className={"football-event-overlay "+(kick?.goal?"football-goal-celebration":"football-save-celebration")}>
      <strong>{kick?.goal?"GOOOOL!":"DEFENDEU!"}</strong>
      <span>{kick?.goal?"Torcida aplaudindo!":"A torcida vaia a cobrança."}</span>
    </div>}
    {resolution&&kick?.goal&&<div className="football-confetti" aria-hidden="true">
      {Array.from({length:24},(_,i)=><i key={i} style={{"--p":(i*37%100)+"%","--delay":(i%7)*-.16+"s","--color":["#ffe94d","#26e58c","#58b5ff"][i%3]} as CSSProperties}/>)}
    </div>}
    <div className="football-action-overlay">{children}</div>
    <div className="football-target-caption">
      {canAim&&!resolution?"Toque no gol para escolher onde chutar":"Cobrança de pênalti"}
    </div>
  </section>;
}
