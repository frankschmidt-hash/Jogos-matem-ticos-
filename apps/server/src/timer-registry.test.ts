import { describe, expect, it, vi } from "vitest";
import { pruneMissingTimers } from "./timer-registry";

describe("timer registry",()=>{
  it("remove e cancela timers de salas que já não existem",()=>{
    const timers=new Map([["ativa",1],["orfã",2]]);
    const cancel=vi.fn();
    const removed=pruneMissingTimers(timers,code=>code==="ativa",cancel);
    expect(removed).toEqual(["orfã"]);
    expect(cancel).toHaveBeenCalledWith(2);
    expect([...timers.keys()]).toEqual(["ativa"]);
  });

  it("não toca em timers de salas válidas",()=>{
    const timers=new Map([["a",1],["b",2]]);
    const cancel=vi.fn();
    expect(pruneMissingTimers(timers,()=>true,cancel)).toEqual([]);
    expect(cancel).not.toHaveBeenCalled();
    expect(timers.size).toBe(2);
  });
});
