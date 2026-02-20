import * as vscode from 'vscode';
import { SqlJupyterKernel } from './jupyterKernel';
import { ConnectionManager } from './connectionManager';

let connectionManager: ConnectionManager;
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
}

export function activate(context: vscode.ExtensionContext): void {
  connectionManager = new ConnectionManager(context);
  jupyterKernel = new SqlJupyterKernel(connectionManager);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  statusBarItem.command = 'sqlNotebookKernel.selectConnection';
  context.subscriptions.push(statusBarItem);

  dbStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  dbStatusBarItem.command = 'sqlNotebookKernel.selectDatabase';
  context.subscriptions.push(dbStatusBarItem);

  connectionManager.onDidChangeConnections(() => {
    updateStatusBar();
    jupyterKernel.updateLabel(connectionManager);
  });
  updateStatusBar();

  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebookKernel.addConnection', async () => {
      const profile = await connectionManager.addConnection();
      if (profile) {
        connectionManager.setActiveById(profile.id);
        vscode.window.showInformationMessage(`Connection "${profile.name}" added and set as active.`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebookKernel.selectConnection', async () => {
      await connectionManager.selectConnection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sqlNotebookKernel.selectDatabase', async () => {
      const db = await connectionManager.selectDatabase();
      if (db) {
        vscode.window.showInformationMessage(`Active database: ${db}`);
      }
    })
  );

  context.subscriptions.push({
    dispose: () => {
      jupyterKernel.dispose();
      connectionManager.dispose();
    }
  });
}

export function deactivate(): void {
  jupyterKernel?.dispose();
  connectionManager?.dispose();
}
