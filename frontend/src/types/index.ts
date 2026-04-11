export interface AppConfig {
  source_dir: string;
  output_dir: string;
}

export interface Stats {
  total_strms: number;
  movie_strms: number;
  episode_strms: number;
  source_dir: string;
  output_dir: string;
}

export interface TaskStatus {
  is_running: boolean;
  current_task: string | null;
  progress: number;
  current_file: string | null;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface TaskHistoryEntry {
  id: number;
  task_type: string;
  start_time: string;
  end_time: string | null;
  status: 'success' | 'failed' | 'running';
}
