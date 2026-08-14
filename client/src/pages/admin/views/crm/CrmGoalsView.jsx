/**
 * CrmGoalsView — Metas & Forecast en dos versiones:
 *
 * PROMOTORÍA (admin): forecast vs metas + recomendaciones para alcanzarlas,
 * comparativo dinámico contra meses/trimestres/años anteriores (base del
 * Reporte de pólizas de carga diaria), rendimiento por asesor (meta vs real,
 * última venta, índice, cobranza y señales de qué está fallando) y mailing de
 * cobranza por asesor.
 *
 * ASESOR: su forecast y metas, su cartera comparada contra ejercicios
 * anteriores, su índice de conservación explicado (de qué se compone, qué le
 * afecta y cómo mejorarlo) y sus bonos con mensaje motivacional.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, AreaChart, Area, Line, ComposedChart,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { Save, RefreshCw, Mail, ShieldCheck, TrendingUp, AlertTriangle, HandCoins, Trophy } from 'lucide-react';
import { getCrmCSS, MESES, fmtMoney, fmtMoneyFull, fmtPct, fmtDate } from './crmShared';
import CrmCarteraSection from './CrmCarteraSection';

const ANIOS = [2023, 2024, 2025, 2026, 2027];
const pctTxt = (n, dec = 2) => `${((Number(n) || 0) * 100).toFixed(dec)}%`;

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, boxShadow: '0 6px 18px rgba(0,0,0,.1)' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px', color: C.text }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ margin: '2px 0', color: p.color }}>{p.name}: <b>{fmtMoneyFull(p.value)}</b></p>)}
    </div>
  );
}

const mesesSinVenta = (fecha) => {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(`${String(fecha).slice(0, 10)}T12:00:00`)) / (30.44 * 86400000));
};

export default function CrmGoalsView({ isAgency }) {
  const [anio, setAnio] = useState(2026);
  const [tab, setTab] = useState('forecast'); // forecast | rendimiento | comparativo
  const [dash, setDash] = useState(null);
  const [goals, setGoals] = useState({});
  const [changed, setChanged] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  /* Rendimiento por asesor (solo agencia) */
  const [consultores, setConsultores] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [promo, setPromo] = useState(null);
  const [ultimaCarga, setUltimaCarga] = useState(null);
  const [mailBusy, setMailBusy] = useState('');
  /* Asesor: índice explicado */
  const [miIngreso, setMiIngreso] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g] = await Promise.all([api.crmGetDashboard(anio), api.crmGetGoals(anio)]);
      setDash(d);
      const map = {};
      for (const goal of (g.goals || [])) map[`${goal.agent_id}-${goal.mes}`] = Number(goal.meta_prima) || 0;
      setGoals(map); setChanged({});
      if (isAgency) {
        api.crmConsultoresOverview().then(r => setConsultores(r.consultores || [])).catch(() => {});
        api.crmIngresosOverview().then(r => setIngresos(r.agentes || [])).catch(() => {});
        api.crmIngresosPromotoria().then(setPromo).catch(() => {});
        api.crmLastImport().then(r => setUltimaCarga(r.ultima)).catch(() => {});
      } else {
        // asesor: su clave Prudential → índice explicado
        api.crmGetAgents().then(async (r) => {
          const clave = r.agents?.[0]?.clave;
          if (clave) api.crmIngresosAgent(clave).then(setMiIngreso).catch(() => {});
        }).catch(() => {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [anio, isAgency]);
  useEffect(() => { load(); }, [load]);

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

  const enviarCobranza = async (clave, nombre) => {
    if (!window.confirm(clave
      ? `¿Enviar a ${nombre} su resumen de cobranza (cartera por cobrar + índice + impacto en bonos)?`
      : '¿Enviar el resumen de cobranza por correo a TODOS los asesores activos con pendientes?')) return;
    setMailBusy(clave || 'todos');
    try {
      const r = await api.crmCobranzaMailing(clave);
      setMsg(`📧 Cobranza enviada a: ${r.enviados.join(', ') || 'nadie (sin correo o sin pendientes)'}${r.fallidos.length ? ` · fallidos: ${r.fallidos.length}` : ''}`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) { alert(e.message); }
    finally { setMailBusy(''); }
  };

  if (loading || !dash) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando metas...</p></div></>;

  /* Forecast acumulado global */
  let accReal = 0, accMeta = 0, accProy = 0;
  const forecastData = dash.global.forecast.map((f, i) => {
    accReal += f.real; accMeta += f.meta; accProy += f.proyeccion;
    return { mes: MESES[i], 'Real acumulado': Math.round(accReal), 'Meta acumulada': Math.round(accMeta), 'Proyección acumulada': Math.round(accProy) };
  });
  const totProy = accProy, totMeta = accMeta, totReal = accReal;

  /* Recomendaciones (promotoría) */
  const recomendaciones = [];
  if (isAgency) {
    const mesActual = new Date().getFullYear() === anio ? new Date().getMonth() + 1 : 12;
    const mesesRestantes = Math.max(1, 12 - mesActual);
    if (totMeta > 0 && totProy < totMeta) {
      recomendaciones.push(`Con el ritmo actual la promotoría cierra en ${fmtMoney(totProy)} (${fmtPct(totProy / totMeta)} de la meta ${fmtMoney(totMeta)}). Para alcanzarla se necesita vender ${fmtMoney((totMeta - totProy) / mesesRestantes)} adicionales por mes los próximos ${mesesRestantes} meses.`);
    } else if (totMeta > 0) {
      recomendaciones.push(`La proyección (${fmtMoney(totProy)}) supera la meta anual (${fmtMoney(totMeta)}) — sostener el ritmo y blindar la cobranza para no perderlo por índice.`);
    }
    if (promo) {
      const pend = promo.accionables?.pendientesPago || [];
      if (pend.length) recomendaciones.push(`Cobranza: hay ${pend.length} pólizas por cobrar (${fmtMoney(pend.reduce((s, p) => s + p.monto, 0))} de base). Cobrarlas lleva el índice de la promotoría de ${pctTxt(promo.indice.hoy.actual)} a ${pctTxt(promo.indice.siCobraTodo)} (mínimo 84%).`);
      const urgentes = (promo.accionables?.rehabilitables || []).filter(p => p.dias_restantes <= 30);
      if (urgentes.length) recomendaciones.push(`⏳ ${urgentes.length} pólizas canceladas pierden la ventana de rehabilitación en 30 días o menos (${fmtMoney(urgentes.reduce((s, p) => s + p.monto, 0))} de base) — priorizarlas esta semana.`);
    }
    const rezagados = dash.porAgente
      .map(a => ({ n: a.agent.nombre, meta: a.kpis.totales.meta, cumpl: a.kpis.totales.cumplimiento }))
      .filter(a => a.meta > 0 && a.cumpl !== null && a.cumpl < 0.7)
      .sort((x, y) => x.cumpl - y.cumpl).slice(0, 3);
    if (rezagados.length) recomendaciones.push(`Asesores más lejos de su meta: ${rezagados.map(a => `${a.n} (${fmtPct(a.cumpl)})`).join(', ')} — revisar su pipeline y última venta en Rendimiento.`);
  }

  /* Merge rendimiento por asesor */
  const porClave = new Map(consultores.map(c => [c.clave, c]));
  const ingresoPorClave = new Map(ingresos.map(i => [i.clave, i]));
  const rendimiento = dash.porAgente.map(a => {
    const cons = porClave.get(a.agent.clave) || {};
    const ing = ingresoPorClave.get(a.agent.clave) || null;
    const meses = mesesSinVenta(cons.ultima_venta);
    const seniales = [];
    if (cons.activo_fsc === false) seniales.push('Sin actividad FSC');
    if (meses != null && meses >= 3) seniales.push(`Sin vender ${meses} meses`);
    if (ing && ing.indice && !ing.es_nuevo && ing.indice.actual < 0.86) seniales.push(`Índice ${pctTxt(ing.indice.actual, 1)} < 86%`);
    if (ing && ing.accionables?.pendientes > 0) seniales.push(`${ing.accionables.pendientes} por cobrar`);
    if (!(a.kpis.totales.meta > 0)) seniales.push('Sin metas capturadas');
    return { a, cons, ing, meses, seniales };
  });

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Metas & Forecast</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {isAgency ? 'Planeación de la promotoría' : 'Tu plan y tu avance'} — {anio}
            {ultimaCarga && <span style={{ display: 'block', fontSize: 11.5, color: C.textMuted }}>Base de pólizas actualizada: {new Date(ultimaCarga.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{ultimaCarga.usuario ? ` por ${ultimaCarga.usuario}` : ''}</span>}
          </p>
        </div>
        <div className="crm-toolbar-right">
          <select className="crm-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
          {isAgency && tab === 'forecast' && (
            <button className="btn-primary" disabled={saving || !Object.keys(changed).length} onClick={saveGoals} style={{ opacity: Object.keys(changed).length ? 1 : 0.5 }}>
              <Save size={15} /> {saving ? 'Guardando...' : `Guardar (${Object.keys(changed).length})`}
            </button>
          )}
        </div>
      </div>

      {msg && <div className="info-box" style={{ marginBottom: 16 }}><p>{msg}</p></div>}

      {isAgency && (
        <div className="crm-detail-tabs">
          <button className={`crm-dtab${tab === 'forecast' ? ' active' : ''}`} onClick={() => setTab('forecast')}>Forecast & metas</button>
          <button className={`crm-dtab${tab === 'rendimiento' ? ' active' : ''}`} onClick={() => setTab('rendimiento')}>Rendimiento por asesor</button>
          <button className={`crm-dtab${tab === 'comparativo' ? ' active' : ''}`} onClick={() => setTab('comparativo')}>Comparativo histórico</button>
        </div>
      )}

      {/* ═════════ TAB COMPARATIVO (promotoría) ═════════ */}
      {isAgency && tab === 'comparativo' && <CrmCarteraSection titulo="Cartera de la promotoría — por año de emisión" />}

      {/* ═════════ TAB RENDIMIENTO POR ASESOR ═════════ */}
      {isAgency && tab === 'rendimiento' && (
        <>
          <div className="crm-chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3>Rendimiento y cobranza por asesor</h3>
                <p className="sub" style={{ marginBottom: 0 }}>Meta vs real ({anio}), última venta, índice, cartera por cobrar y señales — contra la base de pólizas de carga diaria.</p>
              </div>
              <button className="btn-primary" disabled={!!mailBusy} onClick={() => enviarCobranza(null)}>
                <Mail size={15} /> {mailBusy === 'todos' ? 'Enviando...' : 'Enviar cobranza a todos'}
              </button>
            </div>
          </div>
          <div className="tbl-wrap desktop-only-table">
            <table>
              <thead>
                <tr><th>Asesor</th><th>Meta {anio}</th><th>Real</th><th>Cumplimiento</th><th>Última venta</th><th>Índice PIR</th><th>Por cobrar</th><th>Señales</th><th></th></tr>
              </thead>
              <tbody>
                {rendimiento.map(({ a, cons, ing, seniales }) => (
                  <tr key={a.agent.id}>
                    <td><b>{a.agent.nombre}</b><br /><span style={{ fontSize: 11, color: C.textMuted }}>{a.agent.clave || '—'}</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{a.kpis.totales.meta > 0 ? fmtMoney(a.kpis.totales.meta) : '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.kpis.totales.primaNueva + a.kpis.totales.primaRenovacion)}<br /><span style={{ fontSize: 10.5, color: C.textMuted }}>nueva {fmtMoney(a.kpis.totales.primaNueva)}</span></td>
                    <td style={{ minWidth: 110 }}>
                      {a.kpis.totales.cumplimiento === null ? '—' : (
                        <>
                          <div className="crm-progress"><div className="crm-progress-fill" style={{ width: `${Math.min(100, a.kpis.totales.cumplimiento * 100)}%`, background: a.kpis.totales.cumplimiento >= 1 ? C.green : a.kpis.totales.cumplimiento >= 0.7 ? C.amber : C.red }} /></div>
                          <span style={{ fontSize: 11.5 }}>{fmtPct(a.kpis.totales.cumplimiento)}</span>
                        </>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5 }}>{cons.ultima_venta ? fmtDate(cons.ultima_venta) : '—'}</td>
                    <td>{ing ? <b style={{ color: ing.indice.actual >= 0.86 ? C.green : C.red }}>{pctTxt(ing.indice.actual)}</b> : '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{ing ? `${ing.accionables.pendientes} pólizas` : '—'}</td>
                    <td style={{ fontSize: 11.5 }}>
                      {seniales.length === 0
                        ? <span className="badge" style={{ background: C.greenBg, color: C.green }}>✓ En orden</span>
                        : seniales.map(s => <span key={s} className="badge" style={{ background: C.amberBg, color: '#8A6A34', marginRight: 4, marginBottom: 3, display: 'inline-block' }}>{s}</span>)}
                    </td>
                    <td>
                      {a.agent.clave && (
                        <button className="crm-icon-btn" title="Enviarle su resumen de cobranza" disabled={!!mailBusy}
                          onClick={() => enviarCobranza(a.agent.clave, a.agent.nombre)}>
                          <Mail size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═════════ TAB FORECAST & METAS (promotoría) / vista asesor ═════════ */}
      {(!isAgency || tab === 'forecast') && (
        <>
          {totMeta === 0 && (
            <div className="info-box" style={{ marginBottom: 16, background: C.goldBg, borderColor: `${C.gold}50`, color: '#8A6A34' }}>
              <p>🎯 {isAgency
                ? `Aún no hay metas capturadas para ${anio}. Edita el grid de abajo (o usa "⚡ Meta anual") para activar el forecast y el cumplimiento.`
                : `Tu administrador aún no captura tus metas de ${anio}. En cuanto las registre, aquí verás tu forecast y tu avance de cumplimiento.`}</p>
            </div>
          )}

          {/* Recomendaciones para alcanzar las metas */}
          {isAgency && recomendaciones.length > 0 && (
            <div className="crm-chart-card">
              <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.gold }} /> Recomendaciones para alcanzar las metas</h3>
              {recomendaciones.map((r, i) => (
                <div key={i} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '8px 0', display: 'block' }}>
                  <span style={{ fontSize: 13 }}>{i + 1}. {r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Forecast global */}
          <div className="crm-chart-card">
            <h3>Forecast anual acumulado</h3>
            <p className="sub">
              Proyección de cierre: <b style={{ color: C.green }}>{fmtMoney(totProy)}</b>
              {totMeta > 0 && <> vs meta {fmtMoney(totMeta)} (<b style={{ color: totProy >= totMeta ? C.green : C.amber }}>{fmtPct(totProy / totMeta)}</b>)</>}
              {' '}· real a la fecha {fmtMoney(totReal)} — real + pipeline programado + run-rate de los últimos 3 meses
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

          {/* ── ASESOR: su cartera comparada + índice explicado + bonos ── */}
          {!isAgency && (
            <>
              <CrmCarteraSection titulo="Tu cartera — por año de emisión" />

              {miIngreso && (
                <div className="crm-chart-card">
                  <h3><ShieldCheck size={16} style={{ verticalAlign: -2, color: C.gold }} /> Tu índice de conservación, explicado</h3>
                  <p className="sub">
                    Tu índice = base conservada ÷ base a conservar. Hoy: <b style={{ color: miIngreso.indice.actual >= 0.86 ? C.green : C.red }}>{pctTxt(miIngreso.indice.hoy?.actual ?? miIngreso.indice.actual)}</b> — necesitas <b>86%</b> para cobrar bonos.
                  </p>
                  <div className="crm-kpi-detail">
                    <div className="crm-kpi-box"><div className="k-label">De qué se compone</div><div className="k-value" style={{ fontSize: 15 }}>{fmtMoney(miIngreso.indice.baseConservada)} / {fmtMoney(miIngreso.indice.baseAConservar)}</div><div className="k-sub">base conservada ÷ base a conservar (renovaciones de tu cartera en la ventana)</div></div>
                    <div className="crm-kpi-box"><div className="k-label">Qué te está afectando</div><div className="k-value" style={{ fontSize: 15, color: C.amber }}>{fmtMoney(miIngreso.indice.basePendiente)}</div><div className="k-sub">{miIngreso.accionables.pendientesPago.length} pólizas vencidas sin cobrar — cada una resta directo al índice</div></div>
                    <div className="crm-kpi-box"><div className="k-label">Cómo mejorarlo</div><div className="k-value" style={{ fontSize: 15, color: C.green }}>{pctTxt(miIngreso.indice.conPendiente)}</div><div className="k-sub">a esto sube si cobras todo lo pendiente · además tienes {miIngreso.accionables.rehabilitables.length} canceladas aún rehabilitables (&lt;6 meses)</div></div>
                    <div className="crm-kpi-box"><div className="k-label">Meta plausible del trimestre</div><div className="k-value" style={{ fontSize: 15 }}>{miIngreso.indice.actual < 0.86 ? `Cruzar el 86%` : miIngreso.indice.actual < 0.90 ? 'Cruzar el 90%' : 'Sostener 94%'}</div><div className="k-sub">{miIngreso.indice.actual < 0.86 ? `te faltan ≈ ${fmtMoney(Math.max(0, 0.86 * miIngreso.indice.baseAConservar - miIngreso.indice.baseConservada))} de base conservada` : 'cada banda sube el % de todos tus bonos'}</div></div>
                  </div>
                  {miIngreso.accionables.pendientesPago.slice(0, 5).map(p => (
                    <div key={p.id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '6px 0' }}>
                      <span>Póliza <b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id} · vencida desde {fmtDate(p.pagado_hasta)}</span></span>
                      <b>{fmtMoney(p.monto)} <span style={{ color: C.green, fontSize: 11 }}>+{pctTxt(p.impacto_indice)}</span></b>
                    </div>
                  ))}
                  <p className="sub" style={{ marginTop: 8 }}>El detalle completo (simulador, trayectoria y registro de cobros) está en <b>Ingresos</b>.</p>
                </div>
              )}

              {miIngreso && (
                <div className="crm-chart-card" style={{ borderTop: `3px solid ${C.gold}` }}>
                  <h3><Trophy size={16} style={{ verticalAlign: -2, color: C.gold }} /> Tus bonos y premios</h3>
                  <div className="crm-kpi-detail">
                    <div className="crm-kpi-box"><div className="k-label"><HandCoins size={12} style={{ verticalAlign: -2 }} /> Bonos del trimestre</div><div className="k-value" style={{ color: C.green }}>{fmtMoneyFull(miIngreso.bonos.total_trimestre)}</div><div className="k-sub">mensuales + ajuste trimestral + conservación</div></div>
                    {(() => {
                      const sig = (miIngreso.enJuego?.trimestral || []).find(r => !r.alcanzado && r.faltante > 0);
                      return sig ? (
                        <div className="crm-kpi-box"><div className="k-label">Siguiente rango en juego</div><div className="k-value" style={{ fontSize: 15 }}>{fmtMoney(sig.faltante)}</div><div className="k-sub">de prima te separan del rango {sig.rango} — hasta {fmtMoney(sig.bonos['0.94'])} de bono</div></div>
                      ) : null;
                    })()}
                  </div>
                  <div className="info-box" style={{ background: C.goldBg, borderColor: `${C.gold}50`, color: '#8A6A34' }}>
                    <p>🏆 <b>Cada punto de índice y cada cobro te acercan a la Convención y a los viajes de Prudential.</b> Tu cartera bien cobrada no solo paga bonos: te sube al escenario. ¡Vamos por ese viaje! ✈️</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Grid de metas por agente */}
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

          {/* Forecast por asesor */}
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
        </>
      )}
    </div>
  );
}
