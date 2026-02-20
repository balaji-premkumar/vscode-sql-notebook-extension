import { SqlResultSet, SqlMessage } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderResultHtml(
  result: SqlResultSet,
  connLabel: string,
  dbLabel: string,
  messages: SqlMessage[]
): string {
  const contextText = connLabel ? `${connLabel} / ${dbLabel}` : '';

  if (result.columns.length === 0) {
    const statusMsg = `Query executed successfully. ${result.rowCount} row(s) affected. (${result.executionTime}ms)`;
    return `<div style="font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size);color:var(--vscode-editor-foreground)">
      ${contextText ? `<div style="margin-bottom:6px;font-size:0.85em;color:var(--vscode-descriptionForeground)">${escapeHtml(contextText)}</div>` : ''}
      <div style="padding:4px 0">${escapeHtml(statusMsg)}</div>
      ${renderMessages(messages)}
    </div>`;
  }

  const jsonData = JSON.stringify(
    result.rows.map(row => {
      const clean: Record<string, unknown> = {};
      for (const col of result.columns) {
        clean[col.name] = row[col.name] ?? null;
      }
      return clean;
    }),
    null,
    2
  );

  const uid = 'r' + Math.random().toString(36).substring(2, 9);

  return `<div id="${uid}" style="font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size);color:var(--vscode-editor-foreground)">
<style>
  #${uid} .sql-toolbar { display:flex; align-items:center; gap:4px; margin-bottom:6px; }
  #${uid} .sql-toolbar button {
    background:var(--vscode-button-secondaryBackground, #3a3d41);
    color:var(--vscode-button-secondaryForeground, #ccc);
    border:1px solid var(--vscode-button-border, transparent);
    padding:2px 10px; cursor:pointer; font-size:0.85em; border-radius:3px;
  }
  #${uid} .sql-toolbar button:hover { background:var(--vscode-button-secondaryHoverBackground, #45494e); }
  #${uid} .sql-toolbar button.active {
    background:var(--vscode-button-background);
    color:var(--vscode-button-foreground);
  }
  #${uid} .sql-meta { font-size:0.85em; color:var(--vscode-descriptionForeground); margin-left:8px; }
  #${uid} .sql-grid { border-collapse:collapse; width:100%; margin-top:4px; }
  #${uid} .sql-grid th {
    text-align:left; padding:4px 10px; font-weight:600;
    background:var(--vscode-keybindingTable-headerBackground, var(--vscode-editor-selectionBackground));
    border-bottom:1px solid var(--vscode-panel-border);
  }
  #${uid} .sql-grid td {
    padding:3px 10px;
    border-bottom:1px solid var(--vscode-panel-border, #333);
  }
  #${uid} .sql-grid tr:hover td { background:var(--vscode-list-hoverBackground); }
  #${uid} .null-val { color:var(--vscode-descriptionForeground); font-style:italic; }
  #${uid} .sql-json { white-space:pre-wrap; font-size:0.9em; padding:8px; background:var(--vscode-textCodeBlock-background, var(--vscode-editor-background)); border:1px solid var(--vscode-panel-border); border-radius:3px; overflow-x:auto; margin-top:4px; display:none; }
  #${uid} .sql-messages { margin-top:8px; border-top:1px solid var(--vscode-panel-border); padding-top:6px; }
  #${uid} .sql-msg { font-size:0.85em; padding:1px 0; }
  #${uid} .sql-msg-info { color:var(--vscode-descriptionForeground); }
  #${uid} .sql-msg-warning { color:var(--vscode-editorWarning-foreground, #cca700); }
  #${uid} .sql-msg-error { color:var(--vscode-editorError-foreground, #f44747); }
</style>
${contextText ? `<div style="margin-bottom:4px;font-size:0.85em;color:var(--vscode-descriptionForeground)">${escapeHtml(contextText)}</div>` : ''}
<div class="sql-toolbar">
  <button class="active" onclick="document.querySelector('#${uid} .sql-table-view').style.display='';document.querySelector('#${uid} .sql-json-view').style.display='none';this.classList.add('active');this.nextElementSibling.classList.remove('active')">Table</button>
  <button onclick="document.querySelector('#${uid} .sql-json-view').style.display='';document.querySelector('#${uid} .sql-table-view').style.display='none';this.classList.add('active');this.previousElementSibling.classList.remove('active')">JSON</button>
  <span class="sql-meta">${result.rowCount} row(s) &middot; ${result.executionTime}ms</span>
</div>
<div class="sql-table-view">${renderTable(result)}</div>
<div class="sql-json-view" style="display:none"><pre class="sql-json">${escapeHtml(jsonData)}</pre></div>
${renderMessages(messages)}
</div>`;
}

function renderTable(result: SqlResultSet): string {
  const headerCells = result.columns
    .map(c => `<th title="${escapeHtml(c.type)}">${escapeHtml(c.name)}</th>`)
    .join('');

  const bodyRows = result.rows.map(row => {
    const cells = result.columns.map(col => {
      const val = row[col.name];
      if (val === null || val === undefined) {
        return '<td class="null-val">NULL</td>';
      }
      return `<td>${escapeHtml(String(val))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table class="sql-grid"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function renderMessages(messages: SqlMessage[]): string {
  if (messages.length === 0) { return ''; }

  const items = messages.map(m => {
    const cls = `sql-msg sql-msg-${m.type}`;
    const icon = m.type === 'error' ? '&#x2716; ' : m.type === 'warning' ? '&#x26A0; ' : '';
    return `<div class="${cls}">${icon}${escapeHtml(m.text)}</div>`;
  }).join('');

  return `<div class="sql-messages"><div style="font-size:0.8em;font-weight:600;margin-bottom:2px;color:var(--vscode-descriptionForeground)">Messages</div>${items}</div>`;
}
