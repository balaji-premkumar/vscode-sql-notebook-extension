import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { ObjectExplorer } from './objectExplorer';
import { ConnectionProfile, ServerGroup, ObjectNodeType, DbObjectInfo } from './types';

const CONNECTION_MIME = 'application/vnd.sqlnotebook.connection';

export class ObjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly nodeType: ObjectNodeType,
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    public readonly connectionId?: string,
    public readonly database?: string,
    public readonly schema?: string,
    public readonly objectName?: string,
    public readonly profile?: ConnectionProfile,
    public readonly group?: ServerGroup
  ) {
    super(label, collapsible);
    this.contextValue = nodeType;
    this.setIcon();
  }

  private setIcon(): void {
    const icons: Record<string, string> = {
      group: 'folder',
      connection: 'server',
      databasesFolder: 'folder-library',
      database: 'database',
      tablesFolder: 'folder',
      table: 'symbol-class',
      viewsFolder: 'folder',
      view: 'eye',
      storedProceduresFolder: 'folder',
      storedProcedure: 'symbol-method',
      functionsFolder: 'folder',
      function: 'symbol-function',
      columnsFolder: 'folder',
      column: 'symbol-field'
    };
    const iconName = icons[this.nodeType] || 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
  }
}

export class ConnectionTreeDragAndDropController implements vscode.TreeDragAndDropController<ObjectTreeItem> {
  readonly dropMimeTypes = [CONNECTION_MIME];
  readonly dragMimeTypes = [CONNECTION_MIME];

  constructor(private readonly connectionManager: ConnectionManager) {}

  handleDrag(source: readonly ObjectTreeItem[], dataTransfer: vscode.DataTransfer): void {
    const connections = source.filter(s => s.nodeType === 'connection' && s.connectionId);
    if (connections.length > 0) {
      const ids = connections.map(c => c.connectionId!);
      dataTransfer.set(CONNECTION_MIME, new vscode.DataTransferItem(JSON.stringify(ids)));
    }
  }

  async handleDrop(target: ObjectTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const raw = dataTransfer.get(CONNECTION_MIME);
    if (!raw) { return; }

    const connectionIds: string[] = JSON.parse(raw.value as string);
    let targetGroupId: string | undefined;

    if (target?.nodeType === 'group' && target.group) {
      targetGroupId = target.group.id;
    } else if (target?.nodeType === 'connection' && target.profile?.groupId) {
      targetGroupId = target.profile.groupId;
    } else {
      targetGroupId = undefined;
    }

    for (const connId of connectionIds) {
      await this.connectionManager.setConnectionGroup(connId, targetGroupId);
    }
  }
}

export class ConnectionTreeProvider implements vscode.TreeDataProvider<ObjectTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ObjectTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly objectExplorer: ObjectExplorer;

  constructor(private readonly connectionManager: ConnectionManager) {
    this.objectExplorer = new ObjectExplorer(connectionManager);
    connectionManager.onDidChangeConnections(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ObjectTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ObjectTreeItem): Promise<ObjectTreeItem[]> {
    if (!element) {
      return this.getRootNodes();
    }

    switch (element.nodeType) {
      case 'group':
        return this.getGroupChildren(element.group!);
      case 'connection':
        return this.getConnectionChildren(element);
      case 'databasesFolder':
        return this.getDatabaseNodes(element.connectionId!);
      case 'database':
        return this.getDatabaseFolders(element.connectionId!, element.database!);
      case 'tablesFolder':
        return this.getTableNodes(element.connectionId!, element.database!);
      case 'viewsFolder':
        return this.getViewNodes(element.connectionId!, element.database!);
      case 'storedProceduresFolder':
        return this.getStoredProcedureNodes(element.connectionId!, element.database!);
      case 'functionsFolder':
        return this.getFunctionNodes(element.connectionId!, element.database!);
      case 'table':
      case 'view':
        return this.getColumnNodes(element.connectionId!, element.database!, element.schema!, element.objectName!);
      default:
        return [];
    }
  }

  private getRootNodes(): ObjectTreeItem[] {
    const groups = this.connectionManager.getGroups();
    const connections = this.connectionManager.getAll();
    const activeId = this.connectionManager.getActiveConnectionId();
    const items: ObjectTreeItem[] = [];

    for (const group of groups) {
      const item = new ObjectTreeItem(
        'group', group.name, vscode.TreeItemCollapsibleState.Expanded,
        undefined, undefined, undefined, undefined, undefined, group
      );
      items.push(item);
    }

    const ungrouped = connections.filter(c => !c.groupId);
    for (const conn of ungrouped) {
      items.push(this.createConnectionNode(conn, activeId));
    }

    return items;
  }

  private getGroupChildren(group: ServerGroup): ObjectTreeItem[] {
    const connections = this.connectionManager.getAll().filter(c => c.groupId === group.id);
    const activeId = this.connectionManager.getActiveConnectionId();
    return connections.map(c => this.createConnectionNode(c, activeId));
  }

  private createConnectionNode(conn: ConnectionProfile, activeId: string | undefined): ObjectTreeItem {
    const isActive = conn.id === activeId;
    const label = conn.name;
    const item = new ObjectTreeItem(
      'connection', label, vscode.TreeItemCollapsibleState.Collapsed,
      conn.id, conn.database, undefined, undefined, conn
    );
    item.description = `${conn.server}:${conn.port}`;
    item.tooltip = `${conn.name}\n${conn.server}:${conn.port}\nDefault DB: ${conn.database}\nAuth: ${conn.authenticationType}`;

    item.command = {
      command: 'sqlNotebook.setActiveConnection',
      title: 'Set as Active Connection',
      arguments: [item]
    };

    if (isActive) {
      item.iconPath = new vscode.ThemeIcon('server-process', new vscode.ThemeColor('charts.green'));
      item.description += ' (active)';
    }

    return item;
  }

  private getConnectionChildren(element: ObjectTreeItem): ObjectTreeItem[] {
    return [
      new ObjectTreeItem(
        'databasesFolder', 'Databases',
        vscode.TreeItemCollapsibleState.Collapsed,
        element.connectionId
      )
    ];
  }

  private async getDatabaseNodes(connectionId: string): Promise<ObjectTreeItem[]> {
    try {
      const databases = await this.objectExplorer.getDatabases(connectionId);
      return databases.map(db =>
        new ObjectTreeItem(
          'database', db,
          vscode.TreeItemCollapsibleState.Collapsed,
          connectionId, db
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return [new ObjectTreeItem('database', `Error: ${msg}`, vscode.TreeItemCollapsibleState.None)];
    }
  }

  private getDatabaseFolders(connectionId: string, database: string): ObjectTreeItem[] {
    return [
      new ObjectTreeItem('tablesFolder', 'Tables', vscode.TreeItemCollapsibleState.Collapsed, connectionId, database),
      new ObjectTreeItem('viewsFolder', 'Views', vscode.TreeItemCollapsibleState.Collapsed, connectionId, database),
      new ObjectTreeItem('storedProceduresFolder', 'Stored Procedures', vscode.TreeItemCollapsibleState.Collapsed, connectionId, database),
      new ObjectTreeItem('functionsFolder', 'Functions', vscode.TreeItemCollapsibleState.Collapsed, connectionId, database)
    ];
  }

  private async getObjectNodes(
    nodeType: ObjectNodeType,
    fetcher: () => Promise<DbObjectInfo[]>,
    connectionId: string,
    database: string
  ): Promise<ObjectTreeItem[]> {
    try {
      const objects = await fetcher();
      const collapsible = (nodeType === 'table' || nodeType === 'view')
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      return objects.map(obj => {
        const item = new ObjectTreeItem(
          nodeType, `${obj.schema}.${obj.name}`,
          collapsible,
          connectionId, database, obj.schema, obj.name
        );
        item.tooltip = `${obj.schema}.${obj.name}`;
        return item;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return [new ObjectTreeItem(nodeType, `Error: ${msg}`, vscode.TreeItemCollapsibleState.None)];
    }
  }

  private getTableNodes(connectionId: string, database: string): Promise<ObjectTreeItem[]> {
    return this.getObjectNodes('table', () => this.objectExplorer.getTables(connectionId, database), connectionId, database);
  }

  private getViewNodes(connectionId: string, database: string): Promise<ObjectTreeItem[]> {
    return this.getObjectNodes('view', () => this.objectExplorer.getViews(connectionId, database), connectionId, database);
  }

  private getStoredProcedureNodes(connectionId: string, database: string): Promise<ObjectTreeItem[]> {
    return this.getObjectNodes('storedProcedure', () => this.objectExplorer.getStoredProcedures(connectionId, database), connectionId, database);
  }

  private getFunctionNodes(connectionId: string, database: string): Promise<ObjectTreeItem[]> {
    return this.getObjectNodes('function', () => this.objectExplorer.getFunctions(connectionId, database), connectionId, database);
  }

  private async getColumnNodes(connectionId: string, database: string, schema: string, tableName: string): Promise<ObjectTreeItem[]> {
    try {
      const columns = await this.objectExplorer.getColumns(connectionId, database, schema, tableName);
      return columns.map(col => {
        const item = new ObjectTreeItem(
          'column', col.name,
          vscode.TreeItemCollapsibleState.None,
          connectionId, database, schema, tableName
        );
        item.description = col.type;
        item.tooltip = `${col.name} (${col.type})`;
        return item;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return [new ObjectTreeItem('column', `Error: ${msg}`, vscode.TreeItemCollapsibleState.None)];
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
