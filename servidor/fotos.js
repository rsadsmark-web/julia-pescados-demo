'use strict';
// Fotos de produtos enviadas pelo painel. Ficam na pasta dinâmica (volume do compose), então sobrevivem a novo deploy.
// A leitura é pública (a loja mostra a foto); o envio exige login e confere o formato pelos primeiros bytes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const DIR = path.join(process.env.DINAMICO_DIR || path.join(__dirname, '..', 'dinamico'), 'fotos');
const NOME = /^[a-f0-9]{16}\.(webp|jpg|png)$/;
const MAX = 2 * 1024 * 1024;

function formato(b) {
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.toString('latin1', 1, 4) === 'PNG' && b[0] === 0x89) return 'png';
  return null;
}

module.exports = { formato, publico(app) {
  app.get('/fotos/:arq', (req, res) => {
    if (!NOME.test(req.params.arq)) return res.status(404).end();
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.join(DIR, req.params.arq), (e) => { if (e && !res.headersSent) res.status(404).end(); });
  });
}, painel(app) {
  app.post('/api/foto-produto', express.raw({ type: 'image/*', limit: MAX }), (req, res) => {
    const b = req.body;
    if (!Buffer.isBuffer(b) || !b.length) return res.status(400).json({ erro: 'Escolha uma foto.' });
    const ext = formato(b);
    if (!ext) return res.status(400).json({ erro: 'Formato não aceito. Use JPG, PNG ou WebP.' });
    fs.mkdirSync(DIR, { recursive: true });
    const nome = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(DIR, nome), b);
    res.status(201).json({ ok: true, img: '/fotos/' + nome });
  });
} };
