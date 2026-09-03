import {loadConfig, saveConfig} from './storage.js';
import {QBitClient} from './qbit.js';

const root = document.querySelector('#settings');
const config = await loadConfig();
root.innerHTML = `
<section class="settings-card">
  <div class="settings-title"><span class="mini-brand">HC</span><div><h1>QBitTorrent HomeConnect</h1><p class="muted">Connection, WebUI and client settings</p></div></div>
  <div class="settings-grid">
    <label>WebUI address <span class="label-note">IP / hostname : port</span><input id="host" placeholder="172.16.0.150:20090"></label>
    <label>API key <span class="label-note">qBittorrent WebUI → Settings → WebUI</span><input id="apiKey" type="password" autocomplete="off" placeholder="qbt_..."></label>
    <label>Refresh interval <span class="label-note">seconds · default 1</span><input id="refresh" type="number" min="1" max="30"></label>
  </div>
  <div class="settings-options">
    <label class="check"><input id="ssl" type="checkbox"> Use HTTPS</label>
    <label class="check"><input id="autoStart" type="checkbox"> Automatically start newly added torrents</label>
    <label class="theme-field">Appearance<select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
  </div>
  <div class="row"><button id="test">Test connection</button><button id="save" class="primary">Save</button></div>
  <div id="message" class="message"></div>
  <hr>
  <div class="setup-grid">
    <div>
      <h2>qBittorrent WebUI setup</h2>
      <p class="muted">Use the WebUI address including its port, for example <b>172.16.0.150:20090</b>.</p>
      <p class="muted">Create the API key in <b>qBittorrent → Settings → WebUI → API Key</b> and paste it above.</p>
      <div class="warning"><b>CSRF protection: OFF</b><br><span>Leave “Enable Cross-Site Request Forgery (CSRF) protection” disabled in qBittorrent WebUI security settings when using this client.</span></div>
    </div>
    <div>
      <h2>Authentication</h2>
      <p class="muted">API-key authentication only. The extension does not store or use a qBittorrent username/password, WebUI login session, or cookies.</p>
      <p class="fine">The API key stays in the browser's extension storage and is sent only to the WebUI address you configure.</p>
    </div>
  </div>
  <hr>
  <h2>Support development</h2>
  <p class="muted">If QBitTorrent HomeConnect saves you time, you can support ongoing development and maintenance.</p>
  <a class="donate" href="https://paypal.me/MrHC1983" target="_blank" rel="noopener noreferrer">Support via PayPal</a>
  <div class="settings-footer">QBitTorrent HomeConnect 2026.9.1 · © 2026 MrHC1983 · HC = HomeConnect · Independent third-party project. Not affiliated with or endorsed by qBittorrent.</div>
</section>`;

const $ = id => document.getElementById(id);
$('host').value=config.host; $('ssl').checked=config.ssl; $('apiKey').value=config.apiKey; $('refresh').value=config.refreshSeconds; $('autoStart').checked=config.autoStartAdded; $('theme').value=config.theme || 'dark';
function applyTheme(){document.documentElement.dataset.theme=$('theme').value;}
applyTheme(); $('theme').onchange=applyTheme;
const msg=text=>{$('message').textContent=text;$('message').className='message';};
$('test').onclick=async()=>{msg('Testing…');try{const c=new QBitClient({host:$('host').value,ssl:$('ssl').checked,apiKey:$('apiKey').value});const version=await c.test();msg(`Connected — qBittorrent ${version}`);}catch(e){msg(errorText(e));}};
$('save').onclick=async()=>{try{await saveConfig({host:$('host').value,ssl:$('ssl').checked,apiKey:$('apiKey').value,refreshSeconds:$('refresh').value,autoStartAdded:$('autoStart').checked,theme:$('theme').value});window.location.replace(chrome.runtime.getURL('index.html'));}catch(e){msg(e.message||'Unable to save settings.');}};
function errorText(e){if(e.status===401||e.status===403)return 'Request rejected. Check the WebUI address, API key and CSRF setting.';return e.message||'Connection failed.';}

(function enableResize(){
  const body=document.body; const minW=723,maxW=800,minH=360,maxH=560; let drag=null;
  document.querySelectorAll('.resize-handle').forEach(handle=>handle.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture?.(e.pointerId);
    drag={mode:handle.dataset.resize,startX:e.clientX,startY:e.clientY,startW:body.getBoundingClientRect().width,startH:body.getBoundingClientRect().height};
  }));
  document.addEventListener('pointermove',e=>{
    if(!drag)return; const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY; let w=drag.startW,h=drag.startH;
    if(drag.mode.includes('left'))w=Math.max(minW,Math.min(maxW,drag.startW-dx));
    if(drag.mode.includes('bottom'))h=Math.max(minH,Math.min(maxH,drag.startH+dy));
    body.style.width=`${Math.round(w)}px`; body.style.height=`${Math.round(h)}px`;
  });
  document.addEventListener('pointerup',()=>{drag=null;});
})();

