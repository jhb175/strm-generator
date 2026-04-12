import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export interface SchedulerSettings {
  enabled: boolean;
  cron: string;
  description?: string;
  active?: boolean;
  next_run_at?: string | null;
  last_checked_at?: string | null;
}

export const fetchSchedulerSettings = async (): Promise<SchedulerSettings> => {
  const res = await api.get('/scheduler');
  return res.data;
};

export const updateSchedulerSettings = async (enabled: boolean, cron: string, description = '') => {
  const res = await api.post('/scheduler', { enabled, cron, description });
  return res.data as SchedulerSettings & { ok: boolean };
};
