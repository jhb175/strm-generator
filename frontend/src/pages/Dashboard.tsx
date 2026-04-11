import { useEffect, useState } from 'react';
import { Film, Tv, FileText, Play } from 'lucide-react';
import type { Stats, TaskStatus } from '../types';
import { fetchStats, fetchTaskStatus } from '../api';

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({ total_strms: 0, movie_strms: 0, episode_strms: 0, source_dir: '', output_dir: '' });
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({ is_running: false, current_task: null, progress: 0, current_file: null });

  useEffect(() => {
    const loadStats = () => {
      fetchStats().then(setStats).catch(console.error);
      fetchTaskStatus().then(setTaskStatus).catch(console.error);
    };

    loadStats();

    window.addEventListener('taskFinished', loadStats);
    return () => window.removeEventListener('taskFinished', loadStats);
  }, []);

  const statCards = [
    { label: 'Movies', value: stats.movie_strms, icon: <Film size={24} className="text-[#00a8ff]" />, bg: 'bg-[#1e1e1e]' },
    { label: 'TV Shows', value: stats.episode_strms, icon: <Tv size={24} className="text-[#00a8ff]" />, bg: 'bg-[#1e1e1e]' },
    { label: 'Total STRM', value: stats.total_strms, icon: <FileText size={24} className="text-[#00a8ff]" />, bg: 'bg-[#1e1e1e]' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card, idx) => (
          <div key={idx} className={`${card.bg} rounded-xl p-6 border border-[#3d3d3d] flex items-center space-x-4 shadow-sm`}>
            <div className="p-3 bg-[#2d2d2d] rounded-lg">
              {card.icon}
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">{card.label}</p>
              <h3 className="text-2xl font-bold text-white">{card.value.toLocaleString()}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#1e1e1e] rounded-xl border border-[#3d3d3d] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3d3d3d] flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <Play size={18} className="mr-2" />
            Recent Task Status
          </h2>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${taskStatus.is_running ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {taskStatus.is_running ? 'Running' : 'Idle'}
          </span>
        </div>
        <div className="p-6">
          {taskStatus.is_running ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Task: {taskStatus.current_task}</span>
                <span className="text-white font-medium">{taskStatus.progress}%</span>
              </div>
              <div className="w-full bg-[#2d2d2d] rounded-full h-2.5">
                <div className="bg-[#00a8ff] h-2.5 rounded-full" style={{ width: `${taskStatus.progress}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 truncate">
                Processing: {taskStatus.current_file}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No active tasks. System is ready.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;