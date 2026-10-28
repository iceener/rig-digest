import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function night(runsDir: string, n: string): Night {
  const result = readNight(runsDir, n);
  if (result.kind !== 'night') throw new Error(`expected a night, got ${result.kind}`);
  return result;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const n = night('runs', '2026-10-28');
  const row = (job: string) => {
    const r = n.rows.find((x) => x.job === job);
    if (!r) throw new Error(`no row for ${job}`);
    return r;
  };

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(n.night).toBe('2026-10-28');
    expect(n.badLines).toBe(1);
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts parsed lines per status', () => {
    expect(n.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('a job that retried and ended ok keeps its last error', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('a failed job keeps its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('keeps times verbatim with their offset', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(row('fixtures/refresh').firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row('fixtures/refresh').lastAt).toBe('2026-10-29T01:37:00+01:00');
  });
});

describe('readNight edges', () => {
  it('missing file -> missing', () => {
    expect(readNight(tmp, '2026-01-01')).toEqual({ kind: 'missing', night: '2026-01-01' });
  });

  it('non-date night -> missing, disk untouched', () => {
    expect(readNight('runs', '../package')).toEqual({ kind: 'missing', night: '../package' });
  });

  it('empty file -> rows []', () => {
    writeFileSync(join(tmp, '2026-02-02.jsonl'), '');
    expect(night(tmp, '2026-02-02')).toEqual({
      kind: 'night',
      night: '2026-02-02',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts invalid shapes as bad, skips blank lines', () => {
    const lines = [
      '',
      '   ',
      '[1,2]',
      '"str"',
      '{"at":"","job":"a","status":"ok","owner":null}',
      '{"at":"t","job":"a","status":"maybe","owner":null}',
      '{"at":"t","job":"a","status":"ok","owner":5}',
      '{"at":"t","job":"a","status":"ok","owner":null,"error":3}',
      '{"at":"t","job":"a","status":"ok"}',
    ];
    writeFileSync(join(tmp, '2026-03-03.jsonl'), lines.join('\n'));
    const n = night(tmp, '2026-03-03');
    expect(n.badLines).toBe(6);
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]).toMatchObject({ job: 'a', owner: null, runs: 1 });
  });
});
