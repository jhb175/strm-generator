import { useEffect, useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
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
        setError(err.message || 'Failed to load configuration');
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
        setError("Paths cannot be empty.");
      } else {
        await apiSaveConfig(config);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config.source_dir) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white mb-8">Configuration</h1>

      <div className="bg-[#1e1e1e] rounded-xl border border-[#3d3d3d] overflow-hidden">
        <form onSubmit={handleSave} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="source_dir" className="block text-sm font-medium text-gray-300 mb-2">
                Source Directory (G-Drive Mount)
              </label>
              <input
                type="text"
                id="source_dir"
                name="source_dir"
                value={config.source_dir}
                onChange={handleChange}
                className="w-full bg-[#2d2d2d] border border-[#3d3d3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00a8ff] focus:ring-1 focus:ring-[#00a8ff] transition-colors"
                placeholder="/data/clouddrive/gdrive"
              />
              <p className="mt-1 text-xs text-gray-500">
                Directory containing '电影/' and '电视剧/' folders.
              </p>
            </div>

            <div>
              <label htmlFor="output_dir" className="block text-sm font-medium text-gray-300 mb-2">
                Output Directory (STRM Library)
              </label>
              <input
                type="text"
                id="output_dir"
                name="output_dir"
                value={config.output_dir}
                onChange={handleChange}
                className="w-full bg-[#2d2d2d] border border-[#3d3d3d] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00a8ff] focus:ring-1 focus:ring-[#00a8ff] transition-colors"
                placeholder="/opt/strm_yesy"
              />
              <p className="mt-1 text-xs text-gray-500">
                Target directory for generated .strm files. Emby should map this.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-[#e84118] bg-opacity-10 border border-[#e84118] rounded-lg flex items-center text-[#e84118]">
              <AlertCircle size={20} className="mr-2" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-green-500 bg-opacity-10 border border-green-500 rounded-lg flex items-center text-green-500">
              Configuration saved and paths validated successfully.
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#3d3d3d] flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                  : 'bg-[#00a8ff] hover:bg-[#0097e6] text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              <Save size={18} className="mr-2" />
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Configuration;