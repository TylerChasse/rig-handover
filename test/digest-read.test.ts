import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('reads 2026-10-28 into 5 jobs and 1 bad line', () => {
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the last status and error', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps the offset from the log, ignoring the truncated last line', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('returns null when the night has no log', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  describe('with a temp runs dir', () => {
    let dir: string | undefined;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });
    const write = (body: string) => {
      dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
      writeFileSync(join(dir, '2026-11-01.jsonl'), body);
      return dir;
    };

    it('reads an empty file as no rows', () => {
      expect(readNight(write(''), '2026-11-01')).toEqual({ night: '2026-11-01', rows: [], badLines: 0 });
    });

    it('counts lines with bad JSON or missing fields, not the trailing blank', () => {
      const ok = '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}';
      const body = [ok, '{oops', '{"job":"a","status":"ok"}', '{"at":"x","job":"a","status":"done"}', ''].join('\n');
      const result = readNight(write(body), '2026-11-01');
      expect(result?.badLines).toBe(3);
      expect(result?.rows).toHaveLength(1);
    });
  });
});
