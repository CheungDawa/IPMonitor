const API_BASE = '/api/v1';

export function getToken(): string | null {
  return localStorage.getItem('ipmonitor_token');
}

export function setToken(token: string) {
  localStorage.setItem('ipmonitor_token', token);
}

export function clearToken() {
  localStorage.removeItem('ipmonitor_token');
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  const json = await res.json();
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(json.message || `请求失败 (${res.status})`);
  }

  return json.data;
}

export const api = {
  // 驾驶舱专用全景聚合接口
  getCockpitOverview: () => request('/cockpit/overview'),

  // 认证
  login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),
  changePassword: (data: any) => request('/auth/password', { method: 'POST', body: JSON.stringify(data) }),

  // 监控大屏
  getDashboardStats: () => request('/dashboard/stats'),
  getRecentEvents: (limit = 15) => request(`/dashboard/recent-events?limit=${limit}`),
  getFaultTrend: () => request('/dashboard/fault-trend'),
  getGroupSummary: () => request('/dashboard/group-summary'),

  // 设备管理
  listDevices: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    return request(`/devices?${q.toString()}`);
  },
  getDevice: (id: number) => request(`/devices/${id}`),
  createDevice: (data: any) => request('/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: number, data: any) => request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevice: (id: number) => request(`/devices/${id}`, { method: 'DELETE' }),
  probeDevice: (id: number) => request(`/devices/${id}/probe`, { method: 'POST' }),

  // 分组管理
  listGroups: () => request('/groups'),
  createGroup: (data: any) => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id: number, data: any) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id: number) => request(`/groups/${id}`, { method: 'DELETE' }),

  // 地图与定位
  getMapDevices: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    return request(`/map/devices?${q.toString()}`);
  },
  getUnlocatedDevices: () => request('/map/unlocated'),
  geocodeAddress: (query: string, limit = 5) => request(`/map/geocode?query=${encodeURIComponent(query)}&limit=${limit}`),
  reverseGeocode: (lat: number, lon: number) => request(`/map/reverse-geocode?lat=${lat}&lon=${lon}`),
  transformCoords: (data: any) => request('/map/transform-coords', { method: 'POST', body: JSON.stringify(data) }),

  // 告警与通知
  listAlerts: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    return request(`/alerts?${q.toString()}`);
  },
  resolveAlert: (id: number) => request(`/alerts/${id}/resolve`, { method: 'POST' }),
  getNotificationConfig: () => request('/notifications/config'),
  updateNotificationConfig: (data: any) => request('/notifications/config', { method: 'PUT', body: JSON.stringify(data) }),
  testNotification: (data: any) => request('/notifications/test', { method: 'POST', body: JSON.stringify(data) }),

  // Excel 导入导出
  precheckExcel: (formData: FormData) => request('/excel/precheck', { method: 'POST', body: formData }),
  importExcel: (formData: FormData) => request('/excel/import', { method: 'POST', body: formData }),

  // 历史与报表
  getHistory: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    return request(`/reports/history?${q.toString()}`);
  },
  getStatistics: (days = 7) => request(`/reports/statistics?days=${days}`),

  // 系统与备份
  getSystemStatus: () => request('/system/status'),
  getSystemSettings: () => request('/system/settings'),
  updateSystemSettings: (data: any) => request('/system/settings', { method: 'PUT', body: JSON.stringify(data) }),
  triggerBackup: () => request('/system/backup', { method: 'POST' }),
  getBackups: () => request('/system/backups')
};
