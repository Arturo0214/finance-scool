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
  HandCoins, Target, RotateCcw, Calculator, Scale, X, Plus,
  Mail, PenTool, Zap, Send, Settings,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, fmtMoneyFull, fmtDate, MESES } from './crmShared';
import CrmCommissionsView from './CrmCommissionsView';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

const pct = (n, dec = 2) => `${((Number(n) || 0) * 100).toFixed(dec)}%`;

/* Semáforo del índice contra los umbrales PIR */
const indiceColor = (i) => (i >= 0.94 ? C.green : i >= 0.90 ? '#0891B2' : i >= 0.86 ? C.amber : C.red);

const UMBRAL_LABEL = { '0.86': 'Banda 86%', '0.90': 'Banda 90%', '0.94': 'Banda 94%' };

/* Barra del índice con las marcas 86 / 90 / 94 (o las que se pidan) */
function IndiceBar({ actual, operativo, marks = [0.86, 0.90, 0.94] }) {
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

/* ── Panel de Rehabilitaciones: canceladas clasificadas por etapa y urgencia ── */
const URG_META = {
  EXTREMA: { label: 'Extremadamente urgente', color: C.red, bg: C.redBg },
  ALTA: { label: 'Urgente', color: '#B45309', bg: '#FEF3C7' },
  MEDIA: { label: 'Media', color: '#0E7490', bg: '#CFFAFE' },
  BAJA: { label: 'Baja', color: C.ink, bg: 'rgba(11,27,51,.05)' },
};
const ETAPA_META = {
  AUTOMATICA: { label: 'Automática', icon: Zap, hint: '0–30 días · sin trámite del cliente' },
  CORREO: { label: 'Con correo', icon: Mail, hint: '30–90 días · correo de petición' },
  FIRMA: { label: 'Con firma', icon: PenTool, hint: '90–180 días · firma autógrafa del cliente' },
};
const ORDEN_URG = ['EXTREMA', 'ALTA', 'MEDIA', 'BAJA'];

function UrgBadge({ u }) {
  const m = URG_META[u] || URG_META.BAJA;
  return <span style={{ background: m.bg, color: m.color, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>{m.label}</span>;
}
function EtapaBadge({ e }) {
  const m = ETAPA_META[e]; if (!m) return null;
  const Icon = m.icon;
  return <span title={m.hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, opacity: 0.85 }}><Icon size={12} /> {m.label}</span>;
}

function RehabConfigEditor({ onClose, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.crmIngresosRehabConfig().then(d => { setCfg(d); setSel(new Set((d.personaliza_planes || []).map(s => s.toUpperCase()))); }).catch(e => alert(e.message));
  }, []);
  const toggle = (p) => setSel(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const save = async () => {
    setBusy(true);
    try { await api.crmIngresosRehabConfigSave([...sel]); onSaved && onSaved(); onClose(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const planes = (cfg?.planes_disponibles || []).filter(p => p.plan_id.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}><Settings size={16} style={{ verticalAlign: -3 }} /> Planes PERSONALIZA</h3>
          <button className="btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>Marca los códigos de plan que corresponden al producto <b>PERSONALIZA</b>. Esas pólizas solo tienen <b>30 días</b> de ventana de rehabilitación; pasado ese plazo se marcan como vencidas (no rehabilitables).</p>
        {!cfg ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <>
            <input className="crm-input" placeholder="Buscar código de plan…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 320, overflow: 'auto', border: `1px solid ${C.line || 'rgba(11,27,51,.1)'}`, borderRadius: 8 }}>
              <table style={{ width: '100%' }}>
                <thead><tr><th></th><th style={{ textAlign: 'left' }}>Plan</th><th style={{ textAlign: 'right' }}>Pólizas</th></tr></thead>
                <tbody>
                  {planes.map(p => (
                    <tr key={p.plan_id} style={{ cursor: 'pointer', background: sel.has(p.plan_id) ? '#FEF3C7' : 'transparent' }} onClick={() => toggle(p.plan_id)}>
                      <td style={{ width: 34 }}><input type="checkbox" readOnly checked={sel.has(p.plan_id)} /></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{p.plan_id}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.polizas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span className="sub">{sel.size} plan(es) marcados como PERSONALIZA</span>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RehabPanel({ data, isAgency, busy, onReload, openExpediente }) {
  const { resumen, rehabilitables, vencidas, personaliza_configurado } = data;
  const [cfgOpen, setCfgOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [sending, setSending] = useState(false);
  /* Filtros por columna */
  const [fAsesor, setFAsesor] = useState('');
  const [fPoliza, setFPoliza] = useState('');
  const [fEtapa, setFEtapa] = useState('');
  const [fUrg, setFUrg] = useState('');
  const [actId, setActId] = useState(null);

  const marcar = async (r, accion) => {
    const txt = accion === 'rehabilitar'
      ? `¿Marcar la póliza ${r.poliza} (${r.agente}) como rehabilitada?`
      : `¿Registrar el cobro de la póliza ${r.poliza} (${r.agente})?`;
    if (!window.confirm(txt)) return;
    setActId(r.id);
    try { await api.crmIngresosPoliza(r.id, accion); await onReload(); }
    catch (e) { alert(e.message); }
    finally { setActId(null); }
  };

  const enviarAlertas = async () => {
    if (!window.confirm('¿Enviar por correo las rehabilitaciones urgentes a cada asesor y el digest a la promotoría?')) return;
    setSending(true); setAlertMsg('');
    try {
      const r = await api.crmIngresosRehabAlerts();
      setAlertMsg(r.ok ? `✅ Enviado: ${r.enviados.length} asesor(es), digest a ${r.digestDestinatarios} destinatario(s), ${r.accionablesTotales} accionables.${r.fallidos?.length ? ` Fallidos: ${r.fallidos.length} (¿EMAIL_USER/PASS configurados?).` : ''}` : `Omitido: ${r.skipped}`);
    } catch (e) { setAlertMsg('Error: ' + e.message); }
    finally { setSending(false); }
  };

  const filtrados = rehabilitables.filter(r =>
    (!fAsesor || String(r.agente || '').toLowerCase().includes(fAsesor.toLowerCase())) &&
    (!fPoliza || `${r.poliza} ${r.plan_id || ''}`.toLowerCase().includes(fPoliza.toLowerCase())) &&
    (!fEtapa || r.etapa === fEtapa) &&
    (!fUrg || r.urgencia === fUrg)
  );
  const hayFiltro = fAsesor || fPoliza || fEtapa || fUrg;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: '0 0 2px' }}><RotateCcw size={17} style={{ verticalAlign: -3, color: C.gold }} /> Rehabilitaciones {data.scope === 'asesor' ? '(tu cartera)' : '(promotoría)'}</h3>
          <p className="sub" style={{ margin: 0 }}>El plazo corre desde la cancelación: <b>0–30d</b> automática · <b>30–90d</b> con correo · <b>90–180d</b> con firma · <b>+180d</b> se pierde.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAgency && <button className="btn-secondary" onClick={() => setCfgOpen(true)}><Settings size={15} /> PERSONALIZA</button>}
          {isAgency && <button className="btn-secondary" onClick={enviarAlertas} disabled={sending}><Send size={15} /> {sending ? 'Enviando…' : 'Enviar alertas'}</button>}
          <button className="btn-secondary" onClick={onReload} disabled={busy}><RefreshCw size={15} /></button>
        </div>
      </div>

      {!personaliza_configurado && isAgency && (
        <div className="info-box" style={{ background: '#FEF3C7', borderColor: '#F59E0B40', color: '#92400E', margin: '8px 0' }}>
          <p style={{ margin: 0 }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> No has configurado los planes <b>PERSONALIZA</b> (ventana de solo 30 días). Hasta hacerlo, esas pólizas se tratan con la regla general de 180 días. Configúralos con el botón <b>PERSONALIZA</b>.</p>
        </div>
      )}
      {alertMsg && <div className="info-box" style={{ margin: '8px 0' }}><p style={{ margin: 0 }}>{alertMsg}</p></div>}

      <div className="crm-kpi-detail" style={{ margin: '12px 0' }}>
        <BonoCard icon={RotateCcw} label="Rehabilitables" value={resumen.total} sub={fmtMoney(resumen.monto) + ' en riesgo'} />
        <BonoCard icon={Zap} label="Automáticas (0–30d)" value={resumen.automatizables} sub="sin trámite del cliente" color={C.green} />
        <BonoCard icon={AlertTriangle} label="Extremas + urgentes" value={(resumen.por_urgencia.EXTREMA || 0) + (resumen.por_urgencia.ALTA || 0)} sub={`${resumen.por_urgencia.EXTREMA || 0} extremas · ${resumen.por_urgencia.ALTA || 0} urgentes`} color={C.red} />
        <BonoCard icon={X} label="Vencidas (+180d)" value={vencidas.total} sub={fmtMoney(vencidas.monto) + ' perdidas'} color={C.ink} />
      </div>

      <div className="sub" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        <span><Zap size={12} style={{ verticalAlign: -1, color: C.green }} /> Automática: {resumen.por_etapa.AUTOMATICA}</span>
        <span><Mail size={12} style={{ verticalAlign: -1 }} /> Con correo: {resumen.por_etapa.CORREO}</span>
        <span><PenTool size={12} style={{ verticalAlign: -1 }} /> Con firma: {resumen.por_etapa.FIRMA}</span>
      </div>

      {rehabilitables.length === 0 && <p className="empty">No hay canceladas rehabilitables. 🎉</p>}

      {rehabilitables.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px' }}>
            <span className="sub">{filtrados.length} de {rehabilitables.length} · {fmtMoney(filtrados.reduce((s, r) => s + r.monto, 0))}</span>
            {hayFiltro && <button className="f-tab" style={{ fontSize: 11 }} onClick={() => { setFAsesor(''); setFPoliza(''); setFEtapa(''); setFUrg(''); }}>Limpiar filtros</button>}
          </div>
          <table>
            <thead>
              <tr>
                {data.scope !== 'asesor' && <th style={{ textAlign: 'left' }}>Asesor</th>}
                <th style={{ textAlign: 'left' }}>Póliza</th>
                <th style={{ textAlign: 'left' }}>Etapa</th>
                <th style={{ textAlign: 'left' }}>Urgencia</th>
                <th style={{ textAlign: 'right' }}>Cancelada hace</th>
                <th style={{ textAlign: 'right' }}>Vence etapa</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                {isAgency && <th></th>}
              </tr>
              {/* Fila de filtros por columna */}
              <tr>
                {data.scope !== 'asesor' && <th><input className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} placeholder="filtrar…" value={fAsesor} onChange={e => setFAsesor(e.target.value)} /></th>}
                <th><input className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} placeholder="póliza/plan…" value={fPoliza} onChange={e => setFPoliza(e.target.value)} /></th>
                <th><select className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} value={fEtapa} onChange={e => setFEtapa(e.target.value)}>
                  <option value="">todas</option><option value="AUTOMATICA">Automática</option><option value="CORREO">Con correo</option><option value="FIRMA">Con firma</option>
                </select></th>
                <th><select className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} value={fUrg} onChange={e => setFUrg(e.target.value)}>
                  <option value="">todas</option><option value="EXTREMA">Extrema</option><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
                </select></th>
                <th></th><th></th><th></th>{isAgency && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(r => (
                <tr key={r.id}>
                  {data.scope !== 'asesor' && <td style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => openExpediente(r.id)}>{r.agente}</td>}
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5, cursor: 'pointer' }} onClick={() => openExpediente(r.id)}>{r.poliza} <span style={{ opacity: 0.5 }}>{r.plan_id}</span></td>
                  <td style={{ cursor: 'pointer' }} onClick={() => openExpediente(r.id)}><EtapaBadge e={r.etapa} /></td>
                  <td><UrgBadge u={r.urgencia} /></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_desde_cancelacion}d</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.dias_para_vencer_etapa <= 7 ? C.red : r.dias_para_vencer_etapa <= 20 ? '#B45309' : C.ink }}>{r.dias_para_vencer_etapa}d</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.monto)}</td>
                  {isAgency && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} disabled={actId === r.id} title="Marcar rehabilitada"
                        onClick={() => marcar(r, 'rehabilitar')}><RotateCcw size={13} /> {actId === r.id ? '…' : 'Rehabilitar'}</button>
                    </td>
                  )}
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={8}><p className="empty" style={{ margin: 8 }}>Ninguna coincide con los filtros.</p></td></tr>}
            </tbody>
          </table>
        </>
      )}

      {cfgOpen && <RehabConfigEditor onClose={() => setCfgOpen(false)} onSaved={onReload} />}
    </div>
  );
}

/* ── Proyección de ingresos a 1/2/3 años ──
   Modelo transparente con supuestos editables: la venta mensual crece g% al
   año; cada generación de pólizas sobrevive con la tasa de conservación; el
   ingreso del año = comisión de año 1 sobre la venta nueva + comisión de
   renovación sobre la cartera viva + bonos PIR estimados. */
function ProyeccionIngresos({ detail }) {
  const ventaActual = Math.round((detail.primas.ubicacionQ || 0) / 3) || 10000;
  const consDefault = Math.round(Math.min(0.97, Math.max(0.5, detail.indice.conPendiente || detail.indice.actual || 0.9)) * 100);
  const bonoPctDefault = detail.primas.pagadaInicialQ > 0
    ? Math.min(45, Math.round((detail.bonos.total_trimestre / detail.primas.pagadaInicialQ) * 100))
    : 25;

  const [venta, setVenta] = useState(String(ventaActual));
  const [crecimiento, setCrecimiento] = useState('10');
  const [conservacion, setConservacion] = useState(String(consDefault));
  const [comInicial, setComInicial] = useState('30');
  const [comRenov, setComRenov] = useState('5');
  const [bonoPct, setBonoPct] = useState(String(Math.max(0, bonoPctDefault)));

  const V = Number(venta) || 0, g = (Number(crecimiento) || 0) / 100, r = (Number(conservacion) || 0) / 100;
  const c1 = (Number(comInicial) || 0) / 100, c2 = (Number(comRenov) || 0) / 100, bp = (Number(bonoPct) || 0) / 100;
  const carteraActualAnual = (detail.primas.renovacionQ || 0) * 4; // renovación del Q anualizada

  const anios = [1, 2, 3].map(n => {
    const primaNueva = V * 12 * Math.pow(1 + g, n - 1);
    // cartera en renovación del año n: generaciones previas vivas + cartera actual sobreviviente
    let cartera = carteraActualAnual * Math.pow(r, n);
    for (let k = 1; k < n; k++) cartera += (V * 12 * Math.pow(1 + g, k - 1)) * Math.pow(r, n - k);
    const comisionNueva = primaNueva * c1;
    const comisionRenov = cartera * c2;
    const bonos = (r >= 0.86 ? primaNueva * bp : 0);
    const total = comisionNueva + comisionRenov + bonos;
    return { n, primaNueva, cartera, comisionNueva, comisionRenov, bonos, total, mensual: total / 12 };
  });

  const inp = (label, val, set, sufijo) => (
    <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type="number" value={val} onChange={e => set(e.target.value)} />
        {sufijo && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMuted }}>{sufijo}</span>}
      </div>
    </div>
  );

  return (
    <>
      <div className="crm-chart-card">
        <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.gold }} /> ¿Cuánto estarías ganando en 1, 2 y 3 años? — {detail.agente.nombre}</h3>
        <p className="sub">
          Estimación con supuestos editables. Punto de partida: vendes ≈ {fmtMoneyFull(ventaActual)}/mes y tu cartera de renovación anualizada es {fmtMoneyFull(carteraActualAnual)}.
          El secreto del ingreso a 3 años es la cartera: cada año que conservas se te apila encima de la venta nueva.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          {inp('Venta mensual (prima $)', venta, setVenta)}
          {inp('Crecimiento anual', crecimiento, setCrecimiento, '%')}
          {inp('Conservación', conservacion, setConservacion, '%')}
          {inp('Comisión año 1', comInicial, setComInicial, '%')}
          {inp('Comisión renovación', comRenov, setComRenov, '%')}
          {inp('Bonos PIR s/ venta nueva', bonoPct, setBonoPct, '%')}
        </div>

        <div className="crm-kpi-detail">
          {anios.map(a => (
            <div key={a.n} className="crm-kpi-box" style={{ borderTop: `3px solid ${['#C1975B', '#003DA5', '#0E7C6B'][a.n - 1]}` }}>
              <div className="k-label">En {a.n} año{a.n > 1 ? 's' : ''}</div>
              <div className="k-value" style={{ color: C.green }}>{fmtMoneyFull(Math.round(a.mensual))}<span style={{ fontSize: 13, color: C.textMuted }}>/mes</span></div>
              <div className="k-sub">{fmtMoneyFull(Math.round(a.total))} al año</div>
            </div>
          ))}
        </div>

        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Año</th><th>Venta nueva anual</th><th>Cartera en renovación</th><th>Comisión venta nueva</th><th>Comisión renovación</th><th>Bonos PIR</th><th>Ingreso anual</th><th>Ingreso mensual</th></tr></thead>
            <tbody>
              {anios.map(a => (
                <tr key={a.n}>
                  <td><b>Año {a.n}</b></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.primaNueva)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.cartera)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.comisionNueva)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.comisionRenov)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: a.bonos ? C.green : C.red }}>{a.bonos ? fmtMoney(a.bonos) : 'sin banda'}</td>
                  <td><b style={{ color: C.green }}>{fmtMoneyFull(Math.round(a.total))}</b></td>
                  <td><b>{fmtMoneyFull(Math.round(a.mensual))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r < 0.86 && (
          <p className="sub" style={{ color: C.red, marginTop: 10 }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Con conservación debajo del 86% los bonos PIR se van a cero — sube la tasa de conservación en los supuestos para ver el efecto completo.
          </p>
        )}
        <p style={{ fontSize: 11, color: C.textLight, margin: '10px 0 0' }}>
          Estimación informativa: las comisiones reales dependen del producto y plazo (tabla de comisiones Prudential) y los bonos de tu cuaderno y banda de índice. Ajusta los supuestos a tu realidad.
        </p>
      </div>
    </>
  );
}

export default function CrmIngresosView({ isAgency }) {
  const [tab, setTab] = useState('tablero');
  const [overview, setOverview] = useState([]);
  const [promo, setPromo] = useState(null);       // tablero de la promotoría
  const [promoSel, setPromoSel] = useState({});   // poliza_id → true (simulador promotoría)
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

  /* Expediente de póliza (clic en pendientes/rehabilitables): motivo de
     cancelación + notas ligadas al expediente en crm_policies */
  const [polExp, setPolExp] = useState(null); // { id, loading, data, motivo, nota, saving }

  const openPolExpediente = async (id) => {
    setPolExp({ id, loading: true });
    try {
      const d = await api.crmIngresosPolizaExpediente(id);
      setPolExp({ id, loading: false, data: d, motivo: d.policy?.motivo_cancelacion || '', nota: '', saving: false });
    } catch (e) { alert(e.message); setPolExp(null); }
  };

  const savePolMotivo = async () => {
    if (!polExp?.data) return;
    setPolExp(p => ({ ...p, saving: true }));
    try {
      await api.crmIngresosPolizaMotivo(polExp.id, polExp.motivo);
      setPolExp(p => ({ ...p, saving: false, data: { ...p.data, policy: { ...p.data.policy, motivo_cancelacion: p.motivo } } }));
    } catch (e) { alert(e.message); setPolExp(p => ({ ...p, saving: false })); }
  };

  const addPolNota = async () => {
    if (!polExp?.data?.policy?.crm_clients?.id || !polExp.nota.trim()) return;
    try {
      await api.crmCreateNote({
        client_id: polExp.data.policy.crm_clients.id, tipo: 'nota',
        texto: `[Póliza ${polExp.data.numero}] ${polExp.nota.trim()}`,
      });
      const d = await api.crmIngresosPolizaExpediente(polExp.id);
      setPolExp(p => ({ ...p, nota: '', data: d }));
    } catch (e) { alert(e.message); }
  };

  /* Nota automática que deja registro de la cancelación (fecha + etapa) */
  const addCancelNote = async () => {
    const d = polExp?.data;
    if (!d?.policy?.crm_clients?.id) { alert('Esta póliza aún no tiene expediente en el CRM (carga el reporte de pólizas).'); return; }
    const r = d.rehab;
    const fecha = d.indice.fecha_ultima_cancelacion;
    const txt = `Cancelada el ${fecha ? fmtDate(fecha) : 's/f'}${r ? ` · rehabilitación ${r.etapa_label.toLowerCase()} (${r.metodo}) · quedan ${r.dias_para_vencer_etapa} días de esta etapa` : ''}.`;
    try {
      await api.crmCreateNote({ client_id: d.policy.crm_clients.id, tipo: 'nota', texto: `[Póliza ${d.numero}] ${txt}` });
      const nd = await api.crmIngresosPolizaExpediente(polExp.id);
      setPolExp(p => ({ ...p, data: nd }));
    } catch (e) { alert(e.message); }
  };

  /* Marcar pagada / rehabilitada desde el modal (agencia): avanza el índice y
     deja nota automática. Refresca la lista de donde se abrió. */
  const polAccion = async (accion) => {
    const d = polExp?.data;
    if (!d) return;
    const txt = accion === 'pago'
      ? `¿Registrar el cobro de la póliza ${d.numero}? Su "pagada hasta" avanza un periodo y sube tu índice.`
      : `¿Marcar la póliza ${d.numero} como rehabilitada? Vuelve a Vigente, avanza un periodo y sube tu índice.`;
    if (!window.confirm(txt)) return;
    setPolExp(p => ({ ...p, actioning: true }));
    try {
      await api.crmIngresosPoliza(polExp.id, accion);
      if (d.policy?.crm_clients?.id) {
        await api.crmCreateNote({
          client_id: d.policy.crm_clients.id, tipo: 'nota',
          texto: `[Póliza ${d.numero}] ${accion === 'pago' ? 'Cobro registrado' : 'Rehabilitación registrada'} el ${new Date().toLocaleDateString('es-MX')} desde el CRM.`,
        });
      }
      const nd = await api.crmIngresosPolizaExpediente(polExp.id);
      setPolExp(p => ({ ...p, actioning: false, data: nd }));
      if (selClave) api.crmIngresosAgent(selClave).then(setDetail).catch(() => {});
      else api.crmIngresosPromotoria().then(setPromo).catch(() => {});
      loadRehab();
    } catch (e) { alert(e.message); setPolExp(p => ({ ...p, actioning: false })); }
  };

  /* Trayectoria a 15 meses */
  const [tray, setTray] = useState(null);
  const [trayBusy, setTrayBusy] = useState(false);
  const [trayVenta, setTrayVenta] = useState('');
  const [trayTasa, setTrayTasa] = useState('');
  const [trayCobra, setTrayCobra] = useState(true);

  /* Rehabilitaciones (pestaña propia): lista clasificada por etapa/urgencia */
  const [rehab, setRehab] = useState(null);
  const [rehabBusy, setRehabBusy] = useState(false);
  const [rehabErr, setRehabErr] = useState('');
  const loadRehab = useCallback(async () => {
    setRehabBusy(true); setRehabErr('');
    try { setRehab(await api.crmIngresosRehabilitaciones()); }
    catch (e) { setRehabErr(e.message || 'No se pudo cargar rehabilitaciones'); }
    finally { setRehabBusy(false); }
  }, []);
  useEffect(() => { if (tab === 'rehab' && !rehab && !rehabBusy && !rehabErr) loadRehab(); }, [tab, rehab, rehabBusy, rehabErr, loadRehab]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api.crmIngresosOverview();
      const rows = d.agentes || [];
      setOverview(rows);
      // Asesor: solo viene su clave → entrar directo al detalle
      if (rows.length === 1) setSelClave(rows[0].clave);
      else api.crmIngresosPromotoria().then(p => setPromo(p)).catch(() => {});
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selClave) { setDetail(null); return; }
    let alive = true;
    (async () => {
      setLoadingDetail(true); setSim(null); setSimSel({}); setVentaAdicional('');
      setTray(null); setTrayVenta(''); setTrayTasa('');
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

  const runTrayectoria = async () => {
    if (!detail) return;
    setTrayBusy(true);
    try {
      const d = await api.crmIngresosTrayectoria({
        clave: detail.agente.clave,
        ...(trayVenta !== '' ? { ventaMensual: Number(trayVenta) } : {}),
        ...(trayTasa !== '' ? { tasaConservacion: Number(trayTasa) / 100 } : {}),
        cobrarPendientes: trayCobra,
      });
      setTray(d);
      // Primera corrida: mostrar los supuestos que el server eligió por default
      if (trayVenta === '') setTrayVenta(String(Math.round(d.supuestos.ventaMensual)));
      if (trayTasa === '') setTrayTasa(String(Math.round(d.supuestos.tasaConservacion * 100)));
    } catch (e) { alert(e.message); }
    finally { setTrayBusy(false); }
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
        <button className={`crm-dtab${tab === 'simulador' ? ' active' : ''}`} onClick={() => setTab('simulador')}>Simulador</button>
        <button className={`crm-dtab${tab === 'conciliacion' ? ' active' : ''}`} onClick={() => setTab('conciliacion')}>Comisiones CRM</button>
        <button className={`crm-dtab${tab === 'proyeccion' ? ' active' : ''}`} onClick={() => setTab('proyeccion')}>Proyección 1–3 años</button>
        <button className={`crm-dtab${tab === 'rehab' ? ' active' : ''}`} onClick={() => setTab('rehab')}>♻️ Rehabilitaciones</button>
      </div>

      {/* ══ Expediente de póliza: motivo de cancelación + notas ══ */}
      {polExp && (
        <div className="modal-overlay" onClick={() => setPolExp(null)}>
          <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
            {polExp.loading ? (
              <div className="loading-wrap" style={{ minHeight: 160 }}><div className="spinner" /></div>
            ) : (() => {
              const { indice, numero, policy, notes, rehab } = polExp.data;
              const cancelada = String(indice.estatus_calculo || '').toUpperCase() !== 'VIGENTE';
              const cliente = policy?.crm_clients;
              const urgColor = rehab ? (URG_META[rehab.urgencia] || URG_META.BAJA).color : C.ink;
              return (
                <>
                  <div className="modal-head">
                    <div>
                      <h2>Póliza {numero}</h2>
                      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {!cancelada && <span className="badge" style={{ background: C.amberBg, color: C.amber }}>Pendiente de pago</span>}
                        {cliente?.telefono && (
                          <a href={`https://wa.me/${String(cliente.telefono).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                            style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none', fontSize: 12.5 }}>WhatsApp ↗</a>
                        )}
                      </div>
                    </div>
                    <button className="close-btn" onClick={() => setPolExp(null)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    {/* Banner de cancelación / rehabilitación — grande y visible */}
                    {cancelada && (
                      <div style={{ border: `1px solid ${urgColor}55`, background: `${urgColor}10`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: urgColor, display: 'flex', alignItems: 'center', gap: 7 }}>
                              <AlertTriangle size={16} /> Cancelada el {indice.fecha_ultima_cancelacion ? fmtDate(indice.fecha_ultima_cancelacion) : 'fecha no disponible'}
                            </div>
                            {rehab
                              ? <div style={{ fontSize: 13, marginTop: 4, color: C.ink }}>
                                  Hace <b>{rehab.dias_desde_cancelacion} días</b> · {rehab.etapa_label}: <b>{rehab.metodo}</b>
                                  {rehab.rehabilitable
                                    ? <> · quedan <b style={{ color: rehab.dias_para_vencer_etapa <= 7 ? C.red : rehab.dias_para_vencer_etapa <= 20 ? '#B45309' : C.ink }}>{rehab.dias_para_vencer_etapa} días</b> de esta etapa</>
                                    : <> · <b style={{ color: C.red }}>ya no es rehabilitable</b></>}
                                </div>
                              : <div style={{ fontSize: 13, marginTop: 4, color: C.ink }}>Sin fecha de cancelación registrada en el corte.</div>}
                          </div>
                          {rehab && <UrgBadge u={rehab.urgencia} />}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          {isAgency && rehab?.rehabilitable && (
                            <button className="btn-primary" disabled={polExp.actioning} onClick={() => polAccion('rehabilitar')}>
                              <RotateCcw size={14} /> {polExp.actioning ? 'Procesando…' : 'Marcar rehabilitada'}
                            </button>
                          )}
                          {isAgency && (
                            <button className="btn-secondary" disabled={polExp.actioning} onClick={() => polAccion('pago')}>
                              <HandCoins size={14} /> Marcar pagada
                            </button>
                          )}
                          <button className="btn-secondary" onClick={addCancelNote}><Plus size={14} /> Registrar nota de cancelación</button>
                        </div>
                      </div>
                    )}
                    <div className="crm-kpi-detail" style={{ marginBottom: 14 }}>
                      <div className="crm-kpi-box"><div className="k-label">Cliente</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{cliente?.nombre || '—'}</div><div className="k-sub">{cliente?.telefono || 'sin teléfono'}</div></div>
                      <div className="crm-kpi-box"><div className="k-label">Plan</div><div style={{ fontSize: 13.5 }}>{indice.plan_id || policy?.plan || '—'}</div><div className="k-sub">{indice.frecuencia_pago || policy?.forma_pago || ''}</div></div>
                      <div className="crm-kpi-box"><div className="k-label">Base en el índice</div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{fmtMoney(indice.base_a_conservar_mxn)}</div><div className="k-sub">asesor {indice.clave}</div></div>
                      {policy?.motivo_compra && <div className="crm-kpi-box"><div className="k-label">Compró porque</div><div style={{ fontSize: 12.5 }}>{policy.motivo_compra}</div></div>}
                    </div>

                    {!policy && (
                      <div className="info-box" style={{ marginBottom: 14, background: C.amberBg, borderColor: `${C.amber}40` }}>
                        <p>Esta póliza aún no está ligada a un expediente del CRM — carga el reporte de pólizas en la sección Pólizas para vincular cliente y notas.</p>
                      </div>
                    )}

                    {policy && (
                      <div className="field">
                        <label>{cancelada ? '¿Por qué se canceló? (la clave para rehabilitarla: responde a ESA razón)' : '¿Por qué no ha pagado? (contexto de cobranza)'}</label>
                        <textarea rows={2} value={polExp.motivo} onChange={e => setPolExp(p => ({ ...p, motivo: e.target.value }))}
                          placeholder="ej. le pareció cara tras perder su empleo / se molestó por un siniestro no cubierto / cambió de banco y falló el cargo..." />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                          <button className="btn-primary" disabled={polExp.saving || polExp.motivo === (policy.motivo_cancelacion || '')} onClick={savePolMotivo}>
                            {polExp.saving ? 'Guardando...' : 'Guardar motivo'}
                          </button>
                        </div>
                      </div>
                    )}

                    {policy?.crm_clients?.id && (
                      <>
                        <h3 style={{ fontSize: 14, margin: '4px 0 8px' }}>Notas de esta póliza</h3>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <textarea rows={2} style={{ flex: 1, padding: '9px 12px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                            placeholder="Qué dijo el cliente, qué sigue para rehabilitar/cobrar..."
                            value={polExp.nota} onChange={e => setPolExp(p => ({ ...p, nota: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addPolNota(); } }} />
                          <button className="btn-primary" disabled={!polExp.nota.trim()} onClick={addPolNota}><Plus size={15} /></button>
                        </div>
                        {(notes || []).length === 0 && <p className="empty">Sin notas de esta póliza aún.</p>}
                        {(notes || []).map(n => (
                          <div key={n.id} className="crm-file-row" style={{ alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="fname" style={{ whiteSpace: 'pre-wrap' }}>{String(n.texto).replace(`[Póliza ${numero}] `, '')}</div>
                              <div className="fmeta">{n.user_name || ''} · {new Date(n.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════════ TAB CONCILIACIÓN (vista de comisiones existente) ═══════════ */}
      {tab === 'conciliacion' && <CrmCommissionsView isAgency={isAgency} />}

      {/* ═══════════ TAB PROYECCIÓN DE INGRESOS A 1/2/3 AÑOS ═══════════ */}
      {tab === 'proyeccion' && detail && <ProyeccionIngresos detail={detail} />}
      {tab === 'proyeccion' && !detail && <p className="empty">Selecciona un agente en el Tablero PIR para proyectar sus ingresos.</p>}

      {/* ═══════════ TAB REHABILITACIONES ═══════════ */}
      {tab === 'rehab' && rehabBusy && !rehab && (
        <div className="loading-wrap"><div className="spinner" /><p>Cargando rehabilitaciones...</p></div>
      )}
      {tab === 'rehab' && rehabErr && !rehab && (
        <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red }}>
          <p style={{ margin: '0 0 8px' }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> No se pudo cargar Rehabilitaciones: {rehabErr}</p>
          <button className="btn-secondary" onClick={loadRehab}><RefreshCw size={14} /> Reintentar</button>
        </div>
      )}
      {tab === 'rehab' && rehab && (
        <RehabPanel data={rehab} isAgency={isAgency} busy={rehabBusy} onReload={loadRehab} openExpediente={openPolExpediente} />
      )}

      {/* ═══════════ TABLERO DE LA PROMOTORÍA (agregado, umbral 84%) ═══════════ */}
      {tab === 'tablero' && !selClave && isAgency && promo && (() => {
        const promoColor = (i) => (i >= 0.84 ? C.green : C.red);
        const seleccion = [...promo.accionables.pendientesPago, ...promo.accionables.rehabilitables].filter(p => promoSel[p.id]);
        const baseSel = seleccion.reduce((s, p) => s + p.monto, 0);
        const simulado = promo.indice.baseAConservar > 0
          ? (promo.indice.hoy.baseConservada + baseSel) / promo.indice.baseAConservar : 1;
        const toggleTodos = (lista, on) => setPromoSel(s => {
          const n = { ...s };
          for (const p of lista) { if (on) n[p.id] = true; else delete n[p.id]; }
          return n;
        });
        const diasBadge = (d) => (
          <span className="badge" style={{ background: d <= 30 ? C.redBg : d <= 90 ? C.amberBg : C.greenBg, color: d <= 30 ? C.red : d <= 90 ? C.amber : C.green }}>
            {d <= 0 ? 'vence hoy' : `quedan ${d} días`}
          </span>
        );
        const accionPromo = async (p, accion) => {
          const txt = accion === 'rehabilitar'
            ? `¿Marcar la póliza ${p.poliza} (${p.agente}) como rehabilitada? Sube el índice.`
            : `¿Registrar el cobro de la póliza ${p.poliza} (${p.agente})? Sube el índice.`;
          if (!window.confirm(txt)) return;
          try { await api.crmIngresosPoliza(p.id, accion); const np = await api.crmIngresosPromotoria(); setPromo(np); }
          catch (e) { alert(e.message); }
        };
        const fila = (p, tipo) => (
          <div key={`${tipo}${p.id}`} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '7px 0', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <input type="checkbox" style={{ accentColor: C.primary, cursor: 'pointer', flexShrink: 0 }} checked={!!promoSel[p.id]}
                onChange={e => setPromoSel(s => ({ ...s, [p.id]: e.target.checked || undefined }))} />
              <span style={{ minWidth: 0 }}>
                <b style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(11,27,51,.25)' }}
                  title="Ver expediente: motivo de cancelación y notas" onClick={() => openPolExpediente(p.id)}>{p.poliza}</b>{' '}
                <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span>
                <br /><span style={{ fontSize: 11, color: C.textMuted, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setSelClave(p.clave)} title="Abrir el tablero de este asesor">{p.agente}</span>
              </span>
            </span>
            <span style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span><b>{fmtMoney(p.monto)}</b> <span style={{ color: C.green, fontSize: 11 }}>+{pct(p.impacto_indice, 2)}</span></span>
              {tipo === 'r' && diasBadge(p.dias_restantes)}
              {isAgency && (
                <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={() => accionPromo(p, tipo === 'r' ? 'rehabilitar' : 'pago')}>
                  {tipo === 'r' ? <><RotateCcw size={11} /> Rehabilitar</> : <><HandCoins size={11} /> Cobrar</>}
                </button>
              )}
            </span>
          </div>
        );
        return (
          <>
            <div className="crm-chart-card">
              <h3><ShieldCheck size={16} style={{ verticalAlign: -2, color: C.gold }} /> Índice de conservación de la promotoría</h3>
              <p className="sub">
                Toda la cartera ({promo.agentes} asesores) · base a conservar {fmtMoneyFull(promo.indice.baseAConservar)} · conservada {fmtMoneyFull(promo.indice.hoy.baseConservada)} · pendiente {fmtMoneyFull(promo.indice.hoy.basePendiente)} · <b>mínimo promotoría 84%</b> (agentes 86%)
              </p>
              <IndiceBar actual={promo.indice.hoy.actual} operativo={promo.indice.siCobraTodo} marks={[0.84]} />
              <div className="crm-kpi-detail">
                <BonoCard icon={ShieldCheck} label="Índice al corte" value={<span style={{ color: promoColor(promo.indice.actual) }}>{pct(promo.indice.actual)}</span>} sub="oficial del último corte" />
                <BonoCard icon={RefreshCw} label="Índice hoy (en vivo)" value={<span style={{ color: promoColor(promo.indice.hoy.actual) }}>{pct(promo.indice.hoy.actual)}</span>} sub="con vencimientos posteriores al corte" />
                <BonoCard icon={TrendingUp} label="Si se cobra todo" value={<span style={{ color: promoColor(promo.indice.siCobraTodo) }}>{pct(promo.indice.siCobraTodo)}</span>} sub="cobrando todos los pendientes de pago" />
                <BonoCard icon={RotateCcw} label="Cobrando y rehabilitando todo" value={<span style={{ color: promoColor(promo.indice.siCobraYRehabilitaTodo) }}>{pct(promo.indice.siCobraYRehabilitaTodo)}</span>} sub="pendientes + canceladas aún rehabilitables" />
                <BonoCard icon={Target} label="Pólizas en el índice" value={promo.polizas.total}
                  sub={`${promo.polizas.conservadas} conservadas · ${promo.polizas.pendientes} por cobrar · ${promo.polizas.noConservadas} canceladas (${promo.polizas.rehabilitables} rehabilitables)`} />
              </div>
            </div>

            <div className="crm-chart-card">
              <h3><AlertTriangle size={16} style={{ verticalAlign: -2, color: C.amber }} /> Pendientes de pago y rehabilitables — simulador de la promotoría</h3>
              <p className="sub">
                Regla de rehabilitación: canceladas con <b>menos de 6 meses</b> aún se pueden rehabilitar (a los 5 meses 29 días todavía; a los 6 ya no).
                Selecciona pólizas (de cualquier asesor) y mira a cuánto se va el índice de la promotoría.
              </p>

              <div className="crm-kpi-detail" style={{ marginBottom: 14 }}>
                <BonoCard icon={Calculator} label="Índice simulado" value={<span style={{ color: promoColor(simulado) }}>{pct(simulado)}</span>}
                  sub={seleccion.length ? `${seleccion.length} pólizas seleccionadas · ${fmtMoney(baseSel)} de base · hoy está en ${pct(promo.indice.hoy.actual)}` : 'selecciona pólizas abajo'} />
                <BonoCard icon={Target} label="Contra el mínimo 84%" value={simulado >= 0.84 ? '✓ Arriba del mínimo' : `Faltan ${pct(Math.max(0, 0.84 - simulado))}`}
                  color={simulado >= 0.84 ? C.green : C.red}
                  sub={simulado >= 0.84 ? null : `≈ ${fmtMoney(Math.max(0, 0.84 * promo.indice.baseAConservar - promo.indice.hoy.baseConservada - baseSel))} de base por conservar`} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 13.5 }}>Pendientes de pago ({promo.accionables.pendientesPago.length})</h4>
                    <span>
                      <button className="f-tab" style={{ fontSize: 11 }} onClick={() => toggleTodos(promo.accionables.pendientesPago, true)}>Todas</button>
                      <button className="f-tab" style={{ fontSize: 11 }} onClick={() => toggleTodos(promo.accionables.pendientesPago, false)}>Ninguna</button>
                    </span>
                  </div>
                  {promo.accionables.pendientesPago.length === 0 && <p className="empty">Nada pendiente 🎉</p>}
                  {promo.accionables.pendientesPago.slice(0, 15).map(p => fila(p, 'p'))}
                  {promo.accionables.pendientesPago.length > 15 && <p className="sub" style={{ marginTop: 6 }}>…y {promo.accionables.pendientesPago.length - 15} más (usa "Todas" para incluirlas en la simulación).</p>}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 13.5 }}>Rehabilitables ({promo.accionables.rehabilitables.length})</h4>
                    <span>
                      <button className="f-tab" style={{ fontSize: 11 }} onClick={() => toggleTodos(promo.accionables.rehabilitables, true)}>Todas</button>
                      <button className="f-tab" style={{ fontSize: 11 }} onClick={() => toggleTodos(promo.accionables.rehabilitables, false)}>Ninguna</button>
                    </span>
                  </div>
                  {promo.accionables.rehabilitables.length === 0 && <p className="empty">Sin canceladas recientes</p>}
                  {promo.accionables.rehabilitables.slice(0, 15).map(p => fila(p, 'r'))}
                  {promo.accionables.rehabilitables.length > 15 && <p className="sub" style={{ marginTop: 6 }}>…y {promo.accionables.rehabilitables.length - 15} más (ordenadas por urgencia: las que están por vencer primero).</p>}
                </div>
              </div>
            </div>
          </>
        );
      })()}

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

          {/* ── Proyección al cierre del trimestre ── */}
          {detail.proyeccion?.cierreQ && (
            <div className="crm-chart-card">
              <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.gold }} /> Proyección al cierre del trimestre — {fmtDate(detail.proyeccion.cierreQ.fecha)}</h3>
              <p className="sub">Cómo termina el trimestre si no se cobra nada de aquí al cierre — y qué pólizas vencen en el camino.</p>
              <div className="crm-kpi-detail">
                <BonoCard icon={AlertTriangle} label="Índice al cierre sin cobrar" value={<span style={{ color: indiceColor(detail.proyeccion.cierreQ.actual) }}>{pct(detail.proyeccion.cierreQ.actual)}</span>} sub={idx.hoy ? `hoy está en ${pct(idx.hoy.actual)}` : null} color={detail.proyeccion.cierreQ.actual < 0.86 ? C.red : C.amber} />
                <BonoCard icon={RotateCcw} label="Vencen antes del cierre" value={detail.proyeccion.cierreQ.vencenAntes.length} sub={detail.proyeccion.cierreQ.vencenAntes.length ? `${fmtMoney(detail.proyeccion.cierreQ.vencenAntes.reduce((s, p) => s + p.monto, 0))} de base en riesgo` : 'ninguna póliza vence en el periodo'} />
                <BonoCard icon={TrendingUp} label="Si se cobra todo" value={<span style={{ color: indiceColor(detail.proyeccion.cierreQ.conPendiente) }}>{pct(detail.proyeccion.cierreQ.conPendiente)}</span>} sub="cerrando pendientes y vencimientos" />
              </div>
              {detail.proyeccion.cierreQ.actual < 0.86 && detail.proyeccion.cierreQ.conPendiente >= 0.86 && (
                <p className="sub" style={{ color: C.amber }}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Sin cobrar se pierde la banda de bonos; cobrando lo pendiente se rescata.</p>
              )}
              {detail.proyeccion.cierreQ.vencenAntes.slice(0, 6).map(p => (
                <div key={p.id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '7px 0' }}>
                  <span>Póliza <b>{p.poliza}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id} · vence {fmtDate(p.pagado_hasta)} · {p.frecuencia_pago || ''}</span></span>
                  <b>{fmtMoney(p.monto)} <span style={{ color: C.red, fontSize: 11 }}>−{pct(p.impacto_indice, 1)}</span></b>
                </div>
              ))}
            </div>
          )}

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
            <p className="sub">
              ¿Qué pasa con tu índice y tus bonos si vendes más, cobras lo pendiente o rehabilitas canceladas?
              El punto de partida ya asume cobrados los pendientes de pago (así arma Prudential el preliminar del trimestre),
              por eso palomearlos confirma ese escenario sin volver a sumarlos — lo que mueve la aguja son las <b>rehabilitaciones</b> y la <b>venta nueva</b>.
            </p>

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
                        <td style={{ cursor: 'pointer' }} title="Ver expediente y notas" onClick={() => openPolExpediente(p.id)}>
                          <b style={{ textDecoration: 'underline', textDecorationColor: 'rgba(11,27,51,.25)' }}>{p.poliza}</b>{' '}
                          <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span>
                        </td>
                        <td><span className="badge" style={{ background: C.amberBg, color: C.amber }}>Cobrar pendiente</span></td>
                        <td>{fmtMoney(p.monto)}</td>
                        <td style={{ color: C.green }}>+{pct(p.impacto_indice, 1)}</td>
                      </tr>
                    ))}
                    {detail.accionables.rehabilitables.map(p => (
                      <tr key={`r${p.id}`}>
                        <td><input type="checkbox" style={{ accentColor: C.primary, cursor: 'pointer' }} checked={simSel[p.id] === 'rehabilitar'}
                          onChange={e => setSimSel(s => ({ ...s, [p.id]: e.target.checked ? 'rehabilitar' : undefined }))} /></td>
                        <td style={{ cursor: 'pointer' }} title="Ver expediente: por qué se canceló y notas" onClick={() => openPolExpediente(p.id)}>
                          <b style={{ textDecoration: 'underline', textDecorationColor: 'rgba(11,27,51,.25)' }}>{p.poliza}</b>{' '}
                          <span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span>
                        </td>
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

      {/* ── Trayectoria a 15 meses ── */}
      {tab === 'simulador' && detail && (
        <div className="crm-chart-card">
          <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.gold }} /> Trayectoria del índice — ¿cuándo cruzo la banda?</h3>
          <p className="sub">La ventana del índice solo crece y las canceladas no salen de ella: solo el negocio nuevo conservado lo recupera. El modelo asume que vienes vendiendo al mismo ritmo desde hace 15 meses (ese es el negocio que irá madurando a la ventana mes con mes).</p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 190 }}>
              <label>Venta mensual (prima $)</label>
              <input type="number" min="0" placeholder="ritmo actual" value={trayVenta} onChange={e => setTrayVenta(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Conservación del negocio nuevo (%)</label>
              <input type="number" min="1" max="100" placeholder="histórico" value={trayTasa} onChange={e => setTrayTasa(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', paddingBottom: 9 }}>
              <input type="checkbox" style={{ accentColor: C.primary }} checked={trayCobra} onChange={e => setTrayCobra(e.target.checked)} />
              Cobrando los pendientes actuales
            </label>
            <button className="btn-primary" disabled={trayBusy} onClick={runTrayectoria}><TrendingUp size={15} /> {trayBusy ? 'Proyectando...' : 'Proyectar'}</button>
          </div>

          {tray && (
            <>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={tray.serie} margin={{ top: 8, right: 42, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,27,51,.08)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis domain={[dataMin => Math.max(0, Math.floor(dataMin * 10) / 10 - 0.1), 1]} tickFormatter={v => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => pct(v)} labelFormatter={l => `Mes ${l}`} />
                    <ReferenceLine y={0.86} stroke={C.amber} strokeDasharray="4 4" label={{ value: '86%', fontSize: 10, fill: C.amber, position: 'right' }} />
                    <ReferenceLine y={0.90} stroke="#0891B2" strokeDasharray="4 4" label={{ value: '90%', fontSize: 10, fill: '#0891B2', position: 'right' }} />
                    <ReferenceLine y={0.94} stroke={C.green} strokeDasharray="4 4" label={{ value: '94%', fontSize: 10, fill: C.green, position: 'right' }} />
                    <Line type="monotone" dataKey="indice" stroke={C.gold} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="crm-kpi-detail" style={{ marginTop: 10 }}>
                <BonoCard icon={Target} label="Cruza el 86%" value={tray.cruces['0.86'] || 'No en el horizonte'} color={tray.cruces['0.86'] ? C.amber : C.red} sub={tray.cruces['0.86'] ? 'vuelve a cobrar bonos' : 'sube venta o conservación'} />
                <BonoCard icon={Target} label="Cruza el 90%" value={tray.cruces['0.90'] || 'No en el horizonte'} color={tray.cruces['0.90'] ? '#0891B2' : C.red} />
                <BonoCard icon={Target} label="Cruza el 94%" value={tray.cruces['0.94'] || 'No en el horizonte'} color={tray.cruces['0.94'] ? C.green : C.red} sub={tray.cruces['0.94'] ? 'banda máxima de bonos' : null} />
              </div>
              <p className="sub" style={{ marginTop: 6 }}>Supuestos: venta {fmtMoneyFull(tray.supuestos.ventaMensual)}/mes · conservación del nuevo {pct(tray.supuestos.tasaConservacion, 0)} · {tray.supuestos.cobrarPendientes ? 'cobrando' : 'sin cobrar'} los pendientes actuales.</p>
            </>
          )}
        </div>
      )}

      {tab === 'simulador' && !detail && <p className="empty">Selecciona un agente en el Tablero PIR para simular.</p>}
    </div>
  );
}
