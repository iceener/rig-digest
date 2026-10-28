// Plan morning-digest § 1. The contract every part of § 2 builds against.
// Input: runs/<night>.jsonl, one JSON object per line:
//   { "at": string, "job": string, "status": "ok" | "retry" | "fail", "owner": string | null, "error"?: string }
// Lines are taken in file order; "first" and "last" below mean first and last in the file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// A night is a file name stem: YYYY-MM-DD (same shape status.ts lists from disk).
export const NIGHT_RE = /^\d{4}-\d{2}-\d{2}$/;

// One row per job seen in the night.
export type DigestRow = {
  job: string;
  // Owner on the job's last line. null when that line says null (or has no owner); views show `—`.
  owner: string | null;
  // Every parsed line for this job, whatever its status (ok + retry + fail lines).
  runs: number;
  // Lines for this job with status "retry".
  retries: number;
  // Status of the job's last line.
  lastStatus: RunStatus;
  // The job's most recent `error` in the night, kept when a later line has none (a retry that
  // ended ok still shows why it retried). null when no line for the job had an error.
  lastError: string | null;
  // `at` of the job's first and last line, verbatim from the log (offset kept, never converted).
  firstAt: string;
  lastAt: string;
};

// Parsed lines per status across the whole night (all jobs). ok + retry + fail = parsed lines.
// The board link (§ 2c) shows these beside each night.
export type StatusCounts = Record<RunStatus, number>;

export type Night = {
  kind: 'night';
  night: string;
  // Sorted by job, ascending (plain string compare). Page and JSON use this order as is.
  // Empty array = the file exists but nothing ran (empty file, or only bad/blank lines).
  rows: DigestRow[];
  counts: StatusCounts;
  // Non-blank lines that did not parse: not JSON, not an object, `at`/`job` not a non-empty
  // string, `status` not ok|retry|fail, `owner` not string|null, or `error` present but not a string.
  // Counted, never thrown. Blank (whitespace-only) lines are skipped and not counted.
  badLines: number;
};

// No file for this night, or the night string is not YYYY-MM-DD (then the disk is never
// touched, so nothing outside runsDir is ever read). Routes answer 404.
export type MissingNight = { kind: 'missing'; night: string };

export type NightResult = Night | MissingNight;

// readNight(runsDir, night): reads `${runsDir}/${night}.jsonl` synchronously.
// - night not matching NIGHT_RE -> { kind: 'missing' } without reading anything
// - file absent (ENOENT)        -> { kind: 'missing' }
// - file present                -> { kind: 'night', ... } (empty file: rows [], counts all 0, badLines 0)
// - any other fs error (EACCES, EISDIR, ...) is thrown.
export type ReadNight = (runsDir: string, night: string) => NightResult;

export { readNight } from './read.js';
