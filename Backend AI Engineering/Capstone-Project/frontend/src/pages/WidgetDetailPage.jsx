import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { widgetsApi } from '../api/widgets';

export function WidgetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [widget, setWidget] = useState(null);
  const [embed, setEmbed] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([widgetsApi.get(id), widgetsApi.getEmbed(id)])
      .then(([widgetData, embedData]) => {
        if (cancelled) return;
        setWidget(widgetData.widget);
        setEmbed(embedData);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load widget'); });
    return () => { cancelled = true; };
  }, [id]);

  async function handleCopy() {
    if (!embed) return;
    try {
      await navigator.clipboard.writeText(embed.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard — select and copy manually.');
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${widget.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await widgetsApi.remove(id);
      navigate('/dashboard/widgets', { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed');
      setDeleting(false);
    }
  }

  if (error && !widget) {
    return <p role="alert" className="field-error">{error}</p>;
  }

  if (!widget) {
    return <p role="status" aria-live="polite">Loading widget…</p>;
  }

  return (
    <>
      <div className="page-header">
        <h1>{widget.name}</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link to={`/dashboard/widgets/${id}/edit`} className="btn btn-secondary">Edit</Link>
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="detail-meta">
        <span className={`badge ${widget.active ? 'badge-active' : 'badge-inactive'}`}>
          {widget.active ? 'Active' : 'Inactive'}
        </span>
        <span>Type: {widget.type}</span>
        <span>Version: {widget.version}</span>
      </div>

      {error && <p role="alert" className="field-error">{error}</p>}

      <div className="card" style={{ padding: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        <h2>Embed snippet</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Paste this into any website to render the widget.
        </p>
        <pre className="snippet-box">{embed?.snippet}</pre>
        <button type="button" className="btn btn-primary copy-button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy snippet'}
        </button>
      </div>
    </>
  );
}