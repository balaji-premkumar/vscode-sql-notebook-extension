interface RendererOutputItem {
  text(): string;
}

interface RendererContext {
  readonly workspace: { readonly isTrusted: boolean };
}

export const activate = (_context: RendererContext) => {
  return {
    renderOutputItem(data: RendererOutputItem, element: HTMLElement) {
      const result = JSON.parse(data.text());
      element.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'sql-result-wrapper';

      const style = document.createElement('style');
      style.textContent = `
        .sql-result-wrapper { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
        .sql-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .sql-toolbar button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 8px; cursor: pointer; font-size: 0.85em; border-radius: 2px; }
        .sql-toolbar button:hover { background: var(--vscode-button-hoverBackground); }
        .sql-info { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
        .sql-grid { border-collapse: collapse; width: 100%; }
        .sql-grid th { background: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-foreground); padding: 6px 12px; text-align: left; border: 1px solid var(--vscode-panel-border); }
        .sql-grid td { padding: 4px 12px; border: 1px solid var(--vscode-panel-border); color: var(--vscode-editor-foreground); }
        .sql-grid tr:nth-child(even) { background: var(--vscode-editor-selectionBackground); }
        .null-value { color: var(--vscode-descriptionForeground); font-style: italic; }
      `;
      wrapper.appendChild(style);

      const toolbar = document.createElement('div');
      toolbar.className = 'sql-toolbar';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy as CSV';
      copyBtn.onclick = () => {
        const header = result.columns.map((c: { name: string }) => `"${c.name}"`).join(',');
        const rows = result.rows.map((row: Record<string, unknown>) =>
          result.columns.map((col: { name: string }) => {
            const val = row[col.name];
            if (val === null || val === undefined) { return ''; }
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',')
        );
        const csv = [header, ...rows].join('\n');
        navigator.clipboard.writeText(csv);
      };
      toolbar.appendChild(copyBtn);

      const info = document.createElement('span');
      info.className = 'sql-info';
      info.textContent = `${result.rowCount} row(s) | ${result.executionTime}ms`;
      toolbar.appendChild(info);

      wrapper.appendChild(toolbar);

      if (result.columns && result.columns.length > 0) {
        const table = document.createElement('table');
        table.className = 'sql-grid';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const col of result.columns) {
          const th = document.createElement('th');
          th.textContent = col.name;
          th.title = col.type || '';
          headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const row of result.rows) {
          const tr = document.createElement('tr');
          for (const col of result.columns) {
            const td = document.createElement('td');
            const val = row[col.name];
            if (val === null || val === undefined) {
              td.textContent = 'NULL';
              td.className = 'null-value';
            } else {
              td.textContent = String(val);
            }
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
      }

      element.appendChild(wrapper);
    }
  };
};
