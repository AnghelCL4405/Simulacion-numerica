/* ============================================================
   MÓDULO 5 — Ecuaciones diferenciales (Escenario B)
   Vaciado de reservas de carburante en una planta:
        R'(t) = entrada(t) − consumo(t)
   El consumo crece con el "factor de pánico".
   Métodos: Euler · Heun · RK4
   ============================================================ */

let edoChart = null;

/* Parámetros por defecto:
   R0=10000 L · entrada=200 L/día · consumo base=400 L/día
   pánico=0.05 (el consumo crece 5%/día) · T=30 días · h=1.
   Con estos valores la reserva llega al 20% (2000 L) hacia el día 20. */
const DEFAULTS = { R0: 10000, entrada: 200, consumoBase: 400, panico: 0.05, T: 30, h: 1 };

/* Lado derecho de la EDO: dR/dt = entrada − consumo(t)
   consumo(t) = consumoBase · (1 + panico·t)  (aumenta por demanda/pánico) */
function makeF(p) {
  return (t, R) => p.entrada - p.consumoBase * (1 + p.panico * t);
}

/* ============================================================
   MÉTODOS DE UN PASO
   Cada uno devuelve arreglo de {t, R, entrada, consumo}
   ============================================================ */
function solveEuler(f, p) {
  const out = [];
  let t = 0, R = p.R0;
  const steps = Math.round(p.T / p.h);
  for (let i = 0; i <= steps; i++) {
    out.push(point(p, t, R));
    R = R + p.h * f(t, R);     // R_{n+1} = R_n + h·f
    t = +(t + p.h).toFixed(10);
  }
  return out;
}

function solveHeun(f, p) {
  const out = [];
  let t = 0, R = p.R0;
  const steps = Math.round(p.T / p.h);
  for (let i = 0; i <= steps; i++) {
    out.push(point(p, t, R));
    const k1 = f(t, R);                       // pendiente inicial
    const Rpred = R + p.h * k1;                // predictor (Euler)
    const k2 = f(t + p.h, Rpred);             // pendiente en el predictor
    R = R + (p.h / 2) * (k1 + k2);             // corrector (promedio)
    t = +(t + p.h).toFixed(10);
  }
  return out;
}

function solveRK4(f, p) {
  const out = [];
  let t = 0, R = p.R0;
  const steps = Math.round(p.T / p.h);
  for (let i = 0; i <= steps; i++) {
    out.push(point(p, t, R));
    const k1 = f(t, R);
    const k2 = f(t + p.h / 2, R + p.h / 2 * k1);
    const k3 = f(t + p.h / 2, R + p.h / 2 * k2);
    const k4 = f(t + p.h, R + p.h * k3);
    R = R + (p.h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t = +(t + p.h).toFixed(10);
  }
  return out;
}

function point(p, t, R) {
  return { t, R, entrada: p.entrada, consumo: p.consumoBase * (1 + p.panico * t) };
}

/* Detecta el primer instante en que R cae al nivel crítico (interpolando) */
function criticalDay(series, level) {
  for (let i = 1; i < series.length; i++) {
    if (series[i].R <= level) {
      const a = series[i - 1], b = series[i];
      if (a.R === b.R) return b.t;
      const t = a.t + (level - a.R) * (b.t - a.t) / (b.R - a.R); // interpolación lineal
      return t;
    }
  }
  return null; // nunca llega al nivel crítico en el horizonte
}

/* ============================================================
   INTERFAZ
   ============================================================ */
function onMethodChange() {
  renderAlgoExplanation(document.getElementById('methodSelect').value);
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function loadExample() {
  document.getElementById('R0').value = DEFAULTS.R0;
  document.getElementById('entrada').value = DEFAULTS.entrada;
  document.getElementById('consumoBase').value = DEFAULTS.consumoBase;
  document.getElementById('panico').value = DEFAULTS.panico;
  document.getElementById('T').value = DEFAULTS.T;
  document.getElementById('h').value = DEFAULTS.h;
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function readParams() {
  const p = {
    R0: parseFloat(document.getElementById('R0').value),
    entrada: parseFloat(document.getElementById('entrada').value),
    consumoBase: parseFloat(document.getElementById('consumoBase').value),
    panico: parseFloat(document.getElementById('panico').value),
    T: parseFloat(document.getElementById('T').value),
    h: parseFloat(document.getElementById('h').value)
  };
  for (const [k, v] of Object.entries(p))
    if (Number.isNaN(v)) throw new Error(`El parámetro "${k}" no es un número válido.`);
  if (p.h <= 0 || p.T <= 0) throw new Error('El tiempo total y el paso h deben ser positivos.');
  if (p.h > p.T) throw new Error('El paso h no puede ser mayor que el tiempo total.');
  return p;
}

/* ============================================================
   EJECUCIÓN PRINCIPAL
   ============================================================ */
function simular() {
  const msg = document.getElementById('msg');
  msg.innerHTML = ''; document.getElementById('results').innerHTML = '';
  let p;
  try { p = readParams(); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  const f = makeF(p);
  const level = 0.2 * p.R0;                  // nivel crítico = 20% de R0
  const method = document.getElementById('methodSelect').value;

  // se resuelven SIEMPRE los 3 métodos (para comparar en el gráfico)
  const sols = { euler: solveEuler(f, p), heun: solveHeun(f, p), rk4: solveRK4(f, p) };
  const names = { euler: 'Euler', heun: 'Heun', rk4: 'RK4' };
  const selected = sols[method];

  // día crítico según el método seleccionado
  const dCrit = criticalDay(selected, level);

  renderResults(p, sols, selected, names, method, level, dCrit);
}

function renderResults(p, sols, selected, names, method, level, dCrit) {
  // tabla del método seleccionado
  const rows = selected.map((s, i) =>
    `<tr class="${s.R <= level ? 'highlight-row' : ''}"><td>${fmt(s.t)}</td><td>${fmt(s.R)}</td><td>${fmt(s.entrada)}</td><td>${fmt(s.consumo)}</td></tr>`
  ).join('');

  // día crítico de cada método (para comparar exactitud)
  const dc = {
    euler: criticalDay(sols.euler, level),
    heun: criticalDay(sols.heun, level),
    rk4: criticalDay(sols.rk4, level)
  };

  const critBanner = dCrit !== null
    ? `<div class="result-box orange">
         <div class="text-soft mb-1">⛽ Nivel crítico (20% = ${fmt(level)} L) alcanzado</div>
         <div class="big-num text-orange">Día ${fmt(dCrit)}</div>
         <div class="text-soft mt-2 small">según el método ${names[method]}. A partir de aquí la planta entra en zona de riesgo de desabastecimiento.</div>
       </div>`
    : `<div class="alert-soft alert-ok">✅ Con estos parámetros, la reserva <strong>no llega</strong> al nivel crítico (${fmt(level)} L) dentro de los ${p.T} días simulados.</div>`;

  const finalR = selected[selected.length - 1].R;

  const html = `
    ${critBanner}
    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Reserva inicial R₀</div><div class="value">${fmt(p.R0)} L</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Reserva final (día ${p.T})</div><div class="value ${finalR <= 0 ? 'text-orange' : ''}">${fmt(finalR)} L</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Nivel crítico (20%)</div><div class="value">${fmt(level)} L</div></div></div>
    </div>

    <h6 class="text-blue mt-4 mb-2">📊 Día crítico estimado por cada método</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>Método</th><th>Día crítico</th></tr></thead>
        <tbody>
          <tr><td>Euler</td><td>${dc.euler !== null ? 'Día ' + fmt(dc.euler) : 'no alcanzado'}</td></tr>
          <tr><td>Heun</td><td>${dc.heun !== null ? 'Día ' + fmt(dc.heun) : 'no alcanzado'}</td></tr>
          <tr><td>RK4</td><td>${dc.rk4 !== null ? 'Día ' + fmt(dc.rk4) : 'no alcanzado'}</td></tr>
        </tbody>
      </table>
    </div>

    <h6 class="text-blue mt-4 mb-2">Tabla de valores — ${names[method]}</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>t (día)</th><th>R(t) reserva</th><th>entrada</th><th>consumo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <h6 class="text-blue mt-4 mb-2">Evolución de R(t) — comparación de los 3 métodos</h6>
    <div class="chart-wrap"><canvas id="edoCanvas"></canvas></div>

    ${interpretation(p, dCrit, names[method], dc)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawEdo(sols, p, level);
}

function interpretation(p, dCrit, methodName, dc) {
  const msg = dCrit !== null
    ? `Con una reserva inicial de <strong>${fmt(p.R0)} L</strong>, una entrada de ${fmt(p.entrada)} L/día y un consumo base de
       ${fmt(p.consumoBase)} L/día que crece por el pánico, la planta llega a su <strong>nivel crítico (20%) alrededor del día ${fmt(dCrit)}</strong>
       según ${methodName}. Esto da una ventana de tiempo para reforzar el reabastecimiento o racionar antes del desabastecimiento.`
    : `Con los parámetros actuales la reserva se mantiene por encima del nivel crítico durante todo el horizonte: el abastecimiento es sostenible. Prueba subir el consumo o el factor de pánico para ver el punto de quiebre.`;
  return `<div class="interp mt-3"><h6>🧭 Interpretación del escenario (contexto boliviano)</h6>
    <p class="mb-2">${msg}</p>
    <p class="mb-0">Los tres métodos estiman el día crítico en <strong>Euler ≈ ${dc.euler !== null ? fmt(dc.euler) : '—'}</strong>,
    <strong>Heun ≈ ${dc.heun !== null ? fmt(dc.heun) : '—'}</strong> y <strong>RK4 ≈ ${dc.rk4 !== null ? fmt(dc.rk4) : '—'}</strong>.
    <strong>RK4</strong> (error O(h⁵)) es el más preciso; <strong>Euler</strong> (O(h)) acumula más error con pasos grandes;
    <strong>Heun</strong> queda en medio. Reducir el paso <code>h</code> acerca a Euler y Heun al resultado de RK4.</p></div>`;
}

/* ============================================================
   GRÁFICO — 3 curvas + línea de nivel crítico
   ============================================================ */
function drawEdo(sols, p, level) {
  if (edoChart) edoChart.destroy();
  const labels = sols.rk4.map(s => fmt(s.t));
  const critLine = labels.map(() => level);
  const ctx = document.getElementById('edoCanvas');
  edoChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Euler', data: sols.euler.map(s => s.R), borderColor: '#eab308', borderWidth: 2, pointRadius: 0, tension: .15 },
        { label: 'Heun', data: sols.heun.map(s => s.R), borderColor: '#22c55e', borderWidth: 2, pointRadius: 0, tension: .15 },
        { label: 'RK4', data: sols.rk4.map(s => s.R), borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, tension: .15 },
        { label: `Nivel crítico (20% = ${fmt(level)} L)`, data: critLine, borderColor: '#ef4444', borderWidth: 2, borderDash: [7, 5], pointRadius: 0, fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { title: { display: true, text: 'Tiempo (días)', color: '#aab6c9' }, ticks: { color: '#8b98ad', maxTicksLimit: 16 }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'Reserva R(t) [L]', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' } }
      }
    }
  });
}

/* ============================================================
   EXPLICACIÓN DEL ALGORITMO
   ============================================================ */
function renderAlgoExplanation(m) {
  const box = document.getElementById('algoBox');
  const data = {
    euler: { t: 'Método de Euler', body:
      `<p class="text-soft mb-2">El más simple: avanza con la pendiente al inicio del paso.</p>
       <p class="mono text-orange">Rₙ₊₁ = Rₙ + h·f(tₙ, Rₙ)</p>
       <p class="text-soft mb-0">Error local O(h²), global O(h). Acumula error rápido si el paso es grande.</p>` },
    heun: { t: 'Método de Heun (RK2)', body:
      `<p class="text-soft mb-2">Predictor-corrector: promedia la pendiente inicial y la del predictor.</p>
       <p class="mono text-orange">k₁=f(tₙ,Rₙ); k₂=f(tₙ+h, Rₙ+h·k₁)<br>Rₙ₊₁ = Rₙ + (h/2)(k₁+k₂)</p>
       <p class="text-soft mb-0">Error global O(h²): bastante más preciso que Euler.</p>` },
    rk4: { t: 'Runge-Kutta de 4º orden (RK4)', body:
      `<p class="text-soft mb-2">Combina cuatro pendientes intermedias con pesos 1-2-2-1.</p>
       <p class="mono text-orange">Rₙ₊₁ = Rₙ + (h/6)(k₁ + 2k₂ + 2k₃ + k₄)</p>
       <p class="text-soft mb-0">Error global O(h⁴): la mejor relación precisión/costo, casi exacto aquí.</p>` }
  };
  const d = data[m];
  box.innerHTML = `<h6>📘 Algoritmo: ${d.t}</h6>${d.body}`;
}

/* ---- helpers ---- */
function fmt(v) {
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e6) return v.toExponential(3);
  return (Math.round(v * 1e4) / 1e4).toString();
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadExample();
  document.getElementById('methodSelect').addEventListener('change', onMethodChange);
  document.getElementById('btnCalc').addEventListener('click', simular);
  document.getElementById('btnExample').addEventListener('click', loadExample);
  onMethodChange();
});
