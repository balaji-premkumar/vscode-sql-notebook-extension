import * as vscode from 'vscode';
import * as sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionProfile, ServerGroup } from './types';
import { MssqlIntegration } from './mssqlIntegration';

export class ConnectionManager {
  private connections: Map<string, ConnectionProfile> = new Map();
  private groups: Map<string, ServerGroup> = new Map();
  private pools: Map<string, sql.ConnectionPool> = new Map();
  private activeConnectionId: string | undefined;
  private activeDatabase: string | undefined;
  private readonly storageKey = 'sqlNotebook.connections';
  private readonly groupsStorageKey = 'sqlNotebook.groups';
  private readonly localFilePath: string;
  private readonly groupsFilePath: string;

  private readonly _onDidChangeConnections = new vscode.EventEmitter<void>();
  readonly onDidChangeConnections = this._onDidChangeConnections.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.localFilePath = path.join(context.globalStorageUri.fsPath, 'connections.json');
    this.groupsFilePath = path.join(context.globalStorageUri.fsPath, 'groups.json');
    this.loadConnections();
    this.loadGroups();
  }

  private loadConnections(): void {
    // Try local JSON file first
    const fileProfiles = this.loadFromFile();
    if (fileProfiles.length > 0) {
      for (const conn of fileProfiles) {
        this.connections.set(conn.id, conn);
      }
    } else {
      // Fallback: migrate from globalState if present
      const stored = this.context.globalState.get<ConnectionProfile[]>(this.storageKey, []);
      for (const conn of stored) {
        conn.source = conn.source || 'local';
        this.connections.set(conn.id, conn);
      }
      if (stored.length > 0) {
        this.saveToFile();
      }
    }
  }

  private loadFromFile(): ConnectionProfile[] {
    try {
      if (fs.existsSync(this.localFilePath)) {
        const data = fs.readFileSync(this.localFilePath, 'utf-8');
        return JSON.parse(data) as ConnectionProfile[];
      }
    } catch { /* ignore parse errors */ }
    return [];
  }

  private saveToFile(): void {
    const profiles = Array.from(this.connections.values()).map(c => ({
      ...c,
      password: undefined
    }));
    const dir = path.dirname(this.localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.localFilePath, JSON.stringify(profiles, null, 2), 'utf-8');
  }

  private async saveConnections(): Promise<void> {
    this.saveToFile();
    // Also keep globalState in sync for backward compat
    const profiles = Array.from(this.connections.values()).map(c => ({
      ...c,
      password: undefined
    }));
    await this.context.globalState.update(this.storageKey, profiles);
  }

  private loadGroups(): void {
    try {
      if (fs.existsSync(this.groupsFilePath)) {
        const data = fs.readFileSync(this.groupsFilePath, 'utf-8');
        const parsed = JSON.parse(data) as ServerGroup[];
        for (const g of parsed) {
          this.groups.set(g.id, g);
        }
      } else {
        const stored = this.context.globalState.get<ServerGroup[]>(this.groupsStorageKey, []);
        for (const g of stored) { this.groups.set(g.id, g); }
      }
    } catch { /* ignore */ }
  }

  private saveGroups(): void {
    const list = Array.from(this.groups.values());
    const dir = path.dirname(this.groupsFilePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(this.groupsFilePath, JSON.stringify(list, null, 2), 'utf-8');
    this.context.globalState.update(this.groupsStorageKey, list);
  }

  getGroups(): ServerGroup[] {
    return Array.from(this.groups.values());
  }

  async createGroup(): Promise<ServerGroup | undefined> {
    const name = await vscode.window.showInputBox({ prompt: 'Group name', placeHolder: 'Production Servers' });
    if (!name) { return undefined; }
    const group: ServerGroup = { id: `grp_${Date.now()}`, name };
    this.groups.set(group.id, group);
    this.saveGroups();
    this._onDidChangeConnections.fire();
    return group;
  }

  async renameGroup(groupId: string): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) { return; }
    const name = await vscode.window.showInputBox({ prompt: 'New group name', value: group.name });
    if (!name) { return; }
    group.name = name;
    this.groups.set(groupId, group);
    this.saveGroups();
    this._onDidChangeConnections.fire();
  }

  async removeGroup(groupId: string): Promise<void> {
    // Ungroup connections, don't delete them
    for (const [, conn] of this.connections) {
      if (conn.groupId === groupId) {
        conn.groupId = undefined;
      }
    }
    this.groups.delete(groupId);
    this.saveGroups();
    await this.saveConnections();
    this._onDidChangeConnections.fire();
  }

  async moveToGroup(connectionId: string): Promise<void> {
    const groups = this.getGroups();
    const items: (vscode.QuickPickItem & { groupId?: string })[] = [
      { label: '$(circle-slash) No Group', description: 'Remove from group', groupId: undefined },
      ...groups.map(g => ({ label: `$(folder) ${g.name}`, groupId: g.id })),
      { label: '$(add) Create New Group...', groupId: '__new__' }
    ];

    const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Move connection to group' });
    if (!picked) { return; }

    let targetGroupId: string | undefined = picked.groupId;
    if (targetGroupId === '__new__') {
      const newGroup = await this.createGroup();
      if (!newGroup) { return; }
      targetGroupId = newGroup.id;
    }

    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.groupId = targetGroupId;
      await this.saveConnections();
      this._onDidChangeConnections.fire();
    }
  }

  async setConnectionGroup(connectionId: string, groupId: string | undefined): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) { return; }
    conn.groupId = groupId;
    await this.saveConnections();
    this._onDidChangeConnections.fire();
  }

  async getServerProperties(connectionId: string): Promise<Record<string, string>> {
    const pool = await this.getPool(connectionId);
    const result = await pool.request().query(`
      SELECT
        SERVERPROPERTY('ServerName') AS [Server Name],
        SERVERPROPERTY('ProductVersion') AS [Version],
        SERVERPROPERTY('ProductLevel') AS [Product Level],
        SERVERPROPERTY('Edition') AS [Edition],
        SERVERPROPERTY('EngineEdition') AS [Engine Edition],
        SERVERPROPERTY('Collation') AS [Collation],
        SERVERPROPERTY('IsClustered') AS [Is Clustered],
        SERVERPROPERTY('IsHadrEnabled') AS [Always On Enabled],
        @@VERSION AS [Full Version],
        DB_NAME() AS [Current Database],
        SYSTEM_USER AS [Login],
        (SELECT COUNT(*) FROM sys.databases) AS [Database Count],
        (SELECT cpu_count FROM sys.dm_os_sys_info) AS [CPU Count],
        (SELECT CAST(physical_memory_kb / 1024.0 AS DECIMAL(18,0)) FROM sys.dm_os_sys_info) AS [Memory (MB)]
    `);
    const row = result.recordset[0] as Record<string, unknown>;
    const props: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      props[key] = val === null ? 'N/A' : String(val);
    }
    return props;
  }

  getActiveDatabase(): string | undefined {
    if (this.activeDatabase) { return this.activeDatabase; }
    const conn = this.getActiveConnection();
    return conn?.database;
  }

  setActiveDatabase(database: string): void {
    this.activeDatabase = database;
    this._onDidChangeConnections.fire();
  }

  async selectDatabase(): Promise<string | undefined> {
    const connectionId = this.activeConnectionId;
    if (!connectionId) {
      vscode.window.showWarningMessage('No active connection. Select a connection first.');
      return undefined;
    }

    try {
      const pool = await this.getPool(connectionId);
      const result = await pool.request().query('SELECT name FROM sys.databases ORDER BY name');
      const databases = result.recordset.map((r: Record<string, unknown>) => r['name'] as string);

      const currentDb = this.getActiveDatabase();
      const items = databases.map(db => ({
        label: db,
        description: db === currentDb ? '(current)' : undefined
      }));

      const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select database for notebook queries' });
      if (!picked) { return undefined; }

      this.activeDatabase = picked.label;
      this._onDidChangeConnections.fire();
      return picked.label;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to list databases: ${msg}`);
      return undefined;
    }
  }

  getAll(): ConnectionProfile[] {
    return Array.from(this.connections.values());
  }

  get(id: string): ConnectionProfile | undefined {
    return this.connections.get(id);
  }

  getActiveConnection(): ConnectionProfile | undefined {
    if (!this.activeConnectionId) { return undefined; }
    return this.connections.get(this.activeConnectionId);
  }

  getActiveConnectionId(): string | undefined {
    return this.activeConnectionId;
  }

  setActiveById(id: string): boolean {
    const profile = this.connections.get(id);
    if (!profile) { return false; }
    this.activeConnectionId = id;
    this.activeDatabase = undefined;
    this._onDidChangeConnections.fire();
    return true;
  }

  getConnectionsInGroup(groupId: string): ConnectionProfile[] {
    return Array.from(this.connections.values()).filter(c => c.groupId === groupId);
  }

  async addConnectionFromForm(data: {
    name: string; server: string; port: number; database: string;
    authenticationType: 'sql' | 'windows'; user?: string; password?: string;
    encrypt: boolean; trustServerCertificate: boolean;
  }): Promise<ConnectionProfile> {
    const profile: ConnectionProfile = {
      id: `conn_${Date.now()}`,
      name: data.name,
      server: data.server,
      port: data.port,
      database: data.database,
      authenticationType: data.authenticationType,
      user: data.user,
      encrypt: data.encrypt,
      trustServerCertificate: data.trustServerCertificate,
      source: 'local'
    };
    this.connections.set(profile.id, profile);
    if (data.password) {
      await this.context.secrets.store(`sqlnb.pwd.${profile.id}`, data.password);
    }
    await this.saveConnections();
    this._onDidChangeConnections.fire();
    return profile;
  }

  async updateConnection(id: string, data: {
    name: string; server: string; port: number; database: string;
    authenticationType: 'sql' | 'windows'; user?: string;
    encrypt: boolean; trustServerCertificate: boolean;
  }, password?: string): Promise<void> {
    const existing = this.connections.get(id);
    if (!existing) { return; }

    await this.disconnect(id);

    existing.name = data.name;
    existing.server = data.server;
    existing.port = data.port;
    existing.database = data.database;
    existing.authenticationType = data.authenticationType;
    existing.user = data.user;
    existing.encrypt = data.encrypt;
    existing.trustServerCertificate = data.trustServerCertificate;

    if (password) {
      await this.context.secrets.store(`sqlnb.pwd.${id}`, password);
    }
    await this.saveConnections();
    this._onDidChangeConnections.fire();
  }

  async testConnection(data: {
    server: string; port: number; database: string;
    authenticationType: 'sql' | 'windows'; user?: string; password?: string;
    encrypt: boolean; trustServerCertificate: boolean;
  }): Promise<void> {
    const sql = require('mssql') as typeof import('mssql');
    const config: import('mssql').config = {
      server: data.server,
      port: data.port,
      database: data.database,
      options: {
        encrypt: data.encrypt,
        trustServerCertificate: data.trustServerCertificate
      },
      connectionTimeout: 10000,
      requestTimeout: 10000
    };
    if (data.authenticationType === 'sql') {
      config.user = data.user;
      config.password = data.password;
    } else {
      config.authentication = { type: 'ntlm', options: { domain: '', userName: '', password: '' } };
    }
    const pool = new sql.ConnectionPool(config);
    try {
      await pool.connect();
      await pool.request().query('SELECT 1');
    } finally {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }

  async addConnection(): Promise<ConnectionProfile | undefined> {
    const name = await vscode.window.showInputBox({ prompt: 'Connection name', placeHolder: 'My SQL Server' });
    if (!name) { return undefined; }

    const server = await vscode.window.showInputBox({ prompt: 'Server address', placeHolder: 'localhost' });
    if (!server) { return undefined; }

    const portStr = await vscode.window.showInputBox({ prompt: 'Port', value: '1433' });
    const port = parseInt(portStr || '1433', 10);

    const database = await vscode.window.showInputBox({ prompt: 'Database name', placeHolder: 'master' });
    if (!database) { return undefined; }

    const authType = await vscode.window.showQuickPick(
      [{ label: 'SQL Login', value: 'sql' }, { label: 'Windows Authentication', value: 'windows' }],
      { placeHolder: 'Authentication type' }
    );
    if (!authType) { return undefined; }

    let user: string | undefined;
    let password: string | undefined;

    if (authType.value === 'sql') {
      user = await vscode.window.showInputBox({ prompt: 'Username' });
      if (!user) { return undefined; }
      password = await vscode.window.showInputBox({ prompt: 'Password', password: true });
      if (!password) { return undefined; }
    }

    const trustCert = await vscode.window.showQuickPick(
      [{ label: 'Yes', value: true }, { label: 'No', value: false }],
      { placeHolder: 'Trust server certificate?' }
    );

    const profile: ConnectionProfile = {
      id: `conn_${Date.now()}`,
      name,
      server,
      port,
      database,
      authenticationType: authType.value as 'sql' | 'windows',
      user,
      password,
      encrypt: true,
      trustServerCertificate: trustCert?.value ?? true
    };

    this.connections.set(profile.id, profile);
    if (password) {
      await this.context.secrets.store(`sqlnb.pwd.${profile.id}`, password);
    }
    await this.saveConnections();
    this._onDidChangeConnections.fire();
    return profile;
  }

  async importFromMssql(): Promise<ConnectionProfile | undefined> {
    const profile = await MssqlIntegration.importConnection();
    if (!profile) { return undefined; }

    this.connections.set(profile.id, profile);
    if (profile.password) {
      await this.context.secrets.store(`sqlnb.pwd.${profile.id}`, profile.password);
      profile.password = undefined;
    }
    await this.saveConnections();
    this._onDidChangeConnections.fire();
    return profile;
  }

  async removeConnection(id: string): Promise<void> {
    await this.disconnect(id);
    this.connections.delete(id);
    await this.context.secrets.delete(`sqlnb.pwd.${id}`);
    await this.saveConnections();
    if (this.activeConnectionId === id) {
      this.activeConnectionId = undefined;
    }
    this._onDidChangeConnections.fire();
  }

  async selectConnection(): Promise<ConnectionProfile | undefined> {
    const items = this.getAll().map(c => ({
      label: c.name,
      description: `${c.server}:${c.port} / ${c.database}`,
      id: c.id
    }));

    if (items.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'No connections configured. Add one now?', 'Add Connection'
      );
      if (action === 'Add Connection') {
        return this.addConnection();
      }
      return undefined;
    }

    const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select active connection' });
    if (!picked) { return undefined; }

    this.activeConnectionId = picked.id;
    this._onDidChangeConnections.fire();
    return this.connections.get(picked.id);
  }

  async getPool(connectionId: string): Promise<sql.ConnectionPool> {
    const existing = this.pools.get(connectionId);
    if (existing?.connected) {
      return existing;
    }

    const profile = this.connections.get(connectionId);
    if (!profile) {
      throw new Error(`Connection '${connectionId}' not found`);
    }

    let password = profile.password;
    if (!password && profile.authenticationType === 'sql') {
      password = await this.context.secrets.get(`sqlnb.pwd.${connectionId}`);
    }

    const config: sql.config = {
      server: profile.server,
      port: profile.port,
      database: profile.database,
      options: {
        encrypt: profile.encrypt,
        trustServerCertificate: profile.trustServerCertificate
      },
      requestTimeout: 60000,
      connectionTimeout: 15000
    };

    if (profile.authenticationType === 'sql') {
      config.user = profile.user;
      config.password = password;
    } else {
      config.authentication = { type: 'ntlm', options: { domain: '', userName: '', password: '' } };
    }

    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    this.pools.set(connectionId, pool);
    return pool;
  }

  async disconnect(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
      this.pools.delete(connectionId);
    }
  }

  async dispose(): Promise<void> {
    for (const [id] of this.pools) {
      await this.disconnect(id);
    }
    this._onDidChangeConnections.dispose();
  }
}
