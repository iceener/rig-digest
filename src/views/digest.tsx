import type { DigestRow, NightResult } from '../digest/types.js';

const dash = '—';

function Row({ r }: { r: DigestRow }) {
  const bad = r.retries >= 3 || r.lastStatus === 'fail';
  return (
    <tr class={bad ? 'warn' : undefined}>
      <td>{bad ? '! ' : ''}{r.job}</td>
      <td>{r.owner ?? dash}</td>
      <td>{r.runs}</td>
      <td>{r.retries}</td>
      <td>{r.lastStatus}</td>
      <td>{r.lastError ?? dash}</td>
      <td>{r.firstAt}</td>
      <td>{r.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ result }: { result: NightResult }) {
  if (result.kind === 'missing') {
    return (
      <>
        <h1>digest · {result.night}</h1>
        <p class="mute">no run log for that night</p>
      </>
    );
  }
  return (
    <>
      <h1>digest · {result.night}</h1>
      {result.badLines > 0 && (
        <p class="warn">
          ! {result.badLines} {result.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {result.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>{result.rows.map((r) => <Row r={r} />)}</tbody>
        </table>
      )}
    </>
  );
}
