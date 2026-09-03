import {loadConfig, loadColumnWidths, saveColumnWidths} from './storage.js';
import {QBitClient} from './qbit.js';

const root = document.querySelector('#app');
const config = await loadConfig();
const savedColumnWidths = await loadColumnWidths();
document.documentElement.dataset.theme = config.theme || 'dark';
if (!config.host || !config.apiKey) {
  window.location.replace(chrome.runtime.getURL('options.html'));
} else {
root.innerHTML = `
<header class="toolbar">
  <div class="brand"><span class="brand-mark" title="QBitTorrent HomeConnect">HC</span><div class="brand-copy"><strong>QBitTorrent</strong><span>HomeConnect</span></div></div>
  <div class="toolbar-spacer"></div>
  <div class="toolbar-actions">
    <button id="add" class="add" title="Add torrent"><span>＋</span></button>
    <button id="start" class="start" title="Start selected"><span>▶</span></button>
    <button id="stop" class="stop" title="Stop selected"><span>■</span></button>
    <button id="remove" class="remove" title="Remove selected"><span>✕</span></button>
    <button id="webui" class="webui" title="Open qBittorrent WebUI">WebUI</button>
    <div class="toolbar-sep" aria-hidden="true"></div>
    <button id="settings" class="settings" title="Settings / Configure"><span>⚙</span><small>Settings</small></button>
  </div>
</header>
<main class="workspace">
  <section class="table-wrap"><table id="torrentTable"><colgroup><col data-col="select"><col data-col="name"><col data-col="size"><col data-col="progress"><col data-col="status"><col data-col="sp"><col data-col="down"><col data-col="up"><col data-col="eta"></colgroup><thead><tr><th class="select" data-col="select"><input id="all" type="checkbox"></th><th class="name-head" data-col="name">Name</th><th class="size-head" data-col="size">Size</th><th class="progress-head" data-col="progress">Progress</th><th class="status-head" data-col="status">Status</th><th class="sp-head" data-col="sp">S/P</th><th class="speed-head" data-col="down">Down Speed</th><th class="speed-head" data-col="up">Up Speed</th><th class="eta-head" data-col="eta">ETA</th></tr></thead><tbody id="rows"></tbody></table></section>
  <section id="details" class="details empty"><span class="detail-label">Progress:</span><div class="detail-map"><div class="piece-strip empty-strip"></div></div><span class="detail-percent">—</span></section>
</main>
<footer class="footer"><span><b id="status">Connecting…</b></span><span>Free: <b id="freeBottom">—</b></span><span class="footer-speed"><span>↓ <b id="dlBottom">0 B/s</b></span><span>↑ <b id="upBottom">0 B/s</b></span></span><button id="expand" class="expand" title="Open HomeConnect in a tab">↗</button></footer>
<input id="file" type="file" accept=".torrent,application/x-bittorrent" hidden>
<div id="notice" class="notice"></div><div class="resize-handle resize-left" data-resize="left" aria-hidden="true"></div><div class="resize-handle resize-bottom-left" data-resize="bottom-left" aria-hidden="true"></div><div class="resize-handle resize-bottom-right" data-resize="bottom-right" aria-hidden="true"></div>`;

const client = new QBitClient(config);
const selected = new Set();
let torrents = [];
let activeDetailHash = null;
const $ = id => document.getElementById(id);

const COLUMN_KEYS = ['select','name','size','progress','status','sp','down','up','eta'];
const COLUMN_DEFAULTS = [3.5,31,8.5,15,12,7,9,9,5];
const COLUMN_MIN_PX = [40,180,75,110,100,70,100,100,65];
let columnWidths = Array.isArray(savedColumnWidths) && savedColumnWidths.length === COLUMN_KEYS.length
  ? savedColumnWidths.map(Number)
  : [...COLUMN_DEFAULTS];
if (columnWidths.some(v => !Number.isFinite(v) || v <= 0)) columnWidths = [...COLUMN_DEFAULTS];

function applyColumnWidths() {
  const cols = document.querySelectorAll('#torrentTable col');
  if (cols.length !== columnWidths.length) return;
  const total = columnWidths.reduce((a,b)=>a+b,0) || 100;
  cols.forEach((col,i)=>col.style.width=`${(columnWidths[i]/total*100).toFixed(4)}%`);
}
function normaliseColumnWidths() {
  const total = columnWidths.reduce((a,b)=>a+b,0) || 100;
  columnWidths = columnWidths.map(v=>v/total*100);
}
function enableColumnResize() {
  const table = document.querySelector('#torrentTable');
  const headers = [...table.querySelectorAll('thead th[data-col]')];
  let drag = null;
  const edge = 6;
  const headerAtEdge = e => {
    const th=e.target.closest?.('th[data-col]');
    if(!th || th.dataset.col==='eta') return null;
    const r=th.getBoundingClientRect();
    return Math.abs(e.clientX-r.right)<=edge ? th : null;
  };
  headers.forEach(th=>{
    th.addEventListener('mousemove',e=>{ th.classList.toggle('resizable', !!headerAtEdge(e)); });
    th.addEventListener('mouseleave',()=>th.classList.remove('resizable'));
    th.addEventListener('pointerdown',e=>{
      const hit=headerAtEdge(e);
      if(!hit || e.button!==0)return;
      const idx=COLUMN_KEYS.indexOf(hit.dataset.col), next=idx+1;
      if(idx<0 || next>=COLUMN_KEYS.length)return;
      const rect=table.getBoundingClientRect();
      const widths=[...table.querySelectorAll('col')].map(c=>c.getBoundingClientRect().width);
      if(widths[idx] < 1 || widths[next] < 1)return;
      e.preventDefault(); e.stopPropagation();
      drag={idx,next,startX:e.clientX,startA:widths[idx],startB:widths[next],tableWidth:rect.width};
      document.body.classList.add('column-resizing');
      th.setPointerCapture?.(e.pointerId);
    });
  });
  document.addEventListener('pointermove',e=>{
    if(!drag)return;
    const delta=e.clientX-drag.startX;
    let a=drag.startA+delta, b=drag.startB-delta;
    a=Math.max(COLUMN_MIN_PX[drag.idx],a);
    b=Math.max(COLUMN_MIN_PX[drag.next],b);
    const total=drag.startA+drag.startB;
    if(a+b>total){
      if(delta>0){a=total-b;}else{b=total-a;}
    }
    const widths=[...table.querySelectorAll('col')].map(c=>c.getBoundingClientRect().width);
    widths[drag.idx]=a; widths[drag.next]=b;
    const sum=widths.reduce((x,y)=>x+y,0);
    columnWidths=widths.map(w=>w/sum*100);
    applyColumnWidths();
  });
  document.addEventListener('pointerup',async()=>{
    if(!drag)return;
    drag=null;
    document.body.classList.remove('column-resizing');
    normaliseColumnWidths();
    applyColumnWidths();
    try{await saveColumnWidths(columnWidths);}catch(_){ }
  });
  applyColumnWidths();
}

function showNotice(text, kind='') { const n=$('notice'); n.textContent=text; n.className=`notice ${kind}`; clearTimeout(showNotice.timer); if(text) showNotice.timer=setTimeout(()=>{n.textContent='';n.className='notice'},4500); }
function humanBytes(n) { if (!Number.isFinite(n)) return '—'; const units=['B','KiB','MiB','GiB','TiB']; let i=0; while(n>=1024&&i<units.length-1){n/=1024;i++;} return `${n.toFixed(i?2:0)} ${units[i]}`; }
function humanRate(n) { return `${humanBytes(n)}/s`; }
function eta(sec) { if (!Number.isFinite(sec)||sec<0||sec>=8640000) return '∞'; const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.floor(sec%60); return h?`${h}h ${m}m`:m?`${m}m ${s}s`:`${s}s`; }
function stateClass(t){const s=String(t.state||'unknown'); const complete=Number(t.progress)>=0.999999; if(s.includes('downloading'))return 'downloading'; if(s.includes('uploading'))return 'seeding'; if((s==='stalledUP'||s==='queuedUP')&&complete)return 'seeding'; if(s.includes('stalled'))return 'stalled'; if(s.includes('paused'))return 'stopped'; if(s.includes('checking'))return 'checking'; if(s==='error'||s==='missingFiles')return 'error'; return 'other';}
function stateLabel(t) { const map={downloading:'Downloading',stalledDL:'Stalled',uploading:'Seeding',stalledUP:'Stalled',queuedDL:'Queued',queuedUP:'Queued',pausedDL:'Stopped',pausedUP:'Stopped',checkingDL:'Checking',checkingUP:'Checking',checkingResumeData:'Checking',moving:'Moving',missingFiles:'Missing files',error:'Error',unknown:'Unknown'}; if(Number(t.progress)>=0.999999 && (t.state==='stalledUP'||t.state==='queuedUP')) return 'Seeding'; return map[t.state] || t.state || 'Unknown'; }
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function render() {
  $('all').checked = torrents.length>0 && torrents.every(t=>selected.has(t.hash));
  const buttonsDisabled = selected.size===0;
  ['start','stop','remove'].forEach(id=>$(id).disabled=buttonsDisabled);
  $('rows').innerHTML = torrents.map(t=>{
    const pct=Math.max(0,Math.min(100,(Number(t.progress)||0)*100)); const checked=selected.has(t.hash);
    const state=stateClass(t);
    return `<tr data-hash="${escape(t.hash)}" class="${checked?'selected':''}">
      <td class="select"><input class="pick" type="checkbox" ${checked?'checked':''}></td>
      <td class="name" title="${escape(t.name)}">${escape(t.name)}</td>
      <td class="size">${humanBytes(Number(t.size))}</td>
      <td class="progress-cell"><div class="progress ${state}"><span style="width:${pct}%"></span><b>${pct.toFixed(1)}%</b></div></td>
      <td class="status status-${state}">${escape(stateLabel(t))}</td><td class="sp">${Number(t.num_seeds)||0} / ${Number(t.num_complete)||0}</td>
      <td class="speed">${humanRate(Number(t.dlspeed)||0)}</td><td class="speed">${humanRate(Number(t.upspeed)||0)}</td><td class="eta">${eta(Number(t.eta))}</td>
    </tr>`;
  }).join('');
  document.querySelectorAll('.pick').forEach(box=>box.onchange=()=>{const h=box.closest('tr').dataset.hash; box.checked?selected.add(h):selected.delete(h); if(!selected.has(activeDetailHash)) activeDetailHash=[...selected][0]||null; render(); loadDetails();});
  document.querySelectorAll('tr[data-hash]').forEach(row=>{
    row.onclick=(e)=>{if(e.target.closest('input'))return; const h=row.dataset.hash; activeDetailHash=h; selected.clear(); selected.add(h); render(); loadDetails();};
  });
}

// Handle context menus at the document level so Edge cannot fall back to its
// own menu when the pointer is over a table cell, checkbox, or empty list area.
document.addEventListener('contextmenu',e=>{
  const row=e.target.closest?.('tr[data-hash]');
  const workspace=e.target.closest?.('.workspace');
  if(!row && !workspace)return;
  e.preventDefault();
  e.stopPropagation();
  let hash=row?.dataset.hash;
  if(row && !selected.has(hash)){
    selected.clear();
    selected.add(hash);
    activeDetailHash=hash;
    render();
  }
  if(!hash)hash=activeDetailHash||[...selected][0]||torrents[0]?.hash;
  if(hash && !selected.has(hash)){
    selected.clear();
    selected.add(hash);
    activeDetailHash=hash;
    render();
  }
  if(hash)openActionMenu(e.clientX,e.clientY);
},true);

function openActionMenu(x,y){ const old=document.querySelector('.action-menu'); old?.remove(); const m=document.createElement('div'); m.className='action-menu'; m.style.left=`${Math.min(x,innerWidth-210)}px`;m.style.top=`${Math.min(y,innerHeight-250)}px`;m.innerHTML='<button data-a="start">▶ Start</button><button data-a="stop">■ Stop</button><button data-a="force">⚡ Force Start</button><button data-a="recheck">↻ Force Re-Check</button><hr><button data-a="remove">✕ Remove</button>'; document.body.append(m); m.onclick=async e=>{const a=e.target.dataset.a;if(!a)return;m.remove();await act(a);}; setTimeout(()=>document.addEventListener('click',()=>m.remove(),{once:true}),0);}
async function act(action){const hashes=[...selected]; if(!hashes.length)return; try{if(action==='start')await client.start(hashes);if(action==='stop')await client.stop(hashes);if(action==='force')await client.forceStart(hashes,true);if(action==='recheck')await client.recheck(hashes);if(action==='remove'){if(!confirm(`Remove ${hashes.length} selected torrent${hashes.length>1?'s':''}?`))return;await client.remove(hashes,false);hashes.forEach(h=>selected.delete(h));activeDetailHash=null;}await refresh();}catch(e){showNotice(errorText(e),'error');}}
function errorText(e){if(e.status===401||e.status===403)return 'Request rejected. Check qBittorrent WebUI CSRF protection settings.';return e.message||'Request failed.';}
async function refresh(){try{const [list,data]=await Promise.all([client.torrents(),client.mainData()]);torrents=list;for(const h of [...selected])if(!list.some(t=>t.hash===h))selected.delete(h);if(activeDetailHash&&!list.some(t=>t.hash===activeDetailHash))activeDetailHash=null;render();const free=data?.server_state?.free_space_on_disk;const dl=Number(data?.server_state?.dl_info_speed)||0,up=Number(data?.server_state?.up_info_speed)||0;$('status').textContent=`${list.length} torrent${list.length===1?'':'s'}`;$('freeBottom').textContent=free!=null?humanBytes(Number(free)):'—';$('dlBottom').textContent=humanRate(dl);$('upBottom').textContent=humanRate(up);if(activeDetailHash)await loadDetails();}catch(e){$('status').textContent='Connection error';showNotice(errorText(e),'error');}}
async function loadDetails(){
  const hash=activeDetailHash||[...selected][0];
  if(!hash){
    $('details').className='details empty';
    $('details').innerHTML='<span class="detail-label">Progress:</span><div class="detail-map"><div class="piece-strip empty-strip"></div></div><span class="detail-percent">—</span>';
    return;
  }
  const t=torrents.find(x=>x.hash===hash);
  if(!t)return;
  try{
    const pieces=await client.pieceStates(hash);
    renderDetails(t,pieces||[]);
  }catch(e){
    $('details').className='details empty';
    $('details').innerHTML='<span class="detail-label">Progress:</span><div class="detail-map"><div class="piece-strip empty-strip"></div></div><span class="detail-percent">—</span>';
  }
}
function renderDetails(t,pieces){
  const pct=Math.max(0,Math.min(100,(Number(t.progress)||0)*100));
  const pieceHtml=pieces.length
    ? `<div class="piece-strip" title="${pieces.filter(x=>x===2).length} downloaded, ${pieces.filter(x=>x===1).length} downloading, ${pieces.filter(x=>x===0).length} remaining">${pieces.map(s=>`<i class="piece p${s}"></i>`).join('')}</div>`
    : '<div class="piece-strip empty-strip"></div>';
  $('details').className='details';
  $('details').innerHTML=`<span class="detail-label">Progress:</span><div class="detail-map">${pieceHtml}</div><span class="detail-percent">${pct.toFixed(1)}%</span>`;
}

$('all').onchange=()=>{if($('all').checked)torrents.forEach(t=>selected.add(t.hash));else selected.clear();activeDetailHash=$('all').checked?([...selected][0]||null):null;render();loadDetails();};
$('start').onclick=()=>act('start');$('stop').onclick=()=>act('stop');$('remove').onclick=()=>act('remove');$('settings').onclick=()=>{window.location.href=chrome.runtime.getURL('options.html');};$('webui').onclick=()=>{let host=config.host.trim();if(!/^https?:\/\//i.test(host))host=`${config.ssl?'https':'http'}://${host}`;chrome.tabs.create({url:host.replace(/\/$/,'')});};
$('expand').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('index.html')});

// The browser owns the action-popup shell, but these handles allow edge/corner resizing where Edge permits it.
(function enableResize(){
  const body=document.body;
  const minW=723,maxW=800,minH=260,maxH=600;
  let drag=null;
  document.querySelectorAll('.resize-handle').forEach(handle=>handle.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture?.(e.pointerId);
    drag={mode:handle.dataset.resize,startX:e.clientX,startY:e.clientY,startW:body.getBoundingClientRect().width,startH:body.getBoundingClientRect().height};
  }));
  document.addEventListener('pointermove',e=>{if(!drag)return; const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY; let w=drag.startW,h=drag.startH; if(drag.mode.includes('left'))w=Math.max(minW,Math.min(maxW,drag.startW-dx)); if(drag.mode.includes('bottom'))h=Math.max(minH,Math.min(maxH,drag.startH+dy)); body.style.width=`${Math.round(w)}px`;body.style.height=`${Math.round(h)}px`;});
  document.addEventListener('pointerup',()=>{drag=null;});
})();
$('add').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{const result=await client.addFile(f);if(config.autoStartAdded&&result?.added_torrent_ids?.length)await client.start(result.added_torrent_ids);await refresh();showNotice('Torrent added.');}catch(e){showNotice(errorText(e),'error');}$('file').value='';};
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',async e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.name?.toLowerCase().endsWith('.torrent')){try{const result=await client.addFile(f);if(config.autoStartAdded&&result?.added_torrent_ids?.length)await client.start(result.added_torrent_ids);await refresh();}catch(err){showNotice(errorText(err),'error');}}});
chrome.runtime.sendMessage({type:'get-pending-add'}, async response=>{if(response?.url){try{const result=await client.addUrl(response.url);if(config.autoStartAdded&&result?.added_torrent_ids?.length)await client.start(result.added_torrent_ids);await refresh();showNotice('Link added.');}catch(e){showNotice(errorText(e),'error');}}});
enableColumnResize();
refresh();setInterval(refresh,Math.max(1000,Number(config.refreshSeconds)*1000));
}
