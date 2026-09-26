const widgetRepository = require('./widgetRepository');

async function create(data) {
  return widgetRepository.create(data);
}

async function findAll(tenantId) {
  return widgetRepository.findAll(tenantId);
}

async function findById(tenantId, id) {
  return widgetRepository.findById(tenantId, id);
}

async function update(data) {
  return widgetRepository.update(data);
}

async function remove(tenantId, id) {
  return widgetRepository.remove(tenantId, id);
}

module.exports = { create, findAll, findById, update, remove };