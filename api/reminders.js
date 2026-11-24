// POST   /api/reminders  { subscription, taskId, title, body, remindAt }  → cria/atualiza um lembrete
// DELETE /api/reminders  { endpoint, taskId }                            → remove um lembrete
'use strict';
const { getPool } = require('./_lib/db');
const { readJson, send, sha256 } = require('./_lib/http');

const MAX_PER_DEVICE = 500;
const TASK_ID = /^[\w-]{1,64}$/;

function validEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try { return new URL(endpoint).protocol === 'https:'; } catch { return false; }
}

/** Valida o corpo do POST. Retorna { error } ou os dados prontos para gravar. */
function parseUpsert(data) {
  const { subscription, taskId } = data;
  const keys = subscription && subscription.keys;
  if (!subscription || !validEndpoint(subscription.endpoint) || !keys ||
      typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' ||
      keys.p256dh.length > 200 || keys.auth.length > 100) {
    return { error: 'Inscrição de push inválida' };
  }
  const title = String(data.title || '').trim().slice(0, 200);
  const body = String(data.body || '').trim().slice(0, 200);
  if (!TASK_ID.test(String(taskId)) || !title) return { error: 'Tarefa inválida' };
  const remindAt = Number(data.remindAt);
  const now = Date.now();
  if (!Number.isFinite(remindAt) || remindAt < now - 60_000 || remindAt > now + 2 * 365 * 864e5) {
    return { error: 'Horário de lembrete inválido' };
  }
  return {
    hash: sha256(subscription.endpoint),
    taskId: String(taskId),
    sub: JSON.stringify({ endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }),
    title, body, remindAt: Math.round(remindAt), now,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return send(res, 405, { error: 'Método não permitido' });
  }

  let data;
  try { data = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: 'JSON inválido' }); }
  if (!data || typeof data !== 'object') return send(res, 400, { error: 'JSON inválido' });

  try {
    if (req.method === 'DELETE') {
      const { endpoint, taskId } = data;
      if (!validEndpoint(endpoint) || !TASK_ID.test(String(taskId))) return send(res, 400, { error: 'Dados inválidos' });
      const pool = await getPool();
      await pool.execute('DELETE FROM reminders WHERE endpoint_hash = ? AND task_id = ?', [sha256(endpoint), String(taskId)]);
      return send(res, 200, { ok: true });
    }

    const r = parseUpsert(data);
    if (r.error) return send(res, 400, { error: r.error });

    const pool = await getPool();
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM reminders WHERE endpoint_hash = ? AND task_id <> ?', [r.hash, r.taskId]);
    if (Number(total) >= MAX_PER_DEVICE) return send(res, 429, { error: 'Limite de lembretes atingido' });

    await pool.execute(
      `INSERT INTO reminders (endpoint_hash, task_id, subscription, title, body, remind_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE subscription = VALUES(subscription), title = VALUES(title),
                               body = VALUES(body), remind_at = VALUES(remind_at)`,
      [r.hash, r.taskId, r.sub, r.title, r.body, r.remindAt, r.now],
    );
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('reminders:', err);
    return send(res, 500, { error: 'Erro no servidor' });
  }
};
