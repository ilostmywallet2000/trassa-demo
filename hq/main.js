'use strict';
/* ===================================================================
   Каркас: вход, меню, маршруты, перерисовка, уведомления
   =================================================================== */
function who() { try { return JSON.parse(sessionStorage.getItem('hq-who')) || {}; } catch (e) { return {}; } }
function setWho(w) { try { sessionStorage.setItem('hq-who', JSON.stringify(w)); } catch (e) {} evSeen = new Set(db.events.map(e => e.id)); }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function route() { const p = location.hash.replace(/^#\/?/, '').split('/'); return { page: p[0] || '', id: p[1] ? decodeURIComponent(p[1]) : null }; }
function myKey() { const w = who(); return w.role === 'disp' ? 'disp' : w.role === 'mech' ? 'mech' : w.id; }

const NAV = {
  disp: [['pult', 'Пульт', 'pult'], ['orders', 'Заявки', 'orders'], ['chats', 'Чаты', 'chat'], ['drivers', 'Водители', 'users'], ['fleet', 'Машины', 'truck'], ['reports', 'Отчёты', 'chart'], ['settings', 'Настройки', 'gear']],
  driver: [['orders', 'Заявки', 'orders'], ['trip', 'Рейс', 'truck'], ['chats', 'Чаты', 'chat'], ['me', 'Профиль', 'user']],
  mech: [['fleet', 'Машины', 'truck'], ['drivers', 'Водители', 'users'], ['scan', 'Сканер', 'scan']],
};
const HOME = { disp: 'pult', driver: 'orders', mech: 'fleet' };
const PARENT = { order: 'orders', chat: 'chats', driver: 'drivers', vehicle: 'fleet' };
const TITLES = { pult: 'Пульт', orders: 'Заявки', order: 'Заявка', chats: 'Чаты', chat: 'Чаты', drivers: 'Водители', driver: 'Водитель', fleet: 'Машины', vehicle: 'Машина', reports: 'Отчёты', settings: 'Настройки' };
const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--acc)"/><path d="M13 31L18.5 9h3L27 31" fill="none" stroke="var(--acc-ink)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 13.5v3.2M20 20.2v3.2M20 26.9v2.6" stroke="var(--acc-ink)" stroke-width="2.4" stroke-linecap="round"/></svg>`;

/* ---------- вход ---------- */
function loginView() {
  const q = (UI.q.login || '').toLowerCase();
  const ds = db.drivers.filter(d => !q || d.name.toLowerCase().includes(q) || ((vehOf(d.id) || {}).plate || '').toLowerCase().includes(q));
  return `<div class="login">
    <section class="lg-hero">
      <div class="lg-brand">${LOGO}<div><b>ТРАССА</b><span>HQ</span></div></div>
      <h1>Заявки, рейсы<br>и кубатура —<br><em>в одном месте.</em></h1>
      <ul class="lg-feats">
        <li>${ic('orders')}<span><b>Заявки в чате</b>Счётчик рейсов в реальном времени. Дошло до нуля — «Потрачено».</span></li>
        <li>${ic('eye')}<span><b>Честная очередь</b>Заявку открывают не больше водителей, чем осталось рейсов.</span></li>
        <li>${ic('scan')}<span><b>Встроенный сканер</b>ТТН в многостраничный PDF, документы с распознаванием текста.</span></li>
        <li>${ic('link')}<span><b>Механик и автопарк</b>Посадка водителя на машину, ремонт, папка документов.</span></li>
      </ul>
      <div class="lg-road"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <small class="lg-foot">Демо-версия ${APP_VER} · Vitrina Studio · ${new Date().getFullYear()}</small>
    </section>
    <section class="lg-panel" data-keep="login">
      <h2>Войти как</h2>
      ${IN_APP ? '<p class="muted">Выберите, кто вы. Тестовый режим: данные общие для всех телефонов — что пишет диспетчер, водитель видит сразу.</p>' : '<p class="muted">Данные общие для всех телефонов и компьютеров. Войдите диспетчером здесь, а водителем — на телефоне (или во второй вкладке), и всё будет видно у обоих сразу.</p>'}
      <div class="roles">
        <button class="role disp" data-a="login" data-r="disp"><span class="r-ic">${ic('pult')}</span><div><b>Диспетчер</b><span>${esc(db.people.disp.name)} · пульт, заявки, отчёты</span></div>${ic('right')}</button>
        <button class="role mech" data-a="login" data-r="mech"><span class="r-ic">${ic('wrench')}</span><div><b>Механик</b><span>${esc(db.people.mech.name)} · машины и документы</span></div>${ic('right')}</button>
        <button class="role drv" data-a="pickDriver"><span class="r-ic">${ic('truck')}</span><div><b>Водитель</b><span>${db.drivers.length} водителей · выберите себя в списке ниже</span></div>${ic('down')}</button>
      </div>
      <div class="lg-drv-h" id="lgDrv"><div><b>Войти водителем</b><span class="muted sm">Нажмите на своё имя</span></div><label class="search sm">${ic('search')}<input id="q-login" data-q="login" placeholder="Имя или номер" value="${esc(UI.q.login || '')}"></label></div>
      <div class="lg-drv">${ds.map(d => `<button class="ldr" data-a="login" data-r="driver" data-id="${d.id}">${avatar(d)}<div><b>${esc(d.name)}</b>${statusChip(d)}</div>${plate(vehOf(d.id), 'sm')}</button>`).join('')}</div>
      ${IN_APP || matchMedia('(display-mode: standalone)').matches ? '' : `<a class="btn acc full" href="install.html">${ic('download')}Установить на телефон</a><button class="btn ghost full" data-a="newTab">${ic('link')}Открыть вторую вкладку</button>`}
    </section>
  </div>`;
}
A.pickDriver = () => {
  const el = $('#lgDrv'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $$('.ldr').forEach(x => x.classList.add('hl'));
  setTimeout(() => $$('.ldr').forEach(x => x.classList.toggle('hl', false)), 1600);
};
A.login = d => { setWho(d.r === 'driver' ? { role: 'driver', id: d.id } : { role: d.r }); location.hash = '#/' + HOME[d.r]; onRoute(); };
A.logout = () => { const r = route(); if (who().role === 'driver' && r.page === 'order') Drv.leaveOrder(r.id); try { sessionStorage.removeItem('hq-who'); } catch (e) {} location.hash = '#/login'; render(); };
A.filter = d => { UI.filter[d.k] = d.v; render(); };
A.theme = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('hq-theme', t); } catch (e) {} applyTheme(); };
function applyTheme() { let t = null; try { t = localStorage.getItem('hq-theme'); } catch (e) {} if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; document.documentElement.dataset.theme = t; const m = $('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0c0d10' : '#f3f2ee'; }
A.more = () => {
  const m = modal(`<div class="menu">${NAV.disp.slice(4).map(([k, t, i]) => `<a href="#/${k}" data-close>${ic(i)}${t}</a>`).join('')}<button data-a="theme" data-close>${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}Тема</button><button data-a="logout" data-close>${ic('logout')}Выйти</button></div>`, { title: 'Ещё' });
};
A.ack = d => {
  const x = D(d.id);
  const m = modal(`<div class="chips-pick col">${['Помощь едет', 'Механик выезжает к вам', 'Вызвали эвакуатор', 'Перезвоню через 5 минут'].map(t => `<button data-t="${t}">${t}</button>`).join('')}</div>
    <div class="form"><label>Или свой ответ<input id="akT" placeholder="Например: Геннадий будет через 40 минут"></label></div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="akGo">${ic('send')}Ответить водителю</button></div>`, { title: 'Ответ на поломку', sub: `${x.name} · ${x.breakdown.reason}` });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { m.$('#akT').value = b.dataset.t; } });
  m.$('#akGo').onclick = () => { const t = m.$('#akT').value.trim() || 'Помощь едет'; Act.ackBreakdown(x.id, t); m.close(); toast('Водитель получил ответ', t, 'ok'); };
};

/* ---------- экстренные плашки ---------- */
function sosBanners(role) {
  const ds = db.drivers.filter(d => d.status === 'broken' && d.breakdown && d.breakdown.kind === 'sos');
  return ds.map(d => {
    const v = vehOf(d.id), b = d.breakdown;
    return `<div class="sosbar ${b.ack ? 'acked' : ''}"><span class="sos-ic">${ic('alert')}</span>
      <div class="sos-b"><b>${b.ack ? 'Помощь в пути' : 'Экстренная поломка'} · ${esc(d.name)} ${v ? `<span class="sos-pl">${esc(v.plate)} ${esc(v.region)}</span>` : ''}</b>
      <span>${esc(b.reason)}${b.note ? ' — ' + esc(b.note) : ''} · ${ago(b.at)}${b.ack ? ' · ответ: ' + esc(b.ack.text) : ''}</span></div>
      <div class="sos-a">${b.coords ? `<button class="btn light sm" data-a="copyCoords" data-v="${b.coords[0].toFixed(6)}, ${b.coords[1].toFixed(6)}">${ic('pin')}Координаты</button>` : ''}<a class="btn light sm" href="${telHref(d.phone)}">${ic('phone')}Позвонить</a>${role === 'disp' && !b.ack ? `<button class="btn light strong sm" data-a="ack" data-id="${d.id}">${ic('check')}Ответить</button>` : ''}</div></div>`;
  }).join('');
}

/* ---------- оболочки ролей ---------- */
function navLinks(role, active, badges, limit) {
  const items = NAV[role].slice(0, limit || 99);
  return items.map(([k, t, i]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic(i)}<span>${t}</span>${badges[k] ? `<em>${badges[k]}</em>` : ''}</a>`).join('');
}
function dispShell(page, id) {
  const P = { pult: Disp.pult, orders: Disp.orders, order: Disp.order, chats: Disp.chats, chat: Disp.chats, drivers: Disp.drivers, driver: Disp.driver, fleet: Disp.fleet, vehicle: Disp.vehicle, reports: Disp.reports, settings: Disp.settings };
  if (!P[page]) page = 'pult';
  const active = PARENT[page] || page;
  const badges = { pult: db.drivers.filter(d => d.breakdown && d.breakdown.kind === 'sos' && !d.breakdown.ack).length || 0, chats: db.chats.reduce((s, c) => s + unreadFor('disp', c), 0) };
  const t = new Date();
  const full = page === 'chats' || page === 'chat';
  return `<div class="shell disp">
    <aside class="side">
      <a class="brand" href="#/pult">${LOGO}<div><b>ТРАССА</b><span>HQ</span></div></a>
      <nav class="snav">${navLinks('disp', active, badges)}</nav>
      <div class="side-f">
        <div class="me">${avatar({ id: 'disp', name: db.people.disp.name })}<div><b>${esc(db.people.disp.name)}</b><span>Диспетчер</span></div></div>
        <div class="row gap"><button class="icon-btn" data-a="theme" title="Тема">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button><button class="icon-btn" data-a="logout" title="Выйти">${ic('logout')}</button></div>
      </div>
    </aside>
    <main class="main ${full ? 'full' : ''}" data-keep="main-${location.hash}">
      <header class="topbar"><div class="tb-l"><a class="brand mob-only" href="#/pult">${LOGO}</a><h1>${TITLES[page]}</h1></div>
        <div class="tb-r">${db.settings.bots ? `<a class="chip ok live" href="#/settings"><i></i>демо-движение</a>` : ''}<span class="clock">${WD[t.getDay()]}, ${t.getDate()} ${MONTHS[t.getMonth()]} · <b>${fmtTime(t)}</b></span></div></header>
      ${sosBanners('disp')}
      <div class="page p-${page}">${P[page](id)}</div>
    </main>
    <nav class="tabbar">${navLinks('disp', active, badges, 4)}<button data-a="more" class="${['fleet', 'reports', 'settings'].includes(active) ? 'on' : ''}">${ic('more')}<span>Ещё</span></button></nav>
  </div>`;
}
function mobShell(role, page, id) {
  const w = who();
  let P, badges = {}, sub = '', head = '';
  if (role === 'driver') {
    const d = D(w.id), v = vehOf(w.id);
    P = { orders: Drv.home, order: Drv.order, trip: Drv.trip, chats: Drv.chats, chat: Drv.chat, me: Drv.me };
    const at = activeTrip(w.id);
    badges = { chats: chatsFor(w.id).reduce((s, c) => s + (c.virtual ? 0 : unreadFor(w.id, c)), 0), trip: at ? '1' : 0 };
    head = `<div class="mh-who">${avatar(d, 'sm')}<div><b>${esc(d.name)}</b><span><i class="sdot ${STATUS[statusKey(d)].c}"></i>${STATUS[statusKey(d)].t}</span></div></div>${plate(v, 'sm')}`;
  } else {
    P = { fleet: Mech.fleet, vehicle: Mech.vehicle, drivers: Mech.drivers, driver: Mech.driver, scan: Mech.scan };
    head = `<div class="mh-who"><span class="ava sm grp">${ic('wrench')}</span><div><b>${esc(db.people.mech.name)}</b><span>Механик</span></div></div><button class="icon-btn" data-a="logout" title="Выйти">${ic('logout')}</button>`;
  }
  if (!P[page]) page = HOME[role];
  const active = PARENT[page] && role === 'driver' && page === 'order' ? 'orders' : PARENT[page] || page;
  const chatFull = page === 'chat';
  return `<div class="shell mob ${role}">
    <div class="mob-in ${chatFull ? 'fixed' : ''}">
      <header class="mob-h">${role === 'mech' ? LOGO : ''}${head}<button class="icon-btn" data-a="theme" title="Тема">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button></header>
      ${role === 'mech' ? '' : ''}
      <div class="mob-page p-${page} ${chatFull ? 'full' : ''}" data-keep="mob-${location.hash}">${P[page](id)}</div>
      <nav class="tabbar show">${navLinks(role, active, badges)}</nav>
    </div>
    <aside class="mob-aside">${role === 'driver' ? `<b>Приложение водителя</b><p>Так оно выглядит на телефоне. На другом телефоне или во второй вкладке войдите диспетчером — заявки, статусы и сообщения обновляются у обоих сразу.</p>` : `<b>Приложение механика</b><p>Механик не видит заявок и чатов: только машины, посадку водителей и документы.</p>`}<button class="btn soft" data-a="newTab">${ic('link')}Вторая вкладка</button><button class="btn ghost" data-a="logout">${ic('logout')}Сменить роль</button></aside>
  </div>`;
}

/* ---------- перерисовка с сохранением ввода и прокрутки ---------- */
function snapshot() {
  const s = { vals: {}, scroll: {}, left: {}, bottom: {}, focus: null };
  const a = document.activeElement;
  if (a && a.id && $('#app').contains(a)) s.focus = { id: a.id, ss: a.selectionStart, se: a.selectionEnd };
  $$('#app input[id], #app textarea[id], #app select[id]').forEach(el => { if (el.type !== 'file' && el.type !== 'checkbox') s.vals[el.id] = el.value; });
  $$('#app [data-keep]').forEach(el => { s.scroll[el.dataset.keep] = el.scrollTop; s.left[el.dataset.keep] = el.scrollLeft; s.bottom[el.dataset.keep] = el.scrollHeight - el.scrollTop - el.clientHeight < 80; });
  s.win = window.scrollY;
  return s;
}
function restore(s) {
  Object.entries(s.vals).forEach(([id, v]) => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; });
  $$('#app [data-keep]').forEach(el => {
    const k = el.dataset.keep;
    if (el.hasAttribute('data-bottom')) { if (!(k in s.scroll) || s.bottom[k]) el.scrollTop = el.scrollHeight; else el.scrollTop = s.scroll[k]; }
    else if (k in s.scroll) el.scrollTop = s.scroll[k];
    if (s.left[k]) el.scrollLeft = s.left[k];
  });
  if (s.focus) { const el = document.getElementById(s.focus.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(s.focus.ss, s.focus.se); } catch (e) {} } }
  if (s.sameRoute) window.scrollTo(0, s.win);
}
let lastHash = '', pressing = false, renderLater = false;
document.addEventListener('pointerdown', () => { pressing = true; }, true);
document.addEventListener('pointerup', () => { setTimeout(() => { pressing = false; if (renderLater) { renderLater = false; render(); } }, 60); }, true);
document.addEventListener('pointercancel', () => { pressing = false; }, true);
function render() {
  if (pressing) { renderLater = true; return; }  // не менять кнопки под пальцем — иначе нажатие теряется
  const w = who(), app = $('#app'), s = snapshot();
  s.sameRoute = lastHash === location.hash; lastHash = location.hash;
  if (!w.role || (w.role === 'driver' && !D(w.id))) { document.body.dataset.role = 'login'; app.innerHTML = loginView(); restore(s); return; }
  const { page, id } = route();
  document.body.dataset.role = w.role;
  app.innerHTML = w.role === 'disp' ? dispShell(page, id) : mobShell(w.role, page, id);
  restore(s);
  if (!s.sameRoute) { const sc = $('#app .main') || $('#app .mob-page'); if (sc && !sc.hasAttribute('data-bottom')) sc.scrollTop = 0; window.scrollTo(0, 0); }
}

/* ---------- маршруты и блокировка заявок ---------- */
let prevRoute = null;
function onRoute() {
  const w = who(), r = route();
  if (w.role === 'driver') {
    if (prevRoute && prevRoute.page === 'order' && (r.page !== 'order' || r.id !== prevRoute.id)) Drv.leaveOrder(prevRoute.id);
    if (r.page === 'order' && r.id && (!prevRoute || prevRoute.page !== 'order' || prevRoute.id !== r.id)) Drv.enterOrder(r.id);
  }
  if (w.role === 'mech' && ['orders', 'order', 'chats', 'chat', 'pult', 'reports'].includes(r.page)) { location.hash = '#/fleet'; return; }
  prevRoute = r; render();
}
window.addEventListener('hashchange', onRoute);
window.addEventListener('pagehide', () => { const r = route(); if (who().role === 'driver' && r.page === 'order') Drv.leaveOrder(r.id); });

/* ---------- уведомления из других вкладок ---------- */
let evSeen = new Set(db.events.map(e => e.id));   // уже показанные события (по id — часы на телефонах могут отличаться)
const EV_TITLE = { take: 'Рейс взят', done: 'Рейс выполнен', sos: 'ЭКСТРЕННАЯ ПОЛОМКА', break: 'Поломка', msg: 'Новое сообщение', order: 'Новая заявка', confirm: 'Рейс подтверждён', reject: 'Рейс отклонён', refill: 'Пополнение рейсов', tapin: 'Машина', clock: 'Смена', ack: 'Ответ диспетчера', cancel: 'Отказ от рейса', 'assign-trip': 'Вам назначен рейс', veh: 'Машина' };
onChange(() => {
  const key = myKey();
  if (key) {
    const r = route();
    if (Cloud.prime) { Cloud.prime = false; evSeen = new Set(db.events.map(e => e.id)); }   // первая загрузка с сервера — старое не показываем
    const fresh = db.events.filter(e => !evSeen.has(e.id) && e.tab !== TAB_ID && (e.to || []).includes(key) && now() - e.at < 30 * MIN);
    db.events.forEach(e => evSeen.add(e.id));
    if (fresh.length) {
      const show = fresh.filter(e => !(e.kind === 'msg' && r.page === 'chat' && r.id === e.chatId)).slice(-3);
      show.forEach(e => toast(EV_TITLE[e.kind] || 'Событие', e.text, e.kind === 'sos' ? 'bad' : ['done', 'confirm', 'ack', 'assign-trip'].includes(e.kind) ? 'ok' : ''));
      if (show.length) beep(show.some(e => e.kind === 'sos') ? 'sos' : 'n');
      if (show.some(e => e.kind === 'sos') && navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
    }
    // водитель: если место в заявке освободилось — открыть
    const w = who();
    if (w.role === 'driver' && r.page === 'order' && Drv.lock[r.id] && !Drv.lock[r.id].ok) {
      const o = O(r.id);
      if (o && orderLeft(o) > viewers(o, w.id).length && o.status === 'open') { Drv.enterOrder(r.id); if (Drv.lock[r.id].ok) toast('Место освободилось', 'Заявка открыта для вас', 'ok'); }
    }
  }
  render();
});

/* ---------- клики ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]');
  if (a && !a.disabled && !a.closest('#scanner')) { const fn = A[a.dataset.a]; if (fn) { e.preventDefault(); fn(a.dataset, a, e); return; } }
  const h = e.target.closest('[data-href]');
  if (h && !e.target.closest('a, button, input, select, label')) go(h.dataset.href);
});
document.addEventListener('input', e => { const q = e.target.dataset && e.target.dataset.q; if (q) { UI.q[q] = e.target.value; render(); } });

/* ---------- таймеры ---------- */
setInterval(() => {
  const w = who(), r = route();
  const ae = document.activeElement, typing = ae && $('#app').contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName) && ae.type !== 'checkbox';
  if (w.role === 'driver') {
    if (!db.presence || !(db.presence[w.id] > now() + 15e3)) tx(db => { db.presence = db.presence || {}; db.presence[w.id] = now() + 30e3; });
    if (r.page === 'order' && Drv.lock[r.id]) {
      const L = Drv.lock[r.id], o = O(r.id);
      if (L.ok && !L.mine && o) { const exp = ((db.locks || {})[o.id] || {})[w.id] || 0; if (exp - now() < 35e3) Drv.enterOrder(r.id); }
      else if (!L.ok) Drv.enterOrder(r.id);
    }
  }
  if (!typing && w.role) render();
}, 4000);

/* кнопка «Назад» на Android: закрыть сканер или окно, потом шаг назад по экранам */
window.appBack = () => {
  if (!$('#scanner').hidden) { Scanner.close(); return true; }
  const ms = $$('#modal-root .modal-wrap');
  if (ms.length) { const x = ms[ms.length - 1].querySelector('[data-close]'); if (x) x.click(); return true; }
  const w = who(), r = route();
  if (w.role && r.page && r.page !== HOME[w.role]) { history.back(); return true; }
  return false;
};

/* проверка новой версии: старое приложение на телефоне не видит новых функций — подсказываем обновиться */
const SITE = 'https://ilostmywallet2000.github.io/trassa-demo/hq/';
const verNum = v => String(v || '0').split('.').reduce((a, x) => a * 1000 + (+x || 0), 0);
async function checkUpdate() {
  if (document.getElementById('upd')) return;
  try {
    const r = await fetch(SITE + 'version.json?t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    if (verNum(j.ver) <= verNum(APP_VER)) return;
    const b = document.createElement('div'); b.id = 'upd';
    b.innerHTML = `<i>${ic('bell')}</i><div><b>Вышла новая версия ${esc(j.ver)}</b><span>${IN_APP ? 'Скачайте и установите поверх — данные не пропадут' : 'Нажмите «Обновить» — займёт пару секунд'}</span></div>`
      + (IN_APP ? `<a class="btn acc sm" href="${SITE}install.html">Скачать</a>` : `<button class="btn acc sm" id="upd-go">Обновить</button>`);
    document.body.appendChild(b);
    const go = document.getElementById('upd-go');
    if (go) go.onclick = async () => {
      go.disabled = true; go.textContent = 'Обновляем…';
      try {   // новый обработчик офлайна должен успеть встать, иначе страница откроется старой
        const sw = navigator.serviceWorker, rs = await sw.getRegistrations();
        await Promise.all(rs.map(x => x.update()));
        if (rs.some(x => x.installing || x.waiting)) await new Promise(r => { sw.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 4000); });
      } catch (e) {}
      location.replace(location.pathname + '?u=' + Date.now() + location.hash);
    };
  } catch (e) { /* нет интернета — проверим позже */ }
}
setTimeout(checkUpdate, 3000);
setInterval(checkUpdate, 15 * 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });

applyTheme();
if (!location.hash) location.hash = who().role ? '#/' + HOME[who().role] : '#/login';
onRoute();
