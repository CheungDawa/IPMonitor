import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface DeviceMapProps {
  height?: string;
  onSelectDevice?: (deviceId: number) => void;
}

export const DeviceMap: React.FC<DeviceMapProps> = ({ height = '450px', onSelectDevice }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [points, setPoints] = useState<any[]>([]);
  const [unlocatedCount, setUnlocatedCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showUnlocatedModal, setShowUnlocatedModal] = useState(false);
  const [unlocatedDevices, setUnlocatedDevices] = useState<any[]>([]);

  const fetchPoints = async () => {
    setLoading(true);
    try {
      const res = await api.getMapDevices();
      setPoints(res.points || []);
      setUnlocatedCount(res.total_unlocated || 0);
    } catch (e: any) {
      console.error('获取地图数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // 默认视角
    const map = L.map(mapContainerRef.current, {
      minZoom: 3,
      maxZoom: 18
    }).setView([35.0, 105.0], 5);

    // 默认选用高德高清中文路网瓦片 (超清街道与县区)
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      minZoom: 3,
      attribution: '© 高德地图 (AutoNavi)',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 当点位数据更新时，渲染 Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    if (points.length === 0) return;

    const bounds = L.latLngBounds([]);

    points.forEach((p) => {
      if (p.latitude === null || p.longitude === null) return;

      bounds.extend([p.latitude, p.longitude]);

      let pinColor = '#10b981'; // ONLINE
      let statusText = '🟢 在线';
      if (p.status === 'OFFLINE') {
        pinColor = '#ef4444';
        statusText = '🔴 离线';
      } else if (p.status === 'UNKNOWN') {
        pinColor = '#f59e0b';
        statusText = '🟡 未知';
      } else if (p.status === 'DISABLED') {
        pinColor = '#64748b';
        statusText = '⚪ 已禁用';
      }

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color:${pinColor}; width:22px; height:22px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px;">•</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([p.latitude, p.longitude], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; min-width: 180px;">
          <div style="font-weight: bold; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            ${p.name}
          </div>
          <div><strong>IP:</strong> ${p.ip_address}</div>
          <div><strong>状态:</strong> ${statusText}</div>
          <div><strong>分组:</strong> ${p.group_name || '未分组'}</div>
          <div><strong>方式:</strong> ${p.method.toUpperCase()}</div>
          ${p.location_address ? `<div><strong>位置:</strong> ${p.location_address}</div>` : ''}
          ${p.location_note ? `<div><strong>机房/备注:</strong> ${p.location_note}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersLayerRef.current?.addLayer(marker);
    });

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else {
      mapInstanceRef.current.setView([35.0, 105.0], 5);
    }
  }, [points]);

  const openUnlocatedList = async () => {
    try {
      const list = await api.getUnlocatedDevices();
      setUnlocatedDevices(list || []);
      setShowUnlocatedModal(true);
    } catch (e: any) {
      alert(`获取未定位设备列表失败: ${e.message}`);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #1f293d' }}>
      {/* 顶部工具栏 */}
      <div style={{
        position: 'absolute', top: '10px', left: '10px', right: '10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 500, pointerEvents: 'none'
      }}>
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
          border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.35rem 0.75rem',
          fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            在线: {points.filter(p => p.status === 'ONLINE').length}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            离线: {points.filter(p => p.status === 'OFFLINE').length}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            已标注设备: <strong>{points.length}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
          {unlocatedCount > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', color: '#fbbf24', borderColor: '#f59e0b' }}
              onClick={openUnlocatedList}
            >
              <AlertCircle size={14} />
              <span>未定位设备 ({unlocatedCount})</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            style={{ backgroundColor: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)' }}
            onClick={fetchPoints}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>刷新点位</span>
          </button>
        </div>
      </div>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* 未定位设备抽屉/模态框 */}
      {showUnlocatedModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #1f293d' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>未定位设备列表 ({unlocatedDevices.length})</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowUnlocatedModal(false)}>关闭</button>
            </div>
            <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                以下设备尚未设置地理位置坐标。您可以前往“设备管理”点击编辑，通过地址检索或地图选点为其补全物理位置。
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>设备名称</th>
                    <th>IP地址</th>
                    <th>状态</th>
                    <th>分组</th>
                  </tr>
                </thead>
                <tbody>
                  {unlocatedDevices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td>{d.ip_address}</td>
                      <td>
                        <span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span>
                      </td>
                      <td>{d.group_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
