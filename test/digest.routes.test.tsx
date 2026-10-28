import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow, StatusCounts } from '../src/digest/types.js';

type DigestJson = { night: string; rows: DigestRow[]; counts: StatusCounts; badLines: number };

const line = (o: Record<string, unknown>) => JSON.stringify(o);
const NORMAL = [
  line({ at: '2026-01-01T01:00:00+01:00', job: 'zeta', status: 'ok', owner: 'ann' }),
  line({ at: '2026-01-01T01:01:00+01:00', job: 'alpha', status: 'retry', owner: null, error: 'boom' }),
  line({ at: '2026-01-01T01:02:00+01:00', job: 'alpha', status: 'retry', owner: null, error: 'boom' }),
  line({ at: '2026-01-01T01:03:00+01:00', job: 'alpha', status: 'retry', owner: null, error: 'boom' }),
  line({ at: '2026-01-01T01:04:00+01:00', job: 'alpha', status: 'ok', owner: null }),
  line({ at: '2026-01-01T01:05:00+01:00', job: 'mid', status: 'fail', owner: 'bob', error: 'dead' }),
].join('\n');
const BAD = [
  line({ at: '2026-01-02T01:00:00Z', job: 'good', status: 'ok', owner: 'ann' }),
  '{"at":"2026-01-02T01:01:00Z","job":"trunc","sta',
].join('\n');

let dir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(path.join(dir, '2026-01-01.jsonl'), NORMAL + '\n');
  fs.writeFileSync(path.join(dir, '2026-01-02.jsonl'), BAD + '\n');
  fs.writeFileSync(path.join(dir, '2026-01-03.jsonl'), '');
  process.env.LANE_MARKER = 'TEST-MARKER';
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders the table in job order with warn rows and dashes', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.match(/<table/g)).toHaveLength(1);
    const a = html.indexOf('alpha');
    const m = html.indexOf('mid');
    const z = html.indexOf('zeta');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(m);
    expect(m).toBeLessThan(z);
    expect(html).toContain('warn');
    expect(html).toContain('—');
  });

  it('404 for a missing or non-date night', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
    expect((await app.request('/digest/nope')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders good rows when a line is bad', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('good');
  });
});

describe('digest JSON', () => {
  it('returns night, rows, counts, badLines', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'mid', 'zeta']);
    expect(body.counts).toEqual({ ok: 2, retry: 3, fail: 1 });
    expect(body.badLines).toBe(0);
    expect(body.rows[0]).toMatchObject({ owner: null, retries: 3, lastStatus: 'ok', lastError: 'boom' });
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('empty night has no rows', async () => {
    const body = (await (await app.request('/api/digest/2026-01-03')).json()) as DigestJson;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line', async () => {
    const body = (await (await app.request('/api/digest/2026-01-02')).json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good']);
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as DigestJson;
    const idx = body.rows.map((r) => html.indexOf(r.job));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });
});
