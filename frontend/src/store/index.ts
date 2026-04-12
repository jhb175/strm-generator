import { create } from 'zustand';
import type { TaskStatus, LogEntry } from '../types';
import { fetchTaskStatus } from '../api';

interface StoreState {
  taskStatus: TaskStatus;
  logs: LogEntry[];
  setTaskStatus: (status: TaskStatus) => void;
  appendLog: (log: LogEntry) => void;
  connectWebSocket: () => void;
}

export const useStore = create<StoreState>((set) => ({
  taskStatus: { is_running: false, current_task: null, progress: 0, current_file: null },
  logs: [],
  setTaskStatus: (status) => set({ taskStatus: status }),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  connectWebSocket: () => {
    const poll = async () => {
      try {
        const status = await fetchTaskStatus();
        set({ taskStatus: status });
        if (!status.is_running) {
          window.dispatchEvent(new Event('taskFinished'));
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
      }
    };

    poll();
    window.setInterval(poll, 3000);
  }
}));
