const dashboardService = require('./dashboardService');

async function overview(req, res, next) {
  try {
    const data = await dashboardService.getOverview(req.user.tenantId);
    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

async function submissions(req, res, next) {
  try {
    const { widgetId, includeSpam, limit, offset } = req.validatedQuery;

    const data = await dashboardService.getSubmissions(req.user.tenantId, {
      widgetId,
      includeSpam,
      limit,
      offset,
    });

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

async function widgetStats(req, res, next) {
  try {
    const stats = await dashboardService.getWidgetStats(req.user.tenantId, req.params.id);
    if (!stats) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}

async function geo(req, res, next) {
  try {
    const data = await dashboardService.getGeoBreakdown(req.user.tenantId);
    return res.status(200).json({ breakdown: data });
  } catch (error) {
    next(error);
  }
}

module.exports = { overview, submissions, widgetStats, geo };