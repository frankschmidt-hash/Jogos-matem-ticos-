import { build } from "esbuild";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname, extname, sep } from "node:path";

const root=process.cwd();
const webSrc=resolve(root,"apps/web/src");
const publicDir=resolve(root,"apps/web/public");
const destination=resolve(root,"dist/offline");
const offlineSession=resolve(webSrc,"offline-session.ts");
const offlineSocket=resolve(webSrc,"offline-socket.ts");

function offlineTransform(source,path){
  let next=source.replaceAll('href="/lobby"','href="#/lobby"');
  if(path.endsWith(sep+"main.tsx")){
    next=next.replaceAll("BrowserRouter","HashRouter");
  }
  if(path.endsWith(sep+"App.tsx")){
    next=next.replace('reconnectSession, fetchLeaderboards, type Leaderboards',
      'reconnectSession, fetchLeaderboards, downloadOfflineResults, type Leaderboards');
    next=next.replace('href={"/game/"+game.id}','href={"#/game/"+game.id}');
    next=next.replace('partidas solo e multiplayer','partidas individuais sem internet');
    next=next.replace('Hall dos campeões','Hall dos campeões — neste computador');
    next=next.replace('<span className="rankings-refresh">Atualização automática</span>',
      '<button className="button-secondary" type="button" onClick={downloadOfflineResults}>Exportar ranking CSV</button>');
    next=next.replace('Quatro jogos, desafios curtos e contas adaptadas ao seu nível.',
      'Edição offline: quatro jogos com contas adaptadas ao seu nível, mesmo sem internet.');
  }
  // A edição offline deve impedir a criação de conexões para salas online.
  next=next.replaceAll('onClick={()=>setMode("online")}',
    'disabled title="Disponível apenas na versão online"');
  next=next.replaceAll('<strong>Multiplayer</strong>','<strong>Multiplayer (somente online)</strong>');
  next=next.replaceAll('<strong>Jogador × Jogador</strong>',
    '<strong>Jogador × Jogador (somente online)</strong>');
  next=next.replace('onClick={onOnline}>Criar ou entrar em sala online',
    'disabled title="Disponível apenas no site online">Multiplayer (somente online)');
  return next;
}

const result=await build({
  entryPoints:[resolve(webSrc,"main.tsx")],
  outdir:resolve(root,"dist/offline-bundle"),
  bundle:true,write:false,format:"iife",platform:"browser",
  target:["chrome100"],minify:true,legalComments:"none",
  define:{"import.meta.env.VITE_API_URL":"undefined",
    "import.meta.env.VITE_OFFLINE":'"true"',
    "import.meta.env.PROD":"true",
    "import.meta.env.DEV":"false"},
  external:["/assets/*"],
  plugins:[{
    name:"offline-adapter",
    setup(compiler){
      compiler.onResolve({filter:/(^|\/)session$/},args=>{
        if(args.importer.startsWith(webSrc+sep))return {path:offlineSession};
      });
      compiler.onResolve({filter:/^socket\.io-client$/},()=>({path:offlineSocket}));
      compiler.onLoad({filter:/\.tsx$/},async args=>{
        if(!args.path.startsWith(webSrc+sep))return;
        const content=await readFile(args.path,"utf8");
        return {contents:offlineTransform(content,args.path),loader:"tsx"};
      });
    }
  }],
  metafile:true
});
const js=result.outputFiles.find(file=>file.path.endsWith(".js"));
const css=result.outputFiles.find(file=>file.path.endsWith(".css"));
if(!js||!css)throw new Error("Saídas JavaScript/CSS ausentes no build offline.");

let assetCount=0;
const missing=new Set();
async function inlineAssets(source){
  const matches=[...new Set(source.match(/\/assets\/[a-zA-Z0-9_./-]+\.(?:svg|png|jpg|jpeg|webp|gif|mp3|wav|ogg)/gi)||[])];
  let transformed=source;
  for(const asset of matches){
    const path=resolve(publicDir,"."+asset);
    if(!path.startsWith(publicDir+sep))throw new Error("Asset fora do diretório público: "+asset);
    let bytes;
    try{ bytes=await readFile(path); }
    catch{missing.add(asset);continue;}
    const extension=extname(path).toLowerCase();
    const mime=({
      ".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",
      ".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",
      ".mp3":"audio/mpeg",".wav":"audio/wav",".ogg":"audio/ogg"
    })[extension];
    const data="data:"+mime+";base64,"+bytes.toString("base64");
    transformed=transformed.replaceAll(asset,data);
    assetCount++;
  }
  return transformed;
}
const script=await inlineAssets(js.text);
const styles=await inlineAssets(css.text);
if(missing.size)throw new Error("Recursos gráficos não encontrados: "+[...missing].join(", "));
if(/(?:src|href)=["']\/assets\//.test(styles+script))throw new Error("Caminho absoluto de recurso não convertido.");
const safeScript=script.replace(/<\/script/gi,"<\\/script");
const safeStyles=styles.replace(/<\/style/gi,"<\\/style");
const html='<!doctype html>\n'+
  '<html lang="pt-BR"><head><meta charset="UTF-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1.0">'+
  '<meta name="color-scheme" content="light"><title>Jogos Matemáticos — Offline</title>'+
  '<style>'+safeStyles+'</style></head><body><div id="root"></div>'+
  '<script>'+safeScript+'</script></body></html>\n';
await mkdir(destination,{recursive:true});
const file=resolve(destination,"Jogos-Matematicos-Offline.html");
await writeFile(file,html,"utf8");
console.log("Offline gerado:",relative(root,file),"bytes:",Buffer.byteLength(html),
  "assets incorporados:",assetCount);
