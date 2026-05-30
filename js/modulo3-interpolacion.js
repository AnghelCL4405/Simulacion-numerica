/* ============================================================
   MÓDULO 3 — Interpolación (Escenario C)
   Curva continua del precio de la PAPA a partir de datos dispersos.
   Métodos: Lagrange · Newton (diferencias divididas) · Splines cúbicos
   ============================================================ */

let interpChart = null;

/* Datos sugeridos por el PDF (día -> precio de la papa en Bs) */
const DEFAULT_POINTS = [
  { x: 1, y: 8 }, { x: 5, y: 10 }, { x: 10, y: 13 },
  { x: 15, y: 16 }, { x: 20, y: 19 }, { x: 30, y: 22 }
];

/* ============================================================
   TABLA EDITABLE DE PUNTOS
   ============================================================ */
function renderPointsTable(points) {
  const tbody = document.getElementById('pointsBody');
  tbody.innerHTML = '';
  points.forEach((p, i) => addRow(p.x, p.y));
}

function addRow(x = '', y = '') {
  const tbody = document.getElementById('pointsBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" step="any" class="form-control form-control-sm px-i" value="${x}"></td>
    <td><input type="number" step="any" class="form-control form-control-sm py-i" value="${y}"></td>
    <td class="text-center"><button class="btn btn-sm btn-ghost" onclick="this.closest('tr').remove()">✕</button></td>`;
  tbody.appendChild(tr);
}

function readPoints() {
  const xs = [...document.querySelectorAll('.px-i')].map(i => parseFloat(i.value));
  const ys = [...document.querySelectorAll('.py-i')].map(i => parseFloat(i.value));
  const pts = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isNaN(xs[i]) || Number.isNaN(ys[i])) continue;
    pts.push({ x: xs[i], y: ys[i] });
  }
  pts.sort((a, b) => a.x - b.x);
  // valida que no haya x repetidos
  for (let i = 1; i < pts.length; i++)
    if (pts[i].x === pts[i - 1].x) throw new Error(`Hay dos puntos con el mismo día x = ${pts[i].x}. Los valores de x deben ser distintos.`);
  if (pts.length < 2) throw new Error('Se necesitan al menos 2 puntos para interpolar.');
  return pts;
}

/* ============================================================
   MÉTODO 1 — LAGRANGE
   P(x) = Σ yᵢ · Lᵢ(x),  Lᵢ(x) = Π (x−xⱼ)/(xᵢ−xⱼ)
   ============================================================ */
function lagrangeEval(pts, x) {
  const n = pts.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let Li = 1;
    for (let j = 0; j < n; j++)
      if (j !== i) Li *= (x - pts[j].x) / (pts[i].x - pts[j].x);
    sum += pts[i].y * Li;
  }
  return sum;
}
// coeficientes (peso base de cada término) para mostrar en tabla
function lagrangeWeights(pts) {
  return pts.map((p, i) => {
    let denom = 1;
    for (let j = 0; j < pts.length; j++) if (j !== i) denom *= (p.x - pts[j].x);
    return { i: i + 1, xi: p.x, yi: p.y, denom };
  });
}

/* ============================================================
   MÉTODO 2 — NEWTON (diferencias divididas)
   ============================================================ */
function dividedDifferences(pts) {
  const n = pts.length;
  // tabla[i][j] = diferencia dividida de orden j empezando en i
  const table = Array.from({ length: n }, (_, i) => [pts[i].y]);
  for (let j = 1; j < n; j++)
    for (let i = 0; i < n - j; i++)
      table[i][j] = (table[i + 1][j - 1] - table[i][j - 1]) / (pts[i + j].x - pts[i].x);
  // coeficientes = primera fila de la tabla
  const coef = table[0];
  return { table, coef };
}
function newtonEval(pts, coef, x) {
  let result = coef[0], prod = 1;
  for (let i = 1; i < coef.length; i++) {
    prod *= (x - pts[i - 1].x);
    result += coef[i] * prod;
  }
  return result;
}

/* ============================================================
   MÉTODO 3 — SPLINES CÚBICOS NATURALES
   Resuelve el sistema tridiagonal de las segundas derivadas (M).
   ============================================================ */
function cubicSpline(pts) {
  const n = pts.length - 1;            // número de tramos
  const x = pts.map(p => p.x), y = pts.map(p => p.y);
  const h = []; for (let i = 0; i < n; i++) h.push(x[i + 1] - x[i]);

  // sistema tridiagonal para M (segundas derivadas), spline natural M0=Mn=0
  const a = new Array(n + 1).fill(0), b = new Array(n + 1).fill(0),
        c = new Array(n + 1).fill(0), d = new Array(n + 1).fill(0);
  b[0] = 1; b[n] = 1;                  // condiciones naturales
  for (let i = 1; i < n; i++) {
    a[i] = h[i - 1];
    b[i] = 2 * (h[i - 1] + h[i]);
    c[i] = h[i];
    d[i] = 6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]);
  }
  // Algoritmo de Thomas (eliminación tridiagonal)
  for (let i = 1; i <= n; i++) {
    const w = a[i] / b[i - 1];
    b[i] -= w * c[i - 1];
    d[i] -= w * d[i - 1];
  }
  const M = new Array(n + 1).fill(0);
  M[n] = d[n] / b[n];
  for (let i = n - 1; i >= 0; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i];

  // función evaluadora por tramos
  const evaluate = (xi) => {
    let k = n - 1;
    for (let i = 0; i < n; i++) if (xi >= x[i] && xi <= x[i + 1]) { k = i; break; }
    if (xi < x[0]) k = 0; if (xi > x[n]) k = n - 1;
    const dx = xi - x[k], hk = h[k];
    const A = (x[k + 1] - xi) / hk, B = (xi - x[k]) / hk;
    return A * y[k] + B * y[k + 1] +
      ((A ** 3 - A) * M[k] + (B ** 3 - B) * M[k + 1]) * (hk * hk) / 6;
  };
  return { M, evaluate };
}

/* ============================================================
   EJECUCIÓN PRINCIPAL
   ============================================================ */
function onMethodChange() {
  renderAlgoExplanation(document.getElementById('methodSelect').value);
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function loadExample() {
  renderPointsTable(DEFAULT_POINTS);
  document.getElementById('evalX').value = 12;
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function calcular() {
  const msg = document.getElementById('msg');
  msg.innerHTML = ''; document.getElementById('results').innerHTML = '';
  let pts;
  try { pts = readPoints(); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  const method = document.getElementById('methodSelect').value;
  const xEval = parseFloat(document.getElementById('evalX').value);
  if (Number.isNaN(xEval)) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ Ingresa un día válido para evaluar.</div>`; return; }

  // advertencia de extrapolación
  const xs = pts.map(p => p.x);
  let warn = '';
  if (xEval < Math.min(...xs) || xEval > Math.max(...xs))
    warn = `<div class="alert-soft alert-warn mb-2">ℹ️ El día ${xEval} está fuera del rango de datos [${Math.min(...xs)}, ${Math.max(...xs)}]: se trata de una <strong>extrapolación</strong>, menos confiable.</div>`;

  let yEval, coefHtml, curve;
  const names = { lagrange: 'Lagrange', newton: 'Newton', spline: 'Splines cúbicos' };

  if (method === 'lagrange') {
    yEval = lagrangeEval(pts, xEval);
    curve = (x) => lagrangeEval(pts, x);
    const w = lagrangeWeights(pts);
    coefHtml = `<h6 class="text-blue mt-4 mb-2">Pesos de cada término Lᵢ(x)</h6>
      <div class="table-wrap"><table class="table table-sm"><thead><tr><th>i</th><th>xᵢ</th><th>yᵢ</th><th>Π(xᵢ−xⱼ)</th></tr></thead>
      <tbody>${w.map(r => `<tr><td>${r.i}</td><td>${r.xi}</td><td>${r.yi}</td><td>${fmt(r.denom)}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (method === 'newton') {
    const { table, coef } = dividedDifferences(pts);
    yEval = newtonEval(pts, coef, xEval);
    curve = (x) => newtonEval(pts, coef, x);
    coefHtml = `<h6 class="text-blue mt-4 mb-2">Tabla de diferencias divididas</h6>${ddTable(pts, table)}
      <p class="text-soft small mt-2">Coeficientes del polinomio de Newton (1ª fila): <span class="mono text-orange">[${coef.map(fmt).join(', ')}]</span></p>`;
  } else {
    const sp = cubicSpline(pts);
    yEval = sp.evaluate(xEval);
    curve = (x) => sp.evaluate(x);
    coefHtml = `<h6 class="text-blue mt-4 mb-2">Segundas derivadas Mᵢ (momentos del spline)</h6>
      <div class="table-wrap"><table class="table table-sm"><thead><tr><th>Nodo i</th><th>xᵢ</th><th>Mᵢ = S″(xᵢ)</th></tr></thead>
      <tbody>${pts.map((p, i) => `<tr><td>${i}</td><td>${p.x}</td><td>${fmt(sp.M[i])}</td></tr>`).join('')}</tbody></table></div>`;
  }

  renderResults(pts, xEval, yEval, curve, names[method], coefHtml, warn);
}

function renderResults(pts, xEval, yEval, curve, method, coefHtml, warn) {
  const html = `
    ${warn}
    <div class="result-box">
      <div class="text-soft mb-1">Precio estimado · ${method}</div>
      <div class="big-num text-orange">${fmt(yEval)} Bs</div>
      <div class="text-soft mt-2 small">para el día ${xEval}</div>
    </div>
    ${coefHtml}
    <h6 class="text-blue mt-4 mb-2">Curva interpolada + puntos originales</h6>
    <div class="chart-wrap"><canvas id="interpCanvas"></canvas></div>
    ${interpretation(xEval, yEval, pts, method)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawCurve(pts, curve, xEval, yEval);
}

function ddTable(pts, table) {
  const n = pts.length;
  let head = '<th>xᵢ</th><th>f[xᵢ]</th>';
  for (let j = 1; j < n; j++) head += `<th>Δ${superscript(j)}</th>`;
  let rows = '';
  for (let i = 0; i < n; i++) {
    let r = `<td>${pts[i].x}</td>`;
    for (let j = 0; j < n; j++) r += `<td>${table[i][j] !== undefined ? fmt(table[i][j]) : ''}</td>`;
    rows += `<tr>${r}</tr>`;
  }
  return `<div class="table-wrap"><table class="table table-sm mono"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function interpretation(xEval, yEval, pts, method) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const incremento = ((ys[ys.length - 1] - ys[0]) / ys[0] * 100).toFixed(1);
  const conf = method === 'Splines cúbicos'
    ? `Los <strong>splines cúbicos</strong> generan una curva suave y estable, evitando las oscilaciones que aparecen con polinomios de alto grado: son los más confiables cuando los datos están dispersos.`
    : `Con <strong>${method}</strong>, recuerda que un único polinomio de grado alto puede oscilar (fenómeno de Runge) entre puntos muy separados; conviene contrastar con los splines.`;
  return `<div class="interp mt-3"><h6>🧭 Interpretación en contexto boliviano</h6>
    <p class="mb-2">El precio estimado de la papa el <strong>día ${xEval}</strong> es de aproximadamente <strong>${fmt(yEval)} Bs</strong>.
    A lo largo del periodo observado el precio subió de ${ys[0]} Bs a ${ys[ys.length - 1]} Bs, un incremento de
    <strong>${incremento}%</strong>, reflejando la presión inflacionaria sobre la canasta básica.</p>
    <p class="mb-0">${conf}</p></div>`;
}

/* ============================================================
   GRÁFICO
   ============================================================ */
function drawCurve(pts, curve, xEval, yEval) {
  if (interpChart) interpChart.destroy();
  const xMin = Math.min(...pts.map(p => p.x)), xMax = Math.max(...pts.map(p => p.x));
  const pad = (xMax - xMin) * 0.04;
  const N = 120, line = [];
  for (let i = 0; i <= N; i++) {
    const x = (xMin - pad) + (xMax - xMin + 2 * pad) * i / N;
    const y = curve(x);
    if (isFinite(y)) line.push({ x, y });
  }
  const ctx = document.getElementById('interpCanvas');
  interpChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Curva interpolada', data: line, parsing: false, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, tension: .15 },
        { label: 'Datos originales', data: pts.map(p => ({ x: p.x, y: p.y })), parsing: false, borderColor: '#fb923c', backgroundColor: '#fb923c', pointRadius: 6, showLine: false },
        { label: `Estimación (día ${xEval})`, data: [{ x: xEval, y: yEval }], parsing: false, borderColor: '#22c55e', backgroundColor: '#22c55e', pointRadius: 8, pointStyle: 'rectRot', showLine: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Día', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'Precio (Bs)', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' } }
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
    lagrange: { t: 'Interpolación de Lagrange', body:
      `<p class="text-soft mb-2">Construye el polinomio como combinación de bases <code>Lᵢ(x)</code> que valen 1 en <code>xᵢ</code> y 0 en los demás nodos:</p>
       <p class="mono text-orange">P(x) = Σ yᵢ · Π (x−xⱼ)/(xᵢ−xⱼ)</p>
       <p class="text-soft mb-0">Simple y directo, pero recalcular todo al añadir un punto es costoso y oscila con muchos datos.</p>` },
    newton: { t: 'Interpolación de Newton', body:
      `<p class="text-soft mb-2">Usa <strong>diferencias divididas</strong> para los coeficientes:</p>
       <p class="mono text-orange">P(x) = f[x₀] + f[x₀,x₁](x−x₀) + …</p>
       <p class="text-soft mb-0">Más eficiente que Lagrange para agregar puntos: solo se añade un término sin rehacer lo anterior.</p>` },
    spline: { t: 'Splines cúbicos naturales', body:
      `<p class="text-soft mb-2">Ajusta un polinomio cúbico distinto en cada tramo, exigiendo continuidad de la función y de sus dos primeras derivadas:</p>
       <ol><li>Plantea un sistema tridiagonal para las segundas derivadas <code>Mᵢ</code>.</li>
       <li>Se resuelve con el algoritmo de Thomas.</li>
       <li>Condición "natural": <code>M₀ = Mₙ = 0</code>.</li></ol>
       <p class="text-soft mb-0">Evita el fenómeno de Runge: la mejor opción para datos dispersos.</p>` }
  };
  const d = data[m];
  box.innerHTML = `<h6>📘 Algoritmo: ${d.t}</h6>${d.body}`;
}

/* ---- helpers ---- */
const superscript = (n) => ('' + n).replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
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
  document.getElementById('btnAddRow').addEventListener('click', () => addRow());
  onMethodChange();
});
