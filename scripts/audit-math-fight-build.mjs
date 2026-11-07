import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assets=join(process.cwd(),"apps/web/dist/assets");
if(!existsSync(assets))throw new Error("Build web não localizado: "+assets);
const files=readdirSync(assets).filter(name=>name.endsWith(".js"));
if(files.length===0)throw new Error("Nenhum JavaScript de produção em "+assets);
const source=files.map(name=>readFileSync(join(assets,name),"utf8")).join("\n");
const forbidden=["fight-pose-picker","fight-pose-active","Visualizar posturas do lutador","setPreviewPose"];
for(const marker of forbidden){
  if(source.includes(marker))throw new Error("Controle de QA encontrado no bundle público: "+marker);
}
if(!source.includes("Luta Matemática"))throw new Error("Jogo ausente do bundle, auditoria inconclusiva");
console.log("Auditoria de build: Luta Matemática presente; nenhum controle interno de animações publicado.");
