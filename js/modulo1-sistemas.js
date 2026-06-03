/* ============================================================
   MÓDULO 1 — Sistemas de ecuaciones lineales (Escenario A)
   Distribución de carburantes: 3 plantas -> zonas (Norte/Centro/Sur)
   Métodos implementados DESDE CERO:
     · LU con pivoteo parcial   · Jacobi   · Gauss-Seidel
     · SOR (omega configurable) · Gradiente Conjugado
   ============================================================ */

let convChart = null;            // instancia Chart.js del gráfico de convergencia
const TOL_DEFAULT = 1e-8;

/* ---- Datos de ejemplo precargados (sistema 3x3, solución exacta [3,5,6]) ----
   Matriz simétrica, diagonalmente dominante y definida positiva
   => converge en TODOS los métodos iterativos y sirve para Gradiente Conjugado. */
const DEFAULT_A = [
  [10, 2, 1],
  [2, 12, 3],
  [1, 3, 15]
];
const DEFAULT_B = [46, 84, 108];

/* ============================================================
   1. CONSTRUCCIÓN DINÁMICA DE INPUTS (matriz A y vector b)
   ============================================================ */
function buildInputs(n, A = null, b = null) {
  const mWrap = document.getElementById('matrixA');
  const bWrap = document.getElementById('vectorB');
  mWrap.style.gridTemplateColumns = `auto repeat(${n}, auto)`;  // 1ª col = etiquetas de fila
  bWrap.style.gridTemplateColumns = `auto`;
  mWrap.innerHTML = '';
  bWrap.innerHTML = '';

  // Etiquetas según contexto: n=3 => zonas y plantas de Bolivia; otros tamaños => genéricas
  const cols = (n === 3) ? ['Norte', 'Centro', 'Sur'] : Array.from({ length: n }, (_, j) => 'x' + (j + 1));
  const rows = (n === 3) ? ['Planta 1', 'Planta 2', 'Planta 3'] : Array.from({ length: n }, (_, i) => 'Ec. ' + (i + 1));

  // Fila de encabezados: esquina vacía + nombre de cada columna (zona)
  const corner = document.createElement('div');
  corner.className = 'mlabel mlabel-corner';
  mWrap.appendChild(corner);
  cols.forEach(c => {
    const h = document.createElement('div');
    h.className = 'mlabel mlabel-col';
    h.textContent = c;
    mWrap.appendChild(h);
  });
  // Encabezado del vector b
  const bHead = document.createElement('div');
  bHead.className = 'mlabel mlabel-col';
  bHead.textContent = 'Demanda';
  bWrap.appendChild(bHead);

  for (let i = 0; i < n; i++) {
    // Etiqueta de fila (planta)
    const rl = document.createElement('div');
    rl.className = 'mlabel mlabel-row';
    rl.textContent = rows[i];
    mWrap.appendChild(rl);

    for (let j = 0; j < n; j++) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'form-control'; inp.step = 'any';
      inp.id = `a_${i}_${j}`;
      inp.value = (A && A[i] && A[i][j] !== undefined) ? A[i][j]
                 : (i === j ? 10 : 1);   // diagonal dominante por defecto
      mWrap.appendChild(inp);
    }
    const bi = document.createElement('input');
    bi.type = 'number'; bi.className = 'form-control'; bi.step = 'any';
    bi.id = `b_${i}`;
    bi.value = (b && b[i] !== undefined) ? b[i] : 10;
    bWrap.appendChild(bi);
  }
  // etiqueta de zonas (solo si n==3, contexto boliviano)
  document.getElementById('zoneHint').style.display = (n === 3) ? 'block' : 'none';
}

function readSystem() {
  const n = parseInt(document.getElementById('matSize').value);
  const A = [], b = [];
  for (let i = 0; i < n; i++) {
    A.push([]);
    for (let j = 0; j < n; j++) {
      const v = parseFloat(document.getElementById(`a_${i}_${j}`).value);
      if (Number.isNaN(v)) throw new Error(`El valor A[${i + 1}][${j + 1}] no es un número válido.`);
      A[i].push(v);
    }
    const bv = parseFloat(document.getElementById(`b_${i}`).value);
    if (Number.isNaN(bv)) throw new Error(`El valor b[${i + 1}] no es un número válido.`);
    b.push(bv);
  }
  return { n, A, b };
}

/* ============================================================
   2. UTILIDADES DE ÁLGEBRA LINEAL
   ============================================================ */
const clone = (M) => M.map(r => Array.isArray(r) ? [...r] : r);
const matVec = (A, x) => A.map(row => row.reduce((s, a, j) => s + a * x[j], 0));
const dot = (u, v) => u.reduce((s, ui, i) => s + ui * v[i], 0);
const norm2 = (v) => Math.sqrt(dot(v, v));            // norma euclídea
const normInf = (v) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const residual = (A, x, b) => matVec(A, x).map((axi, i) => axi - b[i]);

function isSymmetric(A) {
  const n = A.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (Math.abs(A[i][j] - A[j][i]) > 1e-9) return false;
  return true;
}
function diagDominantWarning(A) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    let off = 0;
    for (let j = 0; j < n; j++) if (j !== i) off += Math.abs(A[i][j]);
    if (Math.abs(A[i][i]) < off) return true; // NO es estrictamente dominante
  }
  return false;
}

/* Norma infinito de una matriz = máxima suma de valores absolutos por fila */
const normInfMat = (A) => A.reduce((m, row) => Math.max(m, row.reduce((s, v) => s + Math.abs(v), 0)), 0);

/* Inversa de A resolviendo A·colⱼ = eⱼ con LU (columna por columna) */
function inverse(A) {
  const n = A.length;
  const inv = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0); e[j] = 1;
    const col = luSolve(A, e).x;
    for (let i = 0; i < n; i++) inv[i][j] = col[i];
  }
  return inv;
}

/* Número de condición κ∞(A) = ||A||∞ · ||A⁻¹||∞.
   Cercano a 1 => sistema estable; muy grande => mal condicionado (sensible). */
function condInf(A) {
  try { return normInfMat(A) * normInfMat(inverse(A)); }
  catch (e) { return Infinity; }
}
function condBadge(cond) {
  if (!isFinite(cond)) return `<span class="tag tag-orange">singular</span>`;
  if (cond < 100) return `<span class="tag tag-blue">bien condicionado · estable</span>`;
  if (cond < 1e4) return `<span class="tag tag-orange">condición moderada</span>`;
  return `<span class="tag tag-orange">mal condicionado · sensible</span>`;
}

/* Resuelve el sistema con cualquier método (usado al recalcular tras bloquear ruta) */
function quickSolve(method, A, b, tol, maxIter, omega) {
  if (method === 'lu') return luSolve(A, b).x;
  if (method === 'jacobi') return jacobi(A, b, tol, maxIter).x;
  if (method === 'gauss') return gaussSeidel(A, b, tol, maxIter).x;
  if (method === 'sor') return sor(A, b, tol, maxIter, omega).x;
  if (method === 'cg') return conjugateGradient(A, b, tol, maxIter).x;
}

/* Estado de la última resolución (para el análisis de bloqueo de ruta) */
let M1 = {};

/* ============================================================
   3. MÉTODO DIRECTO — DESCOMPOSICIÓN LU CON PIVOTEO PARCIAL
   Resuelve PA = LU, luego Ly = Pb (sustitución adelante)
   y Ux = y (sustitución atrás).
   ============================================================ */
function luDecomposition(Ain) {
  const n = Ain.length;
  const A = clone(Ain);
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  const P = Array.from({ length: n }, (_, i) => i); // vector de permutación
  let swaps = 0;

  for (let k = 0; k < n; k++) {
    // --- Pivoteo parcial: buscar el mayor |A[i][k]| en la columna k ---
    let p = k, max = Math.abs(A[k][k]);
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A[i][k]) > max) { max = Math.abs(A[i][k]); p = i; }
    }
    if (max < 1e-12) throw new Error('La matriz es singular (pivote ≈ 0): el sistema no tiene solución única.');
    if (p !== k) {                       // intercambio de filas
      [A[k], A[p]] = [A[p], A[k]];
      [P[k], P[p]] = [P[p], P[k]];
      for (let j = 0; j < k; j++) [L[k][j], L[p][j]] = [L[p][j], L[k][j]];
      swaps++;
    }
    // --- Eliminación gaussiana, guardando multiplicadores en L ---
    for (let i = k + 1; i < n; i++) {
      const m = A[i][k] / A[k][k];
      L[i][k] = m;
      for (let j = k; j < n; j++) A[i][j] -= m * A[k][j];
    }
  }
  return { L, U: A, P, swaps };
}

function luSolve(Ain, b) {
  const { L, U, P, swaps } = luDecomposition(Ain);
  const n = Ain.length;
  // Pb
  const Pb = P.map(idx => b[idx]);
  // Ly = Pb  (sustitución hacia adelante)
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = Pb[i];
    for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
    y[i] = s;            // L tiene 1 en la diagonal
  }
  // Ux = y  (sustitución hacia atrás)
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j];
    x[i] = s / U[i][i];
  }
  // determinante = (-1)^swaps * producto diagonal de U
  let det = Math.pow(-1, swaps);
  for (let i = 0; i < n; i++) det *= U[i][i];
  return { x, L, U, P, det };
}

/* ============================================================
   4. MÉTODOS ITERATIVOS (Jacobi, Gauss-Seidel, SOR)
   Todos devuelven: x, lista de iteraciones {k, x, err}, convergió
   ============================================================ */
function jacobi(A, b, tol, maxIter) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const hist = [];
  for (let k = 1; k <= maxIter; k++) {
    const xNew = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 0; j < n; j++) if (j !== i) s -= A[i][j] * x[j]; // usa x viejo
      xNew[i] = s / A[i][i];
    }
    const err = normInf(xNew.map((v, i) => v - x[i]));
    hist.push({ k, x: [...xNew], err });
    x = xNew;
    if (err < tol) return { x, hist, converged: true };
  }
  return { x, hist, converged: false };
}

function gaussSeidel(A, b, tol, maxIter) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const hist = [];
  for (let k = 1; k <= maxIter; k++) {
    const xOld = [...x];
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 0; j < n; j++) if (j !== i) s -= A[i][j] * x[j]; // usa x ya actualizado
      x[i] = s / A[i][i];
    }
    const err = normInf(x.map((v, i) => v - xOld[i]));
    hist.push({ k, x: [...x], err });
    if (err < tol) return { x: [...x], hist, converged: true };
  }
  return { x: [...x], hist, converged: false };
}

function sor(A, b, tol, maxIter, omega) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const hist = [];
  for (let k = 1; k <= maxIter; k++) {
    const xOld = [...x];
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let j = 0; j < n; j++) if (j !== i) s -= A[i][j] * x[j];
      const xGS = s / A[i][i];                 // valor Gauss-Seidel
      x[i] = (1 - omega) * x[i] + omega * xGS;  // sobre/sub-relajación
    }
    const err = normInf(x.map((v, i) => v - xOld[i]));
    hist.push({ k, x: [...x], err });
    if (err < tol) return { x: [...x], hist, converged: true };
  }
  return { x: [...x], hist, converged: false };
}

/* ============================================================
   5. GRADIENTE CONJUGADO (requiere A simétrica definida positiva)
   ============================================================ */
function conjugateGradient(A, b, tol, maxIter) {
  const n = A.length;
  let x = new Array(n).fill(0);
  let r = b.map((bi, i) => bi - 0);     // r0 = b - A·0 = b
  let p = [...r];
  let rsold = dot(r, r);
  const hist = [];
  for (let k = 1; k <= maxIter; k++) {
    const Ap = matVec(A, p);
    const alpha = rsold / dot(p, Ap);
    x = x.map((xi, i) => xi + alpha * p[i]);
    r = r.map((ri, i) => ri - alpha * Ap[i]);
    const rsnew = dot(r, r);
    const err = Math.sqrt(rsnew);          // norma del residuo
    hist.push({ k, x: [...x], err });
    if (err < tol) return { x, hist, converged: true };
    const beta = rsnew / rsold;
    p = r.map((ri, i) => ri + beta * p[i]);
    rsold = rsnew;
  }
  return { x, hist, converged: false };
}

/* ============================================================
   6. INTERFAZ — selector de método
   ============================================================ */
function onMethodChange() {
  const m = document.getElementById('methodSelect').value;
  document.getElementById('sorOmegaWrap').style.display = (m === 'sor') ? 'block' : 'none';
  // tolerancia/iteraciones no aplican a LU
  document.getElementById('iterParams').style.display = (m === 'lu') ? 'none' : 'flex';
  renderAlgoExplanation(m);
  clearResults();
}

function onSizeChange() {
  const n = parseInt(document.getElementById('matSize').value);
  // mantiene los datos por defecto si n=3, de lo contrario genera plantilla
  if (n === 3) buildInputs(3, DEFAULT_A, DEFAULT_B);
  else buildInputs(n);
}

function loadExample() {
  document.getElementById('matSize').value = 3;
  buildInputs(3, DEFAULT_A, DEFAULT_B);
  clearResults();
}

function clearResults() {
  document.getElementById('results').innerHTML = '';
  document.getElementById('msg').innerHTML = '';
}

/* ============================================================
   7. EJECUCIÓN PRINCIPAL
   ============================================================ */
function calcular() {
  clearResults();
  const msg = document.getElementById('msg');
  let sys;
  try { sys = readSystem(); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  const { n, A, b } = sys;
  const method = document.getElementById('methodSelect').value;
  const tol = parseFloat(document.getElementById('tol').value) || TOL_DEFAULT;
  const maxIter = parseInt(document.getElementById('maxIter').value) || 100;
  const omega = parseFloat(document.getElementById('omega').value) || 1.1;

  // guarda el estado para el módulo de "bloqueo de ruta"
  M1 = { n, A, b, method, tol, maxIter, omega, x: null };

  try {
    if (method === 'lu') return runLU(A, b, n);

    // --- avisos para métodos iterativos ---
    let warn = '';
    if (diagDominantWarning(A))
      warn += `<div class="alert-soft alert-warn mb-2">ℹ️ La matriz no es estrictamente diagonal dominante: el método iterativo podría converger lento o no converger.</div>`;
    if (method === 'cg' && !isSymmetric(A))
      warn += `<div class="alert-soft alert-warn mb-2">ℹ️ El Gradiente Conjugado asume A simétrica definida positiva. Tu matriz no es simétrica, el resultado puede no ser válido.</div>`;

    let res;
    if (method === 'jacobi') res = jacobi(A, b, tol, maxIter);
    else if (method === 'gauss') res = gaussSeidel(A, b, tol, maxIter);
    else if (method === 'sor') res = sor(A, b, tol, maxIter, parseFloat(document.getElementById('omega').value) || 1.1);
    else if (method === 'cg') res = conjugateGradient(A, b, tol, maxIter);

    renderIterative(res, A, b, n, method, warn);
  } catch (e) {
    msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`;
  }
}

/* ---- Render LU ---- */
function runLU(A, b, n) {
  const { x, L, U, det } = luSolve(A, b);
  M1.x = x;
  const res = residual(A, x, b);
  const cond = condInf(A);
  const html = `
    ${solutionBlock(x, n)}
    <div class="row g-3 mt-1">
      <div class="col-lg-6">
        <h6 class="text-blue mb-2">Matriz L (triangular inferior)</h6>
        ${matrixTable(L)}
      </div>
      <div class="col-lg-6">
        <h6 class="text-blue mb-2">Matriz U (triangular superior)</h6>
        ${matrixTable(U)}
      </div>
    </div>
    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Determinante de A</div><div class="value">${fmt(det)}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Residuo máx · |Ax − b|</div><div class="value">${fmt(normInf(res))}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Condición κ∞(A)</div><div class="value">${fmt(cond)}</div><div class="mt-1">${condBadge(cond)}</div></div></div>
    </div>
    <div class="chart-wrap mt-3"><canvas id="convCanvas"></canvas></div>
    ${interpretation(x, n, 'LU', true, 0)}
    ${blockPanelHTML(n)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  // gráfico: residuo por ecuación (LU no itera)
  drawBarChart(res.map((r, i) => Math.abs(r)), n);
  wireBlockPanel();
}

/* ---- Render métodos iterativos ---- */
function renderIterative(res, A, b, n, method, warn) {
  const names = { jacobi: 'Jacobi', gauss: 'Gauss-Seidel', sor: 'SOR', cg: 'Gradiente Conjugado' };
  M1.x = res.x;
  const r = residual(A, res.x, b);
  const cond = condInf(A);
  const status = res.converged
    ? `<span class="tag tag-blue">✓ Convergió en ${res.hist.length} iteraciones</span>`
    : `<span class="tag tag-orange">⚠ No convergió en el máximo de iteraciones</span>`;

  // tabla de iteraciones
  let rows = res.hist.map(h =>
    `<tr><td>${h.k}</td>${h.x.map(v => `<td>${fmt(v)}</td>`).join('')}<td>${h.err.toExponential(3)}</td></tr>`
  ).join('');
  const headX = Array.from({ length: n }, (_, i) => `<th>x${sub(i + 1)}</th>`).join('');

  const html = `
    ${warn}
    <div class="mb-3">${status}</div>
    ${solutionBlock(res.x, n)}
    <h6 class="text-blue mt-4 mb-2">Tabla de iteraciones — ${names[method]}</h6>
    <div class="table-wrap">
      <table class="table table-sm">
        <thead><tr><th>k</th>${headX}<th>error</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Iteraciones realizadas</div><div class="value">${res.hist.length}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Residuo final · |Ax − b|∞</div><div class="value">${fmt(normInf(r))}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Condición κ∞(A)</div><div class="value">${fmt(cond)}</div><div class="mt-1">${condBadge(cond)}</div></div></div>
    </div>
    <h6 class="text-blue mt-4 mb-2">Gráfico de convergencia (error vs iteración)</h6>
    <div class="chart-wrap"><canvas id="convCanvas"></canvas></div>
    ${interpretation(res.x, n, names[method], res.converged, res.hist.length)}
    ${blockPanelHTML(n)}
  `;
  document.getElementById('results').innerHTML = `<div class="fade-in">${html}</div>`;
  drawConvergence(res.hist, names[method]);
  wireBlockPanel();
}

/* ============================================================
   BLOQUEO DE RUTA (escenario A: ¿qué pasa si una ruta se bloquea?)
   Pone en cero un coeficiente Planta→Zona y recalcula.
   ============================================================ */
const ZONAS = ['Norte', 'Centro', 'Sur'];

function blockPanelHTML(n) {
  if (n !== 3) return '';   // el escenario de zonas aplica al sistema 3×3
  let opts = '';
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      opts += `<option value="${i}_${j}">Planta ${i + 1} → Zona ${ZONAS[j]}</option>`;
  return `
    <div class="card-soft p-3 mt-4" id="blockPanel">
      <h6 class="text-white mb-1">🚧 ¿Qué pasa si se bloquea una ruta?</h6>
      <p class="text-soft small mb-2">Pon en cero una ruta (coeficiente de A) y recalcula con el mismo método para ver <strong>qué zona queda más afectada</strong>.</p>
      <div class="d-flex gap-2 flex-wrap align-items-end">
        <div>
          <label class="form-label mb-1">Ruta a bloquear</label>
          <select id="blockRoute" class="form-select">${opts}</select>
        </div>
        <button id="btnBlock" class="btn btn-orange">Recalcular sin la ruta</button>
      </div>
      <div id="blockResult" class="mt-3"></div>
    </div>`;
}

function wireBlockPanel() {
  const btn = document.getElementById('btnBlock');
  if (btn) btn.addEventListener('click', doBlock);
}

function doBlock() {
  const out = document.getElementById('blockResult');
  if (!M1.x) { out.innerHTML = `<div class="alert-soft alert-warn">Primero calcula el sistema base.</div>`; return; }
  const [i, j] = document.getElementById('blockRoute').value.split('_').map(Number);
  const A2 = clone(M1.A);
  A2[i][j] = 0;                                  // ruta bloqueada
  let x2;
  try { x2 = quickSolve(M1.method, A2, M1.b, M1.tol, M1.maxIter, M1.omega); }
  catch (e) { out.innerHTML = `<div class="alert-soft alert-err">⚠️ Al bloquear esa ruta el sistema queda sin solución: ${e.message}</div>`; return; }

  // comparación zona por zona
  const deltas = x2.map((v, k) => v - M1.x[k]);
  const absD = deltas.map(Math.abs);
  const maxIdx = absD.indexOf(Math.max(...absD));
  const rows = M1.x.map((xi, k) =>
    `<tr class="${k === maxIdx ? 'highlight-row' : ''}">
       <td>Zona ${ZONAS[k]}</td><td>${fmt(xi)}</td><td>${fmt(x2[k])}</td>
       <td class="${deltas[k] < 0 ? 'text-orange' : ''}">${deltas[k] >= 0 ? '+' : ''}${fmt(deltas[k])}</td>
     </tr>`).join('');

  out.innerHTML = `
    <div class="table-wrap">
      <table class="table table-sm mb-0">
        <thead><tr><th>Destino</th><th>Antes</th><th>Después</th><th>Δ cambio</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="interp mt-3">
      <h6>🧭 Resultado del bloqueo</h6>
      <p class="mb-0">Al bloquear la ruta <strong>Planta ${i + 1} → Zona ${ZONAS[j]}</strong>, la
      <strong>Zona ${ZONAS[maxIdx]}</strong> es la <strong>más afectada</strong> (cambio de ${fmt(deltas[maxIdx])} mil litros).
      Esto muestra la sensibilidad de la red: una sola ruta cortada redistribuye toda la entrega y deja a una zona en mayor riesgo de desabastecimiento.</p>
    </div>`;
}

/* ============================================================
   8. RENDER HELPERS
   ============================================================ */
const sub = (n) => ('' + n).replace(/[0-9]/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
function fmt(v) {
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(4);
  return (Math.round(v * 1e6) / 1e6).toString();
}

function solutionBlock(x, n) {
  const zonas = ['Norte', 'Centro', 'Sur'];
  const cards = x.map((xi, i) =>
    `<div class="col"><div class="kpi text-center">
        <div class="label">x${sub(i + 1)} ${n === 3 ? '· Zona ' + zonas[i] : ''}</div>
        <div class="value text-orange">${fmt(xi)}</div>
     </div></div>`).join('');
  return `<div class="result-box"><div class="mb-2 text-soft">Vector solución <span class="mono">x</span></div>
            <div class="row g-2 row-cols-2 row-cols-md-${Math.min(n, 5)}">${cards}</div></div>`;
}

function matrixTable(M) {
  const rows = M.map(r => `<tr>${r.map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="table table-sm mono mb-0"><tbody>${rows}</tbody></table></div>`;
}

function interpretation(x, n, method, converged, iters) {
  const zonas = ['Norte', 'Centro', 'Sur'];
  let body = '';
  if (n === 3) {
    const maxIdx = x.indexOf(Math.max(...x));
    const minIdx = x.indexOf(Math.min(...x));
    body = `Con el método <strong>${method}</strong>, la solución indica que se deben enviar
      <strong>${fmt(x[0])}</strong>, <strong>${fmt(x[1])}</strong> y <strong>${fmt(x[2])}</strong>
      mil litros de carburante a las zonas <strong>Norte, Centro y Sur</strong> respectivamente.
      La <strong>Zona ${zonas[maxIdx]}</strong> es la que más recibe (mayor demanda), mientras que la
      <strong>Zona ${zonas[minIdx]}</strong> es la de menor envío. Si una ruta se bloqueara, bastaría con
      poner un cero en la fila/columna correspondiente y recalcular para ver qué zona queda más afectada.`;
  } else {
    body = `El vector solución <span class="mono">x = [${x.map(fmt).join(', ')}]</span> resuelve el sistema
      de abastecimiento planteado con el método <strong>${method}</strong>.`;
  }
  const conv = method === 'LU'
    ? `Al ser un <strong>método directo</strong>, LU entrega la solución exacta en un solo paso (sin iteraciones), siempre que la matriz no sea singular.`
    : (converged
        ? `El método <strong>convergió en ${iters} iteraciones</strong>, lo que sugiere que el sistema es <strong>estable</strong> y poco sensible a pequeños cambios en los datos.`
        : `El método <strong>no alcanzó la tolerancia</strong>; el sistema podría ser sensible/mal condicionado o la matriz no es diagonalmente dominante.`);
  return `<div class="interp mt-3"><h6>🧭 Interpretación en contexto boliviano</h6><p class="mb-0">${body} ${conv}</p></div>`;
}

/* ============================================================
   9. GRÁFICOS (Chart.js)
   ============================================================ */
function destroyChart() { if (convChart) { convChart.destroy(); convChart = null; } }

function drawConvergence(hist, name) {
  destroyChart();
  const ctx = document.getElementById('convCanvas');
  convChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hist.map(h => h.k),
      datasets: [{
        label: `Error · ${name}`,
        data: hist.map(h => h.err),
        borderColor: '#fb923c',
        backgroundColor: 'rgba(249,115,22,.15)',
        borderWidth: 2, tension: .25, fill: true, pointRadius: 3
      }]
    },
    options: chartOpts('Iteración (k)', 'Error (escala log)', true)
  });
}

function drawBarChart(values, n) {
  destroyChart();
  const ctx = document.getElementById('convCanvas');
  convChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: values.map((_, i) => `Ec. ${i + 1}`),
      datasets: [{
        label: 'Residuo |Ax − b| por ecuación',
        data: values,
        backgroundColor: 'rgba(59,130,246,.55)',
        borderColor: '#3b82f6', borderWidth: 1.5
      }]
    },
    options: chartOpts('Ecuación', 'Residuo', false)
  });
}

function chartOpts(xt, yt, logY) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#aab6c9' } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { title: { display: true, text: xt, color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
      y: {
        type: logY ? 'logarithmic' : 'linear',
        title: { display: true, text: yt, color: '#aab6c9' },
        ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' }
      }
    }
  };
}

/* ============================================================
   10. EXPLICACIÓN DEL ALGORITMO (texto dinámico)
   ============================================================ */
function renderAlgoExplanation(m) {
  const box = document.getElementById('algoBox');
  const data = {
    lu: {
      t: 'Descomposición LU con pivoteo parcial',
      body: `<p class="text-soft mb-2">Es un <strong>método directo</strong>: factoriza <code>PA = LU</code> donde L es triangular inferior (con 1 en la diagonal) y U triangular superior.</p>
        <ol><li>Se aplica eliminación gaussiana eligiendo en cada columna el pivote de mayor valor absoluto (<strong>pivoteo parcial</strong>) para estabilidad numérica.</li>
        <li>Se resuelve <code>Ly = Pb</code> por sustitución hacia adelante.</li>
        <li>Se resuelve <code>Ux = y</code> por sustitución hacia atrás.</li></ol>
        <p class="text-soft mb-0">Ventaja: da la solución exacta sin depender de convergencia. El determinante sale del producto de la diagonal de U.</p>`
    },
    jacobi: {
      t: 'Método de Jacobi',
      body: `<p class="text-soft mb-2">Método <strong>iterativo</strong>. Despeja cada incógnita de su ecuación:</p>
        <p class="mono text-orange">xᵢ⁽ᵏ⁺¹⁾ = ( bᵢ − Σⱼ≠ᵢ aᵢⱼ·xⱼ⁽ᵏ⁾ ) / aᵢᵢ</p>
        <ol><li>Usa <strong>siempre</strong> los valores de la iteración anterior.</li>
        <li>Converge si la matriz es diagonalmente dominante.</li>
        <li>Es el más simple pero el más lento de los iterativos.</li></ol>`
    },
    gauss: {
      t: 'Método de Gauss-Seidel',
      body: `<p class="text-soft mb-2">Variante de Jacobi que usa los valores <strong>ya actualizados</strong> en la misma iteración:</p>
        <p class="mono text-orange">xᵢ⁽ᵏ⁺¹⁾ = ( bᵢ − Σⱼ&lt;ᵢ aᵢⱼ·xⱼ⁽ᵏ⁺¹⁾ − Σⱼ&gt;ᵢ aᵢⱼ·xⱼ⁽ᵏ⁾ ) / aᵢᵢ</p>
        <p class="text-soft mb-0">Suele converger en aproximadamente la mitad de iteraciones que Jacobi.</p>`
    },
    sor: {
      t: 'SOR — Sobre-relajación sucesiva',
      body: `<p class="text-soft mb-2">Acelera Gauss-Seidel con un factor de relajación <code>ω</code>:</p>
        <p class="mono text-orange">xᵢ⁽ᵏ⁺¹⁾ = (1−ω)·xᵢ⁽ᵏ⁾ + ω·xᵢ(Gauss-Seidel)</p>
        <ul><li><code>ω = 1</code> → equivale a Gauss-Seidel.</li>
        <li><code>1 &lt; ω &lt; 2</code> → sobre-relajación (acelera la convergencia).</li>
        <li><code>0 &lt; ω &lt; 1</code> → sub-relajación (estabiliza).</li></ul>`
    },
    cg: {
      t: 'Gradiente Conjugado',
      body: `<p class="text-soft mb-2">Método iterativo óptimo para matrices <strong>simétricas definidas positivas</strong>. Minimiza la forma cuadrática asociada al sistema.</p>
        <ol><li>Calcula residuo <code>r = b − Ax</code> y dirección de búsqueda <code>p</code>.</li>
        <li>Avanza con paso óptimo <code>α</code> y conjuga las direcciones con <code>β</code>.</li>
        <li>En teoría converge en a lo sumo <code>n</code> iteraciones.</li></ol>`
    }
  };
  const d = data[m];
  box.innerHTML = `<h6>📘 Algoritmo: ${d.t}</h6>${d.body}`;
}

/* ============================================================
   11. INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  buildInputs(3, DEFAULT_A, DEFAULT_B);     // datos precargados
  renderAlgoExplanation('lu');
  document.getElementById('methodSelect').addEventListener('change', onMethodChange);
  document.getElementById('matSize').addEventListener('change', onSizeChange);
  document.getElementById('btnCalc').addEventListener('click', calcular);
  document.getElementById('btnExample').addEventListener('click', loadExample);
  onMethodChange();
});
