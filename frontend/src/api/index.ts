import axios from 'axios';
import type { AppConfig, Stats, TaskStatus, LogEntry, TaskHistoryEntry } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const fetchConfig = () => api.get<AppConfig>('/config').then(res => res.data);
export const saveConfig = async (config: AppConfig) => {
  await api.post('/config', { key: 'source_dir', value: config.source_dir });
  await api.post('/config', { key: 'output_dir', value: config.output_dir });
  return { ok: true };
};

export const fetchStats = () => api.get<Stats>('/stats').then(res => res.data);
export const fetchEmbyStats = () => api.get<any>('/emby/stats').then(res => res.data);
export const refreshEmbyStats = () => api.get<any>('/emby/stats').then(res => res.data);
export const fetchTaskStatus = () => api.get('/tasks/status').then(res => {
  const data = res.data;
  const current = data.current_task;
  return {
    is_running: !!current && current.status === 'RUNNING',
    current_task: current?.task_type || null,
    progress: current?.progress_pct || 0,
    current_file: current?.current_file || current?.message || null,
  } as TaskStatus;
});

export const startScan = (incremental: boolean = true) => api.post<{message: string}>(`/tasks/scan?incremental=${incremental}`).then(res => res.data);
export const previewCleanup = () => api.get<{files: string[]}>('/tasks/cleanup/preview').then(res => res.data);
export const executeCleanup = () => api.post<{message: string}>('/tasks/cleanup/execute').then(res => res.data);

export const fetchLogs = (level?: string) => api.get('/logs', { params: { level } }).then(res => {
  const rows = res.data.logs || [];
  return rows.map((item: any) => ({
    id: item.id,
    timestamp: item.created_at,
    level: (item.level || '').toUpperCase(),
    message: item.message,
  })) as LogEntry[];
});
export const fetchHistory = () => api.get('/history').then(res => {
  const rows = res.data.runs || [];
  return rows.map((item: any) => ({
    id: item.id,
    task_type: item.task_type,
    start_time: item.started_at,
    end_time: item.finished_at,
    status: (item.status || '').toUpperCase(),
  })) as TaskHistoryEntry[];
});
