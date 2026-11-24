// GET /api/cron — chamado pelo cron-job.org a cada minuto.
// Envia as notificações dos lembretes que já venceram e as remove do banco.
// Proteção: cabeçalho  Authorization: Bearer <CRON_SECRET>
'use strict';
const webpush = require('web-push');
const { getPool } = require('./_lib/db');
const { send, safeEqual } = require('./_lib/http');

const BATCH = 200;

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 503, { error: 'CRON_SECRET não configurado' });
  if (!safeEqual(req.headers.authorization || '', `Bearer ${secret}`)) return send(res, 401, { error: 'Não autorizado' });

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return send(res, 503, { error: 'Chaves VAPID não configuradas (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)' });
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const pool = await getPool();
    const now = Date.now();

    const [rows] = await pool.query(
      'SELECT endpoint_hash, task_id, subscription, title, body FROM reminders WHERE remind_at <= ? ORDER BY remind_at LIMIT ?',
      [now, BATCH],
    );

    let sent = 0;
    let failed = 0;
    const goneEndpoints = new Set();

    const results = await Promise.allSettled(rows.map(async (row) => {
      if (goneEndpoints.has(row.endpoint_hash)) return;
      const payload = JSON.stringify({ title: row.title, body: row.body, tag: row.task_id });
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), payload, { TTL: 6 * 3600, urgency: 'high' });
        sent++;
      } catch (err) {
        failed++;
        // 404/410: a inscrição não existe mais (app desinstalado, permissão retirada…)
        if (err.statusCode === 404 || err.statusCode === 410) goneEndpoints.add(row.endpoint_hash);
        else console.error('push falhou:', err.statusCode, err.body || err.message);
      }
      // Cada lembrete é enviado uma vez só (sucesso ou falha), para não repetir para sempre.
      await pool.execute('DELETE FROM reminders WHERE endpoint_hash = ? AND task_id = ?', [row.endpoint_hash, row.task_id]);
    }));

    for (const hash of goneEndpoints) {
      await pool.execute('DELETE FROM reminders WHERE endpoint_hash = ?', [hash]);
    }

    const [[{ pending }]] = await pool.query('SELECT COUNT(*) AS pending FROM reminders');
    const errors = results.filter((r) => r.status === 'rejected').length;
    return send(res, 200, { ok: true, due: rows.length, sent, failed, errors, expiredDevices: goneEndpoints.size, pending: Number(pending) });
  } catch (err) {
    console.error('cron:', err);
    // Só quem tem o CRON_SECRET vê esta mensagem — ajuda a diagnosticar a configuração.
    return send(res, 500, { error: err.message });
  }
};
