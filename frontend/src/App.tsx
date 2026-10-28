import React, { useEffect, useState } from 'react';
import {
  Server,
  MapPin,
  FolderTree,
  Bell,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  MonitorPlay,
  ChevronLeft
} from 'lucide-react';
import { getToken, clearToken, api } from './services/api';
import { Login } from './views/Login';
import { Cockpit } from './views/Cockpit';
import { DeviceList } from './views/DeviceList';
import { MapView } from './views/MapView';
import { Groups } from './views/Groups';
import { Alerts } from './views/Alerts';
import { Reports } from './views/Reports';
import { Settings } from './views/Settings';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [portal, setPortal] = useState<'cockpit' | 'admin' | 'login'>('cockpit');
  const [currentAdminView, setCurrentAdminView] = useState<string>('devices');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.getMe()
        .then((user) => setCurrentUser(user))
        .catch(() => clearToken())
        .finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
    }
  }, []);

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setPortal('cockpit');
  };

  const handleEnterAdmin = () => {
    if (currentUser) {
      setPortal('admin');
    } else {
      setPortal('login');
    }
  };

  if (initialLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b0f19',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            animation: 'pulse 1.5s infinite'
          }}></div>
          <span>正在连接 IPMonitor 网络探测中心...</span>
        </div>
      </div>
    );
  }

  // 1. 监控驾驶舱门户 (默认沉浸式态势感知大屏)
  if (portal === 'cockpit') {
    return <Cockpit onEnterAdmin={handleEnterAdmin} />;
  }

  // 2. 登录认证界面
  if (portal === 'login') {
    return (
      <Login
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setPortal('admin');
        }}
        onCancel={() => setPortal('cockpit')}
      />
    );
  }

  // 3. 运维管理后台门户 (标准专业运维控制台)
  const navItems = [
    { id: 'devices', label: '设备清单台账', icon: Server },
    { id: 'map', label: '空间地图标注', icon: MapPin },
    { id: 'groups', label: '分组架构管理', icon: FolderTree },
    { id: 'alerts', label: '告警与通知', icon: Bell },
    { id: 'reports', label: '报表与指标', icon: BarChart3 },
    { id: 'settings', label: '系统设置与备份', icon: SettingsIcon },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19' }}>
      {/* 侧边管理导航 */}
      <aside style={{
        width: '240px',
        backgroundColor: '#111827',
        borderRight: '1px solid #1f293d',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        {/* 系统 Logo 与后台标识 */}
        <div style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          borderBottom: '1px solid #1f293d'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.5rem',
            backgroundColor: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.025em' }}>
              IPMonitor <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>Admin</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>运维管理控制台</div>
          </div>
        </div>

        {/* 快速返回驾驶舱按钮 */}
        <div style={{ padding: '0.85rem 0.75rem 0.25rem 0.75rem' }}>
          <button
            onClick={() => setPortal('cockpit')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem',
              borderRadius: '0.375rem',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="返回全景监控大屏与空间地图"
          >
            <ChevronLeft size={16} />
            <MonitorPlay size={16} />
            <span>返回监控驾驶舱</span>
          </button>
        </div>

        {/* 导航菜单列表 */}
        <nav style={{ padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentAdminView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentAdminView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 500,
                  color: active ? '#ffffff' : '#94a3b8',
                  backgroundColor: active ? '#2563eb' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 用户信息与退出登录 */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #1f293d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              color: '#38bdf8',
              fontSize: '0.85rem'
            }}>
              {currentUser?.username ? currentUser.username[0].toUpperCase() : 'A'}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                {currentUser?.username || '管理员'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>引擎调度正常</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="退出登录并返回大屏"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '0.25rem'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 管理工作区 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ padding: '1.75rem 2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {currentAdminView === 'devices' && <DeviceList />}
          {currentAdminView === 'map' && <MapView />}
          {currentAdminView === 'groups' && <Groups />}
          {currentAdminView === 'alerts' && <Alerts />}
          {currentAdminView === 'reports' && <Reports />}
          {currentAdminView === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
};

export default App;
