/* ============================================================
   MÓDULO 4 — Integración numérica (Escenario D)
   Costo acumulado mensual de la canasta familiar = área bajo
   la curva de precios.  Métodos: Trapecio · Simpson 1/3 · Simpson 3/8
   ============================================================ */

let intChart = null;

/* Precio diario de la canasta básica (Bs) en función del día x.
   Sube progresivamente: base 8 Bs + tendencia lineal + leve aceleración. */
const DEFAULT_FX = '8 + 0.45*x + 0.012*x^2';

function compileF(expr) {
  try {
    const code = math.parse(expr).compile();
    const f = (x) => code.evaluate({ x });
    f(1);
    return f;
  } catch (e) {
    throw new Error('No se pudo interpretar f(x). Revisa la sintaxis (ej: 8 + 0.45*x + 0.012*x^2).');
  }
}

/* ============================================================
   MÉTODOS DE INTEGRACIÓN (todos sobre n subintervalos, h=(b-a)/n)
   ============================================================ */
function trapecio(f, a, b, n) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += 2 * f(a + i * h);
  return (h / 2) * s;
}

function simpson13(f, a, b, n) {
  if (n % 2 !== 0) throw new Error('Simpson 1/3 requiere un número PAR de subintervalos.');
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  return (h / 3) * s;
}

function simpson38(f, a, b, n) {
  if (n % 3 !== 0) throw new Error('Simpson 3/8 requiere un número de subintervalos MÚLTIPLO de 3.');
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 3 === 0 ? 2 : 3) * f(a + i * h);
  return (3 * h / 8) * s;
}

/* Intenta calcular cada método; devuelve null si n no es compatible */
function safe(fn, f, a, b, n) {
  try { return fn(f, a, b, n); } catch (e) { return null; }
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
  document.getElementById('fx').value = DEFAULT_FX;
  document.getElementById('a').value = 1;
  document.getElementById('b').value = 30;
  document.getElementById('n').value = 12;
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function calcular() {
  const msg = document.getElementById('msg');
  msg.innerHTML = ''; document.getElementById('results').innerHTML = '';
  const expr = document.getElementById('fx').value.trim();
  const a = parseFloat(document.getElementById('a').value);
  const b = parseFloat(document.getElementById('b').value);
  const n = parseInt(document.getElementById('n').value);
  const method = document.getElementById('methodSelect').value;

  if (Number.isNaN(a) || Number.isNaN(b) || a >= b) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ El intervalo [a, b] no es válido (a debe ser menor que b).</div>`; return; }
  if (!n || n < 1) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ El número de subintervalos n debe ser ≥ 1.</div>`; return; }

  let f;
  try { f = compileF(expr); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  // método seleccionado
  let value, names = { trapecio: 'Trapecio', s13: 'Simpson 1/3', s38: 'Simpson 3/8' };
  try {
    if (method === 'trapecio') value = trapecio(f, a, b, n);
    else if (method === 's13') value = simpson13(f, a, b, n);
    else value = simpson38(f, a, b, n);
  } catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  renderResults(f, a, b, n, value, names[method], method);
}

/* ============================================================
   RENDER
   ============================================================ */
function renderResults(f, a, b, n, value, methodName, method) {
  const h = (b - a) / n;
  // tabla de subintervalos
  let rows = '';
  for (let i = 0; i <= n; i++) {
    const xi = a + i * h;
    rows += `<tr><td>${i}</td><td>${fmt(xi)}</td><td>${fmt(f(xi))}</td></tr>`;
  }

  // comparación de los 3 métodos
  const vT = safe(trapecio, f, a, b, n);
  const vS13 = safe(simpson13, f, a, b, n);
  const vS38 = safe(simpson38, f, a, b, n);
  // referencia "exacta": trapecio con n muy alto
  const ref = trapecio(f, a, b, 20000);
  const compRow = (name, v) => v === null
    ? `<tr><td>${name}</td><td class="text-dim">— (n incompatible)</td><td class="text-dim">—</td></tr>`
    : `<tr><td>${name}</td><td>${fmt(v)} Bs</td><td>${Math.abs(v - ref).toExponential(3)}</td></tr>`;

  // baseline: gasto si el precio NO hubiera subido (precio del primer día constante)
  const baseline = f(a) * (b - a);
  const perdida = value - baseline;

  const html = `
    <div class="result-box orange">
      <div class="text-soft mb-1">Costo acumulado · ${methodName}</div>
      <div class="big-num text-orange">${fmt(value)} Bs</div>
      <div class="text-soft mt-2 small">∫ de f(x) en [${a}, ${b}] con n = ${n}, h = ${fmt(h)}</div>
    </div>

    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Gasto real (con subida)</div><div class="value">${fmt(value)} Bs</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Gasto sin subida</div><div class="value">${fmt(baseline)} Bs</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Pérdida de poder adquisitivo</div><div class="value text-orange">${fmt(perdida)} Bs</div></div></div>
    </div>

    <h6 class="text-blue mt-4 mb-2">⚖️ Comparación automática de los 3 métodos</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>Método</th><th>Resultado</th><th>Error vs. referencia</th></tr></thead>
        <tbody>${compRow('Trapecio', vT)}${compRow('Simpson 1/3', vS13)}${compRow('Simpson 3/8', vS38)}</tbody>
      </table>
    </div>
    <p class="text-soft small mt-1">Referencia (Trapecio con n=20000): <span class="mono text-orange">${fmt(ref)} Bs</span></p>

    <h6 class="text-blue mt-4 mb-2">Tabla de subintervalos</h6>
    <div class="table-wrap">
      <table class="table table-sm"><thead><tr><th>i</th><th>xᵢ</th><th>f(xᵢ)</th></tr></thead><tbody>${rows}</tbody></table>
    </div>

    <h6 class="text-blue mt-4 mb-2">Función con el área bajo la curva sombreada</h6>
    <div class="chart-wrap"><canvas id="intCanvas"></canvas></div>

    ${interpretation(value, baseline, perdida, vT, vS13, vS38, ref)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawArea(f, a, b, n);
}

function interpretation(value, baseline, perdida, vT, vS13, vS38, ref) {
  // método más preciso
  const cands = [['Trapecio', vT], ['Simpson 1/3', vS13], ['Simpson 3/8', vS38]].filter(c => c[1] !== null);
  cands.sort((p, q) => Math.abs(p[1] - ref) - Math.abs(q[1] - ref));
  const best = cands[0][0];
  const pct = (perdida / baseline * 100).toFixed(1);
  return `<div class="interp mt-3"><h6>🧭 Interpretación económica (contexto boliviano)</h6>
    <p class="mb-2">Durante el mes, la familia gastó aproximadamente <strong>${fmt(value)} Bs</strong> en la canasta básica.
    Si los precios <strong>no hubieran subido</strong> y se hubieran mantenido en el valor del primer día, habría gastado
    solo <strong>${fmt(baseline)} Bs</strong>. La diferencia, <strong>${fmt(perdida)} Bs (${pct}%)</strong>, representa la
    <strong>pérdida de poder adquisitivo</strong> provocada por el alza de precios.</p>
    <p class="mb-0">En cuanto a precisión, el método <strong>${best}</strong> fue el más cercano a la referencia.
    En general <strong>Simpson 1/3</strong> (error O(h⁴)) supera al Trapecio (error O(h²)) para el mismo número de subintervalos.</p></div>`;
}

/* ============================================================
   GRÁFICO con área sombreada
   ============================================================ */
function drawArea(f, a, b, n) {
  if (intChart) intChart.destroy();
  const h = (b - a) / n;
  // curva suave
  const N = 160, curve = [];
  for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N; curve.push({ x, y: f(x) }); }
  // polígono de área (puntos de los subintervalos)
  const area = [];
  for (let i = 0; i <= n; i++) { const x = a + i * h; area.push({ x, y: f(x) }); }

  const ctx = document.getElementById('intCanvas');
  intChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Área aproximada', data: area, parsing: false, borderColor: 'rgba(249,115,22,.9)', backgroundColor: 'rgba(249,115,22,.22)', borderWidth: 1, pointRadius: 3, pointBackgroundColor: '#fb923c', fill: 'origin', tension: 0 },
        { label: 'f(x) = precio', data: curve, parsing: false, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, fill: false, tension: .1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Día', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'Precio (Bs)', color: '#aab6c9' }, beginAtZero: true, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' } }
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
    trapecio: { t: 'Regla del Trapecio', body:
      `<p class="text-soft mb-2">Aproxima el área uniendo cada par de puntos con una recta (trapecios):</p>
       <p class="mono text-orange">∫ ≈ (h/2)·[f(x₀) + 2Σf(xᵢ) + f(xₙ)]</p>
       <p class="text-soft mb-0">Simple y siempre aplicable. Error O(h²): el menos preciso de los tres.</p>` },
    s13: { t: 'Simpson 1/3', body:
      `<p class="text-soft mb-2">Aproxima por <strong>parábolas</strong> cada dos subintervalos. Requiere n PAR:</p>
       <p class="mono text-orange">∫ ≈ (h/3)·[f(x₀) + 4Σ_impar + 2Σ_par + f(xₙ)]</p>
       <p class="text-soft mb-0">Error O(h⁴): mucho más preciso que el Trapecio.</p>` },
    s38: { t: 'Simpson 3/8', body:
      `<p class="text-soft mb-2">Usa polinomios cúbicos cada tres subintervalos. Requiere n múltiplo de 3:</p>
       <p class="mono text-orange">∫ ≈ (3h/8)·[f(x₀) + 3Σ + 2Σ_(múlt.3) + f(xₙ)]</p>
       <p class="text-soft mb-0">Útil cuando n no es par; precisión comparable a Simpson 1/3.</p>` }
  };
  const d = data[m];
  box.innerHTML = `<h6>📘 Algoritmo: ${d.t}</h6>${d.body}`;
}

/* ---- helpers ---- */
function fmt(v) {
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(3);
  return (Math.round(v * 1e4) / 1e4).toString();
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadExample();
  document.getElementById('methodSelect').addEventListener('change', onMethodChange);
  document.getElementById('btnCalc').addEventListener('click', calcular);
  document.getElementById('btnExample').addEventListener('click', loadExample);
  onMethodChange();
});
