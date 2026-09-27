// src/api/widgets.js
import { api } from './client';

export const widgetsApi = {
  list: () => api.get('/widgets'),
  get: (id) => api.get(`/widgets/${id}`),
  create: (data) => api.post('/widgets', data),
  update: (id, data) => api.patch(`/widgets/${id}`, data),
  remove: (id) => api.delete(`/widgets/${id}`),
  getEmbed: (id) => api.get(`/widgets/${id}/embed`),
};