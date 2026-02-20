import * as sql from 'mssql';
import { ConnectionManager } from './connectionManager';
import { SqlResultSet, ColumnInfo, SqlMessage } from './types';

export class QueryExecutor {
  constructor(private readonly connectionManager: ConnectionManager) {}

  async execute(connectionId: string, query: string): Promise<{ resultSets: SqlResultSet[]; messages: SqlMessage[] }> {
    const pool = await this.connectionManager.getPool(connectionId);
    const start = Date.now();
    const request = pool.request();

    const messages: SqlMessage[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = request as any;
    if (typeof req.on === 'function') {
      req.on('info', (info: { message: string; number?: number; class?: number }) => {
        const severity = (info.class && info.class > 10) ? 'warning' : 'info';
        messages.push({ text: info.message, type: severity });
      });
      req.on('error', (err: Error) => {
        messages.push({ text: err.message, type: 'error' });
      });
    }

    const result = await request.query(query);
    const elapsed = Date.now() - start;

    const resultSets: SqlResultSet[] = [];

    for (const recordset of result.recordsets) {
      const columns: ColumnInfo[] = Object.entries(recordset.columns).map(
        ([name, col]: [string, sql.IColumnMetadata]) => ({
          name,
          type: col.type?.declaration ?? 'unknown'
        })
      );

      if (columns.length === 0) { continue; }

      const rows = recordset.map((row: Record<string, unknown>) => {
        const clean: Record<string, unknown> = {};
        for (const col of columns) {
          clean[col.name] = row[col.name];
        }
        return clean;
      });

      resultSets.push({
        columns,
        rows,
        rowCount: recordset.length,
        executionTime: elapsed,
        messages: []
      });
    }

    if (resultSets.length === 0) {
      resultSets.push({
        columns: [],
        rows: [],
        rowCount: result.rowsAffected.reduce((a: number, b: number) => a + b, 0),
        executionTime: elapsed,
        messages: []
      });
    }

    // Add row count messages
    for (const affected of result.rowsAffected) {
      if (affected > 0) {
        messages.push({ text: `(${affected} row(s) affected)`, type: 'info' });
      }
    }

    return { resultSets, messages };
  }
}
