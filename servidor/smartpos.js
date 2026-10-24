'use strict';
// Normalização do catálogo do SmartPOS: limpa o nome, extrai a unidade de venda e trata o estoque.
// Puro (sem banco), para ser testado e reutilizado pelo importador.

// Casos em que a origem cortou o nome em 40 caracteres: o que se sabe ao certo e o que foi deduzido.
// un: unidade deduzida de produtos irmãos; confirmar: true quando a quantidade da bandeja não aparece no que sobrou.
const AJUSTES = {
  '125': { nome: 'Bolinha de Camarão - Fritura', un: 'bandeja 12 und', deduzido: 'quantidade da bandeja cortada na origem; 12 und pelo grupo Farinha Pan e pelo preço (confirmar com a Júlia)' },
  '127': { nome: 'Bolinha de Caranguejo - Fritura', un: 'bandeja 12 und', deduzido: 'quantidade da bandeja cortada na origem; 12 und pelo grupo Farinha Pan e pelo preço (confirmar com a Júlia)' },
  '243': { nome: 'Bolinha de Peixe - Fritura', un: 'bandeja 24 und' }, // "C/ 2" cortado; o preço e o item irmão (24) confirmam
  '124': { nome: 'Camarão Empanado c/ Cream Cheese - Fritura', un: 'bandeja 12 und', deduzido: 'quantidade da bandeja cortada na origem; 12 und pelo grupo Farinha Pan e pelo preço (confirmar com a Júlia)' },
  '128': { nome: 'Camarão Empanado Tradicional - Fritura', un: 'bandeja 12 und', deduzido: 'quantidade da bandeja cortada na origem; 12 und pelo grupo Farinha Pan e pelo preço (confirmar com a Júlia)' },
  '165': { nome: 'Buchada Fechada de Carneiro Temperada', un: 'kg' },
  '135': { nome: 'Filé de Camarão G2 36/40 - IQF - Eviscerado', un: 'kg', deduzido: 'unidade igual à dos irmãos do mesmo calibre' },
  '140': { nome: 'Filé de Camarão GG 31/35 - IQF - Eviscerado', un: 'kg', deduzido: 'unidade igual à dos irmãos do mesmo calibre' },
  '145': { nome: 'Filé de Camarão XG 26/30 - Eviscerado', un: 'kg', deduzido: 'nome termina em "-" cortado' },
  '147': { nome: 'Filé de Camarão XGG 21/25 - Eviscerado', un: 'kg', deduzido: 'nome termina em "-" cortado' },
  '116': { nome: 'Galinha Caipira Neutra', un: 'unidade', desc: 'Unidade com cerca de 1,2 kg.', deduzido: 'peso "~ 1.20" cortado na origem' },
  '120': { nome: 'Tilápia Inteira Tratada e Desossada', un: 'peça' },
  '168': { nome: 'Frango Cozido Temperado e Desfiado', un: '500 g' }
};

const MIUDAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'em', 'a', 'c/', 's/']);

function titulo(t) {
  return t.split(/\s+/).map((w, i) => {
    const b = w.toLowerCase();
    if (i > 0 && MIUDAS.has(b)) return b;
    if (/\d/.test(w) || /^[A-Z]{1,4}$/.test(w)) return w; // calibres e siglas (XGG, IQF, JP, G1)
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

// Tira do nome o trecho da unidade e devolve { base, un } (un vazio quando o nome não diz).
function unidadeDoNome(nome) {
  let n = nome.trim(), un = '';
  const pega = (re, f) => { const m = n.match(re); if (m) { un = f(m); n = n.replace(re, ' '); } };
  pega(/\(\s*(?:bandeja|bdj)\s*c\/\s*(\d+)\s*(?:und?\.?)?\s*\)?/i, (m) => 'bandeja ' + m[1] + ' und');
  if (!un) pega(/\(\s*(\d+)\s*(?:und?\.?|unid\.?)\s*\)/i, (m) => m[1] + ' und');
  if (!un) pega(/[-–]\s*(\d+)\s*und\b/i, (m) => m[1] + ' und');
  if (!un) pega(/\(\s*(\d+)\s*gr?s?\s*\)/i, (m) => m[1] + ' g');
  if (!un) pega(/\(\s*kg\s*\)/i, () => 'kg');
  return { base: n, un };
}

function limpaNome(base) {
  let n = base.replace(/\bEvisverado\b/i, 'Eviscerado').replace(/\bEvisc\.?(?=\s)/i, 'Eviscerado')
    .replace(/\bCreamCheese\b/i, 'Cream Cheese').replace(/\bS\/(?=\S)/gi, 's/ ').replace(/Frango-Fritura/i, 'Frango - Fritura')
    .replace(/\(\s*$/, '').replace(/\s*[-–]\s*$/, '').replace(/\s*\(\s*\w*\s*$/, '').replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ').replace(/\s+-\s*$/, '').trim();
  return titulo(n).replace(/\bC\//g, 'c/').replace(/\bS\//g, 's/');
}

// produto do SmartPOS -> produto do sistema (+ avisos para o relatório)
function normaliza(p) {
  const codigo = String(p.codigo).trim(), aj = AJUSTES[codigo], avisos = [];
  const { base, un: unNome } = unidadeDoNome(p.nome);
  let nome = limpaNome(base), un = unNome;
  if (/\(Kg\)\s*IQF/i.test(p.nome)) un = 'kg'; // "Camarão Sem Cabeça (Kg) IQF": o IQF fica no nome
  if (/\(Kg\)\s*IQF/i.test(p.nome)) nome = limpaNome(p.nome.replace(/\(Kg\)/i, ''));
  let desc = '', deduzido = '';
  if (aj) { nome = aj.nome; un = aj.un; desc = aj.desc || ''; deduzido = aj.deduzido || ''; if (aj.confirmar) avisos.push(aj.confirmar); }
  if (!un) { // sem unidade no nome
    if (/^(Tempero Extra)/i.test(nome)) un = 'unidade';
    else { un = 'kg'; deduzido = 'sem unidade no nome; pelo grupo (peixe/camarão a granel) assumi kg'; }
  }
  if (deduzido) avisos.push(deduzido);
  const bruto = +p.estoque || 0, estoque = bruto < 0 ? 0 : bruto;
  return {
    codigo, nome, un, cat: titulo(p.categoria), preco: +p.preco, estoque, bruto, desc, avisos,
    nomeOriginal: p.nome, negativo: bruto < 0
  };
}

module.exports = { normaliza, titulo, unidadeDoNome, limpaNome };
