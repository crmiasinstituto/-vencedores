#!/usr/bin/env node
/**
 * Teste de audio de ligacao WaVoIP, ponta a ponta e sem depender de ouvido.
 *
 *   node scripts/wavoip-audio-test/run.mjs <numero> [segundos] [--probe]
 *   node scripts/wavoip-audio-test/run.mjs 5575983080330 25
 *
 * O que faz: abre um Chrome headless cujo "microfone" e um WAV com 3 bipes
 * (assim quem atende sabe na hora se o audio do CRM chega), disca pelo mesmo
 * token de device que o CRM usa, e mede os DOIS sentidos pelos AnalyserNodes
 * da SDK. Grava o que chega do telefone em recebido-do-telefone.webm pra voce
 * poder ouvir depois.
 *
 * O token sai da tabela wavoip_devices (o mesmo que o CRM usa), via Management
 * API — precisa de SUPABASE_ACCESS_TOKEN no .env.local. Ou passe WAVOIP_TOKEN.
 *
 * --probe so confere se o device esta "open"; nao disca pra ninguem.
 */
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, '../..');
const args = process.argv.slice(2).filter(a => a !== '--probe');
const PROBE = process.argv.includes('--probe') ? '1' : '';
const TO = args[0];
const SECS = args[1] || '25';
if (!TO && !PROBE) {
  console.error('uso: node scripts/wavoip-audio-test/run.mjs <numero E164 sem +> [segundos] [--probe]');
  process.exit(1);
}

// ---- token do device ----
async function getToken() {
  if (process.env.WAVOIP_TOKEN) return process.env.WAVOIP_TOKEN.trim();
  const envFile = path.join(repo, '.env.local');
  const pat = fs.existsSync(envFile)
    ? (fs.readFileSync(envFile, 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) || [])[1]?.trim()
    : null;
  if (!pat) throw new Error('sem WAVOIP_TOKEN e sem SUPABASE_ACCESS_TOKEN em .env.local');
  const res = await fetch('https://api.supabase.com/v1/projects/iymlwsawrmghhbawiavz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select token from wavoip_devices where is_active order by updated_at desc limit 1;' }),
  });
  const rows = await res.json();
  if (!rows?.[0]?.token) throw new Error('nenhum device ativo em wavoip_devices');
  return rows[0].token;
}

// ---- bundle da SDK (mesma versao que o app importa) ----
await esbuild.build({
  entryPoints: [path.join(dir, 'entry.ts')],
  bundle: true, format: 'iife',
  outfile: path.join(dir, '.bundle.js'),
  alias: { '@': path.join(repo, 'src') },
  logLevel: 'error',
});

const TOKEN = await getToken();
const server = http.createServer((req, res) => {
  const clean = req.url.split('?')[0];
  const f = path.join(dir, clean === '/' ? 'page.html' : clean);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(8978, r));

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(dir, 'tom-teste.wav')}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ctx = await browser.newContext({ permissions: ['microphone'] });
const page = await ctx.newPage();
page.on('console', m => { const t = m.text(); if (!t.startsWith('[WaVoIP patch]') && !t.includes('Failed to load resource')) console.log('  |', t); });
await page.goto(`http://localhost:8978/?token=${TOKEN}&to=${TO || ''}&secs=${SECS}&probe=${PROBE}`);
await page.waitForFunction(() => window.__R?.done, null, { timeout: (Number(SECS) + 90) * 1000 }).catch(() => {});
const R = await page.evaluate(() => window.__R);

console.log('\n================ RESULTADO ================');
if (R.recordedBase64) {
  const out = path.join(dir, 'recebido-do-telefone.webm');
  fs.writeFileSync(out, Buffer.from(R.recordedBase64, 'base64'));
  console.log('audio recebido do telefone:', out, `(${R.recordedBytes} bytes)`);
}
delete R.recordedBase64;
fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(R, null, 2));
console.log(JSON.stringify({ verdict: R.verdict, error: R.error, deviceStatus: R.deviceStatus, devicePhone: R.devicePhone }, null, 2));
await browser.close(); server.close();
