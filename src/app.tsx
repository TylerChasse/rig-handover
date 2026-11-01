import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
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
    const id = c.req.param('night');
    const night = /^\d{4}-\d{2}-\d{2}$/.test(id) ? readNight(config.runsDir, id) : null;
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
