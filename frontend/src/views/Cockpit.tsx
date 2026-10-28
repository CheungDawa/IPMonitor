import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings as SettingsIcon,
  Layers,
  Grid,
  Radio,
  Zap,
  BellRing,
  ArrowRight,
  MapPin
} from 'lucide-react';
import { api } from '../services/api';

interface CockpitProps {
  onEnterAdmin: () => void;
}

const DEFAULT_CENTER: [number, number] = [35.0, 105.0];
const DEFAULT_ZOOM = 5;

export const Cockpit: React.FC<CockpitProps> = ({ onEnterAdmin }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [centerView, setCenterView] = useState<'map' | 'grid'>('map');
  const [refreshCountdown, setRefreshCountdown] = useState(10);
  const [mapTheme, setMapTheme] = useState<'autonavi' | 'satellite'>('autonavi');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayersRef = useRef<L.Layer[]>([]);

  // 动态读取后台管理员设定的默认视角配置
  const mapConfig = data?.map_config || {
    center_lat: DEFAULT_CENTER[0],
    center_lng: DEFAULT_CENTER[1],
    default_zoom: DEFAULT_ZOOM,
    focus_name: '默认视野'
  };

  // 切换底图引擎 (高德超清矢量路网 / 卫星影像，无需任何额外 API Key)
  const updateTileLayer = (theme: 'autonavi' | 'satellite', map: L.Map) => {
    tileLayersRef.current.forEach(layer => map.removeLayer(layer));
    tileLayersRef.current = [];

    if (theme === 'autonavi') {
      const layer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
        minZoom: 3,
        attribution: '© 高德地图 (AutoNavi)'
      }).addTo(map);
      tileLayersRef.current.push(layer);
    } else if (theme === 'satellite') {
      const base = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
        minZoom: 3,
        attribution: '© 高德卫星影像'
      }).addTo(map);
      const overlay = L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
        minZoom: 3,
      }).addTo(map);
      tileLayersRef.current.push(base, overlay);
    }
  };

  // 时钟更新
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 加载聚合数据
  const loadCockpitData = async () => {
    setLoading(true);
    try {
      const res = await api.getCockpitOverview();
      setData(res || null);
      setRefreshCountdown(10);
    } catch (e: any) {
      console.error('加载驾驶舱数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCockpitData();
    const intervalTimer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          loadCockpitData();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalTimer);
  }, []);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // 响应底图主题变更
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateTileLayer(mapTheme, mapInstanceRef.current);
    }
  }, [mapTheme]);

  // 初始化地图
  useEffect(() => {
    if (centerView !== 'map' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        minZoom: 3,
        maxZoom: 18
      }).setView([mapConfig.center_lat, mapConfig.center_lng], mapConfig.default_zoom);

      updateTileLayer(mapTheme, map);

      // 缩放控件放右下角
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    // 渲染点位
    if (markersLayerRef.current && data?.map_points) {
      markersLayerRef.current.clearLayers();
      const bounds = L.latLngBounds([]);

      data.map_points.forEach((p: any) => {
        if (p.latitude === null || p.longitude === null) return;
        bounds.extend([p.latitude, p.longitude]);

        let pinColor = '#10b981';
        let glowColor = 'rgba(16, 185, 129, 0.4)';
        let statusBadge = '<span style="color:#10b981;font-weight:bold;">🟢 在线</span>';

        if (p.status === 'OFFLINE') {
          pinColor = '#ef4444';
          glowColor = 'rgba(239, 68, 68, 0.6)';
          statusBadge = '<span style="color:#ef4444;font-weight:bold;">🔴 故障离线</span>';
        } else if (p.status === 'UNKNOWN') {
          pinColor = '#f59e0b';
          glowColor = 'rgba(245, 158, 11, 0.5)';
          statusBadge = '<span style="color:#f59e0b;font-weight:bold;">🟡 探测中</span>';
        } else if (p.status === 'DISABLED') {
          pinColor = '#64748b';
          glowColor = 'transparent';
          statusBadge = '<span style="color:#94a3b8;">⚪ 禁用</span>';
        }

        const iconHtml = `
          <div style="position:relative; width:26px; height:26px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:100%; height:100%; border-radius:50%; background-color:${glowColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width:14px; height:14px; border-radius:50%; background-color:${pinColor}; border:2px solid #ffffff; box-shadow:0 0 10px ${pinColor}; position:relative; z-index:2;"></div>
          </div>
        `;

        const icon = L.divIcon({
          className: 'custom-cockpit-pin',
          html: iconHtml,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker([p.latitude, p.longitude], { icon });
        const popupContent = `
          <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a; min-width: 170px;">
            <div style="font-weight: 700; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              ${p.name}
            </div>
            <div><strong>IP:</strong> ${p.ip_address}</div>
            <div><strong>状态:</strong> ${statusBadge}</div>
            <div><strong>协议:</strong> ${p.method.toUpperCase()}</div>
            <div><strong>分组:</strong> ${p.group_name || '未分组'}</div>
            ${p.location_address ? `<div style="color:#475569;margin-top:2px;"><strong>位置:</strong> ${p.location_address}</div>` : ''}
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayerRef.current?.addLayer(marker);
      });

      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } else {
        mapInstanceRef.current.setView([mapConfig.center_lat, mapConfig.center_lng], mapConfig.default_zoom);
      }
    }
  }, [centerView, data?.map_points]);

  const summary = data?.summary || {
    total_devices: 0,
    online_devices: 0,
    offline_devices: 0,
    unknown_devices: 0,
    uptime_ratio: 0,
    active_alerts_count: 0
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#070a13',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* 1. 沉浸式驾驶舱顶部 HUD 仪表条 */}
      <header style={{
        height: '64px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
      }}>
        {/* 左侧：系统标识与呼吸灯 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(37, 99, 235, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>IPMonitor</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', border: '1px solid #0284c7', padding: '1px 6px', borderRadius: '4px' }}>
                NOC 态势感知驾驶舱
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
              <span>核心调度引擎心跳中 · 轮询倒计时: {refreshCountdown}s</span>
            </div>
          </div>
        </div>

        {/* 中间：全网核心状态遥测 KPI 卡片 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>设备总数</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>{summary.total_devices}</div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }}></div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#34d399' }}>🟢 在线节点</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{summary.online_devices}</div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }}></div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: summary.offline_devices > 0 ? '#f87171' : '#94a3b8' }}>
              🔴 离线故障
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: summary.offline_devices > 0 ? '#ef4444' : '#f8fafc' }}>
              {summary.offline_devices}
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }}></div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>🟡 探测中</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>{summary.unknown_devices}</div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }}></div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>全网可用度 (SLA)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{summary.uptime_ratio}%</div>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }}></div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: summary.active_alerts_count > 0 ? '#f43f5e' : '#94a3b8' }}>
              🚨 未结告警
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: summary.active_alerts_count > 0 ? '#f43f5e' : '#f8fafc' }}>
              {summary.active_alerts_count}
            </div>
          </div>
        </div>

        {/* 右侧：时间与管理后台入口 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '0.375rem',
            padding: '0.35rem 0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Clock size={14} />
            <span>{currentTime}</span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏展示'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadCockpitData}
            disabled={loading}
            title="即刻拉取最新态势"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            className="btn btn-primary"
            style={{ fontWeight: 600, boxShadow: '0 0 15px rgba(37, 99, 235, 0.4)' }}
            onClick={onEnterAdmin}
          >
            <SettingsIcon size={16} />
            <span>运维管理后台</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* 2. 主体驾驶舱工作区 (三栏布局: 遥测栏 + 核心态势中枢 + 告警事件栏) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: '1rem', padding: '1rem', minHeight: 0 }}>
        {/* 左栏：遥测与健康度 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          {/* 关键链路往返时延 (Latency Radar) */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>
                <Zap size={16} />
                <span>关键链路时延遥测</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>实时 ICMP/TCP</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data?.latency_nodes?.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>暂无在线链路遥测数据</div>
              ) : (
                data?.latency_nodes?.map((node: any) => {
                  const ms = node.latency_ms;
                  let color = '#34d399';
                  if (ms > 100) color = '#ef4444';
                  else if (ms > 30) color = '#f59e0b';

                  return (
                    <div
                      key={node.id}
                      style={{
                        padding: '0.5rem 0.65rem',
                        backgroundColor: '#0f172a',
                        borderRadius: '0.375rem',
                        border: '1px solid #1e293b',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {node.name}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color }}>
                          {ms} ms
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                        <span>{node.ip}</span>
                        <span>{node.method}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 分组健康度雷达/进度条 */}
          <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: '#818cf8', marginBottom: '0.75rem' }}>
              <Activity size={16} />
              <span>分组健康态势</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data?.group_health?.map((g: any) => (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#e2e8f0', fontWeight: 500 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: g.color || '#3b82f6' }}></span>
                      <span>{g.name}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: g.health_percent >= 90 ? '#34d399' : '#f87171' }}>
                      {g.health_percent}% ({g.online}/{g.total})
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${g.health_percent}%`, height: '100%', backgroundColor: g.health_percent >= 90 ? '#10b981' : '#ef4444', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 中栏：全景核心态势中枢 (地图态势 / 节点状态矩阵) */}
        <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 模式切换工具条 */}
          <div style={{
            position: 'absolute', top: '12px', left: '12px', zIndex: 600,
            display: 'flex', gap: '0.35rem',
            backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
            padding: '3px', borderRadius: '0.375rem', border: '1px solid #334155'
          }}>
            <button
              className={`btn btn-sm ${centerView === 'map' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.6rem' }}
              onClick={() => setCenterView('map')}
            >
              <Layers size={13} />
              <span>全屏拓扑地图</span>
            </button>
            <button
              className={`btn btn-sm ${centerView === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.25rem 0.6rem' }}
              onClick={() => setCenterView('grid')}
            >
              <Grid size={13} />
              <span>状态矩阵网格</span>
            </button>
          </div>

          {/* 地图右上方控制条 (底图引擎切换 & 视角复位) */}
          {centerView === 'map' && (
            <div style={{
              position: 'absolute', top: '12px', right: '12px', zIndex: 600,
              display: 'flex', gap: '0.35rem',
              backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(4px)',
              padding: '3px 6px', borderRadius: '0.375rem', border: '1px solid #334155',
              alignItems: 'center'
            }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#38bdf8' }}
                onClick={() => mapInstanceRef.current?.setView([mapConfig.center_lat, mapConfig.center_lng], mapConfig.default_zoom)}
                title={`复位至后台配置的默认视角: ${mapConfig.focus_name}`}
              >
                <MapPin size={12} />
                <span>聚焦: {mapConfig.focus_name}</span>
              </button>
              <div style={{ width: '1px', height: '14px', backgroundColor: '#334155' }}></div>
              <button
                type="button"
                className={`btn btn-sm ${mapTheme === 'autonavi' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setMapTheme('autonavi')}
                title="高德超清中文路网 (免 Key 极速，街道/乡镇全景)"
              >
                高德高清
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mapTheme === 'satellite' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setMapTheme('satellite')}
                title="高德卫星影像 + 道路注记"
              >
                卫星实景
              </button>
            </div>
          )}

          {/* 地图视图 */}
          {centerView === 'map' ? (
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          ) : (
            /* 状态矩阵网格视图 */
            <div style={{ flex: 1, padding: '3.5rem 1.25rem 1.25rem', overflowY: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.75rem'
              }}>
                {data?.map_points?.map((p: any) => {
                  let badge = 'badge-online';
                  if (p.status === 'OFFLINE') badge = 'badge-offline';
                  else if (p.status === 'UNKNOWN') badge = 'badge-unknown';
                  else if (p.status === 'DISABLED') badge = 'badge-disabled';

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </span>
                        <span className={`badge ${badge}`}>{p.status}</span>
                      </div>
                      <code style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{p.ip_address}</code>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>
                        <span>{p.group_name}</span>
                        <span>{p.method.toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 右栏：告警实时广播墙与事件流水 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          {/* 实时活动告警播报墙 */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: '#f43f5e' }}>
                <BellRing size={16} />
                <span>实时告警广播</span>
              </div>
              <span className="badge badge-offline" style={{ fontSize: '0.7rem' }}>
                {data?.active_alerts?.length || 0} 异常
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data?.active_alerts?.length === 0 ? (
                <div style={{ color: '#10b981', fontSize: '0.85rem', textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={32} />
                  <span>全网节点运行稳定，无活动故障</span>
                </div>
              ) : (
                data?.active_alerts?.map((al: any) => (
                  <div
                    key={al.id}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.375rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#f87171', marginBottom: '2px' }}>
                      <span>{al.device_name}</span>
                      <span style={{ fontSize: '0.7rem', color: '#fca5a5' }}>
                        {al.triggered_at ? new Date(al.triggered_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.75rem', marginBottom: '2px' }}>IP: {al.ip_address}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{al.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 最新状态跃迁流水 (Ticker) */}
          <div className="card" style={{ height: '260px', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.75rem' }}>
              <Radio size={16} />
              <span>状态跃迁动态流水</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {data?.events_ticker?.map((ev: any) => {
                const isOnline = ev.event_type === 'online';
                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '0.45rem 0.6rem',
                      borderRadius: '0.375rem',
                      backgroundColor: '#0f172a',
                      borderLeft: `3px solid ${isOnline ? '#10b981' : '#ef4444'}`,
                      fontSize: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#f8fafc' }}>{ev.device_name}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{ev.ip_address} · {ev.event_type}</div>
                    </div>
                    <span style={{ color: isOnline ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {isOnline ? '🟢 已上线' : '🔴 离线'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
