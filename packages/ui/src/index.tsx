import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode, type InputHTMLAttributes } from "react";

export function CountdownTimer({seconds}:{seconds:number}) {
  return <span className="countdown-timer" aria-live="polite" aria-label={seconds+" segundos restantes"}>{seconds}s</span>;
}

export function ResultFeedback({status}:{status:"correct"|"incorrect"|"timeout"}) {
  const text=status==="correct"?"Correto!":status==="incorrect"?"Incorreto":"Tempo encerrado";
  const symbol=status==="correct"?"✓":status==="incorrect"?"×":"⌛";
  return <div className={"result-feedback result-"+status} role="status" aria-live="polite">
    <span aria-hidden="true">{symbol}</span>
    <strong>{text}</strong>
  </div>;
}

export function PlayerBadge({nickname}:{nickname:string}) {
  return <span className="player-badge">{nickname}</span>;
}

export function ConnectionStatus({state}:{state:string}) {
  const normalized=state.toLowerCase();
  const label=normalized==="connected"?"Conectado":normalized==="reconnecting"?"Reconectando":normalized==="disconnected"?"Desconectado":state;
  return <span className={"connection-status connection-"+normalized} role="status" aria-live="polite">
    <span className="connection-dot" aria-hidden="true"/>
    {label}
  </span>;
}

export function ConfirmDialog({open, children}:{open:boolean; children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open) ref.current?.focus();},[open]);
  return open ? <div className="modal-backdrop">
    <div ref={ref} tabIndex={-1} className="accessible-modal" role="dialog" aria-modal="true">{children}</div>
  </div>:null;
}

export function RoomCodeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input aria-label="Código da sala" autoCapitalize="characters" autoCorrect="off" spellCheck={false} {...props}/>;
}

export function HelpRules({children}:{children:ReactNode}) {
  return <details className="help-rules"><summary>Como jogar e ajuda</summary><div className="help-content">{children}</div></details>;
}

export function MathQuestionModal({
  open,expression,children
}:{open:boolean;expression:string;children?:ReactNode}) {
  const titleId=useId();
  const dialogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open) dialogRef.current?.focus();},[open]);
  if(!open) return null;
  return <div className="modal-backdrop" role="presentation">
    <div
      ref={dialogRef}
      className="accessible-modal math-modal"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <p className="eyebrow">Desafio matemático</p>
      <h2 id={titleId}>Resolva a operação</h2>
      <strong className="math-expression">{expression}</strong>
      {children}
    </div>
  </div>;
}

export function GameCard({
  name,description,href,artLabel,imageSrc,theme="blue"
}:{name:string;description:string;href:string;artLabel:string;imageSrc?:string;theme?:string}) {
  return <article className={"card game-card theme-"+theme}>
    <div className="game-art" aria-hidden="true">
      {imageSrc?<img src={imageSrc} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display="none";}}/>:null}
      <span className="game-art-fallback">{artLabel}</span>
    </div>
    <div className="game-card-copy">
      <h2>{name}</h2>
      <p>{description}</p>
    </div>
    <a className="button game-card-button" href={href} aria-label={"Jogar "+name}>Jogar agora <span aria-hidden="true">→</span></a>
  </article>;
}

export function Card({children}:PropsWithChildren) {
  return <article className="card">{children}</article>;
}
