import type { NightResult } from './types.js';

// Contract in ./types.ts. Implemented by issue #2.
export function readNight(runsDir: string, night: string): NightResult {
  void runsDir;
  void night;
  throw new Error('readNight: not implemented');
}
