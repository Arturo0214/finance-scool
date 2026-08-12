/**
 * CrmIngresosView — Tablero de Ingresos PIR Prudential
 * Índice de conservación + bonos (mensual / trimestral / conservación) +
 * simulador de proyección + accionables (pendientes de pago y rehabilitables).
 * La pestaña Conciliación reusa la vista de comisiones existente.
 *
 * Data: Business Review migrado a crm_pru_* (endpoints /api/crm/ingresos/*).
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  RefreshCw, TrendingUp, ShieldCheck, AlertTriangle, Sparkles,
  HandCoins, Target, RotateCcw, Calculator, Scale,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, fmtMoneyFull, fmtDate, MESES } from './crmShared';
import CrmCommissionsView from './CrmCommissionsView';

const pct = (n, dec = 2) => `${((Number(n) || 0) * 100).toFixed(dec)}%`;

/* Semáforo del índice contra los umbrales PIR */
const indiceColor = (i) => (i >= 0.94 ? C.green : i >= 0.90 ? '#0891B2' : i >= 0.86 ? C.amber : C.red);

const UMBRAL_LABEL = { '0.86': 'Banda 86%', '0.90': 'Banda 90%', '0.94': 'Banda 94%' };

/* Barra del índice con las marcas 86 / 90 / 94 */
function IndiceBar({ actual, operativo }) {
  const marks = [0.86, 0.90, 0.94];
  return (
    <div style={{ position: 'relative', height: 14, background: 'rgba(11,27,51,.07)', borderRadius: 8, overflow: 'hidden', margin: '10px 0 18px' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, operativo * 100)}%`, background: `${indiceColor(operativo)}55`, transition: 'width .5s' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, actual * 100)}%`, background: indiceColor(actual), transition: 'width .5s' }} />
      {marks.map(m => (
        <div key={m} style={{ position: 'absolute', left: `${m * 100}%`, top: 0, bottom: 0, width: 2, background: C.ink, opacity: 0.55 }}
          title={`Umbral ${pct(m, 0)}`} />
      ))}
    </div>
  );
}

function BonoCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="crm-kpi-box">
      <div className="k-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} color={color || C.gold} /> {label}</div>
      <div className="k-value">{value}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

export default function CrmIngresosView({ isAgency }) {
  const [tab, setTab] = useState('tablero');
  const [overview, setOverview] = useState([]);
  const [selClave, setSelClave] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState('');

  /* Simulador */
  const [ventaAdicional, setVentaAdicional] = useState('');
  const [simSel, setSimSel] = useState({});   // poliza_id → 'cobrar' | 'rehabilitar'
  const [sim, setSim] = useState(null);
  const [simBusy, setSimBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api.crmIngresosOverview();
      const rows = d.agentes || [];
      setOverview(rows);
      // Asesor: solo viene su clave → entrar directo al detalle
      if (rows.length === 1) setSelClave(rows[0].clave);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selClave) { setDetail(null); return; }
    let alive = true;
    (async () => {
      setLoadingDetail(true); setSim(null); setSimSel({}); setVentaAdicional('');
      try {
        const d = await api.crmIngresosAgent(selClave);
        if (alive) setDetail(d);
      } catch (e) { if (alive) setErr(e.message); }
      finally { if (alive) setLoadingDetail(false); }
    })();
    return () => { alive = false; };
  }, [selClave]);

  const runSim = async () => {
    if (!detail) return;
    setSimBusy(true);
    try {
      const cobrar = Object.entries(simSel).filter(([, v]) => v === 'cobrar').map(([k]) => Number(k));
      const rehab = Object.entries(simSel).filter(([, v]) => v === 'rehabilitar').map(([k]) => Number(k));
      const d = await api.crmIngresosSimulate({
        clave: detail.agente.clave,
        ventaAdicional: Number(ventaAdicional) || 0,
        cobrarPolizas: cobrar,
        rehabilitarPolizas: rehab,
      });
      setSim(d);
    } catch (e) { alert(e.message); }
    finally { setSimBusy(false); }
  };

  /* Cobro/rehabilitación real (solo agencia): mueve el índice "hoy" al instante */
  const registrar = async (p, accion) => {
    const txt = accion === 'pago'
      ? `¿Registrar el cobro de la póliza ${p.poliza}? Su "pagada hasta" avanza un periodo (${p.frecuencia_pago || 'ANUAL'}).`
      : `¿Marcar la póliza ${p.poliza} como rehabilitada? Vuelve a Vigente y su "pagada hasta" avanza un periodo.`;
    if (!window.confirm(txt)) return;
    try {
      await api.crmIngresosPoliza(p.id, accion);
      const d = await api.crmIngresosAgent(selClave);
      setDetail(d);
    } catch (e) { alert(e.message); }
  };

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando ingresos...</p></div></>;

  const b = detail?.bonos;
  const idx = detail?.indice;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Ingresos</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            Índice de conservación, bonos PIR {detail?.periodo ? `· ${detail.periodo.trimestre}Q ${detail.periodo.anio}` : ''} y proyección
          </p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && overview.length > 1 && (
            <select className="crm-select" value={selClave} onChange={e => setSelClave(e.target.value)}>
              <option value="">— Vista promotoría —</option>
              {overview.map(a => <option key={a.clave} value={a.clave}>{a.nombre} ({a.clave})</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
        </div>
      </div>

      {err && <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}><p>{err}</p></div>}

      <div className="crm-detail-tabs">
        <button className={`crm-dtab${tab === 'tablero' ? ' active' : ''}`} onClick={() => setTab('tablero')}>Tablero PIR</button>
        <button className={`crm-dtab${tab === 'simulador' ? ' active' : ''}`} onClick={() => setTab('simulador')} disabled={!detail}>Simulador</button>
        <button className={`crm-dtab${tab === 'conciliacion' ? ' active' : ''}`} onClick={() => setTab('conciliacion')}>Comisiones CRM</button>
      </div>

      {/* ═══════════ TAB CONCILIACIÓN (vista de comisiones existente) ═══════════ */}
      {tab === 'conciliacion' && <CrmCommissionsView isAgency={isAgency} />}

      {/* ═══════════ TAB TABLERO ═══════════ */}
      {tab === 'tablero' && !selClave && isAgency && (
        <div className="tbl-wrap desktop-only-table" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr><th>Agente</th><th>Cuaderno</th><th>Índice al corte</th><th>+ Pend. de pago</th><th>Índice hoy</th><th>Prima ubicación Q</th><th>Bonos del Q</th><th>Accionables</th></tr>
            </thead>
            <tbody>
              {overview.length === 0 && <tr><td colSpan={8} className="empty">Sin data Prudential migrada</td></tr>}
              {overview.map(a => (
                <tr key={a.clave} className="crm-rank-row" onClick={() => setSelClave(a.clave)}>
                  <td><b>{a.nombre}</b><br /><span style={{ fontSize: 11, color: C.textMuted }}>{a.clave} · mes {a.mes_agente}</span></td>
                  <td><span className="badge" style={{ background: C.blueBg, color: C.primary }}>{a.cuaderno || '—'}</span>{a.es_nuevo && <span className="badge" style={{ background: C.goldBg, color: '#8A6A34', marginLeft: 4 }}>Nuevo</span>}</td>
                  <td><b style={{ color: indiceColor(a.indice.actual) }}>{pct(a.indice.actual)}</b></td>
                  <td style={{ color: indiceColor(a.indice.conPendiente) }}>{pct(a.indice.conPendiente)}</td>
                  <td>{a.indice.hoy ? <b style={{ color: indiceColor(a.indice.hoy.actual) }}>{pct(a.indice.hoy.actual)}</b> : '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.primas.ubicacionQ)}</td>
                  <td><b style={{ color: a.bonos.total_trimestre > 0 ? C.green : C.textLight }}>{fmtMoneyFull(a.bonos.total_trimestre)}</b></td>
                  <td style={{ fontSize: 12 }}>{a.accionables.pendientes} por cobrar · {a.accionables.rehabilitables} rehabilitables</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tablero' && !selClave && isAgency && (
        <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
          {overview.map(a => (
            <div key={a.clave} className="crm-mobile-card" onClick={() => setSelClave(a.clave)}>
              <div className="crm-mc-top"><div className="crm-mc-name">{a.nombre}</div>
                <b style={{ color: indiceColor(a.indice.actual) }}>{pct(a.indice.actual)}</b></div>
              <div className="crm-mc-row"><span>Bonos del Q</span><b>{fmtMoneyFull(a.bonos.total_trimestre)}</b></div>
              <div className="crm-mc-row"><span>Prima ubicación Q</span><b>{fmtMoney(a.primas.ubicacionQ)}</b></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tablero' && selClave && loadingDetail && <div className="loading-wrap"><div className="spinner" /><p>Calculando...</p></div>}

      {tab === 'tablero' && detail && !loadingDetail && (
        <>
          {isAgency && overview.length > 1 && (
            <button className="btn-secondary" style={{ marginBottom: 14, padding: '6px 12px', fontSize: 12.5 }} onClick={() => setSelClave('')}>← Vista promotoría</button>
          )}

          {detail.agente.es_nuevo && (
            <div className="info-box" style={{ background: C.goldBg, borderColor: 'rgba(193,151,91,.4)', marginBottom: 16 }}>
              <p><Sparkles size={14} style={{ verticalAlign: -2 }} /> <b>Agente nuevo (mes {detail.agente.mes_agente} de 15):</b> aún no tienes índice de conservación propio — Prudential te bonifica como si estuvieras en la banda del 90%.</p>
            </div>
          )}
          {!detail.agente.es_nuevo && idx.umbral === null && (
            <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red, marginBottom: 16 }}>
              <p><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> <b>Índice debajo del 86%:</b> con el índice actual no se pagan bonos este trimestre aunque llegues a la meta de prima. Revisa los accionables abajo — cobrar pendientes y rehabilitar canceladas es lo único que lo sube.</p>
            </div>
          )}

          {/* ── Índice de conservación ── */}
          <div className="crm-chart-card">
            <h3><ShieldCheck size={16} style={{ verticalAlign: -2, color: C.gold }} /> Índice de conservación — {detail.agente.nombre}</h3>
            <p className="sub">Base a conservar {fmtMoneyFull(idx.baseAConservar)} · conservada {fmtMoneyFull(idx.baseConservada)} · pendiente de pago {fmtMoneyFull(idx.basePendiente)}</p>
            <IndiceBar actual={idx.actual} operativo={idx.operativo} />
            <div className="crm-kpi-detail">
              <BonoCard icon={ShieldCheck} label="Índice al corte" value={<span style={{ color: indiceColor(idx.actual) }}>{pct(idx.actual)}</span>} sub="oficial del último corte Prudential" />
              {idx.hoy && <BonoCard icon={RefreshCw} label="Índice hoy (en vivo)" value={<span style={{ color: indiceColor(idx.hoy.actual) }}>{pct(idx.hoy.actual)}</span>} sub={`al ${fmtDate(idx.hoy.fecha)} · se recalcula solo con cada pago que vence o se cobra`} />}
              <BonoCard icon={TrendingUp} label="Con pendientes de pago" value={<span style={{ color: indiceColor(idx.conPendiente) }}>{pct(idx.conPendiente)}</span>} sub="si se cobra lo pendiente del mes" />
              <BonoCard icon={Target} label="Banda de bono" value={idx.esNuevo ? 'Banda 90%' : (UMBRAL_LABEL[idx.umbral] || 'Sin bono')} sub={idx.esNuevo ? 'por agente nuevo' : 'mínimo 86% para cobrar bonos'} color={idx.umbral ? C.green : C.red} />
              <BonoCard icon={HandCoins} label="Bonos del trimestre" value={<span style={{ color: C.green }}>{fmtMoneyFull(b.total_trimestre)}</span>} sub={`mensuales ${fmtMoney(b.total_mensuales)} + ajuste ${fmtMoney(b.trimestral.ajuste)} + conservación ${fmtMoney(b.conservacion.monto)}`} />
            </div>
            {detail.historico?.length > 0 && (
              <p className="sub" style={{ marginTop: 4 }}>
                Histórico: {detail.historico.map(h => `${h.periodo}: ${pct(h.indice)}`).join(' · ')}
              </p>
            )}
          </div>

          {/* ── Bonos del trimestre ── */}
          <div className="crm-chart-card">
            <h3><HandCoins size={16} style={{ verticalAlign: -2, color: C.gold }} /> Bonos PIR del {detail.periodo.trimestre}Q {detail.periodo.anio}</h3>
            <p className="sub">Cuaderno {detail.agente.cuaderno} · prima ubicación del Q {fmtMoneyFull(detail.primas.ubicacionQ)} · pagada inicial {fmtMoneyFull(detail.primas.pagadaInicialQ)} · renovación {fmtMoneyFull(detail.primas.renovacionQ)}</p>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Concepto</th><th>Rango</th><th>%</th><th>Aplica sobre</th><th>Bono</th></tr></thead>
                <tbody>
                  {b.mensuales.map(m => (
                    <tr key={m.mes}>
                      <td>Bono inicial mensual — <b>{MESES[m.mes - 1]}</b></td>
                      <td>{m.bono_mensual.rango || '—'}</td>
                      <td>{m.bono_mensual.pct ? pct(m.bono_mensual.pct, 1) : '—'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoneyFull(m.prima_pagada_inicial)} <span style={{ fontSize: 11, color: C.textMuted }}>(ubicación {fmtMoney(m.prima_ubicacion)})</span></td>
                      <td><b style={{ color: m.bono_mensual.monto ? C.green : C.textLight }}>{fmtMoneyFull(m.bono_mensual.monto)}</b></td>
                    </tr>
                  ))}
                  <tr>
                    <td>Bono inicial trimestral <span style={{ fontSize: 11, color: C.textMuted }}>(se paga el ajuste: trimestral − mensuales)</span></td>
                    <td>{b.trimestral.rango || '—'}</td>
                    <td>{b.trimestral.pct ? pct(b.trimestral.pct, 1) : '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoneyFull(detail.primas.pagadaInicialQ)}</td>
                    <td><b style={{ color: b.trimestral.ajuste ? C.green : C.textLight }}>{fmtMoneyFull(b.trimestral.ajuste)}</b> <span style={{ fontSize: 11, color: C.textMuted }}>de {fmtMoney(b.trimestral.monto)}</span></td>
                  </tr>
                  <tr>
                    <td>Bono de conservación <span style={{ fontSize: 11, color: C.textMuted }}>(sobre prima de renovación)</span></td>
                    <td>{b.conservacion.rango || '—'}</td>
                    <td>{b.conservacion.pct ? pct(b.conservacion.pct, 1) : '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoneyFull(detail.primas.renovacionQ)}</td>
                    <td><b style={{ color: b.conservacion.monto ? C.green : C.textLight }}>{fmtMoneyFull(b.conservacion.monto)}</b></td>
                  </tr>
                  <tr style={{ background: 'rgba(193,151,91,.07)' }}>
                    <td colSpan={4}><b>Total bonos del trimestre</b></td>
                    <td><b style={{ color: C.green, fontSize: 15 }}>{fmtMoneyFull(b.total_trimestre)}</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Bonos en juego (siguiente rango) ── */}
          <div className="crm-chart-card">
            <h3><Scale size={16} style={{ verticalAlign: -2, color: C.gold }} /> Bonos en juego — ¿cuánto falta para el siguiente rango?</h3>
            <p className="sub">Bono inicial trimestral por rango de prima ubicación. Columnas = banda de índice alcanzada.</p>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Rango</th><th>Prima ubicación mín.</th><th>Faltante</th><th>Bono @86%</th><th>Bono @90%</th><th>Bono @94%</th></tr></thead>
                <tbody>
                  {detail.enJuego.trimestral.filter(r => r.alcanzado || r.faltante > 0).slice(0, 6).map(r => (
                    <tr key={r.rango} style={r.alcanzado ? { background: 'rgba(16,185,129,.06)' } : {}}>
                      <td><b>{r.rango}</b> {r.alcanzado && <span className="badge" style={{ background: C.greenBg, color: C.green, marginLeft: 6 }}>Alcanzado</span>}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoneyFull(r.prima_min)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.alcanzado ? '—' : <b style={{ color: C.amber }}>{fmtMoneyFull(r.faltante)}</b>}</td>
                      <td>{fmtMoney(r.bonos['0.86'])}</td>
                      <td>{fmtMoney(r.bonos['0.90'])}</td>
                      <td><b style={{ color: C.green }}>{fmtMoney(r.bonos['0.94'])}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Accionables ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
            <div className="crm-chart-card" style={{ marginBottom: 0 }}>
              <h3><AlertTriangle size={16} style={{ verticalAlign: -2, color: C.amber }} /> Pendientes de pago ({detail.accionables.pendientesPago.length})</h3>
              <p className="sub">Cobrarlas sube el índice de {pct(idx.actual)} hacia {pct(idx.conPendiente)}</p>
              {detail.accionables.pendientesPago.length === 0 && <p className="empty">Nada pendiente 🎉</p>}
              {detail.accionables.pendientesPago.slice(0, 8).map(p => (
                <div key={p.id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '7px 0' }}>
                  <span>Póliza <b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id} · pagada hasta {fmtDate(p.pagado_hasta)}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b>{fmtMoney(p.monto)} <span style={{ color: C.green, fontSize: 11 }}>+{pct(p.impacto_indice, 1)}</span></b>
                    {isAgency && <button className="btn-secondary" style={{ padding: '3px 9px', fontSize: 11.5 }} onClick={() => registrar(p, 'pago')}>Registrar cobro</button>}
                  </span>
                </div>
              ))}
            </div>
            <div className="crm-chart-card" style={{ marginBottom: 0 }}>
              <h3><RotateCcw size={16} style={{ verticalAlign: -2, color: '#0891B2' }} /> Rehabilitables ({detail.accionables.rehabilitables.length})</h3>
              <p className="sub">Canceladas con menos de 6 meses: aún pueden rehabilitarse y sumar al índice</p>
              {detail.accionables.rehabilitables.length === 0 && <p className="empty">Sin canceladas recientes</p>}
              {detail.accionables.rehabilitables.slice(0, 8).map(p => (
                <div key={p.id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '7px 0' }}>
                  <span>Póliza <b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id} · cancelada {fmtDate(p.fecha_ultima_cancelacion)}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b>{fmtMoney(p.monto)} <span style={{ color: C.green, fontSize: 11 }}>+{pct(p.impacto_indice, 1)}</span></b>
                    {isAgency && <button className="btn-secondary" style={{ padding: '3px 9px', fontSize: 11.5 }} onClick={() => registrar(p, 'rehabilitar')}>Rehabilitada</button>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ TAB SIMULADOR ═══════════ */}
      {tab === 'simulador' && detail && (
        <>
          <div className="crm-chart-card">
            <h3><Calculator size={16} style={{ verticalAlign: -2, color: C.gold }} /> Simulador — {detail.agente.nombre}</h3>
            <p className="sub">¿Qué pasa con tu índice y tus bonos si vendes más, cobras lo pendiente o rehabilitas canceladas?</p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
                <label>Venta nueva adicional este trimestre (prima $)</label>
                <input type="number" min="0" placeholder="ej. 100000" value={ventaAdicional} onChange={e => setVentaAdicional(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={simBusy} onClick={runSim}><Calculator size={15} /> {simBusy ? 'Calculando...' : 'Simular'}</button>
            </div>

            {(detail.accionables.pendientesPago.length > 0 || detail.accionables.rehabilitables.length > 0) && (
              <div className="tbl-wrap" style={{ marginBottom: 8 }}>
                <table>
                  <thead><tr><th>Incluir</th><th>Póliza</th><th>Situación</th><th>Base</th><th>Impacto índice</th></tr></thead>
                  <tbody>
                    {detail.accionables.pendientesPago.map(p => (
                      <tr key={`c${p.id}`}>
                        <td><input type="checkbox" style={{ accentColor: C.primary, cursor: 'pointer' }} checked={simSel[p.id] === 'cobrar'}
                          onChange={e => setSimSel(s => ({ ...s, [p.id]: e.target.checked ? 'cobrar' : undefined }))} /></td>
                        <td><b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span></td>
                        <td><span className="badge" style={{ background: C.amberBg, color: C.amber }}>Cobrar pendiente</span></td>
                        <td>{fmtMoney(p.monto)}</td>
                        <td style={{ color: C.green }}>+{pct(p.impacto_indice, 1)}</td>
                      </tr>
                    ))}
                    {detail.accionables.rehabilitables.map(p => (
                      <tr key={`r${p.id}`}>
                        <td><input type="checkbox" style={{ accentColor: C.primary, cursor: 'pointer' }} checked={simSel[p.id] === 'rehabilitar'}
                          onChange={e => setSimSel(s => ({ ...s, [p.id]: e.target.checked ? 'rehabilitar' : undefined }))} /></td>
                        <td><b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span></td>
                        <td><span className="badge" style={{ background: '#E0F2FE', color: '#0891B2' }}>Rehabilitar</span></td>
                        <td>{fmtMoney(p.monto)}</td>
                        <td style={{ color: C.green }}>+{pct(p.impacto_indice, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {sim && (
            <div className="crm-chart-card">
              <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.green }} /> Resultado de la simulación</h3>
              <div className="crm-kpi-detail">
                <BonoCard icon={ShieldCheck} label="Índice"
                  value={<span><span style={{ color: indiceColor(sim.base.indice.operativo) }}>{pct(sim.base.indice.operativo)}</span> → <span style={{ color: indiceColor(sim.simulado.indice.operativo) }}>{pct(sim.simulado.indice.operativo)}</span></span>}
                  sub={sim.delta.indice > 0 ? `sube ${pct(sim.delta.indice)}` : 'sin cambio de índice'} />
                <BonoCard icon={Target} label="Banda de bono"
                  value={`${UMBRAL_LABEL[sim.base.indice.umbral] || 'Sin bono'} → ${UMBRAL_LABEL[sim.simulado.indice.umbral] || 'Sin bono'}`}
                  color={sim.simulado.indice.umbral ? C.green : C.red} />
                <BonoCard icon={HandCoins} label="Bonos del trimestre"
                  value={<span>{fmtMoney(sim.base.bonos.total_trimestre)} → <span style={{ color: C.green }}>{fmtMoneyFull(sim.simulado.bonos.total_trimestre)}</span></span>}
                  sub={sim.delta.bonos > 0 ? `+${fmtMoneyFull(sim.delta.bonos)} adicionales` : 'sin bono adicional'} />
                <BonoCard icon={Scale} label="Prima ubicación Q simulada" value={fmtMoneyFull(sim.simulado.primas.ubicacionQ)}
                  sub={`rango trimestral ${sim.simulado.bonos.trimestral.rango || '—'} (${sim.simulado.bonos.trimestral.pct ? pct(sim.simulado.bonos.trimestral.pct, 1) : 'sin rango'})`} />
              </div>
              <p className="sub">Desglose simulado: mensuales {fmtMoney(sim.simulado.bonos.total_mensuales)} + ajuste trimestral {fmtMoney(sim.simulado.bonos.trimestral.ajuste)} + conservación {fmtMoney(sim.simulado.bonos.conservacion.monto)}. La venta adicional se asume pagada dentro del trimestre en curso.</p>
            </div>
          )}
        </>
      )}

      {tab === 'simulador' && !detail && <p className="empty">Selecciona un agente en el Tablero PIR para simular.</p>}
    </div>
  );
}
