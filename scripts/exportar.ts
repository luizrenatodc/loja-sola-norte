// Exporta o catálogo para a versão estática publicada no GitHub Pages.
import { writeFileSync } from "node:fs";
import { Loja, abrirBanco, semear } from "../src/loja.ts";

const db = abrirBanco();
semear(db);
writeFileSync("docs/catalogo.json", JSON.stringify(new Loja(db).produtos()));
