import React, { useEffect, useState } from 'react';
import { Folder, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export const Groups: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.listGroups();
      setGroups(res || []);
    } catch (e: any) {
      alert(`获取分组失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setName('');
    setDescription('');
    setColor('#3B82F6');
    setShowModal(true);
  };

  const handleOpenEdit = (g: any) => {
    setEditingGroup(g);
    setName(g.name);
    setDescription(g.description || '');
    setColor(g.color || '#3B82F6');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await api.updateGroup(editingGroup.id, { name, description, color });
      } else {
        await api.createGroup({ name, description, color });
      }
      setShowModal(false);
      fetchGroups();
    } catch (e: any) {
      alert(`保存失败: ${e.message}`);
    }
  };

  const handleDelete = async (id: number, gName: string) => {
    if (!window.confirm(`确定要删除分组 "${gName}" 吗？`)) return;
    try {
      await api.deleteGroup(id);
      fetchGroups();
    } catch (e: any) {
      alert(`删除失败: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Folder size={22} className="text-blue-500" />
            <span>设备分组架构</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            对不同子网、物理机房与业务系统的资产进行标签化层级归类
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
          <Plus size={14} />
          <span>新建分组</span>
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th>分组标识</th>
              <th>分组名称</th>
              <th>描述信息</th>
              <th>关联设备数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td style={{ color: '#64748b' }}>#{g.id}</td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: g.color || '#3b82f6',
                    verticalAlign: 'middle'
                  }}></span>
                </td>
                <td style={{ fontWeight: 600 }}>{g.name}</td>
                <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{g.description || '-'}</td>
                <td>
                  <span className="badge badge-online">{g.device_count || 0} 台设备</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(g)}>
                      <Edit2 size={12} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#f87171' }}
                      onClick={() => handleDelete(g.id, g.name)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #1f293d' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                {editingGroup ? '编辑分组' : '新建设备分组'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>分组名称*</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="如: 核心出口机房"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>标识颜色</label>
                <input
                  type="color"
                  className="input"
                  style={{ height: '38px', padding: '0.2rem' }}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>分组描述</label>
                <input
                  type="text"
                  className="input"
                  placeholder="说明该分组的拓扑位置或设备用途"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
