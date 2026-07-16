/**
 * CrmDashboardView — Tableros interactivos del CRM (Business Review)
 * Admin/agencia: ranking de asesores + KPIs de la promotoría + drill-down.
 * Asesor: su propio tablero (RESUMEN ANUAL) con bonos y conservación.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Target, Shield, Award, Users, RefreshCw, X, Briefcase, Bell, FileDown } from 'lucide-react';
import { getCrmCSS, MESES, fmtMoney, fmtMoneyFull, fmtPct, fmtDate, etapaInfo, ETAPAS, tipoRecordatorio } from './crmShared';

const ANIOS = [2025, 2026, 2027];

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
          <div className="k-sub">{clientes.funnel.cliente || 0} activos · {clientes.funnel.prospecto || 0} prospectos</div>
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

export default function CrmDashboardView() {
  const [anio, setAnio] = useState(2026);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null); // summary del asesor seleccionado

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.crmGetDashboard(anio)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [anio]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando tableros...</p></div></>;
  if (error) return <><style>{getCrmCSS()}</style><div className="view"><div className="info-box"><p>⚠️ {error}</p></div></div></>;
  if (!data) return null;

  const single = data.porAgente.length === 1; // asesor viendo su propio tablero
  const g = data.global.kpis.totales;
  const gc = data.global.kpis.conservacion;
  const bonoTotal = data.porAgente.reduce((s, a) => s + a.bonos.bonoTrimestral.monto, 0);
  const clientesTotal = data.porAgente.reduce((s, a) => s + a.clientes.total, 0);

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
          </p>
        </div>
        <div className="crm-toolbar-right">
          <select className="crm-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-secondary" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      {/* ── KPIs globales ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><TrendingUp size={20} /></div>
          <div><p className="stat-label">Prima pagada {anio}</p><p className="stat-value">{fmtMoney(g.primaTotal)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Target size={20} /></div>
          <div><p className="stat-label">Cumplimiento meta</p><p className="stat-value">{fmtPct(g.cumplimiento)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Shield size={20} /></div>
          <div><p className="stat-label">Índice conservación</p><p className="stat-value">{fmtPct(gc.indiceProyectado, 1)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EDE9FE', color: '#6D28D9' }}><Briefcase size={20} /></div>
          <div><p className="stat-label">Pipeline</p><p className="stat-value">{fmtMoney(g.pipeline)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><Award size={20} /></div>
          <div><p className="stat-label">Bonos estimados Q</p><p className="stat-value">{fmtMoney(bonoTotal)}</p></div>
        </div>
        {!single && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: C.blueBg, color: C.accent }}><Users size={20} /></div>
            <div><p className="stat-label">Clientes en cartera</p><p className="stat-value">{clientesTotal}</p></div>
          </div>
        )}
      </div>

      {/* ── Asesor: tablero directo. Admin: chart global + ranking ── */}
      {single ? (
        <AgentBoard summary={{ ...data.porAgente[0], anio }} />
      ) : (
        <>
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
