import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { widgetsApi } from '../api/widgets';

const WIDGET_TYPES = ['lead_capture', 'contact_form', 'popover'];

export function WidgetFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState(WIDGET_TYPES[0]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    widgetsApi
      .get(id)
      .then((data) => {
        if (cancelled) return;
        setName(data.widget.name);
        setType(data.widget.type);
        setActive(data.widget.active);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load widget');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, isEditing]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isEditing) {
        await widgetsApi.update(id, { name, type, active });
        navigate(`/dashboard/widgets/${id}`, { replace: true });
      } else {
        const data = await widgetsApi.create({ name, type, config: {} });
        navigate(`/dashboard/widgets/${data.widget.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p role="status" aria-live="polite">Loading widget…</p>;
  }

  return (
    <div className="form-page">
      <div className="page-header">
        <h1>{isEditing ? 'Edit widget' : 'New widget'}</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} noValidate style={{ padding: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="name">Widget name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              aria-describedby={error ? 'widget-form-error' : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="type">Widget type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
              {WIDGET_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {isEditing && (
            <div className="field">
              <label htmlFor="active">
                <input
                  id="active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ marginRight: '0.5rem' }}
                />
                Active (visible to visitors)
              </label>
            </div>
          )}

          {error && (
            <p id="widget-form-error" role="alert" className="field-error">
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save widget'}
            </button>
            <Link to={isEditing ? `/dashboard/widgets/${id}` : '/dashboard/widgets'} className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}