import { NavLink } from 'react-router-dom';
import { Home, Settings, Activity, FileText } from 'lucide-react';

const Sidebar = () => {
  const links = [
    { to: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/config', icon: <Settings size={20} />, label: 'Configuration' },
    { to: '/tasks', icon: <Activity size={20} />, label: 'Tasks' },
    { to: '/logs', icon: <FileText size={20} />, label: 'Logs' },
  ];

  return (
    <aside className="w-64 bg-[#1e1e1e] border-r border-[#3d3d3d] flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">STRM Generator</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#00a8ff] bg-opacity-10 text-[#00a8ff]'
                  : 'text-gray-400 hover:bg-[#2d2d2d] hover:text-white'
              }`
            }
          >
            {link.icon}
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-[#3d3d3d] text-sm text-gray-500">
        v1.0.0
      </div>
    </aside>
  );
};

export default Sidebar;