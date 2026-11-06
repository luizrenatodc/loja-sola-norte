// Percorre a loja de verdade, com o servidor no ar, e salva as telas do README.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire("C:/Users/Nitro V15/projetos/github-perfil/");
const puppeteer = require("puppeteer-core");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ["src/servidor.ts"], { env: { ...process.env, PORTA: "3911", BANCO: ":memory:" }, stdio: "inherit" });
await espera(1200);
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const p = await b.newPage();
const erros = [];
p.on("pageerror", (e) => erros.push(e.message));
p.on("console", (m) => m.type() === "error" && erros.push(m.text()));
await p.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1.25 });
const foto = async (n, inteira = false) => { await espera(500); await p.screenshot({ path: `docs/telas/${n}.png`, fullPage: inteira }); };
try {
  await p.goto("http://localhost:3911/", { waitUntil: "networkidle0" });
  await foto("inicio");
  await p.evaluate(() => (location.hash = "#/colecao"));
  await foto("colecao", true);
  await p.evaluate(() => (location.hash = "#/produto/rota-couro"));
  await espera(200);
  await p.click('[data-cor="musgo"]');
  await espera(100);
  await p.evaluate(() => document.querySelector(".tamanhos button:not([disabled]):nth-child(n+6)").click());
  await foto("produto");
  await p.click("#add");
  await foto("sacola");
  await p.evaluate(() => { document.querySelector("#ir").click(); });
  await espera(500);
  await p.type("#cod", "PRIMEIRO10");
  await p.click("#aplicar");
  await foto("checkout");
  await p.click("#pagar");
  await foto("confirmacao");
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.evaluate(() => (location.hash = "#/"));
  await foto("celular");
  const larg = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log("largura no celular", larg);
} finally {
  if (erros.length) console.log("ERROS", erros);
  await b.close();
  srv.kill();
}
