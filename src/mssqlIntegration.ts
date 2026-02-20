import * as vscode from 'vscode';
import { ConnectionProfile } from './types';

const MSSQL_EXTENSION_ID = 'ms-mssql.mssql';

interface MssqlConnectionInfo {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  authenticationType: string;
  encrypt: string | boolean;
  trustServerCertificate: boolean | undefined;
  connectionString: string | undefined;
}

interface MssqlExtensionApi {
  promptForConnection(ignoreFocusOut?: boolean): Promise<MssqlConnectionInfo | undefined>;
  connect(connectionInfo: MssqlConnectionInfo, saveConnection?: boolean): Promise<string>;
  listDatabases(connectionUri: string): Promise<string[]>;
}

export class MssqlIntegration {

  static isMssqlInstalled(): boolean {
    return vscode.extensions.getExtension(MSSQL_EXTENSION_ID) !== undefined;
  }

  static async getApi(): Promise<MssqlExtensionApi | undefined> {
    const ext = vscode.extensions.getExtension(MSSQL_EXTENSION_ID);
    if (!ext) { return undefined; }
    if (!ext.isActive) {
      await ext.activate();
    }
    return ext.exports as MssqlExtensionApi;
  }

  static async importConnection(): Promise<ConnectionProfile | undefined> {
    const api = await this.getApi();
    if (!api) {
      const install = await vscode.window.showWarningMessage(
        'The MSSQL extension (ms-mssql.mssql) is not installed. Install it to import connections.',
        'Install Extension',
        'Cancel'
      );
      if (install === 'Install Extension') {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', MSSQL_EXTENSION_ID);
      }
      return undefined;
    }

    const connInfo = await api.promptForConnection(true);
    if (!connInfo) { return undefined; }

    const name = `${connInfo.server}/${connInfo.database}`;
    const port = connInfo.port || 1433;
    const authType = connInfo.authenticationType === 'SqlLogin' ? 'sql' : 'windows';
    const encrypt = typeof connInfo.encrypt === 'boolean' ? connInfo.encrypt : connInfo.encrypt !== 'Optional';

    const profile: ConnectionProfile = {
      id: `mssql_${Date.now()}`,
      name,
      server: connInfo.server,
      port,
      database: connInfo.database,
      authenticationType: authType,
      user: connInfo.user || undefined,
      password: connInfo.password || undefined,
      encrypt,
      trustServerCertificate: connInfo.trustServerCertificate ?? true,
      source: 'mssql'
    };

    return profile;
  }
}
