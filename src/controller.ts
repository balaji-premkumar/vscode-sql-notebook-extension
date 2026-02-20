import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { QueryExecutor } from './queryExecutor';
import { SqlResultSet, SqlMessage } from './types';
import { renderResultHtml } from './resultRenderer';

export class SqlNotebookController {
  private readonly controllerId = 'sql-notebook-kernel';
  private readonly label = 'SQL';
  private readonly supportedLanguages = ['sql'];
  private readonly controller: vscode.NotebookController;
  private readonly queryExecutor: QueryExecutor;

  constructor(private readonly connectionManager: ConnectionManager) {
    this.queryExecutor = new QueryExecutor(connectionManager);

    this.controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      'sql-notebook',
      this.label
    );

    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.executeAll.bind(this);
    this.updateLabel(connectionManager);
  }

  updateLabel(cm: ConnectionManager): void {
    const active = cm.getActiveConnection();
    const db = cm.getActiveDatabase();
    if (active) {
      this.controller.label = `SQL`;
      this.controller.detail = `${active.name} | ${db || active.database}`;
    } else {
      this.controller.label = 'SQL';
      this.controller.detail = 'No connection selected';
    }
  }

  private async executeAll(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): Promise<void> {
    for (const cell of cells) {
      await this.executeCell(cell);
    }
  }

  private async executeCell(cell: vscode.NotebookCell): Promise<void> {
    const execution = this.controller.createNotebookCellExecution(cell);
    execution.executionOrder = Date.now();
    execution.start(Date.now());

    const connectionId = this.connectionManager.getActiveConnectionId();
    if (!connectionId) {
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(
            new Error('No active connection. Use "SQL Notebook: Select Connection" or add one from the sidebar.')
          )
        ])
      ]);
      execution.end(false, Date.now());
      return;
    }

    const rawQuery = cell.document.getText().trim();
    if (!rawQuery) {
      execution.replaceOutput([]);
      execution.end(true, Date.now());
      return;
    }

    const activeDb = this.connectionManager.getActiveDatabase();
    const query = activeDb ? `USE [${activeDb}];\n${rawQuery}` : rawQuery;

    try {
      const { resultSets, messages } = await this.queryExecutor.execute(connectionId, query);
      const connProfile = this.connectionManager.getActiveConnection();
      const connLabel = connProfile ? `${connProfile.name} (${connProfile.server})` : '';
      const dbLabel = activeDb || connProfile?.database || '';
      const outputs = resultSets.map(rs => this.resultToOutput(rs, connLabel, dbLabel, messages));
      execution.replaceOutput(outputs);
      execution.end(true, Date.now());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(new Error(message))
        ])
      ]);
      execution.end(false, Date.now());
    }
  }

  private resultToOutput(result: SqlResultSet, connLabel: string, dbLabel: string, messages: SqlMessage[]): vscode.NotebookCellOutput {
    const html = renderResultHtml(result, connLabel, dbLabel, messages);
    return new vscode.NotebookCellOutput([
      vscode.NotebookCellOutputItem.text(html, 'text/html')
    ]);
  }

  dispose(): void {
    this.controller.dispose();
  }
}
