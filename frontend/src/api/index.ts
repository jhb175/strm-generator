import axios from 'axios';
import type { AppConfig, Stats, TaskStatus, LogEntry, TaskHistoryEntry } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const fetchConfig = () => api.get<AppConfig>('/config').then(res => res.data);
export const saveConfig = (config: AppConfig) => api.post<{message: string}>('/config', config).then(res => res.data);

export const fetchStats = () => api.get<Stats>('/stats').then(res => res.data);
export const fetchTaskStatus = () => api.get<TaskStatus>('/tasks/status').then(res => res.data);

export const startScan = () => api.post<{message: string}>('/tasks/scan').then(res => res.data);
export const previewCleanup = () => api.get<{files: string[]}>('/tasks/cleanup/preview').then(res => res.data);
export const executeCleanup = () => api.post<{message: string}>('/tasks/cleanup/execute').then(res => res.data);

export const fetchLogs = (level?: string) => api.get<LogEntry[]>('/logs', { params: { level } }).then(res => res.data);
export const fetchHistory = () => api.get<TaskHistoryEntry[]>('/tasks/history').then(res => res.data);
