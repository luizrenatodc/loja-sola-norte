import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ErroLoja, Loja, abrirBanco, semear } from "./loja.ts";

const PUBLICO = fileURLToPath(new URL("../docs/", import.meta.url));
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };

async function corpo(req: import("node:http").IncomingMessage): Promise<any> {
  let texto = "";
  for await (const parte of req) {
    texto += parte;
    if (texto.length > 32_000) throw new ErroLoja("corpo_grande", "Pedido grande demais", 413);
  }
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErroLoja("json_invalido", "JSON inválido", 400);
  }
}

export function criarServidor(loja: Loja): Server {
  const rotas = async (metodo: string, caminho: string, req: import("node:http").IncomingMessage) => {
    const partes = caminho.split("/").filter(Boolean).slice(1);
    const [a, b, c, d] = partes;
    if (metodo === "GET" && a === "produtos") return loja.produtos();
    if (a === "carrinho" && b) {
      if (metodo === "GET" && !c) return loja.carrinho(b);
      if (metodo === "PUT" && c === "itens" && d) {
        const { qtd } = await corpo(req);
        loja.definirItem(b, decodeURIComponent(d), qtd);
        return loja.carrinho(b);
      }
    }
    if (metodo === "POST" && a === "frete") {
      const { cep, carrinho } = await corpo(req);
      const c2 = loja.carrinho(String(carrinho));
      return loja.frete(String(cep), c2.pares, c2.subtotal);
    }
    if (metodo === "POST" && a === "cupom") {
      const { codigo, carrinho } = await corpo(req);
      return loja.cupom(String(codigo), loja.carrinho(String(carrinho)).subtotal);
    }
    if (metodo === "POST" && a === "pedidos") {
      const chave = req.headers["idempotency-key"];
      if (typeof chave !== "string" || chave.length < 8) throw new ErroLoja("chave_ausente", "Idempotency-Key obrigatória", 400);
      const dados = await corpo(req);
      return loja.fechar({ ...dados, chave });
    }
    throw new ErroLoja("rota_inexistente", "Rota não encontrada", 404);
  };

  return createServer(async (req, res) => {
    const caminho = new URL(req.url ?? "/", "http://x").pathname;
    try {
      if (caminho.startsWith("/api/")) {
        const r = await rotas(req.method ?? "GET", caminho, req);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(r));
        return;
      }
      const arquivo = normalize(caminho === "/" ? "index.html" : caminho.slice(1));
      if (arquivo.startsWith("..")) throw new ErroLoja("proibido", "Proibido", 403);
      const conteudo = await readFile(join(PUBLICO, arquivo));
      res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" }).end(conteudo);
    } catch (e) {
      const conhecido = e instanceof ErroLoja;
      const status = conhecido ? e.status : (e as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
      if (status === 500) console.error(e);
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ erro: conhecido ? e.codigo : "erro", mensagem: conhecido ? e.message : "Não foi possível concluir" }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = abrirBanco(process.env.BANCO ?? "loja.db");
  semear(db);
  const porta = Number(process.env.PORTA ?? 3000);
  criarServidor(new Loja(db)).listen(porta, () => console.log(`Sola Norte em http://localhost:${porta}`));
}
