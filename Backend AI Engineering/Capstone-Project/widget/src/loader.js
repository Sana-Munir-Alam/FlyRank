import { renderWidget } from './render.js';
import { wireSubmit } from './submit.js';

(() => {
  const script = document.currentScript;
  
  if (!script) return;

  const widgetId = script.dataset.widgetId;
  const configUrl = script.dataset.configUrl;

  if (!widgetId || !configUrl) {
    console.error('Widget configuration is missing');
    return;
  }

  // Derive the API's origin from the bundle's own script src, so the widget never hardcodes localhost:3000 — it calls back wherever it was loaded from.
  const apiOrigin = new URL(script.src, window.location.href).origin;

  fetch(configUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Widget config request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const container = document.createElement('div');

      container.dataset.widgetId = widgetId;
      document.body.appendChild(container);

      const { form, status, submitButton } = renderWidget({
        container,
        config: data.config,
        widgetId,
      });

      wireSubmit({ form, status, submitButton, widgetId, apiOrigin });
    })
    .catch((error) => {
      console.error('Widget failed to load:', error);
    });
})();