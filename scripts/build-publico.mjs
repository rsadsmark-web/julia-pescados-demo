// Monta dist/publico: só o que a página pública precisa (loja e receitas), já comprimido (.br e .gz) para o Caddy
// entregar direto do disco sem gastar processador. O painel e a API não entram aqui: passam pelo Node, com login.
// Uso: node scripts/build-publico.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(raiz, 'scripts', 'versionar.mjs')], { stdio: 'inherit' });
const saida = join(raiz, 'dist', 'publico');
rmSync(saida, { recursive: true, force: true });
mkdirSync(saida, { recursive: true });

const paginas = ['index.html', 'receitas.html', 'login.html'];
const arquivos = new Set(['manifest.webmanifest', 'base.css']);
for (const p of paginas) {
  if (!existsSync(join(raiz, p))) continue;
  arquivos.add(p);
  for (const m of readFileSync(join(raiz, p), 'utf8').matchAll(/(?:href|src)="([^"#?:]+?)(?:\?[^"]*)?"/g)) {
    if (/^(https?:|\/|data:)/.test(m[1]) || /\.html$/.test(m[1])) continue; // links para outras páginas não entram
    if (/^img\//.test(m[1]) || existsSync(join(raiz, m[1]))) arquivos.add(m[1]);
  }
}
for (const f of arquivos) {
  if (!existsSync(join(raiz, f))) { console.error('faltando: ' + f); process.exit(1); }
  mkdirSync(dirname(join(saida, f)), { recursive: true });
  cpSync(join(raiz, f), join(saida, f));
}
cpSync(join(raiz, 'img'), join(saida, 'img'), { recursive: true });

// compressão prévia dos arquivos de texto
const COMPRIMIR = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest']);
let total = 0, comprimido = 0;
(function anda(d) {
  for (const n of readdirSync(d)) {
    const c = join(d, n);
    if (statSync(c).isDirectory()) { anda(c); continue; }
    if (!COMPRIMIR.has(extname(n))) continue;
    const b = readFileSync(c);
    writeFileSync(c + '.br', brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    writeFileSync(c + '.gz', gzipSync(b, { level: 9 }));
    total += b.length; comprimido += statSync(c + '.br').size;
  }
})(saida);
console.log('dist/publico pronto: ' + (total / 1024).toFixed(0) + ' KB de texto → ' + (comprimido / 1024).toFixed(0) + ' KB em brotli');
