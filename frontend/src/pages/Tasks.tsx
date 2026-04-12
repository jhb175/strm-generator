import { useState, useEffect } from 'react';
import { Play, Trash2, AlertTriangle, CheckCircle, Clock, Loader2, Save, Calendar, Info, X } from 'lucide-react';
import type { TaskHistoryEntry } from '../types';
import { useStore } from '../store';
import { fetchHistory, startScan, previewCleanup, executeCleanup as apiExecuteCleanup } from '../api';
import { fetchSchedulerSettings, updateSchedulerSettings } from '../api/scheduler';

const Tasks = () => {
  const { taskStatus } = useStore();
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupFiles, setCleanupFiles] = useState<string[]>([]);

  // Task immediate feedback states
  const [isStartingScan, setIsStartingScan] = useState<'incremental' | 'full' | null>(null);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Scheduler states
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState('0 0 * * *');
  const [schedulerNextRunAt, setSchedulerNextRunAt] = useState<string | null>(null);
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [isSavingScheduler, setIsSavingScheduler] = useState(false);
  const [schedulerMessage, setSchedulerMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const loadHistory = () => fetchHistory().then(setHistory).catch(console.error);

  useEffect(() => {
    loadHistory();
    
    // Fetch initial scheduler settings
    fetchSchedulerSettings().then(data => {
      setSchedulerEnabled(data.enabled);
      setCronExpression(data.cron);
      setSchedulerNextRunAt(data.next_run_at || null);
      setSchedulerActive(!!data.active);
    }).catch(console.error);

    const handleTaskFinished = (event: any) => {
      loadHistory();
      const detail = event.detail;
      if (detail && detail.status === 'SUCCESS') {
        setScanResult({ type: 'success', message: '任务执行成功！已完成扫描与生成。' });
      } else if (detail && detail.status === 'FAILED') {
        setScanResult({ type: 'error', message: `任务执行失败：${detail.error || '未知错误'}` });
      } else {
        setScanResult({ type: 'success', message: '任务已结束。' });
      }
      
      // Auto dismiss success/error message after 8 seconds
      setTimeout(() => setScanResult(null), 8000);
    };

    window.addEventListener('taskFinished', handleTaskFinished);
    return () => window.removeEventListener('taskFinished', handleTaskFinished);
  }, []);

  const handleStartScan = async (incremental: boolean) => {
    if (taskStatus.is_running || isStartingScan) return;
    setIsStartingScan(incremental ? 'incremental' : 'full');
    setScanResult(null);
    try {
      await startScan(incremental);
      setTimeout(() => {
        setIsStartingScan(null);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to start scan:', error);
      setIsStartingScan(null);
      setScanResult({ type: 'error', message: error.message || '启动扫描任务失败，请检查网络或后端状态' });
    }
  };

  const handlePreviewCleanup = async () => {
    try {
      const { files } = await previewCleanup();
      setCleanupFiles(files);
      setShowCleanupModal(true);
    } catch (error) {
      console.error('Failed to preview cleanup:', error);
    }
  };

  const executeCleanup = async () => {
    setShowCleanupModal(false);
    try {
      await apiExecuteCleanup();
    } catch (error) {
      console.error('Failed to execute cleanup:', error);
    }
  };

  const handleSaveScheduler = async () => {
    setIsSavingScheduler(true);
    setSchedulerMessage(null);
    try {
      const saved = await updateSchedulerSettings(schedulerEnabled, cronExpression);
      setSchedulerNextRunAt(saved.next_run_at || null);
      setSchedulerActive(!!saved.active);
      setSchedulerMessage({ type: 'success', text: schedulerEnabled ? '定时任务设置已保存并开始生效' : '已关闭定时任务' });
      setTimeout(() => setSchedulerMessage(null), 3000);
    } catch (error) {
      setSchedulerMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setIsSavingScheduler(false);
    }
  };

  // Determine detailed progress text based on current percentage
  const getTaskStateText = () => {
    if (!taskStatus.is_running) return '未运行';
    if (taskStatus.progress === 0) return '准备中...';
    if (taskStatus.progress < 50) return '扫描中...';
    if (taskStatus.progress < 100) return '生成中...';
    return '即将完成...';
  };

  const isTaskRunning = taskStatus.is_running || !!isStartingScan;

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-[24px] font-semibold text-[#0F172A] mb-6">任务中心</h1>

      {/* Task Execution Result Banner */}
      {scanResult && (
        <div className={`p-4 rounded-xl border flex items-start shadow-sm mb-6 animate-in slide-in-from-top-2 fade-in duration-300 ${
          scanResult.type === 'success' 
            ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]' 
            : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
        }`}>
          {scanResult.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{scanResult.type === 'success' ? '操作成功' : '操作失败'}</h4>
            <p className="text-sm mt-1">{scanResult.message}</p>
          </div>
          <button onClick={() => setScanResult(null)} className="ml-4 text-current opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Scan Task Card */}
        <div className="glass-card p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-[#DBEAFE] rounded-xl text-[#2563EB] mr-4 shadow-sm">
              <Play size={24} className={isStartingScan ? "animate-pulse" : ""} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">执行扫描任务</h3>
              <p className="text-xs text-[#64748B] mt-1">执行前会先自动检查并清理无效 STRM，再进行增量或全量扫描生成</p>
            </div>
          </div>
          
          <div className="mt-auto space-y-3">
            <button
              onClick={() => handleStartScan(true)}
              disabled={isTaskRunning}
              className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-300 flex justify-center items-center ${
                isStartingScan === 'incremental'
                  ? 'bg-[#60A5FA] text-white cursor-wait shadow-inner'
                  : taskStatus.is_running
                    ? 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E2E8F0]'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8] hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 text-white shadow-md'
              }`}
            >
              {isStartingScan === 'incremental' ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  启动增量扫描中...
                </>
              ) : taskStatus.is_running && taskStatus.current_task === 'Scan & Generate' ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  正在运行 ({taskStatus.progress}%)
                </>
              ) : (
                '增量扫描（仅新增）'
              )}
            </button>
            <button
              onClick={() => handleStartScan(false)}
              disabled={isTaskRunning}
              className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-300 flex justify-center items-center ${
                isStartingScan === 'full'
                  ? 'bg-[#0F172A] text-white cursor-wait shadow-inner'
                  : taskStatus.is_running
                    ? 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E2E8F0]'
                    : 'bg-white border-2 border-[#0F172A] hover:bg-[#F8FAFC] text-[#0F172A] shadow-sm'
              }`}
            >
              {isStartingScan === 'full' ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  启动全量扫描中...
                </>
              ) : (
                '全量扫描（重扫全部 STRM）'
              )}
            </button>
          </div>
        </div>

        {/* Cleanup Task Card */}
        <div className="glass-card p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-[#FEE2E2] rounded-xl text-[#EF4444] mr-4 shadow-sm">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">清理无效文件</h3>
              <p className="text-xs text-[#64748B] mt-1">查找并删除源文件已不存在的 STRM 孤儿文件</p>
            </div>
          </div>
          
          <div className="mt-auto">
            <button
              onClick={handlePreviewCleanup}
              disabled={isTaskRunning}
              className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-300 flex justify-center items-center ${
                isTaskRunning 
                  ? 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E2E8F0]' 
                  : 'bg-white border-2 border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155]'
              }`}
            >
              预览可清理文件
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Running State Card */}
      {taskStatus.is_running && (
        <div className="glass-card overflow-hidden bg-white shadow-lg border border-[#E2E8F0] ring-1 ring-[#2563EB]/20 transform transition-all animate-in slide-in-from-bottom-4 duration-500 rounded-2xl">
          <div className="bg-gradient-to-r from-[#EFF6FF] to-white p-6 border-b border-[#E2E8F0]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <div className="relative flex h-4 w-4 mr-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#2563EB]"></span>
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  {taskStatus.current_task === 'Scan & Generate' ? '扫描与生成任务执行中' : 
                  (taskStatus.current_task === 'Cleanup Orphans' ? '清理无效文件执行中' : taskStatus.current_task)}
                </h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[#2563EB] font-black text-2xl tracking-tight">{taskStatus.progress}%</span>
                <span className="text-xs font-medium text-[#64748B]">{getTaskStateText()}</span>
              </div>
            </div>
            
            {/* Thicker, more prominent progress bar */}
            <div className="w-full bg-[#E2E8F0] rounded-full h-4 mb-6 shadow-inner overflow-hidden relative">
              <div 
                className="bg-gradient-to-r from-[#60A5FA] to-[#2563EB] h-full rounded-full transition-all duration-500 ease-out relative" 
                style={{ width: `${taskStatus.progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
              </div>
            </div>
            
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] flex flex-col">
              <div className="text-xs text-[#64748B] mb-1 font-semibold uppercase tracking-wider flex items-center">
                <Loader2 size={12} className="animate-spin mr-1.5" />
                正在处理
              </div>
              <p className="text-sm text-[#334155] truncate font-mono" title={taskStatus.current_file || undefined}>
                {taskStatus.current_file || '正在初始化上下文...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Configuration Block */}
      <div className="glass-card bg-white border border-[#E2E8F0] overflow-hidden shadow-sm rounded-2xl">
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F172A] flex items-center">
            <Calendar size={18} className="mr-2 text-[#2563EB]" />
            定时任务设置
          </h2>
          <div className="flex items-center">
            <span className={`text-sm font-medium mr-3 ${schedulerEnabled ? 'text-[#059669]' : 'text-[#94A3B8]'}`}>
              {schedulerEnabled ? '已启用' : '已停用'}
            </span>
            <button 
              onClick={() => setSchedulerEnabled(!schedulerEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 ${
                schedulerEnabled ? 'bg-[#059669]' : 'bg-[#CBD5E1]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                schedulerEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">
                  Cron 表达式
                </label>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  disabled={!schedulerEnabled}
                  className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-mono transition-shadow"
                  placeholder="0 0 * * *"
                />
              </div>
              
              <div className="bg-[#EFF6FF] rounded-xl p-4 flex items-start text-sm text-[#1E3A8A] border border-[#BFDBFE]">
                <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-[#3B82F6]" />
                <div>
                  <p className="font-semibold mb-1">
                    当前计划：{schedulerEnabled ? `按照 "${cronExpression}" 定期执行` : '未启用定时执行'}
                  </p>
                  <p className="text-[#3B82F6] opacity-90 text-xs mt-1">
                    调度器状态：{schedulerActive ? '已在线' : '未激活'}{schedulerNextRunAt ? `，下次执行：${new Date(schedulerNextRunAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : ''}
                  </p>
                  <p className="text-[#3B82F6] opacity-90 text-xs mt-1">
                    仍可手动执行任务：无论是否开启定时任务，您始终可以随时手动执行扫描。Cron 表达式格式为 "分 时 日 月 周"。
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-end md:w-48">
              <button
                onClick={handleSaveScheduler}
                disabled={isSavingScheduler}
                className="w-full py-3 px-4 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl font-medium transition-all flex items-center justify-center disabled:opacity-70 shadow-sm hover:shadow-md"
              >
                {isSavingScheduler ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存设置
                  </>
                )}
              </button>
            </div>
          </div>
          
          {schedulerMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center animate-in fade-in ${
              schedulerMessage.type === 'success' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]'
            }`}>
              {schedulerMessage.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              {schedulerMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Execution History */}
      <div className="glass-card overflow-hidden bg-white shadow-sm border border-[#E2E8F0] rounded-2xl">
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A] flex items-center">
            <Clock size={18} className="mr-2 text-[#64748B]" />
            任务执行历史
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] text-xs uppercase tracking-wider border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-4 font-semibold">任务类型</th>
                <th className="px-6 py-4 font-semibold">开始时间</th>
                <th className="px-6 py-4 font-semibold">运行时长</th>
                <th className="px-6 py-4 font-semibold">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-sm text-[#334155]">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4 font-medium text-[#0F172A]">
                    {item.task_type === 'Scan & Generate' ? '扫描与生成' : (item.task_type === 'Cleanup Orphans' ? '清理无效文件' : item.task_type)}
                  </td>
                  <td className="px-6 py-4">{new Date(item.start_time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
                  <td className="px-6 py-4">
                    {item.end_time ? '约 5 分钟' : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {item.status === 'SUCCESS' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"><CheckCircle size={12} className="mr-1.5"/> 成功</span>}
                    {item.status === 'FAILED' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"><AlertTriangle size={12} className="mr-1.5"/> 失败</span>}
                    {item.status === 'RUNNING' && <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"><Play size={12} className="mr-1.5"/> 运行中</span>}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-[#94A3B8]">
                    暂无历史任务记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-[24px] max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center text-[#EF4444] bg-[#FEF2F2]">
              <AlertTriangle size={24} className="mr-3" />
              <h2 className="text-xl font-bold">确认清理操作</h2>
            </div>
            <div className="p-6">
              <p className="text-[#334155] mb-4">
                将永久删除以下 <span className="font-bold text-[#EF4444] px-1 bg-[#FEE2E2] rounded">{cleanupFiles.length}</span> 个失效的 STRM 文件：
              </p>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 max-h-60 overflow-y-auto custom-scrollbar">
                <ul className="space-y-2 font-mono text-xs text-[#64748B]">
                  {cleanupFiles.length > 0 ? cleanupFiles.map((f, i) => (
                    <li key={i} className="truncate hover:text-[#0F172A] transition-colors">{f}</li>
                  )) : (
                    <li className="text-center py-4">未找到需要清理的文件。</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-[#E2E8F0] flex justify-end space-x-3 bg-[#F8FAFC]">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="px-6 py-2.5 rounded-xl font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeCleanup}
                disabled={cleanupFiles.length === 0}
                className={`px-6 py-2.5 rounded-xl font-medium text-white transition-all flex items-center shadow-sm ${
                  cleanupFiles.length === 0 
                    ? 'bg-[#FCA5A5] cursor-not-allowed' 
                    : 'bg-[#EF4444] hover:bg-[#DC2626] hover:shadow-md'
                }`}
              >
                <Trash2 size={18} className="mr-2" />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;