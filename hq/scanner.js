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
    Edge.load();   // готовим поиск краёв сразу, пока включается камера
    camera();
  }
  function close() { stopLive(); stopCam(); el().hidden = true; el().innerHTML = ''; document.body.classList.remove('scan-open'); S.onProgress = null; window.onresize = null; }
  function stopLive() { if (S.live) { clearTimeout(S.live.t); S.live = null; } S.liveQuad = null; }
  try { S.auto = localStorage.getItem('hq-scan-auto') !== '0'; } catch (e) { S.auto = true; }
  function stopCam() { stopLive(); if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; } }
  const top = (sub) => `<div class="sc-top"><button class="sc-ic" data-sc="close" aria-label="Закрыть">${ic('x')}</button><div class="sc-title"><b>${esc(S.opts.title || 'Сканер')}</b><span>${esc(sub)}</span></div><span class="sc-count">${S.pages.length ? S.pages.length + ' стр.' : ''}</span></div>`;
  const autoBtn = () => `<button class="sc-auto ${S.auto ? 'on' : ''}" data-sc="auto" aria-pressed="${S.auto}">${ic('sparkle')}Авто</button>`;
  const tray = () => S.pages.length ? `<div class="sc-tray">${S.pages.map((p, i) => `<div class="sc-thumb"><img src="${p.thumb}" alt=""><b>${i + 1}</b><button data-sc="delpage" data-i="${i}" aria-label="Удалить страницу">${ic('x')}</button></div>`).join('')}</div>` : '';

  /* шаг 1: камера */
  function camera() {
    el().innerHTML = top(S.pages.length ? `Страница ${S.pages.length + 1}: наведите камеру` : 'Наведите камеру на документ') + `
      <div class="sc-stage cam"><video id="scVideo" playsinline muted autoplay></video><div class="sc-frame" id="scFrame"><i></i><i></i><i></i><i></i></div><svg class="sc-live" id="scLive"><polygon/></svg><div class="sc-hint" id="scHint" hidden></div>${autoBtn()}<div class="sc-flash" id="scFlash"></div><div class="sc-msg" id="scMsg">Включаем камеру…</div></div>
      ${tray()}
      <div class="sc-bottom">
        <label class="sc-side">${ic('upload')}<span>Из галереи</span><input type="file" id="scFile" accept="image/*" multiple hidden></label>
        <button class="sc-shot" id="scShot" aria-label="Снять" disabled style="--p:0"><i></i></button>
        ${S.pages.length ? `<button class="sc-side done" data-sc="finish">${ic('check')}<span>Готово · ${S.pages.length}</span></button>` : '<span class="sc-side tip">Ровно и при<br>хорошем свете</span>'}
      </div>`;
    $('#scFile').onchange = e => { S.queue = Array.from(e.target.files || []); nextFromQueue(); };
    startCam();
  }
  async function startCam() {
    const msg = $('#scMsg'), v = $('#scVideo');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('камера недоступна в этом окне');
      try { S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: window.ImageCapture ? 1920 : 2560 }, height: { ideal: window.ImageCapture ? 1440 : 1920 } } }); }
      catch (e1) {   // веб-камеры ноутбуков иногда не принимают высокое разрешение — пробуем самый простой запрос
        if (e1 && (e1.name === 'NotAllowedError' || e1.name === 'SecurityError')) throw e1;
        S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (el().hidden || !v.isConnected) { stopCam(); return; }
      v.srcObject = S.stream; await v.play().catch(() => {});
      msg.hidden = true; $('#scShot').disabled = false;
      $('#scShot').onclick = () => capture(v);
      hint(Edge.ready() ? 'Ищем лист…' : 'Готовим автоопределение краёв…');
      Edge.load().then(ok => { if (ok && S.stream && v.isConnected) startLive(v); else hint(''); });
    } catch (e) {
      if (!msg) return;
      const n = (e && e.name) || '';
      const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      const why = n === 'NotAllowedError' || n === 'SecurityError'
        ? ['Доступ к камере запрещён', mobile ? 'Браузер запомнил «Запретить». Откройте настройки сайта (значок слева от адреса) → Камера → Разрешить, и обновите страницу. Если ссылка открыта внутри Telegram или WhatsApp — откройте её в Chrome или Safari.' : 'Нажмите на значок слева от адреса сайта (замок или камера) → Камера → Разрешить, и обновите страницу. Если не помогло: на Mac — Системные настройки → Конфиденциальность → Камера → включите браузер; на Windows — Параметры → Конфиденциальность → Камера → «Разрешить приложениям доступ».']
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? ['Камера не найдена', 'На этом устройстве браузер не видит камеру. Удобнее снимать с телефона — или загрузите готовое фото.']
        : n === 'NotReadableError' || n === 'AbortError' ? ['Камера занята другой программой', 'Закройте Zoom, Skype, Telegram-звонок или другую вкладку с камерой и нажмите «Сканировать» ещё раз.']
        : ['Камера здесь недоступна', 'Так бывает, если ссылку открыли внутри Telegram или WhatsApp. Откройте её в Chrome, Safari или Яндекс Браузере.'];
      msg.innerHTML = `<div class="sc-fallback">
        <b>${why[0]}</b>
        <p>${why[1]}</p>
        <label class="btn acc xl">${ic('camera')}${mobile ? 'Сфотографировать' : 'Выбрать фото документа'}<input type="file" accept="image/*" ${mobile ? 'capture="environment"' : 'multiple'} hidden></label>
        ${mobile ? `<label class="btn soft">${ic('upload')}Выбрать из галереи<input type="file" accept="image/*" multiple hidden></label>` : ''}
        <small>${mobile ? 'Кнопка выше откроет обычную камеру телефона — обрезка и PDF сработают как обычно.' : 'Фото можно сделать телефоном и перекинуть на компьютер — обрезка, фильтр и PDF сработают как обычно.'}${n ? ` · код: ${esc(n)}` : ''}</small>
      </div>`;
      msg.querySelectorAll('input').forEach(i => { i.onchange = ev => { S.queue = Array.from(ev.target.files || []); nextFromQueue(); }; });
      $('#scShot').hidden = true; const sb = $('#scanner .sc-bottom'); if (sb) sb.hidden = true;
    }
  }
  function hint(t, kind) { const h = $('#scHint'); if (!h) return; h.hidden = !t; h.textContent = t || ''; h.className = 'sc-hint ' + (kind || ''); }
  /* живая рамка: ищем лист в каждом кадре, рисуем контур, при неподвижности — автоснимок */
  function startLive(v) {
    stopLive();
    let prev = null, sm = null, stable = 0, miss = 0, stableSince = 0, size = 360;
    const HOLD = 900;   // столько мс лист должен быть неподвижен для автоснимка
    const run = {};
    S.live = run;
    // цикл сам подстраивается под скорость телефона: следующий кадр — после обработки текущего
    const loop = () => { if (S.live !== run) return; const t = performance.now(); tick(); const dt = performance.now() - t;
      if (dt > 180 && size > 260) size -= 40; else if (dt < 60 && size < 360) size += 20;
      run.t = setTimeout(loop, Math.max(110, dt * 1.6)); };
    const tick = () => {
      const svg = $('#scLive'), stage = $('#scanner .sc-stage.cam');
      if (!svg || !stage || !v.videoWidth) return;
      const vw = v.videoWidth, vh = v.videoHeight, q = Edge.detectIn(v, vw, vh, size);
      const cw = stage.clientWidth, ch = stage.clientHeight, poly = svg.querySelector('polygon');
      svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
      const shot = $('#scShot');
      if (!q) {
        if (++miss > 3) { sm = null; prev = null; stable = 0; S.liveQuad = null; svg.classList.remove('on', 'lock'); $('#scFrame').hidden = false; hint('Поместите лист целиком в кадр'); if (shot) shot.style.setProperty('--p', 0); }
        return;
      }
      miss = 0;
      const diag = Math.hypot(vw, vh);
      const move = prev ? Math.max(...q.map((p, i) => Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1]))) / diag : 1;
      prev = q;
      sm = sm ? sm.map((p, i) => [p[0] * .4 + q[i][0] * .6, p[1] * .4 + q[i][1] * .6]) : q;
      S.liveQuad = sm; S.liveAt = Date.now();
      const k = Math.max(cw / vw, ch / vh), dx = (cw - vw * k) / 2, dy = (ch - vh * k) / 2;
      poly.setAttribute('points', sm.map(p => `${(p[0] * k + dx).toFixed(1)},${(p[1] * k + dy).toFixed(1)}`).join(' '));
      svg.classList.add('on'); $('#scFrame').hidden = true;
      if (move < .012) { stable++; if (!stableSince) stableSince = Date.now(); } else { stable = 0; stableSince = 0; }
      const held = stableSince ? Date.now() - stableSince : 0;
      svg.classList.toggle('lock', stable >= 2);
      if (S.auto) {
        if (shot) shot.style.setProperty('--p', Math.min(1, held / HOLD));
        hint(stable >= 1 ? 'Держите ровно — снимаем…' : 'Лист найден', 'ok');
        if (held >= HOLD && stable >= 3) capture(v);
      } else hint('Лист найден — нажмите кнопку', 'ok');
    };
    loop();
  }
  /* снимок: на Android — настоящее фото с камеры (12 Мп), иначе — кадр из видео */
  async function capture(v) {
    if (!v.videoWidth || S.shooting) return;
    S.shooting = true;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
    const q = S.liveQuad && Date.now() - (S.liveAt || 0) < 2000 ? S.liveQuad.map(p => p.slice()) : null;
    stopLive();
    const f = $('#scFlash'); if (f) { f.classList.add('go'); }
    if (navigator.vibrate) navigator.vibrate(30);
    let photo = null;
    const track = S.stream && S.stream.getVideoTracks()[0];
    if (window.ImageCapture && track) {
      hint('Снимаем…', 'ok');
      try {
        const icap = new ImageCapture(track);
        const caps = await Promise.race([icap.getPhotoCapabilities(), new Promise(r => setTimeout(r, 1500))]).catch(() => null);
        const opt = caps && caps.imageWidth && caps.imageWidth.max ? { imageWidth: Math.min(caps.imageWidth.max, 4032) } : {};
        const blob = await Promise.race([icap.takePhoto(opt), new Promise((r, j) => setTimeout(() => j(new Error('долго')), 4000))]);
        const bmp = await createImageBitmap(blob);
        // фото должно быть в той же ориентации, что и видео — иначе берём кадр
        if ((bmp.width > bmp.height) === (c.width > c.height) && bmp.width > c.width) {
          const k = Math.min(1, 3400 / Math.max(bmp.width, bmp.height));
          photo = document.createElement('canvas'); photo.width = Math.round(bmp.width * k); photo.height = Math.round(bmp.height * k);
          photo.getContext('2d').drawImage(bmp, 0, 0, photo.width, photo.height);
        }
        bmp.close && bmp.close();
      } catch (e) { photo = null; }
    }
    S.shooting = false;
    stopCam();
    let preset = q;
    if (photo) {   // рамку из видео переносим на фото, если пропорции совпадают
      const sx = photo.width / c.width, sy = photo.height / c.height;
      preset = q && Math.abs(sx / sy - 1) < .03 ? q.map(p => [p[0] * sx, p[1] * sy]) : null;
    }
    setTimeout(() => crop(photo || c, preset), photo ? 0 : 120);
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
  /* чуть внутрь листа, чтобы на скан не попадала кромка фона */
  function inset(q, f = .012) { const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4; return q.map(p => [p[0] + (cx - p[0]) * f, p[1] + (cy - p[1]) * f]); }
  function crop(canvas, preset) {
    const W = canvas.width, H = canvas.height;
    S.src = canvas; S.touched = false;
    const fine = Edge.ready() ? Edge.detectIn(canvas, W, H, 900) : null;
    const auto = fine || preset || detect(canvas);
    S.corners = auto ? inset(auto) : defCorners(canvas);
    if (!Edge.ready()) Edge.load().then(ok => { if (!ok || S.src !== canvas || S.touched) return; const q = Edge.detectIn(canvas, W, H, 900); if (q && $('#scPoly')) { S.corners = inset(q); draw(); } });
    el().innerHTML = top('Подвиньте углы к краям листа') + `
      <div class="sc-stage crop"><div class="sc-fit" id="scFit"><canvas id="scCanvas"></canvas>
        <svg id="scSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon id="scPoly"/>${[0, 1, 2, 3].map(i => `<circle data-k="${i}" r="${Math.max(W, H) * .03}"/>`).join('')}</svg><div class="sc-loupe" id="scLoupe" hidden><canvas width="150" height="150"></canvas><i></i></div></div></div>
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
      try { svg.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); S.touched = true; loupe(S.corners[drag]);
    };
    const lp = $('#scLoupe'), lc = lp.querySelector('canvas'), lg = lc.getContext('2d');
    const loupe = p => {   // лупа: увеличенный кусок вокруг угла, над пальцем
      const box = $('#scFit'), k = box.clientWidth / W, z = 3, r = 150 / (k * z);
      lg.fillStyle = '#000'; lg.fillRect(0, 0, 150, 150);
      lg.drawImage(S.src, p[0] - r / 2, p[1] - r / 2, r, r, 0, 0, 150, 150);
      let x = p[0] * k - 75, y = p[1] * k - 190; if (y < -40) y = p[1] * k + 40;
      x = Math.max(0, Math.min(box.clientWidth - 150, x)); y = Math.max(-60, Math.min(box.clientHeight - 90, y));
      lp.style.left = x + 'px'; lp.style.top = y + 'px'; lp.hidden = false;
    };
    svg.onpointermove = e => { if (drag === null) return; S.corners[drag] = pt(e); S.touched = true; draw(); loupe(S.corners[drag]); };
    svg.onpointerup = svg.onpointercancel = () => { drag = null; lp.hidden = true; };
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
    const k = Math.min(1, 2480 / Math.max(W, H)); W = Math.max(40, Math.round(W * k)); H = Math.max(40, Math.round(H * k));
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
  /* фильтры. «Документ» — как в TapScanner: бумага белая, печать чёрная, синяя ручка и печати остаются цветными */
  function filter(c, kind) {
    const W = c.width, H = c.height, out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'); g.drawImage(c, 0, 0); if (kind === 'orig') return out;
    const im = g.getImageData(0, 0, W, H), d = im.data;
    // 1) фон бумаги: самый светлый цвет в каждом квадрате (текст тонкий, бумага — светлая)
    const bs = Math.max(8, Math.round(Math.max(W, H) / 90)), gw = Math.ceil(W / bs), gh = Math.ceil(H / bs);
    const bg = [new Float32Array(gw * gh), new Float32Array(gw * gh), new Float32Array(gw * gh)];
    for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
      let best = -1, r = 255, gg = 255, bb = 255;
      for (let y = by * bs, ye = Math.min(H, y + bs); y < ye; y += 2) for (let x = bx * bs, xe = Math.min(W, x + bs); x < xe; x += 2) {
        const i = (y * W + x) * 4, l = d[i] * 3 + d[i + 1] * 6 + d[i + 2];
        if (l > best) { best = l; r = d[i]; gg = d[i + 1]; bb = d[i + 2]; }
      }
      const j = by * gw + bx; bg[0][j] = r; bg[1][j] = gg; bg[2][j] = bb;
    }
    // 2) там, где квадрат весь в тексте, берём бумагу от соседей; потом сглаживаем
    const spread = (a, op, rad) => { const o = new Float32Array(a.length); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let v = op === 'max' ? 0 : 0, n = 0; for (let yy = Math.max(0, y - rad); yy <= Math.min(gh - 1, y + rad); yy++) for (let xx = Math.max(0, x - rad); xx <= Math.min(gw - 1, x + rad); xx++) { const t = a[yy * gw + xx]; if (op === 'max') { if (t > v) v = t; } else { v += t; n++; } } o[y * gw + x] = op === 'max' ? v : v / n; } return o; };
    for (let ch = 0; ch < 3; ch++) bg[ch] = spread(spread(bg[ch], 'max', 1), 'mean', 2);
    // 3) делим на фон (бумага → белая, тени и синий оттенок уходят) и усиливаем контраст
    const curve = new Uint8ClampedArray(512);
    for (let i = 0; i < 512; i++) { const x = Math.min(1, i / 256 / .86); curve[i] = Math.round(255 * Math.pow(x, 1.7)); }
    const bw = kind === 'bw';
    for (let y = 0; y < H; y++) {
      const fy = Math.min(gh - 1.001, Math.max(0, (y + .5) / bs - .5)), y0 = fy | 0, ty = fy - y0;
      for (let x = 0; x < W; x++) {
        const fx = Math.min(gw - 1.001, Math.max(0, (x + .5) / bs - .5)), x0 = fx | 0, tx = fx - x0;
        const j = y0 * gw + x0, i = (y * W + x) * 4;
        let o0, o1, o2;
        for (let ch = 0; ch < 3; ch++) {
          const B = bg[ch], v = (B[j] * (1 - tx) + B[j + 1] * tx) * (1 - ty) + (B[j + gw] * (1 - tx) + B[j + gw + 1] * tx) * ty;
          const n = Math.min(511, Math.round(d[i + ch] / Math.max(40, v) * 256));
          if (ch === 0) o0 = curve[n]; else if (ch === 1) o1 = curve[n]; else o2 = curve[n];
        }
        if (bw) { const l = (o0 * 3 + o1 * 6 + o2) / 10; o0 = o1 = o2 = l; }
        d[i] = o0; d[i + 1] = o1; d[i + 2] = o2;
      }
    }
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
    if (a === 'auto') { S.auto = !S.auto; try { localStorage.setItem('hq-scan-auto', S.auto ? '1' : '0'); } catch (e) {} b.classList.toggle('on', S.auto); b.setAttribute('aria-pressed', S.auto); const sh = $('#scShot'); if (sh) sh.style.setProperty('--p', 0); toast(S.auto ? 'Автоснимок включён' : 'Автоснимок выключен', S.auto ? 'Держите телефон ровно — снимок сделается сам' : 'Снимайте кнопкой'); }
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

  /* распознать текст на нескольких листах (для проверки ТТН) */
  async function ocr(canvases, onP) {
    const w = await ocrWorker(), out = [];
    for (let i = 0; i < canvases.length; i++) {
      S.onProgress = m => { if (m.status === 'recognizing text' && onP) onP((i + m.progress) / canvases.length, i); };
      let c = canvases[i]; const k = Math.min(1, 1800 / Math.max(c.width, c.height));
      if (k < 1) { const t = document.createElement('canvas'); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); c = t; }
      const { data } = await w.recognize(filter(c, 'bw'));
      out.push(clean(data.text || ''));
    }
    S.onProgress = null; return out;
  }
  /* «отпечаток» фото: то же самое фото даёт тот же код (ловит повторную загрузку одного снимка) */
  function fingerprint(c) {
    const N = 64, t = document.createElement('canvas'); t.width = N; t.height = N; const g = t.getContext('2d'); g.drawImage(c, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data; let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < d.length; i += 4) { const v = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) >> 6; h1 = Math.imul(h1 ^ v, 16777619); h2 = Math.imul(h2 + v, 2246822519) ^ (h2 >>> 13); }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + c.width + 'x' + c.height;
  }
  return { open, close, filter, thumb, ocr, fingerprint };
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

/* ---------- проверка ТТН: это накладная? какая дата? какой номер? ---------- */
const LAT2CYR = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', h: 'н', b: 'в', t: 'т' };
const RU_MON = ['январ', 'феврал', 'март', 'апрел', 'ма[яй]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
function ttnAnalyze(raw) {
  const low = String(raw || '').toLowerCase().replace(/ё/g, 'е');
  const T = low.replace(/[a-z]/g, c => LAT2CYR[c] || c).replace(/\s+/g, ' ');
  const G = [
    [2, /накладн/], [1, /грузоотпр|отправител/], [1, /грузопол|получател/], [1, /перевозчик/], [1, /водител/],
    [1, /погрузк|при[её]м\w* груза/], [1, /выгрузк|разгрузк|сдач\w* груза/], [1, /брутто|нетто|масс[аы]/],
    [1, /транспортн\w* средств|гос\w*\.? ?номер|регистрац\w* номер|марка/], [1, /наименовани\w* груза|груз/],
  ];
  const hits = G.filter(([, r]) => r.test(T)), score = hits.reduce((s, [w]) => s + w, 0);
  const transport = /перевозчик|водител|транспортн|погрузк|выгрузк/.test(T);
  const isTtn = score >= 5 && transport;
  // даты: 23.11.2026, 23.11.26, «23» ноября 2026
  const dates = new Set(), add = (d, m, y) => { d = +d; m = +m; y = +y; if (y < 100) y += 2000; if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2015 || y > 2099) return; dates.add(`${y}-${pad(m)}-${pad(d)}`); };
  const N = low.replace(/[oо]/g, '0').replace(/[lі|]/g, '1');
  for (const x of N.matchAll(/(?<!\d)(\d{1,2})\s?[.,\/-]\s?(\d{1,2})\s?[.,\/-]\s?(\d{4}|\d{2})(?!\d)/g)) add(x[1], x[2], x[3]);
  for (const x of T.matchAll(new RegExp(`(\\d{1,2})\\D{0,3}\\s?(${RU_MON.join('|')})\\S*\\s+(\\d{4}|\\d{2})`, 'g'))) add(x[1], RU_MON.findIndex(mm => new RegExp('^' + mm).test(x[2])) + 1, x[3]);
  // номер накладной: «накладная № 1234», «ТН № 12/5»
  let no = '';
  const m = low.match(/(?:накладн\S*|\bт\.?т?\.?н\.?)[^№\n]{0,40}?(?:№|n[°ºo2]?|no|ne|мо|н[оe])\.?\s*([a-zа-я0-9][a-zа-я0-9\-\/]{0,18})/i);
  if (m && /\d/.test(m[1])) no = m[1].toUpperCase().replace(/[^0-9A-ZА-Я\-\/]/g, '');
  return { isTtn, score, dates: [...dates].sort(), no };
}
/* решение по ТТН для рейса t: ok / bad (переснять) / dup (уже была — нельзя) */
function ttnVerdict(t, a, hash) {
  const same = db.trips.filter(x => x.id !== t.id && x.ttn);
  if (hash) for (const x of same) if (x.ttn.hash && x.ttn.hash === hash) { const o = O(x.orderId), d = D(x.driverId); return { s: 'dup', msg: 'Это фото уже прикрепляли', sub: `ТТН к рейсу №${o ? o.no : '?'} · ${d ? d.name : ''} · ${fmtDay(x.doneAt)}` }; }
  if (!a.isTtn) return { s: 'bad', why: 'не похоже на ТТН', msg: 'Это не похоже на ТТН', sub: 'Снимите накладную целиком, ровно и при хорошем свете. Чеки, паспорта и другие бумаги не подходят.' };
  const from = isoDay(t.takenAt - 2 * DAY), to = isoDay(now() + DAY), fresh = a.dates.filter(x => x >= from && x <= to), date = fresh[fresh.length - 1] || '';
  if (a.no) for (const x of same) if (x.ttn.no && x.ttn.no === a.no && (x.ttn.date && date ? x.ttn.date === date : a.no.length >= 4)) { const o = O(x.orderId), d = D(x.driverId); return { s: 'dup', no: a.no, date, msg: `ТТН №${a.no} уже есть в системе`, sub: `Сдана к рейсу №${o ? o.no : '?'} · ${d ? d.name : ''} · ${fmtDay(x.doneAt)}` }; }
  if (!a.dates.length) return { s: 'bad', why: 'не видна дата', no: a.no, msg: 'Не видна дата на ТТН', sub: 'Переснимите так, чтобы дата накладной была чёткой.' };
  if (!date) { const last = a.dates.filter(x => x <= to).pop() || a.dates[a.dates.length - 1]; return { s: 'bad', why: 'старая дата ' + fmtIso(last), no: a.no, date: last, msg: `Старая ТТН — от ${fmtIso(last)}`, sub: 'Нужна накладная этого рейса, с сегодняшней датой.' }; }
  return { s: 'ok', no: a.no, date, msg: `ТТН${a.no ? ' №' + a.no : ''} от ${fmtIso(date)}`, sub: 'Накладная распознана, дата свежая' };
}
const fmtIso = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '';

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
