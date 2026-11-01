import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

const NIGHT_ID = /^\d{4}-\d{2}-\d{2}$/;

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

  // One code path for page and JSON, so they can never disagree.
  const loadNight = (id: string) => (NIGHT_ID.test(id) ? readNight(config.runsDir, id) : null);

  app.get('/api/digest/:night', (c) => {
    const night = loadNight(c.req.param('night'));
    if (!night) return c.json({ error: 'no such night' }, 404);
    return c.json({ night: night.night, rows: night.rows, badLines: night.badLines });
  });

  app.get('/digest/:night', (c) => {
    const id = c.req.param('night');
    const night = loadNight(id);
    if (!night) {
      return c.html(
        <Layout title="not found" lane={lane()}>
          <h1>not found</h1>
          <p class="mute">no digest for {id}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${id}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  return app;
}
