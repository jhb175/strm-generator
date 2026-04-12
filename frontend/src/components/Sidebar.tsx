import { NavLink } from 'react-router-dom';
import { Home, Settings, Activity, FileText } from 'lucide-react';

const Sidebar = () => {
  const links = [
    { to: '/', icon: <Home size={18} strokeWidth={2} />, label: '总览' },
    { to: '/config', icon: <Settings size={18} strokeWidth={2} />, label: '配置' },
    { to: '/tasks', icon: <Activity size={18} strokeWidth={2} />, label: '任务' },
    { to: '/logs', icon: <FileText size={18} strokeWidth={2} />, label: '日志' },
  ];

  return (
    <aside className="w-[248px] bg-[#0F172A] flex flex-col h-full shadow-xl z-10">
      <div className="p-6">
        <h1 className="text-[32px] font-bold tracking-tight text-white leading-10">映链</h1>
        <p className="text-xs text-[#94A3B8] mt-1 font-medium tracking-wide">STRM Media Bridge</p>
      </div>
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white shadow-md'
                  : 'text-[#E2E8F0] hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {link.icon}
            <span className="text-[14px] font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-5 border-t border-white/10 flex items-center justify-between text-xs text-[#94A3B8]">
        <span>系统状态: 正常</span>
        <span className="bg-[#1E293B] px-2 py-1 rounded-md text-[#E2E8F0]">v1.0.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;