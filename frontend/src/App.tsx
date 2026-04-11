import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Configuration from './pages/Configuration';
import Tasks from './pages/Tasks';
import Logs from './pages/Logs';
import { useStore } from './store';

function App() {
  const connectWebSocket = useStore(state => state.connectWebSocket);

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/config" element={<Configuration />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;