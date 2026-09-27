import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';

export function DashboardHome() {
  const [overview, setOverview] = useState(null);
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([dashboardApi.overview(), dashboardApi.geo()])
      .then(([overviewData, geoData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setGeo(geoData.breakdown);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load overview'); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <p role="alert" className="field-error">{error}</p>;
  }

  if (!overview) {
    return <p role="status" aria-live="polite">Loading overview…</p>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Overview</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Widgets</span>
          <span className="stat-value">{overview.totalWidgets}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Submissions</span>
          <span className="stat-value">{overview.totalSubmissions}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last 24 hours</span>
          <span className="stat-value">{overview.submissionsLast24h}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last 7 days</span>
          <span className="stat-value">{overview.submissionsLast7d}</span>
        </div>
        <div className="stat-card stat-card-muted">
          <span className="stat-label">Flagged as spam</span>
          <span className="stat-value">{overview.totalSpam}</span>
        </div>
      </div>

      {overview.totalWidgets === 0 && (
        <div className="empty-state" style={{ marginTop: 'var(--space-3)' }}>
          <p>Create your first widget to start collecting submissions.</p>
          <Link to="/dashboard/widgets/new" className="btn btn-primary">
            New widget
          </Link>
        </div>
      )}

      {geo && geo.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          <h2>Submissions by country</h2>
          <table className="widgets-table">
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {geo.map((row) => (
                <tr key={row.countryCode}>
                  <td>{row.countryCode}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}