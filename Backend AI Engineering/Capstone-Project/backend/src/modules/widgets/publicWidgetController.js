const fs = require('fs');
const path = require('path');
const widgetRepository = require('./widgetRepository');

async function config(req, res, next) {
  try {
    const widget = await widgetRepository.findPublicById(req.params.id);
    if (!widget || !widget.active) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    return res.status(200).json({
      id: widget.id,
      name: widget.name,
      type: widget.type,
      config: widget.config,
      version: widget.version,
    });
  } catch (error) {
    next(error);
  }
}

function bundle(req, res, next) {
  const version = req.params.version;

  const bundlePath = path.resolve(
    __dirname,
    `../../../../widget/dist/v${version}/widget.js`
  );

  if (!fs.existsSync(bundlePath)) {
    return res.status(404).json({ error: 'Widget bundle not found' });
  }

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');

  return res.sendFile(bundlePath, (error) => {
    if (error) {
      next(error);
    }
  });
}

module.exports = {
  config,
  bundle,
};