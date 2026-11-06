import { sapato } from "./sapatos.js";
import { criarApi } from "./api.js";

const app = document.getElementById("app");
const $ = (s, r = document) => r.querySelector(s);
const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const id = (() => {
  try {
    const salvo = localStorage.getItem("carrinho") ?? crypto.randomUUID();
    localStorage.setItem("carrinho", salvo);
    return salvo;
  } catch {
    return crypto.randomUUID();
  }
})();

const api = await criarApi(id);
let produtos = await api.produtos();
let carrinho = await api.carrinho();
let relogio = 0;

const corDe = (p, corId) => p.cores.find((c) => c.id === corId) ?? p.cores[0];
const cartao = (p) => `<a class="cartao" href="#/produto/${p.slug}">
  <div class="cartao-arte">${sapato(p.modelo, p.cores[0], p.nome)}</div>
  <div class="cartao-linha"><span>${p.nome}</span><span>${brl(p.preco)}</span></div>
  <small>${p.categoria}</small>
  <div class="pontos">${p.cores.map((c) => `<i style="background:${c.corpo}" title="${c.nome}"></i>`).join("")}</div></a>`;

function inicio() {
  const destaque = produtos[1];
  app.innerHTML = `<section class="heroi"><div class="heroi-texto"><h1>Feito para andar longe.</h1>
    <p>Calçados de couro com solado costurado, que aceitam conserto em vez de virar descarte.</p>
    <a class="botao" href="#/colecao">Ver a coleção</a></div>
    <a class="heroi-arte" href="#/produto/${destaque.slug}">${sapato(destaque.modelo, destaque.cores[1], destaque.nome)}<span class="heroi-legenda">${destaque.nome}, em ${destaque.cores[1].nome.toLowerCase()} · ${brl(destaque.preco)}</span></a></section>
  <section class="selos"><div><b>Solado trocável</b><span>Conserto para toda a vida útil do par</span></div><div><b>30 dias para trocar</b><span>O primeiro par volta sem custo</span></div><div><b>Reserva de 15 minutos</b><span>O tamanho fica seu enquanto decide</span></div></section>
  <section class="secao"><div class="secao-topo"><h2>Os mais pedidos</h2><a href="#/colecao">Ver tudo</a></div><div class="grade">${produtos.slice(0, 4).map(cartao).join("")}</div></section>
  <section class="secao manifesto"><h2>Um par bom custa mais uma vez. Um par ruim custa todo ano.</h2>
    <ol><li><b>Couro curtido ao vegetal</b><span>Envelhece com o uso, sem descascar.</span></li><li><b>Costura em vez de cola</b><span>É o que permite trocar a sola depois.</span></li><li><b>Palmilha de cortiça</b><span>Molda ao pé nas primeiras semanas.</span></li></ol></section>`;
}

const estadoColecao = { tamanho: null, ordem: "padrao" };
function colecao(categoria) {
  const cats = [...new Set(produtos.map((p) => p.categoria))];
  let lista = produtos.filter((p) => !categoria || p.categoria === categoria);
  if (estadoColecao.tamanho) lista = lista.filter((p) => p.variantes.some((v) => v.tamanho === estadoColecao.tamanho && v.disponivel > 0));
  if (estadoColecao.ordem !== "padrao") lista = [...lista].sort((a, b) => (estadoColecao.ordem === "menor" ? a.preco - b.preco : b.preco - a.preco));
  app.innerHTML = `<section class="secao"><div class="secao-topo"><h2>${esc(categoria ?? "Coleção")}</h2>
    <div class="filtros"><button aria-pressed="${!categoria}" data-cat="">Todos</button>${cats.map((c) => `<button aria-pressed="${c === categoria}" data-cat="${c}">${c}</button>`).join("")}
    <select id="tam" aria-label="Filtrar por tamanho"><option value="">Tamanho</option>${Array.from({ length: 11 }, (_, i) => 34 + i).map((t) => `<option ${t === estadoColecao.tamanho ? "selected" : ""}>${t}</option>`).join("")}</select>
    <select id="ord" aria-label="Ordenar"><option value="padrao">Relevância</option><option value="menor" ${estadoColecao.ordem === "menor" ? "selected" : ""}>Menor preço</option><option value="maior" ${estadoColecao.ordem === "maior" ? "selected" : ""}>Maior preço</option></select></div></div>
    <div class="grade">${lista.map(cartao).join("") || "<p>Nenhum modelo disponível nesse tamanho.</p>"}</div></section>`;
  app.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => (location.hash = b.dataset.cat ? `#/colecao/${b.dataset.cat}` : "#/colecao")));
  $("#tam").onchange = (e) => ((estadoColecao.tamanho = +e.target.value || null), colecao(categoria));
  $("#ord").onchange = (e) => ((estadoColecao.ordem = e.target.value), colecao(categoria));
}

function produto(slug) {
  const p = produtos.find((x) => x.slug === slug);
  if (!p) return void (location.hash = "#/colecao");
  let cor = p.cores[0].id;
  let tamanho = null;
  const desenhar = () => {
    const c = corDe(p, cor);
    const vs = p.variantes.filter((v) => v.cor === cor);
    const sel = vs.find((v) => v.tamanho === tamanho);
    const aviso = sel && sel.disponivel > 0 && sel.disponivel <= 2 ? sel.disponivel === 1 ? "Resta 1 neste tamanho" : `Restam ${sel.disponivel} neste tamanho` : "";
    app.innerHTML = `<section class="produto"><div class="produto-arte">${sapato(p.modelo, c, `${p.nome} em ${c.nome}`)}</div><div>
      <div class="migalha"><a href="#/colecao/${p.categoria}">${p.categoria}</a> / ${p.nome}</div><h1>${p.nome}</h1>
      <p class="preco">${brl(p.preco)}</p><p class="parcela">ou 6x de ${brl(Math.ceil(p.preco / 6))} sem juros</p>
      <div class="rotulo">Cor <span>${c.nome}</span></div><div class="cores">${p.cores.map((x) => `<button style="background:${x.corpo}" aria-label="${x.nome}" aria-pressed="${x.id === cor}" data-cor="${x.id}"></button>`).join("")}</div>
      <div class="rotulo">Tamanho <span>Forma regular</span></div><div class="tamanhos">${vs.map((v) => `<button data-t="${v.tamanho}" aria-pressed="${v.tamanho === tamanho}" ${v.disponivel <= 0 ? "disabled" : ""}>${v.tamanho}</button>`).join("")}</div>
      <p class="alerta">${aviso}</p><button class="botao inteiro" id="add" ${sel ? "" : "disabled"}>${sel ? "Adicionar à sacola" : "Escolha um tamanho"}</button>
      <p class="descricao">${p.descricao}</p></div></section>`;
    app.querySelectorAll("[data-cor]").forEach((b) => (b.onclick = () => ((cor = b.dataset.cor), (tamanho = null), desenhar())));
    app.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => ((tamanho = +b.dataset.t), desenhar())));
    if (sel) $("#add").onclick = async () => {
      const atual = carrinho.itens.find((i) => i.sku === sel.sku)?.qtd ?? 0;
      try {
        await mudarItem(sel.sku, atual + 1);
        abrirSacola();
        desenhar();
      } catch (e) {
        avisar(e.message);
        desenhar();
      }
    };
  };
  desenhar();
}

async function mudarItem(sku, qtd) {
  try {
    carrinho = await api.item(sku, qtd);
  } finally {
    produtos = await api.produtos();
  }
  atualizarSacola();
}

const linhaItem = (i) => {
  const p = produtos.find((x) => x.slug === i.produto);
  const c = corDe(p, i.cor);
  return `<div class="item"><div class="item-arte">${sapato(p.modelo, c, i.nome)}</div><div>${i.nome}<small>${c.nome} · ${i.tamanho}</small>
    <span class="qtd"><button data-sku="${i.sku}" data-q="${i.qtd - 1}" aria-label="Diminuir">−</button>${i.qtd}<button data-sku="${i.sku}" data-q="${i.qtd + 1}" aria-label="Aumentar">+</button></span></div><span>${brl(i.preco * i.qtd)}</span></div>`;
};

function atualizarSacola() {
  $("#qtd").textContent = carrinho.pares;
  const g = $("#gaveta");
  g.innerHTML = `<header><h2>Sacola</h2><button id="fechar" aria-label="Fechar sacola">Fechar</button></header>
    <div class="gaveta-itens">${carrinho.itens.map(linhaItem).join("") || "<p>Sua sacola está vazia.</p>"}</div>
    ${carrinho.itens.length ? `<footer><p class="relogio" id="relogio"></p><div class="linha total"><span>Subtotal</span><span>${brl(carrinho.subtotal)}</span></div><a class="botao inteiro" style="margin-top:14px" href="#/checkout" id="ir">Finalizar compra</a></footer>` : ""}`;
  $("#fechar").onclick = fecharSacola;
  if ($("#ir")) $("#ir").onclick = fecharSacola;
  ligarQtd(g);
}

function ligarQtd(raiz, depois) {
  raiz.querySelectorAll("[data-sku]").forEach((b) => (b.onclick = async () => {
    try {
      await mudarItem(b.dataset.sku, +b.dataset.q);
      depois?.();
    } catch (e) {
      avisar(e.message);
    }
  }));
}

function abrirSacola() {
  $("#gaveta").classList.add("aberta");
  $("#gaveta").setAttribute("aria-hidden", "false");
  $("#veu").hidden = false;
}
function fecharSacola() {
  $("#gaveta").classList.remove("aberta");
  $("#gaveta").setAttribute("aria-hidden", "true");
  $("#veu").hidden = true;
}

function tiquetaque() {
  clearInterval(relogio);
  relogio = setInterval(() => {
    const el = $("#relogio");
    if (!el || !carrinho.expira) return;
    const s = Math.max(0, Math.round((carrinho.expira - Date.now()) / 1000));
    el.textContent = `Itens reservados por ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);
}

function checkout() {
  if (!carrinho.itens.length) return void (location.hash = "#/colecao");
  const estado = { frete: null, cupom: null, chave: crypto.randomUUID() };
  app.innerHTML = `<section class="checkout"><form id="f" novalidate><h1>Finalizar compra</h1>
    <h2>Seus dados</h2><div class="campos"><label class="campo">Nome<input name="nome" autocomplete="name" required value="Marina Costa"></label><label class="campo">E-mail<input name="email" type="email" autocomplete="email" required value="marina@exemplo.com"></label></div>
    <h2>Entrega</h2><div class="campos"><label class="campo">CEP<input name="cep" id="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="15800-000"></label><div class="campo"><span>Prazo</span><p id="prazo" style="margin:10px 0 0;font-weight:400">Informe o CEP</p></div></div>
    <h2>Pagamento</h2><div class="campos"><label class="campo largo">Número do cartão<input name="cartao" inputmode="numeric" value="4242 4242 4242 4242"></label></div>
    <p class="erro" id="erro" role="alert"></p><button class="botao inteiro" id="pagar">Pagar</button></form>
    <aside class="resumo"><div id="itens"></div><div class="cupom"><input id="cod" placeholder="Cupom" aria-label="Cupom"><button type="button" id="aplicar">Aplicar</button></div><div id="valores"></div></aside></section>`;
  const totais = () => {
    const desconto = estado.cupom?.desconto ?? 0;
    const frete = estado.frete?.valor ?? 0;
    const total = carrinho.subtotal - desconto + frete;
    $("#itens").innerHTML = carrinho.itens.map(linhaItem).join("");
    ligarQtd($("#itens"), () => (carrinho.itens.length ? recalcular() : (location.hash = "#/colecao")));
    $("#valores").innerHTML = `<div class="linha"><span>Subtotal</span><span>${brl(carrinho.subtotal)}</span></div>${desconto ? `<div class="linha"><span>Cupom ${estado.cupom.codigo}</span><span>− ${brl(desconto)}</span></div>` : ""}<div class="linha"><span>Frete</span><span>${estado.frete ? (frete ? brl(frete) : "Grátis") : "—"}</span></div><div class="linha total"><span>Total</span><span>${brl(total)}</span></div>`;
    $("#pagar").textContent = `Pagar ${brl(total)}`;
  };
  const recalcular = async () => {
    $("#erro").textContent = "";
    try {
      estado.frete = await api.frete($("#cep").value);
      $("#prazo").textContent = `${estado.frete.regiao}: até ${estado.frete.dias} dias úteis`;
      if (estado.cupom) estado.cupom = await api.cupom(estado.cupom.codigo);
    } catch (e) {
      estado.frete = null;
      $("#prazo").textContent = e.message;
    }
    totais();
  };
  $("#cep").onchange = recalcular;
  $("#aplicar").onclick = async () => {
    $("#erro").textContent = "";
    try {
      estado.cupom = await api.cupom($("#cod").value);
      totais();
    } catch (e) {
      $("#erro").textContent = e.message;
    }
  };
  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = new FormData(ev.target);
    const b = $("#pagar");
    b.disabled = true;
    b.textContent = "Processando";
    try {
      const pedido = await api.fechar({ cliente: { nome: d.get("nome"), email: d.get("email") }, cep: d.get("cep"), cupom: estado.cupom?.codigo, token: String(d.get("cartao")).replace(/\D/g, "").endsWith("0002") ? "tok_recusado" : "tok_ok" }, estado.chave);
      carrinho = await api.carrinho();
      produtos = await api.produtos();
      atualizarSacola();
      location.hash = `#/obrigado/${pedido.id}/${pedido.total}`;
    } catch (e) {
      $("#erro").textContent = e.message;
      b.disabled = false;
      totais();
    }
  };
  recalcular();
}

function obrigado(pedido, total) {
  const p = produtos[0];
  app.innerHTML = `<section class="obrigado">${sapato(p.modelo, p.cores[1], "")}<h1>Pedido confirmado.</h1><p>Seu pedido <span class="codigo">${esc(pedido)}</span> foi registrado, no total de ${brl(+total)}.</p><p>Esta é uma loja de demonstração: nada foi cobrado nem será enviado.</p><a class="botao" style="margin:12px auto" href="#/colecao">Voltar à coleção</a></section>`;
}

function rotear() {
  const [, rota, a, b] = decodeURIComponent(location.hash).replace(/^#/, "").split("/");
  scrollTo(0, 0);
  if (rota === "colecao") colecao(a);
  else if (rota === "produto") produto(a);
  else if (rota === "checkout") checkout();
  else if (rota === "obrigado") obrigado(a, b);
  else inicio();
}

let toastT = 0;
function avisar(texto) {
  const t = $("#toast");
  t.textContent = texto;
  t.classList.add("ver");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("ver"), 3200);
}

$("#abrir-sacola").onclick = abrirSacola;
$("#veu").onclick = fecharSacola;
addEventListener("keydown", (e) => e.key === "Escape" && fecharSacola());
addEventListener("hashchange", rotear);
atualizarSacola();
tiquetaque();
rotear();
