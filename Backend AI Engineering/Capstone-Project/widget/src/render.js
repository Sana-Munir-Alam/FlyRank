const WIDGET_CSS = `
.flyrank-widget__card {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 360px;
  border: 1px solid #e2e5eb;
  border-radius: 10px;
  padding: 1.25rem;
  background: #ffffff;
  color: #14161a;
  box-shadow: 0 4px 16px rgba(16,24,40,0.08);
  box-sizing: border-box;
}
.flyrank-widget__card * { box-sizing: border-box; }
.flyrank-widget__title { margin: 0 0 0.9rem; font-size: 1.1rem; font-weight: 700; }
.flyrank-widget__field { margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.flyrank-widget__field label { font-size: 0.82rem; font-weight: 600; }
.flyrank-widget__field input,
.flyrank-widget__field textarea {
  font: inherit;
  padding: 0.55rem 0.65rem;
  border: 1px solid #d7dbe3;
  border-radius: 6px;
  width: 100%;
}
.flyrank-widget__field input:focus-visible,
.flyrank-widget__field textarea:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 1px;
}
/* Honeypot: hidden from sighted users AND assistive tech, not display:none
   (some bots skip display:none fields) — off-screen clip is the standard
   pattern that stays in the accessibility tree but is invisible either way. */
.flyrank-widget__honeypot {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.flyrank-widget__submit {
  cursor: pointer;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1rem;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}
.flyrank-widget__submit:disabled { opacity: 0.6; cursor: not-allowed; }
.flyrank-widget__status { margin: 0.6rem 0 0; font-size: 0.85rem; }
.flyrank-widget__status--success { color: #1e7f4f; }
.flyrank-widget__status--error { color: #b3261e; }
`;

const DEFAULT_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'message', label: 'Message', type: 'textarea', required: false },
];

export function renderWidget({ container, config, widgetId }) {
  const title = config?.title || 'Get in touch';
  const fields = Array.isArray(config?.fields) && config.fields.length
    ? config.fields
    : DEFAULT_FIELDS;

  container.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  container.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.className = 'flyrank-widget__card';

  const heading = document.createElement('h2');
  heading.className = 'flyrank-widget__title';
  heading.textContent = title;
  wrapper.appendChild(heading);

  const form = document.createElement('form');

  fields.forEach((field) => {
    const fieldWrap = document.createElement('div');
    fieldWrap.className = 'flyrank-widget__field';

    const id = `flyrank-${widgetId}-${field.name}`;
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = field.label;
    fieldWrap.appendChild(label);

    const input = field.type === 'textarea'
      ? Object.assign(document.createElement('textarea'), { rows: 3 })
      : Object.assign(document.createElement('input'), { type: field.type || 'text' });
    input.id = id;
    input.name = field.name;
    if (field.required) input.required = true;
    fieldWrap.appendChild(input);

    form.appendChild(fieldWrap);
  });

  // Honeypot field — real visitors never see or fill it; a bot script that
  // fills every input on the page will.
  const honeypotWrap = document.createElement('div');
  honeypotWrap.className = 'flyrank-widget__honeypot';
  honeypotWrap.setAttribute('aria-hidden', 'true');
  const honeypotLabel = document.createElement('label');
  honeypotLabel.setAttribute('for', `flyrank-${widgetId}-website`);
  honeypotLabel.textContent = 'Leave this field empty';
  const honeypotInput = document.createElement('input');
  honeypotInput.type = 'text';
  honeypotInput.id = `flyrank-${widgetId}-website`;
  honeypotInput.name = 'website';
  honeypotInput.tabIndex = -1;
  honeypotInput.autocomplete = 'off';
  honeypotWrap.append(honeypotLabel, honeypotInput);
  form.appendChild(honeypotWrap);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'flyrank-widget__submit';
  submitButton.textContent = 'Submit';
  form.appendChild(submitButton);

  const status = document.createElement('p');
  status.className = 'flyrank-widget__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  wrapper.appendChild(form);
  container.appendChild(wrapper);

  return { form, status, submitButton };
}