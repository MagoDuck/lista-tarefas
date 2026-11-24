# Tarefas — PWA de listas de coisas para fazer

App web instalável (PWA) para criar listas de tarefas. Funciona offline e guarda as tarefas no próprio navegador (`localStorage`), sem conta. Lembretes chegam como notificação push, mesmo com o app fechado.

## Recursos

- Várias listas, cada uma com nome e cor (criar, editar, excluir com "Desfazer")
- Visões **Hoje** (com data de hoje ou atrasadas) e **Todas as tarefas**
- Tarefas com data, prioridade (baixa/média/alta), anotações e **lembrete**
- Filtros (todas / pendentes / concluídas), busca e ordenação
- Excluir e "Limpar concluídas" com **Desfazer**
- Tema claro / escuro / automático
- Exportar e importar backup em JSON
- Instalável (botão "Instalar app"), funciona offline, atalho "Hoje" no ícone
- Atalhos de teclado: `n` nova tarefa, `/` buscar

## Como os lembretes funcionam

```
App (navegador)  ──POST/DELETE /api/reminders──▶  Vercel  ──▶  TiDB Cloud (tabela reminders)
                                                    ▲
cron-job.org  ──a cada minuto: GET /api/cron────────┘──▶ envia o push ──▶ notificação no aparelho
```

- Ao salvar uma tarefa com **Lembrete**, o app pede permissão de notificação, inscreve o aparelho no push e envia ao servidor só o título, o nome da lista e o horário.
- `/api/cron` busca os lembretes vencidos, envia o push (Web Push com chaves VAPID) e apaga cada lembrete enviado.
- Concluir, excluir ou mudar a tarefa atualiza/cancela o lembrete no servidor automaticamente.
- **iPhone/iPad:** só recebe notificações com o app adicionado à Tela de Início (iOS 16.4+).

### Configuração (uma vez)

1. **TiDB Cloud** → seu cluster → **Connect** → **Generate Password**. Copie a **Connection String** e troque `<PASSWORD>` pela senha. Pode deixar `/sys` no final: o app usa um banco próprio chamado `tarefas` e cria a tabela sozinho.
2. **Variáveis de ambiente na Vercel** (Project → Settings → Environment Variables), com os valores de `.env.local`:
   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string do passo 1 |
   | `VAPID_PUBLIC_KEY` | de `.env.local` |
   | `VAPID_PRIVATE_KEY` | de `.env.local` (segredo) |
   | `VAPID_SUBJECT` | de `.env.local` (um link `https://` ou `mailto:`) |
   | `CRON_SECRET` | de `.env.local` (segredo) |

   Depois, faça um **Redeploy** para as variáveis valerem.
3. **cron-job.org** → Criar tarefa cron:
   - URL: `https://SEU-APP.vercel.app/api/cron`
   - Agenda: a cada 1 minuto
   - Avançado → Cabeçalhos: `Authorization` = `Bearer <CRON_SECRET>`
   - Use **Executar teste**: a resposta deve ser `{"ok":true,...}`. Se vier `{"error": ...}`, a mensagem diz o que falta.

Novas chaves VAPID: `npm run vapid` (trocar as chaves faz os aparelhos se inscreverem de novo sozinhos).

## Rodar localmente

```powershell
npm install
```

```powershell
node serve.js 5510
```

Abra http://localhost:5510. O `serve.js` também roda as funções de `/api` usando as variáveis de `.env.local`.

## Atualizações

O service worker serve os arquivos do cache. Depois de alterar qualquer arquivo do app, aumente `VERSION` em `sw.js` (ex.: `v3` → `v4`); os usuários verão o aviso "Nova versão disponível — Atualizar".

## Ícones

Os PNGs em `icons/` são gerados a partir do mesmo desenho do `icon.svg`:

```powershell
node scripts/generate-icons.js
```
