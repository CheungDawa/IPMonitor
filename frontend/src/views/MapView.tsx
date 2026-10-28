import React from 'react';
import { DeviceMap } from '../components/DeviceMap';
import { MapPin } from 'lucide-react';

export const MapView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={22} className="text-blue-500" />
            <span>网络设备部署全景地图</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            基于 WGS-84 地理坐标系展示全网设备物理部署拓扑与实时运行状态
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: '500px' }}>
        <DeviceMap height="100%" />
      </div>
    </div>
  );
};
