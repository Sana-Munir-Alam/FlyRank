import { api } from './client';

export const dashboardApi = {
  overview: () => api.get('/dashboard/overview'),
  submissions: (params = {}) => {
    const query = new URLSearchParams();
    if (params.widgetId) query.set('widgetId', params.widgetId);
    if (params.includeSpam) query.set('includeSpam', 'true');
    if (params.limit) query.set('limit', params.limit);
    if (params.offset) query.set('offset', params.offset);
    const qs = query.toString();
    return api.get(`/dashboard/submissions${qs ? `?${qs}` : ''}`);
  },
  widgetStats: (widgetId) => api.get(`/dashboard/widgets/${widgetId}/stats`),
  geo: () => api.get('/dashboard/geo'),
};