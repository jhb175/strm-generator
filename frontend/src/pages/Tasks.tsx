import { useState, useEffect } from 'react';
import { Play, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { TaskHistoryEntry } from '../types';
import { useStore } from '../store';
import { fetchHistory, startScan, previewCleanup, executeCleanup as apiExecuteCleanup } from '../api';

const Tasks = () => {
  const { taskStatus } = useStore();
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupFiles, setCleanupFiles] = useState<string[]>([]);

  useEffect(() => {
    const loadHistory = () => fetchHistory().then(setHistory).catch(console.error);
    loadHistory();

    window.addEventListener('taskFinished', loadHistory);
    return () => window.removeEventListener('taskFinished', loadHistory);
  }, []);

  const handleStartScan = async () => {
    if (taskStatus.is_running) return;
    try {
      await startScan();
      // The websocket will handle updating the state
    } catch (error) {
      console.error('Failed to start scan:', error);
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
      // The websocket will handle updating the state
    } catch (error) {
      console.error('Failed to execute cleanup:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white mb-8">Tasks</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#1e1e1e] rounded-xl border border-[#3d3d3d] p-6 flex flex-col items-center text-center">
          <div className="p-4 bg-blue-500/10 rounded-full mb-4">
            <Play size={32} className="text-[#00a8ff]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Scan & Generate</h3>
          <p className="text-sm text-gray-400 mb-6">
            Scans source directory for new media and generates corresponding STRM files.
          </p>
          <button
            onClick={handleStartScan}
            disabled={taskStatus.is_running}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              taskStatus.is_running 
                ? 'bg-[#2d2d2d] text-gray-500 cursor-not-allowed' 
                : 'bg-[#00a8ff] hover:bg-[#0097e6] text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {taskStatus.is_running && taskStatus.current_task === 'Scan & Generate' ? 'Running...' : 'Execute Scan'}
          </button>
        </div>

        <div className="bg-[#1e1e1e] rounded-xl border border-[#3d3d3d] p-6 flex flex-col items-center text-center">
          <div className="p-4 bg-red-500/10 rounded-full mb-4">
            <Trash2 size={32} className="text-[#e84118]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Cleanup Orphans</h3>
          <p className="text-sm text-gray-400 mb-6">
            Finds and removes STRM files whose source media no longer exists.
          </p>
          <button
            onClick={handlePreviewCleanup}
            disabled={taskStatus.is_running}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              taskStatus.is_running 
                ? 'bg-[#2d2d2d] text-gray-500 cursor-not-allowed' 
                : 'bg-[#e84118] hover:bg-[#c23616] text-white shadow-lg shadow-red-500/20'
            }`}
          >
            Preview Cleanup
          </button>
        </div>
      </div>

      {taskStatus.is_running && (
        <div className="bg-[#1e1e1e] rounded-xl border border-[#00a8ff] overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Active Task: {taskStatus.current_task}</h3>
              <span className="text-[#00a8ff] font-bold">{taskStatus.progress}%</span>
            </div>
            <div className="w-full bg-[#2d2d2d] rounded-full h-3 mb-3">
              <div 
                className="bg-[#00a8ff] h-3 rounded-full transition-all duration-300" 
                style={{ width: `${taskStatus.progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-400 truncate font-mono bg-[#121212] p-2 rounded border border-[#3d3d3d]">
              {taskStatus.current_file || 'Waiting...'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-[#1e1e1e] rounded-xl border border-[#3d3d3d] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3d3d3d]">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <Clock size={18} className="mr-2" />
            Task History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#2d2d2d] text-gray-400 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">Task Type</th>
                <th className="px-6 py-3 font-medium">Start Time</th>
                <th className="px-6 py-3 font-medium">Duration</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-[#2d2d2d]/50 transition-colors text-sm">
                  <td className="px-6 py-4 text-white font-medium">{item.task_type}</td>
                  <td className="px-6 py-4 text-gray-400">{new Date(item.start_time).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-400">
                    {item.end_time ? '5 mins' : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {item.status === 'success' && <span className="flex items-center text-green-500"><CheckCircle size={14} className="mr-1"/> Success</span>}
                    {item.status === 'failed' && <span className="flex items-center text-red-500"><AlertTriangle size={14} className="mr-1"/> Failed</span>}
                    {item.status === 'running' && <span className="flex items-center text-blue-500"><Play size={14} className="mr-1"/> Running</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#3d3d3d] rounded-xl max-w-2xl w-full shadow-2xl">
            <div className="p-6 border-b border-[#3d3d3d] flex items-center text-red-500">
              <AlertTriangle size={24} className="mr-3" />
              <h2 className="text-xl font-bold text-white">Confirm Cleanup</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-300 mb-4">
                The following {cleanupFiles.length} orphaned STRM files will be permanently deleted:
              </p>
              <div className="bg-[#121212] border border-[#3d3d3d] rounded-lg p-4 max-h-60 overflow-y-auto">
                <ul className="space-y-2 font-mono text-sm text-gray-400">
                  {cleanupFiles.map((f, i) => (
                    <li key={i} className="truncate">{f}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-[#3d3d3d] flex justify-end space-x-4 bg-[#2d2d2d]/30">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="px-6 py-2 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-[#3d3d3d] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeCleanup}
                className="px-6 py-2 rounded-lg font-medium bg-[#e84118] hover:bg-[#c23616] text-white shadow-lg shadow-red-500/20 transition-colors flex items-center"
              >
                <Trash2 size={18} className="mr-2" />
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;