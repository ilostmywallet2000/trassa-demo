/* ТРАССА — демо рабочего места диспетчера. Все данные тестовые. */
(() => {
'use strict';

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const pad = n => String(n).padStart(2, '0');
const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const minsAgo = m => new Date(Date.now() - m * 60000);
function ago(d){
  const s = Math.max(0, (Date.now() - d) / 1000);
  if (s < 4) return 'сейчас';
  if (s < 60) return Math.floor(s) + ' с назад';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60);
  return h + ' ч ' + (m % 60) + ' мин назад';
}
function dur(min){ min = Math.round(min); return min < 60 ? min + ' мин' : Math.floor(min/60) + ' ч ' + pad(min%60) + ' мин'; }
const initials = n => n.split(' ').slice(0, 2).map(w => w[0]).join('');
const shortName = n => { const p = n.split(' '); return p[0] + ' ' + (p[1]||'')[0] + '.' + (p[2] ? ' ' + p[2][0] + '.' : ''); };
const firstName = n => n.split(' ')[1] || n;
const fmtDate = s => { if(!s) return '—'; const [y,m,d] = s.split('-'); return d + '.' + m + '.' + y; };
const daysTo = s => Math.round((new Date(s) - new Date()) / 864e5);
const TS = 6;              // ускорение времени симуляции
const FALLBACK_SEC = 6;    // демо: ожидание подтверждения приложения
const SMS_PRICE = 4.2;     // ₽ за сегмент, примерно

/* ================= reference data ================= */
const PLACES = {
  domodedovskaya:'Склад «Южный», Каширское ш., 61', khimki:'РЦ Химки, Ленинградское ш., 16',
  vnukovo_dir:'Терминал Внуково-Карго, Киевское ш.', sokolniki:'Магазин, ул. Русаковская, 22',
  lyublino:'Склад, ул. Краснодонская, 2', tushino:'Гипермаркет, Волоколамское ш., 103',
  kuzminki:'Оптовая база, Волгоградский пр-т, 189', krylatskoe:'ТЦ, Осенний бульвар, 12',
  butovo:'Склад «Бутово», ул. Поляны, 8', otradnoe:'Супермаркет, ул. Декабристов, 12',
  moskva_city:'Клиент, Пресненская наб., 10', kapotnya:'Промзона Капотня, 2-й квартал',
  medvedkovo:'Строймаркет, Осташковская ул., 1', yasenevo:'Склад, Новоясеневский пр-т, 1',
  perovo:'Мебельная фабрика, ш. Энтузиастов, 31', kuntsevo:'Клиент, Можайское ш., 2',
  center:'Ресторан, ул. Мясницкая, 13', izmaylovo:'Фабрика-кухня, Измайловское ш., 71'
};
const ROUTE_ENDS = [['domodedovskaya','khimki'],['vnukovo_dir','sokolniki'],['lyublino','tushino'],['kuzminki','krylatskoe'],
  ['butovo','otradnoe'],['moskva_city','kapotnya'],['medvedkovo','yasenevo'],['perovo','kuntsevo'],['center','izmaylovo']];

const TRACKERS = ['Galileosky 7.0', 'Навтелеком Смарт S-2435', 'Teltonika FMB920', 'Арнави 5', 'Galileosky Base Block'];
const vehicles = [
  ['А482ВК','777','Volvo FH 460','Фура','20 т',0,'move',0],
  ['В317ОР','799','ГАЗель Next','Фургон','1,5 т',1,'move',.15],
  ['Е905КМ','750','Hyundai HD78','Среднетоннажный','5 т',2,'move',.3],
  ['К221ТА','977','Isuzu ELF 7.5','Среднетоннажный','5 т',3,'move',.62],
  ['М648ХС','197','КАМАЗ 5490','Фура','20 т',4,'move',.08],
  ['Н073ЕУ','777','Mercedes Sprinter','Фургон','1,8 т',5,'move',.4],
  ['О554АВ','799','ГАЗон Next','Среднетоннажный','5 т',6,'move',.71],
  ['Р190СН','750','Ford Transit (реф.)','Фургон','1,5 т',7,'move',.22],
  ['С836МО','977','ГАЗель Next','Фургон','1,5 т',8,'move',.5],
  ['Т412РК','197','Валдай 6.5','Среднетоннажный','3,5 т',0,'park',.004],
  ['У709ЕА','777','Scania R450','Фура','20 т',4,'park',.5],
  ['Х258ВМ','799','Hyundai Porter','Фургон','1 т',2,'park',.86],
  ['А930ОТ','750','MAN TGS','Фура','18 т',6,'off',.35],
  ['В661КС','977','ГАЗель Next','Фургон','1,5 т',5,'off',.83],
].map((v, i) => ({
  id: 'v' + (i + 1), plate: v[0], reg: v[1], model: v[2], type: v[3], cap: v[4], route: v[5], mode: v[6], s0: v[7],
  imei: '86' + String(4400000000000 + i * 7919371 + 1234567).slice(0, 13),
  sim: '+7 9' + (10 + i * 3) + ' ' + (300 + i * 41) + '-' + pad(10 + i * 5) + '-' + pad(30 + i * 3),
  tracker: TRACKERS[i % TRACKERS.length], driverId: null,
  fuel: Math.round(rnd(28, 92)), volt: (i % 3 ? 27.6 : 13.9) + Math.round(rnd(0, 6)) / 10, temp: v[2].includes('реф') ? -18 : null,
}));
vehicles.forEach(v => { if (['Фургон'].includes(v.type) && v.volt > 20) v.volt = 13.8; });

const DN = [
  'Савельев Андрей Викторович','Мухаметов Ринат Ильдарович','Гончаренко Сергей Петрович','Ким Денис Олегович',
  'Белоусов Михаил Анатольевич','Орлов Павел Сергеевич','Назаров Тимур Рустамович','Широков Алексей Дмитриевич',
  'Ершов Виталий Николаевич','Кузнецов Роман Игоревич','Абдуллаев Шамиль Маратович','Лебедев Константин Юрьевич',
  'Панов Евгений Владимирович','Захаров Илья Андреевич','Фомин Николай Борисович','Дьяченко Артём Олегович'];
const today = new Date();
const dplus = d => { const x = new Date(today); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const drivers = DN.map((n, i) => ({
  id: 'd' + (i + 1), name: n, phone: '+7 9' + (16 + i * 2) + ' ' + (120 + i * 37) + '-' + pad(11 + i * 4) + '-' + pad(90 - i * 3),
  status: i < 14 ? (i < 9 ? 'На рейсе' : 'Свободен') : (i === 14 ? 'Выходной' : 'Больничный'),
  vehicleId: i < 14 ? 'v' + (i + 1) : null,
  license: dplus([820, 400, 1200, 25, 610, 900, 300, 1500, 75, 980, 2000, 540, 33, 700, 410, 1100][i]),
  med: dplus([140, 60, 12, 200, 90, 160, 45, 20, 300, 110, 8, 250, 70, 180, 30, 95][i]),
  trips: [23, 31, 18, 27, 22, 19, 25, 16, 29, 14, 20, 17, 12, 21, 9, 6][i],
  cats: i % 4 === 0 || [4, 10, 12].includes(i) ? 'C, CE' : 'B, C',
  appOnline: ![5, 12, 13].includes(i), lastSeen: minsAgo([1, 0, 3, 2, 0, 47, 1, 6, 0, 12, 4, 9, 134, 88, 900, 2000][i]),
  unread: 0,
}));
drivers.forEach(d => { if (d.vehicleId) vehicles.find(v => v.id === d.vehicleId).driverId = d.id; });
const NIGHT = ['d5', 'd8', 'd11', 'd13'];
const tripNo = d => 'Р-' + (24100 + parseInt(d.id.slice(1)) * 7);
const drvById = id => drivers.find(d => d.id === id);
const vehById = id => vehicles.find(v => v.id === id);
const vehOf = d => d && d.vehicleId ? vehById(d.vehicleId) : null;
const drvOf = v => v && v.driverId ? drvById(v.driverId) : null;
const avClass = id => 'a' + (parseInt(String(id).replace(/\D/g, '')) % 6);

/* ================= state ================= */
let role = 'dispatcher';
let selVeh = null, chatDriver = 'd1', vFilter = 'all', packets = 0, pktWindow = [];
const messages = {}; drivers.forEach(d => messages[d.id] = []);
const logs = [];
let msgSeq = 1;

function log(action, details){
  logs.unshift({ t: new Date(), user: 'Игорь Котов', role: role === 'admin' ? 'Администратор' : 'Диспетчер', action, details });
  if (cur === 'log') renderLog();
  scheduleSave();
}
[[190,'Вход в систему','IP 10.0.4.21, браузер Chrome'],[176,'Изменение водителя','Ким Д. О.: статус «Свободен» → «На рейсе»'],
 [151,'Рассылка','«Пробка на МКАД» — 6 водителей, 1 SMS'],[96,'Экспорт','Таблица водителей, 16 строк'],
 [64,'Просмотр телефона','Орлов П. С.'],[31,'Привязка ТС','К221ТА 977 → Ким Д. О.']]
 .forEach(([m, a, d]) => logs.push({ t: minsAgo(m), user: m > 100 ? 'Мария Лаптева' : 'Игорь Котов', role: m > 100 ? 'Администратор' : 'Диспетчер', action: a, details: d }));

/* seed chat history */
function seed(did, list){
  list.forEach(([m, dir, text, extra]) => messages[did].push(Object.assign({ id: msgSeq++, dir, text, t: minsAgo(m), ch: 'app', st: 'read', trip: tripNo(drvById(did)) }, extra || {})));
}
seed('d1', [[96,'out','Андрей, добрый день. Рейс Р-24107: погрузка на складе «Южный», окно 30 минут.'],[94,'in','Добрый, принял. Выезжаю'],[61,'sys','Статус рейса: Загрузился'],[58,'in','Загрузились, 18 паллет. Выехал на Химки'],[22,'out','Как обстановка на Ленинградке?'],[21,'in','Плотно, но едем. Минут через 40 буду']]);
seed('d2', [[80,'out','Ринат, по Р-24114 клиент просит позвонить за 30 минут до приезда.'],[79,'in','Понял, наберу'],[12,'in','Подъезжаю к Сокольникам, позвонил клиенту']]);
seed('d3', [[45,'out','Сергей, где вы сейчас?'],[44,'in','Каширка, в сторону Тушино. Минут 50']]);
seed('d4', [[30,'out','Денис, после выгрузки пришлите фото накладной.'],[29,'in','Ок']]);
seed('d6', [[140,'out','Павел, подтвердите рейс Р-24142, пожалуйста.',{ ch: 'sms', st: 'delivered', fb: 'sms' }],[126,'in','Подтверждаю. Телефон сел, пишу с SMS',{ ch: 'sms' }]]);
seed('d13', [[150,'out','Евгений, трекер не выходит на связь больше часа. Всё в порядке?',{ ch: 'sms', st: 'delivered', fb: 'sms' }]]);
seed('d5', [[70,'in','На Дмитровке авария, объезжаю через МКАД'],[69,'out','Принято, спасибо']]);
drivers.find(d => d.id === 'd3').unread = 1;
drivers.find(d => d.id === 'd5').unread = 0;

/* ================= routing (views) ================= */
const VIEWS = {
  monitoring: ['Мониторинг', 'Москва · транспорт в реальном времени'],
  chat: ['Связь с водителями', 'Чат в приложении водителя, при недоставке — SMS'],
  broadcast: ['Массовая рассылка', 'Сообщение группе водителей за один раз'],
  drivers: ['Водители', 'База водителей, документы и привязка к ТС'],
  vehicles: ['Транспорт', 'Парк, трекеры ГЛОНАСС и SIM-карты'],
  log: ['Журнал действий', 'Кто, что и когда менял в системе'],
  orders: ['Заявки', 'Перевозки по дням, повтор по расписанию'],
  clients: ['Клиенты', 'База заказчиков, адреса и контакты'],
  docs: ['Документы', 'Паспорта, ВУ, СТС, ОСАГО, техосмотр — сроки и сканы'],
};
let cur = null, openThreadNext = false;
function show(view){
  if (!VIEWS[view] || (view === 'log' && role !== 'admin')) view = 'monitoring';
  cur = view;
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + view));
  $$('.nav-item').forEach(a => a.classList.toggle('on', a.dataset.view === view));
  $('#viewTitle').textContent = VIEWS[view][0];
  $('#viewSub').textContent = VIEWS[view][1];
  if (view === 'monitoring') setTimeout(() => { map.invalidateSize(); if (!fitted) { fitAll(); fitted = true; } }, 30);
  if (view === 'chat') { document.body.classList.toggle('m-thread', openThreadNext); openThreadNext = false; renderConvs(); renderThread(); }
  else document.body.classList.remove('m-thread');
  if (view === 'drivers') renderDrivers();
  if (view === 'vehicles') renderVehicles();
  if (view === 'log') renderLog();
  if (view === 'broadcast') renderBroadcast();
  if (view === 'orders') renderOrders();
  if (view === 'clients') renderClients();
  if (view === 'docs') renderDocs();
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

/* ================= map ================= */
const map = L.map('map', { zoomControl: true, attributionControl: true, preferCanvas: true, minZoom: 9, maxZoom: 16, zoomSnap: .25 })
  .setView([55.75, 37.62], 11);
map.zoomControl.setPosition('bottomright');
map.attributionControl.setPrefix(false).addAttribution('Карта © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
const canvas = L.canvas({ padding: .4 });
function decode(a){ const out = []; let x = 0, y = 0; for (let i = 0; i < a.length; i += 2){ x += a[i]; y += a[i+1]; out.push([x / 1e4, y / 1e4]); } return out; }
const MD = window.MAPDATA;
const DEC = { park: MD.park.map(r => [decode(r)]), water: MD.water.map(r => [decode(r)]), river: (MD.river || []).map(decode), roads: MD.roads.map(l => l.map(decode)) };
L.polygon(DEC.park, { renderer: canvas, stroke: false, fillColor: '#0e1c16', fillOpacity: 1, interactive: false }).addTo(map);
L.polyline((MD.stream || []).map(decode), { renderer: canvas, color: '#10283d', weight: 1.6, interactive: false }).addTo(map);
const riverLayer = L.polyline(DEC.river, { renderer: canvas, color: '#12304a', weight: 7, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
L.polygon(DEC.water, { renderer: canvas, stroke: false, fillColor: '#12304a', fillOpacity: 1, interactive: false }).addTo(map);
const ROAD_STYLE = [
  { color: '#3a4b61', weight: 3.4 },   // motorway (МКАД)
  { color: '#2c3a4c', weight: 2.2 },   // trunk
  { color: '#202b39', weight: 1.5 },   // primary
  { color: '#18212c', weight: 1 },     // secondary
];
const roadLayers = [];
for (let L_ = 3; L_ >= 0; L_--){
  if (L_ === 0) L.polyline(MD.roads[0].map(decode), { renderer: canvas, color: '#FFB547', opacity: .07, weight: 9, interactive: false }).addTo(map);
  roadLayers[L_] = L.polyline(DEC.roads[L_], Object.assign({ renderer: canvas, interactive: false, lineCap: 'round', lineJoin: 'round' }, ROAD_STYLE[L_])).addTo(map);
}
[['Центр',55.752,37.618,1],['Химки',55.892,37.43],['Тушино',55.833,37.44],['Отрадное',55.866,37.6],['Медведково',55.89,37.66],
 ['Сокольники',55.8,37.68],['Измайлово',55.792,37.79],['Перово',55.75,37.8],['Кузьминки',55.703,37.79],['Люблино',55.677,37.755],
 ['Капотня',55.637,37.8],['Ясенево',55.602,37.535],['Бутово',55.57,37.56],['Крылатское',55.763,37.41],['Кунцево',55.728,37.405],
 ['Москва-Сити',55.749,37.537],['МКАД',55.84,37.39,1],['Внуково',55.64,37.39]]
 .forEach(([n, a, b, big]) => L.marker([a, b], { interactive: false, icon: L.divIcon({ className: '', html: `<div class="district${big ? ' big' : ''}">${n}</div>`, iconSize: [0, 0] }) }).addTo(map));
function zoomStyle(){
  const z = map.getZoom();
  roadLayers[3].setStyle({ opacity: z < 10.5 ? 0 : 1, weight: z > 13 ? 2 : 1 });
  roadLayers[2].setStyle({ weight: z > 13 ? 3 : z > 11.5 ? 1.9 : 1.4 });
  roadLayers[1].setStyle({ weight: z > 13 ? 4 : z > 11.5 ? 2.8 : 2.1 });
  roadLayers[0].setStyle({ weight: z > 13 ? 6 : z > 11.5 ? 4 : 3.2 });
  riverLayer.setStyle({ weight: z > 13 ? 22 : z > 12 ? 12 : z > 11 ? 7 : 4 });
}
map.on('zoomend', zoomStyle); zoomStyle();

/* routes geometry */
const R = (window.ROUTES || []).map(pts => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + map.distance(pts[i - 1], pts[i]));
  return { pts, cum, total: cum[cum.length - 1] };
});
function posAt(r, s){
  s = ((s % r.total) + r.total) % r.total;
  let lo = 0, hi = r.cum.length - 1;
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
  const a = r.pts[lo], b = r.pts[hi], seg = r.cum[hi] - r.cum[lo] || 1, f = (s - r.cum[lo]) / seg;
  const lat = a[0] + (b[0] - a[0]) * f, lng = a[1] + (b[1] - a[1]) * f;
  const brg = Math.atan2((b[1] - a[1]) * Math.cos(lat * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
  return { lat, lng, brg };
}
function pathBack(r, sEnd, len){
  len = Math.min(len, r.total - 1); const out = []; const step = 60;
  for (let s = sEnd - len; s <= sEnd; s += step){ const p = posAt(r, s); out.push([p.lat, p.lng]); }
  const p = posAt(r, sEnd); out.push([p.lat, p.lng]); return out;
}

/* vehicle sim init */
vehicles.forEach((v, i) => {
  const r = R[v.route];
  v.s = r.total * v.s0; v.base = v.type === 'Фура' ? 58 : v.type === 'Фургон' ? 50 : 47;
  v.speed = v.mode === 'move' ? v.base * rnd(.7, 1.05) : 0; v.vt = v.speed; v.stopUntil = 0; v.stopReason = '';
  v.status = v.mode === 'off' ? 'off' : v.mode === 'park' ? 'park' : 'move';
  v.lastSig = v.mode === 'off' ? minsAgo(i === 12 ? 134 : 88) : new Date();
  v.parkSince = v.mode === 'park' ? minsAgo([0, 0, 0, 0, 0, 0, 0, 0, 0, 65, 22, 140][i] || 30) : null;
  v.stillFor = 0; v.half = r.total / 2; v.odo = Math.round(rnd(84000, 410000));
  const p = posAt(r, v.s); v.lat = p.lat; v.lng = p.lng; v.brg = p.brg;
  const icon = L.divIcon({ className: '', iconSize: [0, 0], html:
    `<div class="veh s-${v.status}" data-v="${v.id}"><div class="ring"></div><div class="body">${v.status === 'move' ? '<svg class="arrow" viewBox="0 0 12 12"><path d="M6 0.5 L10.5 11 L6 8.4 L1.5 11z"/></svg>' : '<i class="pin"></i>'}</div><div class="lab">${v.plate}</div></div>` });
  v.marker = L.marker([v.lat, v.lng], { icon, riseOnHover: true }).addTo(map).on('click', () => selectVehicle(v.id, true));
});
function markerEl(v){ return v.marker.getElement() && v.marker.getElement().querySelector('.veh'); }
function setMarkerStatus(v){
  const el = markerEl(v); if (!el) return;
  el.className = `veh s-${v.status}${selVeh === v.id ? ' sel' : ''}${v.driverId && sosOf(v.driverId) ? ' sos' : ''}`;
  el.querySelector('.body').innerHTML = v.status === 'move' ? '<svg class="arrow" viewBox="0 0 12 12"><path d="M6 0.5 L10.5 11 L6 8.4 L1.5 11z"/></svg>' : '<i class="pin"></i>';
}
let fitted = false;
function fitAll(){ map.fitBounds(L.latLngBounds(vehicles.map(v => [v.lat, v.lng])).pad(.08)); }
$('#fitAll').onclick = fitAll;

/* simulation loop */
let lastT = performance.now();
function mapVisible(){ return cur === 'monitoring' && !driverMode && $('#start').hidden && !document.hidden; }
function tick(now){
  const vis = mapVisible();
  const dt = Math.min(vis ? .1 : 1, (now - lastT) / 1000); lastT = now;
  const nowMs = Date.now();
  vehicles.forEach(v => {
    if (v.mode !== 'move') return;
    if (v.stopUntil > nowMs){ v.speed = Math.max(0, v.speed - 40 * dt); }
    else {
      if (Math.random() < dt * .25) v.vt = Math.max(12, v.base + rnd(-18, 22));
      v.speed += (v.vt - v.speed) * Math.min(1, dt * .8);
      if (Math.random() < dt * .006){ v.stopUntil = nowMs + rnd(5000, 12000); v.stopReason = pick(['Светофор', 'Затор', 'Пробка']); }
      const before = v.s;
      v.s += v.speed / 3.6 * dt * TS;
      if (before < v.half && v.s >= v.half){ v.stopUntil = nowMs + 22000; v.stopReason = 'Выгрузка'; }
      const r = R[v.route]; if (v.s >= r.total){ v.s -= r.total; v.stopUntil = nowMs + 15000; v.stopReason = 'Погрузка'; }
      v.fuel = Math.max(8, v.fuel - dt * .004);
    }
    v.stillFor = v.speed < 1 ? v.stillFor + dt : 0;
    const ns = v.stillFor > 3 ? 'park' : 'move';
    if (ns !== v.status){ v.status = ns; v.parkSince = ns === 'park' ? new Date() : null; setMarkerStatus(v); }
    const p = posAt(R[v.route], v.s); v.lat = p.lat; v.lng = p.lng;
    if (v.speed > 1) v.brg = p.brg;
    if (!vis) return;   // карту не видно — не перерисовываем, экономим батарею
    v.marker.setLatLng([v.lat, v.lng]);
    const el = markerEl(v); const ar = el && el.querySelector('.arrow');
    if (ar) ar.style.transform = `rotate(${v.brg}deg)`;
  });
  if (playing && vis) stepPlay(dt);
  if (vis) requestAnimationFrame(tick); else setTimeout(() => tick(performance.now()), 500);
}
requestAnimationFrame(tick);

/* telemetry pings (simulated EGTS packets) */
setInterval(() => {
  vehicles.forEach(v => {
    if (v.mode === 'off') return;
    if (Math.random() < (v.mode === 'move' ? .55 : .12)){ v.lastSig = new Date(); packets++; pktWindow.push(Date.now()); }
  });
  pktWindow = pktWindow.filter(t => Date.now() - t < 60000);
  $('#intPackets').textContent = packets.toLocaleString('ru');
  $('#hudRate').textContent = pktWindow.length + ' пакетов/мин';
}, 1000);

/* ================= vehicle list & card ================= */
const truckSvg = '<svg viewBox="0 0 24 24"><path d="M2.5 7h11v9h-11zM13.5 10h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>';
const plateHtml = (v, lg) => `<span class="plate${lg ? ' lg' : ''}"><span class="pn">${v.plate.slice(0,1)}&thinsp;${v.plate.slice(1,4)}&thinsp;${v.plate.slice(4)}</span><span class="pr">${v.reg}<i>RUS</i></span></span>`;
const statusPill = v => v.status === 'move' ? '<span class="pill move">● В движении</span>' : v.status === 'park' ? '<span class="pill park">■ Стоянка</span>' : '<span class="pill off">○ Нет связи</span>';
function counts(){
  const c = { move: 0, park: 0, off: 0 }; vehicles.forEach(v => c[v.status]++); return c;
}
function renderList(){
  const q = $('#vSearch').value.trim().toLowerCase();
  const c = counts();
  $('#fAll').textContent = vehicles.length; $('#fMove').textContent = c.move; $('#fPark').textContent = c.park; $('#fOff').textContent = c.off;
  $('#kMove').textContent = c.move; $('#kPark').textContent = c.park; $('#kOff').textContent = c.off;
  const order = { move: 0, park: 1, off: 2 };
  const list = vehicles.filter(v => (vFilter === 'all' || v.status === vFilter) &&
    (!q || (v.plate + v.reg + v.model + (drvOf(v)?.name || '')).toLowerCase().includes(q)))
    .sort((a, b) => order[a.mode === 'move' ? 'move' : a.status] - order[b.mode === 'move' ? 'move' : b.status] || a.id.localeCompare(b.id, 'en', { numeric: true }));
  $('#vList').innerHTML = list.map(v => {
    const d = drvOf(v);
    const sig = v.status === 'off' ? 'нет сигнала ' + ago(v.lastSig).replace(' назад', '') : v.status === 'park' ? 'стоит ' + dur((Date.now() - v.parkSince) / 60000 * (v.mode === 'move' ? TS : 1)) : ago(v.lastSig);
    return `<div class="vrow s-${v.status}${selVeh === v.id ? ' sel' : ''}" data-v="${v.id}">
      <div class="vic">${truckSvg}</div>
      <div class="vm"><div class="vt">${plateHtml(v)}</div><div class="vd">${d ? shortName(d.name) : 'без водителя'} · ${esc(v.model)}</div></div>
      <div class="vs"><div class="spd">${Math.round(v.speed)}<small>км/ч</small></div><div class="sig">${sig}</div></div></div>`;
  }).join('') || '<div class="muted" style="padding:20px;text-align:center">Ничего не найдено</div>';
}
$('#vList').addEventListener('click', e => { const r = e.target.closest('.vrow'); if (r) selectVehicle(r.dataset.v, true); });
$('#vList').addEventListener('mouseover', e => { const r = e.target.closest('.vrow'); vehicles.forEach(v => markerEl(v)?.classList.toggle('hi', !!r && r.dataset.v === v.id)); });
$('#vList').addEventListener('mouseleave', () => vehicles.forEach(v => markerEl(v)?.classList.remove('hi')));
$('#vSearch').addEventListener('input', renderList);
$('#vFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; vFilter = b.dataset.f; $$('#vFilter button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });

function tripInfo(v){
  const ends = ROUTE_ENDS[v.route]; const r = R[v.route];
  const out = v.s < v.half;
  const from = PLACES[out ? ends[0] : ends[1]], to = PLACES[out ? ends[1] : ends[0]];
  const prog = out ? v.s / v.half : (v.s - v.half) / (r.total - v.half);
  const left = (1 - prog) * v.half / 1000;
  return { from, to, prog, left, eta: new Date(Date.now() + left / 38 * 3600000) };
}
function selectVehicle(id, pan){
  selVeh = id; const v = vehById(id);
  vehicles.forEach(x => setMarkerStatus(x));
  if (pan) map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 13), { duration: .6 });
  renderCard(); renderList();
}
function renderCard(){
  const box = $('#vcard');
  if (!selVeh){ box.hidden = true; return; }
  const v = vehById(selVeh), d = drvOf(v), t = tripInfo(v);
  box.hidden = false;
  const ign = v.status === 'move' || (v.status === 'park' && v.mode === 'move');
  box.innerHTML = `
  <div class="vc-top"><div class="grow">${plateHtml(v, true)}<div class="vc-model">${esc(v.model)} · ${v.type} · ${v.cap}</div></div>${statusPill(v)}<button class="x" data-act="close">×</button></div>
  <div class="vc-speed">
    <div><b>${Math.round(v.speed)}<small> км/ч</small></b><span>скорость</span></div>
    <div><b style="font-size:15px;padding-top:6px">${v.status === 'off' ? hm(v.lastSig) : ago(v.lastSig)}</b><span>${v.status === 'off' ? 'последний сигнал' : 'сигнал'}</span></div>
    <div><b style="font-size:15px;padding-top:6px">${Math.round(v.odo + v.s / 1000).toLocaleString('ru')}</b><span>пробег, км</span></div>
  </div>
  ${d ? `<div class="vc-sec"><div class="drv"><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div><div style="flex:1"><b>${esc(d.name)}</b><span>${d.appOnline ? '<i class="dot move" style="width:6px;height:6px"></i> в приложении' : '○ приложение не в сети'} · ${maskPhone(d)}</span></div></div></div>` : ''}
  <div class="vc-sec">
    <div class="kv"><span>Рейс</span><b class="mono" style="color:var(--amber2)">${d ? tripNo(d) : '—'}</b></div>
    <div class="trip"><div class="tl"><i></i><u></u><i class="e"></i></div><div>${esc(t.from)}<small>погрузка</small><div style="height:8px"></div>${esc(t.to)}<small>${v.mode === 'move' ? 'осталось ' + t.left.toFixed(1) + ' км · прибытие ≈ ' + hm(t.eta) : v.mode === 'park' ? 'на месте' : 'нет данных'}</small></div></div>
    <div class="bar"><i style="width:${Math.round(t.prog * 100)}%"></i></div>
  </div>
  <div class="vc-sec">
    <div class="sensors">
      <div><span>Зажигание</span><b style="color:${ign ? 'var(--move)' : 'var(--mut)'}">${ign ? 'вкл' : 'выкл'}</b></div>
      <div><span>Топливо</span><b>${Math.round(v.fuel)}%</b></div>
      <div><span>${v.temp !== null ? 'Рефриж.' : 'Бортсеть'}</span><b>${v.temp !== null ? v.temp + ' °C' : v.volt.toFixed(1) + ' В'}</b></div>
    </div>
    <div class="kv" style="margin-top:8px"><span>Координаты</span><b class="mono">${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}</b></div>
    <div class="kv"><span>Трекер</span><b>${esc(v.tracker)}</b></div>
  </div>
  <div class="vc-act">
    <button class="btn primary" data-act="chat" ${d ? '' : 'disabled'}>Написать</button>
    <button class="btn ghost" data-act="track">Трек</button>
    ${d && !sosOf(d.id) ? '<button class="btn ghost sos-test" data-act="sos" title="Проверить, как работает SOS">Тест SOS от этого водителя</button>' : ''}
  </div>`;
}
$('#vcard').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const v = vehById(selVeh);
  if (b.dataset.act === 'close'){ selVeh = null; vehicles.forEach(setMarkerStatus); renderCard(); renderList(); closeTrack(); }
  if (b.dataset.act === 'chat'){ openChat(v.driverId); }
  if (b.dataset.act === 'track'){ openTrack(v); }
  if (b.dataset.act === 'sos' && v.driverId){ startSos(v.driverId, 'Поломка', 'Тест из пульта'); renderCard(); }
});
map.on('click', () => { if (selVeh && !trackLayer){ selVeh = null; vehicles.forEach(setMarkerStatus); renderCard(); renderList(); } });

/* ================= track history ================= */
let trackLayer = null, ghost = null, trackPts = [], period = 1, playing = false, trackVeh = null;
function openTrack(v){
  trackVeh = v; closeTrackLayer();
  const len = Math.min(period * 36000, R[v.route].total - 50);
  trackPts = pathBack(R[v.route], v.s, len);
  trackLayer = L.layerGroup().addTo(map);
  L.polyline(trackPts, { color: '#FFB547', weight: 9, opacity: .12, interactive: false }).addTo(trackLayer);
  L.polyline(trackPts, { color: '#FFB547', weight: 3, opacity: .95, interactive: false, dashArray: null }).addTo(trackLayer);
  L.circleMarker(trackPts[0], { radius: 6, color: '#FFB547', weight: 2, fillColor: '#0b1016', fillOpacity: 1 }).addTo(trackLayer).bindTooltip('Начало периода', { className: 'tt' });
  [.33, .7].forEach((f, i) => {
    const p = trackPts[Math.floor(trackPts.length * f)];
    L.marker(p, { icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div class="stop-pin">P</div>' }) }).addTo(trackLayer)
      .bindTooltip(`Стоянка ${[14, 27][i]} мин · ${hm(new Date(Date.now() - period * 3600000 * (1 - f)))}`, { className: 'tt' });
  });
  ghost = L.marker(trackPts[trackPts.length - 1], { icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div class="ghost-veh"></div>' }), interactive: false }).addTo(trackLayer);
  map.fitBounds(L.latLngBounds(trackPts).pad(.15));
  $('#trackbar').hidden = false; $('#tbPlate').innerHTML = plateHtml(v);
  $('#tbRange').value = 1000; playing = false; updatePlayBtn(); updateGhost();
  log('Просмотр трека', `${v.plate} ${v.reg}, период ${period === 8 ? 'смена' : period + ' ч'}`);
}
function closeTrackLayer(){ if (trackLayer){ map.removeLayer(trackLayer); trackLayer = null; } }
function closeTrack(){ closeTrackLayer(); $('#trackbar').hidden = true; playing = false; }
function updateGhost(){
  if (!trackPts.length) return;
  const f = $('#tbRange').value / 1000, i = Math.min(trackPts.length - 1, Math.round(f * (trackPts.length - 1)));
  ghost.setLatLng(trackPts[i]);
  const t = new Date(Date.now() - period * 3600000 * (1 - f));
  const km = (f * Math.min(period * 36, R[trackVeh.route].total / 1000)).toFixed(1);
  const sp = Math.round(trackVeh.base * (.6 + .4 * Math.abs(Math.sin(i * .07))));
  $('#tbStats').innerHTML = `${hm(t)} · ${km} км · ${sp} км/ч`;
}
function stepPlay(dt){
  const r = $('#tbRange'); let v = +r.value + dt * 120;
  if (v >= 1000){ v = 1000; playing = false; updatePlayBtn(); }
  r.value = v; updateGhost();
}
function updatePlayBtn(){ $('#tbPlay').innerHTML = playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>'; }
$('#tbPlay').onclick = () => { if (+$('#tbRange').value >= 1000) $('#tbRange').value = 0; playing = !playing; updatePlayBtn(); };
$('#tbRange').oninput = () => { playing = false; updatePlayBtn(); updateGhost(); };
$('#tbClose').onclick = closeTrack;
$('#tbPeriod').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; period = +b.dataset.p; $$('#tbPeriod button').forEach(x => x.classList.toggle('on', x === b)); if (trackVeh) openTrack(trackVeh); });

/* ================= messaging core ================= */
const TEMPLATES = [
  ['Подтверждение рейса', 'Подтвердите, пожалуйста, получение рейса {trip}. Погрузка: {from}.'],
  ['Где вы сейчас?', '{first}, где вы сейчас? Сообщите примерное время прибытия.'],
  ['Позвонить диспетчеру', 'Срочно перезвоните диспетчеру: +7 495 120-45-00.'],
  ['Смена адреса выгрузки', 'Внимание: по рейсу {trip} изменён адрес выгрузки. Новый адрес пришлю следующим сообщением.'],
  ['Фото накладной', 'После выгрузки пришлите, пожалуйста, фото подписанной накладной (ТТН).'],
  ['Пробка на МКАД', 'На внешней стороне МКАД затор. Рекомендую объезд по ТТК.'],
  ['Плановое ТО', 'Напоминаю: у {plate} завтра в 10:00 плановое ТО.'],
  ['Конец смены', 'Смена окончена, спасибо за работу! Не забудьте сдать путевой лист.'],
];
function fillTpl(tpl, d){
  const v = vehOf(d), t = v ? tripInfo(v) : null;
  return tpl.replace('{trip}', tripNo(d)).replace('{from}', t ? t.from : '—').replace('{first}', firstName(d.name)).replace('{plate}', v ? v.plate + ' ' + v.reg : 'вашего ТС');
}
const REPLIES = [
  [/подтверд/i, ['Подтверждаю, рейс принял', 'Принял, подтверждаю']],
  [/где вы|время прибытия/i, ['Еду по {road}, буду минут через {min}', 'Стою в пробке на {road}, ещё минут {min}']],
  [/перезвон|позвон/i, ['Сейчас наберу', 'Перезвоню через 5 минут, за рулём']],
  [/адрес/i, ['Понял, жду новый адрес']],
  [/фото|ттн|накладн/i, ['Хорошо, скину после выгрузки']],
  [/мкад|объезд|пробк/i, ['Понял, ухожу на ТТК', 'Спасибо, объезжаю']],
  [/то\b|техосмотр/i, ['Понял, буду к 10']],
  [/смена/i, ['Спасибо! Путевой сдам']],
];
const ROADS = ['Ленинградке', 'Каширке', 'МКАДе', 'ТТК', 'Варшавке', 'Профсоюзной', 'Дмитровке', 'Волгоградке'];
function replyFor(text){
  let list = ['Принял', 'Понял, сделаю', 'Хорошо 👍', 'Ок, принял'];
  for (const [re, l] of REPLIES) if (re.test(text)){ list = l; break; }
  return pick(list).replace('{road}', pick(ROADS)).replace('{min}', Math.round(rnd(15, 45)));
}
const listeners = new Set();
function changed(did){ listeners.forEach(f => f(did)); }
listeners.add(did => {
  if (cur === 'chat'){ renderConvs(); if (did === chatDriver) renderThread(); else renderChatInfo(); }
  if (phoneOpen && did === phoneDriverId) renderPhone();
  updateUnread();
});

function phoneSees(d){ return phoneOpen && phoneDriverId === d.id; }
function isOnline(d){ return phoneSees(d) ? $('#phoneNet').checked : (d.appOnline || isLive(d.id)); }

function sendToDriver(did, text, chan, opts = {}){
  const d = drvById(did);
  const m = { id: msgSeq++, gid: opts.gid || newGid(), dir: 'out', text, t: new Date(), ch: 'app', st: 'sent', trip: tripNo(d), fb: null, bc: opts.bc };
  messages[did].push(m); changed(did);
  if (!opts.remote && !driverMode) syncPublish({ k: 'd2drv', did, text, ch: chan, bc: !!opts.bc, t: m.t, eid: m.gid, ids: ['disp'] });
  if (chan === 'sms'){
    m.ch = 'sms';
    setTimeout(() => { m.st = 'delivered'; changed(did); smsArrived(d, m); }, rnd(1200, 2400));
  } else if (isOnline(d)){
    setTimeout(() => { if (m.st === 'sent') m.st = 'delivered'; changed(did); afterDelivered(d, m); }, rnd(500, 1100));
  } else {
    m.fb = 'wait'; changed(did);
    setTimeout(() => {
      if (m.st !== 'sent') return;
      m.fb = 'sms'; m.ch = 'sms'; changed(did);
      log('SMS-резерв', `${shortName(d.name)}: приложение не ответило за ${FALLBACK_SEC} с, отправлено SMS`);
      setTimeout(() => { m.st = 'delivered'; changed(did); smsArrived(d, m); }, rnd(1200, 2200));
    }, FALLBACK_SEC * 1000);
  }
  kpiMsgs();
  return m;
}
function afterDelivered(d, m){
  if (isLive(d.id)) return;                       // живой водитель: «прочитано» придёт с его телефона
  if (phoneSees(d)){ setTimeout(() => { m.st = 'read'; changed(d.id); }, 900); return; }
  setTimeout(() => {
    m.st = 'read'; changed(d.id);
    if (Math.random() < (m.bc ? .45 : .9)) driverReply(d, replyFor(m.text), 'app', rnd(2500, 6000));
  }, rnd(1800, 5000));
}
function smsArrived(d, m){
  if (isLive(d.id)) return;
  if (phoneSees(d)) showSms(m.text);
  else if (!m.bc || Math.random() < .5) driverReply(d, replyFor(m.text), 'sms', rnd(5000, 9000));
}
const typingFor = new Set();
function driverReply(d, text, ch, delay){
  typingFor.add(d.id); changed(d.id);
  setTimeout(() => { typingFor.delete(d.id); incoming(d.id, text, ch); }, delay);
}
function incoming(did, text, ch = 'app', sys = false, gidv){
  const d = drvById(did);
  if (!d || (gidv && messages[did].some(m => m.gid === gidv))) return;
  messages[did].push({ id: msgSeq++, gid: gidv || newGid(), dir: sys ? 'sys' : 'in', text, t: new Date(), ch, st: 'read', trip: tripNo(d) });
  d.lastSeen = new Date();
  const viewing = cur === 'chat' && chatDriver === did && document.hasFocus();
  if (!viewing){ d.unread++; toastMsg(d, sys ? text : text, ch); }
  changed(did); kpiMsgs();
}
function kpiMsgs(){ $('#kMsg').textContent = Object.values(messages).reduce((a, l) => a + l.filter(m => m.dir !== 'sys').length, 0); }
function updateUnread(){
  const n = drivers.reduce((a, d) => a + d.unread, 0);
  const b = $('#navUnread'); b.hidden = !n; b.textContent = n;
}
/* spontaneous messages from drivers */
const SPONT = ['На разгрузке очередь, 3 машины перед нами', 'Клиент не принимает, говорит не заказывал. Что делать?', 'Загрузился, выезжаю',
  'Выгрузился, документы подписали', 'Можно заехать на заправку?', 'Пробка на въезде в город, опаздываю минут на 20', 'Ворота закрыты, жду охрану'];
setInterval(() => {
  const pool = drivers.filter(d => d.vehicleId && d.appOnline && vehOf(d).mode === 'move' && !phoneSees(d) && !isLive(d.id));
  if (pool.length && Math.random() < .7) incoming(pick(pool).id, pick(SPONT));
}, 38000);

/* ================= chat UI ================= */
function lastMsg(did){ const l = messages[did]; return l[l.length - 1]; }
function renderConvs(){
  const q = $('#cSearch').value.trim().toLowerCase();
  const list = drivers.filter(d => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => ((lastMsg(b.id)?.t || 0) - (lastMsg(a.id)?.t || 0)));
  $('#convList').innerHTML = (!q || 'общий чат водителей'.includes(q) ? generalConvHtml() : '') + list.map(d => {
    const m = lastMsg(d.id), v = vehOf(d);
    const last = typingFor.has(d.id) ? '<span style="color:var(--amber)">печатает…</span>' : m ? (m.dir === 'out' ? 'Вы: ' : '') + esc(m.text) : '<span>нет сообщений</span>';
    return `<div class="conv${d.id === chatDriver ? ' sel' : ''}" data-d="${d.id}">
      <div class="av"><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div><i class="st${isOnline(d) ? ' on' : ''}"></i></div>
      <div style="min-width:0"><b>${shortName(d.name)}${isLive(d.id) ? ' <span class="live-tag">LIVE</span>' : ''}</b><div class="last">${last}</div></div>
      <div class="meta">${m ? hm(m.t) : ''}${d.unread ? `<span class="unread">${d.unread}</span>` : v ? `<span class="mono" style="font-size:10.5px">${v.plate}</span>` : ''}</div></div>`;
  }).join('');
}
$('#convList').addEventListener('click', e => { const c = e.target.closest('.conv'); if (c) openChat(c.dataset.d, true); });
$('#cSearch').addEventListener('input', renderConvs);
function openChat(did, stay){
  chatDriver = did; if (drvById(did)) drvById(did).unread = 0; updateUnread();
  if (location.hash !== '#chat'){ openThreadNext = true; location.hash = 'chat'; }
  else { document.body.classList.add('m-thread'); renderConvs(); renderThread(); }
  if (!isPhone()) setTimeout(() => $('#msgInput').focus(), 50);
}
function ticks(m){
  if (m.st === 'sent') return '<span class="ticks" title="Отправлено">✓</span>';
  if (m.st === 'delivered') return '<span class="ticks" title="Доставлено">✓✓</span>';
  return '<span class="ticks read" title="Прочитано">✓✓</span>';
}
function renderThread(){
  if (chatDriver === 'general' || !drvById(chatDriver)){ chatDriver = 'general'; return renderGeneralThread(); }
  const d = drvById(chatDriver), v = vehOf(d);
  const online = isOnline(d);
  $('#threadHead').innerHTML = `<button class="btn ghost sq m-only" id="thBack" title="Назад">‹</button><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div>
    <div class="grow"><b>${esc(d.name)}</b><div class="sub">${online ? '<i class="dot move"></i> в приложении' : '<i class="dot off"></i> приложение не в сети · был(а) ' + ago(d.lastSeen)}${v ? ' · ' + plateHtml(v) : ''}</div></div>
    ${v ? `<button class="btn ghost" id="thMap">На карте</button>` : ''}`;
  const tb = $('#threadBody');
  const atBottom = tb.scrollHeight - tb.scrollTop - tb.clientHeight < 80;
  let html = '<div class="daysep">Сегодня</div>';
  messages[d.id].forEach(m => {
    if (m.dir === 'sys'){ html += `<div class="msg sys"><div class="bub"><span class="pill amber" style="padding:2px 7px">статус</span>${esc(m.text)} · ${hm(m.t)}</div></div>`; return; }
    const out = m.dir === 'out';
    let meta = `<span class="trip-tag">${m.trip}</span>`;
    if (m.bc) meta += '<span class="chanbadge" style="background:rgba(255,181,71,.12);color:var(--amber)">РАССЫЛКА</span>';
    meta += `<span class="chanbadge${m.ch === 'app' ? ' inapp' : ''}">${m.ch === 'app' ? 'APP' : 'SMS'}</span>${hm(m.t)}`;
    if (out) meta += ticks(m);
    let fb = '';
    if (out && m.fb === 'wait') fb = `<div class="fallback wait"><i class="spin"></i>Ждём подтверждения приложения… при недоставке уйдёт SMS</div>`;
    if (out && m.fb === 'sms') fb = `<div class="fallback">↳ Приложение не ответило за ${FALLBACK_SEC} с → отправлено SMS (SMS Aero)${m.st === 'delivered' ? ' · доставлено' : ''}</div>`;
    html += `<div class="msg ${out ? 'out' : 'in'}${m.ch === 'sms' ? ' sms' : ''}"><div class="bub">${esc(m.text)}</div><div class="mt">${meta}</div>${fb}</div>`;
  });
  if (typingFor.has(d.id)) html += '<div class="typing"><i></i><i></i><i></i></div>';
  tb.innerHTML = html;
  if (atBottom || true) tb.scrollTop = tb.scrollHeight;
  renderChatInfo();
}
$('#threadHead').addEventListener('click', e => { if (e.target.closest('#thBack')){ document.body.classList.remove('m-thread'); renderConvs(); return; } if (e.target.id === 'thMap'){ const v = vehOf(drvById(chatDriver)); location.hash = 'monitoring'; setTimeout(() => selectVehicle(v.id, true), 80); } });
function renderChatInfo(){
  if (chatDriver === 'general' || !drvById(chatDriver)) return;
  const d = drvById(chatDriver), v = vehOf(d), t = v ? tripInfo(v) : null;
  const sent = messages[d.id].filter(m => m.dir === 'out');
  $('#chatInfo').innerHTML = `
    <div class="ci-head"><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div><b>${esc(shortName(d.name))}</b><span>${d.status} · кат. ${d.cats}</span>
      <div style="margin-top:8px;font-size:12.5px">${phoneHtml(d)}</div></div>
    ${v ? `<div class="ci-sec"><h4>Текущий рейс</h4><div class="kv"><span>Номер</span><b class="mono" style="color:var(--amber2)">${tripNo(d)}</b></div>
      <div class="trip"><div class="tl"><i></i><u></u><i class="e"></i></div><div>${esc(t.from)}<small>погрузка</small><div style="height:6px"></div>${esc(t.to)}<small>${v.mode === 'move' ? 'прибытие ≈ ' + hm(t.eta) : v.mode === 'park' ? 'на месте' : 'нет связи с ТС'}</small></div></div>
      <div class="bar"><i style="width:${Math.round(t.prog * 100)}%"></i></div></div>
      <div class="ci-sec"><h4>Транспорт</h4><div class="kv"><span>ТС</span><b>${plateHtml(v)}</b></div><div class="kv"><span>Статус</span><b>${statusPill(v)}</b></div><div class="kv"><span>Скорость</span><b class="mono">${Math.round(v.speed)} км/ч</b></div></div>` : '<div class="ci-sec"><h4>Рейс</h4><span class="muted">Нет активного рейса</span></div>'}
    <div class="ci-sec"><h4>Статистика связи</h4>
      <div class="kv"><span>Отправлено сегодня</span><b class="mono">${sent.length}</b></div>
      <div class="kv"><span>Ушло по SMS</span><b class="mono">${sent.filter(m => m.ch === 'sms').length}</b></div>
      <div class="kv"><span>Прочитано</span><b class="mono">${sent.filter(m => m.st === 'read').length}</b></div></div>
    <div class="ci-sec"><h4>Обозначения</h4>
      <div class="legend-row"><span class="ticks">✓</span>отправлено</div>
      <div class="legend-row"><span class="ticks">✓✓</span>доставлено</div>
      <div class="legend-row"><span class="ticks read">✓✓</span>прочитано водителем</div>
      <div class="legend-row"><span class="chanbadge inapp">APP</span>через приложение</div>
      <div class="legend-row"><span class="chanbadge">SMS</span>через SMS-шлюз</div></div>`;
}
function doSend(){
  const ta = $('#msgInput'); const text = ta.value.trim(); if (!text) return;
  if (chatDriver === 'general'){ roomPush('general', 'disp', text); log('Общий чат', `«${text.slice(0, 50)}»`); ta.value = ''; autoGrow(); renderThread(); return; }
  sendToDriver(chatDriver, text, $('#chanSelect').value);
  log('Сообщение', `${shortName(drvById(chatDriver).name)}: «${text.slice(0, 50)}${text.length > 50 ? '…' : ''}»`);
  ta.value = ''; autoGrow();
}
function autoGrow(){ const ta = $('#msgInput'); ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }
$('#sendBtn').onclick = doSend;
$('#msgInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); doSend(); } });
$('#msgInput').addEventListener('input', autoGrow);
$('#tplBtn').onclick = e => {
  e.stopPropagation();
  const p = $('#tplPop'); p.hidden = !p.hidden;
  const d = drvById(chatDriver) || { id: 'd0', name: 'Коллеги Коллеги', vehicleId: null };
  p.innerHTML = '<h4>Шаблоны сообщений</h4>' + allTpls().map((t, i) => `<button class="tpl" data-i="${i}"><b>${t[0]}</b><span>${esc(fillTpl(t[1], d))}</span></button>`).join('');
};
$('#tplPop').addEventListener('click', e => { const b = e.target.closest('.tpl'); if (!b) return; $('#msgInput').value = fillTpl(allTpls()[b.dataset.i][1], drvById(chatDriver) || { id: 'd0', name: 'Коллеги Коллеги', vehicleId: null }); $('#tplPop').hidden = true; autoGrow(); $('#msgInput').focus(); });
document.addEventListener('click', e => { if (!e.target.closest('#tplPop')) $('#tplPop').hidden = true; });

/* ================= phone privacy ================= */
const revealed = new Set();
function maskPhone(d){ return role === 'admin' || revealed.has(d.id) ? d.phone : d.phone.slice(0, 6) + ' •••-••-' + d.phone.slice(-2); }
function phoneHtml(d){ return `<span class="phone-reveal mono" data-reveal="${d.id}" title="Показать номер (действие записывается в журнал)">${maskPhone(d)}</span>`; }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-reveal]'); if (!el) return;
  e.stopPropagation();
  const d = drvById(el.dataset.reveal);
  if (!revealed.has(d.id) && role !== 'admin'){ revealed.add(d.id); log('Просмотр телефона', shortName(d.name)); }
  $$(`[data-reveal="${d.id}"]`).forEach(x => x.textContent = d.phone);
});

/* ================= broadcast ================= */
const bcSel = new Set();
const GROUPS = [
  ['Все', () => drivers.filter(d => d.vehicleId)],
  ['На рейсе', () => drivers.filter(d => d.status === 'На рейсе')],
  ['Фуры', () => drivers.filter(d => vehOf(d)?.type === 'Фура')],
  ['Фургоны', () => drivers.filter(d => vehOf(d)?.type === 'Фургон')],
  ['Ночная смена', () => drivers.filter(d => NIGHT.includes(d.id))],
  ['Нет в приложении', () => drivers.filter(d => d.vehicleId && !isOnline(d))],
];
let bcGroup = -1, bcMsgs = [];
function renderBroadcast(){
  $('#bcGroups').innerHTML = GROUPS.map((g, i) => `<button data-g="${i}" class="${bcGroup === i ? 'on' : ''}">${g[0]} <i>${g[1]().length}</i></button>`).join('');
  $('#bcList').innerHTML = drivers.filter(d => d.vehicleId).map(d => {
    const v = vehOf(d);
    return `<label class="chk"><input type="checkbox" data-d="${d.id}" ${bcSel.has(d.id) ? 'checked' : ''}><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div><b>${shortName(d.name)}</b><small>${v.type} · ${isOnline(d) ? '<span style="color:var(--move)">app</span>' : '<span style="color:var(--violet)">SMS</span>'}</small></label>`;
  }).join('');
  $('#bcTpls').innerHTML = allTpls().map((t, i) => `<button data-i="${i}">${t[0]}</button>`).join('');
  bcCost();
}
function bcCost(){
  $('#bcCount').textContent = bcSel.size + ' выбрано';
  const text = $('#bcText').value, segs = Math.max(1, Math.ceil(text.length / 70));
  const smsOnly = document.querySelector('input[name=bcChan]:checked').value === 'sms';
  const sel = [...bcSel].map(drvById), smsN = smsOnly ? sel.length : sel.filter(d => !isOnline(d)).length;
  $('#bcCost').innerHTML = `Получателей: <b>${sel.length}</b> · в приложение: <b>${smsOnly ? 0 : sel.length - smsN}</b> (бесплатно) · по SMS: <b>${smsN}</b><br>
    Длина: ${text.length} симв. = ${segs} SMS-сегм. · Оценка стоимости SMS: <b>≈ ${(smsN * segs * SMS_PRICE).toFixed(1).replace('.', ',')} ₽</b>`;
}
$('#bcGroups').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; bcGroup = +b.dataset.g; bcSel.clear(); GROUPS[bcGroup][1]().forEach(d => bcSel.add(d.id)); renderBroadcast(); });
$('#bcList').addEventListener('change', e => { const c = e.target; if (c.checked) bcSel.add(c.dataset.d); else bcSel.delete(c.dataset.d); bcGroup = -1; $$('#bcGroups button').forEach(b => b.classList.remove('on')); bcCost(); });
$('#bcTpls').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#bcText').value = allTpls()[b.dataset.i][1].replace('{first}', '{имя}'); bcCost(); });
$('#bcText').addEventListener('input', bcCost);
$$('input[name=bcChan]').forEach(r => r.addEventListener('change', bcCost));
$('#bcSend').onclick = () => {
  const text = $('#bcText').value.trim();
  if (!bcSel.size) return toast('Выберите получателей', 'Отметьте водителей или группу слева');
  if (!text) return toast('Пустое сообщение', 'Выберите шаблон или напишите текст');
  const chan = document.querySelector('input[name=bcChan]:checked').value;
  bcMsgs = [...bcSel].map(id => ({ d: drvById(id), m: sendToDriver(id, fillTpl(text.replace('{имя}', '{first}'), drvById(id)), chan, { bc: true }) }));
  log('Рассылка', `«${text.slice(0, 40)}…» — ${bcMsgs.length} водителей`);
  toast('Рассылка отправлена', `${bcMsgs.length} получателей`);
  renderBcRes();
};
function renderBcRes(){
  if (!bcMsgs.length) return;
  const app = bcMsgs.filter(x => x.m.ch === 'app' && x.m.st !== 'sent').length, read = bcMsgs.filter(x => x.m.st === 'read').length, sms = bcMsgs.filter(x => x.m.ch === 'sms').length;
  $('#bcSummary').textContent = hm(bcMsgs[0].m.t);
  $('#bcRes').innerHTML = `<div class="bc-stats"><div><b style="color:var(--move)">${app}</b><span>в приложение</span></div><div><b style="color:var(--amber)">${read}</b><span>прочитали</span></div><div><b style="color:var(--violet)">${sms}</b><span>по SMS</span></div></div>` +
    bcMsgs.map(({ d, m }) => {
      const st = m.fb === 'wait' ? '<span class="pill amber"><i class="spin"></i> ждём приложение</span>'
        : m.ch === 'sms' ? `<span class="pill violet">SMS · ${m.st === 'sent' ? 'отправка…' : 'доставлено'}</span>`
        : m.st === 'read' ? '<span class="pill amber">✓✓ прочитано</span>' : m.st === 'delivered' ? '<span class="pill move">✓✓ доставлено</span>' : '<span class="pill off">✓ отправлено</span>';
      return `<div class="rres"><div class="avatar ${avClass(d.id)}" style="width:28px;height:28px;font-size:10.5px">${initials(d.name)}</div><b>${shortName(d.name)}</b>${st}</div>`;
    }).join('');
}
listeners.add(() => { if (cur === 'broadcast') renderBcRes(); });

/* ================= tables ================= */
function makeTable(el, cols, rows, sort, onSort){
  el.innerHTML = `<thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${sort.k === c.k ? 'sorted' : ''}">${c.t}${sort.k === c.k ? `<span class="ar">${sort.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('')}<th></th></tr></thead>
  <tbody>${rows.map(r => `<tr data-id="${r.id}">${cols.map(c => `<td data-l="${c.t}">${c.f(r)}</td>`).join('')}<td><span class="act">Изменить →</span></td></tr>`).join('')}</tbody>`;
  el.querySelector('thead').onclick = e => { const th = e.target.closest('th[data-k]'); if (th) onSort(th.dataset.k); };
}
function sorter(sort, cols){ const c = cols.find(x => x.k === sort.k); return (a, b) => { const x = c.v(a), y = c.v(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; }; }
const docHtml = (label, s) => { const n = daysTo(s); return `<span class="doc ${n < 0 ? 'bad' : n < 30 ? 'warn' : ''}">${label} до ${fmtDate(s)}${n < 30 ? ` · ${n < 0 ? 'просрочено' : n + ' дн.'}` : ''}</span>`; };
const stPill = s => ({ 'На рейсе': 'move', 'Свободен': 'park', 'Выходной': 'off', 'Больничный': 'red' })[s] || 'off';

let dSort = { k: 'name', dir: 1 };
const D_COLS = [
  { k: 'name', t: 'Водитель', v: d => d.name, f: d => `<div class="cell-name"><div class="avatar ${avClass(d.id)}">${initials(d.name)}</div><div><b>${esc(d.name)}</b><small>кат. ${d.cats}${NIGHT.includes(d.id) ? ' · ночная смена' : ''}</small></div></div>` },
  { k: 'phone', t: 'Телефон', v: d => d.phone, f: d => phoneHtml(d) },
  { k: 'status', t: 'Статус', v: d => d.status, f: d => `<span class="pill ${stPill(d.status)}">${d.status}</span>` },
  { k: 'veh', t: 'ТС', v: d => vehOf(d)?.plate || 'я', f: d => vehOf(d) ? plateHtml(vehOf(d)) : '<span class="muted">не назначено</span>' },
  { k: 'docs', t: 'Документы', v: d => Math.min(99999, ...docsOf(d.id).filter(x => x.expires).map(x => daysTo(x.expires))), f: d => docsCell(d.id) },
  { k: 'trips', t: 'Рейсов за месяц', v: d => d.trips, f: d => `<span class="mono">${d.trips}</span>` },
  { k: 'seen', t: 'Связь', v: d => -d.lastSeen, f: d => `<span class="net"><i class="dot ${isOnline(d) ? 'move' : 'off'}"></i>${isOnline(d) ? 'в приложении' : ago(d.lastSeen)}</span>` },
];
function renderDrivers(){
  const q = $('#dSearch').value.trim().toLowerCase(), st = $('#dStatus').value;
  const rows = drivers.filter(d => (!st || d.status === st) && (!q || (d.name + d.phone + (vehOf(d)?.plate || '')).toLowerCase().includes(q))).sort(sorter(dSort, D_COLS));
  makeTable($('#dTable'), D_COLS, rows, dSort, k => { dSort = { k, dir: dSort.k === k ? -dSort.dir : 1 }; renderDrivers(); });
  $('#navDrivers').textContent = drivers.length;
}
$('#dSearch').addEventListener('input', renderDrivers); $('#dStatus').addEventListener('change', renderDrivers);
$('#dTable').addEventListener('click', e => { if (e.target.closest('[data-reveal]')) return; const tr = e.target.closest('tbody tr'); if (tr) editDriver(tr.dataset.id); });

let tSort = { k: 'plate', dir: 1 };
const T_COLS = [
  { k: 'plate', t: 'Госномер', v: v => v.plate, f: v => plateHtml(v) },
  { k: 'model', t: 'Модель', v: v => v.model, f: v => `<b style="font-weight:600">${esc(v.model)}</b>` },
  { k: 'type', t: 'Тип', v: v => v.type, f: v => `${v.type} <span class="muted">· ${v.cap}</span>` },
  { k: 'drv', t: 'Водитель', v: v => drvOf(v)?.name || 'я', f: v => drvOf(v) ? shortName(drvOf(v).name) : '<span class="muted">—</span>' },
  { k: 'tracker', t: 'Трекер', v: v => v.tracker, f: v => esc(v.tracker) },
  { k: 'imei', t: 'IMEI', v: v => v.imei, f: v => `<span class="mono" style="font-size:12px">${v.imei}</span>` },
  { k: 'sim', t: 'SIM', v: v => v.sim, f: v => `<span class="mono" style="font-size:12px">${v.sim}</span>` },
  { k: 'docs', t: 'Документы', v: v => Math.min(99999, ...docsOf(v.id).filter(x => x.expires).map(x => daysTo(x.expires))), f: v => docsCell(v.id) },
  { k: 'st', t: 'Связь', v: v => v.status, f: v => `${statusPill(v)}<div class="muted" style="margin-top:3px">${ago(v.lastSig)}</div>` },
];
function renderVehicles(){
  const q = $('#tSearch').value.trim().toLowerCase(), ty = $('#tType').value;
  const rows = vehicles.filter(v => (!ty || v.type === ty) && (!q || (v.plate + v.reg + v.model + v.imei + v.sim).toLowerCase().includes(q))).sort(sorter(tSort, T_COLS));
  makeTable($('#tTable'), T_COLS, rows, tSort, k => { tSort = { k, dir: tSort.k === k ? -tSort.dir : 1 }; renderVehicles(); });
  $('#navVehicles').textContent = vehicles.length;
}
$('#tSearch').addEventListener('input', renderVehicles); $('#tType').addEventListener('change', renderVehicles);
$('#tTable').addEventListener('click', e => { const tr = e.target.closest('tbody tr'); if (tr) editVehicle(tr.dataset.id); });

function renderLog(){
  const q = $('#lSearch').value.trim().toLowerCase();
  const rows = logs.filter(l => !q || (l.user + l.action + l.details).toLowerCase().includes(q));
  $('#lTable').innerHTML = `<thead><tr><th>Время</th><th>Пользователь</th><th>Роль</th><th>Действие</th><th>Детали</th></tr></thead><tbody>${rows.map(l =>
    `<tr><td class="mono">${hm(l.t)}:${pad(l.t.getSeconds())}</td><td>${esc(l.user)}</td><td><span class="pill ${l.role === 'Администратор' ? 'violet' : 'park'}">${l.role}</span></td><td><b style="font-weight:600">${esc(l.action)}</b></td><td style="white-space:normal;color:var(--tx2)">${esc(l.details)}</td></tr>`).join('')}</tbody>`;
}
$('#lSearch').addEventListener('input', renderLog);

/* ================= modals: edit ================= */
function modal(html){ $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
function closeModal(){ $('#modal').hidden = true; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
const fld = (lab, html, full) => `<div class="fld${full ? ' full' : ''}"><label>${lab}</label>${html}</div>`;
const opt = (v, cur, t) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t ?? v)}</option>`;

function editDriver(id){
  const isNew = !id; const d = isNew ? { id: 'd' + (drivers.length + 1 + Math.floor(Math.random() * 900)), name: '', phone: '+7 ', status: 'Свободен', vehicleId: null, license: dplus(365), med: dplus(180), trips: 0, cats: 'B, C', appOnline: false, lastSeen: new Date(), unread: 0 } : drvById(id);
  const freeV = vehicles.filter(v => !v.driverId || v.id === d.vehicleId);
  modal(`<div class="mb-h"><b>${isNew ? 'Новый водитель' : 'Карточка водителя'}</b><button class="x" data-close>×</button></div>
  <div class="mb-b">
    ${fld('ФИО', `<input id="fName" value="${esc(d.name)}" placeholder="Фамилия Имя Отчество">`, true)}
    ${fld('Телефон', `<input id="fPhone" value="${esc(role === 'admin' || isNew || revealed.has(d.id) ? d.phone : maskPhone(d))}" ${role !== 'admin' && !isNew && !revealed.has(d.id) ? 'disabled' : ''}>`)}
    ${fld('Статус', `<select id="fStatus">${['На рейсе', 'Свободен', 'Выходной', 'Больничный'].map(s => opt(s, d.status)).join('')}</select>`)}
    ${fld('Транспорт', `<select id="fVeh"><option value="">— не назначено —</option>${freeV.map(v => opt(v.id, d.vehicleId, v.plate + ' ' + v.reg + ' · ' + v.model)).join('')}</select>`)}
    ${fld('Категории ВУ', `<input id="fCats" value="${esc(d.cats)}">`)}
    ${isNew ? '<div class="mb-note full">Документы (паспорт, ВУ, медсправка и др.) можно добавить после сохранения.</div>' : docsSectionHtml(d.id)}
    <div class="mb-note">🔒 Телефон хранится в базе в зашифрованном виде. Диспетчер видит маску, а полный номер открывается по клику, и это записывается в журнал. Администратор видит и редактирует номер полностью.</div>
  </div>
  <div class="mb-f">${!isNew && role === 'admin' ? '<button class="btn danger left" id="fDel">Удалить</button>' : ''}<button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="fSave">${isNew ? 'Добавить' : 'Сохранить'}</button></div>`);
  $('#fSave').onclick = () => {
    const name = $('#fName').value.trim(); if (!name) return $('#fName').focus();
    const changes = [];
    if (d.status !== $('#fStatus').value) changes.push(`статус «${d.status}» → «${$('#fStatus').value}»`);
    d.name = name; if (!$('#fPhone').disabled) d.phone = $('#fPhone').value.trim();
    d.status = $('#fStatus').value; d.cats = $('#fCats').value;
    const nv = $('#fVeh').value || null;
    if (nv !== d.vehicleId){
      if (d.vehicleId) vehById(d.vehicleId).driverId = null;
      if (nv) vehById(nv).driverId = d.id;
      changes.push(`ТС → ${nv ? vehById(nv).plate : 'нет'}`);
      d.vehicleId = nv;
    }
    if (isNew){ drivers.push(d); messages[d.id] = []; log('Новый водитель', shortName(d.name)); }
    else log('Изменение водителя', shortName(d.name) + (changes.length ? ': ' + changes.join(', ') : ''));
    closeModal(); renderDrivers(); flashRow('#dTable', d.id); toast(isNew ? 'Водитель добавлен' : 'Сохранено', d.name); refreshPhoneSelect();
  };
  const del = $('#fDel');
  if (del) del.onclick = () => {
    if (del.dataset.c !== '1'){ del.dataset.c = '1'; del.textContent = 'Точно удалить?'; return; }
    if (d.vehicleId) vehById(d.vehicleId).driverId = null;
    drivers.splice(drivers.indexOf(d), 1); log('Удаление водителя', shortName(d.name));
    closeModal(); renderDrivers(); toast('Водитель удалён', d.name); refreshPhoneSelect();
  };
  if (!isNew) bindDocsSection(() => editDriver(d.id));
  if (isNew) setTimeout(() => $('#fName').focus(), 30);
}
function editVehicle(id){
  const isNew = !id; const v = isNew ? null : vehById(id);
  const val = (k, def = '') => v ? v[k] : def;
  modal(`<div class="mb-h"><b>${isNew ? 'Новое ТС' : 'Транспортное средство'}</b><button class="x" data-close>×</button></div>
  <div class="mb-b">
    ${fld('Госномер', `<input id="gPlate" value="${esc(val('plate'))}" placeholder="А123ВС" maxlength="6" style="text-transform:uppercase">`)}
    ${fld('Регион', `<input id="gReg" value="${esc(val('reg', '77'))}" maxlength="3">`)}
    ${fld('Модель', `<input id="gModel" value="${esc(val('model'))}">`)}
    ${fld('Тип', `<select id="gType">${['Фургон', 'Среднетоннажный', 'Фура'].map(s => opt(s, val('type', 'Фургон'))).join('')}</select>`)}
    ${fld('Трекер ГЛОНАСС', `<select id="gTr">${TRACKERS.map(s => opt(s, val('tracker', TRACKERS[0]))).join('')}</select>`)}
    ${fld('IMEI трекера', `<input id="gImei" class="mono" value="${esc(val('imei'))}" maxlength="15">`)}
    ${fld('SIM-карта трекера', `<input id="gSim" value="${esc(val('sim', '+7 '))}">`)}
    ${fld('Водитель', `<select id="gDrv"><option value="">— нет —</option>${drivers.filter(d => !d.vehicleId || (v && d.id === v.driverId)).map(d => opt(d.id, v?.driverId, shortName(d.name))).join('')}</select>`)}
    ${isNew ? '' : docsSectionHtml(v.id)}
    <div class="mb-note full">По IMEI система сопоставляет пакеты от трекера (протокол EGTS / Wialon IPS из GLOBARS) с этой машиной.</div>
  </div>
  <div class="mb-f"><button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="gSave">${isNew ? 'Добавить' : 'Сохранить'}</button></div>`);
  $('#gSave').onclick = () => {
    const plate = $('#gPlate').value.trim().toUpperCase(); if (!plate) return $('#gPlate').focus();
    if (isNew){ toast('Демо-версия', 'Новое ТС появится на карте после первого пакета от трекера. В демо добавлено только в таблицу.'); }
    const t = v || newVehicleStub('v' + (vehicles.length + 1 + Math.floor(Math.random() * 900)));
    Object.assign(t, { plate, reg: $('#gReg').value.trim(), model: $('#gModel').value.trim(), type: $('#gType').value, tracker: $('#gTr').value, imei: $('#gImei').value.trim(), sim: $('#gSim').value.trim() });
    const nd = $('#gDrv').value || null;
    if (nd !== t.driverId){ if (t.driverId) drvById(t.driverId).vehicleId = null; if (nd) drvById(nd).vehicleId = t.id; t.driverId = nd; }
    if (isNew){ vehicles.push(t); log('Новое ТС', plate); }
    else log('Изменение ТС', plate + ' ' + t.reg);
    closeModal(); renderVehicles(); flashRow('#tTable', t.id); if (!isNew) toast('Сохранено', plate);
  };
  if (!isNew) bindDocsSection(() => editVehicle(v.id));
}
function flashRow(sel, id){ const tr = $(`${sel} tr[data-id="${id}"]`); if (tr){ tr.classList.add('flash'); tr.scrollIntoView({ block: 'nearest' }); } }
$('#dAdd').onclick = () => editDriver(null);
$('#tAdd').onclick = () => editVehicle(null);

/* ================= import / export ================= */
function toCSV(rows){ return '﻿' + rows.map(r => r.map(c => { c = String(c ?? ''); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';')).join('\r\n'); }
function exportModal(title, csv, fname, n){
  log('Экспорт', `${title}, ${n} строк`);
  modal(`<div class="mb-h"><b>Экспорт: ${title}</b><button class="x" data-close>×</button></div>
   <div class="mb-b">${fld('Файл CSV (открывается в Excel), ' + n + ' строк', `<textarea rows="10" readonly id="csvOut">${esc(csv.slice(1))}</textarea>`, true)}
   <div class="mb-note">Если скачивание не сработало (в некоторых окнах браузера оно запрещено), нажмите «Скопировать» и вставьте данные в Excel.</div></div>
   <div class="mb-f"><button class="btn ghost" id="csvCopy">Скопировать</button><button class="btn primary" id="csvDl">Скачать ${fname}</button></div>`);
  $('#csvDl').onclick = () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} };
  $('#csvCopy').onclick = async () => { try { await navigator.clipboard.writeText(csv.slice(1).replace(/;/g, '\t')); $('#csvCopy').textContent = 'Скопировано ✓'; } catch (e) { $('#csvOut').select(); $('#csvCopy').textContent = 'Выделено, нажмите Ctrl+C'; } };
}
$('#dExport').onclick = () => exportModal('водители', toCSV([['ФИО', 'Телефон', 'Статус', 'ТС', 'Категории', 'ВУ до', 'Медсправка до', 'Рейсов за месяц'],
  ...drivers.map(d => [d.name, role === 'admin' ? d.phone : maskPhone(d), d.status, vehOf(d) ? vehOf(d).plate + ' ' + vehOf(d).reg : '', d.cats, fmtDate(d.license), fmtDate(d.med), d.trips])]), 'drivers.csv', drivers.length);
$('#tExport').onclick = () => exportModal('транспорт', toCSV([['Госномер', 'Регион', 'Модель', 'Тип', 'Грузоподъёмность', 'Водитель', 'Трекер', 'IMEI', 'SIM'],
  ...vehicles.map(v => [v.plate, v.reg, v.model, v.type, v.cap, drvOf(v)?.name || '', v.tracker, v.imei, v.sim])]), 'vehicles.csv', vehicles.length);
function parseCSV(text){
  text = text.replace(/^﻿/, ''); const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){ if (c === '"' && text[i + 1] === '"'){ cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === sep){ row.push(cell); cell = ''; } else if (c === '\n'){ row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function importFile(input, kind){
  const f = input.files[0]; if (!f) return;
  f.text().then(text => {
    const rows = parseCSV(text); if (rows.length < 2) return toast('Файл пустой', 'Нужна строка заголовков и хотя бы одна строка данных');
    const head = rows[0].map(h => h.trim().toLowerCase()); const col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
    let n = 0;
    if (kind === 'd'){
      const iN = col('фио', 'имя', 'name'), iP = col('тел', 'phone'), iS = col('статус', 'status');
      rows.slice(1).forEach(r => { const name = (r[iN] || '').trim(); if (!name) return; const id = 'd' + (100 + drivers.length + n);
        drivers.push({ id, name, phone: (r[iP] || '').trim(), status: ['На рейсе', 'Свободен', 'Выходной', 'Больничный'].includes((r[iS] || '').trim()) ? r[iS].trim() : 'Свободен', vehicleId: null, license: dplus(365), med: dplus(180), trips: 0, cats: 'B, C', appOnline: false, lastSeen: new Date(), unread: 0 });
        messages[id] = []; n++; });
      renderDrivers(); refreshPhoneSelect();
    } else {
      const iP = col('госномер', 'номер', 'plate'), iM = col('модель', 'model'), iI = col('imei'), iS = col('sim', 'сим');
      rows.slice(1).forEach(r => { const plate = (r[iP] || '').trim().toUpperCase(); if (!plate) return;
        vehicles.push({ id: 'v' + (100 + vehicles.length + n), plate: plate.slice(0, 6), reg: plate.slice(6).trim() || '77', model: (r[iM] || '').trim(), type: 'Фургон', cap: '—', imei: (r[iI] || '').trim(), sim: (r[iS] || '').trim(), tracker: TRACKERS[0], driverId: null, status: 'off', mode: 'off', speed: 0, lastSig: new Date(0), route: 0, s: 0, half: 1, fuel: 0, volt: 0, temp: null, odo: 0, marker: { getElement: () => null, setLatLng(){} } }); n++; });
      renderVehicles();
    }
    log('Импорт', `${kind === 'd' ? 'Водители' : 'Транспорт'}: ${n} строк из ${f.name}`);
    toast('Импорт завершён', `Добавлено строк: ${n}`);
    input.value = '';
  });
}
$('#dImport').onchange = e => importFile(e.target, 'd');
$('#tImport').onchange = e => importFile(e.target, 't');

/* ================= toasts ================= */
function toast(title, text, onClick, iconHtml){
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `${iconHtml || '<div class="ic"><svg viewBox="0 0 24 24"><path d="M5 12l4.5 4.5L19 7"/></svg></div>'}<div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  el.onclick = () => { onClick && onClick(); kill(); };
  $('#toasts').appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  setTimeout(kill, 5200);
}
function toastMsg(d, text, ch){
  toast(shortName(d.name) + (ch === 'sms' ? ' · SMS' : ''), text, () => openChat(d.id), `<div class="avatar ${avClass(d.id)}">${initials(d.name)}</div>`);
}

/* ================= driver phone ================= */
let phoneOpen = false, phoneDriverId = 'd1', smsTimer = null;
function refreshPhoneSelect(){
  $('#phoneDriver').innerHTML = drivers.filter(d => d.vehicleId).map(d => opt(d.id, phoneDriverId, shortName(d.name))).join('');
}
refreshPhoneSelect();
function setPhoneOpen(on){
  phoneOpen = on; $('#phoneDock').hidden = !on; $('#phoneToggle').classList.toggle('on', on);
  if (on){ $('#phoneNet').checked = drvById(phoneDriverId).appOnline; renderPhone(); markPhoneRead(); }
  changed(phoneDriverId);
}
$('#phoneToggle').onclick = () => setPhoneOpen(!phoneOpen);
$('#phoneClose').onclick = () => setPhoneOpen(false);
$('#phoneDriver').onchange = e => { const old = phoneDriverId; phoneDriverId = e.target.value; phTab = 'disp'; phDm = null; $('#phSosIn').hidden = true; $('#phoneNet').checked = drvById(phoneDriverId).appOnline; $('#phSms').hidden = true; renderPhone(); markPhoneRead(); changed(old); changed(phoneDriverId); };
$('#phoneNet').onchange = e => {
  const d = drvById(phoneDriverId); d.appOnline = e.target.checked; d.lastSeen = new Date();
  log('Демо', `${shortName(d.name)}: интернет на телефоне ${e.target.checked ? 'включён' : 'выключен'}`);
  if (e.target.checked){ messages[d.id].filter(m => m.dir === 'out' && m.fb === 'wait').forEach(m => { m.fb = null; m.st = 'delivered'; }); markPhoneRead(); }
  renderPhone(); changed(d.id);
};
function markPhoneRead(){
  const d = drvById(phoneDriverId); if (!$('#phoneNet').checked) return;
  messages[d.id].forEach(m => { if (m.dir === 'out' && m.ch === 'app' && m.st === 'delivered'){ m.st = 'read'; if (m.remote) syncPublish({ k: 'ack', did: d.id, ref: m.gid, ids: [d.id] }); } });
}
function showSms(text){
  const el = $('#phSms'); el.hidden = false;
  el.innerHTML = `<div class="h"><b>Сообщения</b><span>сейчас</span></div><p><b style="color:#fff">TRASSA:</b> ${esc(text)}</p>`;
  clearTimeout(smsTimer); smsTimer = setTimeout(() => el.hidden = true, 7000);
}
const QUICK = ['Загрузился', 'Выехал', 'На месте', 'Выгрузился', 'Задерживаюсь', 'Проблема'];
function renderPhone(){
  const d = drvById(phoneDriverId); if (!d) return; const v = vehOf(d), t = v ? tripInfo(v) : null;
  const online = $('#phoneNet').checked;
  $('#phNetIcon').className = online ? '' : 'no';
  $('#phWho').innerHTML = `${esc(shortName(d.name))}<br>${v ? v.plate + ' ' + v.reg : ''}`;
  $('#phTrip').innerHTML = t ? `<div class="h"><span>Текущий рейс</span><b>${tripNo(d)}</b></div><div class="r"><span>Откуда:</span> ${esc(t.from)}<br><span>Куда:</span> ${esc(t.to)}</div><div class="bar"><i style="width:${Math.round(t.prog * 100)}%"></i></div>` : '<div class="r">Нет активного рейса</div>';
  $('#phQuick').innerHTML = QUICK.map(q => `<button data-q="${q}">${q}</button>`).join('');
  $('#phOffline').hidden = online;
  const c = $('#phChat'); updatePhTabs(); renderPhoneSos();
  const tabHtml = phoneTabHtml();
  if (tabHtml !== null) c.innerHTML = tabHtml; else c.innerHTML = messages[d.id].map(m => {
    if (m.dir === 'sys') return `<div class="pm st">Статус отправлен: ${esc(m.text.replace('Статус рейса: ', ''))}</div>`;
    if (m.dir === 'in') return `<div class="pm out">${esc(m.text)}<small>${hm(m.t)}${m.ch === 'sms' ? ' · SMS' : ''}</small></div>`;
    if (m.ch === 'sms' && m.st !== 'delivered' && m.st !== 'read') return '';
    if (m.ch === 'app' && m.st === 'sent') return '';
    return `<div class="pm in">${esc(m.text)}<small>Диспетчер · ${hm(m.t)}${m.ch === 'sms' ? ' · пришло по SMS' : ''}</small></div>`;
  }).join('') + (dispTyping ? '<div class="pm in typing-pm"><i></i><i></i><i></i></div>' : '') || '<div class="pm st">Сообщений пока нет</div>';
  if (phTab === 'disp' || phTab === 'general' || phDm) c.scrollTop = c.scrollHeight;
  if (driverMode) updatePhMap();
  $('#phTime').textContent = hm(new Date());
}
function phoneSend(text, sys){
  if (!$('#phoneNet').checked){ $('#phOffline').textContent = 'Нет интернета: сообщение не отправлено. Включите «Интернет» сверху.'; $('#phOffline').hidden = false; return; }
  const g = newGid(), body = sys ? 'Статус рейса: ' + text : text;
  incoming(phoneDriverId, body, 'app', !!sys, g);
  syncPublish({ k: 'drv2d', did: phoneDriverId, text: body, sys: !!sys, eid: g, ids: [phoneDriverId] });
  if (driverMode && !isLive('disp')) dispatcherAnswer(phoneDriverId, text);
}
const DISP_ANSWERS = {
  'Загрузился': 'Отлично! Документы проверили? Хорошей дороги.',
  'Выехал': 'Принято, вижу вас на карте. Хорошей дороги!',
  'На месте': 'Принято. Напишите, когда начнут выгрузку.',
  'Выгрузился': 'Спасибо! Пришлите фото ТТН. Следующий рейс скину через 10 минут.',
  'Задерживаюсь': 'Понял. На сколько примерно? Предупрежу клиента.',
  'Проблема': 'Что случилось? Если срочно, звоните: +7 495 120-45-00.',
};
let dispTyping = false;
function dispatcherAnswer(did, text){
  const ans = DISP_ANSWERS[text] || (/\?/.test(text) ? pick(['Сейчас уточню и напишу', 'Да, можно', 'Секунду, проверяю']) : pick(['Принято 👍', 'Понял, спасибо', 'Хорошо, держите в курсе']));
  setTimeout(() => { dispTyping = true; renderPhone(); }, 900);
  setTimeout(() => { dispTyping = false; if (driverMode && phoneDriverId === did) sendToDriver(did, ans, 'auto'); }, rnd(2600, 4200));
}
$('#phSend').onclick = () => { const i = $('#phInput'); const t = i.value.trim(); if (!t) return; if (!phoneSendTab(t)) phoneSend(t); i.value = ''; };
$('#phInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#phSend').click(); });
$('#phQuick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) phoneSend(b.dataset.q, true); });
listeners.add(did => { if (phoneOpen && did === phoneDriverId){ markPhoneRead(); } });

/* ================= modes: start screen, dispatcher, driver ================= */
let driverMode = false, phMap = null, phMarker = null, phRoute = null, phFitFor = null, dispTimer = null;
const isApp = /[?&]app\b/.test(location.search) || /TrassaApp/.test(navigator.userAgent);
function isPhone(){ return window.matchMedia('(max-width:760px)').matches; }
function fillStart(){ $('#startDriver').innerHTML = drivers.filter(d => d.vehicleId).map(d => opt(d.id, phoneDriverId, shortName(d.name) + ' · ' + vehOf(d).plate)).join(''); }
function showStart(){ fillStart(); $('#start').hidden = false; document.body.classList.add('start-open'); }
function hideStart(){ $('#start').hidden = true; document.body.classList.remove('start-open'); if (cur === 'monitoring' && !driverMode) setTimeout(() => map.invalidateSize(), 30); }
function enterDispatcher(){
  driverMode = false; document.body.classList.remove('driver'); clearInterval(dispTimer);
  document.body.dataset.entered = '1';
  setPhoneOpen(false); hideStart();
  show(location.hash.slice(1) || 'monitoring');
  setTimeout(() => presence(true), 300);
  try { localStorage.setItem('trassa-mode', 'dispatcher'); } catch (e) {}
}
function enterDriver(did){
  const old = phoneDriverId; phoneDriverId = did; refreshPhoneSelect(); phTab = 'disp'; phDm = null; $('#phSosIn').hidden = true;
  const d = drvById(did); d.appOnline = true; d.lastSeen = new Date();
  driverMode = true; document.body.classList.add('driver'); hideStart();
  $('#phoneNet').checked = true; $('#phSms').hidden = true;
  phoneOpen = false; setPhoneOpen(true); changed(old);
  setTimeout(() => { initPhMap(); updatePhMap(true); }, 60);
  setTimeout(() => presence(true), 300);
  clearInterval(dispTimer);
  dispTimer = setInterval(() => {
    if (!driverMode || isLive('disp') || Math.random() < .35) return;
    const t = pick([TEMPLATES[1], TEMPLATES[4], TEMPLATES[5], ['', 'Как дела в пути? Всё в порядке с грузом?'], ['', 'Клиент спрашивает время прибытия, подскажите?']]);
    sendToDriver(phoneDriverId, fillTpl(t[1], drvById(phoneDriverId)), 'auto');
  }, 55000);
  try { localStorage.setItem('trassa-mode', 'driver:' + did); } catch (e) {}
}
$('#start').addEventListener('click', e => {
  const b = e.target.closest('[data-role]'); if (!b) return;
  if (b.dataset.role === 'dispatcher') enterDispatcher(); else enterDriver($('#startDriver').value);
});
$('#roleBtn').onclick = showStart;
$('#phRole').onclick = showStart;
function initPhMap(){
  if (phMap){ phMap.invalidateSize(); return; }
  phMap = L.map('phMap', { zoomControl: false, attributionControl: false, preferCanvas: true, dragging: true, scrollWheelZoom: false, zoomSnap: .25 });
  const cv = L.canvas({ padding: .3 });
  L.polygon(DEC.park, { renderer: cv, stroke: false, fillColor: '#0e1c16', fillOpacity: 1, interactive: false }).addTo(phMap);
  L.polyline(DEC.river, { renderer: cv, color: '#12304a', weight: 5, interactive: false }).addTo(phMap);
  L.polygon(DEC.water, { renderer: cv, stroke: false, fillColor: '#12304a', fillOpacity: 1, interactive: false }).addTo(phMap);
  [2, 1, 0].forEach(l => L.polyline(DEC.roads[l], Object.assign({ renderer: cv, interactive: false }, ROAD_STYLE[l])).addTo(phMap));
  phRoute = L.polyline([], { color: '#FFB547', weight: 4, opacity: .95, interactive: false }).addTo(phMap);
  phMarker = L.marker([55.75, 37.62], { interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div class="veh s-move"><div class="ring"></div><div class="body"><svg class="arrow" viewBox="0 0 12 12"><path d="M6 0.5 L10.5 11 L6 8.4 L1.5 11z"/></svg></div></div>' }) }).addTo(phMap);
}
function updatePhMap(fit){
  if (!phMap) return;
  const v = vehOf(drvById(phoneDriverId)); if (!v) return;
  const r = R[v.route], dest = v.s < v.half ? v.half : r.total, pts = [];
  for (let s = v.s; s < dest; s += 120){ const p = posAt(r, s); pts.push([p.lat, p.lng]); }
  const pe = posAt(r, dest - 1); pts.push([pe.lat, pe.lng]);
  phRoute.setLatLngs(pts); phMarker.setLatLng([v.lat, v.lng]);
  const el = phMarker.getElement(); const ar = el && el.querySelector('.arrow'); if (ar) ar.style.transform = `rotate(${v.brg}deg)`;
  if (fit || phFitFor !== v.id){ phFitFor = v.id; phMap.invalidateSize(); phMap.fitBounds(L.latLngBounds(pts).pad(.12)); }
}
window.appBack = function(){
  if (!$('#scanner').hidden){ const st = $('#scanner .sc-stage.crop, #scanner .sc-res'); if (st) stepCamera(); else closeScanner(); return true; }
  if (!$('#viewer').hidden){ $('#viewer').hidden = true; return true; }
  if (!$('#modal').hidden){ closeModal(); return true; }
  if (!$('#moreSheet').hidden){ $('#moreSheet').hidden = true; return true; }
  if (driverMode && phDm){ phDm = null; renderPhone(); return true; }
  if (driverMode && phTab !== 'disp'){ setPhTab('disp'); return true; }
  if (!$('#start').hidden){ if (driverMode || document.body.dataset.entered) { hideStart(); return true; } return false; }
  if (driverMode) return false;
  if (!$('#tplPop').hidden){ $('#tplPop').hidden = true; return true; }
  if (document.body.classList.contains('m-thread')){ document.body.classList.remove('m-thread'); renderConvs(); return true; }
  if (!$('#trackbar').hidden){ closeTrack(); return true; }
  if (selVeh){ selVeh = null; vehicles.forEach(setMarkerStatus); renderCard(); renderList(); return true; }
  if (cur !== 'monitoring'){ location.hash = 'monitoring'; return true; }
  return false;
};

/* ================= role ================= */
$('#roleSelect').onchange = e => {
  role = e.target.value; document.body.classList.toggle('admin', role === 'admin');
  log('Смена роли', role === 'admin' ? 'Администратор' : 'Диспетчер');
  toast('Роль: ' + (role === 'admin' ? 'Администратор' : 'Диспетчер'), role === 'admin' ? 'Видны полные телефоны и журнал действий' : 'Телефоны скрыты маской, журнал недоступен');
  if (cur === 'log' && role !== 'admin') location.hash = 'monitoring';
  show(cur);
};

/* =====================================================================
   НОВОЕ v0.3: хранение данных, чаты водителей, SOS, заявки, клиенты, документы
   ===================================================================== */

/* ---------- общие помощники ---------- */
const isoDay = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const dayPlus = n => { const x = new Date(); x.setDate(x.getDate() + n); return isoDay(x); };
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const wdOf = s => { const g = new Date(s + 'T12:00').getDay(); return g === 0 ? 7 : g; };
function dayLabel(s){
  if (s === dayPlus(0)) return 'Сегодня'; if (s === dayPlus(1)) return 'Завтра'; if (s === dayPlus(-1)) return 'Вчера';
  return WD[wdOf(s) - 1] + ' ' + s.slice(8, 10) + '.' + s.slice(5, 7);
}
const seq = { order: 1040, client: 6, tpl: 3, doc: 0 };
function distKm(a, b){ return map.distance([a.lat, a.lng], [b.lat, b.lng]) / 1000; }
const kmTxt = km => km < 10 ? km.toFixed(1).replace('.', ',') + ' км' : Math.round(km) + ' км';
function newVehicleStub(id){
  return { id, plate: '', reg: '', model: '', type: 'Фургон', cap: '—', imei: '', sim: '', tracker: TRACKERS[0], route: 0, mode: 'off', s: 0, s0: 0, speed: 0, status: 'off',
    lastSig: new Date(0), fuel: 0, volt: 0, temp: null, base: 40, half: 1, driverId: null, odo: 0, lat: 55.75, lng: 37.62, brg: 0, marker: { getElement: () => null, setLatLng(){} } };
}

/* ---------- хранение на устройстве (позже — сервер) ---------- */
const SAVE_KEY = 'trassa-data-v1';
let saveTimer = null, restoring = false;
function scheduleSave(){ if (restoring) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
function saveNow(){
  try {
    const trim = l => l.slice(-200);
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, savedAt: new Date(),
      drivers: drivers.map(d => Object.assign({}, d)),
      vehicles: vehicles.map(v => ({ id: v.id, plate: v.plate, reg: v.reg, model: v.model, type: v.type, cap: v.cap, imei: v.imei, sim: v.sim, tracker: v.tracker, driverId: v.driverId })),
      messages: Object.fromEntries(Object.entries(messages).map(([k, l]) => [k, trim(l)])),
      rooms: Object.fromEntries(Object.entries(rooms).map(([k, l]) => [k, trim(l)])),
      lastRead, orders, clients, templates, docs, seq, userTpls, logs: logs.slice(0, 300),
    }));
  } catch (e) { console.warn('Не удалось сохранить', e); }
}
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
const reDate = x => x ? new Date(x) : x;
function restore(){
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  if (!data || data.v !== 1) return false;
  restoring = true;
  try {
    drivers.length = 0;
    (data.drivers || []).forEach(d => { d.lastSeen = reDate(d.lastSeen); drivers.push(d); });
    (data.vehicles || []).forEach(sv => { let v = vehById(sv.id); if (!v){ v = newVehicleStub(sv.id); vehicles.push(v); } Object.assign(v, sv); });
    Object.keys(messages).forEach(k => delete messages[k]);
    Object.entries(data.messages || {}).forEach(([k, l]) => messages[k] = l.map(m => Object.assign({}, m, { t: reDate(m.t), fb: m.fb === 'wait' ? 'sms' : m.fb, st: m.st === 'sent' ? 'delivered' : m.st })));
    drivers.forEach(d => { messages[d.id] = messages[d.id] || []; });
    Object.keys(rooms).forEach(k => delete rooms[k]);
    Object.entries(data.rooms || {}).forEach(([k, l]) => rooms[k] = l.map(m => Object.assign({}, m, { t: reDate(m.t) })));
    rooms.general = rooms.general || [];
    Object.assign(lastRead, data.lastRead || {});
    [[orders, data.orders], [clients, data.clients], [templates, data.templates], [docs, data.docs], [userTpls, data.userTpls]].forEach(([arr, src]) => { arr.length = 0; (src || []).forEach(x => arr.push(x)); });
    Object.assign(seq, data.seq || {});
    logs.length = 0; (data.logs || []).forEach(l => logs.push(Object.assign({}, l, { t: reDate(l.t) })));
    const ids = [...Object.values(messages).flat(), ...Object.values(rooms).flat()].map(m => m.id || 0);
    msgSeq = 1 + Math.max(0, ...ids);
  } catch (e) { console.warn('Не удалось восстановить данные', e); }
  restoring = false;
  return true;
}
async function resetDemo(){
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  try { await idbClear(); } catch (e) {}
  clearTimeout(saveTimer); saveNow = () => {};
  location.reload();
}

/* ---------- файлы документов: IndexedDB ---------- */
let idbP = null;
function idb(){
  if (!idbP) idbP = new Promise((res, rej) => {
    try { const r = indexedDB.open('trassa-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
  return idbP;
}
async function idbTx(mode, fn){ const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('files', mode); const r = fn(tx.objectStore('files')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
const idbPut = rec => idbTx('readwrite', s => s.put(rec));
const idbGet = id => idbTx('readonly', s => s.get(id));
const idbDel = id => idbTx('readwrite', s => s.delete(id));
const idbClear = () => idbTx('readwrite', s => s.clear());
const fileUrls = {};
async function fileUrl(id){ if (fileUrls[id]) return fileUrls[id]; const r = await idbGet(id); if (!r) return null; return fileUrls[id] = URL.createObjectURL(r.blob); }
async function shrinkImage(file){
  if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', .82));
  } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
}

/* =====================================================================
   ЧАТЫ ВОДИТЕЛЕЙ: общий чат + личные сообщения
   ===================================================================== */
const rooms = { general: [] };
const lastRead = {};               // 'driverId|roomKey' -> ms
const dmKey = (a, b) => 'dm:' + [a, b].sort().join(':');
function roomSeed(key, list){ rooms[key] = list.map(([m, from, text]) => ({ id: msgSeq++, from, text, t: minsAgo(m) })); }
roomSeed('general', [[55, 'd5', 'На Дмитровке авария в правом ряду, объезжайте'], [48, 'd3', 'Спасибо, ушёл на МКАД'],
  [20, 'd9', 'Кто рядом с Капотней? Нужна помощь закрепить груз, минут на 10'], [18, 'd10', 'Я в 15 минутах, подъеду'], [6, 'disp', 'Коллеги, напоминаю: путевые листы сдаём до 20:00']]);
roomSeed(dmKey('d1', 'd4'), [[33, 'd4', 'Андрей, ты на Ленинградке? Как там?'], [31, 'd1', 'Плотно у Химок, минут 20 стоим']]);
roomSeed(dmKey('d1', 'd2'), [[90, 'd2', 'Есть лишний ремень для стяжки? Мой порвался'], [88, 'd1', 'Есть, вечером на базе отдам']]);
const fromName = id => id === 'disp' ? 'Диспетчер' : (drvById(id) ? shortName(drvById(id).name) : 'Водитель');
function unreadFor(did, key){ const lr = lastRead[did + '|' + key] || 0; return (rooms[key] || []).filter(m => m.from !== did && +m.t > lr).length; }
function markRead(did, key){ lastRead[did + '|' + key] = Date.now(); }
function roomPush(key, from, text, extra){
  extra = extra || {};
  if (extra.gid && (rooms[key] || []).some(m => m.gid === extra.gid)) return null;
  const m = { id: msgSeq++, gid: extra.gid || newGid(), from, text, t: extra.t || new Date() };
  if (extra.silent) m.silent = true; if (extra.sos) m.sos = true;
  (rooms[key] = rooms[key] || []).push(m);
  if (rooms[key].length > 300) rooms[key].shift();
  if (!extra.remote && myIds().includes(from)) syncPublish({ k: 'room', key, from, text, t: m.t, eid: m.gid, ids: [from] });
  onRoom(key, m); scheduleSave(); return m;
}
const roomTyping = new Set();
function onRoom(key, m){
  if (phoneOpen){
    const me = phoneDriverId, mine = key === 'general' || key.split(':').includes(me);
    const viewing = (phTab === 'general' && key === 'general') || (phTab === 'drivers' && phDm && key === dmKey(me, phDm));
    if (viewing) markRead(me, key);
    else if (mine && m.from !== me && !m.silent) showPush(key === 'general' ? 'Общий чат · ' + fromName(m.from) : fromName(m.from), m.text, () => { if (key === 'general') setPhTab('general'); else { phDm = m.from; setPhTab('drivers'); } });
    renderPhone();
  }
  if (cur === 'chat'){ renderConvs(); if (chatDriver === 'general' && key === 'general') renderThread(); }
}
const DM_REPLIES = ['На связи 👍', 'Да, видел', 'За рулём, наберу через 10 минут', 'Ок, понял', 'Сейчас не могу, на разгрузке', 'Давай, договорились'];
const GEN_REPLIES = ['+', 'Спасибо, учту', 'Подтверждаю, там стоим', 'Я рядом, могу помочь', 'Принято'];
const GEN_SPONT = ['Кто на Ленинградке? Как там пробка?', 'На МКАД у Каширки ремонт, сужение до двух полос', 'На складе «Южный» сегодня очередь, заезжайте через ворота №3',
  'Заправка на Варшавке с картой работает', 'Кто будет в Химках после обеда? Нужно передать документы', 'Внимание: на ТТК у Автозаводской дежурят ДПС, проверяют путевые'];
function simulateReply(key, fromDid, list, delay, force){
  const d = drvById(fromDid); if (!d || (!d.appOnline && !force)) return;
  setTimeout(() => { roomTyping.add(key + '|' + fromDid); if (phoneOpen) renderPhone(); }, 900);
  setTimeout(() => { roomTyping.delete(key + '|' + fromDid); roomPush(key, fromDid, pick(list)); }, delay || rnd(3000, 6500));
}
setInterval(() => {
  if (anyLive()) return;                      // идёт живой тест — не засоряем чат придуманными сообщениями
  const pool = drivers.filter(d => d.vehicleId && d.appOnline && d.id !== phoneDriverId);
  if (pool.length && Math.random() < .55) roomPush('general', pick(pool).id, pick(GEN_SPONT));
}, 70000);
function showPush(title, text, onClick){
  const el = $('#phSms'); el.hidden = false; el.classList.add('push');
  el.innerHTML = `<div class="h"><b>${esc(title)}</b><span>сейчас</span></div><p>${esc(text)}</p>`;
  el.onclick = () => { el.hidden = true; onClick && onClick(); };
  clearTimeout(smsTimer); smsTimer = setTimeout(() => el.hidden = true, 6000);
}

/* ---------- общий чат в пульте диспетчера ---------- */
function generalConvHtml(){
  const m = rooms.general[rooms.general.length - 1];
  return `<div class="conv${chatDriver === 'general' ? ' sel' : ''}" data-d="general">
    <div class="av"><div class="avatar a-amber" style="font-size:11px">ВСЕ</div></div>
    <div style="min-width:0"><b>Общий чат водителей</b><div class="last">${m ? esc(fromName(m.from) + ': ' + m.text) : 'нет сообщений'}</div></div>
    <div class="meta">${m ? hm(m.t) : ''}<span class="mono" style="font-size:10.5px">${drivers.filter(d => d.vehicleId).length} чел.</span></div></div>`;
}
function renderGeneralThread(){
  $('#threadHead').innerHTML = `<button class="btn ghost sq m-only" id="thBack" title="Назад">‹</button><div class="avatar a-amber" style="font-size:11px">ВСЕ</div>
    <div class="grow"><b>Общий чат водителей</b><div class="sub">${drivers.filter(d => d.vehicleId).length} участников · видят все водители и диспетчеры</div></div>`;
  const tb = $('#threadBody');
  tb.innerHTML = '<div class="daysep">Сегодня</div>' + rooms.general.map(m => {
    const out = m.from === 'disp';
    return `<div class="msg ${out ? 'out' : 'in'}${m.sos ? ' sosmsg' : ''}">${out ? '' : `<div class="who">${esc(fromName(m.from))}</div>`}<div class="bub">${esc(m.text)}</div><div class="mt">${hm(m.t)}</div></div>`;
  }).join('');
  tb.scrollTop = tb.scrollHeight;
  $('#chatInfo').innerHTML = `<div class="ci-sec"><h4>Участники</h4>${drivers.filter(d => d.vehicleId).map(d => `<div class="kv"><span>${esc(shortName(d.name))}</span><b>${isOnline(d) ? '<i class="dot move"></i>' : '<i class="dot off"></i>'}</b></div>`).join('')}</div>
    <div class="ci-sec"><h4>Как это работает</h4><span class="muted">Водители переписываются здесь и в личных сообщениях друг с другом из приложения. Личные чаты водителей диспетчер не видит.</span></div>`;
}

/* =====================================================================
   SOS: оповещение ближайших водителей с расширением радиуса
   ===================================================================== */
const SOS_RADII = [5, 10, 20, 50];          // км; после 50 — все водители
const SOS_STAGE_SEC = 20;                    // демо: 20 с на ступень (в рабочей версии ~2 мин)
const SOS_REASONS = ['Поломка', 'ДТП', 'Плохо с самочувствием', 'Угроза / нападение', 'Застрял, нужна буксировка', 'Другое'];
const sosList = [];
const activeSos = () => sosList.filter(s => s.status === 'active');
const sosOf = did => sosList.find(s => s.did === did && s.status === 'active');
const sosRadius = s => s.stage < SOS_RADII.length ? SOS_RADII[s.stage] : Infinity;
const sosRadiusTxt = s => sosRadius(s) === Infinity ? 'все водители' : sosRadius(s) + ' км';
function driversNear(s, km){
  return drivers.filter(d => d.id !== s.did && vehOf(d) && vehOf(d).mode !== 'off')
    .map(d => ({ d, km: distKm(s, vehOf(d)) })).filter(x => x.km <= km).sort((a, b) => a.km - b.km);
}
function startSos(did, reason, note, opts = {}){
  if (sosOf(did)) return sosOf(did);
  const d = drvById(did), v = vehOf(d); if (!d) return null;
  const s = { id: opts.id || ('S' + DEV + Date.now()), did, reason, note: note || '', t: new Date(), lat: opts.lat ?? (v ? v.lat : 55.75), lng: opts.lng ?? (v ? v.lng : 37.62),
    stage: 0, stageAt: Date.now(), notified: [], responders: [], declined: [], status: 'active', origin: opts.remote ? 'remote' : DEV };
  sosList.push(s);
  if (!opts.remote && myIds().includes(did)) syncPublish({ k: 'sos', a: 'start', id: s.id, did, reason, note: s.note, lat: s.lat, lng: s.lng, ids: [did] });
  if (v && v.mode === 'move'){ v.stopUntil = Date.now() + 864e5; v.stopReason = 'SOS'; }   // машина стоит, пока SOS активен
  log('SOS', `${shortName(d.name)}: ${reason}${note ? ' · ' + note : ''}`);
  incoming(did, `SOS · ${reason}${note ? '. ' + note : ''}`, 'app', true);
  sosStage(s);
  if (!driverMode || phoneDriverId !== did) toast('🆘 SOS: ' + shortName(d.name), reason + ' · оповещаем водителей в радиусе 5 км', () => sosShowOnMap(s.id));
  return s;
}
function sosStage(s){
  const rad = sosRadius(s); s.stageAt = Date.now();
  const fresh = driversNear(s, rad).filter(x => !s.notified.includes(x.d.id));
  fresh.forEach(({ d, km }) => {
    s.notified.push(d.id);
    if (phoneOpen && phoneDriverId === d.id){ showSosIncoming(s); return; }
    const p = [.18, .35, .6, .85, .95][Math.min(s.stage, 4)];
    if (s.origin === DEV && !isLive(d.id) && d.appOnline && Math.random() < p) setTimeout(() => sosRespond(s, d.id), rnd(5000, 12000));
  });
  log('SOS', `${shortName(drvById(s.did).name)}: радиус ${sosRadiusTxt(s)}, оповещено ещё ${fresh.length}`);
  renderSos();
}
function sosRespond(s, did, opts = {}){
  if (s.status !== 'active' || s.responders.some(r => r.did === did)) return;
  if (!opts.remote && (myIds().includes(did) || s.origin === DEV)) syncPublish({ k: 'sos', a: 'resp', id: s.id, did, ids: myIds().includes(did) ? [did] : [] });
  const v = vehOf(drvById(did)), km = v ? distKm(s, v) : 5, eta = Math.max(3, Math.round(km / 40 * 60 + 2));
  s.responders.push({ did, km, eta, t: new Date() });
  const who = shortName(drvById(did).name), to = shortName(drvById(s.did).name);
  if (!(phoneOpen && phoneDriverId === did) && !(opts.remote && isLive(did))) roomPush(dmKey(did, s.did), did, `Вижу твой SOS. Еду, буду минут через ${eta}. Держись!`);
  log('SOS', `${who} едет на помощь к ${to} (${kmTxt(km)}, ≈${eta} мин)`);
  if (!driverMode) toast('SOS: помощь едет', `${who} → ${to} · ≈${eta} мин`, () => sosShowOnMap(s.id));
  renderSos();
}
function sosClose(s, how, opts = {}){
  if (s.status !== 'active') return;
  if (!opts.remote && (myIds().includes(s.did) || !driverMode)) syncPublish({ k: 'sos', a: 'close', id: s.id, how, ids: myIds() });
  s.status = 'closed'; s.closedHow = how;
  const sv = vehOf(drvById(s.did)); if (sv && sv.stopReason === 'SOS') sv.stopUntil = Date.now() + 4000;
  log('SOS', `${shortName(drvById(s.did).name)}: закрыт (${how})`);
  incoming(s.did, 'SOS закрыт: ' + how, 'app', true);
  renderSos();
}
function sosTick(){
  activeSos().forEach(s => {
    if (!s.responders.length && s.stage < SOS_RADII.length && (Date.now() - s.stageAt) / 1000 >= SOS_STAGE_SEC){ s.stage++; sosStage(s); }
  });
  if (activeSos().length || $('#sosBar').dataset.on) renderSos();
}
const sosLayer = L.layerGroup().addTo(map);
function renderSos(){
  const act = activeSos();
  const bar = $('#sosBar');
  bar.hidden = !act.length; bar.dataset.on = act.length ? '1' : '';
  bar.innerHTML = act.map(s => {
    const d = drvById(s.did), left = Math.max(0, SOS_STAGE_SEC - Math.round((Date.now() - s.stageAt) / 1000));
    const resp = s.responders.length ? `едут: ${s.responders.map(r => shortName(drvById(r.did).name) + ' (≈' + r.eta + ' мин)').join(', ')}`
      : (s.stage < SOS_RADII.length ? `ждём ответа · расширим через 0:${pad(left)}` : 'оповещены все водители');
    return `<div class="sos-item"><b class="sos-tag">SOS</b><div class="si-t"><b>${esc(shortName(d.name))} · ${esc(s.reason)}</b> <span class="mono">${hm(s.t)}</span>
      <small>Радиус ${sosRadiusTxt(s)} · оповещено ${s.notified.length} · ${resp}</small></div>
      <button data-sos-map="${s.id}">На карте</button><button data-sos-chat="${s.id}">Написать</button><button data-sos-close="${s.id}">Закрыть</button></div>`;
  }).join('');
  // карта
  sosLayer.clearLayers();
  act.forEach(s => {
    const rad = sosRadius(s);
    if (rad !== Infinity) L.circle([s.lat, s.lng], { radius: rad * 1000, color: '#FF5C6C', weight: 1.5, dashArray: '6 6', fillColor: '#FF5C6C', fillOpacity: .06, interactive: false }).addTo(sosLayer);
    L.marker([s.lat, s.lng], { interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div class="sos-pin"><i></i><b>SOS</b></div>' }) }).addTo(sosLayer);
    s.responders.forEach(r => { const v = vehOf(drvById(r.did)); if (v) L.polyline([[v.lat, v.lng], [s.lat, s.lng]], { color: '#3DDC97', weight: 2, dashArray: '4 6', interactive: false }).addTo(sosLayer); });
  });
  vehicles.forEach(v => { const el = markerEl(v); if (el) el.classList.toggle('sos', !!(v.driverId && sosOf(v.driverId))); });
  if (phoneOpen) renderPhoneSos();
}
$('#sosBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const s = sosList.find(x => x.id === (b.dataset.sosMap || b.dataset.sosChat || b.dataset.sosClose)); if (!s) return;
  if (b.dataset.sosMap) sosShowOnMap(s.id);
  if (b.dataset.sosChat) openChat(s.did);
  if (b.dataset.sosClose) sosClose(s, 'закрыт диспетчером');
});
function sosShowOnMap(id){
  const s = sosList.find(x => x.id === id); if (!s) return;
  if (location.hash !== '#monitoring') location.hash = 'monitoring';
  setTimeout(() => { map.invalidateSize(); const rad = sosRadius(s); map.flyTo([s.lat, s.lng], rad === Infinity ? 10 : rad <= 5 ? 12 : rad <= 10 ? 11 : 10, { duration: .6 }); }, 120);
}
/* SOS в телефоне водителя */
function openSosSheet(){
  const d = drvById(phoneDriverId);
  if (sosOf(d.id)) return;
  modal(`<div class="mb-h"><b style="color:var(--red)">🆘 Сигнал SOS</b><button class="x" data-close>×</button></div>
    <div class="mb-b"><div class="mb-note full">Сигнал сразу увидит диспетчер и водители в радиусе <b>5 км</b>. Если никто не ответит, радиус расширится до 10, 20 и 50 км, затем оповестим всех.</div>
    <div class="full sos-reasons">${SOS_REASONS.map((r, i) => `<button class="${i === 0 ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    ${fld('Комментарий (необязательно)', '<input id="sosNote" placeholder="Например: пробито колесо, стою на обочине">', true)}</div>
    <div class="mb-f"><button class="btn ghost" data-close>Отмена</button><button class="btn sosbtn" id="sosGo">Отправить SOS</button></div>`);
  $('.sos-reasons').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('.sos-reasons button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#sosGo').onclick = () => {
    const reason = ($('.sos-reasons button.on') || {}).dataset?.r || 'Другое';
    closeModal(); startSos(d.id, reason, $('#sosNote').value.trim()); setPhTab('disp'); renderPhone();
  };
}
function renderPhoneSos(){
  const el = $('#phSos'); const s = sosOf(phoneDriverId);
  if (!s){ el.hidden = true; return; }
  el.hidden = false;
  const left = Math.max(0, SOS_STAGE_SEC - Math.round((Date.now() - s.stageAt) / 1000));
  el.innerHTML = `<div class="pss-h"><b>SOS отправлен · ${esc(s.reason)}</b><span>${hm(s.t)}</span></div>
    <div class="pss-steps">${[...SOS_RADII, 'все'].map((r, i) => `<i class="${i < s.stage ? 'done' : i === s.stage ? 'now' : ''}">${r === 'все' ? 'все' : r + ' км'}</i>`).join('')}</div>
    <div class="pss-t">${s.responders.length ? s.responders.map(r => `<div class="pss-r"><b>${esc(shortName(drvById(r.did).name))}</b> едет к вам · ${kmTxt(r.km)} · ≈${r.eta} мин</div>`).join('')
      : `Оповещено водителей: <b>${s.notified.length}</b> · диспетчер в курсе<br>${s.stage < SOS_RADII.length ? `Расширим радиус через <b>0:${pad(left)}</b>` : 'Оповещены все водители'}`}</div>
    <div class="pss-b"><button data-sos-ok>Помощь пришла</button><button data-sos-cancel>Отменить SOS</button></div>`;
}
$('#phSos').addEventListener('click', e => {
  const s = sosOf(phoneDriverId); if (!s) return;
  if (e.target.closest('[data-sos-ok]')) sosClose(s, 'помощь пришла');
  if (e.target.closest('[data-sos-cancel]')) sosClose(s, 'отменён водителем');
});
function showSosIncoming(s){
  const el = $('#phSosIn'), me = vehOf(drvById(phoneDriverId)), d = drvById(s.did);
  const km = me ? distKm(s, me) : 0;
  el.hidden = false; el.dataset.sos = s.id;
  el.innerHTML = `<div class="psi-box"><div class="psi-pulse">SOS</div><b>${esc(shortName(d.name))} просит помощи</b>
    <div class="psi-r">${esc(s.reason)}${s.note ? ' · ' + esc(s.note) : ''}</div>
    <div class="psi-k">${kmTxt(km)} от вас · ${vehOf(d) ? vehOf(d).plate + ' ' + vehOf(d).reg : ''} · ${hm(s.t)}</div>
    <button class="go" data-sos-go>Еду на помощь</button><button class="no" data-sos-no>Не могу</button></div>`;
  try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
}
$('#phSosIn').addEventListener('click', e => {
  const el = $('#phSosIn'), s = sosList.find(x => x.id === el.dataset.sos); if (!s) { el.hidden = true; return; }
  if (e.target.closest('[data-sos-go]')){
    sosRespond(s, phoneDriverId); el.hidden = true;
    const r = s.responders.find(x => x.did === phoneDriverId);
    roomPush(dmKey(phoneDriverId, s.did), phoneDriverId, `Вижу твой SOS, еду. Буду минут через ${r ? r.eta : 10}.`, { silent: true });
    if (!isLive(s.did)) simulateReply(dmKey(phoneDriverId, s.did), s.did, ['Спасибо! Стою на обочине, аварийка включена', 'Спасибо, жду! Я у съезда, увидишь фуру'], 5000, true);
    phDm = s.did; setPhTab('drivers');
  }
  if (e.target.closest('[data-sos-no]')){ s.declined.push(phoneDriverId); el.hidden = true; }
});
function testNearbySos(){
  const me = vehOf(drvById(phoneDriverId));
  const cands = drivers.filter(d => d.id !== phoneDriverId && vehOf(d) && vehOf(d).mode === 'move' && !sosOf(d.id));
  if (!me || !cands.length) return;
  cands.sort((a, b) => distKm(me, vehOf(a)) - distKm(me, vehOf(b)));
  startSos(cands[0].id, pick(['Поломка', 'Застрял, нужна буксировка', 'ДТП']), pick(['', 'Пробито колесо', 'Не заводится']));
}
$('#phSosBtn').onclick = openSosSheet;
$('#phTestSos').onclick = testNearbySos;

/* =====================================================================
   ТЕЛЕФОН ВОДИТЕЛЯ: вкладки
   ===================================================================== */
let phTab = 'disp', phDm = null;
function setPhTab(t){ phTab = t; if (t !== 'drivers') phDm = null; renderPhone(); }
$('#phTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab === 'drivers') phDm = null; setPhTab(b.dataset.tab); });
function phoneTabHtml(){
  const me = phoneDriverId, myV = vehOf(drvById(me));
  if (phTab === 'general'){
    markRead(me, 'general');
    const typing = [...roomTyping].some(k => k.startsWith('general|'));
    return rooms.general.map(m => m.from === me
      ? `<div class="pm out">${esc(m.text)}<small>${hm(m.t)}</small></div>`
      : `<div class="pm in${m.from === 'disp' ? ' disp' : ''}"><em>${esc(fromName(m.from))}</em>${esc(m.text)}<small>${hm(m.t)}</small></div>`).join('')
      + (typing ? '<div class="pm in typing-pm"><i></i><i></i><i></i></div>' : '');
  }
  if (phTab === 'drivers' && phDm){
    const key = dmKey(me, phDm), o = drvById(phDm), ov = vehOf(o); markRead(me, key);
    const head = `<div class="ph-dmhead" data-dmback><b>‹</b><div class="avatar ${avClass(o.id)}">${initials(o.name)}</div><div><strong>${esc(shortName(o.name))}</strong><span>${ov ? ov.plate + ' · ' : ''}${ov && myV ? kmTxt(distKm(myV, ov)) + ' от вас' : ''}${o.appOnline ? ' · в сети' : ' · не в сети'}</span></div></div>`;
    const typing = roomTyping.has(key + '|' + phDm);
    return head + ((rooms[key] || []).map(m => m.from === me ? `<div class="pm out">${esc(m.text)}<small>${hm(m.t)}</small></div>` : `<div class="pm in">${esc(m.text)}<small>${hm(m.t)}</small></div>`).join('') || '<div class="pm st">Напишите первое сообщение</div>')
      + (typing ? '<div class="pm in typing-pm"><i></i><i></i><i></i></div>' : '');
  }
  if (phTab === 'drivers'){
    const list = drivers.filter(d => d.id !== me && d.vehicleId).map(d => ({ d, km: myV && vehOf(d) ? distKm(myV, vehOf(d)) : 999 })).sort((a, b) => a.km - b.km);
    return '<div class="ph-hint">Водители рядом · сортировка по расстоянию</div>' + list.map(({ d, km }) => {
      const key = dmKey(me, d.id), l = (rooms[key] || []).slice(-1)[0], un = unreadFor(me, key);
      return `<button class="ph-row" data-dm="${d.id}"><div class="avatar ${avClass(d.id)}">${initials(d.name)}<i class="st${d.appOnline ? ' on' : ''}"></i></div>
        <div class="pr-t"><b>${esc(shortName(d.name))}${isLive(d.id) ? ' <span class="live-tag">LIVE</span>' : ''}</b><span>${l ? esc((l.from === me ? 'Вы: ' : '') + l.text) : (vehOf(d) ? vehOf(d).plate + ' · ' + vehOf(d).model : '')}</span></div>
        <div class="pr-m">${km < 999 ? kmTxt(km) : ''}${un ? `<i class="unread">${un}</i>` : ''}${sosOf(d.id) ? '<i class="sos-mini">SOS</i>' : ''}</div></button>`;
    }).join('') + '<button class="ph-demo" data-test-sos>Демо: соседний водитель подаёт SOS</button>';
  }
  if (phTab === 'docs'){
    const mine = [...docsOf(me), ...(myV ? docsOf(myV.id) : [])];
    return '<div class="ph-hint">Ваши документы и документы ТС. Нажмите, чтобы добавить фото.</div>' + mine.map(x => {
      const st = docStatus(x);
      return `<button class="ph-row" data-doc="${x.id}"><div class="doc-ic ${st.cls}">${x.owner.startsWith('v') ? '🚚' : '🪪'}</div>
        <div class="pr-t"><b>${esc(x.kind)}</b><span>${esc(docNumber(x, true))}${x.files.length ? ' · ' + x.files.length + ' фото' : ' · нет скана'}</span></div>
        <div class="pr-m"><span class="pill ${st.cls}">${st.txt}</span></div></button>`;
    }).join('') + '<button class="ph-scanbig" data-scan-doc>📷 Сканировать документ</button><button class="ph-demo" data-add-doc>+ Добавить документ вручную</button>';
  }
  return null;   // вкладка «Диспетчер» — старый код
}
$('#phChat').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-dmback]')){ phDm = null; renderPhone(); return; }
  const dm = t.closest('[data-dm]'); if (dm){ phDm = dm.dataset.dm; renderPhone(); setTimeout(() => $('#phInput').focus(), 50); return; }
  const dc = t.closest('[data-doc]'); if (dc){ openDoc(dc.dataset.doc); return; }
  if (t.closest('[data-add-doc]')){ openDoc(null, phoneDriverId); return; }
  if (t.closest('[data-scan-doc]')){ openScanner({ title: 'Скан документа' }); return; }
  if (t.closest('[data-test-sos]')) testNearbySos();
});
function phoneSendTab(text){
  const me = phoneDriverId;
  if (phTab === 'general'){
    roomPush('general', me, text); markRead(me, 'general');
    const pool = drivers.filter(d => d.vehicleId && d.appOnline && d.id !== me);
    if (!anyLive() && pool.length && Math.random() < .7) simulateReply('general', pick(pool).id, /\?/.test(text) ? ['Я видел, всё ок', 'Там свободно', 'Не знаю, спроси у диспетчера'] : GEN_REPLIES);
    return true;
  }
  if (phTab === 'drivers' && phDm){
    roomPush(dmKey(me, phDm), me, text); markRead(me, dmKey(me, phDm));
    if (!isLive(phDm)) simulateReply(dmKey(me, phDm), phDm, DM_REPLIES);
    return true;
  }
  return false;
}
function updatePhTabs(){
  const me = phoneDriverId;
  const dmUn = Object.keys(rooms).filter(k => k.startsWith('dm:') && k.split(':').includes(me)).reduce((a, k) => a + unreadFor(me, k), 0);
  const counts = { disp: 0, drivers: dmUn, general: unreadFor(me, 'general') };
  $$('#phTabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === phTab); const i = b.querySelector('i'); if (i){ const n = counts[b.dataset.tab] || 0; i.textContent = n || ''; i.hidden = !n; } });
  $('.phone').dataset.tab = phTab + (phTab === 'drivers' && !phDm ? '-list' : '');
  $('#phInput').placeholder = phTab === 'general' ? 'Сообщение всем водителям' : phTab === 'drivers' ? 'Сообщение водителю' : 'Сообщение диспетчеру';
}

/* =====================================================================
   КЛИЕНТЫ И ЗАЯВКИ (с повтором по расписанию)
   ===================================================================== */
const clients = [
  { id: 'k1', name: 'ООО «СеверТорг»', inn: '7714356621', contact: 'Ольга Лебедева', phone: '+7 925 410-22-18', email: 'logist@severtorg.example', addresses: [PLACES.khimki, PLACES.medvedkovo], note: 'Сеть продуктовых магазинов. Приёмка с 7:00.' },
  { id: 'k2', name: 'ООО «Вкус Дня»', inn: '7728119034', contact: 'Артур Саакян', phone: '+7 916 772-03-45', email: 'zakaz@vkusdnya.example', addresses: [PLACES.center, PLACES.izmaylovo], note: 'Фабрика-кухня, ежедневные развозы.' },
  { id: 'k3', name: 'АО «СтройМаркет»', inn: '5003129870', contact: 'Дмитрий Гусев', phone: '+7 903 118-90-07', email: 'dostavka@stroymarket.example', addresses: [PLACES.medvedkovo, PLACES.yasenevo, PLACES.butovo], note: 'Стройматериалы, нужен гидроборт.' },
  { id: 'k4', name: 'ООО «Мебель-Комфорт»', inn: '7720554312', contact: 'Наталья Кравец', phone: '+7 985 301-44-60', email: 'sklad@mebel-komfort.example', addresses: [PLACES.perovo, PLACES.kuntsevo], note: '' },
  { id: 'k5', name: 'ИП Миронова Е. А.', inn: '772901234567', contact: 'Елена Миронова', phone: '+7 926 555-17-32', email: '', addresses: [PLACES.lyublino, PLACES.tushino], note: 'Оплата по факту, наличные.' },
  { id: 'k6', name: 'ООО «ФрешЛайн»', inn: '7743098812', contact: 'Игорь Пан', phone: '+7 977 640-80-11', email: 'ops@freshline.example', addresses: [PLACES.domodedovskaya, PLACES.vnukovo_dir], note: 'Охлаждённая продукция, только рефрижератор.' },
];
const STATUSES = ['Новая', 'Назначена', 'В пути', 'Выполнена', 'Отменена'];
const ST_CLS = { 'Новая': 'amber', 'Назначена': 'park', 'В пути': 'move', 'Выполнена': 'off', 'Отменена': 'red' };
const orders = [], templates = [];
function mkOrder(o){ seq.order++; return Object.assign({ id: 'o' + seq.order, no: 'З-' + seq.order, status: 'Новая', price: 0, note: '', driverId: null, templateId: null, vtype: 'Фургон', weight: '', time: '09:00', created: Date.now() }, o); }
[
  [0, '06:30', 'k2', 'center', 'izmaylovo', 'Готовая еда, 40 ящиков', '0,6 т', 'Фургон', 'd9', 'Выполнена', 6500],
  [0, '08:00', 'k3', 'medvedkovo', 'yasenevo', 'Цемент, 30 мешков', '1,5 т', 'Среднетоннажный', 'd7', 'В пути', 14000],
  [0, '09:00', 'k1', 'domodedovskaya', 'khimki', 'Бакалея, 18 паллет', '16 т', 'Фура', 'd1', 'В пути', 32000],
  [0, '10:30', 'k6', 'vnukovo_dir', 'sokolniki', 'Молочная продукция (+4°)', '1,2 т', 'Фургон', 'd2', 'В пути', 9800],
  [0, '13:00', 'k4', 'perovo', 'kuntsevo', 'Мебель, 6 позиций', '0,9 т', 'Фургон', 'd8', 'Назначена', 11500],
  [0, '15:30', 'k5', 'lyublino', 'tushino', 'Товары для дома', '2 т', 'Среднетоннажный', null, 'Новая', 12000],
  [0, '17:00', 'k1', 'khimki', 'medvedkovo', 'Возвратная тара', '0,5 т', 'Фургон', null, 'Новая', 5500],
  [1, '07:00', 'k3', 'butovo', 'medvedkovo', 'Плитка, 8 паллет', '7 т', 'Фура', null, 'Новая', 21000],
  [1, '11:00', 'k6', 'domodedovskaya', 'center', 'Овощи, охлаждённое', '1 т', 'Фургон', 'd8', 'Назначена', 8700],
  [2, '09:30', 'k4', 'perovo', 'krylatskoe', 'Кухонный гарнитур', '1,1 т', 'Фургон', null, 'Новая', 12500],
  [-1, '10:00', 'k5', 'lyublino', 'kapotnya', 'Хозтовары', '1,8 т', 'Среднетоннажный', 'd3', 'Выполнена', 9000],
].forEach(([dd, time, cl, a, b, cargo, weight, vtype, drv, st, price]) => orders.push(mkOrder({ date: dayPlus(dd), time, clientId: cl, from: PLACES[a], to: PLACES[b], cargo, weight, vtype, driverId: drv, status: st, price })));
templates.push(
  { id: 't1', clientId: 'k2', from: PLACES.center, to: PLACES.izmaylovo, time: '06:30', cargo: 'Готовая еда, 40 ящиков', weight: '0,6 т', vtype: 'Фургон', driverId: 'd9', price: 6500, repeat: { kind: 'daily', days: [], dom: 1 }, start: dayPlus(-20), until: '', active: true, skip: [] },
  { id: 't2', clientId: 'k3', from: PLACES.medvedkovo, to: PLACES.yasenevo, time: '08:00', cargo: 'Цемент, 30 мешков', weight: '1,5 т', vtype: 'Среднетоннажный', driverId: 'd7', price: 14000, repeat: { kind: 'days', days: [1, 3, 5], dom: 1 }, start: dayPlus(-30), until: '', active: true, skip: [] },
  { id: 't3', clientId: 'k1', from: PLACES.khimki, to: PLACES.medvedkovo, time: '17:00', cargo: 'Возвратная тара', weight: '0,5 т', vtype: 'Фургон', driverId: null, price: 5500, repeat: { kind: 'weekdays', days: [], dom: 1 }, start: dayPlus(-10), until: '', active: true, skip: [] },
);
orders[0].templateId = 't1'; orders[6].templateId = 't3';
if (wdOf(dayPlus(0)) === 1 || wdOf(dayPlus(0)) === 3 || wdOf(dayPlus(0)) === 5) orders[1].templateId = 't2';
const clientById = id => clients.find(c => c.id === id);
const tplById = id => templates.find(t => t.id === id);
function tplMatches(t, s){
  if (!t.active || s < t.start || (t.until && s > t.until) || (t.skip || []).includes(s)) return false;
  const k = t.repeat.kind, wd = wdOf(s);
  if (k === 'daily') return true;
  if (k === 'weekdays') return wd <= 5;
  if (k === 'days') return t.repeat.days.includes(wd);
  if (k === 'monthly') return +s.slice(8, 10) === +t.repeat.dom;
  return false;
}
function repeatText(t){
  const r = t.repeat, at = ' в ' + t.time;
  if (r.kind === 'daily') return 'Каждый день' + at;
  if (r.kind === 'weekdays') return 'По будням' + at;
  if (r.kind === 'days') return (r.days.length ? r.days.slice().sort().map(d => WD[d - 1]).join(', ') : 'дни не выбраны') + at;
  if (r.kind === 'monthly') return 'Каждое ' + r.dom + '-е число' + at;
  return '—';
}
function nextDates(t, n){ const out = []; for (let i = 0; i < 70 && out.length < n; i++){ const s = dayPlus(i); if (tplMatches(t, s)) out.push(s); } return out; }
const HORIZON = 14;
function generateOrders(){
  let n = 0;
  templates.forEach(t => {
    for (let i = 0; i <= HORIZON; i++){
      const s = dayPlus(i);
      if (tplMatches(t, s) && !orders.some(o => o.templateId === t.id && o.date === s)){
        orders.push(mkOrder({ date: s, time: t.time, clientId: t.clientId, from: t.from, to: t.to, cargo: t.cargo, weight: t.weight, vtype: t.vtype, driverId: t.driverId, price: t.price,
          status: t.driverId ? 'Назначена' : 'Новая', templateId: t.id, auto: true }));
        n++;
      }
    }
  });
  if (n){ log('Расписание', `Автоматически создано заявок: ${n}`); scheduleSave(); if (cur === 'orders') renderOrders(); updateOrderBadge(); }
  return n;
}
setInterval(generateOrders, 60000);
function updateOrderBadge(){
  const n = orders.filter(o => o.date === dayPlus(0) && !o.driverId && o.status === 'Новая').length;
  const b = $('#navOrders'); b.hidden = !n; b.textContent = n; b.title = 'Заявки на сегодня без водителя';
}

/* ---------- таблица заявок ---------- */
let oSort = { k: 'when', dir: 1 }, oRange = 'today';
const O_COLS = [
  { k: 'no', t: '№', v: o => o.no, f: o => `<b class="mono">${o.no}</b>${o.templateId ? ' <span class="rep" title="Повторяющаяся: ' + esc(tplById(o.templateId) ? repeatText(tplById(o.templateId)) : '') + '">↻</span>' : ''}` },
  { k: 'when', t: 'Когда', v: o => o.date + o.time, f: o => `<b>${dayLabel(o.date)}</b> <span class="mono">${o.time}</span>` },
  { k: 'client', t: 'Клиент', v: o => clientById(o.clientId)?.name || '', f: o => esc(clientById(o.clientId)?.name || '—') },
  { k: 'route', t: 'Маршрут', v: o => o.from, f: o => `<div class="route"><span>${esc(o.from)}</span><span>${esc(o.to)}</span></div>` },
  { k: 'cargo', t: 'Груз', v: o => o.cargo, f: o => `${esc(o.cargo)}<div class="muted">${esc(o.weight)} · ${o.vtype}</div>` },
  { k: 'drv', t: 'Водитель', v: o => drvById(o.driverId)?.name || 'я', f: o => drvById(o.driverId) ? `${esc(shortName(drvById(o.driverId).name))}${vehOf(drvById(o.driverId)) ? '<div class="muted mono">' + vehOf(drvById(o.driverId)).plate + '</div>' : ''}` : '<span class="pill amber">не назначен</span>' },
  { k: 'status', t: 'Статус', v: o => STATUSES.indexOf(o.status), f: o => `<span class="pill ${ST_CLS[o.status]}">${o.status}</span>` },
  { k: 'price', t: 'Цена', v: o => +o.price || 0, f: o => o.price ? `<span class="mono">${Number(o.price).toLocaleString('ru')} ₽</span>` : '—' },
];
function renderOrders(){
  const q = $('#oSearch').value.trim().toLowerCase(), st = $('#oStatus').value;
  const inRange = o => oRange === 'all' || (oRange === 'today' ? o.date === dayPlus(0) : oRange === 'tomorrow' ? o.date === dayPlus(1) : o.date >= dayPlus(0) && o.date <= dayPlus(6));
  const rows = orders.filter(o => inRange(o) && (!st || o.status === st) && (!q || [o.no, clientById(o.clientId)?.name, o.from, o.to, o.cargo, drvById(o.driverId)?.name].join(' ').toLowerCase().includes(q))).sort(sorter(oSort, O_COLS));
  makeTable($('#oTable'), O_COLS, rows, oSort, k => { oSort = { k, dir: oSort.k === k ? -oSort.dir : 1 }; renderOrders(); });
  if (!rows.length) $('#oTable tbody').innerHTML = `<tr><td colspan="9" class="empty-row">Заявок нет. Нажмите «+ Заявка» или поменяйте фильтр.</td></tr>`;
  $('#oTplCount').textContent = templates.filter(t => t.active).length;
  updateOrderBadge();
}
$('#oSearch').addEventListener('input', renderOrders); $('#oStatus').addEventListener('change', renderOrders);
$('#oRange').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; oRange = b.dataset.r; $$('#oRange button').forEach(x => x.classList.toggle('on', x === b)); renderOrders(); });
$('#oTable').addEventListener('click', e => { const tr = e.target.closest('tbody tr[data-id]'); if (tr) editOrder(tr.dataset.id); });
$('#oAdd').onclick = () => editOrder(null);
$('#oTpl').onclick = showTemplates;

function addrDatalist(){ const set = new Set([...clients.flatMap(c => c.addresses || []), ...Object.values(PLACES)]); return `<datalist id="addrList">${[...set].map(a => `<option value="${esc(a)}">`).join('')}</datalist>`; }
function repeatBlock(rep, until){
  rep = rep || { kind: 'none', days: [], dom: 1 };
  return `<div class="full rep-box"><label class="rep-l">Повторять заявку</label>
    <div class="rep-row"><select id="rKind">${[['none', 'Не повторять'], ['daily', 'Каждый день'], ['weekdays', 'По будням (Пн–Пт)'], ['days', 'По выбранным дням недели'], ['monthly', 'Раз в месяц']].map(([v, t]) => opt(v, rep.kind, t)).join('')}</select>
    <input type="number" id="rDom" min="1" max="28" value="${rep.dom || 1}" title="Число месяца" ${rep.kind === 'monthly' ? '' : 'hidden'}>
    <label class="rep-until">до <input type="date" id="rUntil" value="${until || ''}"></label></div>
    <div class="wd-chips" id="rDays" ${rep.kind === 'days' ? '' : 'hidden'}>${WD.map((w, i) => `<button type="button" data-d="${i + 1}" class="${(rep.days || []).includes(i + 1) ? 'on' : ''}">${w}</button>`).join('')}</div>
    <div class="rep-next muted" id="rNext"></div></div>`;
}
function bindRepeat(time){
  const upd = () => {
    const k = $('#rKind').value;
    $('#rDays').hidden = k !== 'days'; $('#rDom').hidden = k !== 'monthly';
    const t = { active: true, start: dayPlus(0), until: $('#rUntil').value, skip: [], time: ($('#ofTime') || {}).value || time || '09:00', repeat: readRepeat() };
    $('#rNext').innerHTML = k === 'none' ? 'Разовая заявка' : 'Ближайшие: ' + nextDates(t, 4).map(dayLabel).join(', ') + ` · заявки создаются автоматически на ${HORIZON} дней вперёд`;
  };
  $('#rKind').onchange = upd; $('#rDom').oninput = upd; $('#rUntil').onchange = upd;
  $('#rDays').onclick = e => { const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on'); upd(); };
  upd();
}
function readRepeat(){ return { kind: $('#rKind').value, days: $$('#rDays button.on').map(b => +b.dataset.d), dom: Math.min(28, Math.max(1, +$('#rDom').value || 1)) }; }

function editOrder(id, preset){
  const isNew = !id;
  const o = isNew ? mkOrderDraft(preset) : orders.find(x => x.id === id);
  const t = o.templateId ? tplById(o.templateId) : null;
  modal(`<div class="mb-h"><b>${isNew ? 'Новая заявка' : 'Заявка ' + o.no}</b>${t ? '<span class="pill violet">↻ повторяющаяся</span>' : ''}<button class="x" data-close>×</button></div>
  <div class="mb-b">
    ${fld('Клиент', `<select id="ofClient">${clients.map(c => opt(c.id, o.clientId, c.name)).join('')}<option value="__new">+ Новый клиент…</option></select><input id="ofNewClient" placeholder="Название нового клиента" hidden style="margin-top:6px">`, true)}
    ${fld('Дата', `<input type="date" id="ofDate" value="${o.date}">`)}
    ${fld('Время подачи', `<input type="time" id="ofTime" value="${o.time}">`)}
    ${fld('Откуда (погрузка)', `<input id="ofFrom" list="addrList" value="${esc(o.from)}">`, true)}
    ${fld('Куда (выгрузка)', `<input id="ofTo" list="addrList" value="${esc(o.to)}">`, true)}
    ${fld('Груз', `<input id="ofCargo" value="${esc(o.cargo)}" placeholder="Что везём">`)}
    ${fld('Вес / объём', `<input id="ofWeight" value="${esc(o.weight)}" placeholder="1,5 т">`)}
    ${fld('Тип ТС', `<select id="ofType">${['Фургон', 'Среднетоннажный', 'Фура'].map(v => opt(v, o.vtype)).join('')}</select>`)}
    ${fld('Водитель', `<select id="ofDrv"><option value="">— не назначен —</option>${drivers.filter(d => d.vehicleId).map(d => opt(d.id, o.driverId, shortName(d.name) + ' · ' + vehOf(d).type)).join('')}</select>`)}
    ${fld('Статус', `<select id="ofStatus">${STATUSES.map(s => opt(s, o.status)).join('')}</select>`)}
    ${fld('Цена, ₽', `<input type="number" id="ofPrice" value="${o.price || ''}" min="0" step="100">`)}
    ${fld('Комментарий', `<input id="ofNote" value="${esc(o.note)}" placeholder="Пропуск, контакт на месте…">`, true)}
    ${repeatBlock(t ? t.repeat : null, t ? t.until : '')}
    ${t ? '<div class="mb-note full">Изменение расписания применится к будущим заявкам этой серии. Сама эта заявка останется как есть, если вы её не поменяете.</div>' : ''}
    ${addrDatalist()}
  </div>
  <div class="mb-f wrap">${isNew ? '' : '<button class="btn danger left" id="ofDel">Удалить</button><button class="btn ghost" id="ofDup">Дублировать</button>'}
    <button class="btn ghost" id="ofSend" ${o.driverId ? '' : 'hidden'}>Отправить водителю</button>
    <button class="btn primary" id="ofSave">${isNew ? 'Создать' : 'Сохранить'}</button></div>`);
  $('#ofClient').onchange = e => { $('#ofNewClient').hidden = e.target.value !== '__new'; if (e.target.value === '__new') $('#ofNewClient').focus(); };
  $('#ofDrv').onchange = e => { $('#ofSend').hidden = !e.target.value; };
  bindRepeat(o.time);
  const collect = () => {
    let cid = $('#ofClient').value;
    if (cid === '__new'){
      const name = $('#ofNewClient').value.trim(); if (!name){ $('#ofNewClient').focus(); return null; }
      const c = { id: 'k' + (++seq.client), name, inn: '', contact: '', phone: '', email: '', addresses: [], note: '' }; clients.push(c); cid = c.id; log('Новый клиент', name);
    }
    const f = { clientId: cid, date: $('#ofDate').value || dayPlus(0), time: $('#ofTime').value || '09:00', from: $('#ofFrom').value.trim(), to: $('#ofTo').value.trim(),
      cargo: $('#ofCargo').value.trim(), weight: $('#ofWeight').value.trim(), vtype: $('#ofType').value, driverId: $('#ofDrv').value || null, status: $('#ofStatus').value,
      price: +$('#ofPrice').value || 0, note: $('#ofNote').value.trim() };
    const c = clientById(cid); [f.from, f.to].forEach(a => { if (a && c && !c.addresses.includes(a)) c.addresses.push(a); });
    return f;
  };
  const save = () => {
    const f = collect(); if (!f) return null;
    if (!f.from || !f.to){ toast('Нужен маршрут', 'Заполните адреса погрузки и выгрузки'); return null; }
    if (f.driverId && f.status === 'Новая') f.status = 'Назначена';
    let target = o;
    if (isNew){ target = mkOrder(f); orders.push(target); } else Object.assign(o, f);
    const rep = readRepeat(), until = $('#rUntil').value;
    if (rep.kind !== 'none'){
      if (target.templateId && tplById(target.templateId)){
        Object.assign(tplById(target.templateId), { repeat: rep, until, time: f.time, driverId: f.driverId, cargo: f.cargo, weight: f.weight, vtype: f.vtype, price: f.price, from: f.from, to: f.to, clientId: f.clientId, active: true });
        orders.filter(x => x.templateId === target.templateId && x.date > dayPlus(0) && x.auto && x.status === 'Новая' && x !== target).forEach(x => orders.splice(orders.indexOf(x), 1));
      } else {
        const tp = { id: 't' + (++seq.tpl), clientId: f.clientId, from: f.from, to: f.to, time: f.time, cargo: f.cargo, weight: f.weight, vtype: f.vtype, driverId: f.driverId, price: f.price, repeat: rep, start: target.date, until, active: true, skip: [] };
        templates.push(tp); target.templateId = tp.id;
        log('Расписание', `${target.no} → повтор: ${repeatText(tp)}`);
      }
      generateOrders();
    } else if (target.templateId && tplById(target.templateId)){
      const tp = tplById(target.templateId); tp.active = false;
      orders.filter(x => x.templateId === tp.id && x.date > dayPlus(0) && x.auto && x.status === 'Новая').forEach(x => orders.splice(orders.indexOf(x), 1));
      log('Расписание', `Повтор отключён для серии ${target.no}`);
    }
    log(isNew ? 'Новая заявка' : 'Изменение заявки', `${target.no} · ${clientById(target.clientId)?.name || ''} · ${dayLabel(target.date)} ${target.time}`);
    return target;
  };
  $('#ofSave').onclick = () => { const t2 = save(); if (!t2) return; closeModal(); renderOrders(); toast(isNew ? 'Заявка создана' : 'Сохранено', t2.no + (t2.templateId ? ' · повторяется' : '')); };
  $('#ofSend').onclick = () => { const t2 = save(); if (!t2 || !t2.driverId) return; sendOrderToDriver(t2); closeModal(); renderOrders(); };
  const del = $('#ofDel');
  if (del) del.onclick = () => {
    if (del.dataset.c !== '1'){ del.dataset.c = '1'; del.textContent = 'Точно удалить?'; return; }
    if (o.templateId && tplById(o.templateId)){ const tp = tplById(o.templateId); tp.skip = tp.skip || []; tp.skip.push(o.date); }
    orders.splice(orders.indexOf(o), 1); log('Удаление заявки', o.no); closeModal(); renderOrders(); toast('Заявка удалена', o.no);
  };
  const dup = $('#ofDup');
  if (dup) dup.onclick = () => {
    const f = collect(); if (!f) return;
    const next = new Date(f.date + 'T12:00'); next.setDate(next.getDate() + 1);
    closeModal();
    editOrder(null, Object.assign({}, f, { date: isoDay(next), status: f.driverId ? 'Назначена' : 'Новая' }));
    toast('Копия заявки', 'Проверьте дату и нажмите «Создать»');
  };
}
function mkOrderDraft(p){ return Object.assign({ id: null, no: '', clientId: clients[0] && clients[0].id, date: dayPlus(0), time: '09:00', from: '', to: '', cargo: '', weight: '', vtype: 'Фургон', driverId: null, status: 'Новая', price: '', note: '', templateId: null }, p || {}); }
function sendOrderToDriver(o){
  const c = clientById(o.clientId);
  sendToDriver(o.driverId, `Заявка ${o.no}: ${dayLabel(o.date)} в ${o.time}.\nПогрузка: ${o.from}\nВыгрузка: ${o.to}\nГруз: ${o.cargo}${o.weight ? ' (' + o.weight + ')' : ''}${c ? '\nКлиент: ' + c.name + (c.contact ? ', ' + c.contact + ' ' + c.phone : '') : ''}${o.note ? '\n' + o.note : ''}\nПодтвердите, пожалуйста.`, 'auto');
  if (o.status === 'Новая') o.status = 'Назначена';
  log('Заявка отправлена водителю', `${o.no} → ${shortName(drvById(o.driverId).name)}`);
  toast('Отправлено водителю', `${o.no} → ${shortName(drvById(o.driverId).name)}`);
}
function showTemplates(){
  const rows = templates.map(t => {
    const c = clientById(t.clientId), nx = nextDates(t, 3);
    return `<div class="tpl-row${t.active ? '' : ' off'}" data-t="${t.id}">
      <div class="tr-t"><b>${esc(c ? c.name : '—')}</b><span>${esc(t.from)} → ${esc(t.to)}</span><span>${esc(t.cargo)}${t.driverId ? ' · ' + esc(shortName(drvById(t.driverId)?.name || '')) : ' · водитель не закреплён'}</span></div>
      <div class="tr-r"><span class="pill violet">↻ ${repeatText(t)}</span><small>${t.active ? (nx.length ? 'Дальше: ' + nx.map(dayLabel).join(', ') : 'нет дат') : 'на паузе'}</small>
      <label class="tog"><input type="checkbox" data-act="toggle" ${t.active ? 'checked' : ''}><i></i><span>${t.active ? 'вкл' : 'выкл'}</span></label>
      <button class="btn ghost" data-act="del">Удалить</button></div></div>`;
  }).join('') || '<div class="muted" style="padding:16px">Повторяющихся заявок пока нет. Откройте любую заявку и выберите «Повторять».</div>';
  modal(`<div class="mb-h"><b>Повторяющиеся заявки</b><button class="x" data-close>×</button></div>
    <div class="mb-b"><div class="full tpl-list">${rows}</div><div class="mb-note full">Система сама создаёт заявки по расписанию на ${HORIZON} дней вперёд. Удалённая заявка из серии не появится снова в тот же день.</div></div>
    <div class="mb-f"><button class="btn primary" data-close>Готово</button></div>`);
  $('.tpl-list').onclick = $('.tpl-list').onchange = e => {
    const row = e.target.closest('[data-t]'), act = e.target.closest('[data-act]'); if (!row || !act) return;
    const t = tplById(row.dataset.t);
    if (act.dataset.act === 'toggle' && e.type === 'change'){ t.active = act.checked; if (!t.active) orders.filter(x => x.templateId === t.id && x.date > dayPlus(0) && x.auto && x.status === 'Новая').forEach(x => orders.splice(orders.indexOf(x), 1)); else generateOrders(); log('Расписание', `${t.id}: ${t.active ? 'включено' : 'на паузе'}`); showTemplates(); renderOrders(); }
    if (act.dataset.act === 'del' && e.type === 'click'){
      if (act.dataset.c !== '1'){ act.dataset.c = '1'; act.textContent = 'Точно?'; return; }
      orders.filter(x => x.templateId === t.id && x.date > dayPlus(0) && x.auto && x.status === 'Новая').forEach(x => orders.splice(orders.indexOf(x), 1));
      orders.forEach(x => { if (x.templateId === t.id) x.templateId = null; });
      templates.splice(templates.indexOf(t), 1); log('Расписание', 'Серия удалена'); showTemplates(); renderOrders();
    }
  };
}

/* ---------- клиенты ---------- */
let kSort = { k: 'name', dir: 1 };
const K_COLS = [
  { k: 'name', t: 'Клиент', v: c => c.name, f: c => `<div class="cell-name"><div class="avatar ${avClass(c.id)}">${esc(c.name.replace(/^(ООО|АО|ИП|ПАО)\s*«?/, '').slice(0, 2).toUpperCase())}</div><div><b>${esc(c.name)}</b><small>${c.inn ? 'ИНН ' + c.inn : 'ИНН не указан'}</small></div></div>` },
  { k: 'contact', t: 'Контакт', v: c => c.contact, f: c => `${esc(c.contact || '—')}<div class="muted mono">${esc(c.phone || '')}</div>` },
  { k: 'addr', t: 'Адреса', v: c => c.addresses.length, f: c => `${c.addresses.length} ${c.addresses.length === 1 ? 'адрес' : 'адреса'}<div class="muted">${esc(c.addresses[0] || '')}</div>` },
  { k: 'orders', t: 'Заявок', v: c => orders.filter(o => o.clientId === c.id).length, f: c => `<span class="mono">${orders.filter(o => o.clientId === c.id).length}</span>` },
  { k: 'rep', t: 'По расписанию', v: c => templates.filter(t => t.clientId === c.id && t.active).length, f: c => { const n = templates.filter(t => t.clientId === c.id && t.active); return n.length ? n.map(t => `<span class="pill violet">↻ ${repeatText(t)}</span>`).join(' ') : '<span class="muted">—</span>'; } },
];
function renderClients(){
  const q = $('#kSearch').value.trim().toLowerCase();
  const rows = clients.filter(c => !q || [c.name, c.inn, c.contact, c.phone, c.email].join(' ').toLowerCase().includes(q)).sort(sorter(kSort, K_COLS));
  makeTable($('#kTable'), K_COLS, rows, kSort, k => { kSort = { k, dir: kSort.k === k ? -kSort.dir : 1 }; renderClients(); });
  $('#navClients').textContent = clients.length;
}
$('#kSearch').addEventListener('input', renderClients);
$('#kTable').addEventListener('click', e => { const tr = e.target.closest('tbody tr[data-id]'); if (tr) editClient(tr.dataset.id); });
$('#kAdd').onclick = () => editClient(null);
function editClient(id){
  const isNew = !id; const c = isNew ? { id: 'k' + (seq.client + 1), name: '', inn: '', contact: '', phone: '', email: '', addresses: [], note: '' } : clientById(id);
  const co = orders.filter(o => o.clientId === c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 5);
  modal(`<div class="mb-h"><b>${isNew ? 'Новый клиент' : esc(c.name)}</b><button class="x" data-close>×</button></div>
  <div class="mb-b">
    ${fld('Название', `<input id="cfName" value="${esc(c.name)}" placeholder="ООО «Пример»">`, true)}
    ${fld('ИНН', `<input id="cfInn" value="${esc(c.inn)}" inputmode="numeric">`)}
    ${fld('Контактное лицо', `<input id="cfContact" value="${esc(c.contact)}">`)}
    ${fld('Телефон', `<input id="cfPhone" value="${esc(c.phone)}" inputmode="tel">`)}
    ${fld('E-mail', `<input id="cfEmail" value="${esc(c.email)}" inputmode="email">`)}
    ${fld('Адреса (по одному в строке)', `<textarea id="cfAddr" rows="4">${esc(c.addresses.join('\n'))}</textarea>`, true)}
    ${fld('Заметка', `<input id="cfNote" value="${esc(c.note)}">`, true)}
    ${isNew ? '' : `<div class="full"><label class="rep-l">Последние заявки</label>${co.map(o => `<div class="kv mini-order" data-o="${o.id}"><span>${o.no} · ${dayLabel(o.date)} ${o.time}</span><b><span class="pill ${ST_CLS[o.status]}">${o.status}</span></b></div>`).join('') || '<span class="muted">Пока нет</span>'}</div>`}
  </div>
  <div class="mb-f wrap">${!isNew && !orders.some(o => o.clientId === c.id) ? '<button class="btn danger left" id="cfDel">Удалить</button>' : ''}${isNew ? '' : '<button class="btn ghost" id="cfOrder">+ Заявка для клиента</button>'}<button class="btn primary" id="cfSave">${isNew ? 'Добавить' : 'Сохранить'}</button></div>`);
  const save = () => {
    const name = $('#cfName').value.trim(); if (!name){ $('#cfName').focus(); return false; }
    Object.assign(c, { name, inn: $('#cfInn').value.trim(), contact: $('#cfContact').value.trim(), phone: $('#cfPhone').value.trim(), email: $('#cfEmail').value.trim(),
      addresses: $('#cfAddr').value.split('\n').map(s => s.trim()).filter(Boolean), note: $('#cfNote').value.trim() });
    if (isNew){ seq.client++; c.id = 'k' + seq.client; clients.push(c); log('Новый клиент', name); } else log('Изменение клиента', name);
    return true;
  };
  $('#cfSave').onclick = () => { if (!save()) return; closeModal(); renderClients(); toast('Сохранено', c.name); };
  if ($('#cfOrder')) $('#cfOrder').onclick = () => { if (!save()) return; closeModal(); editOrder(null, { clientId: c.id, from: c.addresses[0] || '', to: c.addresses[1] || '' }); };
  if ($('#cfDel')) $('#cfDel').onclick = e => { const b = e.target; if (b.dataset.c !== '1'){ b.dataset.c = '1'; b.textContent = 'Точно удалить?'; return; } clients.splice(clients.indexOf(c), 1); log('Удаление клиента', c.name); closeModal(); renderClients(); };
  $$('.mini-order').forEach(el => el.onclick = () => { closeModal(); editOrder(el.dataset.o); });
}

/* =====================================================================
   ДОКУМЕНТЫ ВОДИТЕЛЕЙ И ТС
   ===================================================================== */
const DOC_KINDS = {
  d: ['Паспорт', 'Водительское удостоверение', 'Медицинская справка', 'Карта водителя (тахограф)', 'СНИЛС', 'ИНН', 'Трудовой договор', 'Другое'],
  v: ['СТС', 'ПТС', 'ОСАГО', 'Диагностическая карта (техосмотр)', 'Калибровка тахографа', 'Пропуск в центр', 'Договор аренды / лизинга', 'Другое'],
};
const DOC_SHORT = { 'Водительское удостоверение': 'ВУ', 'Медицинская справка': 'Медсправка', 'Карта водителя (тахограф)': 'Карта водителя', 'Диагностическая карта (техосмотр)': 'Техосмотр', 'Калибровка тахографа': 'Тахограф' };
const SENSITIVE = ['Паспорт', 'СНИЛС', 'ИНН'];
const docs = [];
function mkDoc(owner, kind, number, issued, expires, note){ seq.doc++; return { id: 'x' + seq.doc, owner, kind, number: number || '', issued: issued || '', expires: expires || '', note: note || '', files: [] }; }
drivers.forEach((d, i) => {
  docs.push(mkDoc(d.id, 'Паспорт', `45 ${pad(10 + i)} ${String(512304 + i * 7331).slice(0, 6)}`, dplus(-2400 - i * 90), ''));
  docs.push(mkDoc(d.id, 'Водительское удостоверение', `99 ${pad(20 + i)} ${String(381200 + i * 4211).slice(0, 6)}`, dplus(-1800 + i * 40), d.license, 'Кат. ' + d.cats));
  docs.push(mkDoc(d.id, 'Медицинская справка', `№ ${3400 + i * 17}`, dplus(-200), d.med));
  if (/CE/.test(d.cats) || i % 3 === 0) docs.push(mkDoc(d.id, 'Карта водителя (тахограф)', `RUD0000${String(48213 + i * 97)}`, dplus(-700), dplus([400, 28, 900, 610, 15, 300][i % 6])));
});
vehicles.forEach((v, i) => {
  docs.push(mkDoc(v.id, 'СТС', `99 ${pad(30 + i)} ${String(774120 + i * 3119).slice(0, 6)}`, dplus(-900 - i * 30), ''));
  docs.push(mkDoc(v.id, 'ОСАГО', `ХХХ ${String(301228000 + i * 7771).slice(0, 10)}`, dplus(-300 + i * 9), dplus([65, 20, 210, 340, -4, 120, 180, 9, 260, 300, 45, 150, 90, 230][i % 14])));
  docs.push(mkDoc(v.id, 'Диагностическая карта (техосмотр)', `${String(51190 + i * 113)}02242${pad(i)}`, dplus(-200), dplus([160, 300, 25, 210, 90, -12, 330, 140, 60, 280, 12, 200, 110, 70][i % 14])));
  if (v.type === 'Фура') docs.push(mkDoc(v.id, 'Калибровка тахографа', `К-${4410 + i}`, dplus(-500), dplus([300, 600, 18, 400][i % 4])));
});
const docsOf = owner => docs.filter(x => x.owner === owner);
const ownerName = o => o && o.startsWith('d') ? (drvById(o) ? shortName(drvById(o).name) : '—') : (vehById(o) ? vehById(o).plate + ' ' + vehById(o).reg : '—');
function docStatus(x){
  if (!x.expires) return { cls: 'off', txt: 'бессрочно', n: 99999 };
  const n = daysTo(x.expires);
  if (n < 0) return { cls: 'red', txt: 'просрочен', n };
  if (n <= 30) return { cls: 'amber', txt: n + ' дн.', n };
  return { cls: 'move', txt: 'до ' + fmtDate(x.expires), n };
}
function docNumber(x, forDriver){
  if (!x.number) return '—';
  if (!SENSITIVE.includes(x.kind) || role === 'admin' || forDriver) return x.number;
  return '•••• ' + x.number.replace(/\s/g, '').slice(-4);
}
function docsCell(owner){
  const l = docsOf(owner).filter(x => x.expires).sort((a, b) => daysTo(a.expires) - daysTo(b.expires)).slice(0, 2);
  return l.map(x => docHtml(DOC_SHORT[x.kind] || x.kind, x.expires)).join('<br>') || '<span class="muted">—</span>';
}
function docAlerts(){ return docs.filter(x => x.expires && daysTo(x.expires) <= 30).length; }
function updateDocBadge(){ const n = docAlerts(), b = $('#navDocs'); b.hidden = !n; b.textContent = n; b.title = 'Просрочены или истекают в течение 30 дней'; }
function syncDriverDates(owner){
  const d = drvById(owner); if (!d) return;
  const lic = docsOf(owner).find(x => x.kind === 'Водительское удостоверение' && x.expires), med = docsOf(owner).find(x => x.kind === 'Медицинская справка' && x.expires);
  if (lic) d.license = lic.expires; if (med) d.med = med.expires;
}

/* таблица документов */
let xSort = { k: 'exp', dir: 1 }, xFilter = 'all';
const X_COLS = [
  { k: 'kind', t: 'Документ', v: x => x.kind, f: x => `<b style="font-weight:600">${esc(x.kind)}</b><div class="muted mono">${esc(docNumber(x))}</div>` },
  { k: 'owner', t: 'Владелец', v: x => ownerName(x.owner), f: x => x.owner.startsWith('v') && vehById(x.owner) ? plateHtml(vehById(x.owner)) : esc(ownerName(x.owner)) },
  { k: 'exp', t: 'Действует до', v: x => docStatus(x).n, f: x => { const s = docStatus(x); return `<span class="pill ${s.cls}">${x.expires && s.cls !== 'move' ? fmtDate(x.expires) + ' · ' : ''}${s.txt}</span>`; } },
  { k: 'files', t: 'Сканы', v: x => x.files.length, f: x => x.files.length ? `<span class="files-mini" data-files="${x.id}">${x.files.length} 📎</span>` : '<span class="pill amber">нет скана</span>' },
  { k: 'note', t: 'Заметка', v: x => x.note, f: x => `<span class="muted">${esc(x.note || '')}</span>` },
];
function renderDocs(){
  const q = $('#xSearch').value.trim().toLowerCase(), ow = $('#xOwner').value;
  const ok = x => xFilter === 'all' || (xFilter === 'soon' ? x.expires && daysTo(x.expires) >= 0 && daysTo(x.expires) <= 30 : xFilter === 'bad' ? x.expires && daysTo(x.expires) < 0 : !x.files.length);
  const rows = docs.filter(x => ok(x) && (!ow || x.owner[0] === ow) && (!q || [x.kind, x.number, ownerName(x.owner), x.note].join(' ').toLowerCase().includes(q))).sort(sorter(xSort, X_COLS));
  makeTable($('#xTable'), X_COLS, rows, xSort, k => { xSort = { k, dir: xSort.k === k ? -xSort.dir : 1 }; renderDocs(); });
  if (!rows.length) $('#xTable tbody').innerHTML = '<tr><td colspan="6" class="empty-row">Ничего не найдено</td></tr>';
  updateDocBadge();
}
$('#xSearch').addEventListener('input', renderDocs); $('#xOwner').addEventListener('change', renderDocs);
$('#xFilter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; xFilter = b.dataset.f; $$('#xFilter button').forEach(x => x.classList.toggle('on', x === b)); renderDocs(); });
$('#xTable').addEventListener('click', e => { const tr = e.target.closest('tbody tr[data-id]'); if (tr) openDoc(tr.dataset.id); });
$('#xAdd').onclick = () => openDoc(null);

/* карточка документа */
function openDoc(id, owner, back){
  const isNew = !id;
  const x = isNew ? mkDocDraft(owner) : docs.find(d => d.id === id);
  const fixedOwner = !!owner || !isNew;
  const lock = !isNew && SENSITIVE.includes(x.kind) && role !== 'admin' && !driverMode;
  const kinds = DOC_KINDS[(x.owner || 'd')[0]];
  modal(`<div class="mb-h"><b>${isNew ? 'Новый документ' : esc(x.kind)}</b><span class="muted">${esc(ownerName(x.owner))}</span><button class="x" data-close>×</button></div>
  <div class="mb-b">
    ${fixedOwner ? '' : fld('Чей документ', `<select id="dfOwner"><optgroup label="Водители">${drivers.map(d => opt(d.id, x.owner, d.name)).join('')}</optgroup><optgroup label="Транспорт">${vehicles.map(v => opt(v.id, x.owner, v.plate + ' ' + v.reg + ' · ' + v.model)).join('')}</optgroup></select>`, true)}
    ${fld('Тип документа', `<select id="dfKind">${kinds.map(k => opt(k, x.kind)).join('')}</select>`, true)}
    ${fld('Серия и номер', `<input id="dfNum" value="${esc(lock ? docNumber(x) : x.number)}" ${lock ? 'disabled title="Полный номер видит администратор"' : ''}>`)}
    ${fld('Дата выдачи', `<input type="date" id="dfIss" value="${x.issued}">`)}
    ${fld('Действует до', `<input type="date" id="dfExp" value="${x.expires}"><small class="muted">пусто — бессрочный</small>`)}
    ${fld('Заметка', `<input id="dfNote" value="${esc(x.note)}">`)}
    <div class="full"><label class="rep-l">Фото и сканы</label><div class="files" id="dfFiles"></div>
      <div class="df-add"><button type="button" class="btn primary" id="dfScan">📷 Сканировать и распознать</button><label class="btn ghost addfile">+ Фото из галереи или PDF<input type="file" id="dfInput" accept="image/*,application/pdf" multiple hidden></label></div>
      <div class="muted df-ocr" id="dfOcr"${x.ocr ? '' : ' hidden'}>Распознанный текст: ${esc((x.ocr || '').slice(0, 220))}${(x.ocr || '').length > 220 ? '…' : ''}</div></div>
    <div class="mb-note full">🔒 В демо файлы хранятся только на этом устройстве. В рабочей версии — на защищённом сервере в России (по закону 152-ФЗ о персональных данных), доступ по ролям, все просмотры пишутся в журнал.</div>
  </div>
  <div class="mb-f">${!isNew && (role === 'admin' || !SENSITIVE.includes(x.kind)) ? '<button class="btn danger left" id="dfDel">Удалить</button>' : ''}<button class="btn ghost" id="dfCancel">Отмена</button><button class="btn primary" id="dfSave">${isNew ? 'Добавить' : 'Сохранить'}</button></div>`);
  const files = x.files.slice();
  const drawFiles = async () => {
    const box = $('#dfFiles'); if (!box) return;
    box.innerHTML = files.map((f, i) => `<div class="thumb" data-i="${i}">${/pdf/.test(f.type) ? '<div class="pdf">PDF</div>' : '<img alt="">'}<span>${esc(f.name)}</span><button class="rm" data-rm="${i}" title="Удалить">×</button></div>`).join('') || '<div class="muted">Сканов пока нет</div>';
    for (let i = 0; i < files.length; i++){ if (/pdf/.test(files[i].type)) continue; const u = await fileUrl(files[i].id).catch(() => null); const im = box.querySelector(`.thumb[data-i="${i}"] img`); if (im && u) im.src = u; }
  };
  drawFiles();
  if ($('#dfOwner')) $('#dfOwner').onchange = e => { const k = DOC_KINDS[e.target.value[0]]; $('#dfKind').innerHTML = k.map(v => opt(v, $('#dfKind').value)).join(''); };
  $('#dfInput').onchange = async e => {
    const sv = $('#dfSave'), label = sv.textContent; sv.disabled = true; sv.textContent = 'Загрузка фото…';
    for (const f of [...e.target.files]){
      try {
        const blob = await shrinkImage(f), fid = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
        await idbPut({ id: fid, name: f.name, type: blob.type || f.type, blob });
        files.push({ id: fid, name: f.name || 'фото.jpg', type: blob.type || f.type });
      } catch (err) { toast('Не удалось сохранить файл', String(err && err.message || err)); }
    }
    e.target.value = ''; sv.disabled = false; sv.textContent = label; drawFiles();
  };
  $('#dfScan').onclick = () => openScanner({ title: 'Скан документа: ' + $('#dfKind').value, onDoc: async ({ blob, text, fields }) => {
    const fid = 'f' + Date.now(); await idbPut({ id: fid, name: 'скан.jpg', type: 'image/jpeg', blob });
    files.push({ id: fid, name: 'скан.jpg', type: 'image/jpeg' }); drawFiles();
    const b = bestFor($('#dfKind').value, fields), filled = [];
    if (b.number && !$('#dfNum').value && !$('#dfNum').disabled){ $('#dfNum').value = b.number; filled.push('номер'); }
    if (b.issued && !$('#dfIss').value){ $('#dfIss').value = b.issued; filled.push('дата выдачи'); }
    if (b.expires && !$('#dfExp').value){ $('#dfExp').value = b.expires; filled.push('срок'); }
    x._ocr = text; if (text){ $('#dfOcr').hidden = false; $('#dfOcr').textContent = 'Распознанный текст: ' + text.slice(0, 220); }
    toast('Скан добавлен', filled.length ? 'Заполнено автоматически: ' + filled.join(', ') + '. Проверьте!' : 'Проверьте поля документа');
  } });
  $('#dfFiles').onclick = async e => {
    const rm = e.target.closest('[data-rm]');
    if (rm){ const f = files.splice(+rm.dataset.rm, 1)[0]; if (f && !x.files.some(z => z.id === f.id)) idbDel(f.id).catch(() => {}); drawFiles(); return; }
    const th = e.target.closest('.thumb'); if (th) viewFile(files[+th.dataset.i]);
  };
  const done = () => { closeModal(); if (back) back(); else { if (cur === 'docs') renderDocs(); if (cur === 'drivers') renderDrivers(); if (cur === 'vehicles') renderVehicles(); if (phoneOpen) renderPhone(); } };
  $('#dfCancel').onclick = () => { files.filter(f => !x.files.some(z => z.id === f.id)).forEach(f => idbDel(f.id).catch(() => {})); done(); };
  $('#dfSave').onclick = () => {
    if ($('#dfOwner')) x.owner = $('#dfOwner').value;
    x.kind = $('#dfKind').value; if (!$('#dfNum').disabled) x.number = $('#dfNum').value.trim();
    x.issued = $('#dfIss').value; x.expires = $('#dfExp').value; x.note = $('#dfNote').value.trim();
    if (x._ocr){ x.ocr = x._ocr.slice(0, 4000); delete x._ocr; }
    x.files.filter(f => !files.some(z => z.id === f.id)).forEach(f => idbDel(f.id).catch(() => {}));
    x.files = files;
    if (isNew){ seq.doc++; x.id = 'x' + seq.doc; docs.push(x); }
    syncDriverDates(x.owner);
    log(isNew ? 'Новый документ' : 'Изменение документа', `${ownerName(x.owner)}: ${x.kind}${files.length ? ' · сканов ' + files.length : ''}`);
    toast('Документ сохранён', `${x.kind} · ${ownerName(x.owner)}`);
    done();
  };
  const del = $('#dfDel');
  if (del) del.onclick = () => {
    if (del.dataset.c !== '1'){ del.dataset.c = '1'; del.textContent = 'Точно удалить?'; return; }
    x.files.forEach(f => idbDel(f.id).catch(() => {})); docs.splice(docs.indexOf(x), 1);
    log('Удаление документа', `${ownerName(x.owner)}: ${x.kind}`); done();
  };
}
function mkDocDraft(owner){ owner = owner || drivers[0].id; return { id: null, owner, kind: DOC_KINDS[owner[0]][0], number: '', issued: '', expires: '', note: '', files: [] }; }
async function viewFile(f){
  if (!f) return; const u = await fileUrl(f.id).catch(() => null); if (!u) return toast('Файл не найден', 'Возможно, данные устройства были очищены');
  const v = $('#viewer'); v.hidden = false;
  v.innerHTML = `<div class="vw-top"><span>${esc(f.name)}</span><button class="x" data-vclose>×</button></div>${/pdf/.test(f.type) ? `<iframe src="${u}"></iframe>` : `<img src="${u}" alt="">`}`;
}
$('#viewer').addEventListener('click', e => { if (e.target.closest('[data-vclose]') || e.target.id === 'viewer') $('#viewer').hidden = true; });
function docsSectionHtml(owner){
  return `<div class="full"><label class="rep-l">Документы</label><div class="doc-chips">${docsOf(owner).map(x => { const s = docStatus(x); return `<button type="button" class="doc-chip ${s.cls}" data-doc="${x.id}"><b>${esc(DOC_SHORT[x.kind] || x.kind)}</b><span>${s.txt}${x.files.length ? ' · 📎' + x.files.length : ''}</span></button>`; }).join('')}
    <button type="button" class="doc-chip add" data-doc-new="${owner}">+ документ</button></div></div>`;
}
function bindDocsSection(reopen){
  $$('#modalBox [data-doc]').forEach(b => b.onclick = () => openDoc(b.dataset.doc, null, reopen));
  $$('#modalBox [data-doc-new]').forEach(b => b.onclick = () => openDoc(null, b.dataset.docNew, reopen));
}

/* ---------- меню «Ещё» на телефоне ---------- */
$('#navMore').addEventListener('click', e => { e.preventDefault(); $('#moreSheet').hidden = false; });
$('#moreSheet').addEventListener('click', e => {
  if (e.target.id === 'moreSheet' || e.target.closest('a')) $('#moreSheet').hidden = true;
  if (e.target.closest('#msRole')){ $('#moreSheet').hidden = true; const s = $('#roleSelect'); s.value = role === 'admin' ? 'dispatcher' : 'admin'; s.dispatchEvent(new Event('change')); }
});
$('#resetDemo').onclick = () => { const b = $('#resetDemo'); if (b.dataset.c !== '1'){ b.dataset.c = '1'; b.textContent = 'Нажмите ещё раз: удалить все изменения?'; return; } resetDemo(); };

listeners.add(() => scheduleSave());

/* =====================================================================
   СКАНЕР ДОКУМЕНТОВ + РАСПОЗНАВАНИЕ ТЕКСТА
   Всё на устройстве: камера → обрезка по углам → фильтр «документ» → Tesseract (rus+eng).
   ===================================================================== */
const userTpls = [];   // шаблоны сообщений, сохранённые из сканера
function allTpls(){ return [...TEMPLATES, ...userTpls.map(t => ['📄 ' + t.name, t.text])]; }

const scan = { stream: null, src: null, corners: null, filter: 'doc', outCanvas: null, outBlob: null, text: '', fields: [], opts: {}, busy: false };
let ocrWorkerP = null;
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('не загрузился ' + src)); document.head.appendChild(s); }); }
function ocrWorker(){
  if (!ocrWorkerP) ocrWorkerP = (async () => {
    if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
    const base = new URL('ocr/', location.href).href;
    return Tesseract.createWorker(['rus', 'eng'], 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false,
      logger: m => scan.onProgress && scan.onProgress(m),
    });
  })().catch(e => { ocrWorkerP = null; throw e; });
  return ocrWorkerP;
}

/* ---------- окно сканера ---------- */
function openScanner(opts){
  Object.assign(scan, { opts: opts || {}, src: null, corners: null, filter: 'doc', outCanvas: null, outBlob: null, text: '', fields: [] });
  $('#scanner').hidden = false; document.body.classList.add('scan-open');
  stepCamera();
}
function closeScanner(){ stopCam(); $('#scanner').hidden = true; document.body.classList.remove('scan-open'); scan.onProgress = null; }
function stopCam(){ if (scan.stream){ scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; } }
const scTop = sub => `<div class="sc-top"><button class="sc-x" data-sc="close" title="Закрыть">×</button><div><b>Сканер</b><span>${esc(sub)}</span></div><i></i></div>`;

function stepCamera(){
  const S = $('#scanner');
  S.innerHTML = scTop(scan.opts.title || 'Наведите камеру на документ') + `
    <div class="sc-stage cam"><video id="scVideo" playsinline muted autoplay></video><div class="sc-frame"><i></i><i></i><i></i><i></i></div><div class="sc-msg" id="scMsg">Включаем камеру…</div></div>
    <div class="sc-bottom">
      <label class="sc-side">${'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M5 17l4.5-4.5 3 3L15 13l4 4"/></svg>'}<span>Галерея</span><input type="file" id="scFile" accept="image/*" hidden></label>
      <button class="sc-shot" id="scShot" title="Сфотографировать" disabled><i></i></button>
      <span class="sc-side tip">Держите ровно,<br>при хорошем свете</span>
    </div>`;
  $('#scFile').onchange = e => { const f = e.target.files[0]; if (f) loadImageFile(f); };
  startCam();
}
async function startCam(){
  const msg = $('#scMsg'), v = $('#scVideo');
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('нет доступа к камере в этом окне');
    scan.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
    if ($('#scanner').hidden || !v.isConnected){ stopCam(); return; }
    v.srcObject = scan.stream; await v.play().catch(() => {});
    msg.hidden = true; $('#scShot').disabled = false;
    $('#scShot').onclick = () => {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0); stopCam(); stepCrop(c);
    };
  } catch (e) {
    msg.innerHTML = `Камера недоступна (${esc(e.message || e.name || 'нет разрешения')}).<br>Выберите фото из галереи.`;
    $('#scShot').hidden = true;
  }
}
function loadImageFile(f){
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {
    const k = Math.min(1, 2400 / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); stopCam(); stepCrop(c);
  };
  im.onerror = () => toast('Не удалось открыть фото', f.name);
  im.src = url;
}

/* ---------- шаг 2: углы документа ---------- */
function defaultCorners(c){ const w = c.width, h = c.height, m = .06; return [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]]; }
function stepCrop(canvas){
  scan.src = canvas; scan.corners = detectCorners(canvas) || defaultCorners(canvas);
  const S = $('#scanner'), W = canvas.width, H = canvas.height;
  S.innerHTML = scTop('Подвиньте углы к краям документа') + `
    <div class="sc-stage crop"><div class="sc-fit" id="scFit" style="aspect-ratio:${W}/${H}">
      <canvas id="scCanvas"></canvas>
      <svg id="scSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon id="scPoly"/>${[0, 1, 2, 3].map(i => `<circle data-k="${i}" r="${Math.max(W, H) * .028}"/>`).join('')}</svg>
    </div></div>
    <div class="sc-bottom actions">
      <button class="sc-btn" data-sc="retake">Переснять</button>
      <button class="sc-btn" data-sc="rotate">Повернуть ⟳</button>
      <button class="sc-btn" data-sc="full">Весь кадр</button>
      <button class="sc-btn primary" data-sc="warp">Готово →</button>
    </div>`;
  const cv = $('#scCanvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(canvas, 0, 0);
  const fit = () => { const st = $('#scanner .sc-stage.crop'), box = $('#scFit'); if (!st || !box) return;
    const aw = st.clientWidth - 24, ah = st.clientHeight - 24, k = Math.min(aw / W, ah / H);
    box.style.width = Math.floor(W * k) + 'px'; box.style.height = Math.floor(H * k) + 'px'; };
  fit(); requestAnimationFrame(fit); window.onresize = fit;
  drawCorners();
  const svg = $('#scSvg'); let drag = null;
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(0, Math.min(W, q.x)), Math.max(0, Math.min(H, q.y))]; };
  svg.onpointerdown = e => {
    const c = e.target.closest('circle');
    if (c) drag = +c.dataset.k;
    else { const p = pt(e); let best = 0, bd = 1e18; scan.corners.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd){ bd = d; best = i; } }); drag = best; scan.corners[drag] = p; drawCorners(); }
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  };
  svg.onpointermove = e => { if (drag === null) return; scan.corners[drag] = pt(e); drawCorners(); };
  svg.onpointerup = svg.onpointercancel = () => { drag = null; };
}
function drawCorners(){
  $('#scPoly').setAttribute('points', scan.corners.map(p => p.join(',')).join(' '));
  $$('#scSvg circle').forEach((c, i) => { c.setAttribute('cx', scan.corners[i][0]); c.setAttribute('cy', scan.corners[i][1]); });
}
function rotateCanvas(c){ const r = document.createElement('canvas'); r.width = c.height; r.height = c.width; const g = r.getContext('2d'); g.translate(r.width, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0); return r; }

/* простой поиск листа бумаги: самая яркая крупная область на уменьшенной копии */
function detectCorners(c){
  try {
    const k = 160 / Math.max(c.width, c.height), w = Math.max(8, Math.round(c.width * k)), h = Math.max(8, Math.round(c.height * k));
    const t = document.createElement('canvas'); t.width = w; t.height = h; const g = t.getContext('2d'); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); let sum = 0;
    for (let i = 0; i < w * h; i++){ L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; sum += L[i]; }
    const sorted = Array.from(L).sort((a, b) => a - b), thr = Math.max(sum / (w * h), sorted[Math.floor(w * h * .5)]) + 12;
    // крайние точки по диагоналям среди «светлых» пикселей
    let tl = null, tr = null, br = null, bl = null, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      if (L[y * w + x] < thr) continue; n++;
      if (!tl || x + y < tl[0] + tl[1]) tl = [x, y];
      if (!br || x + y > br[0] + br[1]) br = [x, y];
      if (!tr || x - y > tr[0] - tr[1]) tr = [x, y];
      if (!bl || y - x > bl[1] - bl[0]) bl = [x, y];
    }
    if (n < w * h * .12 || n > w * h * .97) return null;
    const area = Math.abs((tl[0] * tr[1] - tr[0] * tl[1]) + (tr[0] * br[1] - br[0] * tr[1]) + (br[0] * bl[1] - bl[0] * br[1]) + (bl[0] * tl[1] - tl[0] * bl[1])) / 2;
    if (area < w * h * .15) return null;
    return [tl, tr, br, bl].map(p => [p[0] / k, p[1] / k]);
  } catch (e) { return null; }
}

/* ---------- перспектива ---------- */
function solve(A, b){
  const n = b.length;
  for (let i = 0; i < n; i++){
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < n; r++){ const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n); for (let i = n - 1; i >= 0; i--){ let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x;
}
function homography(from, to){
  const A = [], b = [];
  for (let i = 0; i < 4; i++){
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return solve(A, b).concat(1);
}
function warp(src, q){
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, 1800 / Math.max(W, H)); W = Math.max(40, Math.round(W * k)); H = Math.max(40, Math.round(H * k));
  const h = homography([[0, 0], [W, 0], [W, H], [0, H]], q);
  const sw = src.width, sh = src.height, sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d'), od = og.createImageData(W, H), o = od.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const z = h[6] * x + h[7] * y + 1, u = (h[0] * x + h[1] * y + h[2]) / z, v = (h[3] * x + h[4] * y + h[5]) / z;
    const x0 = Math.floor(u), y0 = Math.floor(v), i = (y * W + x) * 4;
    if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1){ o[i] = o[i + 1] = o[i + 2] = 255; o[i + 3] = 255; continue; }
    const fx = u - x0, fy = v - y0, a = (y0 * sw + x0) * 4, bq = a + 4, c = a + sw * 4, dq = c + 4;
    for (let ch = 0; ch < 3; ch++) o[i + ch] = (sd[a + ch] * (1 - fx) + sd[bq + ch] * fx) * (1 - fy) + (sd[c + ch] * (1 - fx) + sd[dq + ch] * fx) * fy;
    o[i + 3] = 255;
  }
  og.putImageData(od, 0, 0); return out;
}
/* фильтры: «Документ» убирает тени и выравнивает фон, «Ч/Б» — контраст, «Оригинал» — как есть */
function applyFilter(c, kind){
  const W = c.width, H = c.height, out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'); g.drawImage(c, 0, 0); if (kind === 'orig') return out;
  const im = g.getImageData(0, 0, W, H), d = im.data, n = W * H, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  if (kind === 'doc'){
    const I = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++){ let row = 0; for (let x = 0; x < W; x++){ row += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    const r = Math.max(8, Math.round(Math.max(W, H) / 24));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const x1 = Math.max(0, x - r), y1 = Math.max(0, y - r), x2 = Math.min(W, x + r + 1), y2 = Math.min(H, y + r + 1);
      const mean = (I[y2 * (W + 1) + x2] - I[y1 * (W + 1) + x2] - I[y2 * (W + 1) + x1] + I[y1 * (W + 1) + x1]) / ((x2 - x1) * (y2 - y1));
      L[y * W + x] = Math.min(255, L[y * W + x] / Math.max(30, mean) * 245);
    }
  }
  const hist = new Uint32Array(256); L.forEach(v => hist[v | 0]++);
  let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++){ acc += hist[i]; if (acc > n * .01){ lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--){ acc += hist[i]; if (acc > n * .01){ hi = i; break; } }
  const sc = 255 / Math.max(20, hi - lo);
  for (let i = 0; i < n; i++){ let v = (L[i] - lo) * sc; if (kind === 'doc') v = v > 200 ? 255 : v * .9; v = Math.max(0, Math.min(255, v)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
  g.putImageData(im, 0, 0); return out;
}

/* ---------- шаг 3: результат и распознавание ---------- */
function stepResult(){
  const S = $('#scanner');
  S.innerHTML = scTop('Готово. Распознаём текст…') + `
    <div class="sc-res">
      <div class="sc-img"><img id="scOut" alt="скан"><div class="seg sc-filters" id="scFilt"><button data-f="doc" class="on">Документ</button><button data-f="bw">Ч/Б</button><button data-f="orig">Оригинал</button></div></div>
      <div class="sc-panel">
        <div class="sc-prog" id="scProg"><b>Распознаём текст</b><span id="scProgT">загружаем модель…</span><div class="bar"><i id="scBar" style="width:4%"></i></div></div>
        <div id="scText" hidden>
          <div class="sc-fields" id="scFields"></div>
          <textarea id="scTa" rows="8" spellcheck="false" placeholder="Текст не найден. Попробуйте снять ближе и при хорошем свете."></textarea>
          <div class="sc-acts" id="scActs"></div>
          <div class="sc-form" id="scForm" hidden></div>
        </div>
      </div>
    </div>`;
  renderOut(); runOcr();
  $('#scFilt').onclick = e => { const b = e.target.closest('button'); if (!b || scan.busy) return; scan.filter = b.dataset.f; $$('#scFilt button').forEach(x => x.classList.toggle('on', x === b)); renderOut(); runOcr(); };
}
function renderOut(){
  const c = applyFilter(scan.warped, scan.filter); scan.outCanvas = c;
  $('#scOut').src = c.toDataURL('image/jpeg', .85);
  c.toBlob(b => { scan.outBlob = b; }, 'image/jpeg', .85);
}
async function runOcr(){
  scan.busy = true; $('#scProg').hidden = false; $('#scText').hidden = true;
  const set = (p, t) => { const b = $('#scBar'), tt = $('#scProgT'); if (b) b.style.width = Math.max(4, Math.round(p * 100)) + '%'; if (tt && t) tt.textContent = t; };
  scan.onProgress = m => {
    const st = { 'loading tesseract core': 'загружаем движок…', 'initializing tesseract': 'запускаем…', 'loading language traineddata': 'загружаем словарь (русский + английский)…', 'initializing api': 'готовим распознавание…', 'recognizing text': 'читаем текст…' }[m.status];
    if (m.status === 'recognizing text') set(.3 + m.progress * .7, st); else set(Math.min(.3, (m.progress || 0) * .3), st);
  };
  try {
    const w = await ocrWorker();
    const ocrCanvas = scan.filter === 'orig' ? applyFilter(scan.warped, 'bw') : scan.outCanvas;
    const { data } = await w.recognize(ocrCanvas);
    scan.text = cleanOcr(data.text || '');
    scan.conf = Math.round(data.confidence || 0);
  } catch (e) {
    scan.text = ''; scan.conf = 0;
    toast('Распознавание не запустилось', isApp ? String(e.message || e) : 'Откройте через Android-приложение или локальный сервер');
  }
  scan.busy = false;
  scan.fields = extractFields(scan.text);
  if (!$('#scProg')) return;
  $('#scProg').hidden = true; $('#scText').hidden = false;
  $('.sc-top span').textContent = scan.text ? `Распознано: ${scan.text.split(/\s+/).filter(Boolean).length} слов · точность ≈${scan.conf}%` : 'Текст не найден';
  $('#scTa').value = scan.text;
  renderFields(); renderActs();
}
function cleanOcr(t){ return t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[|]/g, 'I').trim(); }

/* поиск полезных значений в тексте */
const CYR = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
function extractFields(t){
  const out = [], seen = new Set(), add = (type, label, value, extra) => { const k = type + value; if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ type, label, value }, extra || {})); };
  const T = t.replace(/\n/g, ' ');
  for (const m of T.matchAll(/\b(0?[1-9]|[12]\d|3[01])[.\/-](0?[1-9]|1[0-2])[.\/-]((?:19|20)\d{2})\b/g)){
    const iso = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`; add('date', 'Дата', `${pad(+m[1])}.${pad(+m[2])}.${m[3]}`, { iso });
  }
  for (const m of T.matchAll(/(?<![\dА-ЯA-Z])([АВЕКМНОРСТУХABEKMHOPCTYX])\s?(\d{3})\s?([АВЕКМНОРСТУХABEKMHOPCTYX]{2})\s?(\d{2,3})(?![\d])/gi)){
    const p = (m[1] + m[2] + m[3]).toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => CYR[c]); add('plate', 'Госномер', p + ' ' + m[4]);
  }
  for (const m of T.matchAll(/\b([A-HJ-NPR-Z0-9]{17})\b/g)) if (/\d/.test(m[1]) && /[A-Z]/.test(m[1])) add('vin', 'VIN', m[1]);
  for (const m of T.matchAll(/(?<![А-ЯЁA-Zа-яёa-z])([А-ЯA-Z]{3})\s?(\d{10})(?!\d)/g)) if (!/^(ИНН|INN|ОГР|КПП|БИК)$/i.test(m[1])) add('policy', 'Полис', `${m[1].toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => CYR[c])} ${m[2]}`);
  const longNums = [...T.matchAll(/ИНН[\s:№]*(\d{10,12})|(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|(?<![А-ЯЁA-Zа-яёa-z])[А-ЯA-Z]{3}\s?\d{10}(?!\d)/gi)].map(m => m[0].replace(/\D/g, ''));
  for (const m of T.matchAll(/(?<!\d)(\d{2})\s?(\d{2})\s?(\d{6})(?!\d)/g)){
    const digits = m[1] + m[2] + m[3];
    if (longNums.some(n => n.includes(digits))) continue;               // это ИНН или телефон, а не серия/номер
    add('series', 'Серия и номер', `${m[1]} ${m[2]} ${m[3]}`);
  }
  for (const m of T.matchAll(/(?:\+7|\b8)[\s(-]*(\d{3})[\s)-]*(\d{3})[\s-]*(\d{2})[\s-]*(\d{2})\b/g)) add('phone', 'Телефон', `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}`);
  for (const m of T.matchAll(/ИНН[\s:№]*(\d{10}|\d{12})\b/gi)) add('inn', 'ИНН', m[1]);
  for (const m of T.matchAll(/(\d[\d\s]{2,9}(?:[.,]\d{2})?)\s?(?:руб|₽|р\.)/gi)) add('sum', 'Сумма', m[1].replace(/\s/g, ' ').trim() + ' ₽');
  for (const m of T.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?![.\/-]\d)/g)) if (!/\d{2}\.\d{2}\.\d{4}/.test(m.input.slice(Math.max(0, m.index - 3), m.index + 10))) add('time', 'Время', `${pad(+m[1])}:${m[2]}`);
  return out.slice(0, 14);
}
function renderFields(){
  $('#scFields').innerHTML = scan.fields.length ? '<span class="muted">Найдено, нажмите чтобы скопировать:</span>' + scan.fields.map((f, i) => `<button class="sc-chip" data-fi="${i}"><small>${f.label}</small>${esc(f.value)}</button>`).join('') : '';
  $('#scFields').onclick = e => { const b = e.target.closest('[data-fi]'); if (b) copyText(scan.fields[+b.dataset.fi].value, scan.fields[+b.dataset.fi].label); };
}
async function copyText(t, what){
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {}
  if (!ok){ try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e) {} }
  toast(ok ? 'Скопировано' : 'Не удалось скопировать', ok ? (what ? what + ': ' : '') + t.slice(0, 60) : 'Выделите текст и скопируйте вручную');
}
function curText(){ return ($('#scTa') ? $('#scTa').value : scan.text).trim(); }
function renderActs(){
  const o = scan.opts, acts = [];
  if (o.onDoc) acts.push(['doc-attach', 'Прикрепить к документу', 'primary']);
  if (o.onText) acts.push(['insert', o.insertLabel || 'Вставить в сообщение', o.onDoc ? '' : 'primary']);
  acts.push(['copy', 'Копировать текст', acts.length ? '' : 'primary']);
  acts.push(['tpl', 'Сохранить как шаблон', '']);
  if (!o.onDoc) acts.push(['newdoc', 'В документы', '']);
  if (!driverMode && !o.onText) acts.push(['order', 'Новая заявка из текста', '']);
  if (driverMode && !o.onText) acts.push(['send', 'Отправить диспетчеру', '']);
  acts.push(['again', 'Сканировать ещё', '']);
  $('#scActs').innerHTML = acts.map(([k, t, c]) => `<button class="sc-btn ${c}" data-act="${k}">${t}</button>`).join('');
  $('#scActs').onclick = e => { const b = e.target.closest('[data-act]'); if (b) scanAction(b.dataset.act); };
}
function bestFor(kind, fields){
  const dates = fields.filter(f => f.type === 'date').map(f => f.iso).sort(), today = dayPlus(0);
  const num = kind === 'ОСАГО' ? fields.find(f => f.type === 'policy') : ['Паспорт', 'Водительское удостоверение', 'СТС', 'ПТС'].includes(kind) ? fields.find(f => f.type === 'series') : (fields.find(f => f.type === 'series') || fields.find(f => f.type === 'policy'));
  return { number: num ? num.value : '', issued: dates.filter(d => d <= today).slice(-1)[0] || '', expires: dates.filter(d => d > today).slice(-1)[0] || '' };
}
async function scanAction(a){
  const text = curText(), o = scan.opts;
  if (a === 'copy') return copyText(text, 'Текст');
  if (a === 'again') return stepCamera();
  if (a === 'insert'){ closeScanner(); o.onText(text); return; }
  if (a === 'doc-attach'){ const blob = scan.outBlob || await new Promise(r => scan.outCanvas.toBlob(r, 'image/jpeg', .85)); closeScanner(); o.onDoc({ blob, text, fields: scan.fields }); return; }
  if (a === 'send'){ closeScanner(); setPhTab('disp'); phoneSend('[Скан] ' + text.slice(0, 900)); return; }
  if (a === 'order'){
    const d = scan.fields.find(f => f.type === 'date' && f.iso >= dayPlus(0)), tm = scan.fields.find(f => f.type === 'time');
    closeScanner(); editOrder(null, { date: d ? d.iso : dayPlus(0), time: tm ? tm.value : '09:00', note: text.replace(/\n+/g, ' ').slice(0, 300) });
    toast('Текст со скана — в комментарии', 'Заполните адреса и груз'); return;
  }
  const form = $('#scForm'); form.hidden = false;
  if (a === 'tpl'){
    form.innerHTML = `<label>Название шаблона</label><div class="sc-row"><input id="scTplName" placeholder="Например: Инструкция по погрузке" value="${esc(text.split('\n')[0].slice(0, 40))}"><button class="sc-btn primary" id="scTplSave">Сохранить</button></div>`;
    $('#scTplSave').onclick = () => {
      const name = $('#scTplName').value.trim() || 'Шаблон'; userTpls.push({ id: 'u' + Date.now(), name, text }); log('Новый шаблон', name); scheduleSave();
      form.hidden = true; toast('Шаблон сохранён', 'Он появится в списке шаблонов сообщений и рассылки');
    };
  }
  if (a === 'newdoc'){
    const me = driverMode ? phoneDriverId : null;
    const owners = me ? [[me, 'Мои документы'], ...(vehOf(drvById(me)) ? [[vehOf(drvById(me)).id, 'Моё ТС ' + vehOf(drvById(me)).plate]] : [])] : [...drivers.map(d => [d.id, d.name]), ...vehicles.map(v => [v.id, v.plate + ' ' + v.reg])];
    form.innerHTML = `<label>Куда сохранить скан</label><div class="sc-row"><select id="scOwner">${owners.map(([id, t]) => opt(id, owners[0][0], t)).join('')}</select><select id="scKind"></select></div><button class="sc-btn primary" id="scDocSave" style="margin-top:8px;width:100%">Сохранить документ</button>`;
    const fillKinds = () => { $('#scKind').innerHTML = DOC_KINDS[$('#scOwner').value[0]].map(k => opt(k, '')).join(''); };
    $('#scOwner').onchange = fillKinds; fillKinds();
    $('#scDocSave').onclick = async () => {
      const owner = $('#scOwner').value, kind = $('#scKind').value, b = bestFor(kind, scan.fields);
      const blob = scan.outBlob || await new Promise(r => scan.outCanvas.toBlob(r, 'image/jpeg', .85)), fid = 'f' + Date.now();
      await idbPut({ id: fid, name: 'скан.jpg', type: 'image/jpeg', blob });
      seq.doc++; const x = { id: 'x' + seq.doc, owner, kind, number: b.number, issued: b.issued, expires: b.expires, note: text.slice(0, 120).replace(/\n/g, ' '), files: [{ id: fid, name: 'скан.jpg', type: 'image/jpeg' }], ocr: text.slice(0, 4000) };
      docs.push(x); syncDriverDates(owner); log('Документ со сканера', `${ownerName(owner)}: ${kind}`);
      form.hidden = true; toast('Документ сохранён', `${kind} · ${ownerName(owner)}${b.number ? ' · номер заполнен' : ''}`);
      if (cur === 'docs') renderDocs(); if (phoneOpen) renderPhone();
    };
  }
}
$('#scanner').addEventListener('click', e => {
  const b = e.target.closest('[data-sc]'); if (!b) return;
  const k = b.dataset.sc;
  if (k === 'close') closeScanner();
  if (k === 'retake') stepCamera();
  if (k === 'rotate'){ scan.src = rotateCanvas(scan.src); stepCrop(scan.src); scan.corners = defaultCorners(scan.src); drawCorners(); }
  if (k === 'full'){ scan.corners = [[0, 0], [scan.src.width, 0], [scan.src.width, scan.src.height], [0, scan.src.height]]; drawCorners(); }
  if (k === 'warp'){ b.disabled = true; b.textContent = 'Обработка…'; setTimeout(() => { scan.warped = warp(scan.src, scan.corners); stepResult(); }, 30); }
});

/* ---------- кнопки вызова сканера ---------- */
$('#scanBtn').onclick = () => openScanner({ title: 'Текст с фото → в сообщение', onText: t => { const ta = $('#msgInput'); ta.value = (ta.value ? ta.value + '\n' : '') + t; autoGrow(); ta.focus(); } });
$('#phScan').onclick = () => openScanner({ title: 'Скан → сообщение', insertLabel: 'Вставить в сообщение', onText: t => { $('#phInput').value = t.replace(/\n+/g, ' ').slice(0, 900); $('#phInput').focus(); } });
$('#navScan').addEventListener('click', e => { e.preventDefault(); openScanner({ title: 'Распознать текст с фото' }); });
$('#msScan').onclick = () => { $('#moreSheet').hidden = true; openScanner({ title: 'Распознать текст с фото' }); };

/* =====================================================================
   СИНХРОНИЗАЦИЯ МЕЖДУ УСТРОЙСТВАМИ — ТЕСТОВЫЙ РЕЖИМ
   Пересыльщик: публичный ntfy.sh (без регистрации, доступен из России — проверено 2026-11-11).
   Только для теста: без шифрования, лимит ~250 сообщений в сутки с одного устройства.
   Синхронизируются: общий чат, личные сообщения водителей, чат диспетчер ↔ водитель, статусы, SOS.
   ===================================================================== */
const SYNC_URL = 'https://ntfy.sh/';
const SYNC_DEFAULT = 'trassa-vs-test-7q4m2k9x';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
let syncTopic = lsGet('trassa-sync-topic', SYNC_DEFAULT);
let syncOn = lsGet('trassa-sync-off', '0') !== '1';
const DEV = lsGet('trassa-dev', '') || (() => { const d = Math.random().toString(36).slice(2, 8); lsSet('trassa-dev', d); return d; })();
const seenEv = new Set();
const liveDev = {};                     // другие устройства: dev → { ids: [...], at }
let es = null, syncState = 'off', lastPresence = 0, gseq = 0, sentToday = 0;
const newGid = () => DEV + '-' + Date.now().toString(36) + '-' + (gseq++);
const liveIds = () => [...new Set(Object.values(liveDev).filter(x => Date.now() - x.at < 20 * 60000).flatMap(x => x.ids))];
const isLive = id => liveIds().includes(id);
const anyLive = () => liveIds().length > 0;
function myIds(){ const ids = []; if (!driverMode) ids.push('disp'); if (phoneOpen || driverMode) ids.push(phoneDriverId); return ids; }

function syncPublish(ev){
  if (!syncOn) return;
  ev.v = 1; ev.dev = DEV; ev.eid = ev.eid || newGid();
  seenEv.add(ev.eid); sentToday++;
  fetch(SYNC_URL + encodeURIComponent(syncTopic), { method: 'POST', body: JSON.stringify(ev) })
    .then(r => setSync(r.ok ? 'on' : r.status === 429 ? 'limit' : 'error'))
    .catch(() => setSync('error'));
}
function syncConnect(){
  if (es){ es.close(); es = null; }
  if (!syncOn || !window.EventSource){ setSync('off'); return; }
  setSync('connecting');
  es = new EventSource(SYNC_URL + encodeURIComponent(syncTopic) + '/sse?since=12h');
  es.onopen = () => setSync('on');
  es.onerror = () => { if (syncState !== 'limit') setSync('error'); };     // переподключается сам
  es.onmessage = e => {
    try { const n = JSON.parse(e.data); if (n.event && n.event !== 'message') return; onSync(JSON.parse(n.message), (n.time || Date.now() / 1000) * 1000); }
    catch (err) {}
  };
}
function setSync(st){ if (syncState === st) return; syncState = st; renderSyncBadge(); }
function presence(force){
  if (!syncOn || (!force && Date.now() - lastPresence < 10 * 60000)) return;
  lastPresence = Date.now();
  syncPublish({ k: 'hi', ids: myIds() });
}
function renderSyncBadge(){
  const people = liveIds();
  const txt = { on: 'онлайн', connecting: 'подключение…', error: 'нет связи', limit: 'лимит на сегодня', off: 'выключено' }[syncState] || syncState;
  const cls = syncState === 'on' ? 'ok' : syncState === 'connecting' ? 'wait' : 'bad';
  const who = people.length ? ' · на связи: ' + people.map(id => id === 'disp' ? 'диспетчер' : (drvById(id) ? shortName(drvById(id).name) : id)).join(', ') : '';
  $$('.sync-badge').forEach(el => { el.classList.remove('ok', 'wait', 'bad'); el.classList.add(cls); el.innerHTML = `<i></i>Синхр. ${txt}${who}`; el.title = 'Тестовая синхронизация между устройствами (ntfy.sh). Код: ' + syncTopic; });
}

/* ---------- приём событий ---------- */
function onSync(ev, at){
  if (!ev || ev.v !== 1 || !ev.eid || ev.dev === DEV || seenEv.has(ev.eid)) return;
  seenEv.add(ev.eid);
  const ld = liveDev[ev.dev] = liveDev[ev.dev] || { ids: [], at: 0 };
  if (ev.k === 'hi' && at >= ld.at) ld.ids = (ev.ids || []).slice();             // устройство сообщило, кто оно сейчас
  else (ev.ids || []).forEach(id => { if (!ld.ids.includes(id)) ld.ids.push(id); });
  ld.at = Math.max(ld.at, at);
  const fresh = Date.now() - at < 15 * 60000;
  if (ev.k === 'room') roomPush(ev.key, ev.from, ev.text, { gid: ev.eid, remote: true, t: new Date(ev.t || at) });
  if (ev.k === 'd2drv') remoteToDriver(ev, at);
  if (ev.k === 'drv2d') remoteFromDriver(ev, at);
  if (ev.k === 'ack'){ const m = (messages[ev.did] || []).find(x => x.gid === ev.ref); if (m && m.st !== 'read'){ m.st = 'read'; m.fb = null; changed(ev.did); } }
  if (ev.k === 'sos' && fresh) remoteSos(ev);
  if (ev.k === 'bye') delete liveDev[ev.dev];
  renderSyncBadge();
  if (cur === 'chat') renderConvs();
}
function remoteToDriver(ev){
  const list = messages[ev.did], d = drvById(ev.did);
  if (!list || !d || list.some(m => m.gid === ev.eid)) return;
  const m = { id: msgSeq++, gid: ev.eid, dir: 'out', text: ev.text, t: new Date(ev.t), ch: 'app', st: 'delivered', trip: tripNo(d), remote: true, bc: ev.bc };
  list.push(m);
  if (phoneOpen && phoneDriverId === ev.did){
    if (driverMode && phTab !== 'disp') showPush('Диспетчер', ev.text, () => setPhTab('disp'));
    markPhoneRead();
  }
  changed(ev.did); kpiMsgs(); scheduleSave();
}
function remoteFromDriver(ev){
  if (!messages[ev.did] || messages[ev.did].some(m => m.gid === ev.eid)) return;
  incoming(ev.did, ev.text, 'app', !!ev.sys, ev.eid);
  const d = drvById(ev.did); if (d){ d.appOnline = true; d.lastSeen = new Date(); }
}
function remoteSos(ev){
  let s = sosList.find(x => x.id === ev.id);
  if (ev.a === 'start' && !s) startSos(ev.did, ev.reason, ev.note, { remote: true, id: ev.id, lat: ev.lat, lng: ev.lng });
  if (!s) s = sosList.find(x => x.id === ev.id);
  if (!s) return;
  if (ev.a === 'resp') sosRespond(s, ev.did, { remote: true });
  if (ev.a === 'close') sosClose(s, ev.how || 'закрыт', { remote: true });
}

/* ---------- запуск ---------- */
window.addEventListener('pagehide', () => { if (syncOn && anyLive()) navigator.sendBeacon && navigator.sendBeacon(SYNC_URL + encodeURIComponent(syncTopic), JSON.stringify({ v: 1, k: 'bye', dev: DEV, eid: newGid(), ids: myIds() })); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) presence(false); });

/* ================= periodic refresh ================= */
function clock(){ $('#clock').textContent = hm(new Date()); }
setInterval(() => {
  clock();
  if (cur === 'monitoring'){ renderList(); if (selVeh) renderCard(); }
  if (cur === 'chat') renderChatInfo();
  if (phoneOpen) { $('#phTime').textContent = hm(new Date()); }
  if (driverMode) updatePhMap();
  sosTick(); presence(false);
}, 1000);
setInterval(renderSyncBadge, 30000);
setInterval(() => { if (phoneOpen) renderPhone(); if (cur === 'vehicles') renderVehicles(); }, 5000);

/* ================= boot ================= */
const restored = restore();
generateOrders(); refreshPhoneSelect(); updateDocBadge(); updateOrderBadge();
syncConnect(); renderSyncBadge();
$('#navClients').textContent = clients.length;
if (restored) setTimeout(() => toast('Данные восстановлены', 'Все изменения сохраняются на этом устройстве'), 1200);
clock(); kpiMsgs(); updateUnread(); renderList();
$('#navDrivers').textContent = drivers.length; $('#navVehicles').textContent = vehicles.length; $('#intCount').textContent = vehicles.length;
show(location.hash.slice(1) || 'monitoring');
if (!location.hash) history.replaceState(null, '', '#monitoring');
document.body.classList.toggle('is-app', isApp);
if (isPhone()) $('#msgInput').placeholder = 'Сообщение водителю…';
if (isApp || isPhone()){
  showStart();
}
if (!isApp && !isPhone()) setTimeout(() => toast('Демо-режим', 'Машины и сообщения тестовые. Откройте «Приложение водителя», чтобы ответить диспетчеру с телефона.', () => setPhoneOpen(true),
  '<div class="ic"><svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></div>'), 1500);
})();
