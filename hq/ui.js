'use strict';
/* ===================================================================
   Общие компоненты: уведомления, окна, карточки, чаты, профили,
   документы (скан, загрузка, просмотр, «поделиться»)
   =================================================================== */
const UI = { tab: {}, filter: {}, q: {} };   // состояние интерфейса этой вкладки
const A = {};                                // действия по data-a

/* ---------- уведомления ---------- */
function toast(title, sub, kind) {
  const box = $('#toasts'), t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.innerHTML = `<i>${ic(kind === 'bad' ? 'alert' : kind === 'ok' ? 'check' : 'bell')}</i><div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  box.appendChild(t); setTimeout(() => t.classList.add('in'), 20);
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 6500 : 4200);
  t.onclick = () => t.remove();
}
let audioCtx = null;
function beep(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = kind === 'sos' ? [880, 660, 880, 660, 880] : [740, 990];
    seq.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * .16;
      o.type = kind === 'sos' ? 'square' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'sos' ? .08 : .05, t + .02); g.gain.linearRampToValueAtTime(0, t + .14);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + .15);
    });
  } catch (e) {}
}
async function copyText(t, what) {
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {}
  if (!ok) { try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e) {} }
  toast(ok ? 'Скопировано' : 'Не удалось скопировать', ok ? (what ? what + ': ' : '') + String(t).slice(0, 70) : 'Выделите и скопируйте вручную', ok ? 'ok' : 'bad');
  if (ok && navigator.vibrate) navigator.vibrate(30);
}

/* ---------- приложение Android: файлы через меню телефона ---------- */
const IN_APP = !!window.TrassaApp;
function blobToB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); }); }
async function saveBlob(blob, name) {
  if (IN_APP) { const ok = window.TrassaApp.save(await blobToB64(blob), name, blob.type || 'application/octet-stream'); toast(ok ? 'Файл сохранён' : 'Не удалось сохранить', ok ? 'Папка «Загрузки» → «Трасса HQ»' : name, ok ? 'ok' : 'bad'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.parentNode && a.parentNode.removeChild(a); }, 2000);
}
function pdfView(url, thumb, pages) {
  if (!IN_APP) return `<iframe class="doc-frame" src="${url}" title="PDF"></iframe>`;
  return `<div class="pdf-prev">${thumb ? `<img src="${thumb}" alt="">` : `<span class="doc-ph">${ic('file')}<b>PDF</b></span>`}<span>${ic('file')}PDF · ${pages || 1} стр. — нажмите «Открыть», чтобы посмотреть все страницы</span></div>`;
}
/* в приложении ссылки «Скачать» и «Открыть» на файлы идут через телефон */
document.addEventListener('click', async e => {
  if (!IN_APP) return;
  const a = e.target.closest('a[href^="blob:"]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const blob = await fetch(a.href).then(r => r.blob());
  const name = a.getAttribute('download') || ('Документ' + (blob.type === 'application/pdf' ? '.pdf' : '.jpg'));
  if (a.hasAttribute('download')) saveBlob(blob, name);
  else window.TrassaApp.open(await blobToB64(blob), name, blob.type || 'application/pdf');
}, true);

/* ---------- окна ---------- */
function modal(html, opts = {}) {
  const root = $('#modal-root'), w = document.createElement('div');
  w.className = 'modal-wrap' + (opts.wide ? ' wide' : '') + (opts.full ? ' full' : '');
  w.innerHTML = `<div class="modal-bg" data-close></div><div class="modal" role="dialog">${opts.title ? `<div class="modal-h"><div><b>${esc(opts.title)}</b>${opts.sub ? `<span>${esc(opts.sub)}</span>` : ''}</div><button class="icon-btn" data-close aria-label="Закрыть">${ic('x')}</button></div>` : ''}<div class="modal-b">${html}</div></div>`;
  // последний ряд кнопок окна — всегда виден внизу (прилипает), даже если окно длиннее экрана
  const mb = w.querySelector('.modal-b'), last = mb && mb.lastElementChild;
  if (last && last.matches('.row, .doc-acts, .acts') && last.querySelector('button, .btn')) { last.classList.add('m-foot'); mb.classList.add('has-foot'); }
  root.appendChild(w); setTimeout(() => w.classList.add('in'), 20);
  const close = () => { w.classList.remove('in'); setTimeout(() => w.remove(), 220); opts.onClose && opts.onClose(); };
  w.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  const f = w.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
  return { el: w, close, $: s => w.querySelector(s) };
}
function confirmBox(title, text, okText, kind) {
  return new Promise(res => {
    const m = modal(`<p class="muted">${esc(text)}</p><div class="row end gap"><button class="btn ghost" data-r="0">Отмена</button><button class="btn ${kind || 'acc'}" data-r="1">${esc(okText || 'OK')}</button></div>`, { title, onClose: () => res(false) });
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { res(b.dataset.r === '1'); m.close(); } });   // сначала ответ, потом закрыть (закрытие отвечает «нет»)
  });
}

/* ---------- мелкие компоненты ---------- */
function avatar(d, size = '') {
  if (!d) return `<span class="ava ${size}">?</span>`;
  return `<span class="ava ${size}" style="--h:${hue(d.id + d.name)}">${esc(initials(d.name))}</span>`;
}
function plate(v, size = '') {
  if (!v) return `<span class="plate none ${size}">без машины</span>`;
  const p = v.plate || '';
  return `<span class="plate ${size}"><b>${esc(p.slice(0, 1))}<em>${esc(p.slice(1, 4))}</em>${esc(p.slice(4))}</b><i>${esc(v.region)}<small>RUS</small></i></span>`;
}
function statusChip(d, withTime) {
  const s = STATUS[statusKey(d)];
  return `<span class="st ${s.c}"><i></i>${s.t}${withTime && d.since ? ` <small>· ${d.status === 'off' ? ago(d.since) : dur(now() - d.since)}</small>` : ''}</span>`;
}
const chip = (t, c = '') => `<span class="chip ${c}">${t}</span>`;
const tripChip = t => chip(TRIP_STATE[t.state].t, TRIP_STATE[t.state].c);
const vehChip = v => v.state === 'repair' ? chip(ic('wrench') + 'Ремонт', 'bad') : chip(ic('check') + 'Готова', 'ok');
const empty = (icon, title, sub, extra = '') => `<div class="empty">${ic(icon)}<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}${extra}</div>`;
// плитка-цифра; если передан k — это кнопка, которая открывает подробности (A.stat)
const kpi = (label, value, sub, cls = '', k = '', id = '') => k
  ? `<button class="kpi click ${cls}" data-a="stat" data-k="${k}"${id ? ` data-id="${id}"` : ''}><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}<i class="kpi-go">${ic('right')}</i></button>`
  : `<div class="kpi ${cls}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

/* ячейки рейсов: каждая клетка — рейс */
function tripCells(o) {
  const ts = orderTrips(o.id).filter(t => ACTIVE.includes(t.state));
  const done = ts.filter(t => t.state === 'done').length, work = ts.filter(t => t.state === 'confirmed').length, pend = ts.filter(t => t.state === 'pending').length;
  if (o.total > 24) {
    const p = x => (x / o.total * 100).toFixed(1) + '%';
    return `<div class="bar"><i class="ok" style="width:${p(done)}"></i><i class="info" style="width:${p(work)}"></i><i class="acc" style="width:${p(pend)}"></i></div>`;
  }
  const cells = [];
  for (let i = 0; i < o.total; i++) cells.push(i < done ? 'ok' : i < done + work ? 'info' : i < done + work + pend ? 'acc' : '');
  return `<div class="cells">${cells.map(c => `<i class="${c}"></i>`).join('')}</div>`;
}
function orderCard(o, ctx = {}) {
  const left = orderLeft(o), spent = isSpent(o), closed = o.status === 'closed';
  const vw = viewers(o, ctx.did);
  const lastTop = (o.topups || []).slice(-1)[0];
  const fresh = lastTop && now() - lastTop.at < 2 * HOUR;
  const mine = ctx.did && db.trips.filter(t => t.orderId === o.id && t.driverId === ctx.did && ACTIVE.includes(t.state)).length;
  const href = ctx.href || `#/order/${o.id}`;
  return `<a class="ocard ${spent ? 'spent' : ''} ${closed ? 'closed' : ''} ${ctx.compact ? 'compact' : ''}" href="${href}">
    <div class="oc-h"><span class="oc-no">№${o.no}</span><b>${esc(o.cargo)}</b>${fresh ? `<span class="chip acc pulse">${ic('refill')}+${lastTop.n} пополнение</span>` : ''}</div>
    <div class="oc-sub">${esc(o.client)} · ${fmtDay(new Date(o.date + 'T' + (o.time || '08:00')).getTime())}${timeSpan(o) ? ' ' + esc(timeSpan(o)) : ''}</div>
    <div class="oc-route"><div><i class="dot a"></i><span>${esc(o.from.addr)}</span></div><div><i class="dot b"></i><span>${esc(o.to.addr)}</span></div></div>
    <div class="oc-count">
      <div class="oc-left"><b>${left}</b><span>${closed ? 'закрыта' : 'осталось<br>из ' + o.total}</span></div>
      <div class="oc-cells">${tripCells(o)}<div class="oc-meta">${ic('cube')}${o.m3} м³/рейс${ctx.did && orderRates(o).rd ? ` · <b class="oc-rate">${rub(orderRates(o).rd)}/${orderRates(o).u}</b>` : ''}${vw.length && !spent ? ` · <span class="eye">${ic('eye')}${vw.length} ${plural(vw.length, 'смотрит', 'смотрят', 'смотрят')}</span>` : ''}${mine ? ` · <span class="mine">ваших: ${mine}</span>` : ''}</div></div>
    </div>
    ${spent ? '<div class="stamp">ПОТРАЧЕНО</div>' : ''}
  </a>`;
}
function routeBlock(o, big) {
  const pt = (p, kind, contact) => `
    <div class="rt ${kind}">
      <div class="rt-dot"><i></i></div>
      <div class="rt-body">
        <small>${kind === 'a' ? 'Погрузка' : 'Выгрузка'}</small>
        <b>${esc(p.addr)}</b>
        <code>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</code>
        <div class="rt-acts">
          <button class="btn ${big ? 'acc' : 'soft'} sm" data-a="copyCoords" data-v="${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}">${ic('copy')}Копировать координаты</button>
          <a class="btn soft sm" href="https://yandex.ru/maps/?rtext=~${p.lat},${p.lng}&rtt=auto" target="_blank" rel="noopener">${ic('nav')}Маршрут</a>
          ${contact && contact.phone ? `<a class="btn soft sm" href="${telHref(contact.phone)}">${ic('phone')}${esc(contact.phone)}</a>` : ''}
        </div>
        ${contact && contact.name ? `<span class="rt-contact">${ic('user')}${esc(contact.name)}</span>` : ''}
      </div>
    </div>`;
  return `<div class="route ${big ? 'big' : ''}">${pt(o.from, 'a', o.contactFrom)}${pt(o.to, 'b', o.contactTo)}</div>`;
}
A.copyCoords = d => copyText(d.v, 'Координаты');
A.copy = d => copyText(d.v, d.what || '');

/* ---------- чаты ---------- */
function unreadFor(key, c) {
  const r = Math.max((db.reads[key] || {})[c.id] || 0, db.seededAt || 0);
  return db.messages.filter(m => m.chatId === c.id && m.at > r && m.from !== key && m.from !== 'sys').length;
}
function chatsFor(key) {
  const list = key === 'disp' ? db.chats.slice() : db.chats.filter(c => chatHas(c, key));
  if (key !== 'disp' && !list.some(c => c.kind === 'dm')) list.push({ id: 'dm-' + key, kind: 'dm', driverId: key, title: '', virtual: true });
  const last = c => { const m = db.messages.filter(x => x.chatId === c.id).slice(-1)[0]; return m ? m.at : 0; };
  const rank = c => c.kind === 'all' ? 3 : c.kind === 'group' ? 2 : 1;
  return list.sort((a, b) => (key === 'disp' ? 0 : rank(b) - rank(a)) || last(b) - last(a));
}
function msgPreview(m) {
  if (!m) return 'Нет сообщений';
  if (m.kind === 'order') { const o = O(m.orderId); return o ? `📋 Заявка №${o.no}: ${o.cargo}` : 'Заявка'; }
  const who = m.from === 'disp' ? 'Диспетчер: ' : m.from === 'sys' ? '' : (D(m.from) ? firstName(D(m.from).name) + ': ' : '');
  return who + m.text;
}
function chatList(key, activeId) {
  const items = chatsFor(key);
  return `<div class="clist">${items.map(c => {
    const m = db.messages.filter(x => x.chatId === c.id).slice(-1)[0], un = c.virtual ? 0 : unreadFor(key, c);
    const title = key !== 'disp' && c.kind === 'dm' ? 'Диспетчер' : chatTitle(c);
    const icon = c.kind === 'all' ? `<span class="ava grp acc">${ic('users')}</span>` : c.kind === 'group' ? `<span class="ava grp">${ic('hash')}</span>` : key === 'disp' ? avatar(D(c.driverId)) : `<span class="ava grp disp">${ic('pult')}</span>`;
    const sub = c.kind === 'all' ? 'все водители' : c.kind === 'group' ? `${(c.members || []).length} ${plural((c.members || []).length, 'участник', 'участника', 'участников')}` : '';
    const dd = c.kind === 'dm' && key === 'disp' && D(c.driverId);
    return `<a class="citem ${c.id === activeId ? 'on' : ''}" href="#/chat/${c.id}">${icon}<div class="ci-b"><div class="ci-t"><b>${esc(title)}</b>${dd ? `<i class="sdot ${STATUS[statusKey(dd)].c}"></i>` : ''}<small>${m ? fmtWhen(m.at) : ''}</small></div><div class="ci-s"><span>${esc(msgPreview(m))}</span>${un ? `<em>${un}</em>` : sub ? `<small>${sub}</small>` : ''}</div></div></a>`;
  }).join('')}</div>`;
}
function chatView(key, chatId, opts = {}) {
  let c = C(chatId);
  if (!c && chatId === 'dm-' + key) c = { id: chatId, kind: 'dm', driverId: key, title: '', virtual: true };
  // диспетчер пишет водителю впервые — чата ещё нет: открываем пустой, он создастся с первым сообщением
  if (!c && key === 'disp' && chatId.startsWith('dm-') && D(chatId.slice(3))) c = dmChat(chatId.slice(3)) || { id: chatId, kind: 'dm', driverId: chatId.slice(3), title: '', virtual: true };
  if (!c) return empty('chat', 'Чат не найден');
  const ms = db.messages.filter(m => m.chatId === c.id);
  const title = key !== 'disp' && c.kind === 'dm' ? 'Диспетчер' : chatTitle(c);
  const dd = c.kind === 'dm' && D(c.driverId);
  const sub = c.kind === 'all' ? `${db.drivers.length} водителей` : c.kind === 'group' ? (c.members || []).map(id => firstName((D(id) || {}).name)).join(', ') : key === 'disp' && dd ? STATUS[statusKey(dd)].t + (vehOf(dd.id) ? ' · ' + vehOf(dd.id).plate + ' ' + vehOf(dd.id).region : '') : 'Фёдор Ямщиков';
  let lastDay = '';
  const body = ms.map(m => {
    let sep = '';
    const dk = isoDay(m.at); if (dk !== lastDay) { lastDay = dk; sep = `<div class="daysep"><span>${fmtDay(m.at)}</span></div>`; }
    if (m.kind === 'order') {
      const o = O(m.orderId); if (!o) return sep;
      return sep + `<div class="msg order ${m.from === key ? 'me' : ''}"><div class="m-card">${orderCard(o, { did: key === 'disp' ? null : key, compact: true })}</div><small class="m-time">${fmtTime(m.at)}</small></div>`;
    }
    if (m.from === 'sys' || m.kind === 'sys') return sep + `<div class="msg sys"><span>${esc(m.text)}</span></div>`;
    const mine = m.from === key;
    const author = m.from === 'disp' ? 'Диспетчер' : (D(m.from) || {}).name || '';
    const showAuthor = !mine && c.kind !== 'dm';
    const coords = m.coords ? `<button class="m-coords" data-a="copyCoords" data-v="${m.coords[0].toFixed(6)}, ${m.coords[1].toFixed(6)}">${ic('pin')}${m.coords[0].toFixed(5)}, ${m.coords[1].toFixed(5)} · копировать</button>` : '';
    return sep + `<div class="msg ${mine ? 'me' : ''} ${m.kind === 'break' ? 'brk' : ''}">${!mine && c.kind !== 'dm' ? (m.from === 'disp' ? `<span class="ava sm grp disp">${ic('pult')}</span>` : avatar(D(m.from), 'sm')) : ''}<div class="bubble">${showAuthor ? `<b>${esc(author)}</b>` : ''}<p>${esc(m.text)}</p>${coords}<small>${fmtTime(m.at)}</small></div></div>`;
  }).join('');
  const back = opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="Назад">${ic('back')}</a>` : '';
  const actions = key === 'disp' ? `${c.kind === 'dm' && dd ? `<a class="icon-btn" href="${telHref(dd.phone)}" title="Позвонить">${ic('phone')}</a><a class="icon-btn" href="#/driver/${dd.id}" title="Профиль">${ic('user')}</a>` : ''}<button class="btn acc sm" data-a="newOrder" data-chat="${c.id}">${ic('plus')}Заявка</button>` : (c.kind === 'dm' ? `<a class="icon-btn" href="${telHref(db.people.disp.phone)}" title="Позвонить диспетчеру">${ic('phone')}</a>` : '');
  return `<div class="chat">
    <div class="chat-h">${back}<div class="ch-t"><b>${esc(title)}</b><span>${esc(sub)}</span></div><div class="ch-a">${actions}</div></div>
    <div class="msgs" data-keep="msgs-${c.id}" data-bottom>${body || empty('chat', 'Сообщений пока нет', 'Напишите первым')}</div>
    ${key === 'disp' || who().role === 'driver' ? `<div class="quick" data-keep="quick-${c.id}">${quickList(key === 'disp' ? 'disp' : 'driver').map(t => `<button type="button" data-a="quick" data-chat="${c.id}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <form class="composer" data-send="${c.id}"><textarea id="cmp-${c.id}" rows="1" placeholder="Сообщение…" enterkeyhint="send"></textarea><button class="send" aria-label="Отправить">${ic('send')}</button></form>
  </div>`;
}
let quickLast = { v: '', at: 0 };
A.quick = d => {   // быстрый ответ — отправляется сразу (повторное нажатие в течение секунды не дублирует)
  if (quickLast.v === d.chat + d.v && now() - quickLast.at < 1200) return;
  quickLast = { v: d.chat + d.v, at: now() };
  const w = who(), key = w.role === 'disp' ? 'disp' : w.id;
  Act.send(d.chat, key, d.v); Act.markRead(key, d.chat);
  if (navigator.vibrate) navigator.vibrate(12);
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-send]'); if (!f) return;
  e.preventDefault();
  const ta = f.querySelector('textarea'), t = ta.value.trim(); if (!t) return;
  const w = who(); const key = w.role === 'disp' ? 'disp' : w.id;
  ta.value = '';
  Act.send(f.dataset.send, key, t);
  if (C(f.dataset.send)) Act.markRead(key, f.dataset.send);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('form[data-send] textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('input', e => { if (e.target.matches('form[data-send] textarea')) { e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; } });

/* ---------- документы ---------- */
const docIcon = doc => doc.thumb ? `<img src="${doc.thumb}" alt="">` : `<span class="doc-ph">${ic('file')}<b>${doc.mime === 'application/pdf' ? 'PDF' : 'ФАЙЛ'}</b></span>`;
function docGrid(owner, docs, canEdit) {
  const add = canEdit ? `<div class="doc add"><button data-a="addDoc" data-t="${owner.type}" data-id="${owner.id}" data-m="scan">${ic('scan')}<b>Сканировать</b><span>камера + распознавание</span></button><button data-a="addDoc" data-t="${owner.type}" data-id="${owner.id}" data-m="upload">${ic('upload')}<b>Загрузить</b><span>фото или PDF</span></button></div>` : '';
  const exp = d => { if (!d.expires) return ''; const days = Math.round((new Date(d.expires).getTime() - now()) / DAY); return days < 0 ? chip('просрочен', 'bad') : days < 30 ? chip(`истекает через ${days} дн.`, 'acc') : `<small class="muted">до ${new Date(d.expires).toLocaleDateString('ru-RU')}</small>`; };
  return `<div class="docs">${add}${docs.slice().reverse().map(d => `
    <button class="doc" data-a="openDoc" data-t="${owner.type}" data-id="${owner.id}" data-doc="${d.id}">
      <div class="doc-img">${docIcon(d)}${d.pages > 1 ? `<em>${d.pages} стр.</em>` : ''}</div>
      <b>${esc(d.title || d.kind)}</b><span>${esc(d.kind)}${d.number ? ' · ' + esc(d.number) : ''}</span>${exp(d)}
    </button>`).join('')}</div>`;
}
function ownerObj(t, id) { return t === 'driver' ? D(id) : V(id); }
function guessKind(text, kinds) {
  const t = (text || '').toLowerCase();
  const map = [['паспорт', 'Паспорт'], ['водительское', 'Водительское удостоверение'], ['медицин', 'Медсправка'], ['снилс', 'СНИЛС'], ['страхов', 'СНИЛС'], ['идентификац', 'ИНН'], ['тахограф', 'Карта тахографа'], ['трудов', 'Трудовой договор'],
    ['регистрации транспорт', 'СТС'], ['паспорт транспорт', 'ПТС'], ['осаго', 'ОСАГО'], ['страховой полис', 'ОСАГО'], ['диагностическ', 'Диагностическая карта']];
  for (const [k, v] of map) if (t.includes(k) && kinds.includes(v)) return v;
  return kinds[0];
}
function bestFor(kind, fields) {
  const dates = fields.filter(f => f.type === 'date').map(f => f.iso).sort(), today = isoDay(now());
  const num = kind === 'ОСАГО' ? fields.find(f => f.type === 'policy') : kind === 'СНИЛС' ? fields.find(f => f.type === 'snils') : kind === 'ИНН' ? fields.find(f => f.type === 'inn') : fields.find(f => f.type === 'series') || fields.find(f => f.type === 'policy');
  return { number: num ? num.value : '', expires: dates.filter(d => d > today).slice(-1)[0] || '' };
}
A.addDoc = d => addDocFlow({ type: d.t, id: d.id }, d.m);
function addDocFlow(owner, mode) {
  const kinds = owner.type === 'driver' ? DRV_DOC_KINDS : VEH_DOC_KINDS;
  if (mode === 'scan') {
    Scanner.open({ title: 'Документ', multi: true, ocr: true, saveLabel: 'Дальше', onDone: r => docMeta(owner, kinds, { pages: r.pages, thumbs: r.thumbs, text: r.text, fields: r.fields }) });
    return;
  }
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/*,application/pdf';
  inp.onchange = async () => {
    const files = Array.from(inp.files || []); if (!files.length) return;
    const pdf = files.find(f => f.type === 'application/pdf');
    if (pdf) return docMeta(owner, kinds, { blob: pdf, name: pdf.name, text: '', fields: [] });
    const pages = [];
    for (const f of files) pages.push(await fileToCanvas(f));
    docMeta(owner, kinds, { pages, thumbs: pages.map(c => Scanner.thumb(c)), text: '', fields: [] });
  };
  inp.click();
}
function fileToCanvas(f) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => { const k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c); };
    im.onerror = rej; im.src = url;
  });
}
async function pagesToFile(pages) {
  if (pages.length === 1) { const b = await new Promise(r => pages[0].toBlob(r, 'image/jpeg', .85)); return { blob: b, mime: 'image/jpeg' }; }
  return { blob: await makePdf(pages), mime: 'application/pdf' };
}
function docMeta(owner, kinds, r) {
  const kind = guessKind(r.text, kinds), best = bestFor(kind, r.fields || []);
  const o = ownerObj(owner.type, owner.id);
  const m = modal(`
    <div class="doc-prev">${r.thumbs ? r.thumbs.map(t => `<img src="${t}" alt="">`).join('') : `<span class="doc-ph">${ic('file')}<b>PDF</b></span>`}</div>
    <div class="form">
      <label>Тип документа<select id="dmKind">${kinds.map(k => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Название<input id="dmTitle" value="${esc(kind)}"></label>
      <div class="two"><label>Номер<input id="dmNum" value="${esc(best.number)}" placeholder="необязательно"></label><label>Действует до<input id="dmExp" type="date" value="${esc(best.expires)}"></label></div>
      ${r.text ? `<p class="hint">${ic('sparkle')}Текст распознан — после сохранения можно вставить данные в профиль.</p>` : ''}
    </div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="dmSave">${ic('check')}Сохранить в профиль</button></div>`, { title: 'Новый документ', sub: o ? (owner.type === 'driver' ? o.name : o.plate + ' ' + o.region) : '' });
  m.$('#dmKind').onchange = () => { const k = m.$('#dmKind').value, b = bestFor(k, r.fields || []); m.$('#dmTitle').value = k; if (b.number) m.$('#dmNum').value = b.number; if (b.expires) m.$('#dmExp').value = b.expires; };
  m.$('#dmSave').onclick = async () => {
    const btn = m.$('#dmSave'); btn.disabled = true; btn.textContent = 'Сохраняем…';
    let file;
    if (r.blob) file = { blob: r.blob, mime: r.blob.type || 'application/pdf' };
    else file = await pagesToFile(r.pages);
    const title = m.$('#dmTitle').value.trim() || m.$('#dmKind').value;
    const fileId = await FS.put(file.blob, title, file.mime);
    const w = who();
    const doc = { id: uid('doc'), kind: m.$('#dmKind').value, title, fileId, mime: file.mime, pages: r.pages ? r.pages.length : 1, thumb: r.thumbs ? r.thumbs[0] : null, size: file.blob.size, text: (r.text || '').slice(0, 4000), fields: r.fields || [], number: m.$('#dmNum').value.trim(), expires: m.$('#dmExp').value, at: now(), by: w.role === 'disp' ? 'Диспетчер' : w.role === 'mech' ? 'Механик' : 'Водитель' };
    Act.addDoc(owner, doc);
    m.close(); toast('Документ сохранён', `${doc.title} · ${owner.type === 'driver' ? o.name : o.plate}`, 'ok');
    if (owner.type === 'driver' && (doc.text || (doc.fields || []).length)) insertPanel(owner.id, doc);
  };
}
/* вставка распознанных данных в поля профиля водителя */
function guessField(f, kind, d) {
  if (f.type === 'phone') return 'phone';
  if (f.type === 'inn') return 'inn';
  if (f.type === 'snils') return 'snils';
  if (f.type === 'series') return kind === 'Водительское удостоверение' ? 'license' : kind === 'Паспорт' ? 'passport' : kind === 'Карта тахографа' ? 'tacho' : '';
  if (f.type === 'date') {
    const y = +f.iso.slice(0, 4), fut = f.iso > isoDay(now());
    if (y < 2008 && !fut) return 'birth';
    if (fut && kind === 'Водительское удостоверение') return 'licenseExp';
    if (fut && kind === 'Медсправка') return 'med';
  }
  return '';
}
function insertPanel(did, doc) {
  const d = D(did); if (!d) return;
  const fields = doc.fields || [];
  const opts = sel => `<option value="">— не вставлять —</option>` + DRV_FIELDS.map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t}</option>`).join('');
  const m = modal(`
    ${fields.length ? `<div class="ins-list">${fields.map((f, i) => { const g = guessField(f, doc.kind, d); return `<div class="ins"><div><small>${esc(f.label)}</small><b>${esc(f.value)}</b></div><select data-i="${i}">${opts(g)}</select></div>`; }).join('')}</div>` : '<p class="muted">Отдельные значения не найдены. Выделите нужный кусок текста ниже и выберите поле.</p>'}
    <label class="lbl">Весь распознанный текст — выделите фрагмент, чтобы вставить его</label>
    <textarea id="insTa" rows="6" spellcheck="false">${esc(doc.text)}</textarea>
    <div class="row gap wrap"><select id="insSelTo">${opts('')}</select><button class="btn soft" id="insSel">${ic('plus')}Вставить выделенное</button><button class="btn soft" data-a="copy" data-v="${esc(doc.text)}" data-what="Текст">${ic('copy')}Копировать всё</button></div>
    <div class="row end gap"><button class="btn ghost" data-close>Позже</button><button class="btn acc" id="insGo">${ic('check')}Вставить отмеченное</button></div>`, { title: 'Данные из документа → в профиль', sub: `${d.name} · ${doc.kind}`, wide: true });
  m.$('#insSel').onclick = () => {
    const ta = m.$('#insTa'), part = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim(), to = m.$('#insSelTo').value;
    if (!part) return toast('Сначала выделите текст', 'Проведите пальцем или мышью по нужному фрагменту');
    if (!to) return toast('Выберите поле', 'Куда вставить выделенный текст');
    Act.setDriverFields(did, { [to]: part }); toast('Вставлено', `${DRV_FIELDS.find(x => x[0] === to)[1]}: ${part.slice(0, 40)}`, 'ok');
  };
  m.$('#insGo').onclick = () => {
    const patch = {};
    $$('select[data-i]', m.el).forEach(s => { if (s.value) { const f = fields[+s.dataset.i]; patch[s.value] = s.value === 'birth' || s.value === 'licenseExp' || s.value === 'med' ? f.iso : f.value; } });
    if (!Object.keys(patch).length) return toast('Ничего не отмечено', 'Выберите поле напротив нужного значения');
    Act.setDriverFields(did, patch); m.close(); toast('Профиль обновлён', Object.keys(patch).map(k => DRV_FIELDS.find(x => x[0] === k)[1]).join(', '), 'ok');
  };
}
A.openDoc = d => openDoc({ type: d.t, id: d.id }, d.doc);
async function openDoc(owner, docId) {
  const o = ownerObj(owner.type, owner.id); const doc = o && o.docs.find(x => x.id === docId); if (!doc) return;
  const f = await FS.get(doc.fileId);
  const url = f ? URL.createObjectURL(f.blob) : null;
  const w = who(), canEdit = w.role !== 'driver' || (owner.type === 'driver' && owner.id === w.id);
  const view = !f ? `<div class="doc-missing">${ic('file')}<b>Файл ещё не дошёл</b><span>Он отправляется с телефона, где его добавили. Если там плохой интернет — откройте через минуту</span></div>` : doc.mime === 'application/pdf' ? pdfView(url, doc.thumb, doc.pages) : `<img class="doc-full" src="${url}" alt="">`;
  const m = modal(`
    <div class="doc-view">${view}</div>
    <div class="doc-info">
      <div class="kv"><span>Тип</span><b>${esc(doc.kind)}</b></div>
      ${doc.number ? `<div class="kv"><span>Номер</span><b>${esc(doc.number)} <button class="link" data-a="copy" data-v="${esc(doc.number)}" data-what="Номер">${ic('copy')}</button></b></div>` : ''}
      ${doc.expires ? `<div class="kv"><span>Действует до</span><b>${new Date(doc.expires).toLocaleDateString('ru-RU')}</b></div>` : ''}
      <div class="kv"><span>Добавил</span><b>${esc(doc.by || '')} · ${fmtWhen(doc.at)}</b></div>
      <div class="kv"><span>Файл</span><b>${doc.mime === 'application/pdf' ? 'PDF' : 'JPG'} · ${doc.pages || 1} стр. · ${Math.round((doc.size || 0) / 1024)} КБ</b></div>
    </div>
    <div class="row gap wrap doc-acts">
      <button class="btn acc" id="dShare">${ic('share')}Поделиться</button>
      ${f ? `<a class="btn soft" href="${url}" download="${esc(fileName(doc, o))}">${ic('download')}Скачать</a>` : ''}
      ${f && doc.mime === 'application/pdf' ? `<a class="btn soft" href="${url}" target="_blank">${ic('file')}Открыть</a>` : ''}
      ${doc.text && owner.type === 'driver' && w.role !== 'driver' ? `<button class="btn soft" id="dIns">${ic('sparkle')}Данные в профиль</button>` : ''}
      ${doc.text ? `<button class="btn soft" data-a="copy" data-v="${esc(doc.text)}" data-what="Текст">${ic('copy')}Текст</button>` : ''}
      ${canEdit ? `<button class="btn ghost danger" id="dDel">${ic('trash')}Удалить</button>` : ''}
    </div>`, { title: doc.title || doc.kind, sub: owner.type === 'driver' ? o.name : `${o.plate} ${o.region}`, wide: true, onClose: () => url && setTimeout(() => URL.revokeObjectURL(url), 1000) });
  m.$('#dShare').onclick = () => shareDoc(doc, o);
  if (m.$('#dIns')) m.$('#dIns').onclick = () => { m.close(); insertPanel(owner.id, doc); };
  if (m.$('#dDel')) m.$('#dDel').onclick = async () => { if (await confirmBox('Удалить документ?', `«${doc.title}» будет удалён из профиля.`, 'Удалить', 'danger')) { Act.delDoc(owner, doc.id); m.close(); toast('Документ удалён'); } };
}
function fileName(doc, o) { const who = o ? (o.name || o.plate || '') : ''; return `${doc.title || doc.kind} ${who}`.trim().replace(/[\\/:*?"<>|]+/g, '') + (doc.mime === 'application/pdf' ? '.pdf' : '.jpg'); }
async function shareDoc(doc, o) {
  const f = await FS.get(doc.fileId);
  const caption = `${doc.title || doc.kind}${o ? ' — ' + (o.name || o.plate + ' ' + o.region) : ''}${doc.number ? ' · № ' + doc.number : ''}`;
  if (f && IN_APP) { window.TrassaApp.share(await blobToB64(f.blob), fileName(doc, o), f.mime, caption); return; }
  if (f) {
    const file = new File([f.blob], fileName(doc, o), { type: f.mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: caption, text: caption }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
  }
  const url = f ? URL.createObjectURL(f.blob) : null;
  const m = modal(`
    <p class="muted">${f ? 'На этом устройстве нельзя отправить файл напрямую. Скачайте его и прикрепите в мессенджере, или откройте чат кнопкой ниже.' : 'Файл есть только на устройстве, где его добавили.'}</p>
    <div class="share-grid">
      ${f ? `<a class="share-it" href="${url}" download="${esc(fileName(doc, o))}"><span class="si dl">${ic('download')}</span>Скачать файл</a>` : ''}
      <a class="share-it" href="https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(caption)}" target="_blank" rel="noopener"><span class="si tg"><svg viewBox="0 0 24 24"><path d="M21.4 4.2L2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.9-1.4-1.6zM9.8 14.6l-.4 4 -1.4-4.6 10.4-6.6c.5-.3.9-.1.5.2z" fill="currentColor"/></svg></span>Telegram</a>
      <a class="share-it" href="https://wa.me/?text=${encodeURIComponent(caption)}" target="_blank" rel="noopener"><span class="si wa"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.1.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.6z" fill="currentColor"/></svg></span>WhatsApp</a>
      <a class="share-it" href="mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(caption + '\n\n(файл во вложении)')}"><span class="si ml">${ic('send')}</span>Почта</a>
    </div>`, { title: 'Поделиться', sub: caption, onClose: () => url && setTimeout(() => URL.revokeObjectURL(url), 1500) });
}

/* ---------- профиль водителя (диспетчер / механик / сам водитель) ---------- */
function driverProfile(did, viewer) {
  const d = D(did); if (!d) return empty('user', 'Водитель не найден');
  const v = vehOf(did), tab = UI.tab['prof-' + did] || 'data';
  const tabs = [['data', 'Данные'], ['docs', `Документы <em>${d.docs.length}</em>`]];
  if (viewer !== 'mech') tabs.push(['trips', 'Рейсы']);
  if (viewer === 'disp') tabs.push(['shifts', 'Смены']);
  const dToday = db.trips.filter(t => t.driverId === did && t.state === 'done' && t.doneAt >= startOfDay(now()));
  const head = `
    <div class="prof-h">
      ${avatar(d, 'xl')}
      <div class="ph-b"><h2>${esc(d.name)}</h2>${viewer !== 'mech' || true ? statusChip(d, true) : ''}
        <div class="ph-row">${plate(v)}${v ? `<span class="muted">${esc(v.model)} · ${v.volume} м³</span>` : ''}</div></div>
      <div class="ph-a"><a class="btn soft" href="${telHref(d.phone)}">${ic('phone')}${esc(d.phone)}</a>${viewer === 'disp' ? `<a class="btn soft" href="#/chat/dm-${d.id}">${ic('chat')}Написать</a>` : ''}</div>
    </div>
    ${viewer !== 'mech' ? `<div class="kpis sm">${kpi('Рейсов сегодня', dToday.length, '', '', 'drv-today', did)}${kpi('Кубатура сегодня', m3(dToday.reduce((s, t) => s + t.m3, 0)), '', '', 'drv-m3', did)}${kpi('Рейсов за 7 дней', db.trips.filter(t => t.driverId === did && t.state === 'done' && t.doneAt > now() - 7 * DAY).length, '', '', 'drv-7d', did)}${kpi('Документов', d.docs.length, '', '', 'drv-docs', did)}</div>` : ''}
    <div class="tabs">${tabs.map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-k="prof-${did}" data-v="${k}">${t}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'data') {
    body = `<div class="card"><div class="card-h"><b>Личные данные</b>${viewer !== 'driver' ? `<button class="btn soft sm" data-a="editDriver" data-id="${did}">${ic('edit')}Изменить</button>` : ''}</div>
      <div class="fields">${[['name', 'ФИО', d.name], ...DRV_FIELDS.map(([k, t]) => [k, t, k === 'phone' ? d.phone : d.f[k]])].map(([k, t, val]) => {
        let shown = val || ''; if (shown && /^\d{4}-\d{2}-\d{2}$/.test(shown)) shown = new Date(shown).toLocaleDateString('ru-RU');
        return `<div class="fld ${val ? '' : 'emp'}"><span>${t}</span><b>${shown ? esc(shown) : '—'}</b>${val ? `<button class="link" data-a="copy" data-v="${esc(shown)}" data-what="${esc(t)}" aria-label="Копировать">${ic('copy')}</button>` : ''}</div>`;
      }).join('')}</div>
      ${viewer !== 'driver' ? `<p class="hint">${ic('sparkle')}Быстрее всего заполнять так: «Документы» → «Сканировать» → данные вставятся из скана.</p>` : ''}</div>`;
  }
  if (tab === 'docs') body = `<div class="card"><div class="card-h"><b>Папка документов</b><span class="muted">${d.docs.length} ${plural(d.docs.length, 'файл', 'файла', 'файлов')}</span></div>${docGrid({ type: 'driver', id: did }, d.docs, true)}</div>`;
  if (tab === 'trips') {
    const ts = db.trips.filter(t => t.driverId === did && t.state !== 'rejected').sort((a, b) => b.takenAt - a.takenAt).slice(0, 60);
    body = `<div class="card">${ts.length ? tripTable(ts, { noDriver: true }) : empty('orders', 'Рейсов пока нет')}</div>`;
  }
  if (tab === 'shifts') {
    const sh = db.shifts.filter(s => s.driverId === did).sort((a, b) => b.start - a.start).slice(0, 30);
    const brs = db.breakdowns.filter(b => b.driverId === did).sort((a, b) => b.at - a.at).slice(0, 10);
    body = `<div class="card"><div class="card-h"><b>Смены</b></div><table class="tbl"><thead><tr><th>День</th><th>Начал</th><th>Закончил</th><th>На линии</th></tr></thead><tbody>${sh.map(s => `<tr><td>${fmtDay(s.start)}</td><td>${fmtTime(s.start)}</td><td>${s.end ? fmtTime(s.end) : '<span class="st ok"><i></i>сейчас</span>'}</td><td>${dur((s.end || now()) - s.start)}</td></tr>`).join('')}</tbody></table></div>
      ${brs.length ? `<div class="card"><div class="card-h"><b>Поломки</b></div>${brs.map(b => `<div class="li">${chip(b.kind === 'sos' ? 'экстренная' : 'локальная', b.kind === 'sos' ? 'bad' : 'warn')}<span>${esc(b.reason)}${b.note ? ' — ' + esc(b.note) : ''}</span><small class="muted">${fmtWhen(b.at)}${b.fixedAt ? ' · починился через ' + dur(b.fixedAt - b.at) : ''}</small></div>`).join('')}</div>` : ''}`;
  }
  return head + body;
}
A.tab = d => { UI.tab[d.k] = d.v; render(); };
A.editDriver = d => {
  const x = D(d.id);
  const m = modal(`<div class="form">
      <label>ФИО<input id="ed-name" value="${esc(x.name)}"></label>
      ${DRV_FIELDS.map(([k, t]) => {
        const date = ['birth', 'licenseExp', 'med'].includes(k);
        return `<label>${t}<input id="ed-${k}" ${date ? 'type="date"' : ''} value="${esc(k === 'phone' ? x.phone : x.f[k] || '')}"></label>`;
      }).join('')}
    </div><div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="edSave">${ic('check')}Сохранить</button></div>`, { title: 'Данные водителя', sub: x.name });
  m.$('#edSave').onclick = () => {
    const patch = { name: m.$('#ed-name').value.trim() || x.name };
    DRV_FIELDS.forEach(([k]) => patch[k] = m.$('#ed-' + k).value.trim());
    Act.setDriverFields(x.id, patch); m.close(); toast('Сохранено', x.name, 'ok');
  };
};

/* таблица рейсов */
function tripTable(ts, opt = {}) {
  return `<div class="tbl-wrap"><table class="tbl trips"><thead><tr><th>Взят</th>${opt.noOrder ? '' : '<th>Заявка</th>'}${opt.noDriver ? '' : '<th>Водитель</th>'}<th>Машина</th><th>Статус</th><th class="r">Объём</th><th>ТТН</th></tr></thead><tbody>${ts.map(t => {
    const o = O(t.orderId), d = D(t.driverId), v = V(t.vehicleId);
    return `<tr class="${t.state}">
      <td><b>${fmtTime(t.takenAt)}</b><small>${fmtDay(t.takenAt)}</small></td>
      ${opt.noOrder ? '' : `<td><a href="#/order/${o.id}">№${o.no}</a><small>${esc(o.cargo)}</small></td>`}
      ${opt.noDriver ? '' : `<td><a href="#/driver/${d.id}" class="who">${avatar(d, 'sm')}${esc(d.name)}</a>${t.by === 'disp' ? '<small>назначил диспетчер</small>' : ''}</td>`}
      <td>${plate(v, 'sm')}</td>
      <td>${tripChip(t)}${t.doneAt ? `<small>${fmtTime(t.doneAt)}</small>` : ''}</td>
      <td class="r">${t.state === 'done' ? m3(t.m3) : '<span class="muted">—</span>'}</td>
      <td>${t.ttn ? `<button class="btn soft sm" data-a="openTtn" data-id="${t.id}">${ic('file')}${t.ttn.pages} стр.</button>` : t.state === 'done' ? '<span class="muted">нет</span>' : ''}</td>
      
    </tr>`;
  }).join('')}</tbody></table></div>`;
}
A.openTtn = async d => {
  const t = db.trips.find(x => x.id === d.id); if (!t || !t.ttn) return;
  const o = O(t.orderId), dr = D(t.driverId);
  // в имени файла — настоящая дата и время рейса (не «сегодня»), чтобы ТТН в «Загрузках» не путались
  const dd = new Date(t.doneAt || t.takenAt), stamp = `${pad(dd.getDate())}.${pad(dd.getMonth() + 1)}.${dd.getFullYear()} ${pad(dd.getHours())}-${pad(dd.getMinutes())}`;
  const doc = { id: 'ttn', kind: 'ТТН', title: `ТТН №${o.no} от ${stamp}`, fileId: t.ttn.fileId, mime: t.ttn.mime, pages: t.ttn.pages, thumb: t.ttn.thumb, size: t.ttn.size, at: t.doneAt, by: dr.name };
  const f = await FS.get(doc.fileId), url = f ? URL.createObjectURL(f.blob) : null;
  const m = modal(`<div class="doc-view">${!f ? `<div class="doc-missing">${ic('file')}<b>Скан ещё не дошёл</b><span>Он отправляется с телефона водителя. Если там плохой интернет — откройте через минуту</span></div>` : doc.mime === 'application/pdf' ? pdfView(url, doc.thumb, doc.pages) : `<img class="doc-full" src="${url}">`}</div>
    <div class="row gap wrap doc-acts"><button class="btn acc" id="tShare">${ic('share')}Поделиться</button>${f ? `<a class="btn soft" href="${url}" download="${esc(fileName(doc, dr))}">${ic('download')}Скачать</a><a class="btn soft" href="${url}" target="_blank">${ic('file')}Открыть</a>` : ''}</div>`, { title: doc.title, sub: `${dr.name} · ${t.ttn.pages} стр. · ${m3(t.m3)}`, wide: true });
  m.$('#tShare').onclick = () => shareDoc(doc, dr);
};
A.confirmTrip = d => { Act.confirmTrip(d.id); toast('Рейс подтверждён', '', 'ok'); };
A.rejectTrip = async d => { if (await confirmBox('Отклонить рейс?', 'Рейс вернётся в заявку, водитель получит сообщение.', 'Отклонить', 'danger')) Act.rejectTrip(d.id, ''); };


/* ---------- подробности по плиткам-цифрам (водитель и диспетчер) ---------- */
A.stat = d => statDetail(d.k, d.id);
function sdTrip(t, withDriver) {
  const o = O(t.orderId), dr = D(t.driverId); if (!o || !dr) return '';
  const done = t.state === 'done';
  return `<div class="sd-row">
    <div class="sd-t"><b>${fmtTime(done ? t.doneAt : t.takenAt)}</b><small>${done ? 'сдал' : 'взял'}</small></div>
    <a class="sd-m" href="#/order/${o.id}" data-close><b>№${o.no} · ${esc(o.cargo)}</b><span>${withDriver ? esc(dr.name) + ' · ' : ''}${esc(o.from.addr)} → ${esc(o.to.addr)}</span></a>
    <div class="sd-v">${done ? `<b>${m3(t.m3)}</b>` : '<b class="info">в рейсе</b>'}${t.ttn ? `<button class="sd-ttn" data-a="openTtn" data-id="${t.id}">${ic('file')}ТТН</button>` : done ? '<small>без ТТН</small>' : `<small>${ago(t.takenAt)}</small>`}</div>
  </div>`;
}
const sdSum = cells => `<div class="sd-sum">${cells.map(([v, l, c]) => `<div class="${c || ''}"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
const sdH = (t, n) => `<div class="sd-h"><b>${t}</b>${n !== undefined ? `<span>${n}</span>` : ''}</div>`;
const sdBar = (label, sub, val, max, valText, href) => `<${href ? `a href="${href}" data-close` : 'div'} class="sd-bar"><div class="sd-bl"><b>${label}</b><span>${sub}</span></div><div class="sd-br"><b>${valText}</b><i><em style="width:${max ? (val > 0 ? Math.max(3, val / max * 100) : 0).toFixed(1) : 0}%"></em></i></div></${href ? 'a' : 'div'}>`;
const sdEmpty = t => `<div class="sd-empty">${ic('orders')}<span>${t}</span></div>`;
const sumM3 = ts => ts.reduce((s, t) => s + (t.m3 || 0), 0);
function byKey(ts, key) { const m = new Map(); ts.forEach(t => { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); return [...m.entries()]; }
function daysBack(ts, n) {
  const out = []; const t0 = startOfDay(now());
  for (let i = 0; i < n; i++) { const a = t0 - i * DAY, b = a + DAY; const list = ts.filter(t => t.doneAt >= a && t.doneAt < b).sort((x, y) => y.doneAt - x.doneAt); out.push({ a, list }); }
  return out;
}
const dayName = a => a === startOfDay(now()) ? 'Сегодня' : a === startOfDay(now()) - DAY ? 'Вчера' : new Date(a).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
function statDetail(k, id) {
  const t0 = startOfDay(now());
  const doneAll = db.trips.filter(t => t.state === 'done');
  const work = db.trips.filter(t => t.state === 'confirmed' || t.state === 'pending');
  let title = '', sub = '', html = '';

  /* ----- водитель ----- */
  if (k === 'drv-docs' || k === 'drv-mydocs') {   // папка документов водителя: нажать — открыть
    const d = D(id); if (!d) return;
    const docs = d.docs.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    title = 'Документы'; sub = d.name;
    html = (docs.map(x => `<button class="sd-row doc" data-a="openDoc" data-t="driver" data-id="${d.id}" data-doc="${x.id}">
        <span class="sd-thumb">${x.thumb ? `<img src="${x.thumb}" alt="">` : ic('file')}</span>
        <span class="sd-m"><b>${esc(x.title || x.kind)}</b><span>${esc(x.kind || '')}${x.number ? ' · № ' + esc(x.number) : ''}${x.at ? ' · ' + fmtDay(x.at) : ''}</span></span>
        <span class="sd-v"><small>${x.mime === 'application/pdf' ? 'PDF' + (x.pages ? ' · ' + x.pages + ' стр.' : '') : 'фото'}</small>${ic('right')}</span></button>`).join(''))
      || sdEmpty(who().role === 'driver' ? 'Документов пока нет. Добавьте их ниже: «Сканировать» или «Загрузить».' : 'Документов пока нет. Добавьте их на вкладке «Документы».');
  }
  if (k === 'drv-m3w') {
    const d = D(id); if (!d) return;
    const days = daysBack(db.trips.filter(t => t.state === 'done' && t.driverId === id), 7), week = days.flatMap(x => x.list);
    const byOrd = byKey(week, t => t.orderId).map(([oid, ts]) => ({ o: O(oid), ts, v: sumM3(ts) })).filter(g => g.o).sort((a, b) => b.v - a.v);
    const omax = Math.max(0, ...byOrd.map(g => g.v)), dmax = Math.max(0, ...days.map(x => sumM3(x.list)));
    title = 'Кубатура за 7 дней'; sub = d.name;
    html = sdSum([[m3(sumM3(week)), 'всего', 'acc'], [week.length, plural(week.length, 'рейс', 'рейса', 'рейсов')], [m3(Math.round(sumM3(week) / 7)), 'в среднем в день']])
      + sdH('По заявкам') + (byOrd.map(g => sdBar(`№${g.o.no} · ${esc(g.o.cargo)}`, `${g.ts.length} ${plural(g.ts.length, 'рейс', 'рейса', 'рейсов')} × ${fmtNum(Math.round(g.v / g.ts.length))} м³`, g.v, omax, m3(g.v), `#/order/${g.o.id}`)).join('') || sdEmpty('За неделю рейсов не было'))
      + sdH('По дням') + days.map(x => `<details class="sd-day" ${x.a === t0 ? 'open' : ''}><summary>${sdBar(dayName(x.a), `${x.list.length} ${plural(x.list.length, 'рейс', 'рейса', 'рейсов')}`, sumM3(x.list), dmax, m3(sumM3(x.list)))}</summary>${x.list.map(t => sdTrip(t)).join('') || '<div class="sd-none">Рейсов не было</div>'}</details>`).join('');
  }
  if (k === 'drv-free') { const el = document.querySelector('.sec-h'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (['drv-today', 'drv-m3', 'drv-7d'].includes(k)) {
    const d = D(id); if (!d) return;
    const mine = doneAll.filter(t => t.driverId === id), today = mine.filter(t => t.doneAt >= t0).sort((a, b) => b.doneAt - a.doneAt);
    const act = work.filter(t => t.driverId === id);
    sub = d.name;
    if (k === 'drv-today') {
      title = 'Рейсы за сегодня';
      html = sdSum([[today.length, plural(today.length, 'рейс', 'рейса', 'рейсов')], [m3(sumM3(today)), 'вывезено'], [`${today.filter(t => t.ttn).length}/${today.length}`, 'с ТТН']])
        + (act.length ? sdH('Сейчас в рейсе') + act.map(t => sdTrip(t)).join('') : '')
        + sdH('Выполнено сегодня', today.length) + (today.map(t => sdTrip(t)).join('') || sdEmpty('Сегодня рейсов ещё не было'));
    }
    if (k === 'drv-m3') {
      title = 'Кубатура за сегодня';
      const groups = byKey(today, t => t.orderId).map(([oid, ts]) => ({ o: O(oid), ts, v: sumM3(ts) })).filter(g => g.o).sort((a, b) => b.v - a.v);
      const max = Math.max(0, ...groups.map(g => g.v));
      html = sdSum([[m3(sumM3(today)), 'всего'], [today.length, plural(today.length, 'рейс', 'рейса', 'рейсов')], [today.length ? m3(Math.round(sumM3(today) / today.length)) : '—', 'в среднем за рейс']])
        + sdH('По заявкам') + (groups.map(g => sdBar(`№${g.o.no} · ${esc(g.o.cargo)}`, `${g.ts.length} ${plural(g.ts.length, 'рейс', 'рейса', 'рейсов')} × ${fmtNum(Math.round(g.v / g.ts.length))} м³`, g.v, max, m3(g.v), `#/order/${g.o.id}`)).join('') || sdEmpty('Сегодня ещё ничего не вывезено'))
        + (today.length ? sdH('По рейсам', today.length) + today.map(t => sdTrip(t)).join('') : '');
    }
    if (k === 'drv-7d') {
      title = 'Рейсы за 7 дней';
      const days = daysBack(mine, 7), week = days.flatMap(x => x.list), max = Math.max(0, ...days.map(x => sumM3(x.list)));
      html = sdSum([[week.length, plural(week.length, 'рейс', 'рейса', 'рейсов')], [m3(sumM3(week)), 'вывезено'], [fmtNum(Math.round(week.length / 7 * 10) / 10), 'рейсов в день']])
        + sdH('По дням') + days.map(x => `<details class="sd-day" ${x.a === t0 ? 'open' : ''}><summary>${sdBar(dayName(x.a), `${x.list.length} ${plural(x.list.length, 'рейс', 'рейса', 'рейсов')}`, sumM3(x.list), max, m3(sumM3(x.list)))}</summary>${x.list.map(t => sdTrip(t)).join('') || '<div class="sd-none">Рейсов не было</div>'}</details>`).join('');
    }
  }

  /* ----- диспетчер ----- */
  if (k === 'line') {
    title = 'Водители'; sub = 'кто на линии, кто в поломке, кто закончил';
    const grp = [['sos', 'Нужна помощь', d => d.status === 'broken' && d.breakdown && d.breakdown.kind === 'sos'], ['broken', 'Поломка', d => d.status === 'broken' && !(d.breakdown && d.breakdown.kind === 'sos')], ['line', 'На линии', d => d.status === 'line'], ['off', 'Закончили работу', d => d.status !== 'line' && d.status !== 'broken']];
    const row = d => { const v = vehOf(d.id), tt = doneAll.filter(t => t.driverId === d.id && t.doneAt >= t0), a = work.find(t => t.driverId === d.id), ao = a && O(a.orderId);
      return `<div class="sd-row drv"><a class="sd-m who" href="#/driver/${d.id}" data-close>${avatar(d, 'sm')}<div><b>${esc(d.name)}</b><span>${v ? v.plate + ' · ' : ''}${ao ? `в рейсе №${ao.no}` : d.status === 'broken' && d.breakdown ? esc(d.breakdown.reason || 'поломка') : STATUS[d.status] ? STATUS[d.status].t.toLowerCase() : ''} · с ${fmtTime(d.since)}</span></div></a>
        <div class="sd-v"><b>${tt.length} ${plural(tt.length, 'рейс', 'рейса', 'рейсов')}</b><small>${m3(sumM3(tt))}</small></div>
        <a class="sd-call" href="${telHref(d.phone)}" aria-label="Позвонить">${ic('phone')}</a></div>`; };
    const lists = grp.map(([c, t, f]) => [c, t, db.drivers.filter(f)]);
    html = sdSum([[lists[2][2].length, 'на линии', 'ok'], [lists[0][2].length + lists[1][2].length, 'поломка', lists[0][2].length ? 'bad' : 'warn'], [lists[3][2].length, 'закончили']])
      + lists.filter(([, , l]) => l.length).map(([c, t, l]) => `<div class="sd-grp ${c}">${sdH(t, l.length)}${l.map(row).join('')}</div>`).join('');
  }
  if (k === 'trips') {
    title = 'Рейсы за сегодня'; sub = 'все водители';
    const today = doneAll.filter(t => t.doneAt >= t0).sort((a, b) => b.doneAt - a.doneAt);
    html = sdSum([[today.length, 'выполнено', 'ok'], [work.length, 'сейчас в рейсе', 'info'], [`${today.filter(t => t.ttn).length}/${today.length}`, 'с ТТН']])
      + (work.length ? sdH('Сейчас в рейсе', work.length) + work.sort((a, b) => b.takenAt - a.takenAt).map(t => sdTrip(t, true)).join('') : '')
      + sdH('Выполнено сегодня', today.length) + (today.map(t => sdTrip(t, true)).join('') || sdEmpty('Сегодня рейсов ещё не было'));
  }
  if (k === 'm3') {
    title = 'Кубатура'; sub = 'кто, по каким заявкам и сколько вывез';
    const today = doneAll.filter(t => t.doneAt >= t0), days = daysBack(doneAll, 7), week = days.flatMap(x => x.list);
    const byDrv = byKey(today, t => t.driverId).map(([did, ts]) => ({ d: D(did), ts, v: sumM3(ts) })).filter(g => g.d).sort((a, b) => b.v - a.v);
    const byOrd = byKey(today, t => t.orderId).map(([oid, ts]) => ({ o: O(oid), ts, v: sumM3(ts) })).filter(g => g.o).sort((a, b) => b.v - a.v);
    const mx = a => Math.max(0, ...a.map(g => g.v)), dmax = Math.max(0, ...days.map(x => sumM3(x.list)));
    html = sdSum([[m3(sumM3(today)), 'сегодня', 'acc'], [today.length, plural(today.length, 'рейс', 'рейса', 'рейсов')], [m3(sumM3(week)), 'за 7 дней']])
      + sdH('По водителям · сегодня') + (byDrv.map(g => sdBar(esc(g.d.name), `${g.ts.length} ${plural(g.ts.length, 'рейс', 'рейса', 'рейсов')} · ${[...new Set(g.ts.map(t => '№' + O(t.orderId).no))].join(', ')}`, g.v, mx(byDrv), m3(g.v), `#/driver/${g.d.id}`)).join('') || sdEmpty('Сегодня ещё ничего не вывезено'))
      + (byOrd.length ? sdH('По заявкам · сегодня') + byOrd.map(g => sdBar(`№${g.o.no} · ${esc(g.o.cargo)}`, `${esc(g.o.client)} · ${g.ts.length} ${plural(g.ts.length, 'рейс', 'рейса', 'рейсов')}`, g.v, mx(byOrd), m3(g.v), `#/order/${g.o.id}`)).join('') : '')
      + sdH('По дням') + days.map(x => sdBar(dayName(x.a), `${x.list.length} ${plural(x.list.length, 'рейс', 'рейса', 'рейсов')}`, sumM3(x.list), dmax, m3(sumM3(x.list)))).join('');
  }
  if (k === 'free') {
    title = 'Свободные рейсы'; sub = 'по каким заявкам ещё можно брать';
    const open = db.orders.filter(o => o.status === 'open' && orderLeft(o) > 0).sort((a, b) => orderLeft(b) - orderLeft(a));
    const free = open.reduce((s, o) => s + orderLeft(o), 0);
    html = sdSum([[free, plural(free, 'свободный рейс', 'свободных рейса', 'свободных рейсов'), 'acc'], [open.length, plural(open.length, 'заявка', 'заявки', 'заявок')], [m3(open.reduce((s, o) => s + orderLeft(o) * (o.m3 || 0), 0)), 'ещё вывезти']])
      + sdH('Заявки') + (open.map(o => { const vw = viewers(o).length; return `<a class="sd-row ord" href="#/order/${o.id}" data-close><div class="sd-big">${orderLeft(o)}<small>из ${o.total}</small></div><div class="sd-m"><b>№${o.no} · ${esc(o.cargo)}</b><span>${esc(o.client)} · ${esc(o.from.addr)} → ${esc(o.to.addr)}</span>${tripCells(o)}</div><div class="sd-v"><b>${o.m3} м³</b><small>${vw ? `${vw} ${plural(vw, 'смотрит', 'смотрят', 'смотрят')}` : 'за рейс'}</small></div></a>`; }).join('') || sdEmpty('Свободных рейсов нет — все заявки разобраны'));
  }
  if (!title) return;
  modal(`<div class="sd">${html}</div>`, { title, sub, wide: true });
}
