const widgetService = require('./widgetService');
const { BUNDLE_VERSION } = require('../../config/constants');

async function create(req, res, next) {
  try {
    const widget = await widgetService.create({ ...req.body, tenantId: req.user.tenantId });
    return res.status(201).json({ widget });
  } catch (error) {
    next(error);
  }
}

async function findAll(req, res, next) {
  try {
    const widgets = await widgetService.findAll(req.user.tenantId);
    return res.status(200).json({ widgets });
  } catch (error) {
    next(error);
  }
}

async function findById(req, res, next) {
  try {
    const widget = await widgetService.findById(req.user.tenantId, req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    return res.status(200).json({ widget });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const widget = await widgetService.update({ ...req.body, tenantId: req.user.tenantId, id: req.params.id });
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    return res.status(200).json({ widget });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const widget = await widgetService.remove(req.user.tenantId, req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

function getEmbed(req, res, next) {
  widgetService.findById(req.user.tenantId, req.params.id)
    .then((widget) => {
      if (!widget) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const bundleUrl = `${baseUrl}/widget/v${BUNDLE_VERSION}/widget.js`;
      const configUrl = `${baseUrl}/widgets/${widget.id}/config`;

      const snippet =
        `<script src="${bundleUrl}" ` +
        `data-widget-id="${widget.id}" ` +
        `data-config-url="${configUrl}" defer></script>`;

      return res.status(200).json({
        widgetId: widget.id,
        version: widget.version,
        bundleVersion: BUNDLE_VERSION,
        bundleUrl,
        configUrl,
        snippet,
      });
    })
    .catch(next);
}
module.exports = { create, findAll, findById, update, remove, getEmbed, };