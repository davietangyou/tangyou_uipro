import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Load optional local env files before dynamically importing server modules
// (e.g. server/log.ts reads process.env at module evaluation time).
// Existing runtime environment variables are never overwritten by loadEnvFile.
for (const envFile of ['.env.server.local', '.env']) {
  try {
    process.loadEnvFile?.(envFile);
  } catch {
    // Optional local env files; runtime-injected env vars take precedence.
  }
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

async function serveStatic(distDir: string, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    pathname = (req.url || '/').split('?')[0];
  }
  const normalized = pathname.replace(/^\/diaguide(?=\/|$)/, '') || '/';
  const relPath = normalized === '/' ? 'index.html' : normalized.replace(/^\/+/, '');
  const resolved = path.resolve(distDir, relPath);
  if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let targetFile = resolved;
  try {
    const s = await stat(targetFile);
    if (s.isDirectory()) targetFile = path.join(targetFile, 'index.html');
  } catch {
    const ext = path.extname(relPath).toLowerCase();
    // Missing asset files (e.g. .js, .css, .json, images) should return 404 rather than index.html.
    if (ext && ext !== '.html') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    targetFile = path.join(distDir, 'index.html');
  }

  try {
    const content = await readFile(targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

async function start() {
  const [{ createAiRequestHandler }, { createProvider }, { log }] = await Promise.all([
    import('./server/app'),
    import('./server/providers'),
    import('./server/log'),
  ]);

  const provider = (() => {
    try {
      return createProvider();
    } catch (error) {
      log('error', 'startup.provider_failed', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })();

  const allowedOrigins = (process.env.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const aiHandler = createAiRequestHandler(provider.generate, {
    ...provider,
    trustHost: true,
    allowedOrigins,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  let viteMiddlewares: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null = null;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      plugins: [
        {
          name: 'ai-studio-middleware-adapter',
          configResolved(config) {
            config.server.allowedHosts = true;
          },
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              return code.replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket disabled in server.ts middlewareMode */',
              );
            }
          },
        },
      ],
      appType: 'spa',
    });
    viteMiddlewares = vite.middlewares;
  }

  const server = createServer(async (req, res) => {
    let pathname = '/';
    try {
      pathname = new URL(req.url || '/', 'http://localhost').pathname;
    } catch {
      pathname = (req.url || '/').split('?')[0];
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/diaguide/api/')) {
      await aiHandler(req, res);
      return;
    }

    if (viteMiddlewares) {
      viteMiddlewares(req, res, () => {
        if (!res.writableEnded) {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      return;
    }

    await serveStatic(distDir, req, res);
  });

  server.requestTimeout = 620_000;
  server.headersTimeout = 10_000;

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port} (${provider.provider}/${provider.model}; ${provider.configured ? 'configured' : 'missing key'})`);
    log('info', 'startup.ready', {
      port,
      provider: provider.provider,
      model: provider.model,
      configured: provider.configured,
      mode: isProd ? 'production' : 'development',
    });
  });

  server.on('error', (error) => {
    log('error', 'startup.server_error', {
      code: (error as NodeJS.ErrnoException)?.code,
      message: error.message,
    });
    console.error('Server could not start:', error.message);
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      log('info', 'process.signal', { signal });
      server.close();
      server.closeAllConnections();
    });
  }
}

void start();
