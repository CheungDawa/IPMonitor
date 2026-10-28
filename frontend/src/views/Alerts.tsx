import React, { useEffect, useState } from 'react';
import { Bell, Send, CheckCircle2, ShieldCheck, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export const Alerts: React.FC = () => {
  const [tab, setTab] = useState<'records' | 'channels'>('records');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  // 通道配置状态
  const [webhookCfg, setWebhookCfg] = useState<any>({
    webhook_enabled: false,
    webhook_type: 'wecom',
    webhook_url: ''
  });
  const [emailCfg, setEmailCfg] = useState<any>({
    email_enabled: false,
    smtp_server: 'smtp.qq.com',
    smtp_port: 465,
    use_ssl: true,
    sender_email: '',
    password: '',
    recipient_email: '',
    cc_email: '',
    quiet_hours_enabled: false,
    quiet_start_hour: 22,
    quiet_end_hour: 8
  });
  const [testingMsg, setTestingMsg] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.listAlerts({ status: statusFilter });
      setAlerts(res.items || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationConfig = async () => {
    try {
      const res = await api.getNotificationConfig();
      if (res?.alert) setWebhookCfg(res.alert);
      if (res?.email) setEmailCfg({ ...res.email, email_enabled: res.email.enabled });
    } catch (e) {}
  };

  useEffect(() => {
    if (tab === 'records') fetchAlerts();
    else fetchNotificationConfig();
  }, [tab, statusFilter]);

  const handleResolve = async (id: number) => {
    try {
      await api.resolveAlert(id);
      fetchAlerts();
    } catch (e: any) {
      alert(`处理失败: ${e.message}`);
    }
  };

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateNotificationConfig({
        ...webhookCfg,
        ...emailCfg
      });
      alert('通知渠道配置已同步保存！');
    } catch (e: any) {
      alert(`保存失败: ${e.message}`);
    }
  };

  const handleTestChannel = async (channel: 'webhook' | 'email') => {
    setTestingMsg(`正在发送 ${channel === 'webhook' ? 'Webhook' : 'SMTP 邮件'} 测试消息...`);
    try {
      const res = await api.testNotification({
        channel,
        webhook_type: webhookCfg.webhook_type,
        webhook_url: webhookCfg.webhook_url,
        smtp_server: emailCfg.smtp_server,
        smtp_port: emailCfg.smtp_port,
        use_ssl: emailCfg.use_ssl,
        sender_email: emailCfg.sender_email,
        password: emailCfg.password,
        recipient_email: emailCfg.recipient_email
      });
      setTestingMsg(res.message || '测试消息发送成功！');
      setTimeout(() => setTestingMsg(null), 5000);
    } catch (e: any) {
      setTestingMsg(`测试发送失败: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={22} className="text-pink-500" />
            <span>告警中心与通知渠道</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
            故障事件闭环管理、微批次风暴抑制与多渠道通知（企微/钉钉/飞书/邮件）
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${tab === 'records' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('records')}
          >
            告警事件流水
          </button>
          <button
            className={`btn btn-sm ${tab === 'channels' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('channels')}
          >
            通知渠道与机器人设置
          </button>
        </div>
      </div>

      {testingMsg && (
        <div style={{
          padding: '0.65rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: '#1e293b',
          border: '1px solid #3b82f6',
          color: '#60a5fa',
          fontSize: '0.85rem'
        }}>
          {testingMsg}
        </div>
      )}

      {tab === 'records' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${statusFilter === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('active')}
              >
                未结活动告警
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'resolved' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('resolved')}
              >
                已处理历史告警
              </button>
              <button
                className={`btn btn-sm ${statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('')}
              >
                全部记录
              </button>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={fetchAlerts} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>告警ID</th>
                <th>设备名称</th>
                <th>IP 地址</th>
                <th>告警类型</th>
                <th>告警标题与内容</th>
                <th>触发时间</th>
                <th>已发渠道</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    {loading ? '正在加载告警记录...' : '当前分类下没有告警记录'}
                  </td>
                </tr>
              ) : (
                alerts.map((al) => (
                  <tr key={al.id}>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>#{al.id}</td>
                    <td style={{ fontWeight: 600 }}>{al.device_name}</td>
                    <td><code style={{ color: '#38bdf8', fontSize: '0.8rem' }}>{al.ip_address}</code></td>
                    <td>
                      <span className={`badge ${al.alert_type === 'offline' ? 'badge-offline' : 'badge-online'}`}>
                        {al.alert_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>{al.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'pre-line', marginTop: '2px' }}>
                        {al.content}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {formatDateTime(al.triggered_at)}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#818cf8' }}>
                      {al.channels_sent || '-'}
                    </td>
                    <td>
                      <span className={`badge ${al.status === 'active' ? 'badge-offline' : 'badge-online'}`}>
                        {al.status === 'active' ? '活动中' : '已恢复'}
                      </span>
                    </td>
                    <td>
                      {al.status === 'active' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#34d399' }}
                          onClick={() => handleResolve(al.id)}
                        >
                          标记解决
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* 通道配置表单 */
        <form onSubmit={handleSaveChannels} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 1. 群机器人 Webhook */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <MessageSquare size={18} className="text-blue-500" />
                <span>群机器人 Webhook 推送 (企业微信 / 钉钉 / 飞书)</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={webhookCfg.webhook_enabled}
                  onChange={(e) => setWebhookCfg({ ...webhookCfg, webhook_enabled: e.target.checked })}
                />
                <span>启用 Webhook</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>机器人平台</label>
                <select
                  className="select"
                  value={webhookCfg.webhook_type}
                  onChange={(e) => setWebhookCfg({ ...webhookCfg, webhook_type: e.target.value })}
                >
                  <option value="wecom">企业微信群机器人</option>
                  <option value="dingtalk">钉钉自定义机器人</option>
                  <option value="feishu">飞书自定义机器人</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Webhook 完整接口地址</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  value={webhookCfg.webhook_url}
                  onChange={(e) => setWebhookCfg({ ...webhookCfg, webhook_url: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleTestChannel('webhook')}
              >
                <Send size={14} />
                <span>发送 Webhook 测试消息</span>
              </button>
            </div>
          </div>

          {/* 2. SMTP 邮件告警 */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Mail size={18} className="text-emerald-500" />
                <span>SMTP 邮件告警通道</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={emailCfg.email_enabled}
                  onChange={(e) => setEmailCfg({ ...emailCfg, email_enabled: e.target.checked })}
                />
                <span>启用邮件通知</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>SMTP 服务器地址</label>
                <input
                  type="text"
                  className="input"
                  placeholder="如: smtp.qq.com"
                  value={emailCfg.smtp_server}
                  onChange={(e) => setEmailCfg({ ...emailCfg, smtp_server: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>端口号</label>
                <input
                  type="number"
                  className="input"
                  value={emailCfg.smtp_port}
                  onChange={(e) => setEmailCfg({ ...emailCfg, smtp_port: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>加密方式</label>
                <select
                  className="select"
                  value={emailCfg.use_ssl ? 'ssl' : 'plain'}
                  onChange={(e) => setEmailCfg({ ...emailCfg, use_ssl: e.target.value === 'ssl' })}
                >
                  <option value="ssl">SSL / TLS (推荐465端口)</option>
                  <option value="plain">STARTTLS / 明文 (25或587端口)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>发件人邮箱</label>
                <input
                  type="email"
                  className="input"
                  placeholder="sender@example.com"
                  value={emailCfg.sender_email}
                  onChange={(e) => setEmailCfg({ ...emailCfg, sender_email: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>SMTP 授权码/密码</label>
                <input
                  type="password"
                  className="input"
                  placeholder="留空表示不修改已有密码"
                  value={emailCfg.password}
                  onChange={(e) => setEmailCfg({ ...emailCfg, password: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>收件人邮箱</label>
                <input
                  type="email"
                  className="input"
                  placeholder="admin@example.com"
                  value={emailCfg.recipient_email}
                  onChange={(e) => setEmailCfg({ ...emailCfg, recipient_email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleTestChannel('email')}
              >
                <Send size={14} />
                <span>发送测试邮件</span>
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            保存全部通知渠道设置
          </button>
        </form>
      )}
    </div>
  );
};
