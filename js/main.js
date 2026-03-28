Chart.register(ChartDataLabels);

// ── Utilities ───────────────────────────────────────────────────────────────
const fmtMes = m => `${m.slice(0,4)}/${m.slice(4)}`;
const fmtUSD = v => v == null ? '—' : '$' + Math.abs(v).toLocaleString('pt-BR', {minimumFractionDigits:0,maximumFractionDigits:0});
const fmtPct = v => v == null ? '—' : (v*100).toFixed(2)+'%';
const fmtPP  = v => v == null ? '—' : (v>=0?'+':'')+(v*100).toFixed(2)+'pp';

const PALETTE = ['#1565C0','#E65100','#00695C','#7B1FA2','#546E7A','#F9A825','#AD1457','#2E7D32','#0277BD','#6A1B9A'];
const GREEN = '#00A650', RED = '#E53935';
const getColor = i => PALETTE[i % PALETTE.length];

function destroyChart(id) { const c = Chart.getChart(id); if(c) c.destroy(); }

// ── Layer 2 helpers ─────────────────────────────────────────────────────────
function l2Filter(mes, tipo, centro) {
  return window.LAYER2_DATA.filter(d =>
    (!mes    || d.mes === mes) &&
    (!tipo   || d.TIPO === tipo) &&
    (!centro || d.cs_centro === centro)
  );
}

function aggregateBy(data, key, limit=15) {
  const map = {};
  data.forEach(d => { const k=d[key]||'N/A'; map[k]=(map[k]||0)+parseFloat(d.cashout_usd||0); });
  return Object.entries(map).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,limit);
}

function getMeses()    { return [...new Set(window.LAYER2_DATA.map(d=>d.mes))].sort(); }
function getLast12()   { const m=getMeses(); return m.slice(-12); }

function populateSelect(id, options, defaultLast=true) {
  const sel = document.getElementById(id);
  if(!sel) return;
  sel.innerHTML = '';
  options.forEach(o => { const opt=document.createElement('option'); opt.value=o; opt.textContent=fmtMes(o); sel.appendChild(opt); });
  if(defaultLast && options.length) sel.value = options[options.length-1];
}

function populateCausaSelect(id) {
  const causas = [...new Set(window.LAYER2_DATA.map(d=>d.L1_CAUSA_BPP).filter(Boolean))].sort();
  const sel = document.getElementById(id);
  if(!sel) return;
  const first = sel.options[0];
  sel.innerHTML = '';
  sel.appendChild(first);
  causas.forEach(c => { const opt=document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt); });
}

function populateManagerSelect() {
  const managers = [...new Set(window.LAYER1_MANAGER_DATA.map(d=>d.sr_manager).filter(Boolean))].sort();
  const sel = document.getElementById('ratio-manager');
  managers.forEach(m => { const opt=document.createElement('option'); opt.value=m; opt.textContent=m; sel.appendChild(opt); });
}

// ── Tab navigation ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('last-updated').textContent =
  'Atualizado em '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — RATIO VS TARGET
// ═══════════════════════════════════════════════════════════════════════════

const TARGETS = {
  "202601":{PDD:0.145610,PNR:0.067885},
  "202602":{PDD:0.154370,PNR:0.065969},
  "202603":{PDD:0.165244,PNR:0.077317},
  "202604":{PDD:0.134342,PNR:0.060683},
  "202605":{PDD:0.146672,PNR:0.061504},
  "202606":{PDD:0.134646,PNR:0.060605},
  "202607":{PDD:0.134067,PNR:0.069122},
  "202608":{PDD:0.132711,PNR:0.075085},
  "202609":{PDD:0.133870,PNR:0.070160},
  "202610":{PDD:0.134700,PNR:0.055960},
  "202611":{PDD:0.137779,PNR:0.047045},
  "202612":{PDD:0.134650,PNR:0.037864}
};

function getManagerData(tipo, centro, manager) {
  // Filter manager data
  let rows = window.LAYER1_MANAGER_DATA.filter(d =>
    (!centro  || d.cs_centro === centro) &&
    (!manager || d.sr_manager === manager)
  );

  // Aggregate cashout by mes + reason
  const cashMap = {};
  rows.forEach(d => {
    const key = d.mes + '|' + d.REASON_CLAIM;
    cashMap[key] = (cashMap[key]||0) + parseFloat(d.cashout_usd||0);
  });

  // Get total by mes (all managers, same filters) for GMV proxy
  const totalMap = {};
  window.LAYER1_MANAGER_DATA.filter(d => !centro || d.cs_centro === centro).forEach(d => {
    const key = d.mes + '|' + d.REASON_CLAIM;
    totalMap[key] = (totalMap[key]||0) + parseFloat(d.cashout_usd||0);
  });

  return { cashMap, totalMap };
}

function buildRatioSeries(tipo, centro, manager) {
  const meses12 = getLast12();
  const { cashMap, totalMap } = getManagerData(tipo, centro, manager);

  return meses12.map(mes => {
    let cashout, gmv, target;

    if (tipo === 'MED') {
      // Sum PDD + PNR
      const cashPDD = cashMap[mes+'|PDD']||0;
      const cashPNR = cashMap[mes+'|PNR']||0;
      cashout = cashPDD + cashPNR;

      // GMV from layer1 global (PDD+PNR)
      const l1PDD = window.LAYER1_DATA.find(d=>d.mes===mes&&d.reason_claim==='PDD');
      const l1PNR = window.LAYER1_DATA.find(d=>d.mes===mes&&d.reason_claim==='PNR');
      const totalGMV = (l1PDD?.gmv_usd||0) + (l1PNR?.gmv_usd||0);
      const totalCash = (totalMap[mes+'|PDD']||0) + (totalMap[mes+'|PNR']||0);
      const totalCashAll = (window.LAYER1_DATA.find(d=>d.mes===mes&&d.reason_claim==='PDD')?.cashout_usd||0) +
                           (window.LAYER1_DATA.find(d=>d.mes===mes&&d.reason_claim==='PNR')?.cashout_usd||0);
      const share = totalCashAll > 0 ? totalCash / totalCashAll : 1;
      gmv = totalGMV * share;

      // Target MED = weighted avg
      const t = TARGETS[mes];
      if (t && l1PDD && l1PNR) {
        const wPDD = l1PDD.cashout_usd / (l1PDD.cashout_usd + l1PNR.cashout_usd);
        target = t.PDD * wPDD + t.PNR * (1-wPDD);
      }
    } else {
      cashout = cashMap[mes+'|'+tipo]||0;
      const l1 = window.LAYER1_DATA.find(d=>d.mes===mes&&d.reason_claim===tipo);
      const totalCash = totalMap[mes+'|'+tipo]||0;
      const totalCashAll = l1?.cashout_usd||0;
      const share = totalCashAll > 0 ? totalCash / totalCashAll : 1;
      gmv = (l1?.gmv_usd||0) * share;
      target = TARGETS[mes]?.[tipo] ?? null;
    }

    const ratio = gmv > 0 ? cashout / gmv : null;
    return { mes, cashout, gmv, ratio, target, delta: (ratio!=null&&target!=null) ? ratio-target : null };
  });
}

function renderRatio() {
  const tipo    = document.getElementById('ratio-tipo').value;
  const centro  = document.getElementById('ratio-centro').value;
  const manager = document.getElementById('ratio-manager').value;
  const series  = buildRatioSeries(tipo, centro, manager);
  const meses   = series.map(d=>fmtMes(d.mes));

  // KPIs — último mês com target
  const comTarget = series.filter(d=>d.target!=null&&d.ratio!=null);
  const ultimo = comTarget[comTarget.length-1];
  const kpiEl = document.getElementById('kpi-ratio');
  if(ultimo) {
    const isGood = ultimo.delta <= 0;
    kpiEl.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Último mês (${fmtMes(ultimo.mes)})</div>
        <div class="kpi-value">${fmtPct(ultimo.ratio)}</div>
        <div class="kpi-sub">Realizado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Target ${fmtMes(ultimo.mes)}</div>
        <div class="kpi-value">${fmtPct(ultimo.target)}</div>
        <div class="kpi-sub">${tipo}</div>
      </div>
      <div class="kpi-card ${isGood?'green':'red'}">
        <div class="kpi-label">Variação vs. Target</div>
        <div class="kpi-value">${fmtPP(ultimo.delta)}</div>
        <div class="kpi-delta ${isGood?'pos':'neg'}">${isGood?'✓ Abaixo do target':'⚠ Acima do target'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cashout USD</div>
        <div class="kpi-value">${fmtUSD(ultimo.cashout)}</div>
      </div>
    `;
  }

  // Gráfico ratio
  destroyChart('chart-ratio');
  new Chart(document.getElementById('chart-ratio'), {
    type: 'line',
    data: {
      labels: meses,
      datasets: [
        {
          label: 'Realizado',
          data: series.map(d=>d.ratio),
          borderColor: '#1565C0',
          backgroundColor: '#1565C020',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2,
        },
        {
          label: 'Target',
          data: series.map(d=>d.target),
          borderColor: RED, borderDash: [6,4], borderWidth: 2,
          pointRadius: 0, fill: false, spanGaps: true,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label+': '+fmtPct(ctx.raw) } }
      },
      scales: {
        y: { ticks: { callback: v=>fmtPct(v) }, grid: { color:'#eee' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Gráfico variação
  destroyChart('chart-variacao');
  const varSeries = series.filter(d=>d.delta!=null);
  new Chart(document.getElementById('chart-variacao'), {
    type: 'bar',
    data: {
      labels: varSeries.map(d=>fmtMes(d.mes)),
      datasets: [{
        label: 'Variação vs. Target (pp)',
        data: varSeries.map(d=>+(d.delta*100).toFixed(3)),
        backgroundColor: varSeries.map(d=>d.delta<=0?GREEN+'CC':RED+'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: {
          display: true,
          anchor: ctx=>ctx.dataset.data[ctx.dataIndex]>=0?'end':'start',
          align:  ctx=>ctx.dataset.data[ctx.dataIndex]>=0?'top':'bottom',
          formatter: v=>(v>=0?'+':'')+v.toFixed(2)+'pp',
          font: { size:11, weight:'bold' },
          color: ctx=>ctx.dataset.data[ctx.dataIndex]<=0?GREEN:RED,
        },
        legend: { display: false },
      },
      scales: {
        y: { ticks: { callback: v=>v+'pp' }, grid: { color:'#eee' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Gráfico SR Manager cashout no período filtrado
  renderRatioManager(tipo, centro);
}

function renderRatioManager(tipo, centro) {
  const meses12 = getLast12();
  const rows = window.LAYER1_MANAGER_DATA.filter(d =>
    meses12.includes(d.mes) &&
    (!centro || d.cs_centro === centro) &&
    (tipo === 'MED' || d.REASON_CLAIM === tipo)
  );

  const byManager = {};
  rows.forEach(d => {
    const m = d.sr_manager || 'N/A';
    byManager[m] = (byManager[m]||0) + parseFloat(d.cashout_usd||0);
  });

  const total = Object.values(byManager).reduce((s,v)=>s+v,0);
  const sorted = Object.entries(byManager).sort((a,b)=>b[1]-a[1]);
  const pcts = sorted.map(d => total > 0 ? d[1]/total : 0);

  destroyChart('chart-ratio-manager');
  new Chart(document.getElementById('chart-ratio-manager'), {
    type: 'bar',
    data: {
      labels: sorted.map(d=>d[0]),
      datasets: [{
        label: '% do Cashout Total (últimos 12 meses)',
        data: pcts,
        backgroundColor: sorted.map((_,i)=>getColor(i)+'CC'),
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        datalabels: {
          display: true, anchor:'end', align:'right',
          formatter: v => (v*100).toFixed(1)+'%',
          font:{size:11}, color:'#333',
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks:{callback:v=>(v*100).toFixed(0)+'%'}, grid:{color:'#eee'}, max:1 },
        y: { grid:{display:false} }
      }
    }
  });
}

['ratio-tipo','ratio-centro','ratio-manager'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderRatio)
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — CUSTO POR CAUSA
// ═══════════════════════════════════════════════════════════════════════════

function renderCausa() {
  const mes    = document.getElementById('causa-mes').value;
  const centro = document.getElementById('causa-centro').value;
  const tipo   = document.getElementById('causa-tipo').value;
  const data   = l2Filter(mes, tipo, centro);
  const ranked = aggregateBy(data, 'L1_CAUSA_BPP');

  destroyChart('chart-causa');
  new Chart(document.getElementById('chart-causa'), {
    type: 'bar',
    data: {
      labels: ranked.map(d=>d[0]),
      datasets: [{ label:'Cashout USD', data:ranked.map(d=>d[1]),
        backgroundColor: ranked.map((_,i)=>getColor(i)+'CC'), borderRadius:6 }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: {
        datalabels: { display:true, anchor:'end', align:'right', formatter:v=>fmtUSD(v), font:{size:11}, color:'#333' },
        legend: { display:false },
      },
      scales: {
        x: { ticks:{callback:v=>fmtUSD(v)}, grid:{color:'#eee'} },
        y: { grid:{display:false} }
      }
    }
  });

  // Alerta: mês atual vs média 6 meses
  const meses = getMeses();
  const idxMes = meses.indexOf(mes);
  const ultimos6 = meses.slice(Math.max(0, idxMes-6), idxMes);
  const hist = {};
  ultimos6.forEach(m => {
    l2Filter(m, tipo, centro).forEach(d => {
      const k = d.L1_CAUSA_BPP||'N/A';
      if(!hist[k]) hist[k]={total:0,count:0};
      hist[k].total += parseFloat(d.cashout_usd||0);
      hist[k].count++;
    });
  });

  const causas = ranked.map(d=>d[0]);
  const atual  = ranked.map(d=>d[1]);
  const media  = causas.map(c => hist[c] ? hist[c].total / hist[c].count : null);

  destroyChart('chart-causa-alerta');
  new Chart(document.getElementById('chart-causa-alerta'), {
    type: 'bar',
    data: {
      labels: causas,
      datasets: [
        { label:'Mês atual', data:atual,
          backgroundColor: causas.map((_,i)=>atual[i]>=(media[i]??0)?RED+'CC':'#1565C0CC'),
          borderRadius:6 },
        { label:'Média 6 meses', data:media, type:'line',
          borderColor:'#333', borderDash:[5,4], borderWidth:2,
          pointRadius:4, fill:false, datalabels:{display:false} }
      ]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: {
        datalabels: {
          display: ctx => ctx.datasetIndex===0,
          anchor:'end', align:'right',
          formatter: (v,ctx) => {
            const avg = media[ctx.dataIndex];
            if(!avg) return fmtUSD(v);
            const delta = ((v-avg)/avg*100).toFixed(1);
            return `${fmtUSD(v)} (${delta>0?'+':''}${delta}%)`;
          },
          font:{size:10}, color:'#333',
        },
        legend: { position:'top' },
      },
      scales: {
        x: { ticks:{callback:v=>fmtUSD(v)}, grid:{color:'#eee'} },
        y: { grid:{display:false} }
      }
    }
  });
}

['causa-mes','causa-centro','causa-tipo'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderCausa)
);

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: Causa × Dimensão (Oficina / Canal)
// ═══════════════════════════════════════════════════════════════════════════

function renderCausaXDim(mes, centro, causaFiltro, dimKey, chartStackId, chartAlertaId) {
  const data = l2Filter(mes, '', centro).filter(d => !causaFiltro || d.L1_CAUSA_BPP === causaFiltro);

  // Top causas (stacked)
  const causas = [...new Set(data.map(d=>d.L1_CAUSA_BPP||'N/A'))];
  const dims   = [...new Set(data.map(d=>d[dimKey]||'N/A'))].sort();

  const causaMap = {};
  data.forEach(d => {
    const c = d.L1_CAUSA_BPP||'N/A', dim = d[dimKey]||'N/A';
    if(!causaMap[c]) causaMap[c]={};
    causaMap[c][dim] = (causaMap[c][dim]||0) + parseFloat(d.cashout_usd||0);
  });

  // Sort dims by total
  const dimTotals = {};
  dims.forEach(dim => {
    dimTotals[dim] = causas.reduce((s,c)=>(s+(causaMap[c]?.[dim]||0)),0);
  });
  const sortedDims = dims.sort((a,b)=>dimTotals[b]-dimTotals[a]).slice(0,12);

  // Top causas by total across all dims
  const causaTotals = {};
  causas.forEach(c => { causaTotals[c] = sortedDims.reduce((s,d)=>(s+(causaMap[c]?.[d]||0)),0); });
  const topCausas = causas.sort((a,b)=>causaTotals[b]-causaTotals[a]).slice(0,8);

  destroyChart(chartStackId);
  new Chart(document.getElementById(chartStackId), {
    type: 'bar',
    data: {
      labels: sortedDims,
      datasets: topCausas.map((c,i)=>({
        label: c,
        data: sortedDims.map(d=>causaMap[c]?.[d]||0),
        backgroundColor: getColor(i)+'CC',
        borderRadius: 4,
      }))
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display:false },
        legend: { position:'top' },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label+': '+fmtUSD(ctx.raw) } }
      },
      scales: {
        x: { stacked:true, grid:{display:false} },
        y: { stacked:true, ticks:{callback:v=>fmtUSD(v)}, grid:{color:'#eee'} }
      }
    }
  });

  // Alerta: dim atual vs média 6 meses
  const meses = getMeses();
  const idxMes = meses.indexOf(mes);
  const ultimos6 = meses.slice(Math.max(0,idxMes-6), idxMes);

  const histDim = {};
  ultimos6.forEach(m => {
    l2Filter(m,'',centro).filter(d=>!causaFiltro||d.L1_CAUSA_BPP===causaFiltro).forEach(d => {
      const dim = d[dimKey]||'N/A';
      if(!histDim[dim]) histDim[dim]={total:0,count:0};
      histDim[dim].total += parseFloat(d.cashout_usd||0);
      histDim[dim].count++;
    });
  });

  const atual = sortedDims.map(d=>dimTotals[d]);
  const media = sortedDims.map(d=>histDim[d]?histDim[d].total/histDim[d].count:null);

  destroyChart(chartAlertaId);
  new Chart(document.getElementById(chartAlertaId), {
    type: 'bar',
    data: {
      labels: sortedDims,
      datasets: [
        { label:'Mês atual', data:atual,
          backgroundColor: sortedDims.map((_,i)=>atual[i]>=(media[i]??0)?RED+'CC':'#1565C0CC'),
          borderRadius:6 },
        { label:'Média 6 meses', data:media, type:'line',
          borderColor:'#333', borderDash:[5,4], borderWidth:2, pointRadius:4, fill:false,
          datalabels:{display:false} }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: {
          display: ctx => ctx.datasetIndex===0,
          anchor:'end', align:'top',
          formatter: (v,ctx) => {
            const avg = media[ctx.dataIndex];
            if(!avg) return fmtUSD(v);
            const delta = ((v-avg)/avg*100).toFixed(1);
            return `${fmtUSD(v)}\n(${delta>0?'+':''}${delta}%)`;
          },
          font:{size:10}, color:'#333',
        },
        legend: { position:'top' },
      },
      scales: {
        x: { grid:{display:false} },
        y: { ticks:{callback:v=>fmtUSD(v)}, grid:{color:'#eee'} }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — POR OFICINA
// ═══════════════════════════════════════════════════════════════════════════

function renderOficina() {
  const mes    = document.getElementById('oficina-mes').value;
  const centro = document.getElementById('oficina-centro').value;
  const causa  = document.getElementById('oficina-causa').value;
  renderCausaXDim(mes, centro, causa, 'oficina', 'chart-oficina-causa', 'chart-oficina-alerta');
}

['oficina-mes','oficina-centro','oficina-causa'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderOficina)
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — POR CANAL
// ═══════════════════════════════════════════════════════════════════════════

function renderCanal() {
  const mes    = document.getElementById('canal-mes').value;
  const centro = document.getElementById('canal-centro').value;
  const causa  = document.getElementById('canal-causa').value;
  renderCausaXDim(mes, centro, causa, 'canal', 'chart-canal-causa', 'chart-canal-alerta');
}

['canal-mes','canal-centro','canal-causa'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderCanal)
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 — POR SR MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function renderManager() {
  const mes    = document.getElementById('manager-mes').value;
  const centro = document.getElementById('manager-centro').value;
  const data   = l2Filter(mes,'',centro);
  const byMgr  = aggregateBy(data,'sr_manager');

  destroyChart('chart-manager');
  new Chart(document.getElementById('chart-manager'), {
    type: 'bar',
    data: {
      labels: byMgr.map(d=>d[0]||'N/A'),
      datasets: [{label:'Cashout USD', data:byMgr.map(d=>d[1]),
        backgroundColor:byMgr.map((_,i)=>getColor(i)+'CC'), borderRadius:6}]
    },
    options: {
      indexAxis:'y', responsive:true,
      plugins: {
        datalabels:{display:true,anchor:'end',align:'right',formatter:v=>fmtUSD(v),font:{size:11},color:'#333'},
        legend:{display:false},
      },
      scales:{x:{ticks:{callback:v=>fmtUSD(v)},grid:{color:'#eee'}},y:{grid:{display:false}}}
    }
  });

  // Tendência
  const meses = getMeses();
  const managers = [...new Set(window.LAYER2_DATA.map(d=>d.sr_manager).filter(Boolean))].sort();
  const trendMap = {};
  window.LAYER2_DATA.filter(d=>!centro||d.cs_centro===centro).forEach(d=>{
    if(!d.sr_manager) return;
    if(!trendMap[d.sr_manager]) trendMap[d.sr_manager]={};
    trendMap[d.sr_manager][d.mes]=(trendMap[d.sr_manager][d.mes]||0)+parseFloat(d.cashout_usd||0);
  });

  destroyChart('chart-manager-trend');
  new Chart(document.getElementById('chart-manager-trend'), {
    type:'line',
    data:{
      labels:meses.map(fmtMes),
      datasets:managers.map((m,i)=>({
        label:m, data:meses.map(mes=>trendMap[m]?.[mes]||null),
        borderColor:getColor(i), backgroundColor:'transparent',
        tension:0.3, pointRadius:3, borderWidth:2, spanGaps:true,
      }))
    },
    options:{
      responsive:true,
      plugins:{
        datalabels:{display:false},
        legend:{position:'top'},
        tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtUSD(ctx.raw)}}
      },
      scales:{
        y:{ticks:{callback:v=>fmtUSD(v)},grid:{color:'#eee'}},
        x:{grid:{display:false}}
      }
    }
  });
}

['manager-mes','manager-centro'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderManager)
);

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

function init() {
  const meses = getMeses();
  ['causa-mes','oficina-mes','canal-mes','manager-mes'].forEach(id => populateSelect(id, meses));
  populateCausaSelect('oficina-causa');
  populateCausaSelect('canal-causa');
  populateManagerSelect();

  renderRatio();
  renderCausa();
  renderOficina();
  renderCanal();
  renderManager();
}

init();
