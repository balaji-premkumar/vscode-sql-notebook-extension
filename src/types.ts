export interface ConnectionProfile {
  id: string;
  name: string;
  server: string;
  port: number;
  database: string;
  authenticationType: 'sql' | 'windows';
  user?: string;
  password?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  source?: 'local' | 'mssql';
  groupId?: string;
}

export interface ServerGroup {
  id: string;
  name: string;
}

export type ObjectNodeType =
  | 'group'
  | 'connection'
  | 'databasesFolder'
  | 'database'
  | 'tablesFolder'
  | 'table'
  | 'viewsFolder'
  | 'view'
  | 'storedProceduresFolder'
  | 'storedProcedure'
  | 'functionsFolder'
  | 'function'
  | 'columnsFolder'
  | 'column';

export interface DbObjectInfo {
  schema: string;
  name: string;
  type: string;
}

export interface SqlResultSet {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface NotebookCellData {
  kind: 'code' | 'markup';
  language: string;
  value: string;
  outputs?: NotebookCellOutputData[];
}

export interface NotebookCellOutputData {
  mime: string;
  data: unknown;
}

export interface SqlNotebookDocument {
  cells: NotebookCellData[];
  metadata?: {
    connectionId?: string;
    [key: string]: unknown;
  };
}
