// GET /api/config — chave pública VAPID usada pelo app para assinar as notificações push.
'use strict';
const { send } = require('./_lib/http');

module.exports = (req, res) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
  if (!vapidPublicKey) return send(res, 503, { error: 'Notificações não configuradas no servidor.' });
  return send(res, 200, { vapidPublicKey });
};
