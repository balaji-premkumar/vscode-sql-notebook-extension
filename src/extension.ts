import * as vscode from 'vscode';
import { SqlNotebookSerializer } from './serializer';
import { SqlNotebookController } from './controller';
import { SqlJupyterKernel } from './jupyterKernel';
import { ConnectionManager } from './connectionManager';
import { ConnectionTreeProvider, ConnectionTreeDragAndDropController, ObjectTreeItem } from './connectionTreeProvider';
import { ConnectionEditorPanel } from './connectionEditorPanel';
import { MssqlIntegration } from './mssqlIntegration';

let connectionManager: ConnectionManager;
let controller: SqlNotebookController;
let jupyterKernel: SqlJupyterKernel;
let statusBarItem: vscode.StatusBarItem;
let dbStatusBarItem: vscode.StatusBarItem;

function updateStatusBar(): void {
  const active = connectionManager.getActiveConnection();
  if (active) {
    statusBarItem.text = `$(server) ${active.name}`;
    statusBarItem.tooltip = `Server: ${active.server}:${active.port}\nClick to change`;
    statusBarItem.color = undefined;
  } else {
    statusBarItem.text = '$(server) No Connection';
    statusBarItem.tooltip = 'Click to select a database connection';
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  }
  statusBarItem.show();

  const db = connectionManager.getActiveDatabase();
  if (active) {
    dbStatusBarItem.text = `$(database) ${db || active.database}`;
    dbStatusBarItem.tooltip = `Database: ${db || active.database}\nClick to change`;
    dbStatusBarItem.show();
  } else {
    dbStatusBarItem.hide();
  }

  // Update context keys so editor/title menu labels reflect current state
  const connName = active ? active.name : 'No Connection';
  const dbName = active ? (db || active.database) : '';
  vscode.commands.executeCommand('setContext', 'sqlNotebook.activeConnectionName', connName);
  vscode.commands.executeCommand('setContext', 'sqlNotebook.activeDatabaseName', dbName);
  vscode.commands.executeCommand('setContext', 'sqlNotebook.hasActiveConnection', !!active);
}

export function activate(context: vscode.ExtensionContext): void {
  connectionManager = new ConnectionManager(context);
  controller = new SqlNotebookController(connectionManager);
  jupyterKernel = new SqlJupyterKernel(connectionManager);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  statusBarItem.command = 'sqlNotebook.selectConnection';
  context.subscriptions.push(statusBarItem);

  dbStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  dbStatusBarItem.command = 'sqlNotebook.selectDatabase';
  context.subscriptions.push(dbStatusBarItem);

  connectionManager.onDidChangeConnections(() => {
    updateStatusBar();
    controller.updateLabel(connectionManager);
    jupyterKernel.updateLabel(connectionManager);
  });
  updateStatusBar();

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'sql-notebook',
      new SqlNotebookSerializer(),
      { transientOutputs: true }
    )
  );

  const treeProvider = new ConnectionTreeProvider(connectionManager);
  const dragDropController = new ConnectionTreeDragAndDropController(connectionManager);
  const treeView = vscode.window.createTreeView('sqlNotebook.connections', {
    treeDataProvider: treeProvider,
    dragAndDropController: dragDropController,
    canSelectMany: true
  });
  context.subscriptions.push(treeView);

  // New Notebook
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.newNotebook', async () => {
      const doc = await vscode.workspace.openNotebookDocument(
        'sql-notebook',
        new vscode.NotebookData([
          new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '-- Write your SQL query here\nSELECT 1 AS Hello;', 'sql')
        ])
      );
      await vscode.window.showNotebookDocument(doc);
    })
  );

  // Add Connection (webview form or import)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.addConnection', async () => {
      if (MssqlIntegration.isMssqlInstalled()) {
        const options: vscode.QuickPickItem[] = [
          { label: '$(edit) Enter Manually', description: 'Open connection form' },
          { label: '$(plug) Import from MSSQL Extension', description: 'Use ms-mssql.mssql connection dialog' }
        ];
        const choice = await vscode.window.showQuickPick(options, {
          placeHolder: 'How would you like to add a connection?'
        });
        if (!choice) { return; }
        if (choice.label.includes('Import')) {
          const profile = await connectionManager.importFromMssql();
          if (profile) {
            connectionManager.setActiveById(profile.id);
            vscode.window.showInformationMessage(`Imported "${profile.name}" from MSSQL extension.`);
          }
          return;
        }
      }
      ConnectionEditorPanel.show(context, connectionManager, 'add');
    })
  );

  // Edit Connection (webview form)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.editConnection', async (item: ObjectTreeItem) => {
      if (!item?.connectionId) { return; }
      const profile = connectionManager.get(item.connectionId);
      if (!profile) { return; }
      ConnectionEditorPanel.show(context, connectionManager, 'edit', profile);
    })
  );

  // Import from MSSQL
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.importFromMssql', async () => {
      const profile = await connectionManager.importFromMssql();
      if (profile) {
        connectionManager.setActiveById(profile.id);
        vscode.window.showInformationMessage(`Imported "${profile.name}" from MSSQL extension and set as active.`);
      }
    })
  );

  // Remove Connection
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.removeConnection', async (item: ObjectTreeItem) => {
      if (item?.connectionId) {
        const profile = connectionManager.get(item.connectionId);
        const confirm = await vscode.window.showWarningMessage(
          `Remove connection "${profile?.name || item.connectionId}"?`,
          { modal: true },
          'Remove'
        );
        if (confirm === 'Remove') {
          await connectionManager.removeConnection(item.connectionId);
        }
      }
    })
  );

  // Select Connection (quickpick)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.selectConnection', async () => {
      await connectionManager.selectConnection();
    })
  );

  // Set Active Connection (from tree click)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.setActiveConnection', async (item: ObjectTreeItem) => {
      if (item?.connectionId) {
        connectionManager.setActiveById(item.connectionId);
        const profile = connectionManager.get(item.connectionId);
        vscode.window.showInformationMessage(`Active connection: "${profile?.name}"`);
      }
    })
  );

  // Select Database (notebook toolbar + status bar)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.selectDatabase', async () => {
      const db = await connectionManager.selectDatabase();
      if (db) {
        vscode.window.showInformationMessage(`Active database: ${db}`);
      }
    })
  );

  // Use Database from tree (click on a database node)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.useDatabase', async (item: ObjectTreeItem) => {
      if (item?.database && item?.connectionId) {
        connectionManager.setActiveById(item.connectionId);
        connectionManager.setActiveDatabase(item.database);
        vscode.window.showInformationMessage(`Now using [${item.database}] on ${connectionManager.get(item.connectionId)?.name}`);
      }
    })
  );

  // Create Group
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.createGroup', async () => {
      await connectionManager.createGroup();
    })
  );

  // Rename Group
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.renameGroup', async (item: ObjectTreeItem) => {
      if (item?.group) {
        await connectionManager.renameGroup(item.group.id);
      }
    })
  );

  // Remove Group
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.removeGroup', async (item: ObjectTreeItem) => {
      if (item?.group) {
        const confirm = await vscode.window.showWarningMessage(
          `Remove group "${item.group.name}"? Connections will be ungrouped but not deleted.`,
          { modal: true },
          'Remove'
        );
        if (confirm === 'Remove') {
          await connectionManager.removeGroup(item.group.id);
        }
      }
    })
  );

  // Move Connection to Group
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.moveToGroup', async (item: ObjectTreeItem) => {
      if (item?.connectionId) {
        await connectionManager.moveToGroup(item.connectionId);
      }
    })
  );

  // Server Properties
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.serverProperties', async (item: ObjectTreeItem) => {
      if (!item?.connectionId) { return; }
      try {
        const props = await connectionManager.getServerProperties(item.connectionId);
        const profile = connectionManager.get(item.connectionId);
        const panel = vscode.window.createWebviewPanel(
          'sqlNotebook.serverProps',
          `Server Properties - ${profile?.name || item.connectionId}`,
          vscode.ViewColumn.One,
          {}
        );
        const rows = Object.entries(props).map(([k, v]) =>
          `<tr><td style="font-weight:bold;padding:4px 12px;border:1px solid var(--vscode-panel-border)">${k}</td><td style="padding:4px 12px;border:1px solid var(--vscode-panel-border)">${v}</td></tr>`
        ).join('');
        panel.webview.html = `<!DOCTYPE html>
<html><head><style>body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-editor-foreground);padding:16px}table{border-collapse:collapse;width:100%}th{text-align:left;padding:6px 12px;background:var(--vscode-editor-selectionBackground);border:1px solid var(--vscode-panel-border)}</style></head>
<body><h2>Server Properties</h2><table><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get server properties: ${msg}`);
      }
    })
  );

  // New Query Window for a specific connection
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.newQueryFromConnection', async (item: ObjectTreeItem) => {
      if (!item?.connectionId) { return; }
      connectionManager.setActiveById(item.connectionId);
      const profile = connectionManager.get(item.connectionId);
      const db = connectionManager.getActiveDatabase();
      const header = `-- Server: ${profile?.server}:${profile?.port}\n-- Database: ${db || profile?.database}\n-- Connection: ${profile?.name}\n\n`;
      const doc = await vscode.workspace.openTextDocument({ language: 'sql', content: header });
      await vscode.window.showTextDocument(doc);
    })
  );

  // New Notebook from a specific connection
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.newNotebookFromConnection', async (item: ObjectTreeItem) => {
      if (!item?.connectionId) { return; }
      connectionManager.setActiveById(item.connectionId);
      const profile = connectionManager.get(item.connectionId);
      const db = item.database || connectionManager.getActiveDatabase() || profile?.database || '';
      if (item.database) {
        connectionManager.setActiveDatabase(item.database);
      }
      const doc = await vscode.workspace.openNotebookDocument(
        'sql-notebook',
        new vscode.NotebookData([
          new vscode.NotebookCellData(
            vscode.NotebookCellKind.Markup,
            `# ${profile?.name}\n**Server:** ${profile?.server}:${profile?.port}  \n**Database:** ${db}`,
            'markdown'
          ),
          new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            `-- Connected to [${db}] on ${profile?.server}\nSELECT @@VERSION AS [SQL Server Version];`,
            'sql'
          )
        ])
      );
      await vscode.window.showNotebookDocument(doc);
    })
  );

  // Add Connection to Group (opens form with group pre-assigned)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.addConnectionToGroup', async (item: ObjectTreeItem) => {
      if (!item?.group) { return; }
      ConnectionEditorPanel.show(context, connectionManager, 'add', undefined, item.group.id);
    })
  );

  // New Query from Group (multi-connection: one tab per connection in group)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.newQueryFromGroup', async (item: ObjectTreeItem) => {
      if (!item?.group) { return; }
      const connections = connectionManager.getConnectionsInGroup(item.group.id);
      if (connections.length === 0) {
        vscode.window.showWarningMessage(`No connections in group "${item.group.name}".`);
        return;
      }
      for (const conn of connections) {
        connectionManager.setActiveById(conn.id);
        const db = connectionManager.getActiveDatabase();
        const header = `-- Server: ${conn.server}:${conn.port}\n-- Database: ${db || conn.database}\n-- Connection: ${conn.name}\n-- Group: ${item.group.name}\n\n`;
        const doc = await vscode.workspace.openTextDocument({ language: 'sql', content: header });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
      vscode.window.showInformationMessage(`Opened ${connections.length} query tab(s) for group "${item.group.name}".`);
    })
  );

  // New Notebook from Group (multi-connection: one cell per connection)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.newNotebookFromGroup', async (item: ObjectTreeItem) => {
      if (!item?.group) { return; }
      const connections = connectionManager.getConnectionsInGroup(item.group.id);
      if (connections.length === 0) {
        vscode.window.showWarningMessage(`No connections in group "${item.group.name}".`);
        return;
      }

      const cells: vscode.NotebookCellData[] = [
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          `# ${item.group.name}\n\nGroup notebook with ${connections.length} connection(s):\n${connections.map(c => `- **${c.name}** (${c.server}:${c.port} / ${c.database})`).join('\n')}`,
          'markdown'
        )
      ];

      for (const conn of connections) {
        cells.push(
          new vscode.NotebookCellData(
            vscode.NotebookCellKind.Markup,
            `## ${conn.name}\n**Server:** ${conn.server}:${conn.port} | **Database:** ${conn.database}`,
            'markdown'
          ),
          new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            `-- Connection: ${conn.name} (${conn.server})\n-- Switch active connection before running:\n--   Use command: SQL Notebook: Select Active Connection\nSELECT @@SERVERNAME AS [Server], DB_NAME() AS [Database];`,
            'sql'
          )
        );
      }

      // Set first connection as active
      connectionManager.setActiveById(connections[0].id);

      const doc = await vscode.workspace.openNotebookDocument(
        'sql-notebook',
        new vscode.NotebookData(cells)
      );
      await vscode.window.showNotebookDocument(doc);
      vscode.window.showInformationMessage(
        `Notebook created with ${connections.length} connection(s). Active: "${connections[0].name}". Switch connections via status bar or command palette.`
      );
    })
  );

  // Show Connection Info (editor title button - opens quick pick to change)
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.showConnectionInfo', async () => {
      const active = connectionManager.getActiveConnection();
      const db = connectionManager.getActiveDatabase();
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(server) Change Connection',
          description: active ? `Current: ${active.name}` : 'None selected'
        },
        {
          label: '$(database) Change Database',
          description: db ? `Current: ${db}` : active ? `Current: ${active.database}` : 'No connection'
        }
      ];
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: active ? `${active.name} | ${db || active.database}` : 'No active connection'
      });
      if (!picked) { return; }
      if (picked.label.includes('Connection')) {
        await vscode.commands.executeCommand('sqlNotebook.selectConnection');
      } else {
        await vscode.commands.executeCommand('sqlNotebook.selectDatabase');
      }
    })
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebook.refreshConnections', () => {
      treeProvider.refresh();
    })
  );

  context.subscriptions.push({
    dispose: () => {
      controller.dispose();
      jupyterKernel.dispose();
      treeProvider.dispose();
      connectionManager.dispose();
    }
  });
}

export function deactivate(): void {
  jupyterKernel?.dispose();
  controller?.dispose();
  connectionManager?.dispose();
}
