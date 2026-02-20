import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { QueryExecutor } from './queryExecutor';
import { SqlResultSet } from './types';

export class SqlJupyterKernel {
  private readonly controllerId = 'sql-notebook-jupyter-kernel';
  private readonly label = 'SQL (SQL Notebook)';
  private readonly supportedLanguages = ['sql'];
  private readonly controller: vscode.NotebookController;
  private readonly queryExecutor: QueryExecutor;

  constructor(private readonly connectionManager: ConnectionManager) {
    this.queryExecutor = new QueryExecutor(connectionManager);

    this.controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      'jupyter-notebook',
      this.label
    );

    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.description = 'Execute SQL queries via SQL Notebook connections';
    this.controller.executeHandler = this.executeAll.bind(this);
    this.updateLabel(connectionManager);
  }

  updateLabel(cm: ConnectionManager): void {
    const active = cm.getActiveConnection();
    const db = cm.getActiveDatabase();
    if (active) {
      this.controller.label = `SQL (SQL Notebook)`;
      this.controller.detail = `${active.name} | ${db || active.database}`;
    } else {
      this.controller.label = 'SQL (SQL Notebook)';
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
            new Error('No active SQL connection. Use "SQL Notebook: Select Connection" from the command palette or the sidebar.')
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
      const results = await this.queryExecutor.execute(connectionId, query);
      const connProfile = this.connectionManager.getActiveConnection();
      const connLabel = connProfile ? `${connProfile.name} (${connProfile.server})` : '';
      const dbLabel = activeDb || connProfile?.database || '';
      const outputs = results.map(rs => this.resultToOutput(rs, connLabel, dbLabel));
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

  private resultToOutput(result: SqlResultSet, connLabel: string, dbLabel: string): vscode.NotebookCellOutput {
    const contextText = connLabel ? `[${connLabel} / ${dbLabel}] ` : '';

    if (result.columns.length === 0) {
      return new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.text(
          `${contextText}Query executed successfully. ${result.rowCount} row(s) affected. (${result.executionTime}ms)`
        )
      ]);
    }

    const tableData = result.rows.map(row => {
      const clean: Record<string, unknown> = {};
      for (const col of result.columns) {
        clean[col.name] = row[col.name] ?? null;
      }
      return clean;
    });

    const meta = `${contextText}${result.rowCount} row(s) returned in ${result.executionTime}ms`;

    return new vscode.NotebookCellOutput([
      vscode.NotebookCellOutputItem.json(tableData, 'application/json'),
      vscode.NotebookCellOutputItem.text(
        `${meta}\n\n${this.renderPlainText(result)}`,
        'text/plain'
      )
    ]);
  }

  private renderPlainText(result: SqlResultSet): string {
    const header = result.columns.map(c => c.name).join('\t');
    const rows = result.rows.map(row =>
      result.columns.map(col => String(row[col.name] ?? 'NULL')).join('\t')
    ).join('\n');
    return `${header}\n${rows}`;
  }

  dispose(): void {
    this.controller.dispose();
  }
}
