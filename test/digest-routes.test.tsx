import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Api = { night: string; rows: { job: string; runs: number }[]; badLines: number };

let dir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner = 'ana') =>
  JSON.stringify({ at, job, status, owner });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta', 'ok'),
      line('2026-01-01T02:00:00+01:00', 'alpha', 'retry'),
      line('2026-01-01T03:00:00+01:00', 'alpha', 'ok'),
      line('2026-01-01T04:00:00+01:00', 'mid', 'fail'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [line('2026-01-03T01:00:00+01:00', 'good', 'ok'), 'not json {', ''].join('\n'),
  );
  app = createApp({ adapter: 'shim', installed: '2026-01-01T00:00:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const api = async (night: string) => (await app.request(`/api/digest/${night}`)).json() as Promise<Api>;

describe('GET /api/digest/:night', () => {
  it('returns one row per job, sorted', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Api;
    expect(body.rows.map((r) => [r.job, r.runs])).toEqual([['alpha', 2], ['mid', 1], ['zeta', 1]]);
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('empty night gives no rows', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('bad line is counted and other rows survive', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Api;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good']);
  });
});

describe('GET /digest/:night', () => {
  it('renders the jobs', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha', 'mid', 'zeta']) expect(html).toContain(job);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('not found');
  });

  it('empty night says nothing ran', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line still renders, with a warning and the good row', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 bad line(s) skipped');
    expect(html).toContain('good');
  });

  it('lists jobs in the same order as the JSON', async () => {
    const jobs = (await api('2026-01-01')).rows.map((r) => r.job);
    const html = await (await app.request('/digest/2026-01-01')).text();
    const positions = jobs.map((j) => html.indexOf(`>${j}<`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
