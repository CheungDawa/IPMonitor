import React, { useEffect, useState } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Bell,
  Activity,
  MapPin,
  RefreshCw,
  Search,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import { DeviceMap } from '../components/DeviceMap';
import { formatTimeOnly } from '../utils/format';

export const Dashboard: React.FC<{ onNavigate: (view: string, filter?: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>({
    total_devices: 0,
    online_devices: 0,
    offline_devices: 0,
    unknown_devices: 0,
    disabled_devices: 0,
    located_devices: 0,
    unlocated_devices: 0,
    uptime_ratio: 0.0,
    active_alerts: 0
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchKey, setSearchKey] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, eRes, dRes] = await Promise.all([
        api.getDashboardStats(),
        api.getRecentEvents(10),
        api.listDevices({ page: 1, page_size: 100 })
      ]);
      setStats(sRes || {});
      setRecentEvents(eRes || []);
      setDevices(dRes?.items || []);
    } catch (e: any) {
      console.error('加载大屏数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 每 15 秒轻量轮询大屏数据
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredDevices = devices.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchKey.trim()) {
      const k = searchKey.trim().toLowerCase();
      return d.name.toLowerCase().includes(k) || d.ip_address.includes(k);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 顶部标题与手动刷新 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>监控总览大屏</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            全局节点运行健康度、地理分布与告警事件实时汇聚
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>刷新数据</span>
        </button>
      </div>

      {/* 统计指标卡片 (参考现代运维面板) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem'
      }}>
        {/* 设备总数 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('devices')}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Server size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>受控设备总数</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>{stats.total_devices}</div>
          </div>
        </div>

        {/* 在线设备 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setStatusFilter('ONLINE')}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>正常在线</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{stats.online_devices}</div>
          </div>
        </div>

        {/* 离线告警 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setStatusFilter('OFFLINE')}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>离线异常</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{stats.offline_devices}</div>
          </div>
        </div>

        {/* 状态未知 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setStatusFilter('UNKNOWN')}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <HelpCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>探测中/未知</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{stats.unknown_devices}</div>
          </div>
        </div>

        {/* 综合在线率 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>整体可用度</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.uptime_ratio >= 99 ? '#34d399' : '#38bdf8' }}>
              {stats.uptime_ratio}%
            </div>
          </div>
        </div>

        {/* 活动告警 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => onNavigate('alerts')}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <Bell size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>未结活动告警</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.active_alerts > 0 ? '#f43f5e' : '#f8fafc' }}>
              {stats.active_alerts}
            </div>
          </div>
        </div>
      </div>

      {/* 地图与事件流区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* 左侧：集成设备地理分布地图 */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <MapPin size={18} className="text-blue-500" />
              <span>设备地理分布</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('map')}>
              <span>全屏地图</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
          <DeviceMap height="380px" />
        </div>

        {/* 右侧：最新状态变更时间线 */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600 }}>实时事件时间线</span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reports')}>全部事件</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentEvents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                暂无状态变更记录
              </div>
            ) : (
              recentEvents.map((ev) => {
                const isOnline = ev.event_type === 'online';
                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.375rem',
                      backgroundColor: '#0f172a',
                      borderLeft: `4px solid ${isOnline ? '#10b981' : '#ef4444'}`,
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <strong style={{ color: '#f8fafc' }}>{ev.device_name}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                        {formatTimeOnly(ev.created_at)}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8' }}>
                      IP: {ev.ip_address} | {isOnline ? '🟢 已上线恢复' : '🔴 设备离线'}
                    </div>
                    {ev.duration_seconds > 0 && (
                      <div style={{ color: '#60a5fa', fontSize: '0.725rem', marginTop: '2px' }}>
                        离线持续: {ev.duration_seconds} 秒
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 下方：设备状态实时网格卡片 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['ALL', 'ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'ALL' && '全部设备'}
                {s === 'ONLINE' && '🟢 在线'}
                {s === 'OFFLINE' && '🔴 离线'}
                {s === 'UNKNOWN' && '🟡 未知'}
                {s === 'DISABLED' && '⚪ 已禁用'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2rem', paddingRight: '0.75rem', width: '200px', fontSize: '0.8rem' }}
                placeholder="搜索设备名称/IP..."
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('devices')}>管理台账</button>
          </div>
        </div>

        {/* 设备卡片列表 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '0.75rem'
        }}>
          {filteredDevices.map((d) => {
            let badgeClass = 'badge-online';
            if (d.status === 'OFFLINE') badgeClass = 'badge-offline';
            else if (d.status === 'UNKNOWN') badgeClass = 'badge-unknown';
            else if (d.status === 'DISABLED') badgeClass = 'badge-disabled';

            return (
              <div
                key={d.id}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '0.5rem',
                  padding: '0.85rem',
                  transition: 'border-color 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                    {d.name}
                  </div>
                  <span className={`badge ${badgeClass}`}>{d.status}</span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  {d.ip_address}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '0.4rem' }}>
                  <span>{d.group_name || '默认分组'}</span>
                  <span>{d.method.toUpperCase()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
