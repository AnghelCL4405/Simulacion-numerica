/* ============================================================
   MÓDULO 5 · ESCENARIO G — Difusión de opinión / descontento social
   Sistema de EDO ACOPLADAS (modelo N-M-D):
     N'(t) = -a·N·M + b·D     (ciudadanos neutrales)
     M'(t) =  a·N·M - c·M·D    (manifestantes activos)
     D'(t) =  k·M   - r·D      (mediadores / diálogo)
   Métodos: Euler · Heun · RK4 (versión vectorial, implementada desde cero).
   Reutiliza fmt() de modulo5-edo.js (cargado antes).
   ============================================================ */

let socialChart = null;

/* Escenario CON diálogo efectivo → el conflicto tiende a estabilizarse */
const G_STABLE = { N0: 0.85, M0: 0.15, D0: 0.05, a: 0.7, b: 0.15, c: 0.6, k: 0.4, r: 0.25, T: 60, h: 0.25 };
/* Escenario SIN mediadores → el descontento se masifica */
const G_MASS   = { N0: 0.85, M0: 0.15, D0: 0.0,  a: 0.7, b: 0.05, c: 0.0, k: 0.0, r: 0.25, T: 60, h: 0.25 };

/* Lado derecho del sistema: recibe (t, [N,M,D]) y devuelve [N',M',D'] */
function makeSocialF(p) {
  return (t, y) => {
    const [N, M, D] = y;
    return [
      -p.a * N * M + p.b * D,
       p.a * N * M - p.c * M * D,
       p.k * M     - p.r * D
    ];
  };
}

/* ---- Solucionador vectorial de un paso (Euler / Heun / RK4) ---- */
function solveSocial(f, y0, T, h, method) {
  const out = [];
  let t = 0, y = [...y0];
  const steps = Math.round(T / h);
  for (let i = 0; i <= steps; i++) {
    out.push({ t, N: y[0], M: y[1], D: y[2] });
    const k1 = f(t, y);
    if (method === 'euler') {
      y = y.map((yi, j) => yi + h * k1[j]);
    } else if (method === 'heun') {
      const yp = y.map((yi, j) => yi + h * k1[j]);          // predictor (Euler)
      const k2 = f(t + h, yp);                               // pendiente en el predictor
      y = y.map((yi, j) => yi + (h / 2) * (k1[j] + k2[j]));  // corrector
    } else { // rk4
      const k2 = f(t + h / 2, y.map((yi, j) => yi + h / 2 * k1[j]));
      const k3 = f(t + h / 2, y.map((yi, j) => yi + h / 2 * k2[j]));
      const k4 = f(t + h,     y.map((yi, j) => yi + h * k3[j]));
      y = y.map((yi, j) => yi + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    }
    t = +(t + h).toFixed(10);
  }
  return out;
}

/* ============================================================
   INTERFAZ
   ============================================================ */
function gReadParams() {
  const ids = ['g_N0', 'g_M0', 'g_D0', 'g_a', 'g_b', 'g_c', 'g_k', 'g_r', 'g_T', 'g_h'];
  const keys = ['N0', 'M0', 'D0', 'a', 'b', 'c', 'k', 'r', 'T', 'h'];
  const p = {};
  ids.forEach((id, i) => { p[keys[i]] = parseFloat(document.getElementById(id).value); });
  for (const [k, v] of Object.entries(p))
    if (Number.isNaN(v)) throw new Error(`El parámetro "${k}" no es un número válido.`);
  if (p.h <= 0 || p.T <= 0) throw new Error('El tiempo total y el paso h deben ser positivos.');
  if (p.h > p.T) throw new Error('El paso h no puede ser mayor que el tiempo total.');
  return p;
}

function gFill(p) {
  document.getElementById('g_N0').value = p.N0;
  document.getElementById('g_M0').value = p.M0;
  document.getElementById('g_D0').value = p.D0;
  document.getElementById('g_a').value = p.a;
  document.getElementById('g_b').value = p.b;
  document.getElementById('g_c').value = p.c;
  document.getElementById('g_k').value = p.k;
  document.getElementById('g_r').value = p.r;
  document.getElementById('g_T').value = p.T;
  document.getElementById('g_h').value = p.h;
  document.getElementById('g_results').innerHTML = '';
  document.getElementById('g_msg').innerHTML = '';
}

function gSimular() {
  const msg = document.getElementById('g_msg');
  msg.innerHTML = ''; document.getElementById('g_results').innerHTML = '';
  let p;
  try { p = gReadParams(); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  const method = document.getElementById('g_method').value;
  const f = makeSocialF(p);
  const series = solveSocial(f, [p.N0, p.M0, p.D0], p.T, p.h, method);

  gRender(p, series, method);
}

function gRender(p, series, method) {
  const names = { euler: 'Euler', heun: 'Heun', rk4: 'RK4' };

  // pico de manifestantes
  let peakM = -Infinity, peakT = 0;
  series.forEach(s => { if (s.M > peakM) { peakM = s.M; peakT = s.t; } });
  const last = series[series.length - 1];
  const prev = series[series.length - 2] || last;
  const finalM = last.M;
  const trendUp = finalM > p.M0;
  const settling = Math.abs(last.M - prev.M) < 1e-3;   // ¿M casi sin cambios al final?

  const estado = settling
    ? `<span class="tag tag-blue">tiende a estabilizarse</span>`
    : (trendUp ? `<span class="tag tag-orange">el conflicto sigue creciendo</span>`
               : `<span class="tag tag-blue">el conflicto se desinfla</span>`);

  // tabla
  const rows = series.map(s =>
    `<tr><td>${fmt(s.t)}</td><td>${fmt(s.N)}</td><td class="${s.M >= peakM - 1e-9 ? 'highlight-row' : ''}">${fmt(s.M)}</td><td>${fmt(s.D)}</td></tr>`
  ).join('');

  const html = `
    <div class="result-box ${trendUp && !settling ? 'orange' : ''}">
      <div class="text-soft mb-1">📣 Pico de manifestantes</div>
      <div class="big-num ${trendUp && !settling ? 'text-orange' : 'text-blue'}">${fmt(peakM)} <span style="font-size:1rem">(día ${fmt(peakT)})</span></div>
      <div class="text-soft mt-2 small">Método ${names[method]} · ${estado}</div>
    </div>

    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Manifestantes inicial M₀</div><div class="value">${fmt(p.M0)}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Manifestantes final M(${fmt(p.T)})</div><div class="value ${trendUp ? 'text-orange' : ''}">${fmt(finalM)}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Mediadores final D(${fmt(p.T)})</div><div class="value">${fmt(last.D)}</div></div></div>
    </div>

    <h6 class="text-blue mt-4 mb-2">Tabla de evolución N-M-D — ${names[method]}</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>t</th><th>N (neutrales)</th><th>M (manifestantes)</th><th>D (mediadores)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <h6 class="text-blue mt-4 mb-2">Dinámica social N(t), M(t), D(t)</h6>
    <div class="chart-wrap"><canvas id="gCanvas"></canvas></div>

    ${gInterpretation(p, peakM, peakT, finalM, trendUp, settling, names[method])}
  `;
  document.getElementById('g_results').innerHTML = `<div class="fade-in">${html}</div>`;
  gDrawChart(series);
}

function gInterpretation(p, peakM, peakT, finalM, trendUp, settling, methodName) {
  let estadoTxt;
  if (settling && !trendUp) estadoTxt = `el número de manifestantes <strong>baja y se estabiliza</strong>: el diálogo logró contener el conflicto.`;
  else if (settling) estadoTxt = `el conflicto <strong>se estabiliza</strong> en un nivel alto de manifestantes: hay tensión sostenida.`;
  else if (trendUp) estadoTxt = `el número de manifestantes <strong>sigue creciendo</strong>: el conflicto tiende a <strong>masificarse</strong>.`;
  else estadoTxt = `el número de manifestantes <strong>disminuye</strong> hacia el final del horizonte.`;

  const sinMediadores = (p.c === 0 && p.k === 0) || p.D0 === 0 && p.k === 0;
  const dialogoNota = sinMediadores
    ? `En esta corrida <strong>casi no hay mediadores</strong> (k y c bajos): el término que frena el conflicto (<span class="mono">−c·M·D</span>) desaparece y el descontento crece sin control. Sube <code>c</code> (efectividad del diálogo) y <code>k</code> (reacción institucional) para ver cómo se contiene.`
    : `El diálogo actúa por el término <span class="mono">−c·M·D</span>: a mayor <code>c</code> (efectividad) y <code>k</code> (reacción institucional que crea mediadores), antes se frena el conflicto. Si pusieras <code>c = 0</code> y <code>k = 0</code> (sin mediadores), el descontento se masificaría.`;

  return `<div class="interp mt-3"><h6>🧭 Interpretación del Escenario G (dinámica social)</h6>
    <p class="mb-2">Partiendo de <strong>N₀=${fmt(p.N0)}</strong> neutrales, <strong>M₀=${fmt(p.M0)}</strong> manifestantes y
    <strong>D₀=${fmt(p.D0)}</strong> mediadores, el modelo predice un <strong>pico de ${fmt(peakM)} manifestantes hacia el día ${fmt(peakT)}</strong>
    y un valor final de <strong>${fmt(finalM)}</strong>. Es decir, ${estadoTxt}</p>
    <p class="mb-0">${dialogoNota} El parámetro <code>a</code> (contagio del descontento) acelera la masificación, mientras que
    <code>b</code> (retorno a la neutralidad) y <code>r</code> (desgaste de mediadores) regulan el equilibrio. <strong>RK4</strong> es el método
    más fiable para este sistema acoplado; <strong>Euler</strong> puede desviarse con pasos <code>h</code> grandes.</p></div>`;
}

/* ---- Gráfico: 3 curvas N, M, D del método seleccionado ---- */
function gDrawChart(series) {
  if (socialChart) socialChart.destroy();
  socialChart = new Chart(document.getElementById('gCanvas'), {
    type: 'line',
    data: {
      labels: series.map(s => fmt(s.t)),
      datasets: [
        { label: 'N · neutrales', data: series.map(s => s.N), borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, tension: .2 },
        { label: 'M · manifestantes', data: series.map(s => s.M), borderColor: '#f97316', borderWidth: 2.5, pointRadius: 0, tension: .2 },
        { label: 'D · mediadores', data: series.map(s => s.D), borderColor: '#22c55e', borderWidth: 2.5, pointRadius: 0, tension: .2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { title: { display: true, text: 'Tiempo (días)', color: '#aab6c9' }, ticks: { color: '#8b98ad', maxTicksLimit: 16 }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'Población (fracción)', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' } }
      }
    }
  });
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  gFill(G_STABLE);
  document.getElementById('g_btnCalc').addEventListener('click', gSimular);
  document.getElementById('g_btnStable').addEventListener('click', () => gFill(G_STABLE));
  document.getElementById('g_btnMass').addEventListener('click', () => gFill(G_MASS));
});
