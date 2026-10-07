import type { PropsWithChildren, ReactNode, InputHTMLAttributes } from "react";

export function CountdownTimer({seconds}:{seconds:number}) {
  return <span aria-live="polite">{seconds}s</span>;
}

export function ResultFeedback({status}:{status:"correct"|"incorrect"|"timeout"}) {
  const text = status === "correct" ? "Correto!" : status === "incorrect" ? "Incorreto" : "Tempo encerrado";
  return <div role="status">{text}</div>;
}

export function PlayerBadge({nickname}:{nickname:string}) {
  return <span>{nickname}</span>;
}

export function ConnectionStatus({state}:{state:string}) {
  return <span role="status">Conexão: {state}</span>;
}

export function ConfirmDialog({open, children}:{open:boolean; children:ReactNode}) {
  return open ? <div role="dialog" aria-modal="true">{children}</div> : null;
}

export function RoomCodeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input aria-label="Código da sala" {...props}/>;
}

export function HelpRules({children}:{children:ReactNode}) {
  return <details><summary>Regras</summary>{children}</details>;
}

export function MathQuestionModal({open, expression, children}:{open:boolean; expression:string; children?:ReactNode}) {
  return open ? (
    <div role="dialog" aria-modal="true">
      <h2>Resolva</h2>
      <strong>{expression}</strong>
      {children}
    </div>
  ) : null;
}

export function GameCard({
  name, description, href, artLabel
}:{name:string; description:string; href:string; artLabel:string}) {
  return (
    <article className="card">
      <div className="game-art" aria-hidden="true">{artLabel}</div>
      <h2>{name}</h2>
      <p>{description}</p>
      <a className="button" href={href}>Jogar</a>
    </article>
  );
}

export function Card({children}:PropsWithChildren) {
  return <article className="card">{children}</article>;
}
