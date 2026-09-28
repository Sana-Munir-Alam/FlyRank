export function wireSubmit({ form, status, submitButton, widgetId, apiOrigin }) {
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
    status.textContent = '';
    status.className = 'flyrank-widget__status';

    try {
      const response = await fetch(`${apiOrigin}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId, payload, website: honeypotValue }),
      });

      if (!response.ok) {
        throw new Error(`Submission failed (${response.status})`);
      }

      form.reset();
      status.textContent = 'Thanks — your message was sent.';
      status.classList.add('flyrank-widget__status--success');
    } catch {
      status.textContent = 'Something went wrong. Please try again.';
      status.classList.add('flyrank-widget__status--error');
    } finally {
      submitButton.disabled = false;
    }
  });
}