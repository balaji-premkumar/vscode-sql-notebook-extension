declare module 'mssql' {
  export interface config {
    server: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    requestTimeout?: number;
    connectionTimeout?: number;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
    };
    authentication?: {
      type: string;
      options: {
        domain: string;
        userName: string;
        password: string;
      };
    };
  }

  export interface IColumnMetadata {
    type?: { declaration?: string };
    nullable?: boolean;
    length?: number;
  }

  export interface IRecordSet<T> extends Array<T> {
    columns: Record<string, IColumnMetadata>;
  }

  export interface IResult<T> {
    recordsets: IRecordSet<T>[];
    recordset: IRecordSet<T>;
    rowsAffected: number[];
    output: Record<string, unknown>;
  }

  export interface Request {
    query<T = Record<string, unknown>>(command: string): Promise<IResult<T>>;
  }

  export class ConnectionPool {
    connected: boolean;
    constructor(config: config);
    connect(): Promise<this>;
    close(): Promise<void>;
    request(): Request;
  }
}
