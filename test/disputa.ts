// Processo auxiliar do teste de concorrência: tenta reservar até o estoque acabar.
import { Loja, abrirBanco } from "../src/loja.ts";

const [caminho, sku, id] = process.argv.slice(2) as [string, string, string];
const loja = new Loja(abrirBanco(caminho));
let conseguiu = 0;
for (let i = 0; i < 12; i++) {
  try {
    loja.definirItem(`p${id}-${i}`, sku, 1);
    conseguiu++;
  } catch (e) {
    if ((e as { codigo?: string }).codigo !== "sem_estoque") throw e;
  }
}
process.send!(conseguiu, () => process.exit(0));
