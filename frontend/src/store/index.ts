import { create } from 'zustand';
import type { TaskStatus, LogEntry } from '../types';
import { fetchStats, fetchHistory } from '../api';

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
    // Determine WebSocket URL based on current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Create connection
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        set({ taskStatus: data.payload });
        
        // Refresh stats and history when task finishes
        if (data.payload.status === 'SUCCESS' || data.payload.status === 'FAILED') {
          // Trigger components to re-fetch or use state? Since components fetch on mount,
          // we could either reload data here or trigger an event.
          // For now, the simplest is dispatching a custom event that components can listen to.
          window.dispatchEvent(new Event('taskFinished'));
          // Or we can just call the api directly here
          fetchStats().catch(console.error);
          fetchHistory().catch(console.error);
        }
      } else if (data.type === 'status') {
        set({ taskStatus: data.payload });
      } else if (data.type === 'log') {
        set((state) => ({ logs: [...state.logs, data.payload] }));
      }
    };
    
    ws.onclose = () => {
      // Reconnect logic
      setTimeout(() => set((state) => { state.connectWebSocket(); return state; }), 5000);
    };
  }
}));
