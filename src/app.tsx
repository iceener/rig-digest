import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(config.runsDir, night);
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage result={result} />
      </Layout>,
      result.kind === 'missing' ? 404 : 200,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const result = readNight(config.runsDir, c.req.param('night'));
    if (result.kind === 'missing') return c.json({ error: 'no run log', night: result.night }, 404);
    const { night, rows, counts, badLines } = result;
    return c.json({ night, rows, counts, badLines });
  });

  return app;
}
