import { createAiServer } from './app';
import { createProvider } from './providers';
import { log } from './log';
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
const server = createAiServer(provider.generate, { ...provider, allowedOrigins: (process.env.AI_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean) });
const port = Number(process.env.AI_PORT || 8787);
server.listen(port, '127.0.0.1', () => {
  console.log(`AI backend: http://127.0.0.1:${port} (${provider.provider}/${provider.model}; ${provider.configured ? 'configured' : 'missing key'})`);
  log('info', 'startup.ready', {
    port,
    provider: provider.provider,
    model: provider.model,
    configured: provider.configured,
    allowedOrigins: (process.env.AI_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean).length,
  });
});
server.on('error', (error) => {
  log('error', 'startup.server_error', {
    code: (error as NodeJS.ErrnoException)?.code,
    message: error.message,
  });
  console.error('AI backend could not start; check AI_PORT.');
  process.exitCode = 1;
});
process.on('uncaughtExceptionMonitor', (error) => {
  log('error', 'process.uncaught', { name: error.name, message: error.message });
});
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => {
  log('info', 'process.signal', { signal });
  server.close();
  server.closeAllConnections();
});