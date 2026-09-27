(() => {
  const script = document.currentScript;

  if (!script) return;

  const widgetId = script.dataset.widgetId;
  const configUrl = script.dataset.configUrl;

  if (!widgetId || !configUrl) {
    console.error('Widget configuration is missing');
    return;
  }

  fetch(configUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Widget config request failed: ${response.status}`);
      }

      return response.json();
    })
    .then((data) => {
      const container = document.createElement('div');

      container.dataset.widgetId = widgetId;
      container.textContent = data.config?.title || data.name || 'Widget';

      document.body.appendChild(container);
    })
    .catch((error) => {
      console.error('Widget failed to load:', error);
    });
})();