import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = new URL('../.env.local', import.meta.url);
execFileSync('git', ['check-ignore', '--quiet', '.env.local'], { cwd: root, stdio: 'ignore' });
if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdout.write('Introduce la clave de Groq (entrada oculta) y pulsa Enter: ');
let secret = '';
process.stdin.on('data', (chunk) => {
  if (chunk.includes('\u0003')) process.exit(130);
  secret += chunk;
  if (!/[\r\n]/.test(secret)) return;
  const key = secret.trim();
  if (!/^gsk_[a-zA-Z0-9_-]{20,}$/.test(key)) {
    process.stderr.write('\nFormato de clave no válido. No se ha guardado.\n');
    process.exit(1);
  }
  let content;
  try { content = readFileSync(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; content = ''; }
  content = content.replace(/^GROQ_API_KEY=.*(?:\r?\n|$)/gm, '');
  if (content && !content.endsWith('\n')) content += '\n';
  content += `GROQ_API_KEY=${key}\n`;
  if (!/^GROQ_MODEL=/m.test(content)) content += 'GROQ_MODEL=openai/gpt-oss-20b\n';
  writeFileSync(target, content, { mode: 0o600 });
  secret = '';
  process.stdout.write('\nClave guardada en .env.local, excluido de Git. No se ha modificado Vercel.\n');
  process.exit(0);
});
