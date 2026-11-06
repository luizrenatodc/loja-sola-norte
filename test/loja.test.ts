import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ErroLoja, Loja, RESERVA_MS, abrirBanco, semear, type Pagamento } from "../src/loja.ts";
import { criarServidor } from "../src/servidor.ts";

const SKU = "rota-couro-giz-40";
const CLIENTE = { nome: "Ana Teste", email: "ana@exemplo.com" };

function montar(pagamento?: Pagamento) {
  const db = abrirBanco();
  semear(db);
  db.prepare("UPDATE variantes SET estoque = 3 WHERE sku = ?").run(SKU);
  let agora = 1_000_000;
  const loja = new Loja(db, pagamento, () => agora);
  return { db, loja, avancar: (ms: number) => (agora += ms) };
}
const pedido = (extra = {}) => ({ carrinho: "c1", cliente: CLIENTE, cep: "15800-000", token: "tok_ok", chave: "chave-0001", ...extra });

test("reservar tira do disponível sem baixar o estoque", () => {
  const { loja, db } = montar();
  loja.definirItem("c1", SKU, 2);
  assert.equal(loja.disponivel(SKU), 1);
  assert.equal((db.prepare("SELECT estoque e FROM variantes WHERE sku = ?").get(SKU) as any).e, 3);
});

test("não reserva além do disponível", () => {
  const { loja } = montar();
  loja.definirItem("c1", SKU, 3);
  assert.throws(() => loja.definirItem("c2", SKU, 1), (e: ErroLoja) => e.codigo === "sem_estoque" && e.status === 409);
});

test("alterar a quantidade reserva apenas a diferença", () => {
  const { loja } = montar();
  loja.definirItem("c1", SKU, 3);
  loja.definirItem("c1", SKU, 1);
  assert.equal(loja.disponivel(SKU), 2);
  loja.definirItem("c1", SKU, 0);
  assert.equal(loja.disponivel(SKU), 3);
  assert.equal(loja.carrinho("c1").itens.length, 0);
});

test("reserva vencida volta ao estoque", () => {
  const { loja, avancar } = montar();
  loja.definirItem("c1", SKU, 3);
  avancar(RESERVA_MS + 1);
  assert.equal(loja.carrinho("c1").itens.length, 0);
  assert.equal(loja.disponivel(SKU), 3);
});

test("mexer no carrinho renova o prazo de todos os itens", () => {
  const { loja, avancar } = montar();
  loja.definirItem("c1", SKU, 1);
  avancar(RESERVA_MS - 1000);
  loja.definirItem("c1", "rota-couro-giz-41", 1);
  avancar(5000);
  assert.equal(loja.carrinho("c1").itens.length, 2);
});

test("pedido pago baixa estoque, limpa reserva e calcula o total", async () => {
  const { loja, db } = montar();
  loja.definirItem("c1", SKU, 1);
  const p = await loja.fechar(pedido({ cupom: "primeiro10" }));
  assert.equal(p.status, "pago");
  assert.equal(p.subtotal, 42900);
  assert.equal(p.desconto, 4290);
  assert.equal(p.frete, 1990);
  assert.equal(p.total, 40600);
  assert.equal((db.prepare("SELECT estoque e, reservado r FROM variantes WHERE sku = ?").get(SKU) as any).e, 2);
  assert.equal(loja.carrinho("c1").itens.length, 0);
});

test("a mesma chave não cobra duas vezes", async () => {
  let cobrancas = 0;
  const { loja } = montar({ cobrar: async (_v, _t, c) => (cobrancas++, { aprovado: true, id: c }) });
  loja.definirItem("c1", SKU, 1);
  const a = await loja.fechar(pedido());
  const b = await loja.fechar(pedido());
  assert.equal(a.id, b.id);
  assert.equal(cobrancas, 1);
});

test("pagamento recusado mantém a reserva e permite tentar de novo", async () => {
  const { loja } = montar();
  loja.definirItem("c1", SKU, 1);
  await assert.rejects(loja.fechar(pedido({ token: "tok_recusado" })), (e: ErroLoja) => e.codigo === "pagamento_recusado");
  assert.equal(loja.carrinho("c1").itens.length, 1);
  assert.equal((await loja.fechar(pedido())).status, "pago");
});

test("frete grátis considera o valor depois do desconto", async () => {
  const { loja } = montar();
  loja.definirItem("c1", "praca-oxford-preto-40", 1);
  assert.equal(loja.frete("01310-100", 1, 74900).valor, 0);
  assert.equal(loja.frete("01310-100", 1, 49899).valor, 1490);
  assert.equal(loja.frete("69000-000", 2, 1000).valor, 3490 + 800);
  assert.throws(() => loja.frete("123", 1, 1), (e: ErroLoja) => e.codigo === "cep_invalido");
});

test("cupom respeita mínimo e limite de usos", () => {
  const { loja, db } = montar();
  assert.throws(() => loja.cupom("NORTE15", 10000), (e: ErroLoja) => e.codigo === "cupom_minimo");
  assert.equal(loja.cupom("norte15", 40000).desconto, 6000);
  db.prepare("UPDATE cupons SET usos_restantes = 0 WHERE codigo = 'NORTE15'").run();
  assert.throws(() => loja.cupom("NORTE15", 40000), (e: ErroLoja) => e.codigo === "cupom_invalido");
});

test("oito processos disputando 20 pares nunca vendem além do estoque", async () => {
  const pasta = mkdtempSync(join(tmpdir(), "loja-"));
  const caminho = join(pasta, "t.db");
  const db = abrirBanco(caminho);
  semear(db);
  db.prepare("UPDATE variantes SET estoque = 20 WHERE sku = ?").run(SKU);
  const resultados = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      new Promise<number>((ok, falha) => {
        const p = fork(fileURLToPath(new URL("./disputa.ts", import.meta.url)), [caminho, SKU, String(i)]);
        p.on("message", (m) => ok(m as number));
        p.on("error", falha);
      }),
    ),
  );
  const vendidos = resultados.reduce((a, b) => a + b, 0);
  const v = db.prepare("SELECT estoque e, reservado r FROM variantes WHERE sku = ?").get(SKU) as any;
  assert.equal(vendidos, 20);
  assert.equal(v.r, 20);
  db.close();
  try {
    rmSync(pasta, { recursive: true, force: true });
  } catch {
    // No Windows o arquivo do banco pode seguir preso por instantes; é só uma pasta temporária.
  }
});

test("API: fluxo completo, erro tratado, chave obrigatória e caminho protegido", async () => {
  const { loja } = montar();
  const s = criarServidor(loja).listen(0);
  const base = `http://localhost:${(s.address() as any).port}`;
  const json = (m: string, u: string, b?: unknown, h = {}) => fetch(base + u, { method: m, body: b ? JSON.stringify(b) : undefined, headers: h });
  try {
    assert.equal((await (await json("GET", "/api/produtos")).json()).length, 8);
    assert.equal((await json("PUT", `/api/carrinho/c9/itens/${SKU}`, { qtd: 1 })).status, 200);
    assert.equal((await json("PUT", `/api/carrinho/c9/itens/nao-existe`, { qtd: 1 })).status, 404);
    const dados = { carrinho: "c9", cliente: CLIENTE, cep: "15800000", token: "tok_ok" };
    assert.equal((await json("POST", "/api/pedidos", dados)).status, 400);
    const r = await json("POST", "/api/pedidos", dados, { "idempotency-key": "abcd-1234" });
    assert.equal((await r.json()).status, "pago");
    assert.equal((await fetch(`${base}/favicon.ico`)).status, 404);
    assert.equal((await json("POST", "/api/frete", undefined)).status, 422);
  } finally {
    s.close();
  }
});
