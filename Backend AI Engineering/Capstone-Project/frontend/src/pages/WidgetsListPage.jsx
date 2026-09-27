import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { widgetsApi } from '../api/widgets';

export function WidgetsListPage() {
  const [widgets, setWidgets] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    widgetsApi
      .list()
      .then((data) => { if (!cancelled) setWidgets(data.widgets); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load widgets'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Widgets</h1>
        <Link to="/dashboard/widgets/new" className="btn btn-primary">
          New widget
        </Link>
      </div>

      {error && <p role="alert" className="field-error">{error}</p>}

      {widgets === null && !error && (
        <p role="status" aria-live="polite">Loading widgets…</p>
      )}

      {widgets && widgets.length === 0 && (
        <div className="empty-state">
          <p>You haven&apos;t created any widgets yet.</p>
          <Link to="/dashboard/widgets/new" className="btn btn-primary">
            Create your first widget
          </Link>
        </div>
      )}

      {widgets && widgets.length > 0 && (
        <table className="widgets-table">
          <caption className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
            Your widgets
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {widgets.map((widget) => (
              <tr key={widget.id}>
                <td>
                  <Link to={`/dashboard/widgets/${widget.id}`}>{widget.name}</Link>
                </td>
                <td>{widget.type}</td>
                <td>
                  <span className={`badge ${widget.active ? 'badge-active' : 'badge-inactive'}`}>
                    {widget.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{new Date(widget.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}