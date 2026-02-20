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
  const uid = 'r' + Math.random().toString(36).substring(2, 9);

  if (result.columns.length === 0) {
    const statusMsg = `Query executed successfully. ${result.rowCount} row(s) affected. (${result.executionTime}ms)`;
    return `<div id="${uid}" style="font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size);color:var(--vscode-editor-foreground)">
      <style>
        #${uid} .sql-messages { margin-top:4px; }
        #${uid} .sql-msg-toggle { font-size:0.8em; color:var(--vscode-textLink-foreground, #3794ff); cursor:pointer; border:none; background:none; padding:0; text-decoration:underline; }
        #${uid} .sql-msg-body { display:none; margin-top:4px; padding:4px 0; border-top:1px solid var(--vscode-panel-border); }
        #${uid} .sql-msg { font-size:0.85em; padding:1px 0; }
        #${uid} .sql-msg-info { color:var(--vscode-descriptionForeground); }
        #${uid} .sql-msg-warning { color:var(--vscode-editorWarning-foreground, #cca700); }
        #${uid} .sql-msg-error { color:var(--vscode-editorError-foreground, #f44747); }
      </style>
      ${contextText ? `<div style="margin-bottom:6px;font-size:0.85em;color:var(--vscode-descriptionForeground)">${escapeHtml(contextText)}</div>` : ''}
      <div style="padding:4px 0">${escapeHtml(statusMsg)}</div>
      ${renderMessages(messages, uid)}
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
  #${uid} .sql-table-scroll {
    max-height:400px; overflow:auto;
    border:1px solid var(--vscode-panel-border, #333);
    margin-top:4px;
  }
  #${uid} .sql-grid {
    border-collapse:collapse; table-layout:fixed; width:max-content; min-width:100%;
  }
  #${uid} .sql-grid th, #${uid} .sql-grid td {
    text-align:left; padding:4px 10px; width:180px; max-width:180px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    border-bottom:1px solid var(--vscode-panel-border, #333);
    border-right:1px solid var(--vscode-panel-border, #333);
  }
  #${uid} .sql-grid th {
    font-weight:600; position:sticky; top:0; z-index:1;
    background:var(--vscode-keybindingTable-headerBackground, var(--vscode-editor-selectionBackground));
    border-bottom:2px solid var(--vscode-panel-border);
  }
  #${uid} .sql-grid th:last-child, #${uid} .sql-grid td:last-child { border-right:none; }
  #${uid} .sql-grid tbody tr:nth-child(even) td {
    background:var(--vscode-list-hoverBackground, rgba(128,128,128,0.04));
  }
  #${uid} .sql-grid tbody tr:hover td { background:var(--vscode-list-activeSelectionBackground, rgba(128,128,128,0.12)); }
  #${uid} .null-val { color:var(--vscode-descriptionForeground); font-style:italic; }
  #${uid} .sql-tooltip {
    display:none; position:fixed; z-index:9999;
    max-width:400px; max-height:200px; overflow:auto;
    padding:8px 10px; border-radius:4px;
    background:var(--vscode-editorHoverWidget-background, #2d2d30);
    color:var(--vscode-editorHoverWidget-foreground, #ccc);
    border:1px solid var(--vscode-editorHoverWidget-border, #454545);
    font-size:0.85em; white-space:pre-wrap; word-break:break-all;
    box-shadow:0 2px 8px rgba(0,0,0,0.3); cursor:text; user-select:text;
  }
  #${uid} .sql-json {
    white-space:pre-wrap; word-wrap:break-word;
    font-family:var(--vscode-editor-font-family); font-size:0.9em;
    padding:10px 12px; margin:4px 0 0 0;
    background:var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
    border:1px solid var(--vscode-panel-border);
    border-radius:4px; overflow-x:auto;
    color:var(--vscode-editor-foreground);
    line-height:1.45;
  }
  #${uid} .sql-messages { margin-top:4px; }
  #${uid} .sql-msg-toggle { font-size:0.8em; color:var(--vscode-textLink-foreground, #3794ff); cursor:pointer; border:none; background:none; padding:0; text-decoration:underline; }
  #${uid} .sql-msg-toggle:hover { color:var(--vscode-textLink-activeForeground, #3794ff); }
  #${uid} .sql-msg-body { display:none; margin-top:4px; padding:4px 0; border-top:1px solid var(--vscode-panel-border); }
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
<div class="sql-table-view"><div class="sql-table-scroll">${renderTable(result)}</div><div class="sql-tooltip" id="${uid}-tip"></div></div>
<script>
(function(){
  var root=document.getElementById('${uid}');
  var tip=document.getElementById('${uid}-tip');
  var hideTimer;
  root.addEventListener('mouseover',function(e){
    var td=e.target.closest&&e.target.closest('td');
    if(!td||!root.contains(td))return;
    if(td.scrollWidth<=td.clientWidth)return;
    clearTimeout(hideTimer);
    tip.textContent=td.getAttribute('data-full')||td.textContent;
    tip.style.display='block';
    var r=td.getBoundingClientRect();
    tip.style.left=r.left+'px';
    tip.style.top=(r.bottom+4)+'px';
  });
  root.addEventListener('mouseout',function(e){
    var td=e.target.closest&&e.target.closest('td');
    if(!td)return;
    hideTimer=setTimeout(function(){tip.style.display='none';},200);
  });
  tip.addEventListener('mouseover',function(){clearTimeout(hideTimer);});
  tip.addEventListener('mouseout',function(){hideTimer=setTimeout(function(){tip.style.display='none';},200);});
})();
</script>
<div class="sql-json-view" style="display:none"><pre class="sql-json">${escapeHtml(jsonData)}</pre></div>
${renderMessages(messages, uid)}
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
        return '<td class="null-val" data-full="NULL">NULL</td>';
      }
      const str = escapeHtml(String(val));
      return `<td data-full="${str}">${str}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table class="sql-grid"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function renderMessages(messages: SqlMessage[], uid: string): string {
  if (messages.length === 0) { return ''; }

  const items = messages.map(m => {
    const cls = `sql-msg sql-msg-${m.type}`;
    const icon = m.type === 'error' ? '&#x2716; ' : m.type === 'warning' ? '&#x26A0; ' : '';
    return `<div class="${cls}">${icon}${escapeHtml(m.text)}</div>`;
  }).join('');

  return `<div class="sql-messages"><button class="sql-msg-toggle" onclick="var b=document.querySelector('#${uid} .sql-msg-body');b.style.display=b.style.display==='none'?'':'none'">Messages (${messages.length})</button><div class="sql-msg-body">${items}</div></div>`;
}
