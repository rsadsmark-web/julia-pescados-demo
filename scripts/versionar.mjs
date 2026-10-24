// Carimba ?v=<hash do conteúdo> em cada css/js referenciado pelas páginas. Assim o navegador e a Cloudflare podem guardar
// o arquivo "para sempre" (immutable) e, quando o conteúdo muda, o endereço muda junto. Idempotente; roda antes do build.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let mudou = 0;
for (const pg of readdirSync(raiz).filter((f) => f.endsWith('.html'))) {
  const orig = readFileSync(join(raiz, pg), 'utf8');
  const novo = orig.replace(/((?:href|src)=")(\/?)([^"#?:\/][^"#?:]*\.(?:css|js))(?:\?v=[^"]*)?(")/g, (tudo, a, barra, arq, z) => { // a barra inicial vale para as telas de /e/<token> e /r/<token>
    if (!existsSync(join(raiz, arq))) return tudo;
    return a + barra + arq + '?v=' + createHash('sha1').update(readFileSync(join(raiz, arq))).digest('hex').slice(0, 10) + z;
  });
  if (novo !== orig) { writeFileSync(join(raiz, pg), novo); mudou++; }
}
console.log('versionar: ' + mudou + ' página(s) atualizada(s)');
