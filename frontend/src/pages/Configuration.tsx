import { useEffect, useState } from 'react';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import type { AppConfig } from '../types';
import { fetchConfig as apiFetchConfig, saveConfig as apiSaveConfig } from '../api';

const Configuration = () => {
  const [config, setConfig] = useState<AppConfig>({ source_dir: '', output_dir: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetchConfig()
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || '加载配置失败');
        setLoading(false);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (!config.source_dir || !config.output_dir) {
        setError("路径不能为空。");
      } else {
        await apiSaveConfig(config);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || '保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config.source_dir) return <div className="text-[#64748B] text-center py-10">加载中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold text-[#0F172A] mb-6">系统配置</h1>

      <div className="glass-card bg-white overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">目录映射配置</h2>
          <p className="text-sm text-[#64748B] mt-1">配置媒体源目录与 STRM 输出目录</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="source_dir" className="block text-sm font-semibold text-[#334155] mb-2">
                媒体源目录 (如 G-Drive 挂载点)
              </label>
              <input
                type="text"
                id="source_dir"
                name="source_dir"
                value={config.source_dir}
                onChange={handleChange}
                className="w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-3 text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors shadow-sm"
                placeholder="/data/clouddrive/gdrive"
              />
              <p className="mt-2 text-xs text-[#64748B]">
                包含 '电影/' 和 '电视剧/' 等分类文件夹的根目录。
              </p>
            </div>

            <div>
              <label htmlFor="output_dir" className="block text-sm font-semibold text-[#334155] mb-2">
                STRM 输出目录
              </label>
              <input
                type="text"
                id="output_dir"
                name="output_dir"
                value={config.output_dir}
                onChange={handleChange}
                className="w-full bg-white border border-[#CBD5E1] rounded-xl px-4 py-3 text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors shadow-sm"
                placeholder="/opt/strm_yesy"
              />
              <p className="mt-2 text-xs text-[#64748B]">
                生成的 .strm 文件将被保存在此目录下，供 Emby 等媒体服务器刮削。
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl flex items-center text-[#EF4444]">
              <AlertCircle size={20} className="mr-2 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-[#ECFDF5] border border-[#6EE7B7] rounded-xl flex items-center text-[#10B981]">
              <CheckCircle size={20} className="mr-2 shrink-0" />
              <span className="text-sm font-medium">配置已成功保存并验证路径。</span>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#E2E8F0] flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center px-6 py-2.5 rounded-xl font-medium transition-colors h-10 ${
                loading
                  ? 'bg-[#93C5FD] text-white cursor-not-allowed'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-md'
              }`}
            >
              <Save size={18} className="mr-2" />
              {loading ? '保存中...' : '保存配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Configuration;