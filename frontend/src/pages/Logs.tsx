import { useState, useEffect } from 'react';
import { Filter, Search, Terminal } from 'lucide-react';
import type { LogEntry } from '../types';
import { fetchLogs } from '../api';

const Logs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('全部');

  useEffect(() => {
    let apiLevel: string | undefined;
    switch(filterLevel) {
      case '信息': apiLevel = 'INFO'; break;
      case '警告': apiLevel = 'WARN'; break;
      case '错误': apiLevel = 'ERROR'; break;
      default: apiLevel = undefined;
    }
    
    fetchLogs(apiLevel).then(setLogs).catch(console.error);
  }, [filterLevel]);

  const filteredLogs = logs;

  const getLogColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-[#2563EB] bg-[#DBEAFE]';
      case 'WARN': return 'text-[#D97706] bg-[#FEF3C7]';
      case 'ERROR': return 'text-[#DC2626] bg-[#FEE2E2]';
      default: return 'text-[#64748B] bg-[#F1F5F9]';
    }
  };

  const getLogLabel = (level: string) => {
    switch (level) {
      case 'INFO': return '信息';
      case 'WARN': return '警告';
      case 'ERROR': return '错误';
      default: return level;
    }
  };

  const translateMessage = (message: string) => {
    // Basic prefix matching
    if (message.startsWith('Scan complete')) return message.replace('Scan complete', '扫描完成');
    if (message.startsWith('Generation started')) return message.replace('Generation started', '生成任务已开始');
    if (message.startsWith('Cleanup started')) return message.replace('Cleanup started', '清理任务已开始');
    if (message.startsWith('Config set: source_dir =')) return message.replace('Config set: source_dir =', '配置已更新：媒体源目录 =');
    if (message.startsWith('Config set: output_dir =')) return message.replace('Config set: output_dir =', '配置已更新：输出目录 =');
    if (message.startsWith('Config set:')) return message.replace('Config set:', '配置已更新：');
    
    // More complex regex matching could go here
    return message;
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-[24px] font-semibold text-[#0F172A] flex items-center">
          <Terminal size={24} className="mr-3 text-[#2563EB]" />
          运行日志
        </h1>
        <div className="flex space-x-2 bg-white p-1 rounded-xl shadow-sm border border-[#E2E8F0]">
          {['全部', '信息', '警告', '错误'].map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === level
                  ? 'bg-[#2563EB] text-white shadow'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 glass-card bg-[#F8FAFC] overflow-hidden flex flex-col">
        <div className="bg-white px-5 py-3 border-b border-[#E2E8F0] flex items-center text-[#64748B] text-xs font-mono shadow-sm z-10">
          <Filter size={14} className="mr-2" />
          <span>当前显示 {filteredLogs.length} 条记录</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 font-mono text-sm bg-white">
          <div className="space-y-1.5">
            {filteredLogs.map(log => (
              <div key={log.id} className="flex group hover:bg-[#F1F5F9] px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0]">
                <span className="text-[#94A3B8] w-[180px] shrink-0 select-none flex items-center">
                  {new Date(log.timestamp).toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </span>
                <span className={`w-[60px] shrink-0 text-xs font-bold select-none px-2 py-0.5 rounded flex items-center justify-center mr-4 ${getLogColor(log.level)}`}>
                  {getLogLabel(log.level)}
                </span>
                <span className="text-[#334155] break-all flex items-center">
                  {translateMessage(log.message)}
                </span>
              </div>
            ))}
          </div>
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[#94A3B8] space-y-4">
              <Search size={48} className="opacity-20" />
              <p>未找到符合 '{filterLevel}' 级别的日志记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;