import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F7FB] text-[#0F172A] font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;