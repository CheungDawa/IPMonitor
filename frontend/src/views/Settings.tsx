import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Database, HardDrive, Shield, KeyRound, Download, RefreshCw, Cpu, Activity, MapPin, Save } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export const Settings: React.FC = () => {
  const [sysStatus, setSysStatus] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // 地图视角设定
  const [mapFocusName, setMapFocusName] = useState('全局宏观');
  const [mapCenterLat, setMapCenterLat] = useState('35.0');
  const [mapCenterLng, setMapCenterLng] = useState('105.0');
  const [mapDefaultZoom, setMapDefaultZoom] = useState('5');
  const [mapMsg, setMapMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchStatusAndBackups = async () => {
    setLoading(true);
    try {
      const [sRes, bRes, setRes] = await Promise.all([
        api.getSystemStatus(),
        api.getBackups(),
        api.getSystemSettings()
      ]);
      setSysStatus(sRes || {});
      setBackups(bRes || []);
      if (setRes) {
        if (setRes.map_focus_name) setMapFocusName(setRes.map_focus_name);
        if (setRes.map_center_lat) setMapCenterLat(String(setRes.map_center_lat));
        if (setRes.map_center_lng) setMapCenterLng(String(setRes.map_center_lng));
        if (setRes.map_default_zoom) setMapDefaultZoom(String(setRes.map_default_zoom));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndBackups();
  }, []);

  const handleSaveMapSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSystemSettings({
        map_focus_name: mapFocusName,
        map_center_lat: parseFloat(mapCenterLat) || 35.0,
        map_center_lng: parseFloat(mapCenterLng) || 105.0,
        map_default_zoom: parseInt(mapDefaultZoom) || 5
      });
      setMapMsg({ type: 'ok', text: '地图默认视角配置已成功保存！驾驶舱大屏将自动以此视角为初始中心。' });
      setTimeout(() => setMapMsg(null), 3000);
    } catch (e: any) {
      setMapMsg({ type: 'err', text: e.message || '保存地图设置失败' });
    }
  };

  const handleBackupNow = async () => {
    setBackupLoading(true);
    try {
      const res = await api.triggerBackup();
      alert(`热备份创建成功！文件: ${res.filename} (${(res.size_bytes / 1024).toFixed(1)} KB)`);
      fetchStatusAndBackups();
    } catch (e: any) {
      alert(`备份失败: ${e.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'err', text: '两次输入的新密码不一致' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'err', text: '新密码长度不能少于 6 位' });
      return;
    }

    try {
      await api.changePassword({ old_password: oldPassword, new_password: newPassword });
      setPwdMsg({ type: 'ok', text: '密码修改成功，请妥善保管新凭据！' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPwdMsg({ type: 'err', text: e.message || '密码修改失败' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SettingsIcon size={22} className="text-blue-500" />
          <span>系统环境与数据安全备份</span>
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
          宿主机运行环境监控、SQLite 在线安全热备份与管理员安全凭据维护
        </p>
      </div>

      {/* 宿主机运行环境概览 */}
      {sysStatus && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            <Cpu size={18} className="text-emerald-500" />
            <span>宿主机运行资源监控</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>操作系统</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {sysStatus.os} ({sysStatus.os_release})
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Python 运行时</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                v{sysStatus.python_version}
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>逻辑 CPU 核心</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {sysStatus.cpu_count} 核心 (占用: {sysStatus.cpu_percent}%)
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>物理内存使用</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {sysStatus.memory_used_mb} MB / {sysStatus.memory_total_mb} MB ({sysStatus.memory_percent}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 数据库安全在线备份 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Database size={18} className="text-blue-500" />
            <span>SQLite 在线热备份 (Online Backup API)</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBackupNow}
            disabled={backupLoading}
          >
            <HardDrive size={14} />
            <span>{backupLoading ? '正在创建热备份...' : '立即创建在线备份'}</span>
          </button>
        </div>

        <div style={{ fontSize: '0.775rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          💡 采用 SQLite 官方 Online Backup API 执行全量一致性热备份，备份期间不锁死数据库，业务探针与 Web 查询正常运行。
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>备份文件名</th>
              <th>文件大小</th>
              <th>生成时间</th>
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  暂无备份记录，点击上方按钮可随时创建快照
                </td>
              </tr>
            ) : (
              backups.map((b, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>{b.filename}</td>
                  <td>{(b.size_bytes / 1024).toFixed(1)} KB</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{formatDateTime(b.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 空间地图默认视角配置 (自主定制大屏初聚焦区域，保护隐私不外泄) */}
      <div className="card" style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          <MapPin size={18} className="text-blue-500" />
          <span>GIS 空间地图默认视角设定</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
          自主设定监控驾驶舱大屏在无设备选中时的默认聚焦区域、中心坐标与初始缩放比例（配置保存在您本地数据库中，不会上传到互联网公开代码库）。
        </p>

        {mapMsg && (
          <div style={{
            padding: '0.65rem',
            marginBottom: '1rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            backgroundColor: mapMsg.type === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: mapMsg.type === 'ok' ? '#34d399' : '#f87171',
            border: `1px solid ${mapMsg.type === 'ok' ? '#059669' : '#dc2626'}`
          }}>
            {mapMsg.text}
          </div>
        )}

        <form onSubmit={handleSaveMapSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                视角名称标识 (如: 园区总览 / 本地全境)
              </label>
              <input
                type="text"
                required
                className="input"
                value={mapFocusName}
                onChange={(e) => setMapFocusName(e.target.value)}
                placeholder="例如：本地数据中心"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                默认缩放级别 (3~18，数字越大越精细)
              </label>
              <input
                type="number"
                min="3"
                max="18"
                required
                className="input"
                value={mapDefaultZoom}
                onChange={(e) => setMapDefaultZoom(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                中心纬度 (Latitude，-90 ~ 90)
              </label>
              <input
                type="text"
                required
                className="input"
                value={mapCenterLat}
                onChange={(e) => setMapCenterLat(e.target.value)}
                placeholder="例如：28.60"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                中心经度 (Longitude，-180 ~ 180)
              </label>
              <input
                type="text"
                required
                className="input"
                value={mapCenterLng}
                onChange={(e) => setMapCenterLng(e.target.value)}
                placeholder="例如：104.75"
              />
            </div>
          </div>

          {/* 常用模板预设 */}
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.5rem' }}>快速填入预设模版：</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', marginRight: '0.4rem' }}
              onClick={() => { setMapFocusName('全国视野'); setMapCenterLat('35.0'); setMapCenterLng('105.0'); setMapDefaultZoom('5'); }}
            >
              全国宏观
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', marginRight: '0.4rem' }}
              onClick={() => { setMapFocusName('西南大区'); setMapCenterLat('30.0'); setMapCenterLng('104.5'); setMapDefaultZoom('7'); }}
            >
              西南大区
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
              onClick={() => { setMapFocusName('本地市域全境'); setMapCenterLat('28.60'); setMapCenterLng('104.75'); setMapDefaultZoom('9'); }}
            >
              川南市域
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.3rem' }}>
            <Save size={14} />
            <span>保存地图视角设定</span>
          </button>
        </form>
      </div>

      {/* 管理员安全凭据维护 */}
      <div className="card" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          <KeyRound size={18} className="text-yellow-500" />
          <span>修改管理员密码</span>
        </div>

        {pwdMsg && (
          <div style={{
            padding: '0.65rem',
            marginBottom: '1rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            backgroundColor: pwdMsg.type === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: pwdMsg.type === 'ok' ? '#34d399' : '#f87171',
            border: `1px solid ${pwdMsg.type === 'ok' ? '#059669' : '#dc2626'}`
          }}>
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>当前旧密码</label>
            <input
              type="password"
              required
              className="input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>设置新密码</label>
            <input
              type="password"
              required
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>再次确认新密码</label>
            <input
              type="password"
              required
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            更新管理员登录密码
          </button>
        </form>
      </div>
    </div>
  );
};
