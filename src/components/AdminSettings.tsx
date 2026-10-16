import React, { useEffect, useState } from 'react';
import {
  X,
  Server,
  Users,
  History,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Key,
  Lock,
  RefreshCw,
  Radio,
  ShieldCheck,
  UserPlus,
  Edit2,
  Power,
  Sliders,
} from 'lucide-react';
import { ConnectionConfig, UserProfile, AuditEntry, CustomHeaderConfig } from '../types.ts';

interface AdminSettingsProps {
  currentUserId: string;
  onClose: () => void;
  onConfigUpdated: () => void;
  defaultTab?: 'connection' | 'users' | 'audit';
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  currentUserId,
  onClose,
  onConfigUpdated,
  defaultTab = 'connection',
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'users' | 'audit'>(defaultTab);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [connection, setConnection] = useState<ConnectionConfig>({
    endpoint: '',
    method: 'POST',
    authMode: 'bearer',
    authHeaderName: 'Authorization',
    hasGlobalSecret: false,
    contentType: 'application/json',
    qrFieldName: 'qr_payload',
    qrNestingPath: '',
    externalUserIdField: 'employee_id',
    staticFieldsJson: '',
    successRule: {
      type: 'status_code',
      minStatus: 200,
      maxStatus: 299,
    },
    customHeaders: [],
  });

  const [newGlobalSecret, setNewGlobalSecret] = useState('');
  const [removeGlobalSecret, setRemoveGlobalSecret] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    externalUserId: '',
  });

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userSecretInput, setUserSecretInput] = useState('');
  const [userHeaderOverrideInput, setUserHeaderOverrideInput] = useState('');
  const [userExternalIdInput, setUserExternalIdInput] = useState('');
  const [isSavingUserCreds, setIsSavingUserCreds] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const [connRes, usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/connection'),
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-logs'),
      ]);

      if (connRes.ok) setConnection(await connRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to load administration settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const payload: any = {
      endpoint: connection.endpoint,
      method: connection.method,
      authMode: connection.authMode,
      authHeaderName: connection.authHeaderName,
      contentType: connection.contentType,
      qrFieldName: connection.qrFieldName,
      qrNestingPath: connection.qrNestingPath,
      externalUserIdField: connection.externalUserIdField,
      staticFieldsJson: connection.staticFieldsJson,
      successRule: connection.successRule,
      customHeaders: connection.customHeaders,
    };

    if (newGlobalSecret) {
      payload.globalSecret = newGlobalSecret;
    } else if (removeGlobalSecret) {
      payload.globalSecret = null;
    }

    try {
      const res = await fetch('/api/admin/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');

      setStatusMessage({ type: 'success', text: 'Connection configuration saved successfully.' });
      setNewGlobalSecret('');
      setRemoveGlobalSecret(false);
      onConfigUpdated();
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: message });
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: connection.endpoint }),
      });
      const data = await res.json();

      setTestResult({
        success: data.success,
        message: data.message || data.error || 'Completed test probe.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: `Connectivity probe error: ${message}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleAddHeader = () => {
    setConnection(prev => ({
      ...prev,
      customHeaders: [...prev.customHeaders, { key: '', value: '', isSecret: false }],
    }));
  };

  const handleUpdateHeader = (index: number, field: keyof CustomHeaderConfig, val: any) => {
    setConnection(prev => {
      const updated = [...prev.customHeaders];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, customHeaders: updated };
    });
  };

  const handleRemoveHeader = (index: number) => {
    setConnection(prev => {
      const updated = prev.customHeaders.filter((_, i) => i !== index);
      return { ...prev, customHeaders: updated };
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setShowAddUserModal(false);
      setNewUserData({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'user',
        externalUserId: '',
      });
      setStatusMessage({ type: 'success', text: `User ${data.user.username} created successfully.` });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: message });
    }
  };

  const handleToggleUserStatus = async (u: UserProfile) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: message });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: message });
    }
  };

  const handleSaveUserCredentials = async () => {
    if (!editingUser) return;
    setIsSavingUserCreds(true);
    try {
      if (userExternalIdInput !== editingUser.externalUserId || resetPasswordInput) {
        await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalUserId: userExternalIdInput,
            ...(resetPasswordInput ? { newPassword: resetPasswordInput } : {}),
          }),
        });
      }

      if (userSecretInput) {
        await fetch(`/api/admin/users/${editingUser.id}/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: userSecretInput,
            headerOverride: userHeaderOverrideInput || undefined,
          }),
        });
      }

      setEditingUser(null);
      setUserSecretInput('');
      setUserHeaderOverrideInput('');
      setResetPasswordInput('');
      setStatusMessage({ type: 'success', text: `Credentials for ${editingUser.name} updated.` });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setIsSavingUserCreds(false);
    }
  };

  const handleClearUserCredentials = async (userId: string) => {
    if (!confirm('Remove this employee’s assigned API key?')) return;
    try {
      await fetch(`/api/admin/users/${userId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      loadData();
      if (editingUser?.id === userId) {
        setEditingUser(null);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full sm:max-w-2xl h-[100dvh] sm:h-[90dvh] flex flex-col rounded-none sm:rounded-[36px] bg-[#1a1a1d] border border-neutral-700/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-md">
              <Sliders className="w-5 h-5 text-neutral-950" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Administration Area</h2>
              <p className="text-xs text-neutral-400">
                Eman Bakeries &bull; Endpoints, Credentials &amp; Logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex border-b border-neutral-800 px-6 py-2.5 bg-black/40 shrink-0 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex items-center gap-2 py-2 px-4 rounded-full transition cursor-pointer ${
              activeTab === 'connection'
                ? 'bg-white text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connection</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-2 px-4 rounded-full transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Employees ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-2 px-4 rounded-full transition cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-b border-emerald-800/50'
                : 'bg-red-950/60 text-red-300 border-b border-red-800/50'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-neutral-400 hover:text-white text-sm">
              &times;
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center space-y-2 text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#c7aa86]" />
              <span>Loading admin settings...</span>
            </div>
          ) : activeTab === 'connection' ? (
            <form onSubmit={handleSaveConnection} className="space-y-6">
              {/* Endpoint URL & Method */}
              <div className="space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#c7aa86]" />
                  External Endpoint
                </h3>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={connection.method}
                    onChange={e =>
                      setConnection(p => ({ ...p, method: e.target.value as any }))
                    }
                    className="w-24 p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-xs font-semibold text-white focus:border-neutral-600"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>

                  <input
                    type="url"
                    placeholder="https://api.emanbakeries.com/invoices"
                    value={connection.endpoint}
                    onChange={e => setConnection(p => ({ ...p, endpoint: e.target.value }))}
                    className="flex-1 p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white font-mono text-xs focus:border-neutral-600"
                  />

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !connection.endpoint}
                    className="py-3 px-4 rounded-2xl bg-[#222225] border border-neutral-700 hover:bg-[#2b2b2f] text-white font-semibold transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 active:scale-98"
                  >
                    {isTestingConnection ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#c7aa86]" />
                    ) : (
                      <Radio className="w-4 h-4 text-[#c7aa86]" />
                    )}
                    <span>Test Probe</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs border ${
                      testResult.success
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                        : 'bg-red-950/40 text-red-300 border-red-800/60'
                    }`}
                  >
                    <strong>Probe Result:</strong> {testResult.message}
                  </div>
                )}
                <p className="text-[11px] text-neutral-400">
                  Protected transport. SSRF policies strictly forbid routing to internal subnets or cloud metadata APIs.
                </p>
              </div>

              {/* Authentication Mode */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#c7aa86]" />
                  Authentication Strategy
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      connection.authMode === 'bearer'
                        ? 'border-[#c7aa86] bg-[#c7aa86]/10 text-white'
                        : 'border-neutral-800 bg-black/40 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Bearer Token</span>
                      <input
                        type="radio"
                        name="authMode"
                        checked={connection.authMode === 'bearer'}
                        onChange={() => setConnection(p => ({ ...p, authMode: 'bearer' }))}
                      />
                    </div>
                    <span className="text-[11px] block mt-1">Authorization: Bearer &lt;key&gt;</span>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      connection.authMode === 'header'
                        ? 'border-[#c7aa86] bg-[#c7aa86]/10 text-white'
                        : 'border-neutral-800 bg-black/40 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Custom Header</span>
                      <input
                        type="radio"
                        name="authMode"
                        checked={connection.authMode === 'header'}
                        onChange={() => setConnection(p => ({ ...p, authMode: 'header' }))}
                      />
                    </div>
                    <span className="text-[11px] block mt-1">e.g. X-API-Key: &lt;key&gt;</span>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      connection.authMode === 'none'
                        ? 'border-[#c7aa86] bg-[#c7aa86]/10 text-white'
                        : 'border-neutral-800 bg-black/40 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">None</span>
                      <input
                        type="radio"
                        name="authMode"
                        checked={connection.authMode === 'none'}
                        onChange={() => setConnection(p => ({ ...p, authMode: 'none' }))}
                      />
                    </div>
                    <span className="text-[11px] block mt-1">Direct endpoint</span>
                  </label>
                </div>

                {connection.authMode === 'header' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300">
                      Header Name:
                    </label>
                    <input
                      type="text"
                      placeholder="X-API-Key"
                      value={connection.authHeaderName}
                      onChange={e => setConnection(p => ({ ...p, authHeaderName: e.target.value }))}
                      className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-xs text-white"
                    />
                  </div>
                )}

                {/* Optional Global Fallback Secret */}
                <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">
                        Global Fallback API Secret (Optional)
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {connection.hasGlobalSecret
                          ? 'Encrypted at rest (••••••••). Fallback if employee has no per-user key.'
                          : 'No global fallback currently set.'}
                      </span>
                    </div>
                    {connection.hasGlobalSecret && (
                      <button
                        type="button"
                        onClick={() => setRemoveGlobalSecret(true)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    type="password"
                    placeholder={
                      connection.hasGlobalSecret
                        ? 'Enter new secret to replace existing'
                        : 'Enter global token or API key'
                    }
                    value={newGlobalSecret}
                    onChange={e => setNewGlobalSecret(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Payload Field Schema */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <h3 className="font-semibold text-white text-sm">Payload Field Schema</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300">
                      Content-Type:
                    </label>
                    <select
                      value={connection.contentType}
                      onChange={e =>
                        setConnection(p => ({ ...p, contentType: e.target.value as any }))
                      }
                      className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-xs font-mono text-white"
                    >
                      <option value="application/json">application/json</option>
                      <option value="application/x-www-form-urlencoded">
                        application/x-www-form-urlencoded
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300">
                      QR Payload Field Name:
                    </label>
                    <input
                      type="text"
                      placeholder="qr_payload"
                      value={connection.qrFieldName}
                      onChange={e => setConnection(p => ({ ...p, qrFieldName: e.target.value }))}
                      className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300">
                      Optional Nesting Path:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. data or invoice"
                      value={connection.qrNestingPath}
                      onChange={e => setConnection(p => ({ ...p, qrNestingPath: e.target.value }))}
                      className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300">
                      External User ID Field:
                    </label>
                    <input
                      type="text"
                      placeholder="employee_id"
                      value={connection.externalUserIdField}
                      onChange={e =>
                        setConnection(p => ({ ...p, externalUserIdField: e.target.value }))
                      }
                      className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-300">
                    Static JSON Fields (Optional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder='{"branch": "MAIN", "app": "eman_qr"}'
                    value={connection.staticFieldsJson}
                    onChange={e => setConnection(p => ({ ...p, staticFieldsJson: e.target.value }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-xs font-mono text-white"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-neutral-800 flex justify-end">
                <button
                  type="submit"
                  className="py-3.5 px-6 rounded-2xl bg-white text-black font-semibold transition text-xs shadow-lg active:scale-98 hover:bg-neutral-100"
                >
                  Save Connection Settings
                </button>
              </div>
            </form>
          ) : activeTab === 'users' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">Staff Credentials</h3>
                  <p className="text-[11px] text-neutral-400">
                    Outbound payloads are signed using each employee's personal assigned key.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-white text-black text-xs font-semibold shadow-md active:scale-98"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Employee</span>
                </button>
              </div>

              {/* User List */}
              <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-3xl overflow-hidden bg-black/40">
                {users.map(u => (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{u.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            u.role === 'admin'
                              ? 'bg-[#c7aa86] text-neutral-950'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.disabled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950 text-red-400 border border-red-800">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-neutral-400">
                        <span>@{u.username}</span>
                        <span>&bull;</span>
                        <span>Ext ID: {u.externalUserId || 'None'}</span>
                        <span>&bull;</span>
                        <span
                          className={`font-semibold ${
                            u.hasCredentials ? 'text-emerald-400' : 'text-[#c7aa86]'
                          }`}
                        >
                          {u.hasCredentials ? 'Encrypted Key Assigned' : 'No Key Assigned'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setUserSecretInput('');
                          setUserExternalIdInput(u.externalUserId || '');
                          setUserHeaderOverrideInput(u.credentialHeaderOverride || '');
                          setResetPasswordInput('');
                        }}
                        className="py-2 px-3 rounded-xl border border-neutral-700 bg-[#222225] hover:bg-[#2b2b2f] text-white font-semibold transition text-xs flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3 h-3 text-[#c7aa86]" />
                        <span>Manage</span>
                      </button>

                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        title={u.disabled ? 'Enable Account' : 'Disable Account'}
                        className={`p-2 rounded-xl border transition ${
                          u.disabled
                            ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40'
                            : 'text-neutral-400 border-neutral-800 hover:text-amber-400'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      {u.id !== currentUserId && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          title="Delete Employee"
                          className="p-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Audit Log */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">Delivery Audit Trail</h3>
                  <p className="text-[11px] text-neutral-400">
                    Confidential transmission events. Invoices payloads and secrets are completely redacted.
                  </p>
                </div>
                <button onClick={loadData} className="p-2 text-neutral-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-10 text-center text-neutral-500 italic">No transmissions recorded yet.</div>
              ) : (
                <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-3xl overflow-hidden bg-black/40">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3.5 text-xs flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.status === 'success'
                                ? 'bg-emerald-400'
                                : log.status === 'timeout'
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                            }`}
                          />
                          <span className="font-semibold text-white">{log.username}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">{log.responseSummary}</div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-[32px] bg-[#1a1a1d] border border-neutral-700 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white text-base">Add New Employee</h4>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Full Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mansour"
                    value={newUserData.name}
                    onChange={e => setNewUserData(p => ({ ...p, name: e.target.value }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Username:</label>
                  <input
                    type="text"
                    required
                    placeholder="tariq"
                    value={newUserData.username}
                    onChange={e => setNewUserData(p => ({ ...p, username: e.target.value }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Password (min 8 chars):</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newUserData.password}
                    onChange={e => setNewUserData(p => ({ ...p, password: e.target.value }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">External User ID:</label>
                  <input
                    type="text"
                    placeholder="EMP-104"
                    value={newUserData.externalUserId}
                    onChange={e => setNewUserData(p => ({ ...p, externalUserId: e.target.value }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Role:</label>
                  <select
                    value={newUserData.role}
                    onChange={e => setNewUserData(p => ({ ...p, role: e.target.value as any }))}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white"
                  >
                    <option value="user">User (Scanner Operator)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="py-2.5 px-4 rounded-xl border border-neutral-800 text-neutral-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-white text-black font-semibold"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Manage User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-[32px] bg-[#1a1a1d] border border-neutral-700 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-base">Manage {editingUser.name}</h4>
                  <span className="text-xs text-neutral-400">@{editingUser.username}</span>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-neutral-300">External User ID:</label>
                  <input
                    type="text"
                    value={userExternalIdInput}
                    onChange={e => setUserExternalIdInput(e.target.value)}
                    placeholder="EMP-902"
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-neutral-300">Per-User API Key:</label>
                    {editingUser.hasCredentials && (
                      <button
                        type="button"
                        onClick={() => handleClearUserCredentials(editingUser.id)}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Remove Key
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={userSecretInput}
                    onChange={e => setUserSecretInput(e.target.value)}
                    placeholder={editingUser.hasCredentials ? '•••••••• (Enter to replace)' : 'Enter key'}
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Optional Header Override:</label>
                  <input
                    type="text"
                    value={userHeaderOverrideInput}
                    onChange={e => setUserHeaderOverrideInput(e.target.value)}
                    placeholder="e.g. X-Agent-Token"
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300">Reset Password (Optional):</label>
                  <input
                    type="password"
                    value={resetPasswordInput}
                    onChange={e => setResetPasswordInput(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="py-2.5 px-4 rounded-xl border border-neutral-800 text-neutral-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUserCredentials}
                    disabled={isSavingUserCreds}
                    className="py-2.5 px-5 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingUserCreds && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
