import React, { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  Radio,
  MapPin,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { LocationPicker } from '../components/LocationPicker';

export const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  // 筛选状态
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  // 模态框状态
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState<any>({
    name: '',
    ip_address: '',
    device_type: 'server',
    group_id: null,
    method: 'ping',
    port: '',
    timeout_seconds: 3,
    interval_seconds: 60,
    retry_count: 3,
    enabled: true,
    note: '',
    latitude: null,
    longitude: null,
    location_address: '',
    formatted_address: '',
    location_method: 'none',
    location_note: ''
  });

  // Excel 导入模态框状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [prechecking, setPrechecking] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<string>('upsert');
  const [importing, setImporting] = useState(false);

  // 即时探测反馈提示
  const [probeNotice, setProbeNotice] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await api.listDevices({
        page,
        page_size: pageSize,
        search,
        status: statusFilter,
        group_id: groupFilter
      });
      setDevices(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      alert(`获取设备列表失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await api.listGroups();
      setGroups(res || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchDevices();
  }, [page, statusFilter, groupFilter]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      ip_address: '',
      device_type: 'server',
      group_id: groups[0]?.id || null,
      method: 'ping',
      port: '',
      timeout_seconds: 3,
      interval_seconds: 60,
      retry_count: 3,
      enabled: true,
      note: '',
      latitude: null,
      longitude: null,
      location_address: '',
      formatted_address: '',
      location_method: 'none',
      location_note: ''
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (dev: any) => {
    setEditingDevice(dev);
    setFormData({
      name: dev.name,
      ip_address: dev.ip_address,
      device_type: dev.device_type,
      group_id: dev.group_id,
      method: dev.method,
      port: dev.port || '',
      timeout_seconds: dev.timeout_seconds,
      interval_seconds: dev.interval_seconds,
      retry_count: dev.retry_count,
      enabled: dev.enabled,
      note: dev.note || '',
      latitude: dev.latitude,
      longitude: dev.longitude,
      location_address: dev.location_address || '',
      formatted_address: dev.formatted_address || '',
      location_method: dev.location_method || 'none',
      location_note: dev.location_note || ''
    });
    setShowAddEditModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        group_id: formData.group_id ? Number(formData.group_id) : null,
        port: formData.port ? Number(formData.port) : null,
        timeout_seconds: Number(formData.timeout_seconds),
        interval_seconds: Number(formData.interval_seconds),
        retry_count: Number(formData.retry_count)
      };

      if (editingDevice) {
        await api.updateDevice(editingDevice.id, payload);
      } else {
        await api.createDevice(payload);
      }
      setShowAddEditModal(false);
      fetchDevices();
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除设备 "${name}" 吗？此操作不可逆。`)) return;
    try {
      await api.deleteDevice(id);
      fetchDevices();
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const handleProbeNow = async (id: number, name: string) => {
    try {
      setProbeNotice(`正在对 [${name}] 发起即时网络探测...`);
      const res = await api.probeDevice(id);
      const isOk = res.success;
      setProbeNotice(
        `[${name}] 探测完成：${isOk ? `🟢 探测成功 (延迟 ${res.latency_ms}ms)` : `🔴 探测失败 (${res.error_message})`}`
      );
      fetchDevices();
      setTimeout(() => setProbeNotice(null), 5000);
    } catch (err: any) {
      setProbeNotice(`探测请求异常: ${err.message}`);
    }
  };

  // Excel 上传预检
  const handlePrecheck = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setPrechecking(true);
    setPrecheckResult(null);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.precheckExcel(fd);
      setPrecheckResult(res);
    } catch (err: any) {
      alert(`预检失败: ${err.message}`);
    } finally {
      setPrechecking(false);
    }
  };

  // 执行 Excel 导入
  const handleExecuteImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('import_mode', importMode);
    try {
      const res = await api.importExcel(fd);
      alert(res.message || '导入成功！');
      setShowImportModal(false);
      setImportFile(null);
      setPrecheckResult(null);
      fetchDevices();
    } catch (err: any) {
      alert(`导入异常: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 顶部标题与操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>设备台账管理</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            管理内网受控设备基本属性、探针策略与地理位置选点
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open('/api/v1/excel/template')}>
            <Download size={14} />
            <span>下载Excel模板</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open('/api/v1/excel/export')}>
            <FileSpreadsheet size={14} />
            <span>导出台账</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(true)}>
            <Upload size={14} />
            <span>导入台账</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
            <Plus size={14} />
            <span>新增设备</span>
          </button>
        </div>
      </div>

      {/* 实时探测通知横幅 */}
      {probeNotice && (
        <div style={{
          padding: '0.65rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: '#1e293b',
          border: '1px solid #3b82f6',
          color: '#60a5fa',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Radio size={16} className="animate-pulse" />
          <span>{probeNotice}</span>
        </div>
      )}

      {/* 筛选与搜索工具条 */}
      <div className="card" style={{ padding: '0.85rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '2rem' }}
              placeholder="搜索名称 / IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="select"
            style={{ width: '130px' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部状态</option>
            <option value="ONLINE">🟢 在线</option>
            <option value="OFFLINE">🔴 离线</option>
            <option value="UNKNOWN">🟡 未知</option>
            <option value="DISABLED">⚪ 已停用</option>
          </select>

          <select
            className="select"
            style={{ width: '140px' }}
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部分组</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-primary btn-sm">筛选</button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setStatusFilter(''); setGroupFilter(''); setPage(1); fetchDevices(); }}
          >
            重置
          </button>
        </form>
      </div>

      {/* 设备列表数据表格 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>设备名称</th>
              <th>IP 地址</th>
              <th>状态</th>
              <th>所属分组</th>
              <th>探测方式</th>
              <th>地理位置</th>
              <th>最近探测</th>
              <th style={{ textAlign: 'center', width: '150px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? '正在加载设备数据...' : '没有找到匹配的设备记录'}
                </td>
              </tr>
            ) : (
              devices.map((d) => {
                let badgeClass = 'badge-online';
                if (d.status === 'OFFLINE') badgeClass = 'badge-offline';
                else if (d.status === 'UNKNOWN') badgeClass = 'badge-unknown';
                else if (d.status === 'DISABLED') badgeClass = 'badge-disabled';

                const isLocated = d.location_status === 'located';

                return (
                  <tr key={d.id}>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>#{d.id}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{d.name}</div>
                      {d.note && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{d.note}</div>}
                    </td>
                    <td>
                      <code style={{ color: '#38bdf8', fontSize: '0.825rem' }}>{d.ip_address}</code>
                      {d.method === 'tcp' && d.port && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>:{d.port}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{d.status}</span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        backgroundColor: `${d.group_color || '#3b82f6'}22`,
                        color: d.group_color || '#3b82f6'
                      }}>
                        {d.group_name || '未分组'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {d.method.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {isLocated ? (
                        <span style={{ color: '#34d399', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <MapPin size={12} />
                          <span>已定位</span>
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.775rem' }}>未定位</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {d.last_probe_time ? new Date(d.last_probe_time).toLocaleTimeString() : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="立即发起探测"
                          onClick={() => handleProbeNow(d.id, d.name)}
                        >
                          <Play size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="编辑设备"
                          onClick={() => handleOpenEdit(d)}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="删除设备"
                          style={{ color: '#f87171' }}
                          onClick={() => handleDeleteDevice(d.id, d.name)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 分页控制 */}
        {total > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>共 {total} 台设备记录</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </button>
              <span style={{ fontSize: '0.8rem', alignSelf: 'center', color: '#94a3b8' }}>
                第 {page} / {Math.ceil(total / pageSize)} 页
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 新增/编辑设备模态弹窗 */}
      {showAddEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1f293d' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {editingDevice ? `编辑设备: ${editingDevice.name}` : '新增监控设备'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddEditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveDevice} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>设备名称*</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>IP 地址*</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="如: 192.168.1.1"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>设备分类</label>
                  <select
                    className="select"
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                  >
                    <option value="server">服务器 (Server)</option>
                    <option value="router">路由器 (Router)</option>
                    <option value="switch">交换机 (Switch)</option>
                    <option value="nas">存储 NAS</option>
                    <option value="camera">网络摄像头</option>
                    <option value="printer">打印机</option>
                    <option value="workstation">工作站/工控机</option>
                    <option value="other">其他设备</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>所属分组</label>
                  <select
                    className="select"
                    value={formData.group_id ?? ''}
                    onChange={(e) => setFormData({ ...formData, group_id: e.target.value || null })}
                  >
                    <option value="">未指定</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>探测协议*</label>
                  <select
                    className="select"
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  >
                    <option value="ping">ICMP Ping</option>
                    <option value="tcp">TCP 端口检测</option>
                    <option value="arp">ARP 邻居探针</option>
                  </select>
                </div>
              </div>

              {formData.method === 'tcp' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>目标端口 (1-65535)*</label>
                  <input
                    type="number"
                    required
                    className="input"
                    placeholder="如: 80, 443, 445, 8080"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  />
                </div>
              )}

              {/* 地理位置选点区域 */}
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                    <MapPin size={16} />
                    <span>地理位置设定</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowLocationPicker(true)}
                  >
                    {formData.latitude ? '修改位置/拖拽微调' : '在地图上选点定位'}
                  </button>
                </div>

                {formData.latitude !== null && formData.longitude !== null ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span>纬度: <strong>{formData.latitude}</strong></span>
                    <span>经度: <strong>{formData.longitude}</strong></span>
                    <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>{formData.location_method}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: '#f87171', padding: 0 }}
                      onClick={() => setFormData({ ...formData, latitude: null, longitude: null, location_method: 'none' })}
                    >
                      清空
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                    当前尚未设置坐标。点击右侧按钮可通过搜索真实地址或在地图上单击进行选点定位。
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>超时秒数</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.timeout_seconds}
                    onChange={(e) => setFormData({ ...formData, timeout_seconds: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>轮询间隔(秒)</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.interval_seconds}
                    onChange={(e) => setFormData({ ...formData, interval_seconds: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>失败重试阈值</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.retry_count}
                    onChange={(e) => setFormData({ ...formData, retry_count: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>备注信息</label>
                <input
                  type="text"
                  className="input"
                  placeholder="机柜编号、用途说明等"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddEditModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存设备</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 双模式地图选点组件调用 */}
      {showLocationPicker && (
        <LocationPicker
          initialLat={formData.latitude}
          initialLon={formData.longitude}
          initialAddress={formData.location_address}
          initialMethod={formData.location_method}
          onConfirm={(loc) => {
            setFormData({
              ...formData,
              latitude: loc.latitude,
              longitude: loc.longitude,
              location_address: loc.location_address,
              formatted_address: loc.formatted_address,
              location_method: loc.location_method
            });
            setShowLocationPicker(false);
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
      )}

      {/* Excel 导入与预检模态弹窗 */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1f293d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} className="text-blue-500" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Excel 设备台账批量导入</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(false)}>✕</button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handlePrecheck}
                  style={{ fontSize: '0.85rem' }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.open('/api/v1/excel/template')}
                >
                  <Download size={14} />
                  <span>下载标准导入模板</span>
                </button>
              </div>

              {prechecking && (
                <div style={{ color: '#38bdf8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>正在执行深度预检分析 (语法、IP格式、坐标系合法性)...</span>
                </div>
              )}

              {/* 预检报告展示 */}
              {precheckResult && (
                <div style={{
                  padding: '0.85rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#0f172a',
                  border: `1px solid ${precheckResult.error_count > 0 ? '#ef4444' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: precheckResult.error_count > 0 ? '#f87171' : '#34d399' }}>
                      {precheckResult.error_count > 0 ? `预检发现 ${precheckResult.error_count} 处错误` : '预检全部通过！'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      有效数据行数: <strong>{precheckResult.valid_count}</strong>
                    </span>
                  </div>

                  {precheckResult.error_count > 0 && (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.775rem', color: '#f87171' }}>
                      {precheckResult.errors.map((err: any, idx: number) => (
                        <div key={idx} style={{ marginBottom: '2px' }}>
                          • 第 {err.row} 行 [{err.field}]: {err.reason} (填入值: {err.value || '空'})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {precheckResult && precheckResult.error_count === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>导入执行模式:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="upsert"
                        checked={importMode === 'upsert'}
                        onChange={(e) => setImportMode(e.target.value)}
                      />
                      <span>IP 重复时覆盖更新</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="skip_existing"
                        checked={importMode === 'skip_existing'}
                        onChange={(e) => setImportMode(e.target.value)}
                      />
                      <span>IP 重复时跳过</span>
                    </label>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    🛡️ 安全保护提醒：覆盖更新时，若 Excel 中坐标为空，默认不会清空数据库中已有地图坐标。
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
                    onClick={handleExecuteImport}
                    disabled={importing}
                  >
                    {importing ? '正在写入数据库...' : '确认执行批量导入'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
