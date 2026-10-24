'use strict';
// Importa o catálogo do SmartPOS (JSON extraído da API pública) para o estado do painel (kv jp_demo_v1).
// Idempotente: o código do SmartPOS é o código do produto; rodar de novo atualiza em vez de duplicar.
// Uso (na VPS): docker compose exec app node servidor/importar-smartpos.js docs/catalogo.json [--simular] [--manter-estoque] [--relatorio saida.md]
//   --simular         só mostra o que mudaria
//   --manter-estoque  reimportação: atualiza nome, preço, unidade e categoria, mas deixa o saldo de estoque do sistema como está
const fs = require('fs');
const { pool, iniciaBanco } = require('./server');
const path = require('path');
const { normaliza, titulo } = require('./smartpos');

const CHAVE = 'jp_demo_v1';
const IMG_PADRAO = 'sem-foto.svg'; // produto sem foto na origem
const DIR_IMG = path.join(process.env.SITE_DIR || path.join(__dirname, '..'), 'img');
const fotoDe = (codigo) => (fs.existsSync(path.join(DIR_IMG, 'produtos', codigo + '.webp')) ? 'produtos/' + codigo + '.webp' : IMG_PADRAO);
const MIN_PADRAO = 1;              // alerta de estoque baixo a partir de 1 unidade

async function importa(arquivo, { simular = false, manterEstoque = false } = {}) {
  const origem = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const novos = origem.produtos.map(normaliza);
  const ordemCat = (origem.categorias || []).map(titulo);
  novos.sort((a, b) => ordemCat.indexOf(a.cat) - ordemCat.indexOf(b.cat) || a.nome.localeCompare(b.nome, 'pt-BR') || a.un.localeCompare(b.un));

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query('SELECT valor, versao FROM kv WHERE chave = $1 FOR UPDATE', [CHAVE]);
    const estado = r.rows[0] ? JSON.parse(r.rows[0].valor)
      : { produtos: [], clientes: [], motoboys: [], pedidos: [], leads: [], notas: [], baixas: [], seq: 1001 };
    const porCodigo = new Map(estado.produtos.filter((p) => p.codigo).map((p) => [p.codigo, p]));
    const demo = estado.produtos.filter((p) => !p.codigo && /^p\d+$/.test(p.id)); // produtos de demonstração (camarão cinza, kits…)
    const outros = estado.produtos.filter((p) => !p.codigo && !/^p\d+$/.test(p.id)); // cadastrados à mão: ficam

    let criados = 0, atualizados = 0;
    const lista = novos.map((n) => {
      const atual = porCodigo.get(n.codigo);
      const p = Object.assign({}, atual, {
        id: atual ? atual.id : 's' + n.codigo, codigo: n.codigo, nome: n.nome, cat: n.cat, un: n.un, preco: n.preco,
        estoque: manterEstoque && atual ? atual.estoque : n.estoque, min: atual && atual.min != null ? atual.min : MIN_PADRAO,
        img: fotoDe(n.codigo),
        desc: atual && atual.desc ? atual.desc : n.desc
      });
      if (atual) atualizados++; else criados++;
      return p;
    });
    estado.produtos = lista.concat(outros);

    const rel = relatorio(origem, novos, { criados, atualizados, removidosDemo: demo.length, manterEstoque, simular });
    if (simular) { await c.query('ROLLBACK'); return rel; }
    await c.query(
      `INSERT INTO kv (chave, valor, versao) VALUES ($1,$2,1)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, versao = kv.versao + 1, atualizado = now()`, [CHAVE, JSON.stringify(estado)]);
    await c.query('COMMIT');
    // atualiza o catálogo público (arquivo estático); a rota pública não é usada aqui, então o app é um molde vazio
    await require('./publico')({ get() {}, post() {} }, pool).publica();
    return rel;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

function relatorio(origem, novos, o) {
  const L = [];
  const porCat = {}; novos.forEach((n) => { porCat[n.cat] = (porCat[n.cat] || 0) + 1; });
  L.push(`# Importação do catálogo SmartPOS (${origem.extraido_em})`, '',
    `${o.simular ? 'SIMULAÇÃO — nada foi gravado. ' : ''}Produtos: ${novos.length} (${o.criados} novos, ${o.atualizados} atualizados). Produtos de demonstração removidos: ${o.removidosDemo}.` +
    (o.manterEstoque ? ' Estoque do sistema mantido.' : ''), '', '## Por categoria');
  Object.keys(porCat).forEach((k) => L.push(`- ${k}: ${porCat[k]}`));
  L.push('', '## Ajustes de nome e unidade');
  novos.forEach((n) => { if (n.nome !== n.nomeOriginal) L.push(`- ${n.codigo}: "${n.nomeOriginal}" → "${n.nome}" (unidade: ${n.un})${n.avisos.length ? ' — ' + n.avisos.join('; ') : ''}`); });
  L.push('', '## Estoque negativo na origem (levado como zero)');
  const neg = novos.filter((n) => n.negativo);
  neg.forEach((n) => L.push(`- ${n.codigo} ${n.nome}: ${n.bruto} → 0`));
  if (!neg.length) L.push('- nenhum');
  const zero = novos.filter((n) => n.estoque === 0);
  L.push('', `## Indisponíveis (estoque zero): ${zero.length}`);
  zero.forEach((n) => L.push(`- ${n.codigo} ${n.nome}${n.negativo ? ' (era negativo)' : ''}`));
  return L.join('\n');
}

module.exports = { importa };
if (require.main === module) {
  const args = process.argv.slice(2), arquivo = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--relatorio');
  const i = args.indexOf('--relatorio'), saida = i >= 0 ? args[i + 1] : null;
  if (!arquivo) { console.error('Uso: node servidor/importar-smartpos.js <catalogo.json> [--simular] [--manter-estoque] [--relatorio saida.md]'); process.exit(1); }
  (async () => {
    await iniciaBanco();
    const rel = await importa(arquivo, { simular: args.includes('--simular'), manterEstoque: args.includes('--manter-estoque') });
    console.log(rel); if (saida) fs.writeFileSync(saida, rel + '\n');
    await pool.end();
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
