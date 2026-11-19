'use strict';
/* ===================================================================
   СКАНЕР: камера → углы листа → выпрямление → фильтр «Документ»
   → несколько страниц → PDF (свой генератор) → распознавание текста
   (Tesseract rus+eng, на устройстве, без интернета)
   =================================================================== */
const Scanner = (() => {
  const S = { stream: null, src: null, corners: null, warped: null, filter: 'doc', pages: [], opts: {}, queue: [], text: '', conf: 0, fields: [] };
  let worker = null;
  const el = () => $('#scanner');

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('не загрузился ' + src)); document.head.appendChild(s); }); }
  function ocrWorker() {
    if (!worker) worker = (async () => {
      if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
      const base = new URL('ocr/', location.href).href;
      return Tesseract.createWorker(['rus', 'eng'], 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false, logger: m => S.onProgress && S.onProgress(m) });
    })().catch(e => { worker = null; throw e; });
    return worker;
  }

  function open(opts) {
    Object.assign(S, { opts: opts || {}, pages: [], queue: [], text: '', fields: [], filter: 'doc' });
    el().hidden = false; document.body.classList.add('scan-open');
    camera();
  }
  function close() { stopCam(); el().hidden = true; el().innerHTML = ''; document.body.classList.remove('scan-open'); S.onProgress = null; window.onresize = null; }
  function stopCam() { if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; } }
  const top = (sub) => `<div class="sc-top"><button class="sc-ic" data-sc="close" aria-label="Закрыть">${ic('x')}</button><div class="sc-title"><b>${esc(S.opts.title || 'Сканер')}</b><span>${esc(sub)}</span></div><span class="sc-count">${S.pages.length ? S.pages.length + ' стр.' : ''}</span></div>`;
  const tray = () => S.pages.length ? `<div class="sc-tray">${S.pages.map((p, i) => `<div class="sc-thumb"><img src="${p.thumb}" alt=""><b>${i + 1}</b><button data-sc="delpage" data-i="${i}" aria-label="Удалить страницу">${ic('x')}</button></div>`).join('')}</div>` : '';

  /* шаг 1: камера */
  function camera() {
    el().innerHTML = top(S.pages.length ? `Страница ${S.pages.length + 1}: наведите камеру` : 'Наведите камеру на документ') + `
      <div class="sc-stage cam"><video id="scVideo" playsinline muted autoplay></video><div class="sc-frame"><i></i><i></i><i></i><i></i></div><div class="sc-msg" id="scMsg">Включаем камеру…</div></div>
      ${tray()}
      <div class="sc-bottom">
        <label class="sc-side">${ic('upload')}<span>Из галереи</span><input type="file" id="scFile" accept="image/*" multiple hidden></label>
        <button class="sc-shot" id="scShot" aria-label="Снять" disabled><i></i></button>
        ${S.pages.length ? `<button class="sc-side done" data-sc="finish">${ic('check')}<span>Готово · ${S.pages.length}</span></button>` : '<span class="sc-side tip">Ровно и при<br>хорошем свете</span>'}
      </div>`;
    $('#scFile').onchange = e => { S.queue = Array.from(e.target.files || []); nextFromQueue(); };
    startCam();
  }
  async function startCam() {
    const msg = $('#scMsg'), v = $('#scVideo');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('камера недоступна в этом окне');
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      if (el().hidden || !v.isConnected) { stopCam(); return; }
      v.srcObject = S.stream; await v.play().catch(() => {});
      msg.hidden = true; $('#scShot').disabled = false;
      $('#scShot').onclick = () => { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); stopCam(); crop(c); };
    } catch (e) {
      if (!msg) return;
      msg.innerHTML = `Камера недоступна<br><small>${esc(e.message || e.name || 'нет разрешения')}</small><br><br><label class="btn acc sc-gal">${ic('upload')}Выбрать фото<input type="file" accept="image/*" multiple hidden></label>`;
      msg.querySelector('input').onchange = ev => { S.queue = Array.from(ev.target.files || []); nextFromQueue(); };
      $('#scShot').hidden = true;
    }
  }
  function nextFromQueue() {
    const f = S.queue.shift(); if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 2400 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); stopCam(); crop(c);
    };
    im.onerror = () => { toast('Не удалось открыть фото', f.name, 'bad'); nextFromQueue(); };
    im.src = url;
  }

  /* шаг 2: углы */
  const defCorners = c => { const w = c.width, h = c.height, m = .05; return [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]]; };
  function crop(canvas) {
    S.src = canvas; S.corners = detect(canvas) || defCorners(canvas);
    const W = canvas.width, H = canvas.height;
    el().innerHTML = top('Подвиньте углы к краям листа') + `
      <div class="sc-stage crop"><div class="sc-fit" id="scFit"><canvas id="scCanvas"></canvas>
        <svg id="scSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon id="scPoly"/>${[0, 1, 2, 3].map(i => `<circle data-k="${i}" r="${Math.max(W, H) * .03}"/>`).join('')}</svg></div></div>
      <div class="sc-bottom acts">
        <button class="sc-btn" data-sc="retake">${ic('camera')}Переснять</button>
        <button class="sc-btn" data-sc="rotate">${ic('refill')}Повернуть</button>
        <button class="sc-btn" data-sc="full">${ic('grid')}Весь кадр</button>
        <button class="sc-btn acc" data-sc="warp">Дальше ${ic('right')}</button>
      </div>`;
    const cv = $('#scCanvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(canvas, 0, 0);
    const fit = () => { const st = $('#scanner .sc-stage.crop'), box = $('#scFit'); if (!st || !box) return; const k = Math.min((st.clientWidth - 28) / W, (st.clientHeight - 28) / H); box.style.width = Math.floor(W * k) + 'px'; box.style.height = Math.floor(H * k) + 'px'; };
    fit(); requestAnimationFrame(fit); window.onresize = fit;
    draw();
    const svg = $('#scSvg'); let drag = null;
    const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(0, Math.min(W, q.x)), Math.max(0, Math.min(H, q.y))]; };
    svg.onpointerdown = e => {
      const c = e.target.closest('circle');
      if (c) drag = +c.dataset.k;
      else { const p = pt(e); let b = 0, bd = 1e18; S.corners.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); drag = b; S.corners[b] = p; draw(); }
      svg.setPointerCapture(e.pointerId); e.preventDefault();
    };
    svg.onpointermove = e => { if (drag === null) return; S.corners[drag] = pt(e); draw(); };
    svg.onpointerup = svg.onpointercancel = () => { drag = null; };
  }
  function draw() { $('#scPoly').setAttribute('points', S.corners.map(p => p.join(',')).join(' ')); $$('#scSvg circle').forEach((c, i) => { c.setAttribute('cx', S.corners[i][0]); c.setAttribute('cy', S.corners[i][1]); }); }
  function rotate(c) { const r = document.createElement('canvas'); r.width = c.height; r.height = c.width; const g = r.getContext('2d'); g.translate(r.width, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0); return r; }
  function detect(c) {
    try {
      const k = 160 / Math.max(c.width, c.height), w = Math.max(8, Math.round(c.width * k)), h = Math.max(8, Math.round(c.height * k));
      const t = document.createElement('canvas'); t.width = w; t.height = h; const g = t.getContext('2d'); g.drawImage(c, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); let sum = 0;
      for (let i = 0; i < w * h; i++) { L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; sum += L[i]; }
      const sorted = Array.from(L).sort((a, b) => a - b), thr = Math.max(sum / (w * h), sorted[Math.floor(w * h * .5)]) + 12;
      let tl = null, tr = null, br = null, bl = null, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
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
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x;
  }
  function homography(from, to) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = from[i], [u, v] = to[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); } return solve(A, b).concat(1); }
  function warp(src, q) {
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    const k = Math.min(1, 1700 / Math.max(W, H)); W = Math.max(40, Math.round(W * k)); H = Math.max(40, Math.round(H * k));
    const h = homography([[0, 0], [W, 0], [W, H], [0, H]], q);
    const sw = src.width, sh = src.height, sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const og = out.getContext('2d'), od = og.createImageData(W, H), o = od.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = h[6] * x + h[7] * y + 1, u = (h[0] * x + h[1] * y + h[2]) / z, v = (h[3] * x + h[4] * y + h[5]) / z;
      const x0 = Math.floor(u), y0 = Math.floor(v), i = (y * W + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { o[i] = o[i + 1] = o[i + 2] = o[i + 3] = 255; continue; }
      const fx = u - x0, fy = v - y0, a = (y0 * sw + x0) * 4, bq = a + 4, c = a + sw * 4, dq = c + 4;
      for (let ch = 0; ch < 3; ch++) o[i + ch] = (sd[a + ch] * (1 - fx) + sd[bq + ch] * fx) * (1 - fy) + (sd[c + ch] * (1 - fx) + sd[dq + ch] * fx) * fy;
      o[i + 3] = 255;
    }
    og.putImageData(od, 0, 0); return out;
  }
  function filter(c, kind) {
    const W = c.width, H = c.height, out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'); g.drawImage(c, 0, 0); if (kind === 'orig') return out;
    const im = g.getImageData(0, 0, W, H), d = im.data, n = W * H, L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    if (kind === 'doc') {
      const I = new Float64Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
      const r = Math.max(8, Math.round(Math.max(W, H) / 24));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x1 = Math.max(0, x - r), y1 = Math.max(0, y - r), x2 = Math.min(W, x + r + 1), y2 = Math.min(H, y + r + 1);
        const mean = (I[y2 * (W + 1) + x2] - I[y1 * (W + 1) + x2] - I[y2 * (W + 1) + x1] + I[y1 * (W + 1) + x1]) / ((x2 - x1) * (y2 - y1));
        L[y * W + x] = Math.min(255, L[y * W + x] / Math.max(30, mean) * 245);
      }
    }
    const hist = new Uint32Array(256); L.forEach(v => hist[Math.max(0, Math.min(255, v | 0))]++);
    let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * .01) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * .01) { hi = i; break; } }
    const sc = 255 / Math.max(20, hi - lo);
    for (let i = 0; i < n; i++) { let v = (L[i] - lo) * sc; if (kind === 'doc') v = v > 200 ? 255 : v * .9; v = Math.max(0, Math.min(255, v)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
    g.putImageData(im, 0, 0); return out;
  }
  function thumb(c, w = 260) { const k = w / c.width, t = document.createElement('canvas'); t.width = w; t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .7); }

  /* шаг 3: страница — фильтр, добавить ещё или готово */
  function page() {
    const cur = filter(S.warped, S.filter);
    S.cur = cur;
    el().innerHTML = top('Проверьте страницу') + `
      <div class="sc-stage page"><img id="scOut" src="${cur.toDataURL('image/jpeg', .85)}" alt="Страница"></div>
      <div class="sc-filters seg" id="scFilt">${[['doc', 'Документ'], ['bw', 'Ч/Б'], ['orig', 'Цвет']].map(([k, t]) => `<button data-f="${k}" class="${S.filter === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${tray()}
      <div class="sc-bottom acts">
        <button class="sc-btn" data-sc="retake">${ic('camera')}Переснять</button>
        ${S.opts.multi !== false ? `<button class="sc-btn" data-sc="addmore">${ic('plus')}Ещё страница</button>` : ''}
        <button class="sc-btn acc" data-sc="accept">${ic('check')}Готово${S.opts.multi !== false ? ' · ' + (S.pages.length + 1) + ' стр.' : ''}</button>
      </div>`;
    $('#scFilt').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.filter = b.dataset.f; page(); };
  }
  function acceptCurrent() { S.pages.push({ canvas: S.cur, thumb: thumb(S.cur) }); S.cur = null; }

  /* шаг 4: распознавание (если нужно) */
  async function finish() {
    if (!S.pages.length) return;
    if (!S.opts.ocr) return done();
    el().innerHTML = top('Распознаём текст на устройстве') + `<div class="sc-stage ocr"><div class="sc-prog"><div class="sc-ring"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20"/><circle id="scArc" cx="24" cy="24" r="20" stroke-dasharray="126" stroke-dashoffset="120"/></svg>${ic('scan')}</div><b id="scProgT">Загружаем словари…</b><span>Русский + английский · без интернета</span></div></div>${tray()}`;
    const set = (p, t) => { const a = $('#scArc'), tt = $('#scProgT'); if (a) a.setAttribute('stroke-dashoffset', 126 - 126 * Math.max(.04, p)); if (tt && t) tt.textContent = t; };
    let texts = [], confs = [];
    try {
      const w = await ocrWorker();
      for (let i = 0; i < S.pages.length; i++) {
        S.onProgress = m => { if (m.status === 'recognizing text') set((i + m.progress) / S.pages.length, `Читаем страницу ${i + 1} из ${S.pages.length}…`); };
        const src = S.filter === 'orig' ? filter(S.pages[i].canvas, 'bw') : S.pages[i].canvas;
        const { data } = await w.recognize(src);
        texts.push(clean(data.text || '')); confs.push(data.confidence || 0);
      }
    } catch (e) {
      toast('Распознавание не запустилось', location.protocol === 'file:' ? 'Откройте приложение через сервер, а не как файл' : String(e.message || e), 'bad');
    }
    S.text = texts.filter(Boolean).join('\n\n'); S.conf = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;
    S.fields = extractFields(S.text);
    result();
  }
  function result() {
    el().innerHTML = top(S.text ? `Распознано · точность ≈${S.conf}%` : 'Текст не найден') + `
      <div class="sc-res">
        <div class="sc-res-img">${S.pages.map(p => `<img src="${p.thumb}" alt="">`).join('')}</div>
        <div class="sc-res-panel">
          ${S.fields.length ? `<div class="sc-chips"><span>Найдено — нажмите, чтобы скопировать</span>${S.fields.map((f, i) => `<button class="chip-f" data-fi="${i}"><small>${esc(f.label)}</small>${esc(f.value)}</button>`).join('')}</div>` : ''}
          <textarea id="scTa" spellcheck="false" placeholder="Текст не найден. Документ всё равно можно сохранить.">${esc(S.text)}</textarea>
        </div>
      </div>
      <div class="sc-bottom acts">
        <button class="sc-btn" data-sc="copyall">${ic('copy')}Копировать текст</button>
        <button class="sc-btn acc" data-sc="save">${ic('check')}${esc(S.opts.saveLabel || 'Сохранить')}</button>
      </div>`;
  }
  function clean(t) { return t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[|]/g, 'I').trim(); }
  function done() {
    const out = { pages: S.pages.map(p => p.canvas), thumbs: S.pages.map(p => p.thumb), text: ($('#scTa') ? $('#scTa').value : S.text).trim(), fields: S.fields, conf: S.conf };
    const cb = S.opts.onDone; close(); cb && cb(out);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#scanner [data-sc]'); if (!b) return;
    const a = b.dataset.sc;
    if (a === 'close') { if (S.pages.length && !b.dataset.sure) { b.dataset.sure = 1; toast('Нажмите × ещё раз', 'Отсканированные страницы не сохранятся'); return; } close(); }
    if (a === 'retake') camera();
    if (a === 'rotate') crop(rotate(S.src));
    if (a === 'full') { S.corners = [[0, 0], [S.src.width, 0], [S.src.width, S.src.height], [0, S.src.height]]; draw(); }
    if (a === 'warp') { b.disabled = true; b.textContent = 'Выпрямляем…'; setTimeout(() => { S.warped = warp(S.src, S.corners); page(); }, 30); }
    if (a === 'addmore') { acceptCurrent(); if (S.queue.length) nextFromQueue(); else camera(); }
    if (a === 'accept') { acceptCurrent(); if (S.queue.length && S.opts.multi !== false) nextFromQueue(); else finish(); }
    if (a === 'finish') { stopCam(); finish(); }
    if (a === 'delpage') { S.pages.splice(+b.dataset.i, 1); camera(); }
    if (a === 'copyall') copyText($('#scTa').value, 'Текст');
    if (a === 'save') done();
    const fi = e.target.closest('#scanner [data-fi]');
  });
  document.addEventListener('click', e => { const f = e.target.closest('#scanner [data-fi]'); if (f) { const x = S.fields[+f.dataset.fi]; copyText(x.value, x.label); } });

  return { open, close, filter, thumb };
})();

/* поиск полезных значений в распознанном тексте */
const CYR = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
function extractFields(t) {
  const out = [], seen = new Set(), add = (type, label, value, extra) => { const k = type + value; if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ type, label, value }, extra || {})); };
  const T = String(t || '').replace(/\n/g, ' ');
  for (const m of T.matchAll(/\b(0?[1-9]|[12]\d|3[01])[.\/-](0?[1-9]|1[0-2])[.\/-]((?:19|20)\d{2})\b/g)) add('date', 'Дата', `${pad(+m[1])}.${pad(+m[2])}.${m[3]}`, { iso: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` });
  for (const m of T.matchAll(/(?<![\dА-ЯA-Z])([АВЕКМНОРСТУХABEKMHOPCTYX])\s?(\d{3})\s?([АВЕКМНОРСТУХABEKMHOPCTYX]{2})\s?(\d{2,3})(?![\d])/gi)) add('plate', 'Госномер', (m[1] + m[2] + m[3]).toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => CYR[c]) + ' ' + m[4]);
  for (const m of T.matchAll(/\b([A-HJ-NPR-Z0-9]{17})\b/g)) if (/\d/.test(m[1]) && /[A-Z]/.test(m[1])) add('vin', 'VIN', m[1]);
  const longNums = [...T.matchAll(/ИНН[\s:№]*(\d{10,12})|(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|\d{3}-\d{3}-\d{3}\s?\d{2}/gi)].map(m => m[0].replace(/\D/g, ''));
  for (const m of T.matchAll(/(?<!\d)(\d{2})\s?(\d{2})\s?(\d{6})(?!\d)/g)) { const dg = m[1] + m[2] + m[3]; if (longNums.some(n => n.includes(dg))) continue; add('series', 'Серия и номер', `${m[1]} ${m[2]} ${m[3]}`); }
  for (const m of T.matchAll(/(?:\+7|\b8)[\s(-]*(\d{3})[\s)-]*(\d{3})[\s-]*(\d{2})[\s-]*(\d{2})\b/g)) add('phone', 'Телефон', `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}`);
  for (const m of T.matchAll(/ИНН[\s:№]*(\d{10}|\d{12})\b/gi)) add('inn', 'ИНН', m[1]);
  for (const m of T.matchAll(/\b(\d{3})-(\d{3})-(\d{3})\s?(\d{2})\b/g)) add('snils', 'СНИЛС', `${m[1]}-${m[2]}-${m[3]} ${m[4]}`);
  for (const m of T.matchAll(/(?<![А-ЯЁA-Zа-яёa-z])([А-ЯA-Z]{3})\s?(\d{10})(?!\d)/g)) if (!/^(ИНН|INN|ОГР|КПП|БИК)$/i.test(m[1])) add('policy', 'Полис', `${m[1].toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => CYR[c])} ${m[2]}`);
  return out.slice(0, 16);
}

/* ---------- свой генератор PDF: JPEG-страницы без библиотек ---------- */
async function makePdf(canvases) {
  const enc = new TextEncoder(), parts = [], offs = []; let pos = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (n, body) => { offs[n] = pos; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const N = canvases.length, kids = [];
  for (let i = 0; i < N; i++) kids.push(`${3 + i * 3} 0 R`);
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${N} >>`));
  for (let i = 0; i < N; i++) {
    const c = canvases[i];
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
    const jpg = new Uint8Array(await blob.arrayBuffer());
    const land = c.width > c.height, PW = land ? 841.89 : 595.28, PH = +(PW * c.height / c.width).toFixed(2);
    const pn = 3 + i * 3, cn = pn + 1, inn = pn + 2;
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${inn} 0 R >> >> /Contents ${cn} 0 R >>`));
    obj(cn, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(inn, () => { push(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  }
  const total = 3 + N * 3, xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
