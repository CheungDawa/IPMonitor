import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, MapPin, X, Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface LocationPickerProps {
  initialLat?: number | null;
  initialLon?: number | null;
  initialAddress?: string | null;
  initialMethod?: string;
  onConfirm: (locationData: {
    latitude: number | null;
    longitude: number | null;
    location_address: string | null;
    formatted_address: string | null;
    location_method: string;
  }) => void;
  onCancel: () => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLat,
  initialLon,
  initialAddress,
  initialMethod,
  onConfirm,
  onCancel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lon, setLon] = useState<number | null>(initialLon ?? null);
  const [address, setAddress] = useState<string>(initialAddress ?? '');
  const [formattedAddress, setFormattedAddress] = useState<string>('');
  const [method, setMethod] = useState<string>(initialMethod ?? (initialLat ? 'manual_pin' : 'none'));

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);

  // 自定义 Pin 图标
  const pinIcon = L.divIcon({
    className: 'custom-map-pin pin-online',
    html: '<div style="background-color:#2563eb; width:28px; height:28px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.5);">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // 默认定位坐标 (若有初始坐标用初始坐标，否则默认宏观中心)
    const centerLat = initialLat ?? 35.0;
    const centerLon = initialLon ?? 105.0;
    const initialZoom = initialLat ? 15 : 5;

    const map = L.map(mapContainerRef.current, {
      minZoom: 3,
      maxZoom: 18
    }).setView([centerLat, centerLon], initialZoom);

    // 采用高德高清中文矢量瓦片 (超清显示街道、大厦、园区与县区)
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      minZoom: 3,
      attribution: '© 高德地图 (AutoNavi)',
    }).addTo(map);

    mapInstanceRef.current = map;

    // 若有初始坐标，放置可拖拽 Marker
    if (initialLat !== null && initialLat !== undefined && initialLon !== null && initialLon !== undefined) {
      const marker = L.marker([initialLat, initialLon], { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        setLat(Number(pos.lat.toFixed(6)));
        setLon(Number(pos.lng.toFixed(6)));
        setMethod('manual_pin');
        try {
          const rev = await api.reverseGeocode(pos.lat, pos.lng);
          if (rev?.formatted_address) {
            setFormattedAddress(rev.formatted_address);
          }
        } catch {}
      });
      markerRef.current = marker;
    }

    // 单击地图放置/微调 Marker (manual_pin)
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));

      setLat(clickLat);
      setLon(clickLng);
      setMethod('manual_pin');

      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        const marker = L.marker(e.latlng, { icon: pinIcon, draggable: true }).addTo(map);
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          setLat(Number(pos.lat.toFixed(6)));
          setLon(Number(pos.lng.toFixed(6)));
          setMethod('manual_pin');
          try {
            const rev = await api.reverseGeocode(pos.lat, pos.lng);
            if (rev?.formatted_address) {
              setFormattedAddress(rev.formatted_address);
            }
          } catch {}
        });
        markerRef.current = marker;
      }

      // 反查地址
      try {
        const rev = await api.reverseGeocode(clickLat, clickLng);
        if (rev?.formatted_address) {
          setFormattedAddress(rev.formatted_address);
        }
      } catch {}
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 执行地址搜索
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.geocodeAddress(searchQuery.trim());
      setCandidates(res || []);
    } catch (e: any) {
      alert(`搜索失败: ${e.message}`);
    } finally {
      setSearching(false);
    }
  };

  // 选中候选地址
  const selectCandidate = (item: any) => {
    setLat(item.latitude);
    setLon(item.longitude);
    setAddress(item.name || searchQuery);
    setFormattedAddress(item.formatted_address);
    setMethod('address_search');
    setCandidates([]);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.latitude, item.longitude], 15);

      if (markerRef.current) {
        markerRef.current.setLatLng([item.latitude, item.longitude]);
      } else {
        const marker = L.marker([item.latitude, item.longitude], { icon: pinIcon, draggable: true }).addTo(mapInstanceRef.current);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setLat(Number(pos.lat.toFixed(6)));
          setLon(Number(pos.lng.toFixed(6)));
          setMethod('manual_pin');
        });
        markerRef.current = marker;
      }
    }
  };

  // 清空位置
  const handleClearLocation = () => {
    setLat(null);
    setLon(null);
    setAddress('');
    setFormattedAddress('');
    setMethod('none');
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  const handleSave = () => {
    onConfirm({
      latitude: lat,
      longitude: lon,
      location_address: address || null,
      formatted_address: formattedAddress || null,
      location_method: method,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '850px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1f293d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} className="text-blue-500" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>设备位置设定 (双模式定位)</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}><X size={16} /></button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* 模式 A: 地址检索栏 */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', position: 'relative' }}>
            <input
              type="text"
              className="input"
              placeholder="输入实际地址检索定位 (如：某某科技园区、机房大厦、服务器节点...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>搜索</span>
            </button>
            {lat !== null && (
              <button className="btn btn-secondary btn-sm" onClick={handleClearLocation} style={{ color: '#f87171' }}>
                清空选点
              </button>
            )}

            {/* 搜索候选列表下拉 */}
            {candidates.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: '110px',
                backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem',
                zIndex: 1100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px rgba(0,0,0,0.5)', marginTop: '4px'
              }}>
                {candidates.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectCandidate(c)}
                    style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #334155', cursor: 'pointer', fontSize: '0.825rem' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontWeight: 600, color: '#60a5fa' }}>{c.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>{c.formatted_address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>💡 提示：您可直接在地图上单击放置标记，或按住标记拖动进行米级微调。</span>
            <span>坐标系规范: <strong style={{ color: '#60a5fa' }}>WGS-84</strong></span>
          </div>

          {/* 地图交互容器 */}
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '360px', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #334155' }}
          />

          {/* 当前选点回显 */}
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #1e293b', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>纬度: <strong style={{ color: '#38bdf8' }}>{lat ?? '未设置'}</strong></div>
              <div>经度: <strong style={{ color: '#38bdf8' }}>{lon ?? '未设置'}</strong></div>
              <div>来源: <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>{method}</span></div>
            </div>
            {formattedAddress && (
              <div style={{ color: '#94a3b8', fontSize: '0.775rem' }}>
                解析地址: {formattedAddress}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.25rem', borderTop: '1px solid #1f293d' }}>
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} />
            <span>确认使用该位置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
