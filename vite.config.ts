import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}


function createDevAssertionPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-game-assertion-broker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/game-assertion', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const projectId = env.GAME_AUTH_PROJECT_ID?.trim();
        const privateKeyPath = env.GAME_AUTH_PRIVATE_KEY_PATH?.trim();
        const actor = env.VITE_ACTOR_EXTERNAL_ID?.trim();
        const character = env.VITE_CHARACTER_EXTERNAL_ID?.trim();
        const issuer = env.GAME_AUTH_ISSUER?.trim() || 'game-auth-service';
        const audience = env.GAME_AUTH_AUDIENCE?.trim() || 'ai-memory-backend';
        const kid = env.GAME_AUTH_KID?.trim() || 'v1';
        const lifetime = Math.max(1, Number(env.GAME_AUTH_ASSERTION_LIFETIME_SECONDS || '60'));

        if (!projectId || !privateKeyPath || !actor || !character) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Local assertion broker is not configured',
            required: ['GAME_AUTH_PROJECT_ID', 'GAME_AUTH_PRIVATE_KEY_PATH', 'VITE_ACTOR_EXTERNAL_ID', 'VITE_CHARACTER_EXTERNAL_ID'],
          }));
          return;
        }

        try {
          const privateKeyPem = await readFile(privateKeyPath, 'utf8');
          const key = createPrivateKey(privateKeyPem);
          const now = Math.floor(Date.now() / 1000);
          const header = base64Url(JSON.stringify({ alg: 'Ed25519', typ: 'GAME_ASSERTION', kid }));
          const payload = base64Url(JSON.stringify({
            iss: issuer,
            aud: audience,
            project_id: projectId,
            actor_external_id: actor,
            character_external_id: character,
            iat: now,
            exp: now + lifetime,
            jti: randomBytes(16).toString('base64url'),
          }));
          const signature = sign(null, Buffer.from(`${header}.${payload}`), key).toString('base64url');
          const assertion = `amk-assert-v1.${header}.${payload}.${signature}`;

          res.statusCode = 200;
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ assertion, expires_at: now + lifetime }));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unable to create local game assertion' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000';
  const frontendPort = Number(env.VITE_FRONTEND_PORT || '3000');

  return {
    plugins: [react(), createDevAssertionPlugin(env)],
    server: {
      host: '0.0.0.0',
      // Allow the local Vite dev server to be reached through the current
      // ngrok free-dev hostname without opening the production server to all hosts.
      allowedHosts: ['localhost', '.ngrok-free.dev'],
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/__backend': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__backend/, ''),
        },
      },
    },
  };
});
