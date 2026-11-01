import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 ? <p class="warn">! {night.badLines} bad line(s) skipped</p> : null}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
              <th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => {
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
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
