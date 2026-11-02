/* Consentimiento para visitas públicas. No registra GPS ni datos de formularios. */
(() => {
  'use strict';
  const source = document.currentScript;
  const portal = source && source.dataset.portal;
  const valid = ['a-remarla','nuts','escuela-mayores','aula-generica','tienda-generica','sysacad','portfolio'];
  if (!valid.includes(portal) || location.protocol !== 'https:') return;
  if (['aula-generica','tienda-generica'].includes(portal) &&
      (new URLSearchParams(location.search).has('portal') || new URLSearchParams(location.search).has('org'))) return;
  const noTrack = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const key = 'dl-visit-permission-v1:' + portal;
  let choice = null, sent = false;
  try { choice = localStorage.getItem(key); } catch (_) {}
  function load() {
    if (sent || noTrack) return;
    sent = true;
    const tag = document.createElement('script');
    tag.src = 'https://datalisting.info/js/portal-telemetry.js';
    tag.dataset.portal = portal;
    tag.async = true;
    document.body.appendChild(tag);
  }
  const styles = document.createElement('style');
  styles.textContent = ".dl-privacy-panel{position:fixed;z-index:2147483000;bottom:10px;left:10px;box-sizing:border-box;width:min(470px,calc(100vw - 20px));padding:12px 14px;border:1px solid #dce1e7;border-radius:12px;box-shadow:0 5px 20px #00000016;background:#fff;color:#293442;font:13px/1.45 system-ui,Arial,sans-serif}.dl-privacy-panel[hidden]{display:none!important}.dl-privacy-panel h2{font:650 14px/1.35 system-ui,Arial,sans-serif;color:#25334a;margin:0 0 4px}.dl-privacy-panel p{font:13px/1.45 system-ui,Arial,sans-serif;color:#4b5563;margin:0 0 9px}.dl-privacy-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:7px}.dl-privacy-panel button{font:600 13px system-ui,Arial,sans-serif;padding:8px 13px;border-radius:8px;min-height:38px;cursor:pointer}.dl-privacy-no{border:1px solid #d4dae2;background:#f6f7f9;color:#374151}.dl-privacy-yes{border:1px solid #233d63;background:#233d63;color:#fff}.dl-privacy-details{margin:0 0 3px}.dl-privacy-details summary{color:#355980;cursor:pointer;font-size:12px;text-decoration:underline;text-underline-offset:2px}.dl-privacy-details p{margin:6px 0 9px;font-size:12px;line-height:1.5}.dl-privacy-link{display:inline-block;cursor:pointer;color:inherit;background:transparent;border:1px solid currentColor;border-radius:8px;padding:5px 10px;margin:7px;font:inherit;font-size:13px;opacity:.85}.dl-privacy-panel button:focus-visible,.dl-privacy-link:focus-visible,.dl-privacy-details summary:focus-visible{outline:2px solid #245d99;outline-offset:3px}@media(max-width:480px){.dl-privacy-panel{bottom:8px;left:8px;width:calc(100vw - 16px);padding:11px 12px}.dl-privacy-actions{justify-content:stretch}.dl-privacy-actions button{flex:1}}";
  document.head.appendChild(styles);
  function start() {
    const box = document.createElement('section');
    box.className = 'dl-privacy-panel';
    box.id = 'dl-privacy-panel';
    box.setAttribute('role','region');
    box.setAttribute('aria-label','Privacidad de la maqueta');
    const title = document.createElement('h2');
    title.textContent = 'Privacidad y estadísticas';
    const message = document.createElement('p');
    message.textContent = 'Usamos almacenamiento local para recordar tu elección. Con tu permiso, Datalisting registra estadísticas de visitas a este sitio.';
    const details = document.createElement('details');
    details.className = 'dl-privacy-details';
    const summary = document.createElement('summary'); summary.textContent = 'Más información';
    const finePrint = document.createElement('p');
    finePrint.textContent = 'Al aceptar, se registra la página, la maqueta, la fecha, el tipo de dispositivo y una IP cifrada en el servidor. No incluye GPS ni datos de formularios. Podés cambiar tu elección desde el enlace Privacidad.';
    details.append(summary,finePrint);
    const buttons = document.createElement('div');
    buttons.className = 'dl-privacy-actions';
    const no = document.createElement('button'); no.type='button'; no.className='dl-privacy-no'; no.textContent='Rechazar';
    const yes = document.createElement('button'); yes.type='button'; yes.className='dl-privacy-yes'; yes.textContent='Aceptar';
    if (noTrack) {yes.disabled = true; message.textContent += ' Se respeta la señal de no seguimiento activada en tu navegador.';}
    const trigger = document.createElement('button'); trigger.type='button'; trigger.className='dl-privacy-link'; trigger.textContent='Privacidad'; trigger.setAttribute('aria-controls',box.id);
    buttons.append(no,yes); box.append(title,message,details,buttons); document.body.append(box);
    const footer = document.querySelector('footer');
    if (footer) footer.append(trigger); else {trigger.style.position='fixed';trigger.style.bottom='9px';trigger.style.right='9px';trigger.style.zIndex='2147482999';document.body.append(trigger);}
    trigger.addEventListener('click',()=>box.hidden=!box.hidden);
    no.addEventListener('click',()=>{choice='no';try{localStorage.setItem(key,choice);}catch(_){}box.hidden=true;});
    yes.addEventListener('click',()=>{choice='si';try{localStorage.setItem(key,choice);}catch(_){}box.hidden=true;load();});
    box.hidden = choice!==null || noTrack;
    if (choice==='si') load();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();