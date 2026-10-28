import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight, type StatusCounts } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

// counts/badLines are null when unknown (read failed or night missing).
export type NightEntry = { night: string; counts: StatusCounts | null; badLines: number | null };

function entry(runsDir: string, night: string): NightEntry {
  try {
    const r = readNight(runsDir, night);
    if (r.kind === 'night') return { night, counts: r.counts, badLines: r.badLines };
  } catch {
    // unreadable: board still lists the night
  }
  return { night, counts: null, badLines: null };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => entry(config.runsDir, n)),
  };
}
