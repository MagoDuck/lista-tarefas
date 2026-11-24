'use strict';
const crypto = require('crypto');

/** Lê o corpo JSON (funciona na Vercel e no servidor local serve.js). */
async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return JSON.parse(String(req.body));
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw Object.assign(new Error('Corpo muito grande'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = { readJson, send, sha256, safeEqual };
