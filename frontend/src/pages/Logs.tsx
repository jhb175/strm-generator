import { useState, useEffect } from 'react';
import { Filter, Search, Terminal } from 'lucide-react';
import type { LogEntry } from '../types';
import { fetchLogs } from '../api';

const Logs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  useEffect(() => {
    const level = filterLevel === 'ALL' ? undefined : filterLevel;
    fetchLogs(level).then(setLogs).catch(console.error);
  }, [filterLevel]);

  const filteredLogs = logs;

  const getLogColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-[#00a8ff]';
      case 'WARN': return 'text-yellow-500';
      case 'ERROR': return 'text-[#e84118]';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Terminal size={28} className="mr-3 text-[#00a8ff]" />
          System Logs
        </h1>
        <div className="flex space-x-2">
          {['ALL', 'INFO', 'WARN', 'ERROR'].map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === level
                  ? 'bg-[#00a8ff] text-white shadow-lg shadow-blue-500/20'
                  : 'bg-[#1e1e1e] border border-[#3d3d3d] text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#121212] rounded-xl border border-[#3d3d3d] overflow-hidden flex flex-col shadow-inner">
        <div className="bg-[#1e1e1e] px-4 py-3 border-b border-[#3d3d3d] flex items-center text-gray-400 text-sm font-mono">
          <Filter size={16} className="mr-2" />
          <span>Viewing {filteredLogs.length} entries</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          <div className="space-y-1">
            {filteredLogs.map(log => (
              <div key={log.id} className="flex group hover:bg-[#2d2d2d]/50 px-2 py-1 rounded transition-colors">
                <span className="text-gray-500 w-48 shrink-0 select-none">
                  {new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                </span>
                <span className={`w-16 shrink-0 font-bold select-none ${getLogColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300 break-all">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <Search size={48} className="opacity-20" />
              <p>No logs found matching filter '{filterLevel}'</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;