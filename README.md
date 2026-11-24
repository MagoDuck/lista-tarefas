# Tarefas — PWA de listas de coisas para fazer

App web instalável (PWA) para criar listas de tarefas. Funciona offline e guarda tudo no próprio navegador (`localStorage`), sem servidor nem conta.

## Recursos

- Várias listas, cada uma com nome e cor (criar, editar, excluir com "Desfazer")
- Visões **Hoje** (com data de hoje ou atrasadas) e **Todas as tarefas**
- Tarefas com data, prioridade (baixa/média/alta) e anotações
- Filtros (todas / pendentes / concluídas), busca e ordenação
- Excluir e "Limpar concluídas" com **Desfazer**
- Tema claro / escuro / automático
- Exportar e importar backup em JSON
- Instalável (botão "Instalar app"), funciona offline, atalho "Hoje" no ícone
- Atalhos de teclado: `n` nova tarefa, `/` buscar

## Rodar localmente

Service workers só funcionam em `https://` ou `localhost`, então use o servidor incluído (Node, sem dependências):

```powershell
node serve.js 5510
```

Abra http://localhost:5510.

## Publicar

São apenas arquivos estáticos: suba a pasta inteira (sem `scripts/` e `serve.js`, se quiser) para qualquer hospedagem com HTTPS — GitHub Pages, Netlify, Vercel, etc.

## Atualizações

O service worker serve os arquivos do cache. Depois de alterar qualquer arquivo, aumente `VERSION` em `sw.js` (ex.: `v1` → `v2`); os usuários verão o aviso "Nova versão disponível — Atualizar".

## Ícones

Os PNGs em `icons/` são gerados a partir do mesmo desenho do `icon.svg`:

```powershell
node scripts/generate-icons.js
```
