export function wireSubmit({ form, status, submitButton, widgetId, apiOrigin }) {
  function setStatus(message, kind) {
    status.textContent = message;
    status.className = 'flyrank-widget__status' + (kind ? ` flyrank-widget__status--${kind}` : '');
  }

  // Clear a stale success/error message as soon as the visitor starts a new entry.
  // (form.reset() fires 'reset', not 'input', so it won't wipe the success message we set below.)
  form.addEventListener('input', () => setStatus('', null));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {};
    let honeypotValue = '';

    for (const [key, value] of formData.entries()) {
      if (key === 'website') {
        honeypotValue = value;
        continue;
      }
      payload[key] = value;
    }

    submitButton.disabled = true;
    setStatus('', null);

    try {
      const response = await fetch(`${apiOrigin}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId, payload, website: honeypotValue }),
      });

      if (response.status === 429) {
        setStatus('Too many submissions right now. Please wait a minute and try again.', 'error');
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        setStatus("We couldn't accept that submission. Please check your details and try again.", 'error');
        return;
      }
      if (!response.ok) {
        throw new Error(`Submission failed (${response.status})`);
      }

      form.reset();
      setStatus('Thanks — your message was sent.', 'success');
    } catch {
      setStatus('Could not reach the server. Please check your connection and try again.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
}