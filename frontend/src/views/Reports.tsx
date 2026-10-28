import React, { useEffect, useState } from 'react';
import { BarChart3, Download, Clock, AlertOctagon, TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export const Reports: React.FC = () => {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<any>({
    total_outages: 0,
    mttr_seconds: 0,
    top_failed_devices: [],
    device_availabilities: []
  });
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [sRes, hRes] = await Promise.all([
        api.getStatistics(days),
        api.getHistory({ page: 1, page_size: 50 })
      ]);
      setStats(sRes || {});
      setHistoryEvents(hRes?.items || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [days]);

  const formatSeconds = (sec: number) => {
    if (!sec) return '0秒';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}分${s}秒` : `${s}秒`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={22} className="text-emerald-500" />
            <span>历史分析与运维报表中心</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            设备在线率、可用度指标、平均故障恢复时间 (MTTR) 及多维报表导出
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className="select"
            style={{ width: '130px' }}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>过去 7 天</option>
            <option value={14}>过去 14 天</option>
            <option value={30}>过去 30 天</option>
          </select>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.open(`/api/v1/reports/export-excel?days=${days}`)}
          >
            <Download size={14} />
            <span>导出统计报表 (Excel)</span>
          </button>
        </div>
      </div>

      {/* 报表指标大卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertOctagon size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>统计周期内故障离线总次数</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{stats.total_outages} 次</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>平均故障恢复时长 (MTTR)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>{formatSeconds(stats.mttr_seconds)}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>监控在线设备覆盖</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{stats.total_monitored_devices} 台</div>
          </div>
        </div>
      </div>

      {/* 故障排行与可用度分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
        {/* 左侧：故障频次 Top 5 */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>故障发生频次 Top 5 节点</h3>
          {stats.top_failed_devices?.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1.5rem', textAlign: 'center' }}>
              周期内所有设备均运行稳定，无离线记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.top_failed_devices?.map((d: any, idx: number) => (
                <div key={idx} style={{
                  padding: '0.65rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{d.device_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.ip_address}</div>
                  </div>
                  <span className="badge badge-offline">{d.failure_count} 次故障</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：设备可用度一览 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', fontWeight: 600, fontSize: '0.95rem' }}>
            各设备可用度 (Uptime %) 明细
          </div>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>设备名称</th>
                  <th>IP地址</th>
                  <th>分组</th>
                  <th>当前状态</th>
                  <th>周期可用度</th>
                </tr>
              </thead>
              <tbody>
                {stats.device_availabilities?.map((d: any) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td><code style={{ color: '#38bdf8', fontSize: '0.8rem' }}>{d.ip_address}</code></td>
                    <td>{d.group_name}</td>
                    <td><span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span></td>
                    <td>
                      <span style={{ fontWeight: 700, color: d.uptime_percent >= 99 ? '#34d399' : '#fbbf24' }}>
                        {d.uptime_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 历史状态事件明细流水 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', fontWeight: 600, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>状态变动历史流水 (近 50 条)</span>
          <button className="btn btn-secondary btn-sm" onClick={loadReportData} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>刷新</span>
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>事件ID</th>
              <th>设备名称</th>
              <th>IP 地址</th>
              <th>前置状态</th>
              <th>变更后状态</th>
              <th>事件类型</th>
              <th>影响时长</th>
              <th>明细详情</th>
              <th>发生时间</th>
            </tr>
          </thead>
          <tbody>
            {historyEvents.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  暂无状态变更历史事件
                </td>
              </tr>
            ) : (
              historyEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>#{ev.id}</td>
                  <td style={{ fontWeight: 600 }}>{ev.device_name}</td>
                  <td><code style={{ color: '#38bdf8', fontSize: '0.8rem' }}>{ev.ip_address}</code></td>
                  <td><span className={`badge badge-${ev.from_status.toLowerCase()}`}>{ev.from_status}</span></td>
                  <td><span className={`badge badge-${ev.to_status.toLowerCase()}`}>{ev.to_status}</span></td>
                  <td>{ev.event_type}</td>
                  <td>{ev.duration_seconds > 0 ? `${ev.duration_seconds}秒` : '-'}</td>
                  <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ev.details}</td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {formatDateTime(ev.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
