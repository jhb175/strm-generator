import { useEffect, useState } from 'react';
import { Film, Tv, FileText, Play, Activity, Database, RefreshCw } from 'lucide-react';
import type { Stats, TaskStatus, EmbyStats } from '../types';
import { fetchStats, fetchTaskStatus, fetchEmbyStats, refreshEmbyStats } from '../api';

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({ total_strms: 0, movie_strms: 0, episode_strms: 0, source_dir: '', output_dir: '' });
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({ is_running: false, current_task: null, progress: 0, current_file: null });
  const [embyStats, setEmbyStats] = useState<EmbyStats | null>(null);
  const [embyLoading, setEmbyLoading] = useState(true);
  const [embyRefreshing, setEmbyRefreshing] = useState(false);
  const [embyError, setEmbyError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = () => {
      fetchStats().then(setStats).catch(console.error);
      fetchTaskStatus().then(setTaskStatus).catch(console.error);
    };
    
    const loadEmbyStats = () => {
      setEmbyLoading(true);
      setEmbyError(null);
      fetchEmbyStats()
        .then(setEmbyStats)
        .catch(err => {
          console.error('Failed to load Emby stats', err);
          setEmbyError('Emby 统计获取失败，请检查服务地址或 API Key');
        })
        .finally(() => setEmbyLoading(false));
    };

    loadStats();
    loadEmbyStats();

    const embyInterval = window.setInterval(() => {
      fetchEmbyStats()
        .then((data) => {
          setEmbyError(null);
          setEmbyStats((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
        })
        .catch((err) => {
          console.error('Silent refresh Emby stats failed', err);
        });
    }, 120000);

    window.addEventListener('taskFinished', loadStats);
    window.addEventListener('taskFinished', loadEmbyStats);
    return () => {
      window.clearInterval(embyInterval);
      window.removeEventListener('taskFinished', loadStats);
      window.removeEventListener('taskFinished', loadEmbyStats);
    };
  }, []);

  const handleManualRefreshEmby = async () => {
    setEmbyRefreshing(true);
    setEmbyError(null);
    try {
      const data = await refreshEmbyStats();
      setEmbyStats((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(data)) {
          return prev;
        }
        return data;
      });
    } catch (err) {
      console.error('Failed to refresh Emby stats', err);
      setEmbyError('Emby 统计刷新失败，请稍后重试');
    } finally {
      setEmbyRefreshing(false);
    }
  };

  const statCards = [
    { label: '电影数量', value: stats.movie_strms, icon: <Film size={24} className="text-white" />, bgClass: 'card-gradient-movie', desc: '最近一次扫描' },
    { label: '剧集数量', value: stats.episode_strms, icon: <Tv size={24} className="text-white" />, bgClass: 'card-gradient-episode', desc: '最近一次扫描' },
    { label: 'STRM 总数', value: stats.total_strms, icon: <FileText size={24} className="text-white" />, bgClass: 'card-gradient-total', desc: '系统内总文件' },
    { label: '任务进度', value: taskStatus.is_running ? `${taskStatus.progress}%` : '空闲', icon: <Activity size={24} className="text-white" />, bgClass: 'card-gradient-task', desc: taskStatus.is_running ? taskStatus.current_task : '当前无任务' },
  ];

  const renderEmbyStats = () => {
    if (embyLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-[20px] p-6 border border-[#E2E8F0] shadow-sm h-[120px]">
              <div className="w-1/3 h-4 bg-gray-200 rounded mb-4"></div>
              <div className="w-1/2 h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }

    if (embyError || !embyStats) {
      return (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] border-dashed rounded-[20px] p-8 flex flex-col items-center justify-center text-center text-[#64748B]">
          <Database size={32} className="mb-3 opacity-50" />
          <p className="font-medium text-[#0F172A]">{embyError || '尚未连接 Emby，暂无媒体库统计数据'}</p>
          <p className="text-sm mt-1">{embyError ? '请检查服务地址或 API Key' : '请先完成 Emby 连接配置后查看统计'}</p>
        </div>
      );
    }

    const embyCards = [
      { label: '电影数量', value: embyStats.movie_count, icon: <Film size={20} className="text-[#3B82F6]" />, bgClass: 'bg-white', textClass: 'text-[#3B82F6]', desc: 'Emby 库中电影总数' },
      { label: '电视剧数量', value: embyStats.series_count, icon: <Tv size={20} className="text-[#8B5CF6]" />, bgClass: 'bg-white', textClass: 'text-[#8B5CF6]', desc: 'Emby 库中剧集总数' },
      { label: '总数量', value: embyStats.total_count, icon: <Database size={20} className="text-[#10B981]" />, bgClass: 'bg-white', textClass: 'text-[#10B981]', desc: '电影与剧集汇总' },
      { label: '最近新增数量', value: embyStats.recent_added_count, icon: <Activity size={20} className="text-[#F59E0B]" />, bgClass: 'bg-white', textClass: 'text-[#F59E0B]', desc: `最近 ${embyStats.recent_range_days || 7} 天新增` },
    ];

    const formatTime = (isoString: string) => {
      try {
        const d = new Date(isoString);
        return d.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
          hour12: false,
        });
      } catch (e) {
        return isoString;
      }
    };

    return (
      <div className="relative">
        {embyStats.last_updated_at && (
          <div className="absolute -top-7 right-2 text-xs text-[#64748B] font-medium bg-[#F1F5F9] px-2 py-1 rounded-md">
            最近更新: {formatTime(embyStats.last_updated_at)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {embyCards.map((card, idx) => (
            <div key={idx} className={`${card.bgClass} rounded-[20px] p-6 flex flex-col space-y-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden`}>
              <div className="flex items-center justify-between z-10">
                <div className={`p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] ${card.textClass}`}>
                  {card.icon}
                </div>
              </div>
              <div className="z-10">
                <p className="text-sm font-medium text-[#64748B] mb-1">{card.label}</p>
                <div className="flex items-baseline space-x-2">
                  <h3 className={`text-3xl font-bold tracking-tight text-[#0F172A]`}>{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</h3>
                </div>
                <p className="text-xs text-[#94A3B8] mt-2">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[32px] font-bold text-[#0F172A] tracking-tight leading-10">映链</h1>
          <p className="text-sm text-[#64748B] mt-1">STRM Media Bridge - 把媒体目录优雅地转换为可播放的 STRM 入口</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, idx) => (
          <div key={idx} className={`${card.bgClass} rounded-[20px] p-6 flex flex-col space-y-4 text-white shadow-lg transition-transform hover:-translate-y-1`}>
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                {card.icon}
              </div>
              <span className="text-[11px] font-medium bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">{card.desc}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white/90 mb-1">{card.label}</p>
              <h3 className="text-4xl font-bold tracking-tight">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#0F172A] flex items-center">
            <Database size={18} className="mr-2 text-[#64748B]" />
            Emby 媒体库统计
          </h2>
          <button
            onClick={handleManualRefreshEmby}
            disabled={embyRefreshing}
            className="inline-flex items-center px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            <RefreshCw size={16} className={`mr-2 ${embyRefreshing ? 'animate-spin' : ''}`} />
            手动刷新
          </button>
        </div>
        {renderEmbyStats()}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC] rounded-t-[20px]">
          <h2 className="text-lg font-semibold text-[#0F172A] flex items-center">
            <Play size={18} className="mr-2 text-[#64748B]" />
            最近任务状态
          </h2>
          <div className="flex items-center space-x-2">
            {taskStatus.is_running && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#3B82F6]"></span>
              </span>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${taskStatus.is_running ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
              {taskStatus.is_running ? '运行中' : '空闲中'}
            </span>
          </div>
        </div>
        <div className="p-6 bg-white rounded-b-[20px]">
          {taskStatus.is_running ? (
            <div className="space-y-5">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-xs text-[#64748B] font-medium">当前阶段</span>
                  <p className="text-base text-[#0F172A] font-semibold">{taskStatus.current_task === 'Scan & Generate' ? '扫描媒体并生成 STRM' : (taskStatus.current_task === 'Cleanup Orphans' ? '清理孤儿文件' : taskStatus.current_task)}</p>
                </div>
                <span className="text-2xl font-bold text-[#2563EB]">{taskStatus.progress}%</span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2.5 overflow-hidden">
                <div className="bg-gradient-to-r from-[#2563EB] to-[#60A5FA] h-2.5 rounded-full progress-active" style={{ width: `${taskStatus.progress}%` }}></div>
              </div>
              <p className="text-xs text-[#334155] truncate flex items-center bg-[#F8FAFC] px-4 py-3 rounded-xl border border-[#E2E8F0] font-mono">
                <span className="text-[#2563EB] mr-3 shrink-0 font-semibold px-2 py-1 bg-[#DBEAFE] rounded">处理中</span> 
                {taskStatus.current_file}
              </p>
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-[#F5F7FB] flex items-center justify-center text-[#94A3B8] mb-2 border border-[#E2E8F0]">
                <Play size={28} />
              </div>
              <p className="text-lg text-[#0F172A] font-semibold">系统准备就绪</p>
              <p className="text-sm text-[#64748B]">当前没有正在执行的任务，您可以在“任务”页面发起扫描。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;