Chart.register(ChartDataLabels);

// ── Utilities ──────────────────────────────────────────────────────────────

const fmtMes = m => `${m.slice(0,4)}/${m.slice(4)}`;
const fmtUSD = v => v == null ? '—' : '$' + Math.abs(v).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0});
const fmtPct = v => v == null ? '—' : (v * 100).toFixed(2) + '%';
const fmtPP  = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + 'pp';

const COLORS = {
  yellow: '#FFE600',
  blue:   '#1565C0',
  green:  '#00A650',
  red:    '#E53935',
  purple: '#7B1FA2',
  orange: '#E65100',
  teal:   '#00695C',
  gray:   '#546E7A',
};
const PALETTE = Object.values(COLORS);

function getColor(i) { return PALETTE[i % PALETTE.length]; }

function destroyChart(id) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();
}

// ── Layer 2 helpers ─────────────────────────────────────────────────────────

function l2Filter(mes, tipo) {
  return window.LAYER2_DATA.filter(d =>
    (!mes  || d.mes === mes) &&
    (!tipo || d.TIPO === tipo)
  );
}

function aggregateBy(data, key) {
  const map = {};
  data.forEach(d => {
    const k = d[key] || 'N/A';
    map[k] = (map[k] || 0) + parseFloat(d.cashout_usd || 0);
  });
  return Object.entries(map)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 15);
}

function getMeses() {
  return [...new Set(window.LAYER2_DATA.map(d => d.mes))].sort();
}

function populateSelect(id, options, defaultLast = true) {
  const sel = document.getElementById(id);
  sel.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = fmtMes(o);
    sel.appendChild(opt);
  });
  if (defaultLast && options.length) sel.value = options[options.length - 1];
}

// ── Tab navigation ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Last updated ────────────────────────────────────────────────────────────

document.getElementById('last-updated').textContent =
  'Atualizado em ' + new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'});

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — RATIO VS TARGET
// ═══════════════════════════════════════════════════════════════════════════

function renderRatio() {
  const tipo = document.getElementById('ratio-tipo').value;
  const data = window.LAYER1_DATA.filter(d => d.reason_claim === tipo);
  const meses = data.map(d => fmtMes(d.mes));

  // KPIs — último mês com target
  const comTarget = data.filter(d => d.ratio_target != null);
  const ultimo = comTarget[comTarget.length - 1];

  const kpiEl = document.getElementById('kpi-ratio');
  if (ultimo) {
    const delta = ultimo.variacao_vs_target;
    const isGood = delta <= 0;
    kpiEl.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Último mês (${fmtMes(ultimo.mes)})</div>
        <div class="kpi-value">${fmtPct(ultimo.ratio_realizado)}</div>
        <div class="kpi-sub">Realizado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Target ${fmtMes(ultimo.mes)}</div>
        <div class="kpi-value">${fmtPct(ultimo.ratio_target)}</div>
        <div class="kpi-sub">${tipo}</div>
      </div>
      <div class="kpi-card ${isGood ? 'green' : 'red'}">
        <div class="kpi-label">Variação vs. Target</div>
        <div class="kpi-value">${fmtPP(delta)}</div>
        <div class="kpi-delta ${isGood ? 'pos' : 'neg'}">${isGood ? '✓ Abaixo do target' : '⚠ Acima do target'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cashout USD</div>
        <div class="kpi-value">${fmtUSD(ultimo.cashout_usd)}</div>
        <div class="kpi-sub">GMV: ${fmtUSD(ultimo.gmv_usd)}</div>
      </div>
    `;
  }

  // Chart — ratio linha + target linha
  destroyChart('chart-ratio');
  new Chart(document.getElementById('chart-ratio'), {
    type: 'line',
    data: {
      labels: meses,
      datasets: [
        {
          label: 'Realizado',
          data: data.map(d => d.ratio_realizado),
          borderColor: COLORS.blue,
          backgroundColor: COLORS.blue + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'Target',
          data: data.map(d => d.ratio_target),
          borderColor: COLORS.red,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          spanGaps: true,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + fmtPct(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => fmtPct(v) },
          grid: { color: '#eee' }
        },
        x: { grid: { display: false } }
      }
    }
  });

  // Chart — variação pp
  destroyChart('chart-variacao');
  const varData = data.filter(d => d.variacao_vs_target != null);
  new Chart(document.getElementById('chart-variacao'), {
    type: 'bar',
    data: {
      labels: varData.map(d => fmtMes(d.mes)),
      datasets: [{
        label: 'Variação vs. Target (pp)',
        data: varData.map(d => +(d.variacao_vs_target * 100).toFixed(3)),
        backgroundColor: varData.map(d => d.variacao_vs_target <= 0 ? COLORS.green + 'CC' : COLORS.red + 'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: {
          display: true,
          anchor: ctx => ctx.dataset.data[ctx.dataIndex] >= 0 ? 'end' : 'start',
          align: ctx => ctx.dataset.data[ctx.dataIndex] >= 0 ? 'top' : 'bottom',
          formatter: v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp',
          font: { size: 11, weight: 'bold' },
          color: ctx => ctx.dataset.data[ctx.dataIndex] <= 0 ? COLORS.green : COLORS.red,
        },
        legend: { display: false },
      },
      scales: {
        y: { ticks: { callback: v => v + 'pp' }, grid: { color: '#eee' } },
        x: { grid: { display: false } }
      }
    }
  });
}

document.getElementById('ratio-tipo').addEventListener('change', renderRatio);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — CUSTO POR CAUSA
// ═══════════════════════════════════════════════════════════════════════════

function renderCausa() {
  const mes  = document.getElementById('causa-mes').value;
  const tipo = document.getElementById('causa-tipo').value;
  const data = aggregateBy(l2Filter(mes, tipo), 'L1_CAUSA_BPP');

  destroyChart('chart-causa');
  new Chart(document.getElementById('chart-causa'), {
    type: 'bar',
    data: {
      labels: data.map(d => d[0]),
      datasets: [{
        label: 'Cashout USD',
        data: data.map(d => d[1]),
        backgroundColor: data.map((_, i) => getColor(i) + 'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'right',
          formatter: v => fmtUSD(v),
          font: { size: 11 },
          color: '#333',
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — POR OFICINA
// ═══════════════════════════════════════════════════════════════════════════

function renderOficina() {
  const mes  = document.getElementById('oficina-mes').value;
  const data = l2Filter(mes, '');

  // Por oficina
  const byOficina = aggregateBy(data, 'oficina');
  destroyChart('chart-oficina');
  new Chart(document.getElementById('chart-oficina'), {
    type: 'bar',
    data: {
      labels: byOficina.map(d => d[0]),
      datasets: [{
        label: 'Cashout USD',
        data: byOficina.map(d => d[1]),
        backgroundColor: byOficina.map((_, i) => getColor(i) + 'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        datalabels: {
          display: true, anchor: 'end', align: 'right',
          formatter: v => fmtUSD(v), font: { size: 11 }, color: '#333',
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } },
        y: { grid: { display: false } }
      }
    }
  });

  // Por centro (donut)
  const byCentro = aggregateBy(data, 'cs_centro');
  destroyChart('chart-centro');
  new Chart(document.getElementById('chart-centro'), {
    type: 'doughnut',
    data: {
      labels: byCentro.map(d => d[0]),
      datasets: [{
        data: byCentro.map(d => d[1]),
        backgroundColor: byCentro.map((_, i) => getColor(i) + 'CC'),
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: {
          display: true,
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return ctx.chart.data.labels[ctx.dataIndex] + '\n' + (v/total*100).toFixed(1) + '%';
          },
          font: { size: 12, weight: 'bold' },
          color: '#fff',
        },
        legend: { position: 'bottom' },
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — POR CANAL
// ═══════════════════════════════════════════════════════════════════════════

function renderCanal() {
  const mes  = document.getElementById('canal-mes').value;
  const data = l2Filter(mes, '');

  // Por canal
  const byCanal = aggregateBy(data, 'canal');
  destroyChart('chart-canal');
  new Chart(document.getElementById('chart-canal'), {
    type: 'bar',
    data: {
      labels: byCanal.map(d => d[0]),
      datasets: [{
        label: 'Cashout USD',
        data: byCanal.map(d => d[1]),
        backgroundColor: byCanal.map((_, i) => getColor(i) + 'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: {
          display: true, anchor: 'end', align: 'top',
          formatter: v => fmtUSD(v), font: { size: 11 }, color: '#333',
        },
        legend: { display: false },
      },
      scales: {
        y: { ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Canal × Tipo (stacked)
  const tipos = [...new Set(data.map(d => d.TIPO))].sort();
  const canais = [...new Set(data.map(d => d.canal || 'N/A'))].sort();

  const canalTipoMap = {};
  data.forEach(d => {
    const c = d.canal || 'N/A';
    const t = d.TIPO;
    if (!canalTipoMap[t]) canalTipoMap[t] = {};
    canalTipoMap[t][c] = (canalTipoMap[t][c] || 0) + parseFloat(d.cashout_usd || 0);
  });

  destroyChart('chart-canal-tipo');
  new Chart(document.getElementById('chart-canal-tipo'), {
    type: 'bar',
    data: {
      labels: canais,
      datasets: tipos.map((t, i) => ({
        label: t,
        data: canais.map(c => canalTipoMap[t]?.[c] || 0),
        backgroundColor: getColor(i) + 'CC',
        borderRadius: 4,
      }))
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'top' },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 — POR SR MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function renderManager() {
  const mes = document.getElementById('manager-mes').value;
  const data = l2Filter(mes, '');

  // Ranking por manager
  const byManager = aggregateBy(data, 'sr_manager');
  destroyChart('chart-manager');
  new Chart(document.getElementById('chart-manager'), {
    type: 'bar',
    data: {
      labels: byManager.map(d => d[0] || 'N/A'),
      datasets: [{
        label: 'Cashout USD',
        data: byManager.map(d => d[1]),
        backgroundColor: byManager.map((_, i) => getColor(i) + 'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        datalabels: {
          display: true, anchor: 'end', align: 'right',
          formatter: v => fmtUSD(v), font: { size: 11 }, color: '#333',
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } },
        y: { grid: { display: false } }
      }
    }
  });

  // Evolução mensal por manager (linha)
  const meses = getMeses();
  const managers = [...new Set(window.LAYER2_DATA.map(d => d.sr_manager).filter(Boolean))].sort();

  const trendMap = {};
  window.LAYER2_DATA.forEach(d => {
    if (!d.sr_manager) return;
    if (!trendMap[d.sr_manager]) trendMap[d.sr_manager] = {};
    trendMap[d.sr_manager][d.mes] = (trendMap[d.sr_manager][d.mes] || 0) + parseFloat(d.cashout_usd || 0);
  });

  destroyChart('chart-manager-trend');
  new Chart(document.getElementById('chart-manager-trend'), {
    type: 'line',
    data: {
      labels: meses.map(fmtMes),
      datasets: managers.map((m, i) => ({
        label: m,
        data: meses.map(mes => trendMap[m]?.[mes] || null),
        borderColor: getColor(i),
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
        spanGaps: true,
      }))
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtUSD(ctx.raw) } }
      },
      scales: {
        y: { ticks: { callback: v => fmtUSD(v) }, grid: { color: '#eee' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

function init() {
  const meses = getMeses();

  // Popula selects de mês
  ['causa-mes', 'oficina-mes', 'canal-mes', 'manager-mes'].forEach(id => {
    populateSelect(id, meses);
  });

  // Event listeners
  document.getElementById('causa-mes').addEventListener('change', renderCausa);
  document.getElementById('causa-tipo').addEventListener('change', renderCausa);
  document.getElementById('oficina-mes').addEventListener('change', renderOficina);
  document.getElementById('canal-mes').addEventListener('change', renderCanal);
  document.getElementById('manager-mes').addEventListener('change', renderManager);

  // Render inicial
  renderRatio();
  renderCausa();
  renderOficina();
  renderCanal();
  renderManager();
}

init();
