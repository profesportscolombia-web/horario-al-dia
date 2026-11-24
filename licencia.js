// Horario al Día · licencia anual, copia de seguridad, instalación y ayuda.
// Se carga después del script principal (comparte sus variables: S, render, guardarLocal, construir...).
(function () {
  'use strict';
  const PUB = window.LICENCIA_PUB || null;
  const DIA = 864e5, PRUEBA_DIAS = 30, AVISO_DIAS = 30, VERSION_APP = '1.0';
  let ESTADO = { modo: 'sin-config', bloqueada: false };
  let instalador = null;

  const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dias = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / DIA);
  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const fmt = f => { const d = new Date(f + 'T12:00:00'); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); };

  async function verificar(codigo) {
    const p = String(codigo || '').trim().split('.');
    if (p.length !== 3 || p[0] !== 'HAD1') throw new Error('El código no tiene el formato correcto.');
    if (!PUB) throw new Error('Esta copia no trae la llave para comprobar licencias.');
    if (!(window.crypto && crypto.subtle)) throw new Error('Este navegador no permite comprobar la licencia aquí. Ábrala desde la app instalada o desde la dirección segura (https).');
    const key = await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
    if (!ok) throw new Error('El código no es válido: la firma no coincide. Pídalo de nuevo.');
    const data = JSON.parse(new TextDecoder().decode(b64u(p[1])));
    if (!data.v || !data.c) throw new Error('El código está incompleto.');
    return data;
  }

  async function refrescar() {
    const hoy = hoyISO();
    let relojAtrasado = false;
    if (S.ultimaVez && dias(hoy, S.ultimaVez) < -1) relojAtrasado = true;
    else S.ultimaVez = hoy;
    if (!PUB) { ESTADO = { modo: 'sin-config', bloqueada: false, relojAtrasado }; guardarLocal(); return ESTADO; }
    if (S.licencia) {
      try {
        const d = await verificar(S.licencia);
        const rest = dias(d.v, hoy);
        ESTADO = { modo: rest < 0 ? 'vencida' : rest <= AVISO_DIAS ? 'por-vencer' : 'vigente', bloqueada: rest < 0, colegio: d.c, plan: d.p || '', vence: d.v, restan: rest, relojAtrasado };
      } catch (e) { ESTADO = { modo: 'invalida', bloqueada: true, error: e.message, relojAtrasado }; }
    } else {
      if (!S.primera) S.primera = hoy;
      const rest = PRUEBA_DIAS - dias(hoy, S.primera);
      ESTADO = { modo: rest > 0 ? 'prueba' : 'prueba-terminada', bloqueada: rest <= 0, restan: Math.max(0, rest), relojAtrasado };
    }
    guardarLocal();
    return ESTADO;
  }

  // ---------- Bloqueo: solo ver, imprimir y descargar ----------
  const PERMITIDO = '#vista button,#grado,#gtipo,#gitem,#fecha,#plantilla,#imprimir,#imprimirG,#csv,#copiar,#copiarTodos,#nomCopiar,#nomCsv,#licCodigo,#licActivar,#bkExportar,#btnInstalar,[data-perm]';
  function aplicarBloqueo() {
    document.querySelectorAll('header input,header select,main input,main select,main textarea,main button,main a.b').forEach(el => {
      if (el.matches && el.matches('a')) return;
      if (ESTADO.bloqueada && !el.matches(PERMITIDO)) { el.disabled = true; el.dataset.lock = '1'; }
      else if (el.dataset.lock) { el.disabled = false; delete el.dataset.lock; }
    });
  }

  // ---------- Avisos arriba ----------
  function renderBanner() {
    let b = document.getElementById('licBanner');
    if (!b) { b = document.createElement('div'); b.id = 'licBanner'; const nav = document.querySelector('nav'); nav.parentNode.insertBefore(b, nav); }
    const e = ESTADO; let html = '', color = '';
    if (e.modo === 'prueba') { color = 'amar'; html = `Prueba gratis: le quedan <b>${e.restan} día(s)</b>. Para seguir, active su licencia en «Ayuda y licencia».`; }
    else if (e.modo === 'por-vencer') { color = 'amar'; html = `Su licencia vence el <b>${fmt(e.vence)}</b> (en ${e.restan} día(s)). Pida la renovación para no perder la edición.`; }
    else if (e.modo === 'vencida') { color = 'rojo'; html = `Su licencia venció el <b>${fmt(e.vence)}</b>. Puede <b>ver, imprimir y descargar</b>, pero no cambiar ni guardar. Active una licencia nueva en «Ayuda y licencia».`; }
    else if (e.modo === 'prueba-terminada') { color = 'rojo'; html = 'La prueba gratis terminó. Puede <b>ver, imprimir y descargar</b>, pero no cambiar ni guardar. Active su licencia en «Ayuda y licencia».'; }
    else if (e.modo === 'invalida') { color = 'rojo'; html = `La licencia guardada no es válida (${e.error || ''}). Escriba el código otra vez en «Ayuda y licencia».`; }
    if (e.relojAtrasado) html += (html ? '<br>' : '') + '⚠ La fecha de este equipo parece atrasada. Corríjala para que la licencia se compruebe bien.';
    b.style.cssText = html ? `padding:8px 16px;font-size:.9rem;background:${color === 'rojo' ? '#ffd9d3' : '#fff1c9'};color:#3b1d00` : 'display:none';
    b.innerHTML = html;
  }

  // ---------- Pestaña «Ayuda y licencia» ----------
  function esquelet() {
    const s = document.getElementById('t-ayu'); if (!s || s.dataset.listo) return; s.dataset.listo = '1';
    s.innerHTML = `
    <h2>Licencia</h2>
    <div id="licEstado" class="msg"></div>
    <div class="row"><div style="flex:1;min-width:240px"><label for="licCodigo">Código de licencia</label><input id="licCodigo" style="width:100%" placeholder="HAD1.…" autocomplete="off"></div>
      <button class="b lime" id="licActivar">Activar</button></div>
    <small id="licMsg"></small>
    <p><small>La licencia es <b>por un año</b>, con personalización y asistencia incluidas. Si vence, la app sigue abriendo para que pueda ver, imprimir y descargar sus horarios, pero no para cambiarlos. Para renovar, escriba por WhatsApp al número que le dio quien le vendió la app.</small></p>

    <h2>Cómo empezar</h2>
    <ol style="line-height:1.6">
      <li><b>Jornada:</b> en «Horario» ponga hora de ingreso y salida, clases por día, minutos y descansos.</li>
      <li><b>Docentes:</b> en «Nombres de docentes» escriba la lista, o llene la plantilla de Excel y cárguela en «Docentes y preferencias».</li>
      <li><b>Grupos:</b> en «Grupos» diga cuántos hay por grado y, si faltan docentes, cuáles entran tarde o salen temprano.</li>
      <li><b>Preferencias:</b> entrada y salida por docente, y bloques o sencillas por área.</li>
      <li><b>Cada mañana:</b> marque quién falta en «Horario», avise por WhatsApp o imprima.</li>
      <li>Guarde el horario en una <b>memoria</b> y haga una <b>copia de seguridad</b> de vez en cuando.</li>
    </ol>

    <h2>Copia de seguridad</h2>
    <p><small>Todo se guarda solo en este equipo. Descargue una copia cada mes (y antes de cambiar de celular o computador). La copia no incluye la licencia.</small></p>
    <div class="row"><button class="b lime" id="bkExportar">Descargar copia de seguridad</button>
      <div><label for="bkArchivo">Restaurar desde una copia</label><input type="file" id="bkArchivo" accept=".json"></div></div>
    <small id="bkMsg"></small>

    <h2>Instalar la app</h2>
    <div id="instalar"></div>

    <h2>Privacidad</h2>
    <p><small>Esta app no sube información a internet: los nombres de docentes, celulares y horarios se quedan en el navegador de su equipo. No escriba datos de estudiantes. Quien tenga acceso a su equipo podría ver esos datos; use la copia de seguridad con cuidado y no la comparta.</small></p>
    <p><small>Versión ${VERSION_APP} · 2026</small></p>`;
    document.getElementById('licActivar').onclick = activar;
    document.getElementById('bkExportar').onclick = exportar;
    document.getElementById('bkArchivo').onchange = importar;
  }
  function renderAyuda() {
    esquelet();
    const e = ESTADO, el = document.getElementById('licEstado'); if (!el) return;
    const txt = {
      'sin-config': '<b>Prototipo.</b> Esta copia todavía no tiene licencias configuradas: funciona completa y sin límite de tiempo.',
      'prueba': `<b>Prueba gratis.</b> Le quedan ${e.restan} día(s).`,
      'prueba-terminada': '<b>La prueba gratis terminó.</b> Solo puede ver, imprimir y descargar.',
      'vigente': `<b>Licencia vigente</b> ✔<br>Institución: ${esc(e.colegio || '')}${e.plan ? ' · plan ' + esc(e.plan) : ''}<br>Vence el ${e.vence ? fmt(e.vence) : ''} (en ${e.restan} días).`,
      'por-vencer': `<b>Licencia vigente, vence pronto.</b><br>Institución: ${esc(e.colegio || '')}${e.plan ? ' · plan ' + esc(e.plan) : ''}<br>Vence el ${e.vence ? fmt(e.vence) : ''} (en ${e.restan} días).`,
      'vencida': `<b>Licencia vencida</b> el ${e.vence ? fmt(e.vence) : ''}. Solo puede ver, imprimir y descargar.`,
      'invalida': `<b>Licencia no válida.</b> ${esc(e.error || '')}`
    }[e.modo];
    el.innerHTML = txt;
    document.getElementById('licActivar').disabled = !PUB;
    document.getElementById('licCodigo').disabled = !PUB;
    const ins = document.getElementById('instalar');
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), android = /android/i.test(navigator.userAgent);
    const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    ins.innerHTML = standalone ? '<small>✔ Ya está usando la app instalada.</small>'
      : `<div class="row">${instalador ? '<button class="b lime" id="btnInstalar2">Instalar en este equipo</button>' : ''}</div>
      <small>${ios ? '<b>iPhone / iPad:</b> abra esta página en <b>Safari</b> → botón Compartir (cuadro con flecha) → «Agregar a pantalla de inicio».' : android ? '<b>Android:</b> en Chrome, menú ⋮ → «Instalar app» (o «Agregar a la pantalla principal»).' : '<b>Computador:</b> en Edge o Chrome, icono de instalar a la derecha de la barra de direcciones, o menú ⋮ → «Instalar Horario al Día». También existe el instalador para Windows.'}<br>La instalación desde el navegador solo funciona si la página está publicada en una dirección segura (https).</small>`;
    const b2 = document.getElementById('btnInstalar2'); if (b2) b2.onclick = pedirInstalar;
  }

  async function activar() {
    const m = document.getElementById('licMsg'), codigo = document.getElementById('licCodigo').value.trim();
    if (!codigo) { m.textContent = 'Pegue el código de licencia.'; return; }
    try {
      const d = await verificar(codigo);
      if (dias(d.v, hoyISO()) < 0) { m.textContent = 'Ese código ya venció (' + fmt(d.v) + '). Pida uno nuevo.'; return; }
      S.licencia = codigo; if (!S.colegio || /Ejemplo/i.test(S.colegio)) S.colegio = d.c;
      guardarLocal(); await refrescar(); m.textContent = 'Licencia activada para ' + d.c + ' hasta el ' + fmt(d.v) + '.'; document.getElementById('licCodigo').value = '';
      render();
    } catch (e) { m.textContent = e.message; }
  }

  // ---------- Copia de seguridad ----------
  const EXCLUIR = ['licencia', 'primera', 'ultimaVez'];
  function exportar() {
    const datos = JSON.parse(JSON.stringify(S)); EXCLUIR.forEach(k => delete datos[k]);
    const t = JSON.stringify({ app: 'horario-al-dia', version: 1, fecha: new Date().toISOString(), datos });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' })); a.download = 'copia-horario-al-dia-' + hoyISO() + '.json'; a.click();
    S.ultimaCopia = hoyISO(); guardarLocal(); document.getElementById('bkMsg').textContent = 'Copia descargada. Guárdela en un lugar seguro (no la comparta: lleva nombres de docentes).';
  }
  async function importar(e) {
    const f = e.target.files[0], m = document.getElementById('bkMsg'); if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'horario-al-dia' || !j.datos) throw new Error('Ese archivo no es una copia de «Horario al Día».');
      if (!confirm('¿Restaurar esta copia? Reemplaza todo lo que tiene ahora en la app (docentes, horarios, memorias y registro).')) { e.target.value = ''; return; }
      const guardar = {}; EXCLUIR.forEach(k => guardar[k] = S[k]);
      Object.keys(S).forEach(k => { if (!EXCLUIR.includes(k)) delete S[k]; });
      Object.assign(S, j.datos, guardar);
      ['doc', 'gru', 'are'].forEach(k => SEL[k] = {});
      construir(); guardarLocal(); render(); m.textContent = 'Copia restaurada (' + new Date(j.fecha).toLocaleDateString('es-CO') + ').';
    } catch (err) { m.textContent = 'No se pudo restaurar: ' + err.message; }
    e.target.value = '';
  }

  // ---------- Instalar ----------
  function pedirInstalar() { if (!instalador) return; instalador.prompt(); instalador.userChoice.finally(() => { instalador = null; const b = document.getElementById('btnInstalar'); if (b) b.remove(); renderAyuda(); }); }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); instalador = e;
    if (!document.getElementById('btnInstalar')) {
      const b = document.createElement('button'); b.id = 'btnInstalar'; b.className = 'b lime'; b.textContent = 'Instalar la app'; b.onclick = pedirInstalar;
      document.querySelector('header').appendChild(b);
    }
    renderAyuda();
  });
  window.addEventListener('appinstalled', () => { instalador = null; const b = document.getElementById('btnInstalar'); if (b) b.remove(); renderAyuda(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- Enganchar con el render principal ----------
  const renderOriginal = window.render;
  window.render = function () { renderOriginal(); renderBanner(); renderAyuda(); aplicarBloqueo(); };
  window.HAD = { estado: () => ESTADO, verificar, refrescar, activar, exportar, version: VERSION_APP };
  refrescar().then(() => render());
})();
