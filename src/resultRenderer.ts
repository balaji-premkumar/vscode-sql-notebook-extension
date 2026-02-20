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

  const rows = result.rows.map(row => {
    const clean: Record<string, unknown> = {};
    for (const col of result.columns) {
      clean[col.name] = row[col.name] ?? null;
    }
    return clean;
  });

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
  #${uid} .sql-scroll-container {
    max-height:400px; overflow:auto;
    border:1px solid var(--vscode-panel-border, #333);
    margin-top:4px;
  }
  #${uid} .sql-grid {
    border-collapse:separate; border-spacing:0; table-layout:fixed; width:max-content; min-width:100%;
  }
  #${uid} .sql-grid th, #${uid} .sql-grid td {
    text-align:left; padding:4px 10px; width:180px; max-width:180px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    border-bottom:1px solid var(--vscode-panel-border, #333);
    border-right:1px solid var(--vscode-panel-border, #333);
  }
  #${uid} .sql-grid th {
    font-weight:600; position:sticky; top:0; z-index:2;
    background:var(--vscode-editor-background, #1e1e1e);
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
  #${uid} .sql-json-scroll {
    max-height:400px; overflow:auto;
    border:1px solid var(--vscode-panel-border);
    border-radius:4px; margin-top:4px;
    background:var(--vscode-editor-background, #1e1e1e);
    padding:8px 0;
    font-family:var(--vscode-editor-font-family); font-size:0.9em;
    line-height:1.5;
  }
  #${uid} .jv-row { padding:0 12px; white-space:nowrap; }
  #${uid} .jv-toggle {
    cursor:pointer; user-select:none; display:inline-block; width:14px; text-align:center;
    color:var(--vscode-descriptionForeground); font-size:0.75em;
  }
  #${uid} .jv-toggle:hover { color:var(--vscode-editor-foreground); }
  #${uid} .jv-key { color:var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
  #${uid} .jv-str { color:var(--vscode-debugTokenExpression-string, #ce9178); }
  #${uid} .jv-num { color:var(--vscode-debugTokenExpression-number, #b5cea8); }
  #${uid} .jv-bool { color:var(--vscode-debugTokenExpression-boolean, #569cd6); }
  #${uid} .jv-null { color:var(--vscode-descriptionForeground); font-style:italic; }
  #${uid} .jv-bracket { color:var(--vscode-editor-foreground); }
  #${uid} .jv-hidden { display:none; }
  #${uid} .jv-ellipsis { color:var(--vscode-descriptionForeground); cursor:pointer; }
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
<div class="sql-table-view">
  <div class="sql-scroll-container">${renderTable(result)}</div>
  <div class="sql-tooltip" id="${uid}-tip"></div>
</div>
<div class="sql-json-view" style="display:none">
  <div class="sql-json-scroll" id="${uid}-jv"></div>
</div>
<script>
(function(){
  var root=document.getElementById('${uid}');
  var tip=document.getElementById('${uid}-tip');
  var activeTd=null;
  root.querySelector('.sql-scroll-container').addEventListener('click',function(e){
    var td=e.target.closest&&e.target.closest('td');
    if(!td||!root.contains(td))return;
    if(td.scrollWidth<=td.clientWidth){tip.style.display='none';activeTd=null;return;}
    if(activeTd===td){tip.style.display='none';activeTd=null;return;}
    activeTd=td;
    tip.textContent=td.getAttribute('data-full')||td.textContent;
    tip.style.display='block';
    var r=td.getBoundingClientRect();
    tip.style.left=r.left+'px';
    tip.style.top=(r.bottom+4)+'px';
  });
  document.addEventListener('click',function(e){
    if(!tip.contains(e.target)&&!(e.target.closest&&e.target.closest('td')&&root.contains(e.target))){
      tip.style.display='none';activeTd=null;
    }
  });

  var data=${JSON.stringify(rows)};
  var jv=document.getElementById('${uid}-jv');
  function renderJson(val,indent,isLast){
    var pad='';for(var i=0;i<indent;i++)pad+='&nbsp;&nbsp;';
    var comma=isLast?'':',';
    if(val===null)return pad+'<span class="jv-null">null</span>'+comma+'\\n';
    if(typeof val==='string')return pad+'<span class="jv-str">"'+esc(val)+'"</span>'+comma+'\\n';
    if(typeof val==='number')return pad+'<span class="jv-num">'+val+'</span>'+comma+'\\n';
    if(typeof val==='boolean')return pad+'<span class="jv-bool">'+val+'</span>'+comma+'\\n';
    if(Array.isArray(val)){
      if(val.length===0)return pad+'<span class="jv-bracket">[]</span>'+comma+'\\n';
      var id='jv_'+Math.random().toString(36).substr(2,6);
      var h=pad+'<span class="jv-toggle" data-target="'+id+'" data-open="true">&#9660;</span>';
      h+='<span class="jv-bracket">[</span>';
      h+='<span class="jv-ellipsis" data-target="'+id+'" style="display:none">...</span>';
      h+='\\n<span id="'+id+'">';
      for(var i=0;i<val.length;i++)h+=renderJson(val[i],indent+1,i===val.length-1);
      h+=pad+'</span><span class="jv-bracket">]</span>'+comma+'\\n';
      return h;
    }
    if(typeof val==='object'){
      var keys=Object.keys(val);
      if(keys.length===0)return pad+'<span class="jv-bracket">{}</span>'+comma+'\\n';
      var id='jv_'+Math.random().toString(36).substr(2,6);
      var h=pad+'<span class="jv-toggle" data-target="'+id+'" data-open="true">&#9660;</span>';
      h+='<span class="jv-bracket">{</span>';
      h+='<span class="jv-ellipsis" data-target="'+id+'" style="display:none">...</span>';
      h+='\\n<span id="'+id+'">';
      for(var i=0;i<keys.length;i++){
        var k=keys[i];var last=i===keys.length-1;
        var inner=renderJson(val[k],0,true).replace(/\\n$/,'');
        h+=pad+'&nbsp;&nbsp;<span class="jv-key">"'+esc(k)+'"</span>: '+inner.trimStart()+(last?'':',')+'\\n';
      }
      h+=pad+'</span><span class="jv-bracket">}</span>'+comma+'\\n';
      return h;
    }
    return pad+esc(String(val))+comma+'\\n';
  }
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  jv.innerHTML='<div class="jv-row" style="white-space:pre-wrap">'+renderJson(data,0,true)+'</div>';
  jv.addEventListener('click',function(e){
    var tgt=e.target.closest&&(e.target.closest('.jv-toggle')||e.target.closest('.jv-ellipsis'));
    if(!tgt)return;
    var targetId=tgt.getAttribute('data-target');
    var content=document.getElementById(targetId);
    if(!content)return;
    var isOpen=content.style.display!=='none';
    content.style.display=isOpen?'none':'';
    var toggles=jv.querySelectorAll('[data-target="'+targetId+'"]');
    for(var i=0;i<toggles.length;i++){
      var el=toggles[i];
      if(el.classList.contains('jv-toggle')){el.innerHTML=isOpen?'&#9654;':'&#9660;';el.setAttribute('data-open',isOpen?'false':'true');}
      if(el.classList.contains('jv-ellipsis')){el.style.display=isOpen?'':'none';}
    }
  });
})();
</script>
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
