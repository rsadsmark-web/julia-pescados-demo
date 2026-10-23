'use strict';
// Uso: docker compose exec app node servidor/criar-usuario.js <usuario> "<Nome>" [admin|operador] [senha]
// Sem senha, gera uma senha forte e mostra uma única vez. A senha é provisória: o sistema pede a troca no primeiro acesso.
const crypto = require('crypto');
const { pool, hashSenha, iniciaBanco } = require('./server');
(async () => {
  const [usuario, nome, papelArg, senhaArg] = process.argv.slice(2);
  if (!usuario || !nome) { console.error('Uso: node servidor/criar-usuario.js <usuario> "<Nome>" [admin|operador] [senha]'); process.exit(1); }
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const gerar = () => Array.from(crypto.randomBytes(16), (b) => A[b % A.length]).join('');
  const senha = senhaArg || gerar(), papel = papelArg === 'admin' ? 'admin' : 'operador';
  if (senha.length < 10) { console.error('A senha precisa ter ao menos 10 caracteres.'); process.exit(1); }
  await iniciaBanco();
  await pool.query(
    `INSERT INTO usuarios (usuario, nome, senha_hash, papel, senha_provisoria) VALUES ($1,$2,$3,$4,TRUE)
     ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, nome = EXCLUDED.nome, papel = EXCLUDED.papel, ativo = TRUE, senha_provisoria = TRUE`,
    [usuario.toLowerCase(), nome, hashSenha(senha), papel]);
  console.log('Usuário: ' + usuario.toLowerCase() + '\nSenha provisória: ' + senha + '\nPapel: ' + papel);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
