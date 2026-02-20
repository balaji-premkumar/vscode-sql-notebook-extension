import * as vscode from 'vscode';
import { ConnectionProfile } from './types';
import { ConnectionManager } from './connectionManager';

export class ConnectionEditorPanel {
  private static panels: Map<string, ConnectionEditorPanel> = new Map();
  private readonly panel: vscode.WebviewPanel;
  private readonly connectionManager: ConnectionManager;
  private readonly mode: 'add' | 'edit';
  private readonly existingId?: string;
  private disposed = false;

  static show(
    context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
    mode: 'add' | 'edit',
    existingProfile?: ConnectionProfile,
    targetGroupId?: string
  ): ConnectionEditorPanel {
    const key = mode === 'edit' && existingProfile ? existingProfile.id : (targetGroupId || '__new__');
    const existing = ConnectionEditorPanel.panels.get(key);
    if (existing && !existing.disposed) {
      existing.panel.reveal();
      return existing;
    }

    const editor = new ConnectionEditorPanel(context, connectionManager, mode, existingProfile, targetGroupId);
    ConnectionEditorPanel.panels.set(key, editor);
    return editor;
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    connectionManager: ConnectionManager,
    mode: 'add' | 'edit',
    existingProfile?: ConnectionProfile,
    private readonly targetGroupId?: string
  ) {
    this.connectionManager = connectionManager;
    this.mode = mode;
    this.existingId = existingProfile?.id;

    let title = mode === 'edit' ? `Edit Connection - ${existingProfile?.name}` : 'New Connection';
    if (mode === 'add' && targetGroupId) {
      const group = connectionManager.getGroups().find(g => g.id === targetGroupId);
      if (group) { title = `New Connection - ${group.name}`; }
    }
    this.panel = vscode.window.createWebviewPanel(
      'sqlNotebook.connectionEditor',
      title,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.html = this.getHtml(existingProfile);
    this.panel.onDidDispose(() => {
      this.disposed = true;
      const key = this.existingId || '__new__';
      ConnectionEditorPanel.panels.delete(key);
    });

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'save':
          await this.handleSave(msg.data);
          break;
        case 'testConnection':
          await this.handleTestConnection(msg.data);
          break;
        case 'cancel':
          this.panel.dispose();
          break;
      }
    });
  }

  private async handleSave(data: {
    name: string; server: string; port: string; database: string;
    authenticationType: string; user: string; password: string;
    encrypt: boolean; trustServerCertificate: boolean;
  }): Promise<void> {
    const port = parseInt(data.port || '1433', 10);
    if (this.mode === 'edit' && this.existingId) {
      await this.connectionManager.updateConnection(this.existingId, {
        name: data.name,
        server: data.server,
        port,
        database: data.database,
        authenticationType: data.authenticationType as 'sql' | 'windows',
        user: data.authenticationType === 'sql' ? data.user : undefined,
        encrypt: data.encrypt,
        trustServerCertificate: data.trustServerCertificate
      }, data.authenticationType === 'sql' ? data.password : undefined);
      this.panel.webview.postMessage({ type: 'saved', message: 'Connection updated successfully.' });
    } else {
      const profile = await this.connectionManager.addConnectionFromForm({
        name: data.name,
        server: data.server,
        port,
        database: data.database,
        authenticationType: data.authenticationType as 'sql' | 'windows',
        user: data.authenticationType === 'sql' ? data.user : undefined,
        password: data.authenticationType === 'sql' ? data.password : undefined,
        encrypt: data.encrypt,
        trustServerCertificate: data.trustServerCertificate
      });
      if (profile) {
        if (this.targetGroupId) {
          await this.connectionManager.setConnectionGroup(profile.id, this.targetGroupId);
        }
        this.connectionManager.setActiveById(profile.id);
        const groupMsg = this.targetGroupId ? ' and added to group' : '';
        this.panel.webview.postMessage({ type: 'saved', message: `Connection added${groupMsg} successfully.` });
      }
    }
    setTimeout(() => { if (!this.disposed) { this.panel.dispose(); } }, 800);
  }

  private async handleTestConnection(data: {
    server: string; port: string; database: string;
    authenticationType: string; user: string; password: string;
    encrypt: boolean; trustServerCertificate: boolean;
  }): Promise<void> {
    try {
      await this.connectionManager.testConnection({
        server: data.server,
        port: parseInt(data.port || '1433', 10),
        database: data.database,
        authenticationType: data.authenticationType as 'sql' | 'windows',
        user: data.authenticationType === 'sql' ? data.user : undefined,
        password: data.authenticationType === 'sql' ? data.password : undefined,
        encrypt: data.encrypt,
        trustServerCertificate: data.trustServerCertificate
      });
      this.panel.webview.postMessage({ type: 'testResult', success: true, message: 'Connection successful!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({ type: 'testResult', success: false, message: msg });
    }
  }

  private getHtml(profile?: ConnectionProfile): string {
    const n = (v: string | undefined) => v || '';
    const p = profile;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: var(--vscode-font-family, sans-serif); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 20px; margin: 0; }
  h2 { margin-top: 0; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
  .form-group { margin-bottom: 14px; }
  label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 0.9em; }
  input, select { width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--vscode-input-border, #ccc); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; font-size: 0.95em; }
  input:focus, select:focus { outline: none; border-color: var(--vscode-focusBorder); }
  .row { display: flex; gap: 12px; }
  .row .form-group { flex: 1; }
  .checkbox-group { display: flex; align-items: center; gap: 8px; }
  .checkbox-group input { width: auto; }
  .auth-fields { margin-top: 8px; padding: 12px; background: var(--vscode-editor-selectionBackground); border-radius: 4px; }
  .btn-row { display: flex; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border); }
  button { padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em; font-weight: 500; }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .msg { margin-top: 12px; padding: 8px 12px; border-radius: 3px; font-size: 0.9em; display: none; }
  .msg.success { display: block; background: var(--vscode-testing-iconPassed); color: #fff; }
  .msg.error { display: block; background: var(--vscode-testing-iconFailed); color: #fff; }
  .msg.info { display: block; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
</style>
</head>
<body>
  <h2>${this.mode === 'edit' ? 'Edit Connection' : 'New Connection'}</h2>

  <div class="form-group">
    <label for="name">Connection Name</label>
    <input id="name" type="text" placeholder="My SQL Server" value="${n(p?.name)}" />
  </div>

  <div class="row">
    <div class="form-group">
      <label for="server">Server Address</label>
      <input id="server" type="text" placeholder="localhost or server.database.windows.net" value="${n(p?.server)}" />
    </div>
    <div class="form-group" style="max-width:120px">
      <label for="port">Port</label>
      <input id="port" type="number" value="${p?.port ?? 1433}" />
    </div>
  </div>

  <div class="form-group">
    <label for="database">Default Database</label>
    <input id="database" type="text" placeholder="master" value="${n(p?.database)}" />
  </div>

  <div class="form-group">
    <label for="authType">Authentication</label>
    <select id="authType">
      <option value="sql" ${p?.authenticationType === 'sql' || !p ? 'selected' : ''}>SQL Login</option>
      <option value="windows" ${p?.authenticationType === 'windows' ? 'selected' : ''}>Windows Authentication</option>
    </select>
  </div>

  <div class="auth-fields" id="sqlAuthFields">
    <div class="form-group">
      <label for="user">Username</label>
      <input id="user" type="text" placeholder="sa" value="${n(p?.user)}" />
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="Enter password" value="" />
    </div>
  </div>

  <div class="row" style="margin-top: 14px;">
    <div class="checkbox-group">
      <input id="encrypt" type="checkbox" ${p?.encrypt !== false ? 'checked' : ''} />
      <label for="encrypt" style="margin-bottom:0;font-weight:normal">Encrypt Connection</label>
    </div>
    <div class="checkbox-group">
      <input id="trustCert" type="checkbox" ${p?.trustServerCertificate !== false ? 'checked' : ''} />
      <label for="trustCert" style="margin-bottom:0;font-weight:normal">Trust Server Certificate</label>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn-primary" onclick="save()">
      ${this.mode === 'edit' ? 'Update Connection' : 'Add Connection'}
    </button>
    <button class="btn-secondary" onclick="testConn()">Test Connection</button>
    <button class="btn-secondary" onclick="cancel()">Cancel</button>
  </div>

  <div id="statusMsg" class="msg"></div>

<script>
  const vscode = acquireVsCodeApi();

  document.getElementById('authType').addEventListener('change', (e) => {
    document.getElementById('sqlAuthFields').style.display = e.target.value === 'sql' ? 'block' : 'none';
  });
  if (document.getElementById('authType').value === 'windows') {
    document.getElementById('sqlAuthFields').style.display = 'none';
  }

  function getData() {
    return {
      name: document.getElementById('name').value,
      server: document.getElementById('server').value,
      port: document.getElementById('port').value,
      database: document.getElementById('database').value,
      authenticationType: document.getElementById('authType').value,
      user: document.getElementById('user').value,
      password: document.getElementById('password').value,
      encrypt: document.getElementById('encrypt').checked,
      trustServerCertificate: document.getElementById('trustCert').checked
    };
  }

  function showMsg(text, type) {
    const el = document.getElementById('statusMsg');
    el.textContent = text;
    el.className = 'msg ' + type;
  }

  function save() {
    const d = getData();
    if (!d.name || !d.server || !d.database) {
      showMsg('Name, Server, and Database are required.', 'error');
      return;
    }
    if (d.authenticationType === 'sql' && (!d.user || !d.password)) {
      showMsg('Username and Password are required for SQL Login.', 'error');
      return;
    }
    showMsg('Saving...', 'info');
    vscode.postMessage({ type: 'save', data: d });
  }

  function testConn() {
    const d = getData();
    if (!d.server || !d.database) {
      showMsg('Server and Database are required to test.', 'error');
      return;
    }
    showMsg('Testing connection...', 'info');
    vscode.postMessage({ type: 'testConnection', data: d });
  }

  function cancel() {
    vscode.postMessage({ type: 'cancel' });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'testResult') {
      showMsg(msg.message, msg.success ? 'success' : 'error');
    } else if (msg.type === 'saved') {
      showMsg(msg.message, 'success');
    }
  });
</script>
</body>
</html>`;
  }
}
