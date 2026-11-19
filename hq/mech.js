'use strict';
/* ===================================================================
   МЕХАНИК: машины (готов / ремонт), посадка водителя (tap in),
   документы водителей и машин со сканером. Заявок и чатов не видит.
   =================================================================== */
const Mech = {};
Mech.fleet = () => {
  const brk = db.drivers.filter(d => d.status === 'broken');
  return `<div class="m-top"><div><b>Машины</b><span>${db.vehicles.filter(v => v.state === 'ready').length} готовы · ${db.vehicles.filter(v => v.state === 'repair').length} в ремонте</span></div></div>
    ${brk.map(d => { const v = vehOf(d.id); return `<div class="alert-row ${d.breakdown.kind}" data-href="${v ? '#/vehicle/' + v.id : '#/driver/' + d.id}">${ic('alert')}<div><b>${d.breakdown.kind === 'sos' ? 'Экстренная поломка' : 'Поломка'} · ${v ? esc(v.plate + ' ' + v.region) : ''}</b><span>${esc(d.name)}: ${esc(d.breakdown.reason)}${d.breakdown.note ? ' — ' + esc(d.breakdown.note) : ''} · ${ago(d.breakdown.at)}</span></div><a class="icon-btn" href="${telHref(d.phone)}">${ic('phone')}</a></div>`; }).join('')}
    ${Disp.fleet('mech')}`;
};
Mech.vehicle = id => vehiclePage(id, 'mech');
Mech.drivers = () => {
  const q = (UI.q.mdrv || '').toLowerCase();
  const list = db.drivers.filter(d => !q || (d.name + ' ' + ((vehOf(d.id) || {}).plate || '')).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const need = ['Паспорт', 'Водительское удостоверение', 'Медсправка'];
  return `<div class="m-top"><div><b>Водители</b><span>${db.drivers.length} в базе</span></div><button class="btn acc sm" data-a="addDriver">${ic('plus')}Новый</button></div>
    <label class="search full">${ic('search')}<input id="q-mdrv" data-q="mdrv" placeholder="Имя или номер машины" value="${esc(UI.q.mdrv || '')}"></label>
    <div class="mlist">${list.map(d => {
      const v = vehOf(d.id), miss = need.filter(k => !d.docs.some(x => x.kind === k));
      return `<a class="mrow" href="#/driver/${d.id}">${avatar(d)}<div class="mr-b"><b>${esc(d.name)}</b><span>${miss.length ? `<em class="warn-t">нет: ${miss.map(k => k === 'Водительское удостоверение' ? 'ВУ' : k.toLowerCase()).join(', ')}</em>` : `<em class="ok-t">${ic('check')}документы есть</em>`}</span></div>${plate(v, 'sm')}</a>`;
    }).join('')}</div>`;
};
Mech.driver = id => `<div class="m-top"><a class="icon-btn" href="#/drivers">${ic('back')}</a><div><b>Водитель</b></div></div>` + driverProfile(id, 'mech');
Mech.scan = () => {
  const recent = [];
  db.drivers.forEach(d => d.docs.forEach(x => recent.push({ x, o: d, t: 'driver' })));
  db.vehicles.forEach(v => v.docs.forEach(x => recent.push({ x, o: v, t: 'vehicle' })));
  recent.sort((a, b) => b.x.at - a.x.at);
  return `<div class="m-top"><div><b>Сканер документов</b><span>камера → текст → в профиль</span></div></div>
    <button class="scan-hero" data-a="mechScan">${ic('scan')}<b>Сканировать документ</b><span>Паспорт, ВУ, медсправка, СТС, ОСАГО… Текст распознаётся прямо на телефоне</span></button>
    <button class="btn soft full" data-a="mechUpload">${ic('upload')}Загрузить готовый файл или фото</button>
    <div class="sec-h"><b>Недавно добавлены</b><span>${recent.length}</span></div>
    <div class="mlist">${recent.slice(0, 12).map(r => `<button class="mrow" data-a="openDoc" data-t="${r.t}" data-id="${r.o.id}" data-doc="${r.x.id}"><span class="doc-mini">${r.x.thumb ? `<img src="${r.x.thumb}">` : ic('file')}</span><div class="mr-b"><b>${esc(r.x.title)}</b><span>${esc(r.t === 'driver' ? r.o.name : r.o.plate + ' ' + r.o.region)} · ${ago(r.x.at)}</span></div>${ic('right')}</button>`).join('') || '<p class="muted sm">Пока пусто</p>'}</div>`;
};
function pickOwner(cb) {
  const m = modal(`<div class="tabs inline"><button class="on" data-pt="driver">Водителю</button><button data-pt="vehicle">Машине</button></div>
    <div class="pick" data-list="driver">${db.drivers.map(d => `<button class="pk" data-o="driver:${d.id}">${avatar(d, 'sm')}<div><b>${esc(d.name)}</b><span>${d.docs.length} док.</span></div>${plate(vehOf(d.id), 'sm')}</button>`).join('')}</div>
    <div class="pick" data-list="vehicle" hidden>${db.vehicles.map(v => `<button class="pk" data-o="vehicle:${v.id}">${plate(v, 'sm')}<div><b>${esc(v.model)}</b><span>${v.docs.length} док.</span></div></button>`).join('')}</div>`, { title: 'Куда сохранить документ?' });
  m.el.addEventListener('click', e => {
    const t = e.target.closest('[data-pt]');
    if (t) { $$('[data-pt]', m.el).forEach(b => b.classList.toggle('on', b === t)); $$('[data-list]', m.el).forEach(l => l.hidden = l.dataset.list !== t.dataset.pt); }
    const o = e.target.closest('[data-o]'); if (o) { const [type, id] = o.dataset.o.split(':'); m.close(); cb({ type, id }); }
  });
}
A.mechScan = () => Scanner.open({ title: 'Документ', multi: true, ocr: true, saveLabel: 'Дальше', onDone: r => pickOwner(owner => docMeta(owner, owner.type === 'driver' ? DRV_DOC_KINDS : VEH_DOC_KINDS, { pages: r.pages, thumbs: r.thumbs, text: r.text, fields: r.fields })) });
A.mechUpload = () => pickOwner(owner => addDocFlow(owner, 'upload'));
A.tapIn = d => {
  const v = V(d.id);
  const rows = db.drivers.slice().sort((a, b) => !!vehOf(a.id) - !!vehOf(b.id) || a.name.localeCompare(b.name));
  const m = modal(`<label class="search full">${ic('search')}<input id="tiQ" placeholder="Поиск водителя" autofocus></label>
    <div class="pick">${rows.map(x => { const cur = vehOf(x.id); return `<button class="pk ${cur && cur.id === v.id ? 'cur' : ''}" data-id="${x.id}" data-n="${esc(x.name.toLowerCase())}">${avatar(x, 'sm')}<div><b>${esc(x.name)}</b><span>${cur ? (cur.id === v.id ? 'уже на этой машине' : 'сейчас на другой машине') : 'свободен'}</span></div>${cur ? plate(cur, 'sm') : ''}</button>`; }).join('')}</div>`, { title: `Посадить водителя на ${v.plate} ${v.region}`, sub: v.model });
  m.$('#tiQ').oninput = e => $$('.pk', m.el).forEach(b => b.hidden = !b.dataset.n.includes(e.target.value.toLowerCase()));
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('.pk[data-id]'); if (!b) return;
    const x = D(b.dataset.id), cur = vehOf(x.id);
    if (cur && cur.id === v.id) return m.close();
    if (cur && !await confirmBox('Пересадить?', `${x.name} сейчас на ${cur.plate} ${cur.region}. Та машина останется без водителя.`, 'Пересадить')) return;
    Act.tapIn(v.id, x.id, 'mech'); m.close();
    toast('Водитель на машине', `${x.name} → ${v.plate} ${v.region}`, 'ok');
    if (navigator.vibrate) navigator.vibrate(40);
  });
};
A.tapOut = async d => { const v = V(d.id); if (await confirmBox('Снять водителя?', `${(D(v.driverId) || {}).name} больше не будет закреплён за ${v.plate}.`, 'Снять', 'danger')) Act.tapIn(v.id, null, 'mech'); };
