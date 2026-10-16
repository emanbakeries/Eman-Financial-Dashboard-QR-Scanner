import fs from 'node:fs';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  EncryptedPayload,
  encryptSecret,
  decryptSecret,
  hashPassword,
  initMasterKey,
} from './security.ts';

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  passwordHash: string;
  passwordSalt: string;
  disabled: boolean;
  createdAt: string;
  externalUserId?: string;
  encryptedCredentials?: EncryptedPayload;
  credentialHeaderOverride?: string;
}

export interface CustomHeader {
  key: string;
  value: string;
  isSecret: boolean;
  encryptedValue?: EncryptedPayload;
}

export interface SuccessRule {
  type: 'status_code' | 'json_match';
  minStatus?: number;
  maxStatus?: number;
  jsonPath?: string;
  expectedValue?: string;
}

export interface ConnectionConfig {
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  authMode: 'bearer' | 'header' | 'none';
  authHeaderName: string;
  encryptedGlobalSecret?: EncryptedPayload;
  customHeaders: CustomHeader[];
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  qrFieldName: string;
  qrNestingPath: string; // e.g. "payload.qr" or empty
  externalUserIdField: string; // e.g. "user_id" or empty
  staticFieldsJson: string; // valid JSON string or empty
  successRule: SuccessRule;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  status: 'success' | 'failure' | 'timeout';
  statusCode?: number;
  responseSummary: string;
}

export interface DatabaseSchema {
  system: {
    isInitialized: boolean;
    ownerId?: string;
    appName: string;
    createdAt: string;
  };
  users: UserRecord[];
  connection: ConnectionConfig;
  auditLogs: AuditEntry[];
}

const DATA_DIR = path.resolve('./data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_CONNECTION: ConnectionConfig = {
  endpoint: '',
  method: 'POST',
  authMode: 'bearer',
  authHeaderName: 'Authorization',
  customHeaders: [],
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
};

class Database {
  private data: DatabaseSchema;
  private masterKey: Buffer;
  private supabase: SupabaseClient | null = null;
  public isSupabaseConnected: boolean = false;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch {
        // In read-only serverless filesystems like Vercel Lambda /tmp can be used
      }
    }
    this.masterKey = initMasterKey(fs);
    this.data = this.loadLocal();

    // Initialize Supabase if environment variables are provided
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.isSupabaseConnected = true;
        this.syncFromSupabase();
      } catch (err) {
        console.warn('Could not initialize Supabase client, using local cache:', err);
      }
    }
  }

  // Load from local store file
  private loadLocal(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse database file, initializing fresh:', e);
      }
    }

    const initial: DatabaseSchema = {
      system: {
        isInitialized: false,
        appName: 'Eman QR',
        createdAt: new Date().toISOString(),
      },
      users: [],
      connection: { ...DEFAULT_CONNECTION },
      auditLogs: [],
    };
    this.persistLocal(initial);
    return initial;
  }

  private persistLocal(dataToSave?: DatabaseSchema) {
    try {
      const toWrite = dataToSave || this.data;
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(toWrite, null, 2), { mode: 0o600 });
      fs.renameSync(tmpFile, DB_FILE);
    } catch {
      // In serverless environments where local disk might be ephemeral
    }
  }

  // Async sync from Supabase PostgreSQL tables if available
  private async syncFromSupabase() {
    if (!this.supabase) return;
    try {
      // Fetch system config
      const { data: configRows } = await this.supabase
        .from('eman_system_config')
        .select('*')
        .eq('id', 'config_primary')
        .single();

      if (configRows) {
        this.data.system.isInitialized = configRows.is_initialized ?? false;
        this.data.connection = {
          endpoint: configRows.endpoint || '',
          method: configRows.method || 'POST',
          authMode: configRows.auth_mode || 'bearer',
          authHeaderName: configRows.auth_header_name || 'Authorization',
          encryptedGlobalSecret: configRows.encrypted_global_secret || undefined,
          contentType: configRows.content_type || 'application/json',
          qrFieldName: configRows.qr_field_name || 'qr_payload',
          qrNestingPath: configRows.qr_nesting_path || '',
          externalUserIdField: configRows.external_user_id_field || 'employee_id',
          staticFieldsJson: configRows.static_fields_json || '',
          successRule: configRows.success_rule || DEFAULT_CONNECTION.successRule,
          customHeaders: configRows.custom_headers || [],
        };
      }

      // Fetch users
      const { data: userRows } = await this.supabase.from('eman_users').select('*');
      if (userRows && userRows.length > 0) {
        this.data.users = userRows.map(r => ({
          id: r.id,
          name: r.name,
          username: r.username,
          email: r.email,
          role: r.role,
          passwordHash: r.password_hash,
          passwordSalt: r.password_salt,
          disabled: r.disabled ?? false,
          createdAt: r.created_at,
          externalUserId: r.external_user_id || undefined,
          encryptedCredentials: r.encrypted_credentials || undefined,
          credentialHeaderOverride: r.credential_header_override || undefined,
        }));
      }

      // Fetch audit logs
      const { data: logRows } = await this.supabase
        .from('eman_audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (logRows) {
        this.data.auditLogs = logRows.map(l => ({
          id: l.id,
          userId: l.user_id,
          username: l.username,
          status: l.status,
          statusCode: l.status_code,
          responseSummary: l.response_summary,
          timestamp: l.timestamp,
        }));
      }

      this.persistLocal();
    } catch (e) {
      console.warn('Failed background sync with Supabase tables:', e);
    }
  }

  private async pushConfigToSupabase() {
    if (!this.supabase) return;
    try {
      await this.supabase.from('eman_system_config').upsert({
        id: 'config_primary',
        is_initialized: this.data.system.isInitialized,
        endpoint: this.data.connection.endpoint,
        method: this.data.connection.method,
        auth_mode: this.data.connection.authMode,
        auth_header_name: this.data.connection.authHeaderName,
        encrypted_global_secret: this.data.connection.encryptedGlobalSecret,
        content_type: this.data.connection.contentType,
        qr_field_name: this.data.connection.qrFieldName,
        qr_nesting_path: this.data.connection.qrNestingPath,
        external_user_id_field: this.data.connection.externalUserIdField,
        static_fields_json: this.data.connection.staticFieldsJson,
        success_rule: this.data.connection.successRule,
        custom_headers: this.data.connection.customHeaders,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error syncing config to Supabase:', err);
    }
  }

  private async pushUserToSupabase(user: UserRecord) {
    if (!this.supabase) return;
    try {
      await this.supabase.from('eman_users').upsert({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        password_hash: user.passwordHash,
        password_salt: user.passwordSalt,
        disabled: user.disabled,
        external_user_id: user.externalUserId || null,
        encrypted_credentials: user.encryptedCredentials || null,
        credential_header_override: user.credentialHeaderOverride || null,
        created_at: user.createdAt,
      });
    } catch (err) {
      console.error('Error syncing user to Supabase:', err);
    }
  }

  public getSystem() {
    return this.data.system;
  }

  public isInitialized(): boolean {
    return this.data.system.isInitialized && this.data.users.length > 0;
  }

  public setupOwner(name: string, username: string, email: string, password: string): UserRecord {
    if (this.isInitialized()) {
      throw new Error('Initial setup is already locked. Admin already provisioned.');
    }

    const { hash, salt } = hashPassword(password);
    const ownerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerUser: UserRecord = {
      id: ownerId,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      role: 'admin',
      passwordHash: hash,
      passwordSalt: salt,
      disabled: false,
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(ownerUser);
    this.data.system.isInitialized = true;
    this.data.system.ownerId = ownerId;
    this.persistLocal();

    this.pushConfigToSupabase();
    this.pushUserToSupabase(ownerUser);

    return ownerUser;
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public findUserByUsernameOrEmail(identifier: string): UserRecord | undefined {
    const clean = identifier.trim().toLowerCase();
    return this.data.users.find(u => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean);
  }

  public getAllUsers(): UserRecord[] {
    return this.data.users;
  }

  public createUser(userData: {
    username: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    password: string;
    externalUserId?: string;
  }): UserRecord {
    const existing = this.findUserByUsernameOrEmail(userData.username);
    if (existing) {
      throw new Error(`Username "${userData.username}" is already in use.`);
    }
    if (userData.email) {
      const existingEmail = this.findUserByUsernameOrEmail(userData.email);
      if (existingEmail) {
        throw new Error(`Email "${userData.email}" is already registered.`);
      }
    }

    const { hash, salt } = hashPassword(userData.password);
    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: userData.username.trim().toLowerCase(),
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      passwordHash: hash,
      passwordSalt: salt,
      disabled: false,
      createdAt: new Date().toISOString(),
      externalUserId: userData.externalUserId?.trim() || undefined,
    };

    this.data.users.push(newUser);
    this.persistLocal();
    this.pushUserToSupabase(newUser);

    return newUser;
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string;
      role?: 'admin' | 'user';
      disabled?: boolean;
      externalUserId?: string;
      newPassword?: string;
    }
  ): UserRecord {
    const user = this.findUserById(id);
    if (!user) {
      throw new Error('User not found.');
    }

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.email !== undefined) user.email = updates.email.trim().toLowerCase();
    if (updates.role !== undefined) {
      if (user.role === 'admin' && updates.role === 'user') {
        const adminCount = this.data.users.filter(u => u.role === 'admin' && !u.disabled).length;
        if (adminCount <= 1) {
          throw new Error('Cannot demote the sole active administrator.');
        }
      }
      user.role = updates.role;
    }
    if (updates.disabled !== undefined) {
      if (updates.disabled && user.role === 'admin') {
        const adminCount = this.data.users.filter(u => u.role === 'admin' && !u.disabled && u.id !== id).length;
        if (adminCount === 0) {
          throw new Error('Cannot disable the last active administrator.');
        }
      }
      user.disabled = updates.disabled;
    }
    if (updates.externalUserId !== undefined) {
      user.externalUserId = updates.externalUserId.trim() || undefined;
    }
    if (updates.newPassword) {
      const { hash, salt } = hashPassword(updates.newPassword);
      user.passwordHash = hash;
      user.passwordSalt = salt;
    }

    this.persistLocal();
    this.pushUserToSupabase(user);

    return user;
  }

  public deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new Error('Cannot delete your own account.');
    }
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) {
      throw new Error('User not found.');
    }
    this.data.users.splice(idx, 1);
    this.persistLocal();

    if (this.supabase) {
      Promise.resolve(this.supabase.from('eman_users').delete().eq('id', id)).catch(console.error);
    }
  }

  // User credentials management
  public setUserCredentials(
    id: string,
    credentials: {
      secret?: string;
      headerOverride?: string;
      clear?: boolean;
    }
  ) {
    const user = this.findUserById(id);
    if (!user) throw new Error('User not found.');

    if (credentials.clear) {
      user.encryptedCredentials = undefined;
      user.credentialHeaderOverride = undefined;
    } else if (credentials.secret) {
      user.encryptedCredentials = encryptSecret(credentials.secret, this.masterKey);
      user.credentialHeaderOverride = credentials.headerOverride?.trim() || undefined;
    }

    this.persistLocal();
    this.pushUserToSupabase(user);
  }

  public getUserSecret(id: string): string | null {
    const user = this.findUserById(id);
    if (!user || !user.encryptedCredentials) return null;
    return decryptSecret(user.encryptedCredentials, this.masterKey);
  }

  // Connection settings
  public getConnectionConfig(): ConnectionConfig {
    return this.data.connection;
  }

  public updateConnectionConfig(newConfig: Partial<ConnectionConfig>) {
    this.data.connection = {
      ...this.data.connection,
      ...newConfig,
    };
    this.persistLocal();
    this.pushConfigToSupabase();
  }

  public setGlobalSecret(secret: string | null) {
    if (!secret) {
      this.data.connection.encryptedGlobalSecret = undefined;
    } else {
      this.data.connection.encryptedGlobalSecret = encryptSecret(secret, this.masterKey);
    }
    this.persistLocal();
    this.pushConfigToSupabase();
  }

  public getGlobalSecret(): string | null {
    if (!this.data.connection.encryptedGlobalSecret) return null;
    return decryptSecret(this.data.connection.encryptedGlobalSecret, this.masterKey);
  }

  public setCustomHeaders(headers: Array<{ key: string; value: string; isSecret: boolean }>) {
    this.data.connection.customHeaders = headers.map(h => {
      if (h.isSecret) {
        return {
          key: h.key,
          value: '',
          isSecret: true,
          encryptedValue: encryptSecret(h.value, this.masterKey),
        };
      }
      return {
        key: h.key,
        value: h.value,
        isSecret: false,
      };
    });
    this.persistLocal();
    this.pushConfigToSupabase();
  }

  public resolveCustomHeaders(): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const h of this.data.connection.customHeaders) {
      if (h.isSecret && h.encryptedValue) {
        try {
          resolved[h.key] = decryptSecret(h.encryptedValue, this.masterKey);
        } catch {
          // ignore
        }
      } else if (!h.isSecret) {
        resolved[h.key] = h.value;
      }
    }
    return resolved;
  }

  // Audit logs
  public addAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const newEntry: AuditEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.data.auditLogs.unshift(newEntry);
    if (this.data.auditLogs.length > 100) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 100);
    }
    this.persistLocal();

    if (this.supabase) {
      Promise.resolve(
        this.supabase.from('eman_audit_logs').insert({
          id: newEntry.id,
          user_id: newEntry.userId,
          username: newEntry.username,
          status: newEntry.status,
          status_code: newEntry.statusCode,
          response_summary: newEntry.responseSummary,
          timestamp: newEntry.timestamp,
        })
      ).catch(console.error);
    }
  }

  public getRecentAuditLogs(limit = 30): AuditEntry[] {
    return this.data.auditLogs.slice(0, limit);
  }
}

export const db = new Database();
