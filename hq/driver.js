'use strict';
/* ===================================================================
   ВОДИТЕЛЬ: статус дня, заявки, рейс, ТТН, чаты, профиль
   =================================================================== */
const Drv = { lock: {} };   // lock[oid] = результат попытки открыть

function statusCard(d) {
  const v = vehOf(d.id), sh = shiftOpen(d.id);
  if (d.status === 'off') return `<div class="scard off">
      <div class="sc-l"><small>Статус</small><b>Не на линии</b><span>${v ? `Машина ${v.plate} ${v.region}${v.state === 'repair' ? ' — в ремонте' : ''}` : 'Машина не закреплена — обратитесь к механику'}</span></div>
      <button class="btn acc xl" data-a="clockIn">${ic('play')}Начать день</button>
      ${scAlarm(d)}</div>`;
  if (d.status === 'line') return `<div class="scard line">
      <div class="sc-l"><small>Статус</small><b><i class="sdot ok"></i>На линии</b><span>${sh ? 'с ' + fmtTime(sh.start) + ' · ' + dur(now() - sh.start) : ''}</span></div>
      <div class="sc-a"><button class="btn warn" data-a="breakdown">${ic('wrench')}Поломка</button><button class="btn ghost" data-a="clockOut">${ic('power')}Закончить день</button></div></div>`;
  const b = d.breakdown || {};
  return `<div class="scard ${b.kind === 'sos' ? 'sos' : 'brk'}">
      <div class="sc-l"><small>${b.kind === 'sos' ? 'Экстренная поломка' : 'Поломка · справляюсь сам'}</small><b>${ic('alert')}${esc(b.reason || 'Поломка')}</b><span>${b.note ? esc(b.note) + ' · ' : ''}${ago(b.at)}</span>
      ${b.kind === 'sos' ? (b.ack ? `<div class="ack">${ic('check')}Диспетчер: ${esc(b.ack.text)}</div>` : `<div class="ack wait"><i class="spin"></i>Диспетчер получил сигнал…</div>`) : ''}</div>
      <div class="sc-a"><button class="btn ok" data-a="fixed">${ic('check')}Починился — на линию</button><a class="btn ghost" href="${telHref(db.people.disp.phone)}">${ic('phone')}Диспетчер</a></div></div>`;
}
A.clockIn = () => { const w = who(); Act.clockIn(w.id); toast('Хорошего дня!', 'Вы на линии — можно брать рейсы', 'ok'); };
A.clockOut = async () => {
  const w = who(), at = activeTrip(w.id);
  if (!await confirmBox('Закончить день?', at ? 'У вас есть незавершённый рейс. Сначала лучше завершить его.' : 'Статус станет «Закончил работу».', 'Закончить', at ? 'danger' : 'acc')) return;
  Act.clockOut(w.id); toast('День закончен', 'Спасибо за работу');
};
A.fixed = () => { Act.fixed(who().id); toast('Вы снова на линии', '', 'ok'); };
A.breakdown = () => {
  let kind = null, reason = null;
  const m = modal(`
    <div class="bk-kinds">
      <button class="bk local" data-k="local">${ic('wrench')}<b>Справлюсь сам</b><span>Локальная поломка, помощь не нужна</span></button>
      <button class="bk sos" data-k="sos">${ic('alert')}<b>Нужна помощь</b><span>Экстренная: диспетчер и механик получат сигнал</span></button>
    </div>
    <div class="aud-h">Что случилось</div>
    <div class="chips-pick">${BREAK_REASONS.map(r => `<button data-r="${r}">${r}</button>`).join('')}</div>
    <div class="form"><label>Комментарий<input id="bkN" placeholder="Где стоите, что нужно"></label>
    <label class="check"><input type="checkbox" id="bkGeo" checked> Отправить мои координаты</label></div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn danger" id="bkGo" disabled>Отправить</button></div>`, { title: 'Поломка' });
  const upd = () => { $$('.bk', m.el).forEach(b => b.classList.toggle('on', b.dataset.k === kind)); $$('[data-r]', m.el).forEach(b => b.classList.toggle('on', b.dataset.r === reason)); m.$('#bkGo').disabled = !kind || !reason; m.$('#bkGo').className = 'btn ' + (kind === 'local' ? 'warn' : 'danger'); m.$('#bkGo').textContent = kind === 'sos' ? '🚨 Вызвать помощь' : 'Отметить поломку'; };
  m.el.addEventListener('click', e => { const k = e.target.closest('.bk'), r = e.target.closest('[data-r]'); if (k) kind = k.dataset.k; if (r) reason = r.dataset.r; if (k || r) upd(); });
  m.$('#bkGo').onclick = async () => {
    const btn = m.$('#bkGo'); btn.disabled = true; btn.textContent = 'Отправляем…';
    let coords = null;
    if (m.$('#bkGeo').checked && navigator.geolocation) coords = await new Promise(res => navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]), () => res(null), { timeout: 6000, maximumAge: 60000 }));
    Act.breakdown(who().id, kind, reason, m.$('#bkN').value.trim(), coords);
    m.close(); toast(kind === 'sos' ? 'Сигнал отправлен' : 'Поломка отмечена', kind === 'sos' ? 'Диспетчер и механик уже видят. Оставайтесь на связи' : 'Когда почините — нажмите «Починился»', kind === 'sos' ? 'bad' : '');
  };
};

/* ---------- главная: заявки ---------- */
Drv.home = () => {
  const w = who(), d = D(w.id); if (!d) return '';
  const at = activeTrip(d.id), ao = at && O(at.orderId);
  const vis = db.orders.filter(o => orderVisibleTo(o, d.id) && o.status === 'open').sort((a, b) => b.created - a.created);
  const open = vis.filter(o => orderLeft(o) > 0), spent = vis.filter(o => orderLeft(o) === 0 && now() - (o.spentAt || o.created) < DAY);
  const t0 = startOfDay(now()), today = db.trips.filter(t => t.driverId === d.id && t.state === 'done' && t.doneAt >= t0);
  return `${statusCard(d)}
    ${at ? `<a class="mytrip ${at.state}" href="#/trip"><div><small>Ваш рейс</small><b>№${ao.no} · ${esc(ao.cargo)}</b><span>В работе — откройте маршрут</span></div>${ic('right')}</a>` : ''}
    <div class="mini-stats"><button data-a="stat" data-k="drv-today" data-id="${d.id}"><b>${today.length}</b><span>${plural(today.length, 'рейс', 'рейса', 'рейсов')} сегодня</span>${ic('right')}</button><button data-a="stat" data-k="drv-m3" data-id="${d.id}"><b>${fmtNum(today.reduce((s, t) => s + t.m3, 0))}</b><span>м³ сегодня</span>${ic('right')}</button><button data-a="stat" data-k="drv-free"><b>${open.reduce((s, o) => s + orderLeft(o), 0)}</b><span>свободных рейсов</span>${ic('right')}</button></div>
    <div class="sec-h"><b>Заявки</b><span>${open.length}</span></div>
    <div class="olist">${open.map(o => orderCard(o, { did: d.id })).join('') || empty('orders', 'Свободных заявок нет', 'Новые заявки появятся здесь и в чате')}</div>
    ${spent.length ? `<div class="sec-h"><b>Потрачено</b><span>${spent.length}</span></div><div class="olist">${spent.map(o => orderCard(o, { did: d.id })).join('')}</div>` : ''}`;
};

/* ---------- заявка: место по числу рейсов ---------- */
Drv.enterOrder = oid => {
  const w = who(), o = O(oid); if (!o) return;
  const mineActive = db.trips.find(t => t.orderId === oid && t.driverId === w.id && (t.state === 'pending' || t.state === 'confirmed'));
  if (mineActive) { Drv.lock[oid] = { ok: true, mine: true }; return; }
  Drv.lock[oid] = Act.openOrder(oid, w.id);
};
/* ставка водителя (ставку компании водитель не видит) */
function drvRate(o) {
  const R = orderRates(o); if (!R.rd) return '';
  const est = R.unit === 'm3' ? `≈ ${rub(R.rd * o.m3)} за рейс ${o.m3} м³` : 'сумма — по весу из ТТН';
  return `<div class="my-rate"><span>${ic('wallet')}</span><div><small>Ваша ставка</small><b>${perUnit(R.rd, R.u)}</b></div><em>${est}</em></div>`;
}
Drv.leaveOrder = oid => { const w = who(); if (Drv.lock[oid] && Drv.lock[oid].ok && !Drv.lock[oid].mine) Act.releaseOrder(oid, w.id); delete Drv.lock[oid]; };
Drv.order = oid => {
  const w = who(), d = D(w.id), o = O(oid); if (!o) return empty('orders', 'Заявка не найдена');
  const L = Drv.lock[oid] || {}, left = orderLeft(o);
  const head = `<div class="m-top"><a class="icon-btn" href="#/orders">${ic('back')}</a><div><b>Заявка №${o.no}</b><span>${esc(o.client)}</span></div></div>`;
  if (!L.ok) {
    const vw = viewers(o, w.id).length;
    const why = L.spent || left === 0 ? ['Потрачено', 'Все рейсы по этой заявке уже разобраны.', 'spent'] : L.closed || o.status === 'closed' ? ['Заявка закрыта', 'Диспетчер закрыл заявку.', 'closed'] : ['Все места заняты', `Заявку сейчас открыли ${vw} ${plural(vw, 'водитель', 'водителя', 'водителей')} — столько же, сколько осталось рейсов (${left}). Как только кто-то закроет её, она откроется у вас сама.`, 'full'];
    return head + `<div class="blocked ${why[2]}">
      ${why[2] === 'spent' ? '<div class="stamp big">ПОТРАЧЕНО</div>' : `<div class="bl-ic">${ic(why[2] === 'full' ? 'eye' : 'x')}</div>`}
      <b>${why[0]}</b><p>${why[1]}</p>
      ${why[2] === 'full' ? `<div class="bl-seats">${Array.from({ length: left }, () => `<i>${ic('user')}</i>`).join('')}</div><div class="wait"><i class="spin"></i>Ждём свободное место…</div>` : ''}
      <div class="oc-mini">№${o.no} · ${esc(o.cargo)} · ${o.m3} м³/рейс</div>
      <a class="btn soft" href="#/orders">К заявкам</a></div>`;
  }
  const at = activeTrip(d.id), mine = at && at.orderId === oid ? at : null;
  const v = vehOf(d.id);
  const why = mine ? '' : d.status !== 'line' ? (d.status === 'off' ? 'Начните день, чтобы брать рейсы' : 'Сначала отметьте, что починились') : !v ? 'За вами не закреплена машина' : v.state === 'repair' ? 'Ваша машина в ремонте' : at ? `Сначала завершите рейс №${O(at.orderId).no}` : left === 0 ? 'Рейсов не осталось' : '';
  const vw = viewers(o, w.id).length;
  return head + `
    ${!mine ? `<div class="hold">${ic('eye')}<span>Место за вами, пока заявка открыта. Сейчас смотрят ещё ${vw} · максимум ${left}</span></div>` : ''}
    <div class="card big-count ${left === 0 ? 'spent' : ''}">
      <div class="bc-n"><b>${left}</b><span>${left ? `${plural(left, 'рейс остался', 'рейса осталось', 'рейсов осталось')} из ${o.total}` : 'все рейсы разобраны'}</span></div>
      ${tripCells(o)}
      ${left === 0 ? '<div class="stamp">ПОТРАЧЕНО</div>' : ''}
    </div>
    ${drvRate(o)}
    <div class="card"><div class="card-h"><b>${esc(o.cargo)}</b>${chip(ic('cube') + o.m3 + ' м³')}</div>
      <div class="kv-grid"><div class="kv"><span>Когда</span><b>${fmtDay(new Date(o.date + 'T12:00').getTime())} ${esc(timeSpan(o))}</b></div><div class="kv"><span>Заказчик</span><b>${esc(o.client)}</b></div></div>
      ${o.note ? `<div class="note">${ic('alert')}${esc(o.note)}</div>` : ''}
    </div>
    ${routeBlock(o, true)}
    <div class="sticky-cta">${mine ? `<a class="btn info xl" href="#/trip">${ic('truck')}Мой рейс · ${TRIP_STATE[mine.state].t}</a>` : `<button class="btn acc xl" data-a="takeTrip" data-id="${o.id}" ${why ? 'disabled' : ''}>${ic('check')}Взять рейс</button>${why ? `<small>${why}</small>` : `<small>Осталось ${left} из ${o.total} · ${o.m3} м³</small>`}`}</div>`;
};
A.takeTrip = d => {
  const w = who(), r = Act.takeTrip(d.id, w.id);
  if (!r || !r.ok) return toast('Не получилось взять рейс', r && r.why, 'bad');
  delete Drv.lock[d.id];
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  toast('Рейс ваш!', 'Можно ехать', 'ok');
  go('#/trip');
};

/* ---------- мой рейс ---------- */
Drv.trip = () => {
  const w = who(), d = D(w.id), at = activeTrip(d.id);
  const t0 = startOfDay(now()), today = db.trips.filter(t => t.driverId === d.id && t.state === 'done' && t.doneAt >= t0).sort((a, b) => b.doneAt - a.doneAt);
  let html = '';
  if (at) {
    const o = O(at.orderId);
    html += `<div class="tripcard ${at.state}">
      <div class="tc-h"><small>Рейс по заявке №${o.no}</small><b>${esc(o.cargo)} · ${o.m3} м³</b>
        <div class="tc-st">${ic('check')}Рейс ваш — можно ехать</div></div>
    </div>
    ${drvRate(o)}
    ${routeBlock(o, true)}
    ${o.note ? `<div class="note">${ic('alert')}${esc(o.note)}</div>` : ''}
    <div class="trip-acts">
      <button class="btn ok xl" data-a="completeTrip" data-id="${at.id}">${ic('flag')}Завершить рейс и прикрепить ТТН</button>
      <button class="btn ghost" data-a="cancelTrip" data-id="${at.id}">Отказаться от рейса</button>
    </div>`;
  } else html += empty('truck', 'Сейчас рейса нет', 'Возьмите рейс в заявках', `<a class="btn acc" href="#/orders">${ic('orders')}К заявкам</a>`);
  html += `<div class="sec-h"><b>Сегодня</b><span>${nTrips(today.length)} · ${m3(today.reduce((s, t) => s + t.m3, 0))}</span></div>
    <div class="done-list">${today.map(t => { const o = O(t.orderId); return `<div class="dl">${t.ttn && t.ttn.thumb ? `<button class="dl-img" data-a="openTtn" data-id="${t.id}"><img src="${t.ttn.thumb}" alt="ТТН"><em>${t.ttn.pages}</em></button>` : `<span class="dl-img none">${ic('file')}</span>`}<div><b>№${o.no} · ${esc(o.cargo)}</b><span>${fmtTime(t.doneAt)} · ${m3(t.m3)}${t.ttn ? ' · ТТН ' + t.ttn.pages + ' стр.' : ' · без ТТН'}</span></div></div>`; }).join('') || '<p class="muted sm">Выполненные рейсы появятся здесь</p>'}</div>`;
  return `<div class="m-top"><div><b>Мой рейс</b><span>${d.name}</span></div></div>` + html;
};
A.cancelTrip = async d => { if (await confirmBox('Отказаться от рейса?', 'Рейс вернётся в заявку, диспетчер увидит.', 'Отказаться', 'danger')) { Act.cancelTrip(d.id); toast('Вы отказались от рейса'); } };
A.completeTrip = d => {
  const t = db.trips.find(x => x.id === d.id), o = O(t.orderId), v = V(t.vehicleId);
  let pages = [], thumbs = [], chk = null, run = 0, fails = 0;
  const m = modal(`
    <div class="form ${o.unit === 't' ? 'two' : ''}"><label>Объём по ТТН, м³<div class="stepper sm"><button type="button" data-s="-1">−</button><input id="ctM" type="number" step="0.5" value="${t.m3 || o.m3}"><button type="button" data-s="1">+</button></div></label>${o.unit === 't' ? `<label>Вес по ТТН, т<input id="ctT" type="text" inputmode="decimal" autocomplete="off" placeholder="например 27,5"></label>` : ''}</div>
    <div class="aud-h">ТТН <span class="req">обязательно</span></div>
    <div id="ctPrev" class="ttn-prev"></div>
    <div id="ctChk"></div>
    <div class="row gap wrap"><button class="btn acc grow" id="ctScan">${ic('scan')}Сканировать ТТН</button><button class="btn soft" id="ctUp">${ic('upload')}Фото</button></div>
    <p class="hint">${ic('shield')}Снимите все страницы ТТН, первую — с номером и датой. Телефон сам проверит, что это накладная, дата свежая и такой ТТН ещё не было.</p>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn ok" id="ctGo" disabled>${ic('flag')}Завершить рейс</button></div>`, { title: `Завершить рейс №${o.no}`, sub: `${o.cargo} · ${v ? v.plate : ''}` });
  const box = (cls, icon, title, sub, extra) => `<div class="ttn-chk ${cls}">${ic(icon)}<div><b>${esc(title)}</b><span>${esc(sub || '')}</span>${extra || ''}</div></div>`;
  const paint = () => {
    m.$('#ctPrev').innerHTML = thumbs.length ? `${thumbs.map((t, i) => `<div class="tp"><img src="${t}"><b>${i + 1}</b></div>`).join('')}<span class="tp-n">${thumbs.length} стр. → PDF</span>` : `<div class="ttn-empty">${ic('file')}ТТН ещё не прикреплена</div>`;
    m.$('#ctScan').innerHTML = ic('scan') + (thumbs.length ? 'Переснять ТТН' : 'Сканировать ТТН');
    const c = m.$('#ctChk');
    if (!thumbs.length) c.innerHTML = '';
    else if (!chk) c.innerHTML = box('wait', 'scan', 'Проверяем ТТН…', 'Читаем текст на устройстве', '<i class="ttn-bar"><em id="ctBar"></em></i>');
    else if (chk.s === 'ok') c.innerHTML = box('ok', 'check', chk.msg, chk.sub);
    else if (chk.s === 'warn') c.innerHTML = box('warn', 'alert', chk.msg, chk.sub);
    else if (chk.s === 'dup') c.innerHTML = box('bad', 'x', chk.msg, chk.sub + '. Прикрепить её второй раз нельзя.');
    else if (chk.s === 'err') c.innerHTML = box('bad', 'x', 'Проверка не запустилась', chk.sub, '<button class="btn soft sm" id="ctRe">Проверить ещё раз</button>');
    else c.innerHTML = box('bad', 'x', chk.msg, chk.sub, fails >= 2 ? '<button class="btn ghost sm" id="ctMan">ТТН настоящая, но не читается — отправить диспетчеру</button>' : '');
    m.$('#ctGo').disabled = !(chk && (chk.s === 'ok' || chk.s === 'warn' || chk.manual));
    const re = m.$('#ctRe'); if (re) re.onclick = check;
    const mn = m.$('#ctMan'); if (mn) mn.onclick = async () => { if (!await confirmBox('Отправить на проверку?', 'Рейс завершится, но диспетчер увидит пометку «ТТН на проверке» и сверит накладную сам.', 'Отправить')) return; chk.manual = true; mn.remove(); m.$('#ctGo').disabled = false; m.$('#ctGo').click(); };
  };
  async function check() {
    const my = ++run; chk = null; paint();
    try {
      const hash = Scanner.fingerprint(pages[0]);
      const texts = await Scanner.ocr(pages, p => { const bar = m.$('#ctBar'); if (bar) bar.style.width = Math.round(8 + p * 92) + '%'; });
      if (my !== run) return;
      chk = Object.assign(ttnVerdict(t, ttnAnalyze(texts.join('\n')), hash), { hash });
      if (chk.s === 'bad') fails++;
    } catch (e) { if (my !== run) return; chk = { s: 'err', sub: location.protocol === 'file:' ? 'Откройте приложение через сервер' : String(e.message || e) }; }
    paint();
  }
  const got = (p, th) => { pages = p; thumbs = th; check(); };
  paint();
  m.el.addEventListener('click', e => { const s = e.target.closest('[data-s]'); if (s) { const i = m.$('#ctM'); i.value = Math.max(0, (+i.value || 0) + +s.dataset.s); } });
  m.$('#ctScan').onclick = () => Scanner.open({ title: 'ТТН', multi: true, ocr: false, onDone: r => got(r.pages, r.thumbs) });
  m.$('#ctUp').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => {
      const fs = Array.from(inp.files || []).filter(f => /^image\//.test(f.type)); if (!fs.length) return toast('Нужна фотография ТТН', 'PDF и другие файлы не подходят — снимите накладную камерой', 'bad');
      const p = []; for (const f of fs) p.push(await fileToCanvas(f)); got(p, p.map(c => Scanner.thumb(c)));
    };
    inp.click();
  };
  m.$('#ctGo').onclick = async () => {
    const tn = m.$('#ctT') ? +String(m.$('#ctT').value).replace(',', '.') : null;
    if (m.$('#ctT') && !tn) { m.$('#ctT').focus(); return toast('Укажите вес по ТТН', 'По этой заявке оплата за тонну', 'bad'); }
    if (!pages.length) return toast('Прикрепите ТТН', 'Без накладной рейс не завершить', 'bad');
    if (!chk || !(chk.s === 'ok' || chk.s === 'warn' || chk.manual)) return toast('ТТН не прошла проверку', chk ? chk.msg : 'Подождите, идёт проверка', 'bad');
    const b = m.$('#ctGo'); b.disabled = true; b.textContent = 'Сохраняем…';
    const blob = await makePdf(pages);
    const fileId = await FS.put(blob, `ТТН ${o.no}`, 'application/pdf');
    const ttn = { fileId, pages: pages.length, mime: 'application/pdf', thumb: thumbs[0] || null, size: blob.size, no: chk.no || '', date: chk.date || '', hash: chk.hash || '', check: chk.s === 'ok' ? 'ok' : 'review', why: chk.s === 'ok' ? '' : chk.why || chk.msg };
    Act.completeTrip(t.id, +m.$('#ctM').value || 0, ttn, tn);
    m.close(); toast('Рейс завершён', `${m3(+m.$('#ctM').value || 0)} · ${ttn.check === 'ok' ? 'ТТН проверена' : 'ТТН на проверке у диспетчера'}`, 'ok');
  };
};

/* ---------- чаты и профиль ---------- */
Drv.chats = () => `<div class="m-top"><div><b>Чаты</b><span>диспетчер, группы, общий</span></div></div>` + chatList(who().id);
Drv.chat = id => { setTimeout(() => Act.markRead(who().id, id), 300); return `<div class="m-chat">${chatView(who().id, id, { back: '#/chats' })}</div>`; };
Drv.me = () => {
  const w = who(), d = D(w.id), v = vehOf(d.id);
  const week = db.trips.filter(t => t.driverId === d.id && t.state === 'done' && t.doneAt > now() - 7 * DAY);
  return `<div class="m-top"><div><b>Профиль</b></div><button class="icon-btn" data-a="logout" title="Выйти">${ic('logout')}</button></div>
    <div class="me-h">${avatar(d, 'xl')}<div><h2>${esc(d.name)}</h2>${statusChip(d)}<span class="muted">${esc(d.phone)}</span></div></div>
    <div class="mini-stats"><button data-a="stat" data-k="drv-7d" data-id="${d.id}"><b>${week.length}</b><span>рейсов за 7 дней</span>${ic('right')}</button><button data-a="stat" data-k="drv-m3w" data-id="${d.id}"><b>${fmtNum(week.reduce((s, t) => s + t.m3, 0))}</b><span>м³ за 7 дней</span>${ic('right')}</button><button data-a="stat" data-k="drv-mydocs" data-id="${d.id}"><b>${d.docs.length}</b><span>документов</span>${ic('right')}</button></div>
    ${laCard(d)}
    <div class="card"><div class="card-h"><b>Моя машина</b></div>${v ? `<div class="my-veh">${plate(v, 'lg')}<div><b>${esc(v.model)}</b><span>${esc(v.axle)} · ${v.volume} м³</span>${vehChip(v)}</div></div>` : '<p class="muted">Машина не закреплена. Механик назначит её в своём приложении.</p>'}</div>
    <div class="card" id="myDocs"><div class="card-h"><b>Мои документы</b></div>${docGrid({ type: 'driver', id: d.id }, d.docs, true)}</div>
    ${v && v.docs.length ? `<div class="card"><div class="card-h"><b>Документы машины</b></div>${docGrid({ type: 'vehicle', id: v.id }, v.docs, false)}</div>` : ''}
    <p class="app-ver">Трасса HQ ${APP_VER} · ${!Cloud.on ? 'данные только на этом телефоне' : Cloud.online === false ? 'нет связи с базой' : 'связь с базой есть'}</p>`;
};


/* ===================================================================
   БУДИЛЬНИК НА ЛИНИЮ: за час и в минуту выхода (Android-приложение
   ставит системный будильник — звонит при закрытом приложении)
   =================================================================== */
const WDN = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LA_DEF = { on: false, time: '07:00', days: [1, 2, 3, 4, 5, 6] };
const lineAlarm = d => Object.assign({}, LA_DEF, (d && d.lineAlarm) || {});
const HAS_ALARM = !!(window.TrassaApp && window.TrassaApp.alarmSet);
/* ближайшие выходы на линию (до 7 дней вперёд) */
function lineStarts(d, n) {
  const la = lineAlarm(d), out = []; if (!la.on || !la.days.length) return out;
  const [hh, mm] = la.time.split(':').map(Number), t0 = startOfDay(now());
  for (let k = 0; k < 8 && out.length < (n || 99); k++) {
    const day = new Date(t0 + k * DAY + 12 * HOUR); day.setHours(hh, mm, 0, 0); const at = day.getTime();
    if (!la.days.includes(day.getDay()) || at <= now()) continue;
    if (k === 0 && d.status !== 'off') continue;   // сегодня уже на линии — сегодняшний будильник не нужен
    out.push(at);
  }
  return out;
}
const dayWord = at => { const k = Math.round((startOfDay(at) - startOfDay(now())) / DAY); return k === 0 ? 'сегодня' : k === 1 ? 'завтра' : WDN[new Date(at).getDay()].toLowerCase() + ' ' + new Date(at).getDate(); };
function scAlarm(d) {
  const la = lineAlarm(d), st = la.on && lineStarts(d, 1)[0];
  return la.on ? `<a class="sc-alarm" href="#/me">${ic('bell')}${st ? `Будильник: ${dayWord(st)}, выход в ${fmtTime(st)}` : 'Будильник включён'}</a>` : `<a class="sc-alarm off" href="#/me">${ic('bell')}Включить будильник на линию</a>`;
}
function laNextText(d) {
  const st = lineStarts(d, 1)[0]; if (!st) return '';
  return `${dayWord(st)}: в ${fmtTime(st - HOUR)} — «через час на линию», в ${fmtTime(st)} — «пора на линию»`;
}
let laSig = '';
function alarmSync() {
  if (!HAS_ALARM) return;
  const w = who(); if (w.role !== 'driver') return;   // экран входа — будильники не трогаем
  const d = D(w.id); if (!d) return;
  const list = [];
  lineStarts(d).slice(0, 7).forEach((at, i) => {
    const tt = fmtTime(at);
    if (at - HOUR > now()) list.push({ id: 100 + i * 2, at: at - HOUR, title: 'Через час на линию', text: `Выход в ${tt} · ${d.name}` });
    list.push({ id: 101 + i * 2, at, title: 'Пора на линию', text: `Выход в ${tt}. Откройте «Трассу» и нажмите «Начать день»` });
  });
  const sig = JSON.stringify(list); if (sig === laSig) return;
  laSig = sig; try { TrassaApp.alarmSet(sig); } catch (e) { console.warn(e); }
}
subs.add(alarmSync);
setTimeout(() => { const lo = A.logout; A.logout = d => { if (HAS_ALARM && who().role === 'driver') { laSig = '[]'; try { TrassaApp.alarmSet('[]'); } catch (e) {} } return lo(d); }; }, 0);   // main.js объявляет A.logout позже — оборачиваем после загрузки
setTimeout(alarmSync, 800);
window.appAlarmRefresh = () => { laSig = ''; alarmSync(); if (route().page === 'me' && who().role === 'driver') render(); };
function alarmStatus() { if (!HAS_ALARM) return null; try { return JSON.parse(TrassaApp.alarmStatus()); } catch (e) { return null; } }

/* форма: включить, время, дни (у водителя и у диспетчера) */
function laForm(d, scope) {
  const la = lineAlarm(d);
  return `<div class="la-form" data-did="${d.id}">
    <div class="sw-row"><div><b>Будильник на линию</b><span>За час до выхода и в минуту выхода — на весь экран, со звуком</span></div><button class="switch ${la.on ? 'on' : ''}" data-a="laToggle" data-id="${d.id}"><i></i></button></div>
    <div class="la-set ${la.on ? '' : 'off'}">
      <label class="la-time"><span>Время выхода</span><input type="time" value="${la.time}" data-la-time="${d.id}" ${la.on ? '' : 'disabled'}></label>
      <div class="la-days">${WD_ORDER.map(k => `<button class="${la.days.includes(k) ? 'on' : ''}" data-a="laDay" data-id="${d.id}" data-v="${k}" ${la.on ? '' : 'disabled'}>${WDN[k]}</button>`).join('')}</div>
      ${la.on ? `<p class="la-next">${ic('clock')}${laNextText(d) || 'Нет ближайших выходов — выберите дни'}</p>` : ''}
    </div></div>`;
}
A.laToggle = d => { const dr = D(d.id), la = lineAlarm(dr); Act.setLineAlarm(d.id, { on: !la.on }); if (!la.on) toast('Будильник включён', `Выход в ${la.time}`, 'ok'); };
A.laDay = d => { const la = lineAlarm(D(d.id)), v = +d.v, days = la.days.includes(v) ? la.days.filter(x => x !== v) : la.days.concat(v); Act.setLineAlarm(d.id, { days }); };
document.addEventListener('change', e => { const i = e.target.closest('[data-la-time]'); if (i && /^\d{2}:\d{2}$/.test(i.value)) { Act.setLineAlarm(i.dataset.laTime, { time: i.value }); toast('Время выхода сохранено', i.value, 'ok'); } });

/* карточка в профиле водителя: настройки + разрешения телефона */
function laCard(d) {
  const st = alarmStatus(), la = lineAlarm(d);
  let perms = '';
  if (!HAS_ALARM) perms = `<p class="hint">${ic('alert')}Будильник звонит в Android-приложении «Трасса HQ». На iPhone пока не работает — подключим вместе с сервером.</p>`;
  else if (st) {
    const row = (ok, t, sub, act, btn) => `<div class="la-perm ${ok ? 'ok' : ''}"><i>${ic(ok ? 'check' : 'alert')}</i><div><b>${t}</b><span>${sub}</span></div>${ok ? '' : `<button class="btn acc sm" data-a="${act}">${btn}</button>`}</div>`;
    perms = `<div class="la-perms"><div class="aud-h">Чтобы будильник точно зазвонил</div>
      ${row(st.notif, 'Уведомления', st.notif ? 'Разрешены' : 'Без них будильник молчит', 'laAskNotif', 'Разрешить')}
      ${st.full === false ? row(false, 'Поверх экрана', 'Чтобы будильник открывался на весь экран', 'laAskFull', 'Разрешить') : ''}
      ${row(st.battery, 'Работа в фоне', st.battery ? 'Телефон не будет усыплять «Трассу»' : 'Иначе телефон может «усыпить» приложение', 'laAskBattery', 'Разрешить')}
      ${st.tough ? `<div class="la-perm"><i>${ic('alert')}</i><div><b>Автозапуск · ${esc(st.maker)}</b><span>${/honor|huawei/i.test(st.maker) ? 'Откроется «Запуск приложений». Найдите «Трасса HQ», выключите «Управлять автоматически» и в окошке оставьте включёнными все три: «Автозапуск», «Косвенный запуск», «Работа в фоне» → OK. Потом вернитесь назад' : 'На этом телефоне его нужно включить вручную: откроется нужная страница — найдите «Трасса HQ» и включите переключатель, потом вернитесь назад'}</span></div><button class="btn acc sm" data-a="laAutostart">Открыть</button></div>` : ''}
      <button class="btn soft la-test" data-a="laTest">${ic('bell')}Проверить будильник</button>
      <p class="hint">${ic('sparkle')}Нажмите, затем закройте приложение и заблокируйте экран. Через минуту должен зазвонить будильник. Если не зазвонил — проверьте пункты выше.</p></div>`;
  }
  return `<div class="card" id="laCard">${laForm(d, 'driver')}${la.on ? perms : ''}</div>`;
}
A.laAskNotif = () => TrassaApp.askNotif();
A.laAskBattery = () => TrassaApp.askBattery();
A.laAskFull = () => TrassaApp.askFull();
A.laAutostart = () => TrassaApp.openAutostart();
A.laTest = () => {
  const st = alarmStatus();
  if (st && !st.notif) { toast('Сначала разрешите уведомления', 'Без них будильник не зазвонит', 'bad'); return TrassaApp.askNotif(); }
  TrassaApp.alarmTest(60); toast('Будильник зазвонит через 1 минуту', 'Закройте приложение и заблокируйте экран', 'ok');
};

/* у диспетчера: окно «Выход на линию» для водителя */
A.laEdit = d => { const dr = D(d.id); modal(`<div id="laModal">${laForm(dr, 'disp')}</div><p class="hint">${ic('alert')}Будильник на телефоне водителя обновится, когда он откроет приложение «Трасса HQ».</p><div class="row end gap"><button class="btn acc" data-close>Готово</button></div>`, { title: 'Выход на линию', sub: dr.name }); };
subs.add(() => { const m = document.getElementById('laModal'); if (m) { const dr = D(m.firstElementChild.dataset.did); if (dr) m.innerHTML = laForm(dr, 'disp'); } });
