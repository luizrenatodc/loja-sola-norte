/**
 * Domínio da loja. Toda regra de dinheiro e estoque fica aqui, sem HTTP.
 * Valores em centavos. O relógio é injetado para testar a expiração de reservas.
 */
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CATALOGO } from "./catalogo.ts";

export const RESERVA_MS = 15 * 60_000;

export class ErroLoja extends Error {
  readonly codigo: string;
  readonly status: number;
  constructor(codigo: string, mensagem: string, status = 422) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

export interface Pagamento {
  cobrar(valor: number, token: string, chave: string): Promise<{ aprovado: boolean; id: string; motivo?: string }>;
}

/** Gateway simulado. O token de teste decide o resultado, como em ambientes de sandbox. */
export const pagamentoSimulado: Pagamento = {
  async cobrar(_valor, token, chave) {
    if (token === "tok_recusado") return { aprovado: false, id: chave, motivo: "Cartão recusado pelo emissor" };
    return { aprovado: true, id: `pay_${chave.slice(0, 8)}` };
  },
};

export interface Cliente {
  nome: string;
  email: string;
}

const REGIOES: { prefixo: string; nome: string; base: number; porPar: number; dias: number }[] = [
  { prefixo: "01", nome: "Capital SP", base: 1490, porPar: 300, dias: 2 },
  { prefixo: "0", nome: "Grande SP", base: 1790, porPar: 300, dias: 3 },
  { prefixo: "1", nome: "Interior SP", base: 1990, porPar: 400, dias: 3 },
  { prefixo: "2", nome: "RJ e ES", base: 2490, porPar: 500, dias: 4 },
  { prefixo: "3", nome: "MG", base: 2490, porPar: 500, dias: 4 },
  { prefixo: "8", nome: "PR e SC", base: 2690, porPar: 500, dias: 5 },
  { prefixo: "9", nome: "RS", base: 2890, porPar: 600, dias: 6 },
  { prefixo: "", nome: "Demais regiões", base: 3490, porPar: 800, dias: 9 },
];
export const FRETE_GRATIS_ACIMA = 49900;

export function abrirBanco(caminho = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(caminho);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 8000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS produtos (slug TEXT PRIMARY KEY, nome TEXT NOT NULL, modelo TEXT NOT NULL, categoria TEXT NOT NULL, preco INTEGER NOT NULL, descricao TEXT NOT NULL, cores TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS variantes (sku TEXT PRIMARY KEY, produto TEXT NOT NULL REFERENCES produtos(slug), cor TEXT NOT NULL, tamanho INTEGER NOT NULL,
      estoque INTEGER NOT NULL CHECK (estoque >= 0), reservado INTEGER NOT NULL DEFAULT 0 CHECK (reservado >= 0), CHECK (reservado <= estoque));
    CREATE TABLE IF NOT EXISTS reservas (carrinho TEXT NOT NULL, sku TEXT NOT NULL REFERENCES variantes(sku), qtd INTEGER NOT NULL CHECK (qtd > 0), expira INTEGER NOT NULL, PRIMARY KEY (carrinho, sku));
    CREATE INDEX IF NOT EXISTS reservas_expira ON reservas(expira);
    CREATE TABLE IF NOT EXISTS cupons (codigo TEXT PRIMARY KEY, percentual INTEGER NOT NULL, minimo INTEGER NOT NULL DEFAULT 0, usos_restantes INTEGER NOT NULL CHECK (usos_restantes >= 0));
    CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, chave TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, email TEXT NOT NULL, cep TEXT NOT NULL, subtotal INTEGER NOT NULL, desconto INTEGER NOT NULL, frete INTEGER NOT NULL, total INTEGER NOT NULL, cupom TEXT, pagamento TEXT NOT NULL, status TEXT NOT NULL, criado INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS itens_pedido (pedido TEXT NOT NULL REFERENCES pedidos(id), sku TEXT NOT NULL, qtd INTEGER NOT NULL, preco INTEGER NOT NULL, PRIMARY KEY (pedido, sku));
  `);
  return db;
}

export function semear(db: DatabaseSync): void {
  if ((db.prepare("SELECT count(*) n FROM produtos").get() as { n: number }).n > 0) return;
  transacao(db, () => {
    const p = db.prepare("INSERT INTO produtos VALUES (?,?,?,?,?,?,?)");
    const v = db.prepare("INSERT INTO variantes (sku, produto, cor, tamanho, estoque) VALUES (?,?,?,?,?)");
    for (const item of CATALOGO) {
      p.run(item.slug, item.nome, item.modelo, item.categoria, item.preco, item.descricao, JSON.stringify(item.cores));
      for (const [i, cor] of item.cores.entries()) {
        for (let t = 34; t <= 44; t++) {
          const estoque = (t * 7 + i * 5 + item.preco / 100) % 9 < 1.5 ? 0 : Math.floor(((t * 13 + i * 3) % 7) + 1);
          v.run(`${item.slug}-${cor.id}-${t}`, item.slug, cor.id, t, estoque);
        }
      }
    }
    db.prepare("INSERT INTO cupons VALUES ('PRIMEIRO10', 10, 0, 1000), ('NORTE15', 15, 39900, 200)").run();
  });
}

/** BEGIN IMMEDIATE pega a trava de escrita já no início e evita falha de upgrade entre processos. */
function transacao<T>(db: DatabaseSync, f: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = f();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export interface Linha {
  sku: string;
  qtd: number;
  expira: number;
  preco: number;
  nome: string;
  produto: string;
  modelo: string;
  cor: string;
  tamanho: number;
}

export class Loja {
  private readonly db: DatabaseSync;
  private readonly pagamento: Pagamento;
  private readonly agora: () => number;

  constructor(db: DatabaseSync, pagamento: Pagamento = pagamentoSimulado, agora: () => number = Date.now) {
    this.db = db;
    this.pagamento = pagamento;
    this.agora = agora;
  }

  produtos() {
    this.liberarExpiradas();
    const lista = this.db.prepare("SELECT * FROM produtos ORDER BY rowid").all() as any[];
    const variantes = this.db.prepare("SELECT sku, produto, cor, tamanho, estoque - reservado AS disponivel FROM variantes").all() as any[];
    return lista.map((p) => ({ ...p, cores: JSON.parse(p.cores), variantes: variantes.filter((v) => v.produto === p.slug) }));
  }

  /** Devolve ao estoque as reservas vencidas. Roda antes de toda leitura e escrita de estoque. */
  liberarExpiradas(): number {
    return transacao(this.db, () => {
      const vencidas = this.db.prepare("SELECT carrinho, sku, qtd FROM reservas WHERE expira <= ?").all(this.agora()) as any[];
      for (const r of vencidas) {
        this.db.prepare("UPDATE variantes SET reservado = reservado - ? WHERE sku = ?").run(r.qtd, r.sku);
        this.db.prepare("DELETE FROM reservas WHERE carrinho = ? AND sku = ?").run(r.carrinho, r.sku);
      }
      return vencidas.length;
    });
  }

  /** Define a quantidade de um item. A condição no UPDATE é a garantia contra venda além do estoque. */
  definirItem(carrinho: string, sku: string, qtd: number): void {
    if (!Number.isInteger(qtd) || qtd < 0 || qtd > 10) throw new ErroLoja("quantidade_invalida", "Quantidade inválida");
    this.liberarExpiradas();
    transacao(this.db, () => {
      const atual = (this.db.prepare("SELECT qtd FROM reservas WHERE carrinho = ? AND sku = ?").get(carrinho, sku) as { qtd: number } | undefined)?.qtd ?? 0;
      const delta = qtd - atual;
      const r = this.db.prepare("UPDATE variantes SET reservado = reservado + ? WHERE sku = ? AND estoque - reservado >= ?").run(delta, sku, delta);
      if (r.changes === 0) {
        const existe = this.db.prepare("SELECT 1 FROM variantes WHERE sku = ?").get(sku);
        throw existe ? new ErroLoja("sem_estoque", "Este tamanho acabou de esgotar", 409) : new ErroLoja("sku_inexistente", "Produto não encontrado", 404);
      }
      if (qtd === 0) this.db.prepare("DELETE FROM reservas WHERE carrinho = ? AND sku = ?").run(carrinho, sku);
      else this.db.prepare("INSERT INTO reservas VALUES (?,?,?,?) ON CONFLICT (carrinho, sku) DO UPDATE SET qtd = excluded.qtd, expira = excluded.expira").run(carrinho, sku, qtd, this.agora() + RESERVA_MS);
      // Mexer no carrinho renova o prazo de todos os itens, para não expirarem em momentos diferentes.
      this.db.prepare("UPDATE reservas SET expira = ? WHERE carrinho = ?").run(this.agora() + RESERVA_MS, carrinho);
    });
  }

  carrinho(id: string) {
    this.liberarExpiradas();
    const itens = this.db
      .prepare(
        `SELECT r.sku, r.qtd, r.expira, p.preco, p.nome, p.slug AS produto, p.modelo, v.cor, v.tamanho
         FROM reservas r JOIN variantes v ON v.sku = r.sku JOIN produtos p ON p.slug = v.produto WHERE r.carrinho = ? ORDER BY r.sku`,
      )
      .all(id) as unknown as Linha[];
    const subtotal = itens.reduce((t, i) => t + i.preco * i.qtd, 0);
    return { id, itens, subtotal, pares: itens.reduce((t, i) => t + i.qtd, 0), expira: itens[0]?.expira ?? null };
  }

  frete(cep: string, pares: number, subtotal: number) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) throw new ErroLoja("cep_invalido", "Informe um CEP com 8 dígitos");
    const r = REGIOES.find((x) => limpo.startsWith(x.prefixo))!;
    const valor = subtotal >= FRETE_GRATIS_ACIMA ? 0 : r.base + r.porPar * Math.max(0, pares - 1);
    return { regiao: r.nome, valor, dias: r.dias };
  }

  cupom(codigo: string, subtotal: number) {
    const c = this.db.prepare("SELECT * FROM cupons WHERE codigo = ?").get(codigo.trim().toUpperCase()) as any;
    if (!c || c.usos_restantes <= 0) throw new ErroLoja("cupom_invalido", "Cupom inválido ou esgotado");
    if (subtotal < c.minimo) throw new ErroLoja("cupom_minimo", `Este cupom vale a partir de R$ ${(c.minimo / 100).toFixed(2).replace(".", ",")}`);
    return { codigo: c.codigo as string, percentual: c.percentual as number, desconto: Math.round((subtotal * c.percentual) / 100) };
  }

  /**
   * Fecha o pedido em três passos: grava o pedido como pendente, cobra fora de
   * qualquer transação e só então baixa o estoque. A cobrança nunca segura a trava
   * do banco, e a chave de idempotência cobre a repetição de um clique ou de uma rede instável.
   */
  async fechar(dados: { carrinho: string; cliente: Cliente; cep: string; cupom?: string; token: string; chave: string }) {
    const repetido = this.pedidoPorChave(dados.chave);
    if (repetido) return repetido;
    if (!/^\S+@\S+\.\S+$/.test(dados.cliente.email) || dados.cliente.nome.trim().length < 3) throw new ErroLoja("cliente_invalido", "Confira nome e e-mail");

    const c = this.carrinho(dados.carrinho);
    if (c.itens.length === 0) throw new ErroLoja("carrinho_vazio", "Seu carrinho está vazio ou a reserva expirou", 409);
    const cupom = dados.cupom ? this.cupom(dados.cupom, c.subtotal) : null;
    const desconto = cupom?.desconto ?? 0;
    const frete = this.frete(dados.cep, c.pares, c.subtotal - desconto).valor;
    const total = c.subtotal - desconto + frete;
    const id = `SN-${randomUUID().slice(0, 8).toUpperCase()}`;

    transacao(this.db, () => {
      this.db.prepare("INSERT INTO pedidos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id, dados.chave, dados.cliente.nome, dados.cliente.email, dados.cep, c.subtotal, desconto, frete, total, cupom?.codigo ?? null, "", "pendente", this.agora());
      for (const i of c.itens) this.db.prepare("INSERT INTO itens_pedido VALUES (?,?,?,?)").run(id, i.sku, i.qtd, i.preco);
      // Protege a reserva durante a cobrança: ela não pode vencer com o cliente pagando.
      this.db.prepare("UPDATE reservas SET expira = ? WHERE carrinho = ?").run(this.agora() + RESERVA_MS, dados.carrinho);
    });

    const cobranca = await this.pagamento.cobrar(total, dados.token, dados.chave);
    if (!cobranca.aprovado) {
      // A chave fica livre para uma nova tentativa com outro cartão; a reserva continua valendo.
      transacao(this.db, () => {
        this.db.prepare("DELETE FROM itens_pedido WHERE pedido = ?").run(id);
        this.db.prepare("DELETE FROM pedidos WHERE id = ?").run(id);
      });
      throw new ErroLoja("pagamento_recusado", cobranca.motivo ?? "Pagamento recusado", 402);
    }

    transacao(this.db, () => {
      for (const i of c.itens) this.db.prepare("UPDATE variantes SET estoque = estoque - ?, reservado = reservado - ? WHERE sku = ?").run(i.qtd, i.qtd, i.sku);
      this.db.prepare("DELETE FROM reservas WHERE carrinho = ?").run(dados.carrinho);
      if (cupom) this.db.prepare("UPDATE cupons SET usos_restantes = usos_restantes - 1 WHERE codigo = ?").run(cupom.codigo);
      this.db.prepare("UPDATE pedidos SET status = 'pago', pagamento = ? WHERE id = ?").run(cobranca.id, id);
    });
    return this.pedido(id)!;
  }

  pedido(id: string) {
    const p = this.db.prepare("SELECT * FROM pedidos WHERE id = ?").get(id) as any;
    return p ? { ...p, itens: this.db.prepare("SELECT * FROM itens_pedido WHERE pedido = ?").all(id) } : null;
  }

  private pedidoPorChave(chave: string) {
    const p = this.db.prepare("SELECT id FROM pedidos WHERE chave = ?").get(chave) as { id: string } | undefined;
    return p ? this.pedido(p.id) : null;
  }

  disponivel(sku: string): number {
    return (this.db.prepare("SELECT estoque - reservado AS d FROM variantes WHERE sku = ?").get(sku) as { d: number }).d;
  }
}
