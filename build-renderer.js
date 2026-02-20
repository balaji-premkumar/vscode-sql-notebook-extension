const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'out');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const rendererJs = `"use strict";

export const activate = function(context) {
  return {
    renderOutputItem: function(data, element) {
      var result = JSON.parse(data.text());
      element.innerHTML = '';

      var wrapper = document.createElement('div');
      wrapper.className = 'sql-result-wrapper';

      var style = document.createElement('style');
      style.textContent = [
        '.sql-result-wrapper { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }',
        '.sql-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
        '.sql-toolbar button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 8px; cursor: pointer; font-size: 0.85em; border-radius: 2px; }',
        '.sql-toolbar button:hover { background: var(--vscode-button-hoverBackground); }',
        '.sql-info { font-size: 0.85em; color: var(--vscode-descriptionForeground); }',
        '.sql-grid { border-collapse: collapse; width: 100%; }',
        '.sql-grid th { background: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-foreground); padding: 6px 12px; text-align: left; border: 1px solid var(--vscode-panel-border); }',
        '.sql-grid td { padding: 4px 12px; border: 1px solid var(--vscode-panel-border); color: var(--vscode-editor-foreground); }',
        '.sql-grid tr:nth-child(even) { background: var(--vscode-editor-selectionBackground); }',
        '.null-value { color: var(--vscode-descriptionForeground); font-style: italic; }'
      ].join('\\n');
      wrapper.appendChild(style);

      var toolbar = document.createElement('div');
      toolbar.className = 'sql-toolbar';

      var copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy as CSV';
      copyBtn.onclick = function () {
        var header = result.columns.map(function (c) { return '"' + c.name + '"'; }).join(',');
        var rows = result.rows.map(function (row) {
          return result.columns.map(function (col) {
            var val = row[col.name];
            if (val === null || val === undefined) { return ''; }
            return '"' + String(val).replace(/"/g, '""') + '"';
          }).join(',');
        });
        var csv = [header].concat(rows).join('\\n');
        navigator.clipboard.writeText(csv);
      };
      toolbar.appendChild(copyBtn);

      var info = document.createElement('span');
      info.className = 'sql-info';
      info.textContent = result.rowCount + ' row(s) | ' + result.executionTime + 'ms';
      toolbar.appendChild(info);

      wrapper.appendChild(toolbar);

      if (result.columns && result.columns.length > 0) {
        var table = document.createElement('table');
        table.className = 'sql-grid';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        for (var i = 0; i < result.columns.length; i++) {
          var th = document.createElement('th');
          th.textContent = result.columns[i].name;
          th.title = result.columns[i].type || '';
          headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        for (var r = 0; r < result.rows.length; r++) {
          var tr = document.createElement('tr');
          for (var c = 0; c < result.columns.length; c++) {
            var td = document.createElement('td');
            var val = result.rows[r][result.columns[c].name];
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
`;

fs.writeFileSync(path.join(outDir, 'renderer.js'), rendererJs);
console.log('Renderer built successfully.');
