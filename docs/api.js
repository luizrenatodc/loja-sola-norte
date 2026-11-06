/**
 * Mesma interface em dois modos. Com o servidor, fala com /api. Publicada como
 * página estática, onde não há backend, usa o catálogo exportado e guarda o
 * carrinho no navegador. As garantias de estoque só valem no modo servidor.
 */
async function pedir(url, opcoes) {
  const r = await fetch(url, opcoes);
  const d = await r.json();
  if (!r.ok) throw new Error(d.mensagem ?? "Não foi possível concluir");
  return d;
}

const json = (corpo, cabecalhos = {}) => ({ method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json", ...cabecalhos } });

function modoServidor(id) {
  return {
    produtos: () => pedir("/api/produtos"),
    carrinho: () => pedir(`/api/carrinho/${id}`),
    item: (sku, qtd) => pedir(`/api/carrinho/${id}/itens/${encodeURIComponent(sku)}`, { ...json({ qtd }), method: "PUT" }),
    frete: (cep) => pedir("/api/frete", json({ cep, carrinho: id })),
    cupom: (codigo) => pedir("/api/cupom", json({ codigo, carrinho: id })),
    fechar: (dados, chave) => pedir("/api/pedidos", json({ ...dados, carrinho: id }, { "idempotency-key": chave })),
  };
}

async function modoEstatico() {
  const lista = await (await fetch("catalogo.json")).json();
  const ler = () => {
    try {
      return JSON.parse(localStorage.getItem("sacola") ?? "{}");
    } catch {
      return {};
    }
  };
  let sacola = ler();
  const guardar = () => {
    try {
      localStorage.setItem("sacola", JSON.stringify(sacola));
    } catch {}
  };
  const achar = (sku) => {
    for (const p of lista) {
      const v = p.variantes.find((x) => x.sku === sku);
      if (v) return { p, v };
    }
  };
  const ver = () => {
    const itens = Object.entries(sacola).map(([sku, qtd]) => {
      const { p, v } = achar(sku);
      return { sku, qtd, preco: p.preco, nome: p.nome, produto: p.slug, modelo: p.modelo, cor: v.cor, tamanho: v.tamanho };
    });
    return { itens, subtotal: itens.reduce((t, i) => t + i.preco * i.qtd, 0), pares: itens.reduce((t, i) => t + i.qtd, 0), expira: itens.length ? Date.now() + 900000 : null };
  };
  const api = {
    produtos: async () => lista.map((p) => ({ ...p, variantes: p.variantes.map((v) => ({ ...v, disponivel: v.disponivel - (sacola[v.sku] ?? 0) })) })),
    carrinho: async () => ver(),
    async item(sku, qtd) {
      if (qtd > achar(sku).v.disponivel) throw new Error("Este tamanho acabou de esgotar");
      if (qtd <= 0) delete sacola[sku];
      else sacola[sku] = qtd;
      guardar();
      return ver();
    },
    async frete(cep) {
      const n = cep.replace(/\D/g, "");
      if (n.length !== 8) throw new Error("Informe um CEP com 8 dígitos");
      const c = ver();
      return { regiao: "Entrega padrão", valor: c.subtotal >= 49900 ? 0 : 1990 + 400 * Math.max(0, c.pares - 1), dias: 4 };
    },
    async cupom(codigo) {
      const regra = { PRIMEIRO10: [10, 0], NORTE15: [15, 39900] }[codigo.trim().toUpperCase()];
      const { subtotal } = ver();
      if (!regra) throw new Error("Cupom inválido ou esgotado");
      if (subtotal < regra[1]) throw new Error("Este cupom vale a partir de R$ 399,00");
      return { codigo: codigo.trim().toUpperCase(), percentual: regra[0], desconto: Math.round((subtotal * regra[0]) / 100) };
    },
    async fechar(dados) {
      if (dados.token === "tok_recusado") throw new Error("Cartão recusado pelo emissor");
      const c = ver();
      const desconto = dados.cupom ? (await api.cupom(dados.cupom)).desconto : 0;
      const total = c.subtotal - desconto + (await api.frete(dados.cep)).valor;
      sacola = {};
      guardar();
      return { id: `SN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, total };
    },
  };
  return api;
}

export async function criarApi(id) {
  try {
    const r = await fetch("/api/produtos");
    if (r.ok && r.headers.get("content-type")?.includes("json")) return modoServidor(id);
  } catch {}
  return modoEstatico();
}
