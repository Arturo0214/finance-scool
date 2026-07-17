/**
 * CrmGoalsView — Metas por agente y Forecast
 * Admin: grid editable de metas mensuales (hoja "METAS POR AGENTE").
 * Todos: forecast acumulado real vs meta vs proyección.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, AreaChart, Area, Line, ComposedChart,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { Save, RefreshCw } from 'lucide-react';
import { getCrmCSS, MESES, fmtMoney, fmtMoneyFull, fmtPct } from './crmShared';

const ANIOS = [2025, 2026, 2027];

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, boxShadow: '0 6px 18px rgba(0,0,0,.1)' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px', color: C.text }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ margin: '2px 0', color: p.color }}>{p.name}: <b>{fmtMoneyFull(p.value)}</b></p>)}
    </div>
  );
}

export default function CrmGoalsView({ isAgency }) {
  const [anio, setAnio] = useState(2026);
  const [dash, setDash] = useState(null);
  const [goals, setGoals] = useState({});      // key `${agentId}-${mes}` → value
  const [changed, setChanged] = useState({});  // celdas editadas sin guardar
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g] = await Promise.all([api.crmGetDashboard(anio), api.crmGetGoals(anio)]);
      setDash(d);
      const map = {};
      for (const goal of (g.goals || [])) map[`${goal.agent_id}-${goal.mes}`] = Number(goal.meta_prima) || 0;
      setGoals(map); setChanged({});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [anio]);
  useEffect(() => { load(); }, [load]);

  // Rellena los 12 meses de un asesor con la misma meta (edición rápida)
  const fillYear = (agentId, nombre) => {
    const v = window.prompt(`Meta mensual para ${nombre} (se aplica a los 12 meses de ${anio}):`, '');
    if (v === null || v === '' || isNaN(Number(v))) return;
    const patch = {};
    for (let m = 1; m <= 12; m++) patch[`${agentId}-${m}`] = Number(v);
    setChanged(c => ({ ...c, ...patch }));
  };

  const saveGoals = async () => {
    const entries = Object.entries(changed);
    if (!entries.length) return;
    setSaving(true);
    try {
      const payload = entries.map(([key, val]) => {
        const [agent_id, mes] = key.split('-');
        return { agent_id: Number(agent_id), anio, mes: Number(mes), meta_prima: Number(val) || 0 };
      });
      await api.crmSaveGoals(payload);
      setMsg(`✓ ${payload.length} metas guardadas`); setTimeout(() => setMsg(''), 2500);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading || !dash) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando metas...</p></div></>;

  /* Forecast acumulado global */
  let accReal = 0, accMeta = 0, accProy = 0;
  const forecastData = dash.global.forecast.map((f, i) => {
    accReal += f.real; accMeta += f.meta; accProy += f.proyeccion;
    return { mes: MESES[i], 'Real acumulado': Math.round(accReal), 'Meta acumulada': Math.round(accMeta), 'Proyección acumulada': Math.round(accProy) };
  });

  const totProy = accProy, totMeta = accMeta;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Metas & Forecast</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>Planeación anual de prima pagada — {anio}</p>
        </div>
        <div className="crm-toolbar-right">
          <select className="crm-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
          {isAgency && (
            <button className="btn-primary" disabled={saving || !Object.keys(changed).length} onClick={saveGoals} style={{ opacity: Object.keys(changed).length ? 1 : 0.5 }}>
              <Save size={15} /> {saving ? 'Guardando...' : `Guardar (${Object.keys(changed).length})`}
            </button>
          )}
        </div>
      </div>

      {msg && <div className="info-box" style={{ marginBottom: 16 }}><p>{msg}</p></div>}

      {totMeta === 0 && (
        <div className="info-box" style={{ marginBottom: 16, background: C.goldBg, borderColor: `${C.gold}50`, color: '#8A6A34' }}>
          <p>🎯 {isAgency
            ? `Aún no hay metas capturadas para ${anio}. Edita el grid de abajo (o usa "⚡ Meta anual") para activar el forecast y el cumplimiento.`
            : `Tu administrador aún no captura tus metas de ${anio}. En cuanto las registre, aquí verás tu forecast y tu avance de cumplimiento.`}</p>
        </div>
      )}

      {/* ── Forecast global ── */}
      <div className="crm-chart-card">
        <h3>Forecast anual acumulado</h3>
        <p className="sub">
          Proyección de cierre: <b style={{ color: C.green }}>{fmtMoney(totProy)}</b>
          {totMeta > 0 && <> vs meta {fmtMoney(totMeta)} (<b style={{ color: totProy >= totMeta ? C.green : C.amber }}>{fmtPct(totProy / totMeta)}</b>)</>}
          {' '}— real + pipeline programado + run-rate de los últimos 3 meses
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={forecastData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={62} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Real acumulado" stroke={C.primary} strokeWidth={2.5} fill="url(#gradReal)" />
            <Line type="monotone" dataKey="Proyección acumulada" stroke={C.green} strokeWidth={2.5} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="Meta acumulada" stroke={C.amber} strokeWidth={2} strokeDasharray="7 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Grid de metas por agente ── */}
      <div className="section">
        <h2 className="section-title">Metas mensuales por asesor {isAgency ? '(editable)' : ''}</h2>
        <p className="section-subtitle">Prima inicial pagada objetivo — igual que la hoja "METAS POR AGENTE" del Business Review</p>
        <div className="tbl-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: C.bg, zIndex: 1 }}>Asesor</th>
                {MESES.map(m => <th key={m} style={{ textAlign: 'right' }}>{m}</th>)}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {dash.porAgente.map(a => {
                const total = Array.from({ length: 12 }, (_, i) => {
                  const key = `${a.agent.id}-${i + 1}`;
                  return Number(key in changed ? changed[key] : goals[key]) || 0;
                }).reduce((s, v) => s + v, 0);
                return (
                  <tr key={a.agent.id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                      <b>{a.agent.nombre}</b><br /><span style={{ fontSize: 11, color: C.textMuted }}>{a.agent.clave}</span>
                      {isAgency && (
                        <button className="crm-icon-btn" title="Aplicar una meta a los 12 meses" onClick={() => fillYear(a.agent.id, a.agent.nombre)}
                          style={{ width: 'auto', height: 24, padding: '0 8px', fontSize: 10.5, fontWeight: 700, marginTop: 5, display: 'inline-flex', gap: 4 }}>
                          ⚡ Meta anual
                        </button>
                      )}
                    </td>
                    {MESES.map((_, i) => {
                      const key = `${a.agent.id}-${i + 1}`;
                      const val = key in changed ? changed[key] : (goals[key] ?? '');
                      const real = a.kpis.months[i].primaNueva + a.kpis.months[i].primaRenovacion;
                      return (
                        <td key={key} style={{ padding: '6px 6px' }}>
                          {isAgency ? (
                            <>
                              <input
                                className={`crm-goal-input${key in changed ? ' changed' : ''}`}
                                type="number"
                                value={val}
                                placeholder="0"
                                onChange={e => setChanged({ ...changed, [key]: e.target.value })}
                              />
                              <div style={{ fontSize: 10, color: real > 0 ? C.green : C.textLight, textAlign: 'right', marginTop: 2 }}>
                                {real > 0 ? `real ${fmtMoney(real)}` : '—'}
                              </div>
                            </>
                          ) : (
                            <div style={{ textAlign: 'right' }}>
                              <b>{val ? fmtMoney(val) : '—'}</b>
                              <div style={{ fontSize: 10, color: real > 0 ? C.green : C.textLight }}>{real > 0 ? `real ${fmtMoney(real)}` : ''}</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right' }}><b>{fmtMoney(total)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Forecast por asesor ── */}
      <div className="two-col">
        {dash.porAgente.map(a => {
          let acc = 0, accM = 0;
          const data = a.forecast.map((f, i) => {
            acc += f.proyeccion; accM += f.meta;
            return { mes: MESES[i], 'Proyección': Math.round(acc), Meta: Math.round(accM) };
          });
          const cierre = acc;
          return (
            <div key={a.agent.id} className="crm-chart-card" style={{ marginBottom: 0 }}>
              <h3>{a.agent.nombre}</h3>
              <p className="sub">Cierre proyectado: <b style={{ color: C.green }}>{fmtMoney(cierre)}</b>{accM > 0 && ` · meta ${fmtMoney(accM)}`}</p>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area type="monotone" dataKey="Proyección" stroke={C.green} strokeWidth={2} fill={`${C.green}22`} />
                  <Area type="monotone" dataKey="Meta" stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
