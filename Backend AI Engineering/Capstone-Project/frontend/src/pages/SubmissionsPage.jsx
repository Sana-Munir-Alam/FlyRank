import { useEffect, useState } from 'react';
import { widgetsApi } from '../api/widgets';
import { dashboardApi } from '../api/dashboard';

const PAGE_SIZE = 20;

export function SubmissionsPage() {
  const [widgets, setWidgets] = useState([]);
  const [widgetId, setWidgetId] = useState('');
  const [includeSpam, setIncludeSpam] = useState(false);
  const [page, setPage] = useState(0);

  const [submissions, setSubmissions] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  // Widget list for the filter dropdown — loaded once
  useEffect(() => {
    widgetsApi.list().then((data) => setWidgets(data.widgets)).catch(() => {});
  }, []);

  // Re-fetch submissions whenever a filter or the page changes
  useEffect(() => {
    let cancelled = false;
    setSubmissions(null);
    dashboardApi
      .submissions({
        widgetId: widgetId || undefined,
        includeSpam,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return;
        setSubmissions(data.submissions);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load submissions');
      });
    return () => { cancelled = true; };
  }, [widgetId, includeSpam, page]);

  function handleWidgetFilterChange(event) {
    setWidgetId(event.target.value);
    setPage(0); // reset paging whenever the filter changes, or offset can point past the new result set
  }

  function handleIncludeSpamChange(event) {
    setIncludeSpam(event.target.checked);
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-header">
        <h1>Submissions</h1>
      </div>

      <div className="filters-bar">
        <div className="field field-inline">
          <label htmlFor="widget-filter">Widget</label>
          <select id="widget-filter" value={widgetId} onChange={handleWidgetFilterChange}>
            <option value="">All widgets</option>
            {widgets.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <label className="checkbox-inline">
          <input type="checkbox" checked={includeSpam} onChange={handleIncludeSpamChange} />
          Include spam
        </label>
      </div>

      {error && <p role="alert" className="field-error">{error}</p>}

      {submissions === null && !error && (
        <p role="status" aria-live="polite">Loading submissions…</p>
      )}

      {submissions && submissions.length === 0 && (
        <div className="empty-state">
          <p>No submissions match these filters yet.</p>
        </div>
      )}

      {submissions && submissions.length > 0 && (
        <>
          <table className="widgets-table">
            <thead>
              <tr>
                <th scope="col">Widget</th>
                <th scope="col">Data</th>
                <th scope="col">Location</th>
                <th scope="col">Status</th>
                <th scope="col">Received</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.widget_name}</td>
                  <td className="payload-cell">{formatPayload(s.payload)}</td>
                  <td>{[s.city, s.country_code].filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    {s.spam ? (
                      <span className="badge badge-inactive" title={s.spam_reason}>Spam</span>
                    ) : (
                      <span className="badge badge-active">Clean</span>
                    )}
                  </td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {page + 1} of {totalPages} ({total} total)
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}

// Payloads are arbitrary JSON from the visitor's form — render them compactly
// rather than assuming a fixed shape, since widgets can define any fields.
function formatPayload(payload) {
  if (!payload || typeof payload !== 'object') return '—';
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}