# Jogos Matemáticos — edição offline Chrome

## Instalação sem .exe ou servidor
1. Faça download do artefato \`Jogos-Matematicos-Offline\` na execução do workflow **Build Jogos Offline Chrome** no GitHub Actions.
2. Descompacte o ZIP. Há um arquivo \`Jogos-Matematicos-Offline.html\`.
3. Copie o arquivo para o Google Drive (pasta da escola) e disponibilize download aos computadores, se autorizado.
4. Em cada computador, baixe o arquivo e abra com Google Chrome. **Não use a prévia do Google Drive**.
5. O jogo abre por \`file://\` sem internet e sem executáveis ou servidor local.

## Escopo
- Quatro jogos com seus modos individuais contra NPC.
- Níveis 5º, 6º, 7º, 8º, 9º e misto.
- Todas as imagens e folhas de estilo incorporadas no HTML.
- Entrada e ranking locais por navegador/computador; os rankings não são compartilhados entre computadores.
- Botão **Exportar ranking CSV** para coleta de resultados no computador.
- Salas multiplayer desabilitadas para não depender do Railway.

## Limitações
- O navegador pode bloquear localStorage por política escolar. Nessa situação a sessão funciona em memória, mas os rankings podem se perder ao fechar o navegador: exporte CSV antes.
- Não existe sincronização automática ou troca de resultados entre computadores.
- A política do dispositivo ainda pode impedir abrir HTML por \`file://\`; testar em computador da escola.
- Abrir o arquivo a partir da prévia do Google Drive não executa a aplicação.
- Para atualizar, baixe um novo HTML; não apaga dados online do Railway.
- Não colocar nomes completos de estudantes nos apelidos e exportações.

## Construção/reprodução
\`\`\`bash
npm install --legacy-peer-deps
node scripts/build-offline.mjs
node scripts/test-offline.mjs
\`\`\`
O script esbuild empacota tudo em um HTML com JavaScript IIFE e CSS inline, substitui endpoints online por armazenamento local, inabilita a biblioteca Socket.IO e incorpora imagens como data URIs.

## Teste manual importante
Abrir o HTML no Chrome com Wi-Fi desligado, criar apelido, visitar todos os modos solo, responder questões, concluir partidas e conferir/exportar rankings. Reabrir após fechar o Chrome. Confirmar que nenhum jogo faz requisição remota; o pacote não contém código de conexão Socket.IO operacional.
