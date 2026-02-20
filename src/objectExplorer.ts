import { ConnectionManager } from './connectionManager';
import { DbObjectInfo } from './types';

export class ObjectExplorer {
  constructor(private readonly connectionManager: ConnectionManager) {}

  async getDatabases(connectionId: string): Promise<string[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const result = await pool.request().query(
      `SELECT name FROM sys.databases ORDER BY name`
    );
    return result.recordset.map((r: Record<string, unknown>) => r['name'] as string);
  }

  async getTables(connectionId: string, database: string): Promise<DbObjectInfo[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const result = await pool.request().query(
      `USE [${database}]; SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name], TABLE_TYPE AS [type] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`
    );
    return result.recordset.map((r: Record<string, unknown>) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as string
    }));
  }

  async getViews(connectionId: string, database: string): Promise<DbObjectInfo[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const result = await pool.request().query(
      `USE [${database}]; SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name], 'VIEW' AS [type] FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME`
    );
    return result.recordset.map((r: Record<string, unknown>) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as string
    }));
  }

  async getStoredProcedures(connectionId: string, database: string): Promise<DbObjectInfo[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const result = await pool.request().query(
      `USE [${database}]; SELECT ROUTINE_SCHEMA AS [schema], ROUTINE_NAME AS [name], ROUTINE_TYPE AS [type] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME`
    );
    return result.recordset.map((r: Record<string, unknown>) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as string
    }));
  }

  async getFunctions(connectionId: string, database: string): Promise<DbObjectInfo[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const result = await pool.request().query(
      `USE [${database}]; SELECT ROUTINE_SCHEMA AS [schema], ROUTINE_NAME AS [name], ROUTINE_TYPE AS [type] FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME`
    );
    return result.recordset.map((r: Record<string, unknown>) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as string
    }));
  }

  async getColumns(connectionId: string, database: string, schema: string, tableName: string): Promise<DbObjectInfo[]> {
    const pool = await this.connectionManager.getPool(connectionId);
    const safeSchema = schema.replace(/'/g, "''");
    const safeTable = tableName.replace(/'/g, "''");
    const result = await pool.request().query(
      `USE [${database}]; SELECT COLUMN_NAME AS [name], DATA_TYPE + CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' WHEN NUMERIC_PRECISION IS NOT NULL THEN '(' + CAST(NUMERIC_PRECISION AS VARCHAR) + ',' + CAST(NUMERIC_SCALE AS VARCHAR) + ')' ELSE '' END AS [type], COLUMN_NAME AS [schema] FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${safeSchema}' AND TABLE_NAME = '${safeTable}' ORDER BY ORDINAL_POSITION`
    );
    return result.recordset.map((r: Record<string, unknown>) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as string
    }));
  }
}
