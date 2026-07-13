// Gera PNG da Masterclass (slide oculto da apresentação) pra usar como creative
// no fluxo de WhatsApp recovery (disc-recovery edge function).
//
// Uso:
//   1. Subir o vite local (npm run dev) — fica em http://localhost:8080
//   2. node scripts/capture-masterclass-image.mjs
//
// Output: public/apresentacoes/assets/masterclass_recovery.png (1080x1350, ratio
// vertical otimizado pra WhatsApp Status / preview)

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HTML_PATH = join(ROOT, 'public/apresentacoes/reprograme-10x.html');
const OUT_PATH = join(ROOT, 'public/apresentacoes/assets/masterclass_recovery.png');

if (!existsSync(HTML_PATH)) {
    console.error('HTML não encontrado:', HTML_PATH);
    process.exit(1);
}

// Viewport largo o bastante pra renderizar o slide no tamanho original (1200px
// é o max-width do .sc); altura cresce conforme o conteúdo.
const WIDTH = 1400;
const HEIGHT = 1750;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 });

await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle' });

// Ativa modo captura: força o slide oculto a renderizar fullscreen + remove
// auto-fit (queremos o tamanho real, não escalonado) + esconde overlays.
await page.evaluate(() => {
    document.body.classList.add('capture-mode');
    document.querySelectorAll('.nav-controls, .key-hint, .slide-counter, .audio-hint, .progress-bar, .logo-watermark').forEach((el) => {
        el.style.display = 'none';
    });
    const sc = document.querySelector('#slide-masterclass .sc');
    if (sc) {
        sc.style.transform = 'none';
        sc.style.transformOrigin = '';
    }
});

await page.waitForTimeout(800);

// Captura só o .sc com um padding pra respirar — vira um creative compacto
// e impactante pro WhatsApp.
const sc = await page.$('#slide-masterclass .sc');
if (!sc) {
    console.error('.sc do #slide-masterclass não encontrado');
    await browser.close();
    process.exit(1);
}

const box = await sc.boundingBox();
if (!box) {
    console.error('Não consegui medir o .sc');
    await browser.close();
    process.exit(1);
}

const PAD = 60; // moldura preta ao redor pro creative respirar
await page.screenshot({
    path: OUT_PATH,
    clip: {
        x: Math.max(0, box.x - PAD),
        y: Math.max(0, box.y - PAD),
        width: box.width + PAD * 2,
        height: box.height + PAD * 2,
    },
});

await browser.close();
console.log('OK:', OUT_PATH);
