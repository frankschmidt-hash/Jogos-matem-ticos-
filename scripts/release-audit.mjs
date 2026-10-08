import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root=process.cwd();
const ignored=new Set([".git","node_modules","dist","coverage"]);
const findings=[];
const patterns=[
  ["private key",/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token",/github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/],
  ["OpenAI-style secret",/\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Railway token",/RAILWAY_TOKEN\s*=\s*[^\s#]+/]
];

function walk(dir){
  for(const name of readdirSync(dir)){
    if(ignored.has(name)) continue;
    const full=join(dir,name);
    const rel=relative(root,full).replaceAll("\\","/");
    const stat=statSync(full);
    if(stat.isDirectory()) { walk(full); continue; }
    if(name.startsWith(".env") && name!==".env.example") findings.push(rel+": arquivo de ambiente não permitido");
    if(stat.size>1_000_000) continue;
    let content="";
    try { content=readFileSync(full,"utf8"); } catch { continue; }
    for(const [label,pattern] of patterns){
      if(pattern.test(content)) findings.push(rel+": possível "+label);
    }
  }
}
walk(root);

const vite=readFileSync(join(root,"apps/web/vite.config.ts"),"utf8");
if(/sourcemap\s*:\s*true/.test(vite)) findings.push("apps/web/vite.config.ts: source maps públicos habilitados");

if(findings.length){
  console.error("Release audit falhou:");
  for(const f of findings) console.error("- "+f);
  process.exit(1);
}
console.log("Release audit OK: nenhum segredo conhecido, .env privado ou source map público detectado.");
