// Ilustrações dos sapatos em SVG. Cada modelo é uma lista de camadas, e a cor vem da variante.
let uid = 0;

const MODELOS = {
  tenis: (c, g) => `
    <path d="M58 232 C50 190 54 128 64 96 C70 78 96 72 120 78 C142 83 158 90 178 86 C194 118 222 136 262 152 C320 175 392 178 452 186 C516 194 560 206 566 236 Z" fill="url(#${g}c)"/>
    <path d="M58 232 C52 196 54 150 60 120 C84 130 108 168 112 232 Z" fill="${c.detalhe}"/>
    <path d="M436 184 C498 190 556 202 566 236 L412 236 C410 214 420 194 436 184 Z" fill="${c.detalhe}" opacity=".85"/>
    <path d="M178 86 C196 120 224 138 264 154 L238 188 C196 170 164 142 150 112 Z" fill="${c.detalhe}" opacity=".55"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${176 + i * 19} ${112 + i * 13} l28 -22" stroke="${c.sola}" stroke-width="7" stroke-linecap="round"/>`).join("")}
    <path d="M120 234 C190 214 300 216 404 236" fill="none" stroke="${c.detalhe}" stroke-width="2.5" stroke-dasharray="7 6" opacity=".7"/>
    <path d="M36 234 H574 C582 262 566 280 526 280 H82 C46 280 30 262 36 234 Z" fill="${c.sola}"/>
    <path d="M36 256 H576" stroke="#000" stroke-opacity=".14" stroke-width="3"/>`,
  bota: (c, g) => `
    <path d="M78 236 C70 170 74 86 84 34 C120 26 190 26 226 34 C230 86 240 126 280 150 C332 180 420 176 486 194 C532 206 558 216 562 240 Z" fill="url(#${g}c)"/>
    <path d="M118 36 C114 84 118 126 132 164 L204 164 C192 124 188 80 192 34 Z" fill="${c.detalhe}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${130 + i * 7.5} 44 V158" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`).join("")}
    <path d="M92 34 C88 12 112 12 110 33" fill="none" stroke="${c.detalhe}" stroke-width="7"/>
    <path d="M226 34 C230 86 240 126 280 150" fill="none" stroke="${c.sola}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M70 236 H566 C572 252 562 264 536 264 H250 C232 264 226 276 214 280 H82 C64 280 62 256 70 236 Z" fill="${c.sola}"/>
    <path d="M214 262 H528" stroke="#fff" stroke-opacity=".18" stroke-width="2.5" stroke-dasharray="7 6"/>`,
  mocassim: (c, g) => `
    <path d="M64 232 C56 208 58 176 70 152 C104 170 150 172 196 158 C254 142 312 128 382 138 C452 148 544 184 564 234 Z" fill="url(#${g}c)"/>
    <path d="M270 138 C304 124 364 124 400 142 C424 156 426 180 402 188 C352 202 298 192 268 172 C254 160 256 146 270 138 Z" fill="${c.detalhe}" opacity=".5"/>
    <path d="M270 138 C304 124 364 124 400 142 C424 156 426 180 402 188 C352 202 298 192 268 172 C254 160 256 146 270 138 Z" fill="none" stroke="${c.sola}" stroke-opacity=".45" stroke-width="2.5" stroke-dasharray="6 5"/>
    <path d="M268 158 C230 176 196 186 180 188" stroke="${c.detalhe}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="176" cy="192" r="7" fill="${c.detalhe}"/><path d="M176 198 l-7 24 M176 198 l8 23" stroke="${c.detalhe}" stroke-width="4" stroke-linecap="round"/>
    <path d="M56 234 H572 C578 252 566 266 530 266 H210 C194 266 188 280 176 280 H76 C56 280 50 254 56 234 Z" fill="${c.sola}"/>`,
  oxford: (c, g) => `
    <path d="M62 232 C54 200 58 150 70 122 C104 136 136 138 168 126 C206 140 252 150 304 156 C372 164 446 170 500 188 C540 202 562 214 566 234 Z" fill="url(#${g}c)"/>
    <path d="M62 232 C56 202 58 170 66 138 C96 150 118 186 124 232 Z" fill="${c.detalhe}" opacity=".7"/>
    <path d="M168 126 C206 140 252 150 304 156 L286 200 C240 192 196 176 164 152 Z" fill="${c.detalhe}" opacity=".45"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${194 + i * 24} ${142 + i * 7} l16 28" stroke="${c.sola}" stroke-opacity=".8" stroke-width="5" stroke-linecap="round"/>`).join("")}
    <path d="M416 168 C396 186 390 212 396 234" fill="none" stroke="${c.detalhe}" stroke-width="3"/>
    <path d="M426 171 C406 188 400 212 406 234" fill="none" stroke="${c.sola}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 5"/>
    <path d="M54 234 H574 C580 248 570 258 540 258 H232 C216 258 208 280 196 280 H76 C56 280 48 254 54 234 Z" fill="${c.sola}"/>`,
};

export function sapato(modelo, cor, titulo = "") {
  const g = `s${++uid}`;
  return `<svg viewBox="0 0 600 320" role="img" aria-label="${titulo}">
    <defs>
      <linearGradient id="${g}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="0" stop-color="${cor.corpo}"/><stop offset="1" stop-color="${cor.detalhe}"/></linearGradient>
      <radialGradient id="${g}s"><stop offset="0" stop-color="#000" stop-opacity=".26"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="300" cy="288" rx="285" ry="20" fill="url(#${g}s)"/>
    ${MODELOS[modelo](cor, g)}
  </svg>`;
}
