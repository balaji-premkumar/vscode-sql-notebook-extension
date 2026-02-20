import * as sql from 'mssql';
import { ConnectionManager } from './connectionManager';
import { SqlResultSet, ColumnInfo } from './types';

export class QueryExecutor {
  constructor(private readonly connectionManager: ConnectionManager) {}

  async execute(connectionId: string, query: string): Promise<SqlResultSet[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const start = Date.now();
    const request = pool.request();

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
        executionTime: elapsed
      });
    }

    if (resultSets.length === 0) {
      resultSets.push({
        columns: [],
        rows: [],
        rowCount: result.rowsAffected.reduce((a: number, b: number) => a + b, 0),
        executionTime: elapsed
      });
    }

    return resultSets;
  }
}
