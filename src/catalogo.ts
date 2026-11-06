export interface Cor {
  id: string;
  nome: string;
  corpo: string;
  detalhe: string;
  sola: string;
}

export interface ItemCatalogo {
  slug: string;
  nome: string;
  modelo: "tenis" | "bota" | "mocassim" | "oxford";
  categoria: string;
  preco: number;
  descricao: string;
  cores: Cor[];
}

const C = {
  areia: { id: "areia", nome: "Areia", corpo: "#d9c6a5", detalhe: "#b79f77", sola: "#c9b38c" },
  musgo: { id: "musgo", nome: "Musgo", corpo: "#4f5d3f", detalhe: "#37422c", sola: "#c8b998" },
  telha: { id: "telha", nome: "Telha", corpo: "#b5573a", detalhe: "#8c3f28", sola: "#cdb999" },
  noite: { id: "noite", nome: "Noite", corpo: "#2a3142", detalhe: "#1b2030", sola: "#bdb5a4" },
  cafe: { id: "cafe", nome: "Café", corpo: "#5b3a29", detalhe: "#40281b", sola: "#2b211b" },
  conhaque: { id: "conhaque", nome: "Conhaque", corpo: "#94552a", detalhe: "#6f3d1c", sola: "#2d221a" },
  preto: { id: "preto", nome: "Preto", corpo: "#23211f", detalhe: "#0f0e0d", sola: "#191816" },
  giz: { id: "giz", nome: "Giz", corpo: "#ece6da", detalhe: "#cfc6b5", sola: "#b5573a" },
};

export const CATALOGO: ItemCatalogo[] = [
  { slug: "rota-couro", nome: "Rota", modelo: "tenis", categoria: "Tênis", preco: 42900, descricao: "Tênis de couro curtido ao vegetal, palmilha de cortiça e sola de borracha natural. O par de todos os dias.", cores: [C.giz, C.areia, C.musgo, C.noite] },
  { slug: "serra-chelsea", nome: "Serra", modelo: "bota", categoria: "Botas", preco: 68900, descricao: "Bota chelsea com elástico reforçado e solado costurado, que pode ser trocado quando gastar.", cores: [C.cafe, C.conhaque, C.preto] },
  { slug: "vento-mocassim", nome: "Vento", modelo: "mocassim", categoria: "Mocassins", preco: 45900, descricao: "Mocassim de camurça sem forro, moldado à mão. Leve o suficiente para viajar na mala de mão.", cores: [C.conhaque, C.telha, C.areia] },
  { slug: "praca-oxford", nome: "Praça", modelo: "oxford", categoria: "Sociais", preco: 74900, descricao: "Oxford de couro inteiro com costura Goodyear. Um clássico para durar duas décadas.", cores: [C.preto, C.cafe, C.conhaque] },
  { slug: "trilha-couro", nome: "Trilha", modelo: "tenis", categoria: "Tênis", preco: 38900, descricao: "Versão de camurça do Rota, com solado mais macio e cadarço encerado.", cores: [C.telha, C.musgo, C.areia] },
  { slug: "campo-bota", nome: "Campo", modelo: "bota", categoria: "Botas", preco: 59900, descricao: "Bota de camurça com forro de couro, feita para frio leve e chão irregular.", cores: [C.musgo, C.areia, C.noite] },
  { slug: "largo-mocassim", nome: "Largo", modelo: "mocassim", categoria: "Mocassins", preco: 52900, descricao: "Mocassim de couro polido, com sola de couro e salto baixo de empilhado.", cores: [C.noite, C.cafe] },
  { slug: "sobrado-oxford", nome: "Sobrado", modelo: "oxford", categoria: "Sociais", preco: 69900, descricao: "Oxford de biqueira reta em couro escovado, com palmilha de couro.", cores: [C.conhaque, C.noite] },
];
