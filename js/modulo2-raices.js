/* ============================================================
   MÓDULO 2 — Raíces de ecuaciones (Escenario E)
   Umbral crítico: día en que el COSTO ACUMULADO supera el
   INGRESO familiar  ->  f(x) = costoAcumulado(x) − ingreso = 0
   Métodos: Bisección · Newton-Raphson · Secante
   math.js SOLO se usa para parsear la función ingresada.
   ============================================================ */

let rootChart = null;

/* f(x) por defecto (escenario E):
   3x² + 40x − 2500   →  costo acumulado (Bs) menos ingreso mensual (2500 Bs).
   Raíz ≈ día 23: ese día el gasto de la familia supera su ingreso. */
const DEFAULT_FX = '3*x^2 + 40*x - 2500';

/* Compila la función con math.js y devuelve f(x) y f'(x) como funciones JS */
function compileFunction(expr) {
  let node, fx, dfx;
  try {
    node = math.parse(expr);
    const code = node.compile();
    fx = (x) => code.evaluate({ x });
    fx(1); // prueba de evaluación
  } catch (e) {
    throw new Error('No se pudo interpretar f(x). Revisa la sintaxis (ej: 3*x^2 + 40*x - 2500).');
  }
  try {
    const d = math.derivative(node, 'x').compile();
    dfx = (x) => d.evaluate({ x });
  } catch (e) {
    // si math.js no puede derivar simbólicamente -> derivada numérica central
    dfx = (x) => (fx(x + 1e-6) - fx(x - 1e-6)) / 2e-6;
  }
  return { fx, dfx };
}

/* ============================================================
   MÉTODO 1 — BISECCIÓN
   Requiere f(a)·f(b) < 0 (cambio de signo). Siempre converge.
   ============================================================ */
function biseccion(fx, a, b, tol, maxIter) {
  let fa = fx(a), fb = fx(b);
  if (fa * fb > 0) throw new Error(`No hay cambio de signo en [${a}, ${b}]: f(a)=${fa.toFixed(3)}, f(b)=${fb.toFixed(3)}. Elige otro intervalo que encierre la raíz.`);
  const hist = [];
  let c = a, cPrev = a, err = Infinity;
  for (let k = 1; k <= maxIter; k++) {
    c = (a + b) / 2;
    const fc = fx(c);
    err = (k === 1) ? Math.abs(b - a) / 2 : Math.abs(c - cPrev);
    hist.push({ k, x: c, fx: fc, err });
    if (Math.abs(fc) < 1e-14 || err < tol) return { root: c, hist, converged: true };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
    cPrev = c;
  }
  return { root: c, hist, converged: false };
}

/* ============================================================
   MÉTODO 2 — NEWTON-RAPHSON
   x_{k+1} = x_k − f(x_k)/f'(x_k).  Convergencia cuadrática.
   ============================================================ */
function newtonRaphson(fx, dfx, x0, tol, maxIter) {
  const hist = [];
  let x = x0;
  for (let k = 1; k <= maxIter; k++) {
    const f = fx(x), df = dfx(x);
    if (Math.abs(df) < 1e-14) throw new Error(`La derivada se anuló en x=${x.toFixed(4)}: Newton-Raphson no puede continuar. Prueba otro valor inicial.`);
    const xNew = x - f / df;
    const err = Math.abs(xNew - x);
    hist.push({ k, x: xNew, fx: fx(xNew), err });
    if (err < tol || Math.abs(fx(xNew)) < 1e-14) return { root: xNew, hist, converged: true };
    x = xNew;
  }
  return { root: x, hist, converged: false };
}

/* ============================================================
   MÉTODO 3 — SECANTE
   Aproxima la derivada con dos puntos. No necesita f'(x).
   ============================================================ */
function secante(fx, x0, x1, tol, maxIter) {
  const hist = [];
  let f0 = fx(x0), f1 = fx(x1);
  for (let k = 1; k <= maxIter; k++) {
    if (Math.abs(f1 - f0) < 1e-14) throw new Error('División por cero en la Secante (f(x₁) ≈ f(x₀)). Prueba otros valores iniciales.');
    const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
    const err = Math.abs(x2 - x1);
    const f2 = fx(x2);
    hist.push({ k, x: x2, fx: f2, err });
    if (err < tol || Math.abs(f2) < 1e-14) return { root: x2, hist, converged: true };
    x0 = x1; f0 = f1; x1 = x2; f1 = f2;
  }
  return { root: x1, hist, converged: false };
}

/* ============================================================
   INTERFAZ — selector de método
   ============================================================ */
function onMethodChange() {
  const m = document.getElementById('methodSelect').value;
  document.getElementById('intervalWrap').style.display = (m === 'bisec' || m === 'secante') ? 'flex' : 'none';
  document.getElementById('x0Wrap').style.display = (m === 'newton') ? 'block' : 'none';
  // etiquetas dinámicas para secante (usa a,b como x0,x1)
  document.getElementById('lblA').textContent = (m === 'secante') ? 'x₀ inicial' : 'a (extremo izq.)';
  document.getElementById('lblB').textContent = (m === 'secante') ? 'x₁ inicial' : 'b (extremo der.)';
  renderAlgoExplanation(m);
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

function loadExample() {
  document.getElementById('fx').value = DEFAULT_FX;
  document.getElementById('a').value = 0;
  document.getElementById('b').value = 30;
  document.getElementById('x0').value = 15;
  document.getElementById('tol').value = 1e-6;
  document.getElementById('maxIter').value = 50;
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

/* ============================================================
   EJECUCIÓN PRINCIPAL
   ============================================================ */
function calcular() {
  const msg = document.getElementById('msg');
  msg.innerHTML = ''; document.getElementById('results').innerHTML = '';
  const expr = document.getElementById('fx').value.trim();
  const tol = parseFloat(document.getElementById('tol').value) || 1e-6;
  const maxIter = parseInt(document.getElementById('maxIter').value) || 50;
  const method = document.getElementById('methodSelect').value;

  let fns;
  try { fns = compileFunction(expr); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }
  const { fx, dfx } = fns;

  try {
    let res, names = { bisec: 'Bisección', newton: 'Newton-Raphson', secante: 'Secante' };
    if (method === 'bisec') {
      const a = parseFloat(document.getElementById('a').value), b = parseFloat(document.getElementById('b').value);
      res = biseccion(fx, a, b, tol, maxIter);
    } else if (method === 'newton') {
      const x0 = parseFloat(document.getElementById('x0').value);
      res = newtonRaphson(fx, dfx, x0, tol, maxIter);
    } else {
      const x0 = parseFloat(document.getElementById('a').value), x1 = parseFloat(document.getElementById('b').value);
      res = secante(fx, x0, x1, tol, maxIter);
    }
    renderResults(res, fx, names[method], expr);
  } catch (e) {
    msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`;
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function renderResults(res, fx, method, expr) {
  const last = res.hist[res.hist.length - 1];
  const status = res.converged
    ? `<span class="tag tag-blue">✓ Convergió en ${res.hist.length} iteraciones</span>`
    : `<span class="tag tag-orange">⚠ No alcanzó la tolerancia</span>`;

  const rows = res.hist.map(h =>
    `<tr><td>${h.k}</td><td>${fmt(h.x)}</td><td>${fmt(h.fx)}</td><td>${h.err.toExponential(3)}</td></tr>`
  ).join('');

  // estimación del orden de convergencia (escenario E pide orden estimado)
  const orden = estimateOrder(res.hist);

  const html = `
    <div class="mb-3">${status}</div>
    <div class="result-box orange">
      <div class="text-soft mb-1">Raíz aproximada · ${method}</div>
      <div class="big-num text-orange">x ≈ ${fmt(res.root)}</div>
      <div class="text-soft mt-2 small">f(x) = ${fmt(fx(res.root))} &nbsp;·&nbsp; error final = ${last.err.toExponential(3)}</div>
    </div>
    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Iteraciones</div><div class="value">${res.hist.length}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Error alcanzado</div><div class="value">${last.err.toExponential(2)}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Orden de conv. estimado</div><div class="value">${orden}</div></div></div>
    </div>
    <h6 class="text-blue mt-4 mb-2">Tabla de iteraciones — ${method}</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>n</th><th>xₙ</th><th>f(xₙ)</th><th>error</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <h6 class="text-blue mt-4 mb-2">Gráfico de f(x) con la raíz marcada</h6>
    <div class="chart-wrap"><canvas id="rootCanvas"></canvas></div>
    ${interpretation(res.root, res.converged, method)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawFunction(fx, res.root, res.hist);
}

/* ============================================================
   COMPARACIÓN DE LOS 3 MÉTODOS (escenario E:
   "comparar robustez, velocidad de convergencia y sensibilidad")
   ============================================================ */
let compareChart = null;

function compararTodos() {
  const msg = document.getElementById('msg');
  msg.innerHTML = ''; document.getElementById('results').innerHTML = '';
  const expr = document.getElementById('fx').value.trim();
  const tol = parseFloat(document.getElementById('tol').value) || 1e-6;
  const maxIter = parseInt(document.getElementById('maxIter').value) || 50;
  const a = parseFloat(document.getElementById('a').value);
  const b = parseFloat(document.getElementById('b').value);
  const x0 = parseFloat(document.getElementById('x0').value);

  let fns;
  try { fns = compileFunction(expr); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }
  const { fx, dfx } = fns;

  // cada método se ejecuta de forma independiente y captura su propio error
  const run = (fn) => { try { return { ok: true, r: fn() }; } catch (e) { return { ok: false, err: e.message }; } };
  const results = [
    { name: 'Bisección', tipo: 'Cerrado · orden 1', res: run(() => biseccion(fx, a, b, tol, maxIter)) },
    { name: 'Newton-Raphson', tipo: 'Abierto · orden 2', res: run(() => newtonRaphson(fx, dfx, x0, tol, maxIter)) },
    { name: 'Secante', tipo: 'Abierto · orden ≈1.62', res: run(() => secante(fx, a, b, tol, maxIter)) }
  ];

  // tabla comparativa
  const rows = results.map(m => {
    if (!m.res.ok) return `<tr><td>${m.name}</td><td class="text-dim" colspan="4">⚠ ${m.res.err}</td></tr>`;
    const r = m.res.r, last = r.hist[r.hist.length - 1];
    return `<tr>
      <td>${m.name}<div class="text-dim" style="font-size:.75rem">${m.tipo}</div></td>
      <td>${fmt(r.root)}</td>
      <td>${r.hist.length}</td>
      <td>${last.err.toExponential(2)}</td>
      <td>${estimateOrder(r.hist)}</td></tr>`;
  }).join('');

  // método más rápido (menos iteraciones entre los que convergieron)
  const ok = results.filter(m => m.res.ok && m.res.r.converged);
  ok.sort((p, q) => p.res.r.hist.length - q.res.r.hist.length);
  const fastest = ok.length ? ok[0].name : '—';

  const html = `
    <div class="mb-3"><span class="tag tag-orange">Comparación de robustez, velocidad y sensibilidad</span></div>
    <h6 class="text-blue mb-2">⚖️ Tabla comparativa de los 3 métodos</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>Método</th><th>Raíz</th><th>Iteraciones</th><th>Error final</th><th>Orden estim.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <h6 class="text-blue mt-4 mb-2">Velocidad de convergencia (iteraciones necesarias)</h6>
    <div class="chart-wrap"><canvas id="compareCanvas"></canvas></div>
    <div class="interp mt-3"><h6>🧭 Conclusión de la comparación</h6>
      <p class="mb-0">El método más <strong>rápido</strong> (menos iteraciones) fue <strong>${fastest}</strong>.
      Normalmente <strong>Newton-Raphson</strong> gana por su convergencia cuadrática, pero depende de un buen valor inicial
      y de que la derivada no se anule. <strong>Bisección</strong> es la más <strong>robusta</strong> (siempre converge si hay
      cambio de signo) aunque la más lenta. <strong>Secante</strong> es el punto intermedio: rápida y sin necesitar la derivada.</p>
    </div>`;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawCompareBars(results);
}

function drawCompareBars(results) {
  if (compareChart) compareChart.destroy();
  if (rootChart) { rootChart.destroy(); rootChart = null; }
  const labels = results.map(m => m.name);
  const data = results.map(m => (m.res.ok ? m.res.r.hist.length : 0));
  compareChart = new Chart(document.getElementById('compareCanvas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Iteraciones hasta converger',
        data,
        backgroundColor: ['rgba(239,68,68,.55)', 'rgba(59,130,246,.55)', 'rgba(249,115,22,.55)'],
        borderColor: ['#ef4444', '#3b82f6', '#f97316'], borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'N.º de iteraciones', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' }, beginAtZero: true }
      }
    }
  });
}

/* Estima el orden de convergencia p ≈ ln(eₖ/eₖ₋₁) / ln(eₖ₋₁/eₖ₋₂) */
function estimateOrder(hist) {
  if (hist.length < 4) return '—';
  const e = hist.map(h => h.err).filter(v => v > 0);
  if (e.length < 4) return '—';
  const n = e.length;
  const p = Math.log(e[n - 1] / e[n - 2]) / Math.log(e[n - 2] / e[n - 3]);
  if (!isFinite(p) || p < 0) return '—';
  return p.toFixed(2);
}

function interpretation(root, converged, method) {
  const dia = Math.ceil(root);
  const body = converged
    ? `La raíz encontrada con <strong>${method}</strong> es <strong>x ≈ ${fmt(root)}</strong>. En el contexto del escenario E,
       esto significa que <strong>alrededor del día ${dia}</strong> el <strong>costo acumulado de la canasta familiar
       supera el ingreso del hogar</strong>: a partir de esa fecha la familia entra en déficit y pierde poder adquisitivo.
       Conocer este umbral permite anticipar ayudas, ajustar el presupuesto o priorizar gastos antes de llegar al punto crítico.`
    : `El método <strong>${method}</strong> no alcanzó la tolerancia pedida. Aumenta el número de iteraciones,
       ajusta el intervalo/valor inicial o verifica que realmente exista una raíz en ese rango.`;
  return `<div class="interp mt-3"><h6>🧭 Interpretación en contexto boliviano</h6><p class="mb-0">${body}</p></div>`;
}

/* ============================================================
   GRÁFICO de la función con la raíz (punto rojo)
   ============================================================ */
function drawFunction(fx, root, hist) {
  if (rootChart) rootChart.destroy();
  // dominio centrado en la raíz
  const span = Math.max(10, Math.abs(root) * 1.2);
  const xMin = root - span, xMax = root + span;
  const pts = [];
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const x = xMin + (xMax - xMin) * i / N;
    let y = fx(x);
    if (isFinite(y)) pts.push({ x, y });
  }
  const ctx = document.getElementById('rootCanvas');
  rootChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'f(x)', data: pts, parsing: false,
          borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0, tension: .1
        },
        {
          label: 'Raíz', data: [{ x: root, y: 0 }], parsing: false,
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          pointRadius: 7, pointHoverRadius: 9, showLine: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#aab6c9' } },
        tooltip: { callbacks: { label: (c) => `(${c.parsed.x.toFixed(3)}, ${c.parsed.y.toFixed(3)})` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'x (día)', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: 'f(x)', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.08)' } }
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
    bisec: {
      t: 'Bisección',
      body: `<p class="text-soft mb-2">Método cerrado: parte de un intervalo <code>[a,b]</code> con <code>f(a)·f(b) &lt; 0</code>.</p>
        <ol><li>Calcula el punto medio <code>c = (a+b)/2</code>.</li>
        <li>Reemplaza el extremo cuyo signo coincide con <code>f(c)</code>.</li>
        <li>Repite hasta que el intervalo sea menor que la tolerancia.</li></ol>
        <p class="text-soft mb-0"><strong>Siempre converge</strong> si hay cambio de signo, pero lentamente (convergencia lineal, orden 1).</p>`
    },
    newton: {
      t: 'Newton-Raphson',
      body: `<p class="text-soft mb-2">Método abierto que usa la derivada:</p>
        <p class="mono text-orange">xₖ₊₁ = xₖ − f(xₖ) / f′(xₖ)</p>
        <ol><li>Traza la tangente en <code>xₖ</code> y toma su corte con el eje X.</li>
        <li><strong>Convergencia cuadrática</strong> (orden 2): muy rápido cerca de la raíz.</li>
        <li>Falla si <code>f′(x)=0</code> o si el valor inicial está lejos.</li></ol>`
    },
    secante: {
      t: 'Secante',
      body: `<p class="text-soft mb-2">Como Newton pero <strong>sin derivada</strong>: la aproxima con dos puntos previos.</p>
        <p class="mono text-orange">xₖ₊₁ = xₖ − f(xₖ)·(xₖ−xₖ₋₁) / (f(xₖ)−f(xₖ₋₁))</p>
        <p class="text-soft mb-0">Orden de convergencia ≈ 1.618 (número áureo): más rápido que Bisección, más robusto que Newton al no requerir f′(x).</p>`
    }
  };
  const d = data[m];
  box.innerHTML = `<h6>📘 Algoritmo: ${d.t}</h6>${d.body}`;
}

/* ---- helpers ---- */
function fmt(v) {
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(4);
  return (Math.round(v * 1e6) / 1e6).toString();
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadExample();
  document.getElementById('methodSelect').addEventListener('change', onMethodChange);
  document.getElementById('btnCalc').addEventListener('click', calcular);
  document.getElementById('btnExample').addEventListener('click', loadExample);
  document.getElementById('btnCompare').addEventListener('click', compararTodos);
  onMethodChange();
});
