import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { QueryExecutor } from './queryExecutor';
import { SqlResultSet } from './types';

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

  private resultToOutput(result: SqlResultSet, connLabel: string = '', dbLabel: string = ''): vscode.NotebookCellOutput {
    const contextLine = connLabel ? `<div class="sql-context">$(server) ${this.escapeHtml(connLabel)} | $(database) ${this.escapeHtml(dbLabel)}</div>` : '';
    const contextText = connLabel ? `[${connLabel} / ${dbLabel}] ` : '';

    if (result.columns.length === 0) {
      return new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.text(
          `${contextText}Query executed successfully. ${result.rowCount} row(s) affected. (${result.executionTime}ms)`
        )
      ]);
    }

    const htmlTable = this.renderHtmlTable(result, contextLine);
    const jsonData = JSON.stringify(result);

    return new vscode.NotebookCellOutput([
      vscode.NotebookCellOutputItem.text(htmlTable, 'text/html'),
      new vscode.NotebookCellOutputItem(
        new TextEncoder().encode(jsonData),
        'x-application/sql-notebook-result'
      ),
      vscode.NotebookCellOutputItem.text(this.renderPlainText(result), 'text/plain')
    ]);
  }

  private renderHtmlTable(result: SqlResultSet, contextLine: string = ''): string {
    const headerCells = result.columns.map(c => `<th>${this.escapeHtml(c.name)}</th>`).join('');
    const bodyRows = result.rows.map(row => {
      const cells = result.columns.map(col => {
        const val = row[col.name];
        const display = val === null ? '<em>NULL</em>' : this.escapeHtml(String(val));
        return `<td>${display}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');

    return `
<style>
  .sql-result { border-collapse: collapse; width: 100%; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .sql-result th { background: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-foreground); padding: 6px 12px; text-align: left; border: 1px solid var(--vscode-panel-border); }
  .sql-result td { padding: 4px 12px; border: 1px solid var(--vscode-panel-border); color: var(--vscode-editor-foreground); }
  .sql-result tr:nth-child(even) { background: var(--vscode-editor-selectionBackground, rgba(0,0,0,0.04)); }
  .sql-meta { margin-top: 6px; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
  .sql-context { margin-bottom: 6px; font-size: 0.85em; color: var(--vscode-descriptionForeground); padding: 4px 8px; background: var(--vscode-editor-selectionBackground); border-radius: 3px; display: inline-block; }
</style>
${contextLine}
<table class="sql-result">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="sql-meta">${result.rowCount} row(s) returned in ${result.executionTime}ms</div>`;
  }

  private renderPlainText(result: SqlResultSet): string {
    const header = result.columns.map(c => c.name).join('\t');
    const rows = result.rows.map(row =>
      result.columns.map(col => String(row[col.name] ?? 'NULL')).join('\t')
    ).join('\n');
    return `${header}\n${rows}\n\n${result.rowCount} row(s) - ${result.executionTime}ms`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  dispose(): void {
    this.controller.dispose();
  }
}
