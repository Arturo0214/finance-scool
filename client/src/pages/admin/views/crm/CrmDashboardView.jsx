/**
 * CrmDashboardView — Tableros interactivos del CRM (Business Review)
 * Admin/agencia: ranking de asesores + KPIs de la promotoría + drill-down.
 * Asesor: su propio tablero (RESUMEN ANUAL) con bonos y conservación.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, Area, LabelList,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Shield, Award, Users, RefreshCw, X, Briefcase, Bell, FileDown, Trophy, Medal, Upload } from 'lucide-react';
import { getCrmCSS, MESES, fmtMoney, fmtMoneyFull, fmtPct, fmtDate, etapaInfo, ETAPAS, tipoRecordatorio } from './crmShared';
import CrmCarteraSection from './CrmCarteraSection';

const ANIOS = [2023, 2024, 2025, 2026, 2027];

function chartData(summary) {
  return summary.kpis.months.map((m, i) => ({
    mes: MESES[i],
    'Prima nueva': Math.round(m.primaNueva),
    'Renovación': Math.round(m.primaRenovacion),
    Meta: Math.round(m.meta),
    'Proyección': Math.round(summary.forecast[i]?.proyeccion || 0),
  }));
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, boxShadow: '0 6px 18px rgba(0,0,0,.1)' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px', color: C.text }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color }}>{p.name}: <b>{fmtMoneyFull(p.value)}</b></p>
      ))}
    </div>
  );
}

/* Gráfica principal de producción (barras apiladas + líneas meta/proyección) */
function ProductionChart({ data, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<MoneyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Prima nueva" stackId="prima" fill={C.primary} radius={[0, 0, 0, 0]} maxBarSize={34} />
        <Bar dataKey="Renovación" stackId="prima" fill={C.accent} radius={[6, 6, 0, 0]} maxBarSize={34} />
        <Line type="monotone" dataKey="Meta" stroke={C.amber} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
        <Line type="monotone" dataKey="Proyección" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* Funnel de clientes por etapa (dona) */
function ClientFunnel({ funnel }) {
  const data = ETAPAS.filter(e => funnel[e.id]).map(e => ({ name: e.label, value: funnel[e.id], color: e.color }));
  if (!data.length) return <p className="empty">Sin clientes registrados</p>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={45} outerRadius={72} paddingAngle={3} strokeWidth={0}>
            {data.map(d => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} clientes`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1, minWidth: 140 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: C.textMuted }}>{d.name}</span>
            <b style={{ color: C.text }}>{d.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Tablero individual de un asesor (usado en drill-down y vista de asesor) */
function AgentBoard({ summary }) {
  const { agent, kpis, bonos, clientes } = summary;
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try { await api.crmDownloadReport(agent.id, summary.anio); }
    catch (e) { alert(e.message); }
    finally { setPdfBusy(false); }
  };
  const t = kpis.totales;
  const cons = kpis.conservacion;
  const indiceColor = cons.indiceProyectado >= 0.94 ? C.green : cons.indiceProyectado >= 0.86 ? C.amber : C.red;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-secondary" onClick={downloadPdf} disabled={pdfBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileDown size={15} /> {pdfBusy ? 'Generando...' : 'Descargar Business Review (PDF)'}
        </button>
      </div>
      <div className="crm-kpi-detail">
        <div className="crm-kpi-box">
          <div className="k-label">Prima pagada total</div>
          <div className="k-value">{fmtMoney(t.primaTotal)}</div>
          <div className="k-sub">Nueva {fmtMoney(t.primaNueva)} · Renov. {fmtMoney(t.primaRenovacion)}</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Cumplimiento de meta</div>
          <div className="k-value" style={{ color: t.cumplimiento >= 1 ? C.green : t.cumplimiento >= 0.7 ? C.amber : C.red }}>{fmtPct(t.cumplimiento)}</div>
          <div className="k-sub">Meta anual {fmtMoney(t.meta)}</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Índice conservación</div>
          <div className="k-value" style={{ color: indiceColor }}>{fmtPct(cons.indiceProyectado, 1)}</div>
          <div className="k-sub">Actual {fmtPct(cons.indiceActual, 1)} · Base {fmtMoney(cons.baseConservar)}</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Pipeline</div>
          <div className="k-value" style={{ color: C.accent }}>{fmtMoney(t.pipeline)}</div>
          <div className="k-sub">En trámite + pendiente de pago</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Bono trimestral est. ({bonos.trimestre})</div>
          <div className="k-value" style={{ color: C.green }}>{fmtMoney(bonos.bonoTrimestral.monto)}</div>
          <div className="k-sub">
            {bonos.bonoTrimestral.rango
              ? `Rango ${bonos.bonoTrimestral.rango} · ${fmtPct(bonos.bonoTrimestral.pct, 1)} de ${fmtMoney(bonos.primaTrimestre)}`
              : `Prima Q ${fmtMoney(bonos.primaTrimestre)} — aún sin rango`}
          </div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Clientes</div>
          <div className="k-value">{clientes.total}</div>
          <div className="k-sub">{clientes.funnel.postventa || 0} en post venta · {clientes.funnel.prospecto || 0} prospectos</div>
        </div>
      </div>

      <div className="crm-chart-card">
        <h3>Producción mensual {summary.anio || ''}</h3>
        <p className="sub">Prima pagada vs meta vs proyección — {agent.cuaderno} · desde {fmtDate(agent.fecha_inicio_calculos)}</p>
        <ProductionChart data={chartData(summary)} height={280} />
      </div>

      <div className="crm-chart-card">
        <h3>Cartera por etapa</h3>
        <p className="sub">Distribución de clientes en el embudo</p>
        <ClientFunnel funnel={clientes.funnel} />
      </div>
    </>
  );
}

/* ═══════════ Pestaña RENDIMIENTO — tableros tipo Power BI ═══════════ */

const PIE_COLORS = ['#003DA5', '#0088E0', '#C1975B', '#0E8A63', '#6D28D9', '#B97F1E', '#0891B2', '#DB2777'];

function DeltaBadge({ actual, anterior }) {
  if (!anterior) return <span style={{ fontSize: 11.5, color: C.textLight }}>sin periodo previo</span>;
  const d = (actual - anterior) / anterior;
  const up = d >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: up ? C.green : C.red }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {up ? '+' : ''}{(d * 100).toFixed(1)}% vs anterior
    </span>
  );
}

/* Matriz de calor asesor × mes (estilo matrix de Power BI) */
function HeatMatrix({ agentes }) {
  const cell = (a, i) => (a.kpis.months[i].primaNueva + a.kpis.months[i].primaRenovacion);
  const max = Math.max(1, ...agentes.flatMap(a => Array.from({ length: 12 }, (_, i) => cell(a, i))));
  const totalMes = (i) => agentes.reduce((s, a) => s + cell(a, i), 0);
  return (
    <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: '#F5F6F8', zIndex: 1 }}>Asesor</th>
            {MESES.map(m => <th key={m} style={{ textAlign: 'center' }}>{m}</th>)}
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {agentes.map(a => {
            const total = Array.from({ length: 12 }, (_, i) => cell(a, i)).reduce((s, v) => s + v, 0);
            return (
              <tr key={a.agent.id}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, whiteSpace: 'nowrap' }}><b>{a.agent.nombre.split(' ').slice(0, 2).join(' ')}</b></td>
                {MESES.map((_, i) => {
                  const v = cell(a, i);
                  const t = v / max;
                  return (
                    <td key={i} style={{
                      textAlign: 'center', fontSize: 11.5, fontWeight: 600, padding: '9px 6px',
                      background: v > 0 ? `rgba(0,61,165,${0.06 + t * 0.8})` : 'transparent',
                      color: t > 0.5 ? '#fff' : v > 0 ? C.primaryDark : C.textLight,
                    }}>
                      {v > 0 ? fmtMoney(v) : '·'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'right' }}><b>{fmtMoney(total)}</b></td>
              </tr>
            );
          })}
          <tr style={{ background: '#F7F8FA' }}>
            <td style={{ position: 'sticky', left: 0, background: '#F7F8FA', zIndex: 1 }}><b>Promotoría</b></td>
            {MESES.map((_, i) => <td key={i} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700 }}>{totalMes(i) > 0 ? fmtMoney(totalMes(i)) : '·'}</td>)}
            <td style={{ textAlign: 'right' }}><b>{fmtMoney(MESES.reduce((s, _, i) => s + totalMes(i), 0))}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PerformanceTab({ data, anio, personal = false }) {
  const [periodo, setPeriodo] = useState('mensual');
  const [cohorts, setCohorts] = useState(null);
  useEffect(() => { api.crmGetCohorts().then(d => setCohorts(d.cohortes)).catch(() => setCohorts([])); }, []);
  const months = data.global.kpis.months;
  const forecast = data.global.forecast;

  const mensual = months.map((m, i) => ({
    label: MESES[i],
    'Prima nueva': Math.round(m.primaNueva), 'Renovación': Math.round(m.primaRenovacion),
    Meta: Math.round(m.meta), 'Proyección': Math.round(forecast[i]?.proyeccion || 0),
    total: m.primaNueva + m.primaRenovacion, meta: m.meta,
  }));
  const trimestral = [0, 1, 2, 3].map(q => {
    const s = mensual.slice(q * 3, q * 3 + 3);
    const sum = (k) => Math.round(s.reduce((acc, x) => acc + x[k], 0));
    return { label: `Q${q + 1}`, 'Prima nueva': sum('Prima nueva'), 'Renovación': sum('Renovación'), Meta: sum('Meta'), 'Proyección': sum('Proyección'), total: sum('total'), meta: sum('meta') };
  });
  let ar = 0, am = 0, ap = 0;
  const anual = mensual.map(m => ({ label: m.label, 'Real acumulado': Math.round(ar += m.total), 'Meta acumulada': Math.round(am += m.meta), 'Proyección acumulada': Math.round(ap += m['Proyección']) }));

  const now = new Date();
  const curM = anio === now.getFullYear() ? now.getMonth() : 11;
  const curQ = Math.floor(curM / 3);
  const serie = periodo === 'trimestral' ? trimestral : mensual;
  const curIdx = periodo === 'trimestral' ? curQ : curM;
  const actual = serie[curIdx] || { total: 0, meta: 0 };
  const anterior = serie[curIdx - 1];
  const nombrePeriodo = periodo === 'trimestral' ? `Q${curQ + 1} ${anio}` : `${MESES[curM]} ${anio}`;

  /* Ranking y participación de asesores */
  const rank = [...data.porAgente]
    .map(a => ({ nombre: a.agent.nombre.split(' ').slice(0, 2).join(' '), Prima: Math.round(a.kpis.totales.primaTotal), Meta: Math.round(a.kpis.totales.meta) }))
    .sort((a, b) => b.Prima - a.Prima);
  const totalPrima = rank.reduce((s, r) => s + r.Prima, 0);
  const share = rank.filter(r => r.Prima > 0).map((r, i) => ({ name: r.nombre, value: r.Prima, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const top = (fn) => [...data.porAgente].sort((a, b) => fn(b) - fn(a))[0];
  const topPrima = top(a => a.kpis.totales.primaTotal);
  const topCumpl = top(a => a.kpis.totales.cumplimiento || 0);
  const topCons = top(a => a.kpis.conservacion.indiceProyectado || 0);

  const mixNueva = months.reduce((s, m) => s + m.primaNueva, 0);
  const mixRenov = months.reduce((s, m) => s + m.primaRenovacion, 0);

  return (
    <>
      {/* ═══ Rendimiento de la empresa ═══ */}
      <div className="crm-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3>{personal ? 'Mis ventas' : 'Rendimiento de la empresa'}</h3>
            <p className="sub" style={{ marginBottom: 10 }}>{personal ? 'Tu prima pagada por periodo vs tu meta y proyección' : 'Prima pagada por periodo vs meta y proyección'}</p>
          </div>
          <div className="filter-tabs">
            {[['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Acumulado anual']].map(([id, l]) => (
              <button key={id} className={`f-tab${periodo === id ? ' active' : ''}`} onClick={() => setPeriodo(id)}>{l}</button>
            ))}
          </div>
        </div>

        {periodo !== 'anual' && (
          <div className="crm-kpi-detail" style={{ marginTop: 10 }}>
            <div className="crm-kpi-box">
              <div className="k-label">Prima {nombrePeriodo}</div>
              <div className="k-value">{fmtMoney(actual.total)}</div>
              <div className="k-sub"><DeltaBadge actual={actual.total} anterior={anterior?.total} /></div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Meta del periodo</div>
              <div className="k-value">{fmtMoney(actual.meta)}</div>
              <div className="k-sub">{actual.meta > 0 ? `cumplimiento ${fmtPct(actual.total / actual.meta)}` : 'sin meta capturada'}</div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Proyección del periodo</div>
              <div className="k-value" style={{ color: C.green }}>{fmtMoney(actual['Proyección'] || 0)}</div>
              <div className="k-sub">real + pipeline + run-rate</div>
            </div>
            <div className="crm-kpi-box">
              <div className="k-label">Mix del año</div>
              <div className="k-value" style={{ fontSize: 18 }}>{fmtPct(mixNueva / Math.max(mixNueva + mixRenov, 1))} nueva</div>
              <div className="k-sub">Nueva {fmtMoney(mixNueva)} · Renov. {fmtMoney(mixRenov)}</div>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          {periodo === 'anual' ? (
            <ComposedChart data={anual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Real acumulado" stroke={C.primary} strokeWidth={2.5} fill={`${C.primary}22`} />
              <Line type="monotone" dataKey="Proyección acumulada" stroke={C.green} strokeWidth={2.5} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="Meta acumulada" stroke={C.gold} strokeWidth={2} strokeDasharray="7 4" dot={false} />
            </ComposedChart>
          ) : (
            <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Prima nueva" stackId="p" fill={C.primary} maxBarSize={periodo === 'trimestral' ? 64 : 34} />
              <Bar dataKey="Renovación" stackId="p" fill={C.accent} radius={[6, 6, 0, 0]} maxBarSize={periodo === 'trimestral' ? 64 : 34} />
              <Line type="monotone" dataKey="Meta" stroke={C.gold} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
              <Line type="monotone" dataKey="Proyección" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* ═══ Podio de asesores ═══ */}
      {!personal && (
      <div className="crm-kpi-detail" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div className="crm-kpi-box" style={{ borderTop: `3px solid ${C.gold}` }}>
          <div className="k-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Trophy size={13} color={C.gold} /> Mayor prima pagada</div>
          <div className="k-value" style={{ fontSize: 18 }}>{topPrima?.agent.nombre || '—'}</div>
          <div className="k-sub">{fmtMoney(topPrima?.kpis.totales.primaTotal || 0)} en {anio}</div>
        </div>
        <div className="crm-kpi-box" style={{ borderTop: `3px solid ${C.primary}` }}>
          <div className="k-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Medal size={13} color={C.primary} /> Mejor cumplimiento</div>
          <div className="k-value" style={{ fontSize: 18 }}>{topCumpl?.agent.nombre || '—'}</div>
          <div className="k-sub">{fmtPct(topCumpl?.kpis.totales.cumplimiento || 0)} de su meta</div>
        </div>
        <div className="crm-kpi-box" style={{ borderTop: `3px solid ${C.green}` }}>
          <div className="k-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Shield size={13} color={C.green} /> Mejor conservación</div>
          <div className="k-value" style={{ fontSize: 18 }}>{topCons?.agent.nombre || '—'}</div>
          <div className="k-sub">{fmtPct(topCons?.kpis.conservacion.indiceProyectado || 0, 1)} proyectado</div>
        </div>
      </div>
      )}

      {/* ═══ Ranking + participación ═══ */}
      {!personal && (
      <div className="two-col">
        <div className="crm-chart-card" style={{ marginBottom: 0 }}>
          <h3>Ranking de asesores</h3>
          <p className="sub">Prima pagada {anio} vs meta anual</p>
          <ResponsiveContainer width="100%" height={Math.max(rank.length * 56, 160)}>
            <ComposedChart data={rank} layout="vertical" margin={{ top: 0, right: 70, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tickFormatter={fmtMoney} tick={{ fontSize: 10.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12, fill: C.text, fontWeight: 600 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="Meta" fill="rgba(193,151,91,.25)" radius={[0, 6, 6, 0]} barSize={10} />
              <Bar dataKey="Prima" fill={C.primary} radius={[0, 6, 6, 0]} barSize={16}>
                <LabelList dataKey="Prima" position="right" formatter={fmtMoney} style={{ fontSize: 11, fontWeight: 700, fill: C.primaryDark }} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="crm-chart-card" style={{ marginBottom: 0 }}>
          <h3>Participación en la producción</h3>
          <p className="sub">Aporte de cada asesor a la prima total ({fmtMoney(totalPrima)})</p>
          {share.length === 0 ? <p className="empty">Sin prima pagada aún</p> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={190} height={190}>
                <PieChart>
                  <Pie data={share} dataKey="value" innerRadius={55} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                    {share.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${fmtMoneyFull(v)} (${((v / totalPrima) * 100).toFixed(1)}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 150 }}>
                {share.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: C.textMuted }}>{d.name}</span>
                    <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{((d.value / totalPrima) * 100).toFixed(1)}%</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ═══ Matriz de calor ═══ */}
      <div className="crm-chart-card" style={{ marginTop: 20 }}>
        <h3>{personal ? 'Mi producción mes a mes' : 'Matriz de producción — asesor × mes'}</h3>
        <p className="sub">Intensidad = prima pagada del mes (estilo matrix de Power BI)</p>
        <HeatMatrix agentes={data.porAgente} />
      </div>

      {/* ═══ Cohortes de conservación ═══ */}
      <div className="crm-chart-card">
        <h3>Conservación por cohorte de emisión</h3>
        <p className="sub">Persistencia de las pólizas agrupadas por trimestre en que se emitieron — la métrica que mide Prudential a 13 y 25 meses</p>
        {!cohorts ? <div className="loading-wrap" style={{ minHeight: 80 }}><div className="spinner" /></div> :
          cohorts.length === 0 ? <p className="empty">Sin pólizas con fecha de emisión registrada</p> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Cohorte</th><th>Emitidas</th><th>Prima</th><th>Vigentes</th><th>Conservación</th><th>13 meses</th><th>25 meses</th></tr></thead>
                <tbody>
                  {cohorts.map(c => {
                    const pctColor = (p) => p == null ? C.textLight : p >= 0.94 ? C.green : p >= 0.86 ? C.amber : C.red;
                    return (
                      <tr key={c.cohorte}>
                        <td><b>{c.cohorte}</b></td>
                        <td>{c.emitidas}</td>
                        <td>{fmtMoney(c.prima)}</td>
                        <td>{c.vigentes} / {c.emitidas}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="crm-progress" style={{ flex: 1, maxWidth: 120 }}>
                              <div className="crm-progress-fill" style={{ width: `${c.pctVigente * 100}%`, background: pctColor(c.pctVigente) }} />
                            </div>
                            <b style={{ color: pctColor(c.pctVigente), fontSize: 12.5 }}>{fmtPct(c.pctVigente, 1)}</b>
                          </div>
                        </td>
                        <td><b style={{ color: pctColor(c.p13) }}>{c.p13 == null ? `— (${Math.max(13 - c.meses, 0)}m restantes)` : fmtPct(c.p13, 1)}</b></td>
                        <td><b style={{ color: pctColor(c.p25) }}>{c.p25 == null ? '—' : fmtPct(c.p25, 1)}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}

/* ── Modal de desglose de cada KPI del tablero: qué lo compone, con qué
   fórmula se calcula y quién aporta cada parte ── */
function KpiModal({ id, onClose, data, anio, pir, promoIdx, single, bonoTotal, clientesTotal, idxOficial }) {
  const g = data.global.kpis.totales;
  const months = data.global.kpis.months;

  const filaMes = (campo) => months
    .map((m, i) => ({ mes: MESES[i], v: m[campo] }))
    .filter(r => r.v > 0);

  const topAgentes = (getter, fmt = fmtMoneyFull) => data.porAgente
    .map(a => ({ n: a.agent.nombre, v: getter(a) }))
    .filter(x => x.v > 0)
    .sort((x, y) => y.v - x.v)
    .map(x => ({ ...x, txt: fmt(x.v) }));

  const CONTENIDO = {
    primaNueva: {
      titulo: `Prima nueva ${anio} — ${fmtMoneyFull(g.primaNueva)}`,
      que: 'Es la prima pagada INICIAL: lo que se cobró de pólizas de venta nueva. En los meses con corte del Business Review el dato es el oficial de Prudential (crm_pru_primas); en los demás, lo capturado en el CRM.',
      formula: 'Prima nueva = Σ prima pagada inicial de cada mes del año',
      meses: filaMes('primaNueva'),
      lista: { titulo: 'Aporte por asesor', rows: topAgentes(a => a.kpis.totales.primaNueva) },
    },
    primaRenovacion: {
      titulo: `Prima renovación ${anio} — ${fmtMoneyFull(g.primaRenovacion)}`,
      que: 'Es la prima pagada de RENOVACIÓN: cobros de pólizas que ya cumplieron uno o más años. Es la cartera que sostiene el índice de conservación.',
      formula: 'Prima renovación = Σ prima pagada de renovación de cada mes del año',
      meses: filaMes('primaRenovacion'),
      lista: { titulo: 'Aporte por asesor', rows: topAgentes(a => a.kpis.totales.primaRenovacion) },
    },
    meta: {
      titulo: `Cumplimiento de meta — ${fmtPct(g.cumplimiento)}`,
      que: `Compara peras con peras: la prima NUEVA cobrada por los ${g.agentesConMeta || 0} asesor(es) que SÍ tienen meta capturada (${fmtMoneyFull(g.primaNuevaConMeta ?? g.primaNueva)}) contra la suma de esas metas (${fmtMoneyFull(g.meta)}). Solo cuenta venta nueva: la renovación no abona a la meta. Ojo: los asesores sin meta capturada en Metas & Forecast NO cuentan aquí — captura sus metas para ver el cumplimiento real de toda la promotoría.`,
      formula: 'Cumplimiento = prima nueva (asesores con meta) ÷ suma de sus metas',
      lista: {
        titulo: 'Cumplimiento por asesor (con meta capturada)',
        rows: data.porAgente
          .filter(a => a.kpis.totales.meta > 0)
          .map(a => ({ n: a.agent.nombre, v: a.kpis.totales.cumplimiento || 0, txt: `${fmtPct(a.kpis.totales.cumplimiento)} de ${fmtMoney(a.kpis.totales.meta)}` }))
          .sort((x, y) => y.v - x.v),
      },
    },
    indice: {
      titulo: `Índice de conservación ${single ? '' : 'de la promotoría'} — hoy ${idxOficial ? fmtPct(idxOficial.hoy, 1) : '…'}`,
      que: single
        ? 'Mide cuánta de tu cartera en renovación sigue pagada. Sale del Business Review Prudential: base conservada ÷ base a conservar. Necesitas 86% mínimo para cobrar bonos.'
        : 'Mide cuánta de la cartera en renovación de TODA la promotoría sigue pagada, según el Business Review Prudential. La promotoría necesita 84% mínimo (cada agente, 86%).',
      formula: 'Índice = base conservada ÷ base a conservar (renovaciones dentro de la ventana de cálculo)',
      extra: promoIdx ? [
        ['Base a conservar', fmtMoneyFull(promoIdx.indice.baseAConservar)],
        ['Base conservada (al corte)', fmtMoneyFull(promoIdx.indice.baseConservada)],
        ['Pendiente de pago (al corte)', fmtMoneyFull(promoIdx.indice.basePendiente)],
        ['Índice al corte oficial', fmtPct(promoIdx.indice.actual, 2)],
        ['Índice hoy (vencimientos posteriores al corte)', fmtPct(promoIdx.indice.hoy.actual, 2)],
        ['Si se cobra todo lo pendiente', fmtPct(promoIdx.indice.siCobraTodo, 2)],
        ['Si además se rehabilitan las canceladas <6 meses', fmtPct(promoIdx.indice.siCobraYRehabilitaTodo, 2)],
        ['Pólizas en el índice', `${promoIdx.polizas.total} (${promoIdx.polizas.conservadas} conservadas · ${promoIdx.polizas.pendientes} por cobrar · ${promoIdx.polizas.noConservadas} canceladas, ${promoIdx.polizas.rehabilitables} rehabilitables)`],
      ] : null,
      nota: 'El índice está bajo porque hay muchas pólizas pendientes de cobro desde el corte — cada cobro lo sube. El detalle accionable (qué cobrar y qué rehabilitar, con simulador) está en la sección Ingresos.',
      lista: pir ? {
        titulo: 'Índice por asesor (al corte)',
        rows: pir.map(a => ({ n: a.nombre, v: a.indice.actual, txt: fmtPct(a.indice.actual, 1) })).sort((x, y) => y.v - x.v),
      } : null,
    },
    pipeline: {
      titulo: `Pipeline — ${fmtMoneyFull(g.pipeline)}`,
      que: 'Prima de pólizas VIVAS que aún no se cobran: en trámite (solicitudes en proceso) más pendientes de pago, ubicadas en el mes de su fecha de emisión o renovación. Es lo que puede convertirse en ingreso si se cierra y cobra.',
      formula: 'Pipeline = Σ prima de pólizas en trámite + pendientes de pago del año',
      meses: filaMes('pipeline'),
      lista: { titulo: 'Pipeline por asesor', rows: topAgentes(a => a.kpis.totales.pipeline) },
    },
    bonos: {
      titulo: `Bonos PIR del trimestre — ${bonoTotal === null ? '…' : fmtMoneyFull(bonoTotal)}`,
      que: 'Suma de los bonos PIR 2026 estimados por asesor según el Business Review: bono inicial mensual + ajuste trimestral + bono de conservación. Cada bono depende de la prima del periodo, del cuaderno del agente (Novel / En desarrollo / Consolidado) y de su banda de índice (86 / 90 / 94%).',
      formula: 'Bono del Q = Σ por asesor (mensuales + ajuste trimestral + conservación)',
      lista: pir ? { titulo: 'Bono por asesor', rows: pir.map(a => ({ n: a.nombre, v: a.bonos?.total_trimestre || 0, txt: fmtMoneyFull(a.bonos?.total_trimestre || 0) })).filter(x => x.v > 0).sort((x, y) => y.v - x.v) } : null,
      nota: 'Un asesor con índice debajo de 86% no cobra bonos aunque llegue a la prima — por eso la cobranza importa tanto como la venta.',
    },
    clientes: {
      titulo: `Clientes en cartera — ${clientesTotal}`,
      que: 'Clientes con nombre real registrados en el CRM (los trae el Reporte de pólizas de Prudential más los capturados a mano). Ya no se cuentan contenedores ni datos de ejemplo.',
      formula: 'Clientes = Σ clientes de cada asesor',
      lista: { titulo: 'Clientes por asesor', rows: topAgentes(a => a.clientes.total, (v) => `${v}`) },
    },
  };

  const c = CONTENIDO[id];
  if (!c) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{c.titulo}</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="info-box" style={{ marginBottom: 14 }}><p>{c.que}</p></div>
          <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 14px' }}>
            <b>Fórmula:</b> <span style={{ fontFamily: 'monospace' }}>{c.formula}</span>
          </p>

          {c.extra && (
            <div className="tbl-wrap" style={{ marginBottom: 14 }}>
              <table><tbody>
                {c.extra.map(([k, v]) => (
                  <tr key={k}><td style={{ color: C.textMuted }}>{k}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b>{v}</b></td></tr>
                ))}
              </tbody></table>
            </div>
          )}

          {c.meses && c.meses.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Por mes</h3>
              <div className="tbl-wrap" style={{ marginBottom: 14 }}>
                <table><tbody>
                  {c.meses.map(r => (
                    <tr key={r.mes}><td>{r.mes}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b>{fmtMoneyFull(r.v)}</b></td></tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {c.lista && c.lista.rows.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>{c.lista.titulo}</h3>
              <div className="tbl-wrap" style={{ marginBottom: 6 }}>
                <table><tbody>
                  {c.lista.rows.map(r => (
                    <tr key={r.n}><td>{r.n}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b>{r.txt}</b></td></tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          {c.nota && <p style={{ fontSize: 12.5, color: '#8A6A34', background: C.goldBg, borderRadius: 10, padding: '10px 14px' }}>💡 {c.nota}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CrmDashboardView({ isAgency }) {
  const [anio, setAnio] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null); // summary del asesor seleccionado
  const [tab, setTab] = useState('resumen'); // resumen | rendimiento (solo admins)
  const [pir, setPir] = useState(null);     // motor PIR: índice real + bonos (ingresos)
  const [promoIdx, setPromoIdx] = useState(null); // índice agregado de la promotoría
  const [kpiModal, setKpiModal] = useState(null); // tarjeta KPI abierta en modal de desglose
  const [ultimaImport, setUltimaImport] = useState(null); // última carga del Reporte de pólizas
  const [importando, setImportando] = useState(false);
  const [carteraKey, setCarteraKey] = useState(0); // fuerza recarga de la cartera tras importar
  const importRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.crmGetDashboard(anio);
      setData(d);
      /* El índice de conservación y los bonos REALES vienen del Business
         Review Prudential (motor PIR), no de las pólizas capturadas */
      api.crmIngresosOverview().then(r => setPir(r.agentes || [])).catch(() => {});
      if (d.porAgente.length > 1) api.crmIngresosPromotoria().then(setPromoIdx).catch(() => {});
      api.crmLastImport().then(r => setUltimaImport(r.ultima || null)).catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [anio]);

  useEffect(() => { load(); }, [load]);

  /* Carga diaria del Reporte de pólizas desde el propio tablero: un solo archivo
     actualiza cartera, índice (overlay vivo), pipeline, ingresos y Mi Día. */
  const onImportFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImportando(true);
    try {
      const { resumen } = await api.crmImportPolizas(f);
      alert(`Reporte cargado ✓\n${resumen.filas} filas · ${resumen.insertadas} nuevas · ${resumen.actualizadas} actualizadas · ${resumen.canceladas} canceladas · ${resumen.revividas} revividas · ${resumen.clientesNuevos} clientes nuevos\n\nTodas las secciones del CRM ya reflejan este corte.`);
      setCarteraKey(k => k + 1);
      load();
    } catch (err) { alert(err.message); }
    finally { setImportando(false); if (importRef.current) importRef.current.value = ''; }
  };

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando tableros...</p></div></>;
  if (error) return <><style>{getCrmCSS()}</style><div className="view"><div className="info-box"><p>⚠️ {error}</p></div></div></>;
  if (!data) return null;

  const single = data.porAgente.length === 1; // asesor viendo su propio tablero
  const g = data.global.kpis.totales;
  const bonoTotal = pir ? pir.reduce((s, a) => s + (a.bonos?.total_trimestre || 0), 0) : null;
  const clientesTotal = data.porAgente.reduce((s, a) => s + a.clientes.total, 0);
  /* Índice: el TITULAR es el estado de HOY (corte oficial + overlay del Reporte
     de pólizas diario — revividas/cobradas cuentan); el corte del Business
     Review queda como referencia. Promotoría umbral 84%, asesor 86%. */
  const idxOficial = single
    ? (pir && pir[0] ? { hoy: pir[0].indice.hoy?.actual ?? pir[0].indice.actual, corte: pir[0].indice.actual, todo: pir[0].indice.hoy?.conPendiente ?? pir[0].indice.conPendiente, umbral: 0.86 } : null)
    : (promoIdx ? { hoy: promoIdx.indice.hoy.actual, corte: promoIdx.indice.actual, todo: promoIdx.indice.siCobraTodo, umbral: 0.84 } : null);

  const globalChart = data.global.kpis.months.map((m, i) => ({
    mes: MESES[i],
    'Prima nueva': Math.round(m.primaNueva),
    'Renovación': Math.round(m.primaRenovacion),
    Meta: Math.round(m.meta),
    'Proyección': Math.round(data.global.forecast[i]?.proyeccion || 0),
  }));

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">{single ? 'Mi Tablero' : 'Tableros CRM'}</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {single ? `Business Review de ${data.porAgente[0].agent.nombre}` : 'Business Review — Incubadora S-COOL'}
            {ultimaImport && (
              <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                Reporte de pólizas: {new Date(ultimaImport.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {ultimaImport.usuario ? ` por ${ultimaImport.usuario}` : ''}
                {ultimaImport.resumen ? ` · ${ultimaImport.resumen.filas || 0} filas · ${ultimaImport.resumen.insertadas || 0} nuevas · ${ultimaImport.resumen.canceladas || 0} canceladas` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && (
            <>
              <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={onImportFile} />
              <button className="btn-primary" disabled={importando} onClick={() => importRef.current?.click()}
                title="Sube el Reporte de pólizas Prudential del día: actualiza cartera, índice, pipeline, ingresos y Mi Día sin duplicar">
                <Upload size={15} /> {importando ? 'Cargando...' : 'Cargar reporte del día'}
              </button>
            </>
          )}
          <select className="crm-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-secondary" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      {/* ── KPIs globales (clic en cada tarjeta → desglose de qué la compone) ── */}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('primaNueva')}>
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><TrendingUp size={20} /></div>
          <div><p className="stat-label">Prima nueva {anio}</p><p className="stat-value">{fmtMoney(g.primaNueva)}</p></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('primaRenovacion')}>
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><RefreshCw size={20} /></div>
          <div><p className="stat-label">Prima renovación {anio}</p><p className="stat-value">{fmtMoney(g.primaRenovacion)}</p></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('meta')}>
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Target size={20} /></div>
          <div><p className="stat-label">Cumplimiento meta</p><p className="stat-value">{fmtPct(g.cumplimiento)}</p></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('indice')}>
          <div className="stat-icon" style={{ background: C.greenBg, color: idxOficial && idxOficial.hoy >= idxOficial.umbral ? C.green : C.red }}><Shield size={20} /></div>
          <div>
            <p className="stat-label">Índice conservación {single ? '' : '(promotoría)'} · hoy</p>
            <p className="stat-value" style={{ color: idxOficial ? (idxOficial.hoy >= idxOficial.umbral ? C.green : C.red) : undefined }}>
              {idxOficial ? fmtPct(idxOficial.hoy, 1) : '…'}
            </p>
            {idxOficial && (
              <p style={{ fontSize: 10.5, color: C.textMuted, margin: '2px 0 0' }}>
                realista (si cobras pendientes) {fmtPct(idxOficial.todo, 1)} · corte BR {fmtPct(idxOficial.corte, 1)} · mín. {fmtPct(idxOficial.umbral, 0)}
              </p>
            )}
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('pipeline')}>
          <div className="stat-icon" style={{ background: '#EDE9FE', color: '#6D28D9' }}><Briefcase size={20} /></div>
          <div><p className="stat-label">Pipeline</p><p className="stat-value">{fmtMoney(g.pipeline)}</p></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('bonos')}>
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Award size={20} /></div>
          <div>
            <p className="stat-label">Bonos PIR del Q</p>
            <p className="stat-value">{bonoTotal === null ? '…' : fmtMoney(bonoTotal)}</p>
            <p style={{ fontSize: 10.5, color: C.textMuted, margin: '2px 0 0' }}>del Business Review Prudential</p>
          </div>
        </div>
        {!single && (
          <div className="stat-card" style={{ cursor: 'pointer' }} title="Ver desglose" onClick={() => setKpiModal('clientes')}>
            <div className="stat-icon" style={{ background: C.blueBg, color: C.accent }}><Users size={20} /></div>
            <div><p className="stat-label">Clientes en cartera</p><p className="stat-value">{clientesTotal}</p></div>
          </div>
        )}
      </div>

      {/* ── Modal de desglose del KPI seleccionado ── */}
      {kpiModal && (
        <KpiModal id={kpiModal} onClose={() => setKpiModal(null)}
          data={data} anio={anio} pir={pir} promoIdx={promoIdx} single={single}
          bonoTotal={bonoTotal} clientesTotal={clientesTotal} idxOficial={idxOficial} />
      )}

      {/* ── Cartera del Reporte de pólizas: segmentada por año + comparativo histórico ── */}
      <CrmCarteraSection key={carteraKey} titulo="Cartera Prudential — por año de emisión" />

      {/* ── Asesor: tabs Resumen | Mis Ventas. Admin: tabs Resumen | Rendimiento ── */}
      {single ? (
        <>
          <div className="crm-detail-tabs">
            <button className={`crm-dtab${tab === 'resumen' ? ' active' : ''}`} onClick={() => setTab('resumen')}>Resumen</button>
            <button className={`crm-dtab${tab === 'rendimiento' ? ' active' : ''}`} onClick={() => setTab('rendimiento')}>📊 Mis Ventas</button>
          </div>
          {tab === 'rendimiento'
            ? <PerformanceTab data={data} anio={anio} personal />
            : <AgentBoard summary={{ ...data.porAgente[0], anio }} />}
        </>
      ) : (
        <>
          <div className="crm-detail-tabs">
            <button className={`crm-dtab${tab === 'resumen' ? ' active' : ''}`} onClick={() => setTab('resumen')}>Resumen</button>
            <button className={`crm-dtab${tab === 'rendimiento' ? ' active' : ''}`} onClick={() => setTab('rendimiento')}>📊 Rendimiento</button>
          </div>

          {tab === 'rendimiento' && <PerformanceTab data={data} anio={anio} />}

          {tab === 'resumen' && (<>
          <div className="crm-chart-card">
            <h3>Producción de la promotoría {anio}</h3>
            <p className="sub">Prima pagada mensual (nueva + renovación) vs meta y proyección</p>
            <ProductionChart data={globalChart} />
          </div>

          <div className="section">
            <h2 className="section-title">Desempeño por asesor</h2>
            <p className="section-subtitle">Haz clic en un asesor para ver su tablero completo</p>

            {/* Desktop */}
            <div className="tbl-wrap desktop-only-table">
              <table>
                <thead>
                  <tr>
                    <th>Asesor</th><th>Cuaderno</th><th>Prima pagada</th><th>Meta</th>
                    <th>Cumplimiento</th><th>Pipeline</th><th>Conservación</th><th>Bono Q est.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porAgente.map(a => {
                    const cumpl = a.kpis.totales.cumplimiento || 0;
                    const ind = a.kpis.conservacion.indiceProyectado;
                    return (
                      <tr key={a.agent.id} className="crm-rank-row" onClick={() => setDrill(a)}>
                        <td><b>{a.agent.nombre}</b><br /><span style={{ fontSize: 11.5, color: C.textMuted }}>{a.agent.clave}</span></td>
                        <td><span className="badge" style={{ background: C.blueBg, color: C.primary }}>{a.agent.cuaderno}</span></td>
                        <td><b>{fmtMoney(a.kpis.totales.primaTotal)}</b></td>
                        <td>{fmtMoney(a.kpis.totales.meta)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="crm-progress" style={{ flex: 1 }}>
                              <div className="crm-progress-fill" style={{ width: `${Math.min(cumpl * 100, 100)}%`, background: cumpl >= 1 ? C.green : cumpl >= 0.7 ? C.amber : C.red }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 38 }}>{fmtPct(cumpl)}</span>
                          </div>
                        </td>
                        <td>{fmtMoney(a.kpis.totales.pipeline)}</td>
                        <td><b style={{ color: ind >= 0.94 ? C.green : ind >= 0.86 ? C.amber : C.red }}>{fmtPct(ind, 1)}</b></td>
                        <td><b style={{ color: C.green }}>{fmtMoney(a.bonos.bonoTrimestral.monto)}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
              {data.porAgente.map(a => {
                const cumpl = a.kpis.totales.cumplimiento || 0;
                const ind = a.kpis.conservacion.indiceProyectado;
                return (
                  <div key={a.agent.id} className="crm-mobile-card" onClick={() => setDrill(a)}>
                    <div className="crm-mc-top">
                      <div>
                        <div className="crm-mc-name">{a.agent.nombre}</div>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{a.agent.clave} · {a.agent.cuaderno}</span>
                      </div>
                      <span className="badge" style={{ background: C.greenBg, color: C.green }}>{fmtMoney(a.bonos.bonoTrimestral.monto)}</span>
                    </div>
                    <div className="crm-mc-row"><span>Prima pagada</span><b>{fmtMoney(a.kpis.totales.primaTotal)}</b></div>
                    <div className="crm-mc-row"><span>Meta / Cumplimiento</span><b>{fmtMoney(a.kpis.totales.meta)} · {fmtPct(cumpl)}</b></div>
                    <div className="crm-mc-row"><span>Conservación</span><b style={{ color: ind >= 0.94 ? C.green : ind >= 0.86 ? C.amber : C.red }}>{fmtPct(ind, 1)}</b></div>
                    <div className="crm-progress" style={{ marginTop: 8 }}>
                      <div className="crm-progress-fill" style={{ width: `${Math.min(cumpl * 100, 100)}%`, background: cumpl >= 1 ? C.green : cumpl >= 0.7 ? C.amber : C.red }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>)}
        </>
      )}

      {/* ── Próximos recordatorios ── */}
      <div className="section">
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={17} /> Próximos 7 días</h2>
        {data.proximosRecordatorios.length === 0 ? (
          <p className="empty">Sin recordatorios próximos</p>
        ) : (
          data.proximosRecordatorios.map(r => {
            const t = tipoRecordatorio(r.tipo);
            return (
              <div key={r.id} className="crm-rem-card">
                <div className="crm-rem-emoji" style={{ background: `${t.color}18` }}>{t.emoji}</div>
                <div className="crm-rem-body">
                  <p className="crm-rem-title">{r.titulo}</p>
                  {r.descripcion && <p className="crm-rem-desc">{r.descripcion}</p>}
                  <div className="crm-rem-meta">
                    <span className="badge" style={{ background: `${t.color}18`, color: t.color }}>{t.label}</span>
                    <span>{fmtDate(r.fecha)}{r.hora ? ` · ${String(r.hora).slice(0, 5)}` : ''}</span>
                    {r.crm_clients?.nombre && <span>· {r.crm_clients.nombre}</span>}
                    {!single && r.crm_agents?.nombre && <span>· 👤 {r.crm_agents.nombre}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Drill-down de asesor ── */}
      {drill && (
        <div className="modal-overlay" onClick={() => setDrill(null)}>
          <div className="modal crm-modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{drill.agent.nombre} <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>({drill.agent.clave} · {drill.agent.cuaderno})</span></h2>
              <button className="close-btn" onClick={() => setDrill(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <AgentBoard summary={{ ...drill, anio }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
