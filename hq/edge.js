'use strict';
/* ===================================================================
   ПОИСК КРАЁВ ЛИСТА (как в TapScanner): OpenCV.js на устройстве.
   Ищем самый большой четырёхугольник: несколько способов (контуры
   по краям Canny, по порогу Оцу, по адаптивному порогу), берём лучший.
   =================================================================== */
const Edge = (() => {
  let loading = null, CV = null;

  /* загрузка OpenCV один раз (10 МБ, потом из памяти телефона) */
  function load() {
    if (CV) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(res => {
      const done = m => { CV = m; res(true); };
      const s = document.createElement('script');
      s.src = 'cv/opencv.js'; s.async = true;
      s.onload = () => {
        const c = window.cv;
        if (!c) return res(false);
        if (c instanceof Promise) { c.then(m => done(m), () => res(false)); return; }
        if (c.Mat) return done(c);
        // ждём, пока OpenCV запустится (с запасным опросом на случай, если событие уже прошло)
        c.onRuntimeInitialized = () => done(c);
        let n = 0; const t = setInterval(() => { if (CV) return clearInterval(t); if (c.Mat) { clearInterval(t); done(c); } else if (++n > 100) { clearInterval(t); res(false); } }, 200);
      };
      s.onerror = () => { loading = null; res(false); };
      document.head.appendChild(s);
    });
    return loading;
  }
  const ready = () => !!CV;

  /* порядок углов: верх-лево, верх-право, низ-право, низ-лево */
  function order(pts) {
    const s = pts.map(p => p[0] + p[1]), d = pts.map(p => p[0] - p[1]);
    const tl = pts[s.indexOf(Math.min(...s))], br = pts[s.indexOf(Math.max(...s))];
    const tr = pts[d.indexOf(Math.max(...d))], bl = pts[d.indexOf(Math.min(...d))];
    return [tl, tr, br, bl];
  }
  function polyArea(q) { let a = 0; for (let i = 0; i < 4; i++) { const p = q[i], n = q[(i + 1) % 4]; a += p[0] * n[1] - n[0] * p[1]; } return Math.abs(a) / 2; }
  function angleOk(q) {
    for (let i = 0; i < 4; i++) {
      const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
      const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
      const deg = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      if (deg < 45 || deg > 135) return false;
    }
    return true;
  }

  /* найти четырёхугольник в маске (белое — кандидаты) */
  function quadsFrom(cv, bin, W, H, out) {
    const contours = new cv.MatVector(), hier = new cv.Mat();
    cv.findContours(bin, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const minA = W * H * .12, maxA = W * H * .985;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < minA) { c.delete(); continue; }
      const hull = new cv.Mat(); cv.convexHull(c, hull, false, true);
      const peri = cv.arcLength(hull, true);
      for (const eps of [.015, .02, .03, .045, .06, .08]) {
        const ap = new cv.Mat(); cv.approxPolyDP(hull, ap, eps * peri, true);
        if (ap.rows === 4) {
          const pts = []; for (let k = 0; k < 4; k++) pts.push([ap.data32S[k * 2], ap.data32S[k * 2 + 1]]);
          const q = order(pts), a = polyArea(q);
          // углы на самой кромке кадра — это фон, а не лист (лист снимают целиком)
          const mx = W * .012, my = H * .012;
          const onEdge = q.filter(p => p[0] <= mx || p[1] <= my || p[0] >= W - 1 - mx || p[1] >= H - 1 - my).length;
          if (a >= minA && a <= maxA && angleOk(q) && onEdge < 2) out.push({ q, a, fill: area / a });
          ap.delete(); break;
        }
        ap.delete();
      }
      hull.delete(); c.delete();
    }
    contours.delete(); hier.delete();
  }

  /* source: canvas (уменьшенный). Возвращает углы в его координатах или null */
  function detect(source) {
    if (!CV) return null;
    const cv = CV, W = source.width, H = source.height;
    const mats = [];
    const M = () => { const m = new cv.Mat(); mats.push(m); return m; };
    try {
      const src = cv.imread(source); mats.push(src);
      const gray = M(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      const blur = M(); cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      const k3 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)); mats.push(k3);
      const k9 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9)); mats.push(k9);
      const found = [];
      // 1) края Canny (с несколькими порогами) + закрытие разрывов
      for (const [lo, hi] of [[30, 90], [60, 160]]) {
        const e = M(); cv.Canny(blur, e, lo, hi);
        cv.dilate(e, e, k3, new cv.Point(-1, -1), 2);
        quadsFrom(cv, e, W, H, found);
      }
      // 2) светлый лист на тёмном фоне: порог Оцу
      const th = M(); cv.threshold(blur, th, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      cv.morphologyEx(th, th, cv.MORPH_CLOSE, k9);
      quadsFrom(cv, th, W, H, found);
      Edge.last = found.map(f => ({ a: Math.round(f.a / (W * H) * 100), fill: +f.fill.toFixed(2), q: f.q }));
      if (!found.length) return null;
      // лучший: тот, на котором сходятся несколько способов поиска; при равенстве — больший
      const tol = Math.hypot(W, H) * .025;
      const same = (x, y) => x.q.every((p, i) => Math.hypot(p[0] - y.q[i][0], p[1] - y.q[i][1]) < tol);
      found.forEach(f => { f.votes = found.filter(g => same(f, g)).length; });
      found.sort((a, b) => (b.votes - a.votes) || (b.a * Math.min(1, b.fill + .15)) - (a.a * Math.min(1, a.fill + .15)));
      return found[0].q;
    } catch (e) { return null; }
    finally { mats.forEach(m => { try { m.delete(); } catch (e) {} }); }
  }

  /* уменьшить картинку/кадр для быстрого поиска */
  const small = document.createElement('canvas');
  function detectIn(img, iw, ih, maxSide = 420) {
    const k = Math.min(1, maxSide / Math.max(iw, ih));
    small.width = Math.round(iw * k); small.height = Math.round(ih * k);
    small.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, small.width, small.height);
    const q = detect(small);
    return q ? q.map(p => [p[0] / k, p[1] / k]) : null;
  }
  return { load, ready, detectIn };
})();
