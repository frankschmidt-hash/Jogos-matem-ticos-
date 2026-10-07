export function pruneMissingTimers<T>(
  timers:Map<string,T>,
  roomExists:(code:string)=>boolean,
  cancel:(timer:T)=>void
):string[]{
  const removed:string[]=[];
  for(const [code,timer] of timers){
    if(roomExists(code)) continue;
    cancel(timer);
    timers.delete(code);
    removed.push(code);
  }
  return removed;
}
