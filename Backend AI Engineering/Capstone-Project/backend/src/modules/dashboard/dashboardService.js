const dashboardRepository = require('./dashboardRepository');

async function getOverview(tenantId) {
  return dashboardRepository.getOverview(tenantId);
}

async function getSubmissions(tenantId, options) {
  return dashboardRepository.getSubmissions(tenantId, options);
}

async function getWidgetStats(tenantId, widgetId) {
  return dashboardRepository.getWidgetStats(tenantId, widgetId);
}

async function getGeoBreakdown(tenantId) {
  return dashboardRepository.getGeoBreakdown(tenantId);
}

module.exports = { getOverview, getSubmissions, getWidgetStats, getGeoBreakdown };