import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeNickname, validateNickname } from "./session-manager";

export const LEADERBOARD_GAMES = ["property-math", "crazy-race", "number-race", "math-football"] as const;
export type LeaderboardGame = typeof LEADERBOARD_GAMES[number];
export type RankEntry = { nickname:string; score:number; secondary:number; achievedAt:number };
export const SCORE_LIMITS:Record<LeaderboardGame,number> = {
  "property-math":10_000_000,"crazy-race":3_000,"number-race":3_000,"math-football":1_000
};
const empty=():Record<LeaderboardGame,RankEntry[]>=>({
  "property-math":[],"crazy-race":[],"number-race":[],"math-football":[]
});
const compare=(a:RankEntry,b:RankEntry):number=>
  b.score-a.score || b.secondary-a.secondary || a.achievedAt-b.achievedAt || a.nickname.localeCompare(b.nickname,"pt-BR");

export const leaderboardFilePath=():string=>
  process.env.LEADERBOARD_DATA_PATH ||
  join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(),"data","leaderboards.json");

export class LeaderboardStore {
  private rankings=empty();
  constructor(private readonly filePath:string|null=leaderboardFilePath()){
    if(!filePath) return;
    try{
      const saved=JSON.parse(readFileSync(filePath,"utf8")) as Record<string,unknown>;
      for(const game of LEADERBOARD_GAMES){
        const rows=saved[game];
        if(!Array.isArray(rows)) continue;
        for(const item of rows){
          if(!item||typeof item!=="object") continue;
          const row=item as Partial<RankEntry>;
          if(typeof row.nickname==="string")
            this.record(game,row.nickname,row.score as number,row.secondary as number,row.achievedAt as number,false);
        }
      }
    }catch(error){
      if((error as NodeJS.ErrnoException).code!=="ENOENT")
        console.warn("Arquivo de ranking anterior indisponível ou inválido",error);
    }
  }
  snapshot():Record<LeaderboardGame,RankEntry[]>{
    return Object.fromEntries(LEADERBOARD_GAMES.map(game=>[game,this.rankings[game].map(row=>({...row}))]))
      as Record<LeaderboardGame,RankEntry[]>;
  }
  record(game:LeaderboardGame,nickname:string,score:number,secondary=0,achievedAt=Date.now(),persist=true):boolean{
    if(!LEADERBOARD_GAMES.includes(game)) return false;
    const name=validateNickname(nickname);
    if(!name.ok||!Number.isSafeInteger(score)||score<0||score>SCORE_LIMITS[game]||
      !Number.isSafeInteger(secondary)||Math.abs(secondary)>10_000_000||
      !Number.isSafeInteger(achievedAt)||achievedAt<0) return false;
    const current=this.rankings[game].find(row=>normalizeNickname(row.nickname)===name.normalized);
    const candidate:RankEntry={nickname:name.clean,score,secondary,achievedAt};
    if(current&&compare(candidate,current)>=0) return false;
    const next=this.rankings[game].filter(row=>normalizeNickname(row.nickname)!==name.normalized);
    next.push(candidate);
    next.sort(compare);
    this.rankings[game]=next.slice(0,10);
    if(persist&&this.filePath){
      try{
        mkdirSync(dirname(this.filePath),{recursive:true});
        const temp=this.filePath+"."+process.pid+".tmp";
        writeFileSync(temp,JSON.stringify(this.rankings),"utf8");
        renameSync(temp,this.filePath);
      }catch(error){console.error("Falha ao salvar rankings",error);}
    }
    return true;
  }
}
