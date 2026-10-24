'use strict';
// Validação do pedido da loja pública. O servidor refaz a conta com o catálogo e a configuração da loja que ele tem:
// preço, taxa de entrega e mínimo vêm daqui, nunca do que o navegador mandou.
const path = require('path');
const L = require(path.join(process.env.SITE_DIR || path.join(__dirname, '..'), 'loja-lib.js'));

const MAX_ITENS = 40;
const PAGAMENTOS = ['Pix', 'Dinheiro', 'Cartão na entrega', 'Cartão na retirada', 'Pagar na retirada'];
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const digitos = (v) => String(v || '').replace(/\D/g, '');
const brl = (v) => 'R$ ' + (+v).toFixed(2).replace('.', ',');

// devolve { erro } ou o pedido pronto para a fila
function validaPedido(b, catalogo, config, opcoes) {
  b = b || {}; opcoes = opcoes || {};
  const cfg = L.mescla(config), atacado = !!(opcoes.atacado || b.atacadoId);
  const codigo = txt(b.id, 20).toUpperCase();
  if (!/^JP-[A-Z0-9]{4,10}$/.test(codigo)) return { erro: 'Pedido inválido.' };

  const combos = new Map(L.combosAtivos(cfg, catalogo).map((c) => [c.id, c]));
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const itens = [];
  for (const i of (Array.isArray(b.itens) ? b.itens : []).slice(0, MAX_ITENS)) {
    const id = txt(i && i.id, 30), obs = txt(i && i.obs, 120);
    const combo = combos.get(id), p = combo ? L.comboComoProduto(combo, catalogo) : porId.get(id);
    if (!p) continue;
    const qtd = L.arredonda(p, i.qtd);
    if (!(qtd > 0) || qtd > 500) continue;
    if (qtd > p.estoque) return { erro: 'Estoque insuficiente de ' + p.nome + '.' };
    let preco = combo ? +combo.preco : L.precoEfetivo(p);
    if (atacado && !combo && +i.preco > 0 && +i.preco < preco) preco = +i.preco; // atacado: tabela de restaurantes, sempre menor
    const linha = { id: p.id, nome: p.nome, un: p.un, preco, qtd };
    if (obs) linha.obs = obs;
    if (combo) linha.combo = combo.itens.map((c) => [c[0], c[1]]);
    itens.push(linha);
  }
  const fone = digitos(b.fone), nome = txt(b.cliente, 80);
  if (!itens.length) return { erro: 'Pedido incompleto: nenhum item válido.' };
  if (fone.length < 10 || fone.length > 13) return { erro: 'Pedido incompleto: informe um WhatsApp válido com DDD.' };
  if (!nome) return { erro: 'Pedido incompleto: informe o nome.' };

  const entrega = b.tipo === 'entrega';
  let taxa = 0, bairro = '', endereco = '', kmEntrega;
  if (entrega) {
    const f = L.frete(cfg, b.bairro);
    if (!f) return { erro: 'Escolha um bairro da lista de entrega.' };
    endereco = txt(b.endereco, 200);
    if (!endereco) return { erro: 'Informe o endereço de entrega.' };
    taxa = f.taxa; bairro = f.bairro.nome; kmEntrega = Math.round(f.km * 10) / 10;
  }
  const sub = itens.reduce((t, i) => t + Math.round(i.preco * 100) * i.qtd, 0) / 100;
  const m = L.minimo(cfg, sub);
  if (!atacado && !m.ok) return { erro: 'O pedido mínimo é ' + brl(m.minimo) + '. Faltam ' + brl(m.falta) + ' para fechar.' };

  return {
    id: codigo, cliente: nome, fone: txt(b.fone, 20), tipo: entrega ? 'entrega' : 'retirada', bairro, endereco, obs: txt(b.obs, 300),
    pagamento: PAGAMENTOS.includes(b.pagamento) ? b.pagamento : txt(b.pagamento, 30), itens, taxa, km: kmEntrega,
    criado: Date.now(), status: 'novo', confirmado: false, baixa: false, pago: false, motoboy: null, fixo: null, origemSite: true,
    agendado: txt(b.agendado, 60) || undefined, recompra: b.recompra ? true : undefined, atacadoId: atacado ? txt(b.atacadoId, 20) || undefined : undefined
  };
}

module.exports = { validaPedido, txt, digitos };
