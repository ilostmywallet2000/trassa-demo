'use strict';
/* ===================================================================
   ТРАССА HQ — ядро: утилиты, иконки, данные, синхронизация вкладок
   Тест: общие данные в Supabase (одна запись с версией + таблица файлов),
   копия — в localStorage/IndexedDB телефона. ?local — старый режим без сервера.
   Каждая вкладка/телефон — отдельный пользователь. В рабочей версии — сервер в РФ.
   =================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = (p = '') => p + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6);
const now = () => Date.now();
const pad = n => String(n).padStart(2, '0');
const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtTime = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtDay = t => {
  const s = startOfDay(t), today = startOfDay(now());
  if (s === today) return 'сегодня'; if (s === today - DAY) return 'вчера'; if (s === today + DAY) return 'завтра';
  const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()];
};
const fmtWhen = t => (startOfDay(t) === startOfDay(now()) ? '' : fmtDay(t) + ', ') + fmtTime(t);
const isoDay = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ago = t => { const s = (now() - t) / 1000; if (s < 45) return 'только что'; if (s < 3600) return Math.round(s / 60) + ' мин назад'; if (s < 86400) return Math.round(s / 3600) + ' ч назад'; return fmtDay(t); };
const dur = ms => { const m = Math.max(0, Math.round(ms / MIN)), h = Math.floor(m / 60); return h ? `${h} ч ${pad(m % 60)} мин` : `${m} мин`; };
function plural(n, a, b, c) { n = Math.abs(n) % 100; const k = n % 10; if (n > 10 && n < 20) return c; if (k > 1 && k < 5) return b; if (k === 1) return a; return c; }
const nTrips = n => n + ' ' + plural(n, 'рейс', 'рейса', 'рейсов');
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const m3 = n => fmtNum(n) + ' м³';
const rub = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const firstName = n => String(n || '').split(/\s+/)[0];
const shortName = n => { const p = String(n || '').split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : n; };

/* ---------- иконки (линейные, 24×24) ---------- */
const IC = {
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M20.5 11.5h-4a2 2 0 0 0 0 4h4"/><circle cx="16.6" cy="13.5" r=".6"/>',
  pult: '<rect x="3" y="3" width="7" height="9" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="16" width="7" height="5" rx="1.6"/>',
  orders: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M9 10h6M9 14h6M9 18h3"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3.5 21l1.4-4.7A8.5 8.5 0 1 1 21 12z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.5 3.5 5.2"/>',
  truck: '<path d="M2 6.5h11.5V16H2zM13.5 9.5H18l3.5 3.8V16h-8z"/><circle cx="6" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  chart: '<path d="M4 20V11M10 20V4.5M16 20v-6.5M21.5 20h-19"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.2"/><path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
  scan: '<path d="M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5M7 12h10"/>',
  upload: '<path d="M12 15V3.5M7 8.5l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3.5V15M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  share: '<circle cx="18" cy="5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="19" r="2.8"/><path d="M8.5 13.4l7 4.2M15.5 6.4l-7 4.2"/>',
  file: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h4.5"/>',
  folder: '<path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6.5L9 17.5l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4.2M12 17.2h.01"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  power: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2.5V12"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  send: '<path d="M21.5 2.5L11 13M21.5 2.5L15 21l-4-8-8-4z"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  flag: '<path d="M5 21.5V3.5M5 4h12.5l-2.2 4 2.2 4H5"/>',
  cube: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  eye: '<path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3.5 6h17M9 6V4h6v2M18.5 6l-.9 13.6a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  camera: '<path d="M22 18.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.5l2-3h5l2 3H20a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  refill: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  bell: '<path d="M18 8.5a6 6 0 0 0-12 0c0 7-3 8.5-3 8.5h18s-3-1.5-3-8.5M13.7 21a2 2 0 0 1-3.4 0"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  route: '<circle cx="6" cy="19" r="2.6"/><circle cx="18" cy="5" r="2.6"/><path d="M8.6 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.4"/>',
  map: '<path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  layers: '<path d="M12 2.5L2.5 7.5 12 12.5l9.5-5z"/><path d="M2.5 12.5L12 17.5l9.5-5M2.5 17L12 22l9.5-5"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- справочники ---------- */
const DRV_DOC_KINDS = ['Паспорт', 'Водительское удостоверение', 'Медсправка', 'СНИЛС', 'ИНН', 'Карта тахографа', 'Трудовой договор', 'Другое'];
const VEH_DOC_KINDS = ['СТС', 'ПТС', 'ОСАГО', 'Диагностическая карта', 'Тахограф', 'Договор аренды / лизинга', 'Другое'];
const DRV_FIELDS = [
  ['phone', 'Телефон'], ['birth', 'Дата рождения'], ['passport', 'Паспорт: серия и номер'], ['passportIssued', 'Паспорт: кем и когда выдан'],
  ['address', 'Адрес регистрации'], ['license', 'ВУ: номер'], ['licenseCats', 'ВУ: категории'], ['licenseExp', 'ВУ: действует до'],
  ['med', 'Медсправка: действует до'], ['tacho', 'Карта тахографа: номер'], ['snils', 'СНИЛС'], ['inn', 'ИНН'],
];
const BREAK_REASONS = ['Колесо', 'Двигатель', 'Гидравлика кузова', 'Тормоза', 'Электрика', 'ДТП', 'Другое'];
const CARGO = ['Песок мытый', 'Песок карьерный', 'Щебень гранитный 20–40', 'Щебень 5–20', 'Грунт (вывоз)', 'ПГС', 'Асфальтовая крошка', 'Строительный мусор'];
const STATUS = {
  line: { t: 'На линии', c: 'ok' },
  off: { t: 'Закончил работу', c: 'off' },
  broken: { t: 'Поломка', c: 'warn' },
  sos: { t: 'Поломка · нужна помощь', c: 'bad' },
};
const TRIP_STATE = {
  pending: { t: 'Ждёт подтверждения', c: 'acc' },
  confirmed: { t: 'В работе', c: 'info' },
  done: { t: 'Выполнен', c: 'ok' },
  rejected: { t: 'Отклонён', c: 'off' },
  cancelled: { t: 'Отменён', c: 'off' },
};
const ACTIVE = ['pending', 'confirmed', 'done'];
const LOCK_MS = 60e3;

/* ---------- данные ---------- */
const KEY = 'trassa-hq-v1';
const TAB_ID = uid('tab');
let db = null;
const subs = new Set();
const onChange = fn => subs.add(fn);
let emitQueued = false;
function emit() { if (emitQueued) return; emitQueued = true; setTimeout(() => { emitQueued = false; subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }, 0); }
function loadRaw() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveRaw() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { // переполнение: чистим старые события и сообщения
    db.events = db.events.slice(-80); db.messages = db.messages.slice(-500);
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e2) { console.warn('save failed', e2); }
  }
}
/* tx: изменить данные, сохранить, оповестить экран и отправить в общую базу */
function tx(fn) {
  if (!Cloud.on) { const fresh = loadRaw(); if (fresh) db = fresh; }
  const r = fn(db);
  db.rev = (db.rev || 0) + 1; saveRaw(); emit();
  if (Cloud.on) { Cloud.pending.push({ fn, r }); cloudPush(); }
  return r;
}
window.addEventListener('storage', e => {
  if (Cloud.on || e.key !== KEY) return;
  if (!e.newValue) { db = seed(); saveRaw(); }
  else db = JSON.parse(e.newValue);
  emit();
});

/* ---------- общая база (тест: Supabase). Все телефоны видят одни данные ----------
   Состояние — один документ с номером версии. Запись проходит, только если
   версия не изменилась; иначе берём свежие данные и повторяем свои действия. */
const APP_VER = '0.4.9';
const CLOUD = { url: 'https://thulxepvnpfbpxjippjw.supabase.co', key: 'sb_publishable_7PB161r5TSzVjPRZbibS3A_tLGqzVxM', id: 'main' };
const Cloud = { on: !/[?&]local\b/.test(location.search), ver: -1, ready: false, pending: [], busy: false, online: null, prime: false, fails: 0, lastOk: 0, warned: 0 };
async function api(path, opt = {}, ms = 30000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(CLOUD.url + '/rest/v1/' + path, Object.assign({ signal: ctl.signal, cache: 'no-store' }, opt, { headers: Object.assign({ apikey: CLOUD.key, 'Content-Type': 'application/json' }, opt.headers || {}) }));
    const txt = await r.text();
    if (!r.ok) throw new Error(r.status + ' ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : null;
  } finally { clearTimeout(t); }
}
/* связь: одна осечка на мобильном интернете — не повод пугать. «Нет связи» — только если
   сервер не отвечает дольше 20 секунд подряд; сообщение не чаще раза в 3 минуты */
function setOnline(ok) {
  if (ok) { Cloud.fails = 0; Cloud.lastOk = now(); }
  else { Cloud.fails++; if (Cloud.online !== false && (Cloud.fails < 3 || now() - Cloud.lastOk < 20e3)) return; }
  if (Cloud.online === ok) return;
  const was = Cloud.online; Cloud.online = ok;
  document.documentElement.classList.toggle('offline', !ok);
  if (typeof toast !== 'function') return;
  if (!ok) { if (now() - Cloud.warned > 180e3) { Cloud.warned = now(); toast('Слабый интернет', 'Работайте дальше — всё отправится, когда связь наладится', 'bad'); } }
  else if (was === false && Cloud.warned) toast('Связь восстановлена', 'Данные снова общие', 'ok');
}
/* взять данные с сервера и заново применить свои ещё не отправленные действия */
function adopt(row) {
  db = row.data; Cloud.ver = row.ver;
  for (const p of Cloud.pending) {
    let r2; try { r2 = p.fn(db); } catch (e) { console.warn('rebase', e); }
    if (p.r && p.r.ok && r2 && r2.ok === false && typeof toast === 'function') toast('Вас опередили', r2.why || 'Данные обновились', 'bad');
    p.r = r2;
  }
  saveRaw(); emit();
}
const getRowQ = async cols => { const rows = await api(`trassa_state?id=eq.${CLOUD.id}&select=${cols}`, {}, 10000); return rows && rows[0] ? rows[0] : null; };
const getRow = async (cols = 'ver,data') => { const rows = await api(`trassa_state?id=eq.${CLOUD.id}&select=${cols}`); return rows && rows[0] ? rows[0] : null; };
async function cloudPush() {
  if (Cloud.busy || !Cloud.ready || !Cloud.pending.length) return;
  Cloud.busy = true; let retry = false;
  try {
    for (let n = 0; Cloud.pending.length && n < 10; n++) {
      const k = Cloud.pending.length;
      const v = await api('rpc/trassa_tx', { method: 'POST', body: JSON.stringify({ p_id: CLOUD.id, p_base: Cloud.ver, p_data: db }) });
      setOnline(true);
      if (v >= 0) { Cloud.ver = v; Cloud.pending.splice(0, k); continue; }
      const row = await getRow();   // кто-то успел раньше — перечитать и повторить
      if (row && row.data) adopt(row); else Cloud.ver = row ? row.ver : 0;
    }
  } catch (e) { console.warn('push', e); setOnline(false); retry = true; }
  finally { Cloud.busy = false; }
  if (retry) setTimeout(cloudPush, 3000); else if (Cloud.pending.length) setTimeout(cloudPush, 300);
}
async function cloudPoll() {
  if (!Cloud.ready || Cloud.busy || Cloud.pending.length) return;
  try {
    const head = await getRowQ('ver');
    setOnline(true);
    if (!head || head.ver === Cloud.ver) return;
    const row = await getRow();
    if (Cloud.busy || Cloud.pending.length || !row || !row.data) return;
    if (row.ver !== Cloud.ver) { db = row.data; Cloud.ver = row.ver; saveRaw(); emit(); }
  } catch (e) { setOnline(false); }
}
async function cloudStart() {
  try {
    const row = await getRow();
    if (row && row.data && row.data.v === 1) { Cloud.prime = true; adopt(row); }
    else { Cloud.ver = row ? row.ver : 0; Cloud.pending.push({ fn: () => {}, r: undefined }); }   // база пустая — кладём демо-данные
    Cloud.ready = true; setOnline(true); cloudPush();
  } catch (e) { console.warn('cloud start', e); setOnline(false); setTimeout(cloudStart, 4000); return; }
  const loop = async () => { await cloudPoll(); setTimeout(loop, document.hidden ? 15000 : 1500); };
  setTimeout(loop, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cloudPoll(); });
}
/* полная замена данных (сброс демо) */
function cloudReplace(fresh) { return tx(d => { Object.keys(d).forEach(k => delete d[k]); Object.assign(d, JSON.parse(JSON.stringify(fresh))); }); }
function b64ToBlob(b64, mime) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }
function blobB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }

const D = id => db.drivers.find(d => d.id === id);
const V = id => db.vehicles.find(v => v.id === id);
const O = id => db.orders.find(o => o.id === id);
const C = id => db.chats.find(c => c.id === id);
const vehOf = did => db.vehicles.find(v => v.driverId === did);
const activeTrip = did => db.trips.find(t => t.driverId === did && (t.state === 'pending' || t.state === 'confirmed'));
const orderTrips = oid => db.trips.filter(t => t.orderId === oid);
const orderUsed = o => db.trips.filter(t => t.orderId === o.id && ACTIVE.includes(t.state)).length;
const orderDone = o => db.trips.filter(t => t.orderId === o.id && t.state === 'done').length;
const orderLeft = o => Math.max(0, o.total - orderUsed(o));
const isSpent = o => o.status !== 'closed' && orderLeft(o) === 0;
const tripM3 = t => t.state === 'done' ? (t.m3 || 0) : 0;
/* ставки: за м³ или за тонну; водитель видит только свою. Старые заявки — «за рейс» (price) → пересчёт на м³ */
const UNIT = { m3: 'м³', t: 'т' };
/* время работы по заявке: «с 08:00 до 18:00» (до — необязательно) */
const timeSpan = o => o.time ? 'с ' + o.time + (o.timeTo ? ' до ' + o.timeTo : '') : o.timeTo ? 'до ' + o.timeTo : '';
function orderRates(o) {
  const unit = o.unit === 't' ? 't' : 'm3';
  let rd = o.rateDrv; if (rd == null && o.price) rd = Math.round(o.price / (o.m3 || 1));
  return { unit, u: UNIT[unit], rd: +rd || 0, rc: +o.rateCo || 0 };
}
const tripQty = (t, o) => (o || O(t.orderId) || {}).unit === 't' ? (+t.tn || 0) : (+t.m3 || 0);   // м³ или тонны по ТТН
const ttnFlag = t => t.ttn && t.ttn.check === 'review';   // ТТН не распознана — диспетчер проверяет сам
const tripPay = t => { const o = O(t.orderId); return o ? tripQty(t, o) * orderRates(o).rd : 0; };    // водителю
const tripBill = t => { const o = O(t.orderId); return o ? tripQty(t, o) * orderRates(o).rc : 0; };   // компании от заказчика
const perUnit = (n, u) => `${rub(n)} за ${u === 'т' ? 'тонну' : 'м³'}`;
function viewers(o, except) {
  const L = (db.locks || {})[o.id] || {}, t = now();
  return Object.keys(L).filter(k => L[k] > t && k !== except);
}
function statusKey(d) { if (d.status === 'broken') return d.breakdown && d.breakdown.kind === 'sos' ? 'sos' : 'broken'; return d.status; }
function shiftOpen(did) { return db.shifts.find(s => s.driverId === did && !s.end); }
function chatMembers(c) { if (c.kind === 'all') return db.drivers.map(d => d.id); if (c.kind === 'dm') return [c.driverId]; return c.members || []; }
function chatHas(c, did) { return chatMembers(c).includes(did); }
function dmChat(did) { return db.chats.find(c => c.kind === 'dm' && c.driverId === did); }
function ensureDm(did) { let c = dmChat(did); if (!c) { c = { id: 'dm-' + did, kind: 'dm', driverId: did, title: '' }; db.chats.push(c); } return c; }
function orderVisibleTo(o, did) { return (o.chats || []).some(cid => { const c = C(cid); return c && chatHas(c, did); }) || db.trips.some(t => t.orderId === o.id && t.driverId === did); }
function chatTitle(c) { if (c.kind === 'dm') { const d = D(c.driverId); return d ? d.name : 'Водитель'; } return c.title; }

/* события → уведомления в других вкладках */
function ev(kind, text, to, extra) {
  db.events.push(Object.assign({ id: uid('e'), at: now(), kind, text, to: to || ['disp'], tab: window.BOT_TAB ? 'bot' : TAB_ID }, extra || {}));
  if (db.events.length > 300) db.events.splice(0, db.events.length - 300);
}
function msg(chatId, from, text, extra) {
  const m = Object.assign({ id: uid('m'), chatId, from, text: text || '', at: now() }, extra || {});
  db.messages.push(m);
  if (db.messages.length > 1500) db.messages.splice(0, db.messages.length - 1500);
  return m;
}
function sysMsgToOrderChats(o, text) { (o.chats || []).forEach(cid => msg(cid, 'sys', text, { orderId: o.id, kind: 'sys' })); }

/* ---------- действия над данными ---------- */
/* быстрые ответы в чате: свой набор у водителей и у диспетчера; диспетчер меняет в «Настройках» */
const QUICK_DEF = {
  driver: ['Общий салам', 'Принял', 'Выехал', 'На погрузке', 'Загрузился, еду', 'На выгрузке', 'Выгрузился', 'Стою в пробке', 'Буду через 15 минут', 'Перезвоните мне'],
  disp: ['Общий салам', 'Принято', 'Спасибо!', 'Ожидайте', 'Где вы сейчас?', 'Новая заявка в чате', 'Будьте на связи', 'Перезвоню через 5 минут'],
};
const quickList = role => ((db.settings.quick || {})[role]) || QUICK_DEF[role] || [];
const Act = {
  clockIn(did) {
    return tx(db => {
      const d = D(did); if (!d || d.status === 'line') return;
      if (!shiftOpen(did)) db.shifts.push({ id: uid('s'), driverId: did, start: now(), end: null });
      d.status = 'line'; d.since = now(); d.breakdown = null;
      const v = vehOf(did);
      ev('clock', `${d.name} начал день${v ? ' · ' + v.plate + ' ' + v.region : ''}`, ['disp']);
    });
  },
  clockOut(did) {
    return tx(db => {
      const d = D(did); if (!d) return;
      const s = shiftOpen(did); if (s) s.end = now();
      d.status = 'off'; d.since = now(); d.breakdown = null;
      ev('clock', `${d.name} закончил работу`, ['disp']);
    });
  },
  breakdown(did, kind, reason, note, coords) {
    return tx(db => {
      const d = D(did); if (!d) return;
      if (!shiftOpen(did)) db.shifts.push({ id: uid('s'), driverId: did, start: now(), end: null });
      d.status = 'broken'; d.since = now();
      d.breakdown = { id: uid('b'), kind, reason, note, coords: coords || null, at: now(), ack: null, vehicleId: (vehOf(did) || {}).id || null };
      db.breakdowns.push(Object.assign({ driverId: did }, d.breakdown));
      const v = vehOf(did), what = `${reason}${note ? ': ' + note : ''}`;
      if (kind === 'sos') ev('sos', `🚨 ${d.name}${v ? ' · ' + v.plate : ''} — нужна помощь. ${what}`, ['disp', 'mech'], { driverId: did });
      else ev('break', `${d.name}${v ? ' · ' + v.plate : ''}: поломка, справится сам. ${what}`, ['disp', 'mech'], { driverId: did });
      msg(ensureDm(did).id, did, (kind === 'sos' ? '🚨 ЭКСТРЕННАЯ ПОЛОМКА — нужна помощь. ' : '🔧 Поломка, справлюсь сам. ') + what, { kind: 'break', coords: coords || null });
    });
  },
  ackBreakdown(did, text) {
    return tx(db => {
      const d = D(did); if (!d || !d.breakdown) return;
      d.breakdown.ack = { at: now(), text };
      const b = db.breakdowns.find(x => x.id === d.breakdown.id); if (b) b.ack = d.breakdown.ack;
      msg(ensureDm(did).id, 'disp', '✅ ' + text);
      ev('ack', 'Диспетчер: ' + text, [did]);
    });
  },
  fixed(did) {
    return tx(db => {
      const d = D(did); if (!d) return;
      const b = d.breakdown && db.breakdowns.find(x => x.id === d.breakdown.id); if (b) b.fixedAt = now();
      d.status = 'line'; d.since = now(); d.breakdown = null;
      msg(ensureDm(did).id, did, '✅ Починился, снова на линии');
      ev('clock', `${d.name} снова на линии после поломки`, ['disp', 'mech']);
    });
  },
  /* открыть заявку: не больше водителей, чем осталось рейсов */
  openOrder(oid, did) {
    return tx(db => {
      const o = O(oid); if (!o) return { ok: false, gone: true };
      if (o.status === 'closed') return { ok: false, closed: true };
      const left = orderLeft(o);
      if (left === 0) return { ok: false, spent: true };
      db.locks[oid] = db.locks[oid] || {};
      const others = viewers(o, did);
      if (!db.locks[oid][did] || db.locks[oid][did] < now()) {
        if (others.length >= left) return { ok: false, full: true, viewers: others.length, left };
      }
      db.locks[oid][did] = now() + LOCK_MS;
      return { ok: true };
    });
  },
  releaseOrder(oid, did) {
    const L = (db.locks || {})[oid];
    if (!L || !L[did]) return;
    tx(db => { if (db.locks[oid]) delete db.locks[oid][did]; });
  },
  takeTrip(oid, did) {
    return tx(db => {
      const o = O(oid), d = D(did), v = vehOf(did);
      if (!o || o.status === 'closed') return { ok: false, why: 'Заявка закрыта' };
      if (!d || d.status !== 'line') return { ok: false, why: 'Сначала начните день — статус «На линии»' };
      if (!v) return { ok: false, why: 'За вами не закреплена машина. Обратитесь к механику' };
      if (v.state === 'repair') return { ok: false, why: 'Ваша машина в ремонте' };
      if (activeTrip(did)) return { ok: false, why: 'Сначала завершите текущий рейс' };
      if (orderLeft(o) === 0) return { ok: false, why: 'Рейсов не осталось — заявка потрачена' };
      // рейс сразу в работе — подтверждение диспетчера не нужно
      const t = { id: uid('t'), orderId: oid, driverId: did, vehicleId: v.id, state: 'confirmed', takenAt: now(), confirmedAt: now(), doneAt: null, m3: o.m3 || v.volume, ttn: null, by: 'driver' };
      db.trips.push(t);
      if (db.locks[oid]) delete db.locks[oid][did];
      const left = orderLeft(o);
      ev('take', `${d.name} взял рейс по заявке №${o.no} · осталось ${left}`, ['disp'], { tripId: t.id });
      if (left === 0) { o.spentAt = now(); sysMsgToOrderChats(o, `Заявка №${o.no} — все рейсы разобраны. ПОТРАЧЕНО`); }
      return { ok: true, trip: t };
    });
  },
  confirmTrip(tid) {
    return tx(db => {
      const t = db.trips.find(x => x.id === tid); if (!t || t.state !== 'pending') return;
      t.state = 'confirmed'; t.confirmedAt = now();
      const o = O(t.orderId);
      msg(ensureDm(t.driverId).id, 'disp', `Рейс по заявке №${o.no} подтверждён. Можно ехать`, { orderId: o.id });
      ev('confirm', `Диспетчер подтвердил рейс по заявке №${o.no}`, [t.driverId]);
    });
  },
  rejectTrip(tid, why) {
    return tx(db => {
      const t = db.trips.find(x => x.id === tid); if (!t || t.state !== 'pending') return;
      t.state = 'rejected'; t.rejectWhy = why || '';
      const o = O(t.orderId); o.spentAt = null;
      msg(ensureDm(t.driverId).id, 'disp', `Рейс по заявке №${o.no} отклонён${why ? ': ' + why : ''}`, { orderId: o.id });
      ev('reject', `Рейс по заявке №${o.no} отклонён`, [t.driverId]);
    });
  },
  cancelTrip(tid) {
    return tx(db => {
      const t = db.trips.find(x => x.id === tid); if (!t || (t.state !== 'pending' && t.state !== 'confirmed')) return;
      t.state = 'cancelled'; t.cancelledAt = now();
      const o = O(t.orderId), d = D(t.driverId); o.spentAt = null;
      ev('cancel', `${d.name} отказался от рейса по заявке №${o.no} — рейс вернулся в заявку`, ['disp']);
    });
  },
  completeTrip(tid, m3v, ttn, tn) {
    return tx(db => {
      const t = db.trips.find(x => x.id === tid); if (!t) return;
      t.state = 'done'; t.doneAt = now(); t.m3 = +m3v || 0; t.ttn = ttn || null; if (tn != null) t.tn = +tn || 0;
      if (!t.confirmedAt) t.confirmedAt = now();
      const o = O(t.orderId), d = D(t.driverId);
      ev('done', `${d.name} выполнил рейс №${o.no} · ${m3(t.m3)}${ttn ? (ttn.check === 'review' ? ' · ⚠ ТТН на проверке: ' + ttn.why : ' · ТТН' + (ttn.no ? ' №' + ttn.no : '') + ' проверена') : ' · без ТТН'}`, ['disp'], { tripId: t.id });
    });
  },
  ttnOk(tid) { return tx(db => { const t = db.trips.find(x => x.id === tid); if (t && t.ttn) { t.ttn.check = 'disp'; t.ttn.okAt = now(); } }); },
  assignTrip(oid, did) {
    return tx(db => {
      const o = O(oid), d = D(did), v = vehOf(did);
      if (!o || orderLeft(o) === 0) return { ok: false, why: 'В заявке не осталось рейсов' };
      if (!v) return { ok: false, why: 'У водителя нет машины' };
      if (activeTrip(did)) return { ok: false, why: 'У водителя уже есть рейс' };
      const t = { id: uid('t'), orderId: oid, driverId: did, vehicleId: v.id, state: 'confirmed', takenAt: now(), confirmedAt: now(), doneAt: null, m3: o.m3 || v.volume, ttn: null, by: 'disp' };
      db.trips.push(t);
      msg(ensureDm(did).id, 'disp', `Вам назначен рейс по заявке №${o.no}`, { orderId: o.id });
      ev('assign-trip', `Вам назначен рейс по заявке №${o.no}`, [did]);
      if (orderLeft(o) === 0) { o.spentAt = now(); sysMsgToOrderChats(o, `Заявка №${o.no} — все рейсы разобраны. ПОТРАЧЕНО`); }
      return { ok: true };
    });
  },
  saveOrder(data, targets) {
    return tx(db => {
      let o = data.id && O(data.id);
      if (o) Object.assign(o, data);
      else {
        o = Object.assign({ id: uid('o'), no: ++db.seq.order, created: now(), status: 'open', chats: [], topups: [] }, data);
        db.orders.push(o);
      }
      postOrder(o, targets || []);
      return o;
    });
  },
  sendOrder(oid, targets) { return tx(db => { const o = O(oid); if (o) postOrder(o, targets); }); },
  refill(oid, n) {
    return tx(db => {
      const o = O(oid); if (!o || n < 1) return;
      o.total += n; o.topups.push({ n, at: now() }); o.spentAt = null; if (o.status === 'closed') o.status = 'open';
      sysMsgToOrderChats(o, `Пополнение: +${nTrips(n)} по заявке №${o.no}. Осталось ${orderLeft(o)}`);
      const to = new Set(); (o.chats || []).forEach(cid => chatMembers(C(cid) || { kind: 'x' }).forEach(x => to.add(x)));
      ev('refill', `Пополнение заявки №${o.no}: +${nTrips(n)}`, [...to]);
    });
  },
  closeOrder(oid) { return tx(db => { const o = O(oid); if (o) { o.status = 'closed'; o.closedAt = now(); delete db.locks[oid]; sysMsgToOrderChats(o, `Заявка №${o.no} закрыта диспетчером`); } }); },
  reopenOrder(oid) { return tx(db => { const o = O(oid); if (o) { o.status = 'open'; o.closedAt = null; } }); },
  send(chatId, from, text, extra) {
    return tx(db => {
      let c = C(chatId);
      if (!c && chatId.startsWith('dm-') && D(chatId.slice(3))) c = ensureDm(chatId.slice(3));
      if (!c) return;
      msg(c.id, from, text, extra);
      const to = from === 'disp' ? chatMembers(c) : ['disp', ...chatMembers(c).filter(x => x !== from)];
      const who = from === 'disp' ? 'Диспетчер' : (D(from) || {}).name;
      ev('msg', `${who}${c.kind === 'dm' ? '' : ' в «' + chatTitle(c) + '»'}: ${text.slice(0, 80)}`, to, { chatId });
    });
  },
  markRead(key, chatId) {
    const last = db.messages.filter(m => m.chatId === chatId).slice(-1)[0];
    if (!last) return;
    const r = (db.reads[key] || {})[chatId] || 0;
    if (r >= last.at) return;
    tx(db => { db.reads[key] = db.reads[key] || {}; db.reads[key][chatId] = now(); });
  },
  createGroup(title, members) { return tx(db => { const c = { id: uid('g'), kind: 'group', title, members }; db.chats.push(c); msg(c.id, 'sys', `Создан групповой чат «${title}»`, { kind: 'sys' }); return c; }); },
  tapIn(vid, did, by) {
    return tx(db => {
      const v = V(vid); if (!v) return;
      const prevV = did && vehOf(did); if (prevV && prevV.id !== vid) { prevV.driverId = null; }
      const prevD = v.driverId;
      v.driverId = did || null;
      db.assignLog.push({ at: now(), vehicleId: vid, driverId: did || null, prevDriverId: prevD || null, by });
      const d = did && D(did);
      if (d) {
        ev('tapin', `Механик: ${d.name} → ${v.plate} ${v.region}`, ['disp', did]);
        msg(ensureDm(did).id, 'sys', `Механик закрепил за вами машину ${v.plate} ${v.region} (${v.model})`, { kind: 'sys' });
      } else ev('tapin', `Механик снял водителя с ${v.plate} ${v.region}`, ['disp']);
    });
  },
  vehState(vid, state, note) {
    return tx(db => {
      const v = V(vid); if (!v) return;
      v.state = state; v.stateNote = note || ''; v.stateAt = now();
      ev('veh', `${v.plate} ${v.region}: ${state === 'repair' ? 'в ремонте' + (note ? ' — ' + note : '') : 'готова к работе'}`, ['disp', ...(v.driverId ? [v.driverId] : [])]);
    });
  },
  addDoc(owner, doc) {
    return tx(db => {
      const o = owner.type === 'driver' ? D(owner.id) : V(owner.id); if (!o) return;
      o.docs.push(doc);
    });
  },
  delDoc(owner, docId) { return tx(db => { const o = owner.type === 'driver' ? D(owner.id) : V(owner.id); if (o) o.docs = o.docs.filter(x => x.id !== docId); }); },
  setDriverFields(did, patch) { return tx(db => { const d = D(did); if (!d) return; if ('name' in patch) d.name = patch.name; if ('phone' in patch) d.phone = patch.phone; Object.assign(d.f, patch); delete d.f.name; }); },
  addDriver(data) { return tx(db => { const d = { id: uid('d'), name: data.name, phone: data.phone || '', status: 'off', since: now(), breakdown: null, f: {}, docs: [], hired: isoDay(now()) }; db.drivers.push(d); return d; }); },
  addVehicle(data) { return tx(db => { const v = Object.assign({ id: uid('v'), state: 'ready', stateNote: '', driverId: null, docs: [] }, data); db.vehicles.push(v); return v; }); },
  setting(k, val) { return tx(db => { db.settings[k] = val; }); },
  setQuick(role, list) { return tx(db => { const q = Object.assign({}, QUICK_DEF, db.settings.quick || {}); q[role] = list; db.settings.quick = q; }); },
};
function postOrder(o, targets) {
  targets.forEach(tg => {
    let c = tg.startsWith('d:') ? ensureDm(tg.slice(2)) : C(tg);
    if (!c) return;
    if (!o.chats.includes(c.id)) o.chats.push(c.id);
    msg(c.id, 'disp', '', { orderId: o.id, kind: 'order' });
    ev('order', `Новая заявка №${o.no}: ${o.cargo}, ${nTrips(orderLeft(o))}`, chatMembers(c), { orderId: o.id });
  });
}

/* ---------- файлы (IndexedDB) ---------- */
const FS = {
  _db: null,
  open() {
    if (this._db) return this._db;
    this._db = new Promise((res, rej) => {
      const r = indexedDB.open('trassa-hq-files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._db;
  },
  async _put(rec) { const d = await this.open(); await new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async put(blob, name, mime) {
    const id = uid('f'), rec = { id, blob, name, mime: mime || blob.type, size: blob.size, at: now() };
    await this._put(rec);
    if (Cloud.on) this.up(rec, 0);
    return id;
  },
  async up(rec, n) {   // отправить файл в общую базу (с повтором, если нет связи)
    try { await api('trassa_files', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ id: rec.id, name: rec.name, mime: rec.mime, size: rec.size, b64: await blobB64(rec.blob) }) }); }
    catch (e) { if (n < 20) setTimeout(() => this.up(rec, n + 1), 4000 * (n + 1)); }
  },
  async get(id) {
    const d = await this.open();
    let rec = await new Promise((res, rej) => { const r = d.transaction('f').objectStore('f').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
    if (!rec && Cloud.on) {   // файл загружен с другого телефона — скачать
      if (typeof toast === 'function') toast('Загружаем файл…', 'Он был добавлен с другого телефона');
      for (let n = 0; n < 3 && !rec; n++) {
        try { const rows = await api(`trassa_files?id=eq.${encodeURIComponent(id)}&select=id,name,mime,size,b64`); const x = rows && rows[0]; if (x) { rec = { id: x.id, blob: b64ToBlob(x.b64, x.mime), name: x.name, mime: x.mime, size: x.size, at: now() }; await this._put(rec); } }
        catch (e) {}
        if (!rec && n < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
    return rec;
  },
  async clear() { const d = await this.open(); await new Promise(res => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').clear(); t.oncomplete = res; }); if (Cloud.on) { try { await api('rpc/trassa_files_clear', { method: 'POST', body: '{}' }); } catch (e) {} } },
};

/* ---------- демо-данные ---------- */
function seed() {
  const T = now(), t0 = startOfDay(T);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const DR = [
    ['Ибрагим Ибрагимов', '+7 926 333-12-40', '1986-04-12'], ['Алексей Смирнов', '+7 915 204-77-18', '1979-09-03'],
    ['Руслан Магомедов', '+7 903 512-66-09', '1990-01-25'], ['Сергей Волков', '+7 916 845-21-30', '1983-06-14'],
    ['Дмитрий Козлов', '+7 925 117-48-52', '1988-11-30'], ['Тимур Алиев', '+7 929 640-15-77', '1992-03-08'],
    ['Андрей Морозов', '+7 917 388-02-64', '1976-12-19'], ['Шамиль Гаджиев', '+7 968 201-93-45', '1987-08-22'],
    ['Николай Петров', '+7 909 776-50-11', '1981-02-05'], ['Артём Соколов', '+7 985 430-18-26', '1995-05-17'],
    ['Фарход Каримов', '+7 977 652-39-80', '1989-10-10'], ['Олег Лебедев', '+7 926 919-04-73', '1984-07-28'],
    ['Владимир Новиков', '+7 903 158-62-37', '1978-04-01'], ['Азамат Юсупов', '+7 999 285-71-14', '1993-12-12'],
  ];
  const VH = [
    ['Ч333АГ', '777', 'Shacman X3000', '8×4', 25, 2022], ['А714ВК', '198', 'Shacman X3000', '8×4', 25, 2023],
    ['В205ОР', '778', 'FAW J6P', '6×4', 20, 2021], ['Е381МН', '198', 'FAW J6P', '6×4', 20, 2021],
    ['К902СТ', '778', 'Shacman X3000', '8×4', 25, 2022], ['М457АХ', '198', 'FAW J6P', '8×4', 24, 2023],
    ['Н628ТУ', '778', 'Shacman X6000', '8×4', 28, 2024], ['О119КВ', '198', 'FAW J6P', '6×4', 20, 2020],
    ['Р560ЕС', '778', 'Shacman X3000', '6×4', 22, 2022], ['С743НМ', '198', 'HOWO TX', '8×4', 25, 2023],
    ['Т286ОА', '778', 'FAW J6P', '8×4', 24, 2022], ['У831РК', '198', 'Shacman X3000', '8×4', 25, 2021],
    ['Х074ВЕ', '778', 'Shacman X3000', '8×4', 25, 2024], ['В992УХ', '198', 'FAW J6P', '6×4', 20, 2019],
    ['А350ТТ', '778', 'Shacman X6000', '8×4', 28, 2024],
  ];
  const drivers = DR.map((x, i) => ({
    id: 'd' + (i + 1), name: x[0], phone: x[1], status: 'off', since: T - rnd(10, 16) * HOUR, breakdown: null,
    f: { birth: x[2], licenseCats: 'B, C, CE', licenseExp: '', passport: '', license: '' }, docs: [], hired: '2024-0' + (1 + i % 9) + '-15',
  }));
  const vehicles = VH.map((x, i) => ({
    id: 'v' + (i + 1), plate: x[0], region: x[1], model: x[2], axle: x[3], kind: 'Самосвал', volume: x[4], year: x[5],
    vin: 'LZGJX4N' + (60 + i) + 'NX0' + (41000 + i * 137), state: 'ready', stateNote: '', driverId: i < 14 ? 'd' + (i + 1) : null, docs: [],
  }));
  vehicles[13].driverId = null; vehicles[13].state = 'repair'; vehicles[13].stateNote = 'Замена ТНВД, ждём запчасть'; vehicles[13].stateAt = T - 2 * DAY;
  drivers[0].f = Object.assign(drivers[0].f, { passport: '45 12 345678', passportIssued: 'ГУ МВД России по г. Москве, 14.05.2016', license: '99 31 482915', licenseExp: '2031-03-18', med: '2026-08-01', address: 'г. Москва, ул. Лобненская, д. 12, кв. 48', snils: '123-456-789 01' });

  const shifts = [];
  const online = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11];
  online.forEach(i => { const st = Math.min(T - rnd(1.5, 4) * HOUR, Math.max(t0 + 6.5 * HOUR, T - 6 * HOUR)); drivers[i].status = 'line'; drivers[i].since = st; shifts.push({ id: uid('s'), driverId: drivers[i].id, start: st, end: null }); });
  drivers[8].status = 'broken'; drivers[8].since = T - 35 * MIN;
  drivers[8].breakdown = { id: 'b0', kind: 'local', reason: 'Колесо', note: 'Пробил колесо на въезде в карьер, меняю сам', coords: null, at: T - 35 * MIN, ack: null, vehicleId: 'v9' };
  shifts.push({ id: uid('s'), driverId: 'd9', start: T - 3 * HOUR, end: null });

  // история: смены и рейсы за 7 прошлых дней
  const PL = {
    sych: { addr: 'Карьер «Сычёво», Волоколамский г.о.', lat: 55.9301, lng: 36.0302 },
    ram: { addr: 'Раменский ГОК, Раменское', lat: 55.5372, lng: 38.2448 },
    nagat: { addr: 'Котлован, ул. Нагатинская, 3, Москва', lat: 55.6831, lng: 37.6237 },
    sever: { addr: 'ЖК «Северный парк», Дмитровское ш., 107', lat: 55.8889, lng: 37.5431 },
    m12: { addr: 'Трасса М-12, 47 км, участок 3', lat: 55.7702, lng: 38.4829 },
    poligon: { addr: 'Полигон «Лесная», Новая Москва', lat: 55.4268, lng: 37.2884 },
    asfalt: { addr: 'АБЗ «Капотня», 2-й квартал', lat: 55.6345, lng: 37.7911 },
    park: { addr: 'Благоустройство парка, Люблино', lat: 55.6772, lng: 37.7604 },
  };
  const CL = ['ООО «СтройГрад»', 'АО «Дорстрой-12»', 'ГК «Мосинжпроект»', 'ООО «Котлован Сервис»', 'ООО «ГорПарк»'];
  const orders = [], trips = []; let no = 85;
  for (let day = 7; day >= 1; day--) {
    const base = t0 - day * DAY;
    const nOrd = 2 + (day % 2);
    for (let k = 0; k < nOrd; k++) {
      const [from, to, cargo, cl] = pick([[PL.sych, PL.sever, 'Песок мытый', CL[0]], [PL.ram, PL.m12, 'Щебень гранитный 20–40', CL[1]], [PL.nagat, PL.poligon, 'Грунт (вывоз)', CL[3]], [PL.asfalt, PL.park, 'Асфальтовая крошка', CL[4]]]);
      const total = 4 + Math.floor(rnd(0, 9));
      const o = { id: 'oh' + no, no: no++, client: cl, cargo, from, to, contactFrom: { name: 'Мастер участка', phone: '+7 916 000-12-34' }, contactTo: { name: 'Прораб', phone: '+7 925 000-56-78' }, m3: pick([20, 22, 25]), total, price: pick([6500, 7200, 8800]), date: isoDay(base), time: '07:30', note: '', created: base + 6 * HOUR, status: 'open', chats: ['c-all'], topups: [], spentAt: base + 15 * HOUR };
      orders.push(o);
      for (let j = 0; j < total; j++) {
        const di = Math.floor(rnd(0, 13)), tt = base + rnd(7.5, 18) * HOUR;
        trips.push({ id: uid('t'), orderId: o.id, driverId: 'd' + (di + 1), vehicleId: 'v' + (di + 1), state: 'done', takenAt: tt, confirmedAt: tt + 3 * MIN, doneAt: tt + rnd(1.2, 2.6) * HOUR, m3: o.m3, ttn: null, by: 'driver' });
      }
    }
    for (let i = 0; i < 13; i++) if (Math.random() < .78) { const s = base + rnd(6.5, 8) * HOUR; shifts.push({ id: uid('s'), driverId: 'd' + (i + 1), start: s, end: s + rnd(8, 11.5) * HOUR }); }
  }
  // сегодня
  const mk = (no, data) => Object.assign({ id: 'o' + no, no, created: T - rnd(1, 3) * HOUR, status: 'open', chats: [], topups: [], date: isoDay(T), price: 0, note: '' }, data);
  const o101 = mk(101, { client: CL[0], cargo: 'Песок мытый', from: PL.sych, to: PL.sever, contactFrom: { name: 'Виктор, весовая', phone: '+7 916 482-10-55' }, contactTo: { name: 'Олег Петрович, прораб', phone: '+7 925 301-44-90' }, m3: 20, total: 9, price: 7200, time: '07:00', note: 'Въезд на объект с Дмитровского ш., пропуск на КПП №2. Мойка колёс обязательна.', chats: ['g1'] });
  const o102 = mk(102, { client: CL[1], cargo: 'Щебень гранитный 20–40', from: PL.ram, to: PL.m12, contactFrom: { name: 'Диспетчер ГОКа', phone: '+7 496 463-22-10' }, contactTo: { name: 'Андрей, мастер', phone: '+7 903 774-18-62' }, m3: 18, total: 12, price: 8800, time: '08:00', note: 'Разгрузка по команде мастера. Не перегружать — весы на выезде.', chats: ['c-all'] });
  const o103 = mk(103, { client: CL[3], cargo: 'Грунт (вывоз)', from: PL.nagat, to: PL.poligon, contactFrom: { name: 'Сергей, экскаваторщик', phone: '+7 977 120-36-48' }, contactTo: { name: 'Полигон, весовая', phone: '+7 495 228-41-07' }, m3: 25, total: 6, price: 6500, time: '09:30', note: 'Талоны на полигон — у мастера на котловане.', chats: ['c-all'] });
  const o104 = mk(104, { client: CL[4], cargo: 'Асфальтовая крошка', from: PL.asfalt, to: PL.park, contactFrom: { name: 'АБЗ, отгрузка', phone: '+7 495 350-17-26' }, contactTo: { name: 'Ирина, прораб', phone: '+7 926 650-09-31' }, m3: 20, total: 3, price: 6900, time: '10:00', note: 'Только 3 рейса — откроют максимум 3 водителя одновременно.', chats: ['c-all'] });
  const o100 = mk(100, { client: CL[2], cargo: 'ПГС', from: PL.ram, to: PL.sever, contactFrom: { name: 'Диспетчер ГОКа', phone: '+7 496 463-22-10' }, contactTo: { name: 'Олег Петрович, прораб', phone: '+7 925 301-44-90' }, m3: 22, total: 5, price: 7600, time: '06:30', created: T - 5 * HOUR, chats: ['c-all'], spentAt: T - 2 * HOUR });
  orders.push(o100, o101, o102, o103, o104);
  // ставки за м³ (водителю / компании); щебень — за тонну
  orders.forEach(o => { if (o.price) { o.unit = 'm3'; o.rateDrv = Math.round(o.price / o.m3 / 10) * 10; o.rateCo = Math.round(o.rateDrv * 1.35 / 10) * 10; o.price = 0; } });
  Object.assign(o102, { unit: 't', rateDrv: 260, rateCo: 350 });
  const tr = (o, di, state, hAgo, by) => trips.push({ id: uid('t'), orderId: o.id, driverId: 'd' + di, vehicleId: 'v' + di, state, takenAt: T - hAgo * HOUR, confirmedAt: state !== 'pending' ? T - hAgo * HOUR + 4 * MIN : null, doneAt: state === 'done' ? T - (hAgo - 1.4) * HOUR : null, m3: o.m3, ttn: null, by: by || 'driver' });
  [[1, 4], [2, 4.2], [3, 3.9], [4, 3.6], [6, 3.4]].forEach(([d, h]) => tr(o100, d, 'done', h));
  tr(o101, 2, 'done', 2.6); tr(o101, 3, 'done', 2.4); tr(o101, 1, 'done', 2.2);
  tr(o101, 4, 'confirmed', .7); tr(o101, 5, 'confirmed', .12);
  tr(o102, 7, 'done', 2.5); tr(o102, 8, 'done', 2.1); tr(o102, 6, 'confirmed', .5);
  tr(o102, 12, 'confirmed', .05);
  trips.forEach(t => { if (t.orderId === o102.id && t.state === 'done') t.tn = 26 + Math.round(Math.random() * 30) / 10; });

  const chats = [
    { id: 'c-all', kind: 'all', title: 'Все водители' },
    { id: 'g1', kind: 'group', title: 'Карьер Сычёво', members: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] },
    { id: 'g2', kind: 'group', title: 'Ночная смена', members: ['d10', 'd11', 'd13', 'd14'] },
  ];
  const messages = [];
  const M = (chatId, from, text, at, extra) => messages.push(Object.assign({ id: uid('m'), chatId, from, text, at }, extra || {}));
  M('c-all', 'sys', 'Общий чат всех водителей', t0 - 30 * DAY, { kind: 'sys' });
  M('g1', 'sys', 'Создан групповой чат «Карьер Сычёво»', t0 - 10 * DAY, { kind: 'sys' });
  M('g2', 'sys', 'Создан групповой чат «Ночная смена»', t0 - 10 * DAY, { kind: 'sys' });
  M('c-all', 'disp', 'Доброе утро! Сегодня основная работа — Сычёво и Раменский ГОК. Не забывайте отмечать начало дня.', T - 4.5 * HOUR);
  M('c-all', 'disp', '', o100.created, { orderId: o100.id, kind: 'order' });
  M('c-all', 'd2', 'Принял, выезжаю', T - 4.3 * HOUR);
  M('c-all', 'sys', 'Заявка №100 — все рейсы разобраны. ПОТРАЧЕНО', o100.spentAt, { orderId: o100.id, kind: 'sys' });
  M('g1', 'disp', '', o101.created, { orderId: o101.id, kind: 'order' });
  M('g1', 'd3', 'На весовой очередь минут 40', T - 2.3 * HOUR);
  M('g1', 'd1', 'Понял, через Лобню поеду', T - 2.2 * HOUR);
  M('c-all', 'disp', '', o102.created, { orderId: o102.id, kind: 'order' });
  M('c-all', 'disp', '', o103.created, { orderId: o103.id, kind: 'order' });
  M('c-all', 'd7', 'На М-12 пробка в сторону области, закладывайте время', T - 1.1 * HOUR);
  M('c-all', 'disp', '', o104.created, { orderId: o104.id, kind: 'order' });
  M('dm-d9', 'd9', '🔧 Поломка, справлюсь сам. Колесо: Пробил колесо на въезде в карьер, меняю сам', T - 35 * MIN, { kind: 'break' });
  chats.push({ id: 'dm-d9', kind: 'dm', driverId: 'd9', title: '' });
  chats.push({ id: 'dm-d1', kind: 'dm', driverId: 'd1', title: '' });
  M('dm-d1', 'disp', 'Ибрагим, после обеда будет срочная заявка на Люблино, держи в курсе', T - 1.6 * HOUR);
  M('dm-d1', 'd1', 'Хорошо, Фёдор, наберу', T - 1.5 * HOUR);
  messages.sort((a, b) => a.at - b.at);

  const assignLog = vehicles.filter(v => v.driverId).map(v => ({ at: t0 - 14 * DAY, vehicleId: v.id, driverId: v.driverId, prevDriverId: null, by: 'mech' }));
  return {
    v: 1, rev: 1, seededAt: T, seq: { order: 104 },
    settings: { bots: false },
    drivers, vehicles, orders, trips, shifts, chats, messages, assignLog,
    breakdowns: [Object.assign({ driverId: 'd9' }, drivers[8].breakdown)],
    locks: {}, reads: { disp: Object.fromEntries(chats.map(c => [c.id, T])) }, events: [],
    people: { disp: { name: 'Фёдор Ямщиков', role: 'Диспетчер', phone: '+7 916 000-00-01' }, mech: { name: 'Геннадий Ершов', role: 'Механик', phone: '+7 916 000-00-02' } },
  };
}

db = loadRaw();
// демо: данные старше 10 часов создаются заново, чтобы смены и рейсы выглядели «сегодня»
if (!db || db.v !== 1 || (!Cloud.on && now() - (db.seededAt || 0) > 10 * HOUR)) { db = seed(); saveRaw(); }
// старые данные: рейсы «ждёт подтверждения» сразу в работу
if (db.trips.some(t => t.state === 'pending')) { db.trips.forEach(t => { if (t.state === 'pending') { t.state = 'confirmed'; t.confirmedAt = t.confirmedAt || now(); } }); saveRaw(); }
if (Cloud.on) cloudStart();
