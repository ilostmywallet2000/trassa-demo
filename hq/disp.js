'use strict';
/* ===================================================================
   ДИСПЕТЧЕР: пульт, заявки, чаты, водители, машины, отчёты
   =================================================================== */
const Disp = {};

/* ---------- пульт ---------- */
Disp.pult = () => {
  const t0 = startOfDay(now());
  const line = db.drivers.filter(d => d.status === 'line'), broken = db.drivers.filter(d => d.status === 'broken');
  const doneToday = db.trips.filter(t => t.state === 'done' && t.doneAt >= t0);
  const work = db.trips.filter(t => t.state === 'confirmed'), pend = db.trips.filter(t => t.state === 'pending');
  const open = db.orders.filter(o => o.status === 'open' && orderLeft(o) > 0);
  const recentSpent = db.orders.filter(o => o.status === 'open' && orderLeft(o) === 0 && orderTrips(o.id).some(t => t.state !== 'done' && ACTIVE.includes(t.state) || t.doneAt > now() - 3 * HOUR));
  const freeTrips = open.reduce((s, o) => s + orderLeft(o), 0);
  const groups = [['sos', 'Нужна помощь'], ['broken', 'Поломка'], ['line', 'На линии'], ['off', 'Закончили']];
  const evs = db.events.filter(e => (e.to || []).includes('disp')).slice(-14).reverse();
  return `
  <div class="kpis">
    ${kpi('На линии', `${line.length}<small>/${db.drivers.length}</small>`, `${broken.length ? broken.length + ' с поломкой' : 'поломок нет'}`, broken.some(d => d.breakdown && d.breakdown.kind === 'sos') ? 'bad' : '', 'line')}
    ${kpi('Рейсов сегодня', doneToday.length, `${work.length} сейчас в рейсе`, '', 'trips')}
    ${kpi('Кубатура сегодня', m3(doneToday.reduce((s, t) => s + t.m3, 0)), `${db.trips.filter(t => t.state === 'done' && t.doneAt >= t0 - 6 * DAY).reduce((s, t) => s + t.m3, 0).toLocaleString('ru-RU')} м³ за 7 дней`, '', 'm3')}
    ${kpi('Свободных рейсов', freeTrips, `в ${open.length} ${plural(open.length, 'заявке', 'заявках', 'заявках')}`, 'acc', 'free')}
  </div>
  <div class="pult">
    <section class="col">
      <div class="col-h"><b>Сейчас в рейсе</b>${work.length ? `<em class="badge acc">${work.length}</em>` : ''}</div>
      ${work.length ? work.sort((a, b) => b.takenAt - a.takenAt).map(t => {
        const o = O(t.orderId), d = D(t.driverId), v = V(t.vehicleId);
        return `<div class="pcard"><div class="pc-h">${avatar(d)}<div><b>${esc(d.name)}</b><span>${plate(v, 'sm')} <small>${ago(t.takenAt)}</small></span></div></div>
          <a class="pc-o" href="#/order/${o.id}">№${o.no} · ${esc(o.cargo)} <small>осталось ${orderLeft(o)} из ${o.total}</small></a>
          <div class="row gap"><a class="btn soft grow" href="${telHref(d.phone)}">${ic('phone')}Позвонить</a><a class="btn ghost" href="#/chat/dm-${d.id}">${ic('chat')}</a></div></div>`;
      }).join('') : `<div class="calm">${ic('truck')}<span>Сейчас никто не в рейсе</span></div>`}
      <div class="col-h mt"><b>Лента событий</b></div>
      <div class="feed">${evs.length ? evs.map(e => `<div class="fe ${e.kind}"><i></i><span>${esc(e.text)}</span><small>${fmtTime(e.at)}</small></div>`).join('') : '<p class="muted sm">Здесь появятся действия водителей и механика</p>'}</div>
    </section>
    <section class="col">
      <div class="col-h"><b>Заявки сегодня</b><a class="link" href="#/orders">все</a><button class="btn acc sm" data-a="newOrder">${ic('plus')}Новая</button></div>
      <div class="olist">${open.concat(recentSpent).map(o => orderCard(o)).join('') || empty('orders', 'Нет активных заявок', 'Создайте заявку и отправьте водителям', `<button class="btn acc" data-a="newOrder">${ic('plus')}Новая заявка</button>`)}</div>
    </section>
    <section class="col">
      <div class="col-h"><b>Водители</b><a class="link" href="#/drivers">все</a></div>
      ${groups.map(([k, t]) => {
        const ds = db.drivers.filter(d => statusKey(d) === k); if (!ds.length) return '';
        return `<div class="dgroup dg-${k}"><div class="dg-h"><i class="sdot ${STATUS[k].c}"></i>${t}<em>${ds.length}</em></div>${ds.map(d => {
          const v = vehOf(d.id), at = activeTrip(d.id), ao = at && O(at.orderId);
          return `<a class="drow" href="#/driver/${d.id}">${avatar(d, 'sm')}<div class="dr-b"><b>${esc(d.name)}</b><span>${k === 'off' ? 'закончил ' + ago(d.since) : d.breakdown ? esc(d.breakdown.reason) + (d.breakdown.ack ? ' · помощь едет' : '') : at ? `№${ao.no} · ${TRIP_STATE[at.state].t.toLowerCase()}` : 'свободен · ' + dur(now() - d.since)}</span></div>${plate(v, 'sm')}</a>`;
        }).join('')}</div>`;
      }).join('')}
    </section>
  </div>`;
};

/* ---------- заявки ---------- */
Disp.orders = () => {
  const f = UI.filter.orders || 'active', q = (UI.q.orders || '').toLowerCase();
  let list = db.orders.slice().sort((a, b) => b.created - a.created);
  if (f === 'active') list = list.filter(o => o.status === 'open' && orderLeft(o) > 0);
  if (f === 'spent') list = list.filter(o => o.status === 'open' && orderLeft(o) === 0);
  if (f === 'closed') list = list.filter(o => o.status === 'closed');
  if (q) list = list.filter(o => (`${o.no} ${o.client} ${o.cargo} ${o.from.addr} ${o.to.addr}`).toLowerCase().includes(q));
  const cnt = k => db.orders.filter(o => k === 'active' ? o.status === 'open' && orderLeft(o) > 0 : k === 'spent' ? o.status === 'open' && orderLeft(o) === 0 : k === 'closed' ? o.status === 'closed' : true).length;
  return `<div class="toolbar">
      <div class="seg">${[['active', 'Активные'], ['spent', 'Потрачено'], ['closed', 'Закрытые'], ['all', 'Все']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-a="filter" data-k="orders" data-v="${k}">${t}<em>${cnt(k)}</em></button>`).join('')}</div>
      <label class="search">${ic('search')}<input id="q-orders" data-q="orders" placeholder="Номер, заказчик, адрес…" value="${esc(UI.q.orders || '')}"></label>
      <button class="btn acc" data-a="newOrder">${ic('plus')}Новая заявка</button>
    </div>
    <div class="ogrid">${list.map(o => orderCard(o)).join('') || empty('orders', 'Ничего не найдено')}</div>`;
};
Disp.order = id => {
  const o = O(id); if (!o) return empty('orders', 'Заявка не найдена');
  const left = orderLeft(o), ts = orderTrips(o.id).filter(t => t.state !== 'rejected').sort((a, b) => b.takenAt - a.takenAt);
  const vw = viewers(o), done = ts.filter(t => t.state === 'done');
  const chats = (o.chats || []).map(C).filter(Boolean);
  return `<div class="page-h"><a class="icon-btn" href="#/orders">${ic('back')}</a><div><h1>Заявка №${o.no}</h1><span>${esc(o.client)} · создана ${fmtWhen(o.created)}</span></div>
      <div class="ph-acts">
        ${o.status === 'closed' ? `<button class="btn soft" data-a="reopenOrder" data-id="${o.id}">Открыть снова</button>` : `
        <button class="btn acc" data-a="refill" data-id="${o.id}">${ic('refill')}Пополнить</button>
        <button class="btn soft" data-a="sendOrder" data-id="${o.id}">${ic('send')}Отправить</button>
        <button class="btn soft" data-a="assign" data-id="${o.id}" ${left ? '' : 'disabled'}>${ic('user')}Назначить водителя</button>`}
        <button class="icon-btn" data-a="orderMenu" data-id="${o.id}" title="Ещё">${ic('more')}</button>
      </div></div>
    <div class="ord">
      <div class="ord-main">
        <div class="card big-count ${isSpent(o) ? 'spent' : ''}">
          <div class="bc-n"><b>${left}</b><span>${o.status === 'closed' ? 'заявка закрыта' : left ? `${plural(left, 'рейс остался', 'рейса осталось', 'рейсов осталось')} из ${o.total}` : 'все рейсы разобраны'}</span></div>
          ${tripCells(o)}
          <div class="legend"><span><i class="ok"></i>выполнено ${done.length}</span><span><i class="info"></i>в работе ${ts.filter(t => t.state === 'confirmed').length}</span><span><i></i>свободно ${left}</span></div>
          ${isSpent(o) ? '<div class="stamp">ПОТРАЧЕНО</div>' : ''}
        </div>
        <div class="card"><div class="card-h"><b>${esc(o.cargo)}</b>${chip(ic('cube') + o.m3 + ' м³ / рейс')}</div>
          <div class="kv-grid">
            <div class="kv"><span>Заказчик</span><b>${esc(o.client)}</b></div>
            <div class="kv"><span>Дата и время</span><b>${new Date(o.date).toLocaleDateString('ru-RU')} с ${esc(o.time || '—')}</b></div>
            <div class="kv"><span>Кубатура выполнено</span><b>${m3(done.reduce((s, t) => s + t.m3, 0))} из ${m3(o.m3 * o.total)}</b></div>
            ${o.price ? `<div class="kv"><span>Ставка</span><b>${rub(o.price)} / рейс · ${rub(o.price * done.length)} выполнено</b></div>` : ''}
          </div>
          ${o.note ? `<div class="note">${ic('alert')}${esc(o.note)}</div>` : ''}
          ${routeBlock(o)}
        </div>
        <div class="card"><div class="card-h"><b>Рейсы</b><span class="muted">${ts.length}</span></div>${ts.length ? tripTable(ts, { noOrder: true, actions: true }) : empty('truck', 'Рейсов пока нет', 'Водители увидят заявку в чате и возьмут рейс')}</div>
      </div>
      <aside class="ord-side">
        <div class="card"><div class="card-h"><b>Сейчас открыли</b>${chip(`${vw.length} из ${left}`, vw.length >= left && left ? 'acc' : '')}</div>
          ${vw.length ? vw.map(k => { const d = D(k); return d ? `<div class="li">${avatar(d, 'sm')}<b>${esc(d.name)}</b><small class="muted">смотрит</small></div>` : ''; }).join('') : '<p class="muted sm">Никто не открыл. Одновременно открыть могут не больше водителей, чем осталось рейсов.</p>'}
        </div>
        <div class="card"><div class="card-h"><b>Отправлено</b></div>
          ${chats.length ? chats.map(c => `<a class="li" href="#/chat/${c.id}">${c.kind === 'dm' ? avatar(D(c.driverId), 'sm') : `<span class="ava sm grp">${ic(c.kind === 'all' ? 'users' : 'hash')}</span>`}<b>${esc(chatTitle(c))}</b><small class="muted">${chatMembers(c).length} вод.</small></a>`).join('') : '<p class="muted sm">Заявка ещё никому не отправлена</p>'}
        </div>
        ${(o.topups || []).length ? `<div class="card"><div class="card-h"><b>Пополнения</b></div>${o.topups.slice().reverse().map(t => `<div class="li">${chip('+' + t.n, 'acc')}<span>${nTrips(t.n)}</span><small class="muted">${fmtWhen(t.at)}</small></div>`).join('')}</div>` : ''}
      </aside>
    </div>`;
};
A.reopenOrder = d => Act.reopenOrder(d.id);
A.orderMenu = d => {
  const o = O(d.id);
  const m = modal(`<div class="menu">
    <button data-m="edit">${ic('edit')}Изменить заявку</button>
    <button data-m="dup">${ic('copy')}Дублировать на завтра</button>
    <button data-m="text">${ic('copy')}Скопировать текстом</button>
    ${o.status !== 'closed' ? `<button data-m="close" class="danger">${ic('x')}Закрыть заявку</button>` : ''}
  </div>`, { title: `Заявка №${o.no}` });
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-m]'); if (!b) return; m.close();
    if (b.dataset.m === 'edit') orderForm(o);
    if (b.dataset.m === 'dup') { const c = JSON.parse(JSON.stringify(o)); delete c.id; c.date = isoDay(now() + DAY); orderForm(c, null, 'Копия заявки №' + o.no); }
    if (b.dataset.m === 'text') copyText(orderText(o), 'Заявка');
    if (b.dataset.m === 'close' && await confirmBox('Закрыть заявку?', 'Водители больше не смогут брать по ней рейсы. Рейсы в работе останутся.', 'Закрыть', 'danger')) Act.closeOrder(o.id);
  });
};
function orderText(o) {
  return `Заявка №${o.no} — ${o.cargo}, ${nTrips(orderLeft(o))} из ${o.total}, ${o.m3} м³/рейс\n${new Date(o.date).toLocaleDateString('ru-RU')} с ${o.time}\nПогрузка: ${o.from.addr}\n${o.from.lat}, ${o.from.lng}\n${o.contactFrom.name} ${o.contactFrom.phone}\nВыгрузка: ${o.to.addr}\n${o.to.lat}, ${o.to.lng}\n${o.contactTo.name} ${o.contactTo.phone}${o.note ? '\n' + o.note : ''}`;
}
A.newOrder = d => orderForm(null, d.chat);
A.refill = d => {
  const o = O(d.id); let n = 3;
  const m = modal(`<p class="muted">Добавить рейсы в заявку №${o.no}. Водители увидят «пополнение» в чате${isSpent(o) ? ', заявка снова станет активной' : ''}.</p>
    <div class="stepper"><button data-s="-1">−</button><b id="rfN">${n}</b><button data-s="1">+</button></div>
    <div class="row gap center">${[1, 3, 5, 10].map(x => `<button class="btn soft sm" data-q="${x}">+${x}</button>`).join('')}</div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="rfGo">${ic('refill')}Пополнить</button></div>`, { title: 'Пополнение рейсов', sub: `сейчас осталось ${orderLeft(o)} из ${o.total}` });
  m.el.addEventListener('click', e => { const s = e.target.closest('[data-s]'), q = e.target.closest('[data-q]'); if (s) n = Math.max(1, n + +s.dataset.s); if (q) n = +q.dataset.q; m.$('#rfN').textContent = n; });
  m.$('#rfGo').onclick = () => { Act.refill(o.id, n); m.close(); toast(`Пополнено: +${nTrips(n)}`, `Заявка №${o.no}`, 'ok'); };
};
A.assign = d => {
  const o = O(d.id);
  const rows = db.drivers.map(x => {
    const v = vehOf(x.id), at = activeTrip(x.id);
    const why = x.status !== 'line' ? STATUS[statusKey(x)].t.toLowerCase() : !v ? 'нет машины' : v.state === 'repair' ? 'машина в ремонте' : at ? `рейс №${O(at.orderId).no}` : '';
    return { x, v, why };
  }).sort((a, b) => !!a.why - !!b.why);
  const m = modal(`<p class="muted">Водитель получит сообщение, рейс сразу в работе. Осталось рейсов: ${orderLeft(o)}.</p>
    <div class="pick">${rows.map(({ x, v, why }) => `<button class="pk ${why ? 'dis' : ''}" data-id="${x.id}" ${why ? 'disabled' : ''}>${avatar(x, 'sm')}<div><b>${esc(x.name)}</b><span>${why || 'свободен · на линии ' + dur(now() - x.since)}</span></div>${plate(v, 'sm')}</button>`).join('')}</div>`, { title: `Назначить рейс · №${o.no}`, sub: o.cargo });
  m.el.addEventListener('click', e => { const b = e.target.closest('.pk[data-id]'); if (!b || b.disabled) return; const r = Act.assignTrip(o.id, b.dataset.id); m.close(); r && r.ok ? toast('Рейс назначен', D(b.dataset.id).name, 'ok') : toast('Не получилось', r && r.why, 'bad'); });
};
A.sendOrder = d => {
  const o = O(d.id);
  const m = modal(`${audiencePicker(o.chats || [])}<div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="soGo">${ic('send')}Отправить</button></div>`, { title: `Отправить заявку №${o.no}`, sub: 'одному водителю, группе или всем', wide: true });
  bindAudience(m.el);
  m.$('#soGo').onclick = () => { const t = readAudience(m.el); if (!t.length) return toast('Выберите, кому отправить'); Act.sendOrder(o.id, t); m.close(); toast('Заявка отправлена', `${t.length} ${plural(t.length, 'чат', 'чата', 'чатов')}`, 'ok'); };
};
function audiencePicker(pre) {
  const groups = db.chats.filter(c => c.kind === 'all' || c.kind === 'group');
  return `<div class="aud">
    <div class="aud-h">Чаты</div>
    <div class="aud-chats">${groups.map(c => `<label class="ach"><input type="checkbox" value="${c.id}" ${pre.includes(c.id) ? 'checked' : ''}><span>${ic(c.kind === 'all' ? 'users' : 'hash')}<b>${esc(c.title)}</b><small>${chatMembers(c).length} вод.</small></span></label>`).join('')}
      <button type="button" class="ach new" data-a="newGroup">${ic('plus')}<b>Новая группа</b></button></div>
    <div class="aud-h">Или отдельным водителям <label class="search sm">${ic('search')}<input class="aud-q" placeholder="Поиск"></label></div>
    <div class="aud-drv">${db.drivers.map(d => `<label class="adr" data-n="${esc(d.name.toLowerCase())}"><input type="checkbox" value="d:${d.id}" ${pre.includes('dm-' + d.id) ? 'checked' : ''}>${avatar(d, 'sm')}<span><b>${esc(d.name)}</b><small>${STATUS[statusKey(d)].t}${vehOf(d.id) ? ' · ' + vehOf(d.id).plate : ''}</small></span></label>`).join('')}</div>
  </div>`;
}
function bindAudience(root) { const q = root.querySelector('.aud-q'); if (q) q.oninput = () => $$('.adr', root).forEach(l => l.hidden = !l.dataset.n.includes(q.value.toLowerCase())); }
function readAudience(root) { return $$('.aud input[type=checkbox]:checked', root).map(i => i.value); }

function orderForm(o, chatId, title) {
  const isNew = !o || !o.id;
  o = o || { client: '', cargo: '', total: 6, m3: 20, price: 0, date: isoDay(now()), time: '08:00', from: { addr: '', lat: 0, lng: 0 }, to: { addr: '', lat: 0, lng: 0 }, contactFrom: { name: '', phone: '' }, contactTo: { name: '', phone: '' }, note: '' };
  const clients = [...new Set(db.orders.map(x => x.client))];
  const co = p => p.lat ? `${p.lat}, ${p.lng}` : '';
  const pre = chatId ? [chatId] : [];
  const m = modal(`<div class="oform">
    <div class="form">
      <div class="two"><label>Заказчик<input id="of-client" list="dl-cl" value="${esc(o.client)}" placeholder="ООО «…»" autofocus></label><label>Груз<input id="of-cargo" list="dl-cargo" value="${esc(o.cargo)}" placeholder="Песок, щебень, грунт…"></label></div>
      <datalist id="dl-cl">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist><datalist id="dl-cargo">${CARGO.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="four"><label>Рейсов<input id="of-total" type="number" min="1" value="${o.total}"></label><label>м³ на рейс<input id="of-m3" type="number" min="1" value="${o.m3}"></label><label>Дата<input id="of-date" type="date" value="${o.date}"></label><label>С<input id="of-time" type="time" value="${o.time}"></label></div>
      <fieldset><legend><i class="dot a"></i>Погрузка</legend>
        <label>Адрес<input id="of-fa" value="${esc(o.from.addr)}" placeholder="Карьер, склад, котлован"></label>
        <label>Координаты <small>вставьте «55.75, 37.61» или ссылку Яндекс Карт</small><input id="of-fc" value="${esc(co(o.from))}" placeholder="55.751244, 37.618423"></label>
        <div class="two"><label>Контакт<input id="of-fn" value="${esc(o.contactFrom.name)}" placeholder="Имя, должность"></label><label>Телефон<input id="of-fp" type="tel" value="${esc(o.contactFrom.phone)}" placeholder="+7 …"></label></div>
      </fieldset>
      <fieldset><legend><i class="dot b"></i>Выгрузка</legend>
        <label>Адрес<input id="of-ta" value="${esc(o.to.addr)}" placeholder="Объект"></label>
        <label>Координаты<input id="of-tc" value="${esc(co(o.to))}" placeholder="55.751244, 37.618423"></label>
        <div class="two"><label>Контакт<input id="of-tn" value="${esc(o.contactTo.name)}"></label><label>Телефон<input id="of-tp" type="tel" value="${esc(o.contactTo.phone)}"></label></div>
      </fieldset>
      <div class="two"><label>Ставка за рейс, ₽ <small>для отчёта</small><input id="of-price" type="number" min="0" value="${o.price || ''}" placeholder="необязательно"></label><label>Комментарий для водителей<input id="of-note" value="${esc(o.note)}" placeholder="Пропуск, мойка колёс…"></label></div>
    </div>
    ${isNew ? `<div class="oform-aud"><div class="aud-title">Кому отправить</div>${audiencePicker(pre)}</div>` : ''}
  </div>
  <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="ofSave">${ic(isNew ? 'send' : 'check')}${isNew ? 'Создать и отправить' : 'Сохранить'}</button></div>`, { title: title || (isNew ? 'Новая заявка' : `Заявка №${o.no}`), wide: true, full: true });
  bindAudience(m.el);
  m.$('#ofSave').onclick = () => {
    const g = id => m.$('#of-' + id).value.trim();
    const fc = parseCoords(g('fc')), tc = parseCoords(g('tc'));
    const errs = [];
    if (!g('cargo')) errs.push('груз'); if (!g('fa')) errs.push('адрес погрузки'); if (!g('ta')) errs.push('адрес выгрузки');
    if (!fc) errs.push('координаты погрузки'); if (!tc) errs.push('координаты выгрузки');
    if (errs.length) return toast('Заполните: ' + errs.join(', '), 'Координаты: два числа через запятую', 'bad');
    const targets = isNew ? readAudience(m.el) : [];
    if (isNew && !targets.length) return toast('Выберите, кому отправить', 'Чат «Все водители», группу или отдельных водителей', 'bad');
    const data = { id: isNew ? undefined : o.id, client: g('client') || 'Без заказчика', cargo: g('cargo'), total: Math.max(1, +g('total') || 1), m3: +g('m3') || 20, date: g('date') || isoDay(now()), time: g('time'), price: +g('price') || 0, note: g('note'),
      from: { addr: g('fa'), lat: fc[0], lng: fc[1] }, to: { addr: g('ta'), lat: tc[0], lng: tc[1] }, contactFrom: { name: g('fn'), phone: g('fp') }, contactTo: { name: g('tn'), phone: g('tp') } };
    if (isNew) delete data.id;
    if (!isNew && data.total < orderUsed(o)) return toast('Рейсов не может быть меньше уже взятых', `Взято: ${orderUsed(o)}`, 'bad');
    const saved = Act.saveOrder(data, targets);
    m.close(); toast(isNew ? `Заявка №${saved.no} отправлена` : 'Заявка сохранена', isNew ? `${targets.length} ${plural(targets.length, 'чат', 'чата', 'чатов')}` : '', 'ok');
    if (isNew && !chatId) go('#/order/' + saved.id);
  };
}
function parseCoords(s) {
  s = String(s || '');
  const ll = s.match(/[?&](?:ll|pt|whatshere%5Bpoint%5D|whatshere\[point\])=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/);
  if (ll) return [+ll[2], +ll[1]];   // в ссылках Яндекса сначала долгота
  const m = s.match(/(-?\d{1,2}[.,]\d{3,})\s*[,; ]\s*(-?\d{1,3}[.,]\d{3,})/);
  if (!m) return null;
  const a = +m[1].replace(',', '.'), b = +m[2].replace(',', '.');
  return Math.abs(a) <= 90 ? [a, b] : null;
}
A.newGroup = () => {
  const m = modal(`<div class="form"><label>Название группы<input id="ng-t" placeholder="Например: Карьер Раменское" autofocus></label></div>
    <div class="aud-drv tall">${db.drivers.map(d => `<label class="adr"><input type="checkbox" value="${d.id}">${avatar(d, 'sm')}<span><b>${esc(d.name)}</b><small>${vehOf(d.id) ? vehOf(d.id).plate + ' ' + vehOf(d.id).region : 'без машины'}</small></span></label>`).join('')}</div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="ngGo">${ic('users')}Создать чат</button></div>`, { title: 'Новый групповой чат' });
  m.$('#ngGo').onclick = () => {
    const t = m.$('#ng-t').value.trim(), mem = $$('.adr input:checked', m.el).map(i => i.value);
    if (!t || !mem.length) return toast('Нужны название и участники', '', 'bad');
    const c = Act.createGroup(t, mem); m.close(); toast('Группа создана', `${t} · ${mem.length} вод.`, 'ok');
    $$('.aud-chats').forEach(box => box.insertAdjacentHTML('afterbegin', `<label class="ach"><input type="checkbox" value="${c.id}" checked><span>${ic('hash')}<b>${esc(t)}</b><small>${mem.length} вод.</small></span></label>`));
  };
};

/* ---------- чаты ---------- */
Disp.chats = id => {
  const has = !!id;
  if (id) setTimeout(() => Act.markRead('disp', id), 300);
  return `<div class="chats ${has ? 'has' : ''}">
    <div class="chats-l"><div class="cl-h"><b>Чаты</b><button class="btn soft sm" data-a="newGroup">${ic('plus')}Группа</button></div>${chatList('disp', id)}</div>
    <div class="chats-r">${has ? chatView('disp', id, { back: '#/chats' }) : empty('chat', 'Выберите чат', 'Заявки, отправленные в чат, обновляются вживую')}</div>
  </div>`;
};

/* ---------- водители ---------- */
Disp.drivers = () => {
  const f = UI.filter.drivers || 'all', q = (UI.q.drivers || '').toLowerCase();
  let list = db.drivers.slice();
  if (f !== 'all') list = list.filter(d => f === 'broken' ? d.status === 'broken' : d.status === f);
  if (q) list = list.filter(d => (d.name + ' ' + d.phone + ' ' + ((vehOf(d.id) || {}).plate || '')).toLowerCase().includes(q));
  const order = { sos: 0, broken: 1, line: 2, off: 3 };
  list.sort((a, b) => order[statusKey(a)] - order[statusKey(b)] || a.name.localeCompare(b.name));
  const t0 = startOfDay(now());
  const cnt = k => k === 'all' ? db.drivers.length : db.drivers.filter(d => d.status === k).length;
  return `<div class="toolbar">
      <div class="seg">${[['all', 'Все'], ['line', 'На линии'], ['broken', 'Поломка'], ['off', 'Закончили']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-a="filter" data-k="drivers" data-v="${k}">${t}<em>${cnt(k)}</em></button>`).join('')}</div>
      <label class="search">${ic('search')}<input id="q-drivers" data-q="drivers" placeholder="Имя, телефон, номер машины" value="${esc(UI.q.drivers || '')}"></label>
      <button class="btn acc" data-a="addDriver">${ic('plus')}Водитель</button>
    </div>
    <div class="card flush"><div class="tbl-wrap"><table class="tbl hover">
      <thead><tr><th>Водитель</th><th>Статус</th><th>Машина</th><th>Сейчас</th><th class="r">Сегодня</th><th class="r">Документы</th><th></th></tr></thead>
      <tbody>${list.map(d => {
        const v = vehOf(d.id), at = activeTrip(d.id), ts = db.trips.filter(t => t.driverId === d.id && t.state === 'done' && t.doneAt >= t0);
        return `<tr data-href="#/driver/${d.id}"><td><span class="who">${avatar(d)}<span><b>${esc(d.name)}</b><small>${esc(d.phone)}</small></span></span></td>
          <td>${statusChip(d, true)}</td><td>${plate(v, 'sm')}</td>
          <td>${at ? `<a href="#/order/${at.orderId}">№${O(at.orderId).no}</a> ${tripChip(at)}` : d.breakdown ? `<span class="muted">${esc(d.breakdown.reason)}</span>` : '<span class="muted">—</span>'}</td>
          <td class="r"><b>${ts.length}</b> <small class="muted">${m3(ts.reduce((s, t) => s + t.m3, 0))}</small></td>
          <td class="r">${d.docs.length ? chip(ic('folder') + d.docs.length) : '<span class="muted">0</span>'}</td>
          <td class="r nowrap"><a class="icon-btn sm" href="${telHref(d.phone)}" title="Позвонить">${ic('phone')}</a><a class="icon-btn sm" href="#/chat/dm-${d.id}" title="Написать">${ic('chat')}</a></td></tr>`;
      }).join('')}</tbody></table></div></div>`;
};
Disp.driver = id => `<div class="page-h"><a class="icon-btn" href="#/drivers">${ic('back')}</a><div><h1>Профиль водителя</h1></div></div>` + driverProfile(id, 'disp');
A.addDriver = () => {
  const m = modal(`<div class="form"><label>ФИО<input id="nd-n" autofocus placeholder="Имя Фамилия"></label><label>Телефон<input id="nd-p" type="tel" placeholder="+7 9…"></label></div>
    <p class="hint">${ic('sparkle')}Документы и паспортные данные удобно добавить сканом в профиле.</p>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="ndGo">${ic('plus')}Добавить</button></div>`, { title: 'Новый водитель' });
  m.$('#ndGo').onclick = () => { const n = m.$('#nd-n').value.trim(); if (!n) return; const d = Act.addDriver({ name: n, phone: m.$('#nd-p').value.trim() }); m.close(); go('#/driver/' + d.id); };
};

/* ---------- машины ---------- */
Disp.fleet = (role) => {
  const f = UI.filter.fleet || 'all', q = (UI.q.fleet || '').toLowerCase();
  let list = db.vehicles.slice();
  if (f !== 'all') list = list.filter(v => v.state === f);
  if (q) list = list.filter(v => (`${v.plate} ${v.region} ${v.model} ${(D(v.driverId) || {}).name || ''}`).toLowerCase().includes(q));
  list.sort((a, b) => (a.state === 'repair') - (b.state === 'repair') || a.plate.localeCompare(b.plate));
  const cnt = k => k === 'all' ? db.vehicles.length : db.vehicles.filter(v => v.state === k).length;
  return `<div class="toolbar">
      <div class="seg">${[['all', 'Все'], ['ready', 'Готовы'], ['repair', 'Ремонт']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-a="filter" data-k="fleet" data-v="${k}">${t}<em>${cnt(k)}</em></button>`).join('')}</div>
      <label class="search">${ic('search')}<input id="q-fleet" data-q="fleet" placeholder="Номер, модель, водитель" value="${esc(UI.q.fleet || '')}"></label>
      <button class="btn acc" data-a="addVehicle">${ic('plus')}Машина</button>
    </div>
    <div class="vgrid">${list.map(v => vehCard(v)).join('')}</div>`;
};
function vehCard(v) {
  const d = D(v.driverId), brk = d && d.breakdown;
  return `<a class="vcard ${v.state}" href="#/vehicle/${v.id}">
    <div class="vc-h">${plate(v, 'lg')}${vehChip(v)}</div>
    <div class="vc-m"><b>${esc(v.model)}</b><span>${esc(v.axle)} · ${v.volume} м³ · ${v.year}</span></div>
    ${v.state === 'repair' && v.stateNote ? `<div class="vc-note">${ic('wrench')}${esc(v.stateNote)}</div>` : ''}
    <div class="vc-d">${d ? `${avatar(d, 'sm')}<div><b>${esc(d.name)}</b>${statusChip(d)}</div>` : `<span class="ava sm grp">${ic('user')}</span><div><b class="muted">Водитель не назначен</b></div>`}</div>
    ${brk ? `<div class="vc-brk ${brk.kind}">${ic('alert')}${brk.kind === 'sos' ? 'Экстренная поломка' : 'Поломка'}: ${esc(brk.reason)}</div>` : ''}
  </a>`;
}
function vehiclePage(id, role) {
  const v = V(id); if (!v) return empty('truck', 'Машина не найдена');
  const d = D(v.driverId), tab = UI.tab['veh-' + id] || 'main';
  const log = db.assignLog.filter(x => x.vehicleId === id).slice(-8).reverse();
  const brs = db.breakdowns.filter(b => b.vehicleId === id).slice(-6).reverse();
  const mech = role === 'mech';
  return `<div class="page-h"><a class="icon-btn" href="#/fleet">${ic('back')}</a><div><h1>${esc(v.plate)} ${esc(v.region)}</h1><span>${esc(v.model)} · ${esc(v.axle)} · ${v.volume} м³</span></div></div>
    <div class="veh-hero ${v.state}">
      ${plate(v, 'xl')}
      <div class="vh-st">${vehChip(v)}${v.stateAt ? `<small class="muted">с ${fmtWhen(v.stateAt)}</small>` : ''}</div>
      <div class="vh-acts">${v.state === 'ready' ? `<button class="btn soft" data-a="vehState" data-id="${v.id}" data-v="repair">${ic('wrench')}В ремонт</button>` : `<button class="btn ok" data-a="vehState" data-id="${v.id}" data-v="ready">${ic('check')}Готова к работе</button>`}</div>
    </div>
    ${v.state === 'repair' && v.stateNote ? `<div class="note">${ic('wrench')}${esc(v.stateNote)}</div>` : ''}
    <div class="card tapin">
      <div class="card-h"><b>Водитель на машине</b>${mech ? '' : '<span class="muted sm">назначает механик</span>'}</div>
      ${d ? `<div class="ti-d">${avatar(d, 'lg')}<div><b>${esc(d.name)}</b>${statusChip(d, true)}<a href="${telHref(d.phone)}" class="link">${ic('phone')}${esc(d.phone)}</a></div></div>` : `<div class="ti-d none">${ic('user')}<b>Никто не назначен</b></div>`}
      ${mech ? `<div class="row gap wrap"><button class="btn acc grow" data-a="tapIn" data-id="${v.id}">${ic('link')}${d ? 'Пересадить водителя' : 'Посадить водителя'}</button>${d ? `<button class="btn ghost" data-a="tapOut" data-id="${v.id}">Снять</button>` : ''}</div>` : ''}
    </div>
    <div class="tabs">${[['main', 'Данные'], ['docs', `Документы <em>${v.docs.length}</em>`], ['log', 'История']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-k="veh-${id}" data-v="${k}">${t}</button>`).join('')}</div>
    ${tab === 'main' ? `<div class="card"><div class="kv-grid">
      <div class="kv"><span>Госномер</span><b>${esc(v.plate)} ${esc(v.region)}</b></div><div class="kv"><span>Модель</span><b>${esc(v.model)} ${esc(v.axle)}</b></div>
      <div class="kv"><span>Тип</span><b>${esc(v.kind)}</b></div><div class="kv"><span>Объём кузова</span><b>${v.volume} м³</b></div>
      <div class="kv"><span>Год</span><b>${v.year}</b></div><div class="kv"><span>VIN</span><b>${esc(v.vin)} <button class="link" data-a="copy" data-v="${esc(v.vin)}" data-what="VIN">${ic('copy')}</button></b></div>
    </div></div>` : ''}
    ${tab === 'docs' ? `<div class="card">${docGrid({ type: 'vehicle', id: v.id }, v.docs, role !== 'driver')}</div>` : ''}
    ${tab === 'log' ? `<div class="card"><div class="card-h"><b>Кто ездил</b></div>${log.map(x => `<div class="li">${ic('link')}<span>${x.driverId ? esc((D(x.driverId) || {}).name) : 'снят водитель'}</span><small class="muted">${fmtWhen(x.at)}</small></div>`).join('') || '<p class="muted sm">Нет записей</p>'}</div>
      <div class="card"><div class="card-h"><b>Поломки</b></div>${brs.map(b => `<div class="li">${chip(b.kind === 'sos' ? 'экстренная' : 'локальная', b.kind === 'sos' ? 'bad' : 'warn')}<span>${esc(b.reason)}${b.note ? ' — ' + esc(b.note) : ''}</span><small class="muted">${esc((D(b.driverId) || {}).name || '')} · ${fmtWhen(b.at)}</small></div>`).join('') || '<p class="muted sm">Поломок не было</p>'}</div>` : ''}`;
}
Disp.vehicle = id => vehiclePage(id, 'disp');
A.vehState = d => {
  if (d.v === 'ready') { Act.vehState(d.id, 'ready', ''); toast('Машина готова к работе', '', 'ok'); return; }
  const m = modal(`<div class="form"><label>Что ремонтируем<input id="vr-n" placeholder="Например: замена сцепления" autofocus></label></div><div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn danger" id="vrGo">${ic('wrench')}В ремонт</button></div>`, { title: 'Машина в ремонт', sub: V(d.id).plate });
  m.$('#vrGo').onclick = () => { Act.vehState(d.id, 'repair', m.$('#vr-n').value.trim()); m.close(); };
};
A.addVehicle = () => {
  const m = modal(`<div class="form">
    <div class="two"><label>Госномер<input id="nv-p" placeholder="А123ВС" autofocus></label><label>Регион<input id="nv-r" placeholder="777"></label></div>
    <div class="two"><label>Модель<input id="nv-m" placeholder="Shacman X3000"></label><label>Колёсная формула<input id="nv-a" value="8×4"></label></div>
    <div class="two"><label>Объём кузова, м³<input id="nv-v" type="number" value="25"></label><label>Год<input id="nv-y" type="number" value="2023"></label></div>
    <label>VIN<input id="nv-vin"></label></div>
    <div class="row end gap"><button class="btn ghost" data-close>Отмена</button><button class="btn acc" id="nvGo">${ic('plus')}Добавить</button></div>`, { title: 'Новая машина' });
  m.$('#nvGo').onclick = () => {
    const p = m.$('#nv-p').value.trim().toUpperCase(); if (!p) return;
    const v = Act.addVehicle({ plate: p, region: m.$('#nv-r').value.trim(), model: m.$('#nv-m').value.trim() || 'Самосвал', axle: m.$('#nv-a').value.trim(), kind: 'Самосвал', volume: +m.$('#nv-v').value || 20, year: +m.$('#nv-y').value || 2023, vin: m.$('#nv-vin').value.trim() });
    m.close(); go('#/vehicle/' + v.id);
  };
};

/* ---------- отчёты ---------- */
Disp.reports = () => {
  const p = UI.filter.rep || '7', t0 = startOfDay(now());
  const from = p === '1' ? t0 : t0 - (+p - 1) * DAY;
  const ts = db.trips.filter(t => t.state === 'done' && t.doneAt >= from);
  const sum = ts.reduce((s, t) => s + t.m3, 0), money = ts.reduce((s, t) => s + ((O(t.orderId) || {}).price || 0), 0);
  const hours = id => db.shifts.filter(s => (!id || s.driverId === id)).reduce((s, x) => s + Math.max(0, Math.min(x.end || now(), now()) - Math.max(x.start, from)), 0);
  const days = []; for (let t = from; t <= t0; t += DAY) days.push(t);
  const byDay = days.map(d => { const x = ts.filter(t => t.doneAt >= d && t.doneAt < d + DAY); return { d, n: x.length, v: x.reduce((s, t) => s + t.m3, 0) }; });
  const maxV = Math.max(1, ...byDay.map(x => x.v));
  const byDrv = db.drivers.map(d => { const x = ts.filter(t => t.driverId === d.id); return { d, n: x.length, v: x.reduce((s, t) => s + t.m3, 0), h: hours(d.id), b: db.breakdowns.filter(b => b.driverId === d.id && b.at >= from).length }; }).sort((a, b) => b.v - a.v);
  const clients = {}; ts.forEach(t => { const o = O(t.orderId); const c = clients[o.client] = clients[o.client] || { n: 0, v: 0, r: 0 }; c.n++; c.v += t.m3; c.r += o.price || 0; });
  const cargo = {}; ts.forEach(t => { const o = O(t.orderId); cargo[o.cargo] = (cargo[o.cargo] || 0) + t.m3; });
  UI.report = { byDrv, clients, from };
  return `<div class="toolbar">
      <div class="seg">${[['1', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней']].map(([k, t]) => `<button class="${p === k ? 'on' : ''}" data-a="filter" data-k="rep" data-v="${k}">${t}</button>`).join('')}</div>
      <span class="grow"></span><button class="btn soft" data-a="exportCsv">${ic('download')}Скачать для Excel</button>
    </div>
    <div class="kpis">${kpi('Рейсов', ts.length)}${kpi('Кубатура', m3(sum))}${kpi('По ставкам', money ? rub(money) : '—')}${kpi('Часов на линии', Math.round(hours() / HOUR).toLocaleString('ru-RU'))}</div>
    <div class="rep">
      <div class="card"><div class="card-h"><b>Кубатура по дням</b><span class="muted sm">столбик — м³, число — рейсы</span></div>
        <div class="bars">${byDay.map(x => `<div class="bcol" title="${fmtDay(x.d)}: ${x.n} рейсов, ${m3(x.v)}"><span class="bv">${x.v ? fmtNum(x.v) : ''}</span><div class="bb"><i style="height:${(x.v / maxV * 100).toFixed(1)}%"></i></div><b>${x.n}</b><small>${byDay.length > 10 ? new Date(x.d).getDate() : WD[new Date(x.d).getDay()] + ' ' + new Date(x.d).getDate()}</small></div>`).join('')}</div>
      </div>
      <div class="card"><div class="card-h"><b>Груз</b></div>${Object.entries(cargo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div><i style="width:${(v / sum * 100).toFixed(1)}%"></i></div><b>${m3(v)}</b></div>`).join('') || '<p class="muted sm">Нет данных</p>'}</div>
    </div>
    <div class="card flush"><div class="card-h pad"><b>По водителям</b></div><div class="tbl-wrap"><table class="tbl hover"><thead><tr><th>Водитель</th><th class="r">Рейсов</th><th class="r">Кубатура</th><th class="r">На линии</th><th class="r">м³ в час</th><th class="r">Поломок</th></tr></thead>
      <tbody>${byDrv.map(x => `<tr data-href="#/driver/${x.d.id}"><td><span class="who">${avatar(x.d, 'sm')}<b>${esc(x.d.name)}</b></span></td><td class="r"><b>${x.n}</b></td><td class="r">${m3(x.v)}</td><td class="r">${dur(x.h)}</td><td class="r">${x.h > HOUR ? fmtNum(x.v / (x.h / HOUR)) : '—'}</td><td class="r">${x.b || ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card flush"><div class="card-h pad"><b>По заказчикам</b></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Заказчик</th><th class="r">Рейсов</th><th class="r">Кубатура</th><th class="r">Сумма</th></tr></thead>
      <tbody>${Object.entries(clients).sort((a, b) => b[1].v - a[1].v).map(([k, c]) => `<tr><td><b>${esc(k)}</b></td><td class="r">${c.n}</td><td class="r">${m3(c.v)}</td><td class="r">${c.r ? rub(c.r) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
};
A.exportCsv = () => {
  const r = UI.report; if (!r) return;
  const rows = [['Водитель', 'Рейсов', 'Кубатура м3', 'Часов на линии', 'Поломок']].concat(r.byDrv.map(x => [x.d.name, x.n, x.v, (x.h / HOUR).toFixed(1).replace('.', ','), x.b]));
  rows.push([]); rows.push(['Заказчик', 'Рейсов', 'Кубатура м3', 'Сумма руб']);
  Object.entries(r.clients).forEach(([k, c]) => rows.push([k, c.n, c.v, c.r]));
  const csv = '﻿' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  saveBlob(new Blob([csv], { type: 'text/csv' }), `Трасса-отчёт-${isoDay(r.from)}—${isoDay(now())}.csv`);
};

/* ---------- настройки ---------- */
Disp.settings = () => `
  <div class="card set">
    <div class="sw-row"><div><b>Демо-движение</b><span>Водители-боты берут рейсы, пишут в чат и завершают рейсы — чтобы посмотреть пульт в работе</span></div><button class="switch ${db.settings.bots ? 'on' : ''}" data-a="toggleSet" data-k="bots"><i></i></button></div>
  </div>
  ${IN_APP ? '' : `<div class="card set"><div class="card-h"><b>Как проверить вдвоём</b></div>
    <p class="muted">Данные общие: откройте приложение на другом телефоне (или во второй вкладке) и войдите водителем или механиком — всё, что делает один, через секунду видно у другого.</p>
    <button class="btn soft" data-a="newTab">${ic('link')}Открыть вторую вкладку</button>
  </div>`}
  <div class="card set danger-zone"><div class="card-h"><b>Демо-данные</b></div><p class="muted">Вернуть всё как было: водители, машины, заявки, чаты. Ваши документы и сканы удалятся.</p><button class="btn ghost danger" data-a="resetDemo">${ic('refill')}Сбросить демо</button></div>`;
A.toggleSet = d => Act.setting(d.k, !db.settings[d.k]);
A.resetDemo = async () => { if (!await confirmBox('Сбросить демо?', Cloud.on ? 'Все изменения и документы удалятся у всех — на всех телефонах.' : 'Все изменения и загруженные документы будут удалены.', 'Сбросить', 'danger')) return; await FS.clear(); if (Cloud.on) cloudReplace(seed()); else { db = seed(); saveRaw(); emit(); } toast('Демо сброшено', Cloud.on ? 'У всех телефонов' : '', 'ok'); go('#/pult'); };
A.newTab = () => window.open(location.href.split('#')[0] + '#/login', '_blank');

/* ---------- демо-боты: работают только в одной вкладке диспетчера ---------- */
const Bots = {
  tick() {
    if (!db.settings.bots || who().role !== 'disp') return;
    window.BOT_TAB = true;
    try { this.step(); } finally { window.BOT_TAB = false; }
  },
  step() {
    const lease = db.botLease;
    if (lease && lease.tab !== TAB_ID && lease.until > now()) return;
    tx(db => { db.botLease = { tab: TAB_ID, until: now() + 15e3 }; });
    const human = db.presence || {};
    const bots = db.drivers.filter(d => !(human[d.id] > now()));
    // 1) завершить рейсы в работе
    db.trips.filter(t => t.state === 'confirmed' && now() - t.confirmedAt > 40e3 && bots.some(b => b.id === t.driverId)).slice(0, 1).forEach(t => Act.completeTrip(t.id, t.m3, null));
    // 2) открыть заявку и взять рейс
    const free = bots.filter(d => d.status === 'line' && !activeTrip(d.id) && vehOf(d.id) && vehOf(d.id).state === 'ready' && !(db.botView || {})[d.id]);
    if (free.length && Math.random() < .55) {
      const d = free[Math.floor(Math.random() * free.length)];
      const os = db.orders.filter(o => o.status === 'open' && orderLeft(o) > 0 && orderVisibleTo(o, d.id));
      const o = os[Math.floor(Math.random() * os.length)];
      if (o && Act.openOrder(o.id, d.id).ok) tx(db => { db.botView = db.botView || {}; db.botView[d.id] = { o: o.id, at: now() + 9e3 + Math.random() * 8e3 }; });
    }
    Object.entries(db.botView || {}).forEach(([did, v]) => {
      if (v.at > now()) return;
      tx(db => { delete db.botView[did]; });
      if (Math.random() < .8) { const r = Act.takeTrip(v.o, did); if (r && r.ok && Math.random() < .5) Act.send(dmChat(did) ? dmChat(did).id : ensureDmTx(did), did, ['Взял, выезжаю', 'Принял рейс', 'Еду на погрузку', 'Взял, буду через 40 минут'][Math.floor(Math.random() * 4)]); }
      else Act.releaseOrder(v.o, did);
    });
    // 3) болтовня
    if (Math.random() < .08) {
      const d = bots.filter(x => x.status === 'line')[Math.floor(Math.random() * bots.length)];
      if (d) Act.send('c-all', d.id, ['На весовой очередь, минут 30', 'Мойка колёс на выезде не работает', 'На МКАДе плотно в сторону Ярославки', 'Кто на Сычёво — там грейдер работает, аккуратно', 'Выгрузился, свободен'][Math.floor(Math.random() * 5)]);
    }
  },
};
function ensureDmTx(did) { return tx(db => ensureDm(did).id); }
setInterval(() => Bots.tick(), 5000);
