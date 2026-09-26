const widgetService = require('./widgetService');

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

module.exports = { create, findAll, findById, update, remove };