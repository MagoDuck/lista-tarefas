// Conexão com o TiDB Cloud (compatível com MySQL).
// Usa a variável DATABASE_URL, no formato da aba "Connection String" do TiDB:
//   mysql://USUARIO.root:SENHA@gateway01.us-west-2.prod.aws.tidbcloud.com:4000/tarefas
// O banco e a tabela são criados automaticamente na primeira chamada.
'use strict';
const mysql = require('mysql2/promise');

const SYSTEM_DBS = new Set(['sys', 'mysql', 'information_schema', 'performance_schema', 'metrics_schema']);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reminders (
  endpoint_hash CHAR(64)     NOT NULL,
  task_id       VARCHAR(64)  NOT NULL,
  subscription  TEXT         NOT NULL,
  title         VARCHAR(200) NOT NULL,
  body          VARCHAR(200) NOT NULL DEFAULT '',
  remind_at     BIGINT       NOT NULL,
  created_at    BIGINT       NOT NULL,
  PRIMARY KEY (endpoint_hash, task_id),
  KEY idx_remind_at (remind_at)
)`;

let poolPromise = null;

async function init() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('A variável DATABASE_URL não está configurada.');
  const url = new URL(raw);
  let database = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'tarefas';
  // A tela do TiDB sugere o banco "sys" (de sistema). Não guardamos nada lá.
  if (SYSTEM_DBS.has(database.toLowerCase())) database = 'tarefas';
  if (!/^\w{1,64}$/.test(database)) throw new Error('Nome de banco inválido em DATABASE_URL.');

  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  const base = {
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    // O TiDB exige TLS na conexão pública; o Node já confia na autoridade do certificado.
    ssl: local ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectTimeout: 10000,
  };

  const boot = await mysql.createConnection(base);
  try {
    await boot.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  } finally {
    await boot.end();
  }

  const pool = mysql.createPool({ ...base, database, connectionLimit: 3, waitForConnections: true, maxIdle: 3 });
  await pool.query(SCHEMA);
  return pool;
}

/** Pool compartilhado entre chamadas da mesma instância da função. */
function getPool() {
  if (!poolPromise) {
    poolPromise = init().catch((err) => {
      poolPromise = null; // tenta de novo na próxima chamada
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool };
