import * as vscode from 'vscode';
import { SqlNotebookDocument, NotebookCellData } from './types';

export class SqlNotebookSerializer implements vscode.NotebookSerializer {

  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): Promise<vscode.NotebookData> {
    const text = new TextDecoder().decode(content);

    let doc: SqlNotebookDocument;
    try {
      doc = text.length > 0 ? JSON.parse(text) : { cells: [] };
    } catch {
      doc = { cells: [] };
    }

    const cells = doc.cells.map((cell: NotebookCellData) => {
      const kind = cell.kind === 'markup'
        ? vscode.NotebookCellKind.Markup
        : vscode.NotebookCellKind.Code;
      const language = cell.kind === 'markup' ? 'markdown' : (cell.language || 'sql');
      return new vscode.NotebookCellData(kind, cell.value, language);
    });

    const notebookData = new vscode.NotebookData(cells);
    notebookData.metadata = doc.metadata;
    return notebookData;
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken
  ): Promise<Uint8Array> {
    const cells: NotebookCellData[] = data.cells.map(cell => ({
      kind: cell.kind === vscode.NotebookCellKind.Markup ? 'markup' : 'code',
      language: cell.languageId,
      value: cell.value
    }));

    const doc: SqlNotebookDocument = {
      cells,
      metadata: data.metadata as SqlNotebookDocument['metadata']
    };

    return new TextEncoder().encode(JSON.stringify(doc, null, 2));
  }
}
