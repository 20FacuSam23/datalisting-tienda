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
  styles.textContent = '.dl-privacy-panel{position:fixed;z-index:2147483000;bottom:16px;left:16px;width:min(380px,calc(100vw - 32px));padding:18px;border:1px solid #b7cfc0;border-radius:15px;box-shadow:0 12px 35px #1117;background:#fff;color:#173e32;font:15px/1.5 system-ui,Arial,sans-serif}.dl-privacy-panel[hidden]{display:none!important}.dl-privacy-panel h2{font:700 18px/1.3 system-ui,Arial,sans-serif;color:#173e32;margin:0 0 8px}.dl-privacy-panel p{font:14px/1.55 system-ui,Arial,sans-serif;color:#365a4b;margin:0 0 13px}.dl-privacy-panel button{font:700 14px system-ui,Arial,sans-serif;padding:11px 12px;border-radius:9px;min-height:44px;cursor:pointer}.dl-privacy-actions{display:flex;gap:8px;flex-wrap:wrap}.dl-privacy-no{border:1px solid #bad2c2;background:#edf5ee;color:#173e32}.dl-privacy-yes{border:1px solid #206249;background:#206249;color:#fff}.dl-privacy-link{display:inline-block;cursor:pointer;color:inherit;background:transparent;border:1px solid currentColor;border-radius:8px;padding:5px 10px;margin:7px;font:inherit;font-size:13px;opacity:.85}.dl-privacy-panel button:focus-visible,.dl-privacy-link:focus-visible{outline:3px solid #e9a54b;outline-offset:3px}';
  document.head.appendChild(styles);
  function start() {
    const box = document.createElement('section');
    box.className = 'dl-privacy-panel';
    box.id = 'dl-privacy-panel';
    box.setAttribute('role','region');
    box.setAttribute('aria-label','Privacidad de la maqueta');
    const title = document.createElement('h2');
    title.textContent = 'Privacidad de esta maqueta';
    const message = document.createElement('p');
    message.textContent = 'Solo si aceptás, Datalisting registrará esta visita: maqueta, página, fecha, tipo de dispositivo e IP cifrada en el servidor. Para seguridad y estadísticas del sitio; no incluye GPS, identidad personal ni datos de formularios. Podés rechazar o cambiar esta opción.';
    const buttons = document.createElement('div');
    buttons.className = 'dl-privacy-actions';
    const no = document.createElement('button'); no.type='button'; no.className='dl-privacy-no'; no.textContent='No compartir';
    const yes = document.createElement('button'); yes.type='button'; yes.className='dl-privacy-yes'; yes.textContent='Aceptar estadísticas';
    if (noTrack) {yes.disabled = true; message.textContent += ' Se respeta la señal de no seguimiento activada en tu navegador.';}
    const trigger = document.createElement('button'); trigger.type='button'; trigger.className='dl-privacy-link'; trigger.textContent='Privacidad'; trigger.setAttribute('aria-controls',box.id);
    buttons.append(no,yes); box.append(title,message,buttons); document.body.append(box);
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