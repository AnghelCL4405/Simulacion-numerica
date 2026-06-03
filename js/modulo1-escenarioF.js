/* ============================================================
   MÓDULO 1 · ESCENARIO F — Rumores de desabastecimiento y pánico
   Sistemas de ecuaciones lineales MAL CONDICIONADOS.
   Un rumor sube la demanda de una zona; si el sistema es mal
   condicionado, ese pequeño cambio se amplifica enormemente.
   Reutiliza del archivo modulo1-sistemas.js (cargado antes):
     quickSolve · condInf · condBadge · norm2 · clone · fmt
   Métodos: Número de condición κ∞(A) + perturbación de datos.
   ============================================================ */

let fChart = null;
const F_ZONAS = ['Norte', 'Centro', 'Sur'];

/* Sistema MAL CONDICIONADO precargado (det ≈ 0.001 → κ enorme).
   Solución base exacta: x = [1, 5, 0].  b = demanda por zona. */
const F_BAD_A = [
  [1, 1, 1],
  [1, 2, 2],
  [1, 2, 2.001]
];
const F_BAD_B = [6, 11, 11];

/* Sistema BIEN CONDICIONADO (el mismo de referencia del Escenario A).
   Diagonalmente dominante y definido positivo → κ pequeño. */
const F_GOOD_A = [
  [10, 2, 1],
  [2, 12, 3],
  [1, 3, 15]
];
const F_GOOD_B = [46, 84, 108];

/* Niveles de rumor → % de aumento de la demanda */
const F_RUMOR_PCT = { bajo: 0.02, medio: 0.05, alto: 0.10, panico: 0.25 };
const F_RUMOR_TXT = { bajo: 'rumor bajo (+2%)', medio: 'rumor medio (+5%)', alto: 'rumor alto (+10%)', panico: 'pánico de compra (+25%)' };

/* ---- Construcción de la matriz 3×3 editable y etiquetada (ids con prefijo f_) ---- */
function fBuildInputs(A, b) {
  const mWrap = document.getElementById('f_matrixA');
  const bWrap = document.getElementById('f_vectorB');
  mWrap.style.gridTemplateColumns = 'auto repeat(3, auto)';
  bWrap.style.gridTemplateColumns = 'auto';
  mWrap.innerHTML = '';
  bWrap.innerHTML = '';

  // Encabezados de columna (zonas) + esquina vacía
  const corner = document.createElement('div');
  corner.className = 'mlabel mlabel-corner';
  mWrap.appendChild(corner);
  F_ZONAS.forEach(z => {
    const h = document.createElement('div');
    h.className = 'mlabel mlabel-col';
    h.textContent = z;
    mWrap.appendChild(h);
  });
  const bHead = document.createElement('div');
  bHead.className = 'mlabel mlabel-col';
  bHead.textContent = 'Demanda';
  bWrap.appendChild(bHead);

  for (let i = 0; i < 3; i++) {
    const rl = document.createElement('div');
    rl.className = 'mlabel mlabel-row';
    rl.textContent = 'Zona ' + F_ZONAS[i];
    mWrap.appendChild(rl);
    for (let j = 0; j < 3; j++) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'form-control'; inp.step = 'any';
      inp.id = `f_a_${i}_${j}`; inp.value = A[i][j];
      mWrap.appendChild(inp);
    }
    const bi = document.createElement('input');
    bi.type = 'number'; bi.className = 'form-control'; bi.step = 'any';
    bi.id = `f_b_${i}`; bi.value = b[i];
    bWrap.appendChild(bi);
  }
}

function fReadSystem() {
  const A = [], b = [];
  for (let i = 0; i < 3; i++) {
    A.push([]);
    for (let j = 0; j < 3; j++) {
      const v = parseFloat(document.getElementById(`f_a_${i}_${j}`).value);
      if (Number.isNaN(v)) throw new Error(`El valor A[${i + 1}][${j + 1}] no es válido.`);
      A[i].push(v);
    }
    const bv = parseFloat(document.getElementById(`f_b_${i}`).value);
    if (Number.isNaN(bv)) throw new Error(`La demanda b[${i + 1}] no es válida.`);
    b.push(bv);
  }
  return { A, b };
}

function fLoadBad() { fBuildInputs(F_BAD_A, F_BAD_B); document.getElementById('f_results').innerHTML = ''; document.getElementById('f_msg').innerHTML = ''; }
function fLoadGood() { fBuildInputs(F_GOOD_A, F_GOOD_B); document.getElementById('f_results').innerHTML = ''; document.getElementById('f_msg').innerHTML = ''; }

/* ============================================================
   ANÁLISIS DE SENSIBILIDAD (perturbación + número de condición)
   ============================================================ */
function fAnalyze() {
  const msg = document.getElementById('f_msg');
  const out = document.getElementById('f_results');
  msg.innerHTML = ''; out.innerHTML = '';

  let sys;
  try { sys = fReadSystem(); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }
  const { A, b } = sys;

  const method = document.getElementById('f_method').value;
  const zoneVal = document.getElementById('f_zone').value;       // 'all' | '0' | '1' | '2'
  const rumorKey = document.getElementById('f_rumor').value;     // bajo | medio | alto | panico
  const pct = F_RUMOR_PCT[rumorKey];

  const tol = 1e-10, maxIter = 500, omega = 1.1;

  // solución base
  let xBase;
  try { xBase = quickSolve(method, A, b, tol, maxIter, omega); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }
  if (!xBase || xBase.some(v => !isFinite(v))) {
    msg.innerHTML = `<div class="alert-soft alert-warn">El método elegido no entregó una solución válida (el sistema mal condicionado puede no converger con métodos iterativos). Prueba con <strong>LU</strong>.</div>`;
    return;
  }

  // vector de demanda perturbado por el rumor
  const b2 = [...b];
  if (zoneVal === 'all') for (let i = 0; i < 3; i++) b2[i] = b[i] * (1 + pct);
  else b2[+zoneVal] = b[+zoneVal] * (1 + pct);

  let xPert;
  try { xPert = quickSolve(method, A, b2, tol, maxIter, omega); }
  catch (e) { msg.innerHTML = `<div class="alert-soft alert-err">⚠️ ${e.message}</div>`; return; }

  // métricas de sensibilidad
  const cond = condInf(A);
  const db = b2.map((v, i) => v - b[i]);
  const dx = xPert.map((v, i) => v - xBase[i]);
  const relB = norm2(db) / norm2(b);
  const relX = norm2(dx) / (norm2(xBase) || 1);
  const amp = relB > 0 ? relX / relB : 0;
  const absDx = dx.map(Math.abs);
  const vulnIdx = absDx.indexOf(Math.max(...absDx));

  fRender({ A, b, b2, xBase, xPert, dx, db, relB, relX, amp, cond, vulnIdx, zoneVal, rumorKey, method });
}

function fRender(r) {
  const zoneTxt = r.zoneVal === 'all' ? 'todas las zonas' : `la Zona ${F_ZONAS[+r.zoneVal]}`;
  const methodNames = { lu: 'LU', jacobi: 'Jacobi', gauss: 'Gauss-Seidel', sor: 'SOR', cg: 'Gradiente Conjugado' };

  // tabla comparativa por zona
  const rows = r.xBase.map((xi, k) => {
    const pct = xi !== 0 ? (r.dx[k] / xi) * 100 : (r.dx[k] !== 0 ? Infinity : 0);
    return `<tr class="${k === r.vulnIdx ? 'highlight-row' : ''}">
      <td>Zona ${F_ZONAS[k]}</td>
      <td>${fmt(xi)}</td>
      <td>${fmt(r.xPert[k])}</td>
      <td class="${r.dx[k] !== 0 ? 'text-orange' : ''}">${r.dx[k] >= 0 ? '+' : ''}${fmt(r.dx[k])}</td>
      <td>${isFinite(pct) ? (pct >= 0 ? '+' : '') + fmt(pct) + '%' : '∞'}</td>
    </tr>`;
  }).join('');

  // veredicto de estabilidad
  let verdict;
  if (r.amp < 5) verdict = `<span class="tag tag-blue">estable · el cambio casi no se amplifica (×${fmt(r.amp)})</span>`;
  else if (r.amp < 50) verdict = `<span class="tag tag-orange">sensible · el cambio se amplifica ×${fmt(r.amp)}</span>`;
  else verdict = `<span class="tag tag-orange">muy sensible · mal condicionado (amplificación ×${fmt(r.amp)})</span>`;

  const html = `
    <div class="result-box">
      <div class="text-soft mb-1">📢 ${F_RUMOR_TXT[r.rumorKey]} aplicado a ${zoneTxt}</div>
      <div class="big-num text-orange">Amplificación ×${fmt(r.amp)}</div>
      <div class="text-soft mt-2 small">Un cambio del ${fmt(r.relB * 100)}% en la demanda produce un cambio del <strong>${fmt(r.relX * 100)}%</strong> en la distribución. ${verdict}</div>
    </div>

    <div class="row g-3 mt-1">
      <div class="col-md-4"><div class="kpi"><div class="label">Número de condición κ∞(A)</div><div class="value">${fmt(r.cond)}</div><div class="mt-1">${condBadge(r.cond)}</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Cambio en demanda · ‖Δb‖/‖b‖</div><div class="value">${fmt(r.relB * 100)}%</div></div></div>
      <div class="col-md-4"><div class="kpi"><div class="label">Cambio en solución · ‖Δx‖/‖x‖</div><div class="value text-orange">${fmt(r.relX * 100)}%</div></div></div>
    </div>

    <h6 class="text-blue mt-4 mb-2">Distribución antes y después del rumor — ${methodNames[r.method]}</h6>
    <div class="table-wrap">
      <table class="table table-sm mb-0">
        <thead><tr><th>Zona</th><th>x base</th><th>x con rumor</th><th>Δ cambio</th><th>Δ %</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <h6 class="text-blue mt-4 mb-2">Cambio absoluto |Δx| por zona</h6>
    <div class="chart-wrap"><canvas id="fCanvas"></canvas></div>

    ${fInterpretation(r, zoneTxt)}
  `;
  document.getElementById('f_results').innerHTML = `<div class="fade-in">${html}</div>`;
  fDrawBar(r.dx.map(Math.abs), r.vulnIdx);
}

function fInterpretation(r, zoneTxt) {
  const stable = r.amp < 5;
  const body = stable
    ? `El sistema está <strong>bien condicionado</strong> (κ∞ ≈ ${fmt(r.cond)}). El rumor sobre ${zoneTxt}
       aumentó la demanda un ${fmt(r.relB * 100)}% y la distribución solo cambió un ${fmt(r.relX * 100)}%:
       el cambio <strong>no se amplifica</strong>. La red es robusta frente a rumores moderados.`
    : `El sistema está <strong>mal condicionado</strong> (κ∞ ≈ ${fmt(r.cond)}). Un rumor que sube la demanda
       apenas un ${fmt(r.relB * 100)}% en ${zoneTxt} <strong>desordena toda la distribución</strong>
       (cambió un ${fmt(r.relX * 100)}%, amplificación ×${fmt(r.amp)}). La
       <strong>Zona ${F_ZONAS[r.vulnIdx]}</strong> es la <strong>más vulnerable</strong>: es donde el reparto se
       descontrola más. En la práctica esto significa que la información (un simple rumor) puede provocar
       compras de pánico y desabastecimiento desproporcionado.`;
  return `<div class="interp mt-3"><h6>🧭 Interpretación del Escenario F (rumores y pánico)</h6>
    <p class="mb-2">${body}</p>
    <p class="mb-0">El <strong>número de condición</strong> κ∞(A) = ‖A‖∞·‖A⁻¹‖∞ acota cuánto se amplifica el error:
    <span class="mono">(‖Δx‖/‖x‖) ≤ κ·(‖Δb‖/‖b‖)</span>. Por eso, cuanto mayor es κ, más peligroso es un rumor.
    Carga el <strong>sistema bien condicionado</strong> y repite el rumor para ver el contraste.</p></div>`;
}

/* ---- Gráfico de barras: |Δx| por zona, resaltando la más vulnerable ---- */
function fDrawBar(values, vulnIdx) {
  if (fChart) fChart.destroy();
  const colors = values.map((_, i) => i === vulnIdx ? 'rgba(249,115,22,.65)' : 'rgba(59,130,246,.5)');
  const borders = values.map((_, i) => i === vulnIdx ? '#f97316' : '#3b82f6');
  fChart = new Chart(document.getElementById('fCanvas'), {
    type: 'bar',
    data: {
      labels: F_ZONAS.map(z => 'Zona ' + z),
      datasets: [{ label: 'Cambio en la distribución |Δx|', data: values, backgroundColor: colors, borderColor: borders, borderWidth: 1.5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#aab6c9' } } },
      scales: {
        x: { ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { title: { display: true, text: '|Δx|', color: '#aab6c9' }, ticks: { color: '#8b98ad' }, grid: { color: 'rgba(255,255,255,.05)' } }
      }
    }
  });
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  fBuildInputs(F_BAD_A, F_BAD_B);   // arranca con el sistema mal condicionado
  document.getElementById('f_btnAnalyze').addEventListener('click', fAnalyze);
  document.getElementById('f_btnBad').addEventListener('click', fLoadBad);
  document.getElementById('f_btnGood').addEventListener('click', fLoadGood);
});
