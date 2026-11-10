import { createClient } from '@supabase/supabase-js';
import { createAssistantHandler } from './assistant.mjs';

export function createNodeAssistantHandler({ env = (name) => process.env[name], handler } = {}) {
  const resolveEnv = (name) => env(name) || (name === 'SUPABASE_URL' ? env('VITE_SUPABASE_URL')
    : name === 'SUPABASE_ANON_KEY' ? env('VITE_SUPABASE_PUBLISHABLE_KEY') : undefined);
  const run = handler || createAssistantHandler({ createClient, env: resolveEnv });
  return async (req, res) => {
    const respond = (status, error) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error }));
    };
    try {
      let body;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        else {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > 24000) return respond(413, 'La conversación es demasiado larga. Empieza una nueva.');
            chunks.push(buffer);
          }
          body = Buffer.concat(chunks).toString('utf8');
        }
        if (Buffer.byteLength(body) > 24000) return respond(413, 'La conversación es demasiado larga. Empieza una nueva.');
      }
      const request = new Request('http://localhost/api/assistant', {
        method: req.method, headers: { Authorization: req.headers.authorization || '', 'Content-Type': 'application/json' }, body,
      });
      const response = await run(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      if (!res.headersSent) respond(503, 'El asistente no ha podido responder. No se ha realizado ningún cambio.');
      else res.end();
    }
  };
}
