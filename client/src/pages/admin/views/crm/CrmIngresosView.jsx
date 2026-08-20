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
  Users, TrendingDown, Filter, Search, Award, Flame, Trophy,
} from 'lucide-react';
import { getCrmCSS, fmtMoney, fmtMoneyFull, fmtDate, MESES } from './crmShared';
import CrmCommissionsView from './CrmCommissionsView';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, ComposedChart, Bar, Area, AreaChart, Legend, Cell } from 'recharts';

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

function BonoCard({ icon: Icon, label, value, sub, color, onClick, active }) {
  return (
    <div className="crm-kpi-box" onClick={onClick}
      style={onClick ? { cursor: 'pointer', boxShadow: active ? `inset 0 0 0 2px ${color || C.gold}` : undefined, transition: 'box-shadow .15s' } : undefined}>
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
  const perAsesor = data.scope === 'asesor';
  const [cfgOpen, setCfgOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [grupo, setGrupo] = useState('todas');   // todas | auto | urgentes | vencidas
  const [fAsesor, setFAsesor] = useState('');     // clave
  const [fPoliza, setFPoliza] = useState('');
  const [fEtapa, setFEtapa] = useState('');
  const [fUrg, setFUrg] = useState('');
  const [actId, setActId] = useState(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const esVencidas = grupo === 'vencidas';
  const agentesLista = [...new Map([...rehabilitables, ...vencidas.lista].map(r => [r.clave, r.agente])).entries()]
    .map(([clave, agente]) => ({ clave, agente })).sort((a, b) => String(a.agente).localeCompare(String(b.agente)));
  const agenteSel = agentesLista.find(a => a.clave === fAsesor);

  const base = esVencidas ? vencidas.lista
    : grupo === 'auto' ? rehabilitables.filter(r => r.automatizable)
      : grupo === 'urgentes' ? rehabilitables.filter(r => r.urgencia === 'EXTREMA' || r.urgencia === 'ALTA')
        : rehabilitables;
  const filtrados = base.filter(r =>
    (!fAsesor || r.clave === fAsesor) &&
    (!fPoliza || `${r.poliza} ${r.plan_id || ''}`.toLowerCase().includes(fPoliza.toLowerCase())) &&
    (!fEtapa || r.etapa === fEtapa) &&
    (!fUrg || r.urgencia === fUrg));
  const sum = {
    total: filtrados.length, monto: filtrados.reduce((s, r) => s + r.monto, 0),
    auto: filtrados.filter(r => r.etapa === 'AUTOMATICA').length,
    correo: filtrados.filter(r => r.etapa === 'CORREO').length,
    firma: filtrados.filter(r => r.etapa === 'FIRMA').length,
    extremas: filtrados.filter(r => r.urgencia === 'EXTREMA').length,
    altas: filtrados.filter(r => r.urgencia === 'ALTA').length,
  };
  const hayFiltro = fPoliza || fEtapa || fUrg;

  const marcar = async (r, accion) => {
    if (!window.confirm(`¿Marcar la póliza ${r.poliza} (${r.agente}) como rehabilitada?`)) return;
    setActId(r.id);
    try { await api.crmIngresosPoliza(r.id, accion); await onReload(); }
    catch (e) { alert(e.message); } finally { setActId(null); }
  };

  const enviarAlertas = async () => {
    if (!window.confirm('¿Enviar por correo el resumen de rehabilitaciones (PDF con logo) a cada asesor + digest a la promotoría?')) return;
    setSending(true); setAlertMsg('');
    try {
      const r = await api.crmIngresosRehabAlerts();
      setAlertMsg(r.ok ? `✅ Enviado: ${r.enviados.length} asesor(es), digest a ${r.digestDestinatarios}.${r.fallidos?.length ? ` Fallidos: ${r.fallidos.length} (¿EMAIL_USER/PASS en Railway?).` : ''}` : `Omitido: ${r.skipped}`);
    } catch (e) { setAlertMsg('Error: ' + e.message); }
    finally { setSending(false); }
  };

  const enviarResumen = async () => {
    if (!fAsesor) return;
    const dest = emailTo.trim();
    if (!window.confirm(`¿Enviar el resumen ejecutivo (PDF) de ${agenteSel?.agente} — ${sum.total} pólizas · ${fmtMoney(sum.monto)}${dest ? ` a ${dest}` : ' al correo del asesor'}?`)) return;
    setEmailBusy(true); setEmailMsg('');
    try {
      const r = await api.crmIngresosRehabAlerts({ clave: fAsesor, incluirTodas: true, ...(dest ? { to: dest } : {}) });
      setEmailMsg(r.ok
        ? (r.enviados.length ? `✅ Resumen enviado.` : `No se envió: ${(r.sinAccionOSinCorreo || []).join(', ') || 'sin correo/pólizas'}${r.fallidos?.length ? ' · ' + r.fallidos.join('; ') : ''}`)
        : `Omitido: ${r.skipped}`);
    } catch (e) { setEmailMsg('Error: ' + e.message); }
    finally { setEmailBusy(false); }
  };

  const verPDF = async () => {
    if (!fAsesor) return;
    try { window.open(await api.crmIngresosRehabPdfUrl(fAsesor), '_blank'); }
    catch (e) { alert(e.message); }
  };

  const cards = [
    { g: 'todas', icon: RotateCcw, label: 'Rehabilitables', value: resumen.total, sub: fmtMoney(resumen.monto) + ' en riesgo', color: C.gold },
    { g: 'auto', icon: Zap, label: 'Automáticas (0–30d)', value: resumen.automatizables, sub: 'sin trámite del cliente', color: C.green },
    { g: 'urgentes', icon: AlertTriangle, label: 'Extremas + urgentes', value: (resumen.por_urgencia.EXTREMA || 0) + (resumen.por_urgencia.ALTA || 0), sub: `${resumen.por_urgencia.EXTREMA || 0} extremas · ${resumen.por_urgencia.ALTA || 0} urgentes`, color: C.red },
    { g: 'vencidas', icon: X, label: 'Vencidas (+180d)', value: vencidas.total, sub: fmtMoney(vencidas.monto) + ' perdidas', color: C.ink },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: '0 0 2px' }}><RotateCcw size={17} style={{ verticalAlign: -3, color: C.gold }} /> Rehabilitaciones {perAsesor ? '(tu cartera)' : '(promotoría)'}</h3>
          <p className="sub" style={{ margin: 0 }}>El plazo corre desde la cancelación: <b>0–30d</b> automática · <b>30–90d</b> con correo · <b>90–180d</b> con firma · <b>+180d</b> se pierde.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAgency && <button className="btn-secondary" onClick={() => setCfgOpen(true)}><Settings size={15} /> PERSONALIZA</button>}
          {isAgency && <button className="btn-secondary" onClick={enviarAlertas} disabled={sending}><Send size={15} /> {sending ? 'Enviando…' : 'Enviar a todos'}</button>}
          <button className="btn-secondary" onClick={onReload} disabled={busy}><RefreshCw size={15} /></button>
        </div>
      </div>

      {!personaliza_configurado && isAgency && (
        <div className="info-box" style={{ background: '#FEF3C7', borderColor: '#F59E0B40', color: '#92400E', margin: '8px 0' }}>
          <p style={{ margin: 0 }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> No has configurado los planes <b>PERSONALIZA</b> (ventana de 30 días). Configúralos con el botón <b>PERSONALIZA</b>.</p>
        </div>
      )}
      {alertMsg && <div className="info-box" style={{ margin: '8px 0' }}><p style={{ margin: 0 }}>{alertMsg}</p></div>}

      {/* Tarjetas clicables → filtran la tabla */}
      <div className="crm-kpi-detail" style={{ margin: '12px 0' }}>
        {cards.map(c => (
          <BonoCard key={c.g} icon={c.icon} label={c.label} value={c.value} sub={c.sub} color={c.color}
            active={grupo === c.g} onClick={() => setGrupo(c.g)} />
        ))}
      </div>

      {/* Selector de asesor + resumen ejecutivo + envío */}
      {!perAsesor && (
        <div className="crm-chart-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 240 }}>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Asesor</label>
              <select className="crm-select" value={fAsesor} onChange={e => { setFAsesor(e.target.value); setEmailMsg(''); }} style={{ minWidth: 260 }}>
                <option value="">Todos los asesores</option>
                {agentesLista.map(a => <option key={a.clave} value={a.clave}>{a.agente} ({a.clave})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5 }}>
              <span><b style={{ fontSize: 18, color: C.ink }}>{sum.total}</b> pólizas</span>
              <span><b style={{ fontSize: 18, color: C.ink }}>{fmtMoney(sum.monto)}</b> en riesgo</span>
              <span style={{ alignSelf: 'center' }}><Zap size={12} color={C.green} /> {sum.auto} · <Mail size={12} /> {sum.correo} · <PenTool size={12} /> {sum.firma}</span>
              {(sum.extremas + sum.altas > 0) && <span style={{ alignSelf: 'center', color: C.red, fontWeight: 700 }}>{sum.extremas} extremas · {sum.altas} altas</span>}
            </div>
          </div>
          {fAsesor && (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(11,27,51,.08)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="sub" style={{ marginRight: 4 }}>Resumen ejecutivo de <b>{agenteSel?.agente}</b>:</span>
              <button className="btn-secondary" onClick={verPDF}><PenTool size={14} /> Ver PDF</button>
              <input className="crm-input" style={{ maxWidth: 260, padding: '7px 10px' }} placeholder="correo destino (opcional; por defecto el del asesor)" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              {isAgency && <button className="btn-primary" onClick={enviarResumen} disabled={emailBusy}><Send size={14} /> {emailBusy ? 'Enviando…' : 'Enviar resumen (PDF)'}</button>}
              {emailMsg && <span className="sub" style={{ color: emailMsg.startsWith('✅') ? C.green : C.red }}>{emailMsg}</span>}
            </div>
          )}
        </div>
      )}

      {base.length === 0 && <p className="empty">{esVencidas ? 'Sin pólizas vencidas.' : 'No hay canceladas rehabilitables. 🎉'}</p>}

      {base.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px' }}>
            <span className="sub">{filtrados.length} de {base.length} · {fmtMoney(filtrados.reduce((s, r) => s + r.monto, 0))}{esVencidas ? ' (perdidas)' : ''}</span>
            {(hayFiltro || fAsesor || grupo !== 'todas') && <button className="f-tab" style={{ fontSize: 11 }} onClick={() => { setFAsesor(''); setFPoliza(''); setFEtapa(''); setFUrg(''); setGrupo('todas'); }}>Limpiar filtros</button>}
          </div>
          <table>
            <thead>
              <tr>
                {!perAsesor && <th style={{ textAlign: 'left' }}>Asesor</th>}
                <th style={{ textAlign: 'left' }}>Póliza</th>
                <th style={{ textAlign: 'left' }}>Etapa</th>
                <th style={{ textAlign: 'left' }}>Urgencia</th>
                <th style={{ textAlign: 'right' }}>Cancelada hace</th>
                <th style={{ textAlign: 'right' }}>{esVencidas ? '' : 'Vence etapa'}</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                {isAgency && !esVencidas && <th></th>}
              </tr>
              <tr>
                {!perAsesor && <th style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>{fAsesor ? (agenteSel?.agente || '') : 'todos'}</th>}
                <th><input className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} placeholder="póliza/plan…" value={fPoliza} onChange={e => setFPoliza(e.target.value)} /></th>
                <th><select className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} value={fEtapa} onChange={e => setFEtapa(e.target.value)}>
                  <option value="">todas</option><option value="AUTOMATICA">Automática</option><option value="CORREO">Con correo</option><option value="FIRMA">Con firma</option>
                </select></th>
                <th><select className="crm-input" style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 400 }} value={fUrg} onChange={e => setFUrg(e.target.value)}>
                  <option value="">todas</option><option value="EXTREMA">Extrema</option><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
                </select></th>
                <th></th><th></th><th></th>{isAgency && !esVencidas && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(r => (
                <tr key={r.id}>
                  {!perAsesor && <td style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => openExpediente(r.id)}>{r.agente}</td>}
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5, cursor: 'pointer' }} onClick={() => openExpediente(r.id)}>{r.poliza} <span style={{ opacity: 0.5 }}>{r.plan_id}</span></td>
                  <td style={{ cursor: 'pointer' }} onClick={() => openExpediente(r.id)}>{esVencidas ? <span className="sub">Vencida</span> : <EtapaBadge e={r.etapa} />}</td>
                  <td><UrgBadge u={r.urgencia} /></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_desde_cancelacion}d</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.dias_para_vencer_etapa <= 7 ? C.red : r.dias_para_vencer_etapa <= 20 ? '#B45309' : C.ink }}>{esVencidas ? '—' : `${r.dias_para_vencer_etapa}d`}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.monto)}</td>
                  {isAgency && !esVencidas && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} disabled={actId === r.id} title="Marcar rehabilitada"
                        onClick={() => marcar(r, 'rehabilitar')}><RotateCcw size={13} /> {actId === r.id ? '…' : 'Rehabilitar'}</button>
                    </td>
                  )}
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={9}><p className="empty" style={{ margin: 8 }}>Ninguna coincide con los filtros.</p></td></tr>}
            </tbody>
          </table>
        </>
      )}

      {cfgOpen && <RehabConfigEditor onClose={() => setCfgOpen(false)} onSaved={onReload} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODELO A FUTURO de la promotoría: producción a través de los asesores,
   asesores estrella, diagnóstico (qué está fallando), comparativa por trimestre
   y proyección al cierre de año / próximos años. Consume /ingresos/forecast.
   ═══════════════════════════════════════════════════════════════════════════ */
const MESES_MINI = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const SEV = {
  alta: { c: C.red, bg: C.redBg, t: 'Crítico', Icon: AlertTriangle },
  media: { c: '#B45309', bg: '#FEF3C7', t: 'Atención', Icon: TrendingDown },
  baja: { c: '#0E7490', bg: '#CFFAFE', t: 'Nota', Icon: Sparkles },
};

function PromotoriaForecast() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [g, setG] = useState('10');     // crecimiento anual % (editable)
  const [cons, setCons] = useState(''); // conservación % (editable, default backend)

  useEffect(() => {
    api.crmIngresosForecast()
      .then(r => { setD(r); setCons(String(Math.round((r.indicePromo?.conPendiente || 0.85) * 100))); })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="info-box" style={{ background: C.redBg, borderColor: `${C.red}40`, color: C.red }}><p>{err}</p></div>;
  if (!d) return <p className="empty">Cargando modelo a futuro de la promotoría…</p>;

  const ca = d.cierreAnio, ip = d.indicePromo, anio = d.anioActual;
  const sufAnio = `'${String(anio).slice(2)}`;

  /* Serie de producción: real + meses futuros al ritmo del último trimestre completo */
  const ultMes = d.produccionMensual.length ? d.produccionMensual[d.produccionMensual.length - 1].mes : 0;
  const serieProd = d.produccionMensual.map(m => ({ label: m.label, nueva: m.nueva, renov: m.renov, meta: m.meta || null }));
  for (let m = ultMes + 1; m <= 12; m++) serieProd.push({ label: `${MESES_MINI[m - 1]} ${sufAnio}`, nuevaProy: ca.mensualTrimNueva, renovProy: ca.mensualTrimRenov, proy: true });

  /* Trayectoria de índice: cerrados (sólido) + en curso realista + proyección cierre (punteado) */
  const serieIdx = d.indiceHist.map((h, i, arr) => ({
    label: h.periodo,
    indice: h.enCurso ? null : h.indice,
    realista: h.enCurso ? h.indiceRealista : (i === arr.length - 2 ? h.indice : null),
    crudo: h.enCurso ? h.indice : null,
  }));
  serieIdx.push({ label: `Cierre ${anio}`, realista: ip.conPendiente, techo: ip.techo });

  /* Modelo multi-año (producción): venta nueva crece g%, cartera renovación
     sobrevive a la tasa de conservación y se apila año con año. */
  const gr = (Number(g) || 0) / 100, rr = Math.min(1, Math.max(0, (Number(cons) || 0) / 100));
  const Vbase = ca.proyNuevaAnio, cartBase = ca.proyRenovAnio;
  const years = [0, 1, 2, 3].map(k => {
    const nueva = Vbase * Math.pow(1 + gr, k);
    let cartera = cartBase * Math.pow(rr, k);
    for (let j = 1; j <= k; j++) cartera += Vbase * Math.pow(1 + gr, j - 1) * Math.pow(rr, k - j + 1);
    return { anio: anio + k, nueva, cartera, total: nueva + cartera, esActual: k === 0 };
  });

  const tendUp = d.tendenciaIndice >= 0;
  const chartTip = { contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid rgba(11,27,51,.12)' } };

  return (
    <>
      {/* ── Titular + KPIs de cierre de año ── */}
      <div className="crm-chart-card">
        <h3><TrendingUp size={16} style={{ verticalAlign: -2, color: C.gold }} /> Modelo a futuro de la promotoría — {d.activos} asesores activos</h3>
        <p className="sub">
          Al ritmo actual (<b>{fmtMoneyFull(ca.mensualTrimNueva)}/mes</b> de prima nueva, base {ca.trimBaseLabel}), esto es lo que produces a través de tus asesores,
          cómo cierras el año y a dónde llega tu índice. Llevas <b>{ca.mesesConDatos}/12</b> meses de {anio}.
        </p>
        <div className="crm-kpi-detail">
          <BonoCard icon={Target} label={`Venta nueva proyectada ${anio}`} value={fmtMoneyFull(ca.proyNuevaAnio)}
            sub={`vas en ${fmtMoneyFull(ca.ytdNueva)} · faltan ${ca.mesesRestantes} meses`} color={C.gold} />
          <BonoCard icon={RotateCcw} label={`Renovación proyectada ${anio}`} value={fmtMoneyFull(ca.proyRenovAnio)}
            sub={`cartera anualizada`} color={C.primary} />
          <BonoCard icon={ShieldCheck} label="Índice realista hoy" value={<span style={{ color: indiceColor(ip.conPendiente) }}>{pct(ip.conPendiente)}</span>}
            sub={`crudo ${pct(ip.actual, 0)} · techo ${pct(ip.techo, 0)} cobrando y rehabilitando`} color={indiceColor(ip.conPendiente)} />
          <BonoCard icon={tendUp ? TrendingUp : TrendingDown} label="Tendencia del índice"
            value={<span style={{ color: tendUp ? C.green : C.red }}>{tendUp ? '+' : ''}{(d.tendenciaIndice * 100).toFixed(1)} pts</span>}
            sub="vs. trimestre cerrado anterior" color={tendUp ? C.green : C.red} />
        </div>
      </div>

      {/* ── Producción mensual: real + proyectada ── */}
      <div className="crm-chart-card">
        <h4 style={{ margin: '0 0 2px' }}>Producción mensual — real y proyectada al cierre de {anio}</h4>
        <p className="sub" style={{ marginTop: 0 }}>Barras sólidas = cobrado; tenue = proyección al ritmo del último trimestre completo. Línea = meta capturada.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serieProd} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,27,51,.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...chartTip} formatter={(v, n) => [fmtMoneyFull(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="nueva" name="Nueva" stackId="r" fill={C.gold} radius={[0, 0, 0, 0]} />
            <Bar dataKey="renov" name="Renovación" stackId="r" fill={C.primary} />
            <Bar dataKey="nuevaProy" name="Nueva (proy.)" stackId="p" fill={`${C.gold}66`} />
            <Bar dataKey="renovProy" name="Renov. (proy.)" stackId="p" fill={`${C.primary}55`} />
            <Line dataKey="meta" name="Meta" stroke={C.red} strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trayectoria del índice + proyección de cierre ── */}
      <div className="crm-chart-card">
        <h4 style={{ margin: '0 0 2px' }}>¿A qué índice cierro el año?</h4>
        <p className="sub" style={{ marginTop: 0 }}>
          Trimestres cerrados (línea sólida) llegaron a ~86–87%. El trimestre en curso está en {pct(ip.actual, 0)} crudo pero
          su nivel realista con pendientes es <b style={{ color: indiceColor(ip.conPendiente) }}>{pct(ip.conPendiente)}</b>; el punteado proyecta el cierre.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={serieIdx} margin={{ top: 8, right: 16, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,27,51,.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0.3, 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <Tooltip {...chartTip} formatter={(v, n) => [v == null ? '—' : pct(v), n]} />
            <ReferenceLine y={0.86} stroke={C.amber} strokeDasharray="4 4" label={{ value: 'Bono 86%', fontSize: 10, fill: C.amber, position: 'right' }} />
            <ReferenceLine y={0.84} stroke={C.red} strokeDasharray="4 4" label={{ value: 'Prom. 84%', fontSize: 10, fill: C.red, position: 'right' }} />
            <Line dataKey="indice" name="Cerrado" stroke={C.primary} strokeWidth={2.5} connectNulls dot={{ r: 4 }} />
            <Line dataKey="realista" name="Realista / proyectado" stroke={C.green} strokeWidth={2.5} strokeDasharray="6 4" connectNulls dot={{ r: 4 }} />
            <Line dataKey="techo" name="Techo (cobrando+rehab)" stroke="#0891B2" strokeWidth={2} strokeDasharray="2 3" connectNulls dot={{ r: 3 }} />
            <Line dataKey="crudo" name="Crudo (en curso)" stroke={C.red} strokeWidth={0} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Diagnóstico: qué está fallando ── */}
      {d.diagnostico.length > 0 && (
        <div className="crm-chart-card">
          <h4 style={{ margin: '0 0 8px' }}><AlertTriangle size={15} style={{ verticalAlign: -2, color: C.amber }} /> Qué está fallando</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {d.diagnostico.map((x, i) => {
              const s = SEV[x.severidad] || SEV.media; const Ic = s.Icon;
              return (
                <div key={i} style={{ border: `1px solid ${s.c}40`, background: s.bg, borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <Ic size={15} color={s.c} />
                    <b style={{ fontSize: 13, color: s.c }}>{x.titulo}</b>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: s.c, textTransform: 'uppercase' }}>{s.t}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{x.detalle}</div>
                  {x.nombres?.length > 0 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{x.nombres.join(' · ')}{x.valor > x.nombres.length ? ' …' : ''}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Asesores estrella + leaderboard ── */}
      <div className="crm-chart-card">
        <h4 style={{ margin: '0 0 8px' }}><Trophy size={15} style={{ verticalAlign: -2, color: C.gold }} /> Asesores estrella y rendimiento</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
          {d.estrellas.map((e, i) => (
            <div key={e.clave} style={{ border: `1px solid ${i === 0 ? C.gold : 'rgba(11,27,51,.12)'}`, borderRadius: 10, padding: '10px 12px', background: i === 0 ? `${C.gold}0D` : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted }}>
                {i === 0 ? <Award size={13} color={C.gold} /> : <Users size={12} />} #{i + 1}{e.es_nuevo ? ' · nuevo' : ''}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, margin: '3px 0', lineHeight: 1.2 }}>{e.nombre}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{fmtMoney(e.nueva)}</div>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>{pct(e.aporte, 0)} del total · índice <span style={{ color: indiceColor(e.conPendiente) }}>{pct(e.conPendiente, 0)}</span></div>
            </div>
          ))}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#</th><th>Asesor</th><th>Cuaderno</th><th>Mes</th><th style={{ textAlign: 'right' }}>Nueva Q</th><th style={{ textAlign: 'right' }}>Aporte</th><th style={{ textAlign: 'right' }}>Índice</th><th style={{ textAlign: 'right' }}>Bonos Q</th><th style={{ textAlign: 'center' }}>Estado</th></tr></thead>
            <tbody>
              {d.leaderboard.map((a, i) => {
                const foco = d.focos.find(f => f.clave === a.clave);
                return (
                  <tr key={a.clave} style={foco ? { background: `${C.red}08` } : undefined}>
                    <td>{i + 1}</td>
                    <td><b>{a.nombre}</b>{a.es_nuevo && <span style={{ fontSize: 10, color: C.primary, marginLeft: 5 }}>nuevo</span>}</td>
                    <td style={{ fontSize: 11.5, color: C.textMuted }}>{a.cuaderno || '—'}</td>
                    <td>{a.mes_agente}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: a.nueva > 0 ? 700 : 400, color: a.nueva > 0 ? C.ink : C.textLight }}>{fmtMoney(a.nueva)}</td>
                    <td style={{ textAlign: 'right', color: C.textMuted }}>{pct(a.aporte, 0)}</td>
                    <td style={{ textAlign: 'right', color: indiceColor(a.conPendiente), fontWeight: 600 }}>{a.conPendiente > 0 ? pct(a.conPendiente, 0) : '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.bonos > 0 ? C.green : C.textLight }}>{a.bonos > 0 ? fmtMoney(a.bonos) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {foco
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: C.red, background: C.redBg, padding: '2px 7px', borderRadius: 10 }}>{foco.motivo}</span>
                        : a.conPendiente >= 0.86 && a.nueva > 0
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: '#DCFCE7', padding: '2px 7px', borderRadius: 10 }}>OK</span>
                          : <span style={{ fontSize: 10, color: C.textLight }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comparativa por trimestre ── */}
      <div className="crm-chart-card">
        <h4 style={{ margin: '0 0 2px' }}>Comparativa por trimestre</h4>
        <p className="sub" style={{ marginTop: 0 }}>Prima nueva vs. renovación por trimestre. Sirve para ver el ritmo trimestre contra trimestre (y año contra año conforme se acumulen cortes).</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={d.comparativaTrim} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,27,51,.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...chartTip} formatter={(v, n) => [fmtMoneyFull(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="nueva" name="Nueva" fill={C.gold} />
            <Bar dataKey="renov" name="Renovación" fill={C.primary} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Proyección multi-año (editable) ── */}
      <div className="crm-chart-card">
        <h4 style={{ margin: '0 0 2px' }}>¿Cuánto puedo producir en los próximos años?</h4>
        <p className="sub" style={{ marginTop: 0 }}>Parte de la venta proyectada de {anio} ({fmtMoneyFull(Vbase)}). Ajusta el crecimiento y la conservación: la cartera de renovación se apila cada año que conservas.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Crecimiento anual de venta</label>
            <div style={{ position: 'relative' }}><input type="number" value={g} onChange={e => setG(e.target.value)} /><span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMuted }}>%</span></div>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Conservación de cartera</label>
            <div style={{ position: 'relative' }}><input type="number" value={cons} onChange={e => setCons(e.target.value)} /><span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMuted }}>%</span></div>
          </div>
        </div>
        <div className="crm-kpi-detail" style={{ marginBottom: 14 }}>
          {years.map(y => (
            <div key={y.anio} className="crm-kpi-box" style={{ borderTop: `3px solid ${y.esActual ? C.textMuted : C.green}` }}>
              <div className="k-label">{y.anio}{y.esActual ? ' (proy. cierre)' : ''}</div>
              <div className="k-value" style={{ color: C.green }}>{fmtMoneyFull(Math.round(y.total))}</div>
              <div className="k-sub">producción total del año</div>
            </div>
          ))}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Año</th><th style={{ textAlign: 'right' }}>Venta nueva</th><th style={{ textAlign: 'right' }}>Cartera en renovación</th><th style={{ textAlign: 'right' }}>Producción total</th></tr></thead>
            <tbody>
              {years.map(y => (
                <tr key={y.anio}>
                  <td><b>{y.anio}</b></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(y.nueva)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(y.cartera)}</td>
                  <td style={{ textAlign: 'right' }}><b style={{ color: C.green }}>{fmtMoneyFull(Math.round(y.total))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.textLight, margin: '10px 0 0' }}>
          Estimación de producción (prima), no de comisión. La cartera crece con las generaciones nuevas que conservas; sube la conservación para ver el efecto de retener cartera.
        </p>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMULADOR DINÁMICO de la promotoría: el índice vive arriba (sticky) y sube en
   vivo conforme arrastras/agregas cobros y rehabilitaciones; gráfica acumulada,
   filtros de fecha/urgencia/búsqueda y colores por importancia. El índice se
   recalcula 100% en el cliente (índice = (conservada_hoy + Σ montos) / base);
   los bonos exactos se piden al backend con un botón.
   ═══════════════════════════════════════════════════════════════════════════ */
function PromotoriaSimulator({ promo, openExpediente }) {
  const B = promo.indice.baseAConservar || 1;
  const Ch = promo.indice.hoy.baseConservada || 0;
  const baseIndice = promo.indice.hoy.actual;

  const [sel, setSel] = useState({});           // id → 'cobrar' | 'rehabilitar'
  const [q, setQ] = useState('');
  const [urg, setUrg] = useState('TODAS');
  const [venc, setVenc] = useState(0);          // 0=todas · N = vence en ≤N días
  const [bonos, setBonos] = useState(null);
  const [bonosBusy, setBonosBusy] = useState(false);
  const [drag, setDrag] = useState(null);       // { id, val } arrastrándose
  const [over, setOver] = useState(false);

  const pend = promo.accionables.pendientesPago || [];
  const rehab = promo.accionables.rehabilitables || [];
  const byId = new Map(); [...pend, ...rehab].forEach(p => byId.set(p.id, p));

  const selEntries = Object.entries(sel).filter(([, v]) => v);
  const selMonto = selEntries.reduce((s, [id]) => s + (byId.get(Number(id))?.monto || 0), 0);
  const nCobrar = selEntries.filter(([, v]) => v === 'cobrar').length;
  const nRehab = selEntries.filter(([, v]) => v === 'rehabilitar').length;
  const simIndice = Math.min(Ch + selMonto, B) / B;
  const delta = simIndice - baseIndice;
  const cruza86 = baseIndice < 0.86 && simIndice >= 0.86;

  const matchTxt = p => !q || `${p.poliza} ${p.plan_id || ''} ${p.agente || ''}`.toLowerCase().includes(q.toLowerCase());
  const fPend = pend.filter(matchTxt).sort((a, b) => b.monto - a.monto);
  const fRehab = rehab.filter(p => matchTxt(p) && (urg === 'TODAS' || p.urgencia === urg) && (!venc || (p.dias_restantes ?? 9999) <= venc))
    .sort((a, b) => (ORDEN_URG.indexOf(a.urgencia) - ORDEN_URG.indexOf(b.urgencia)) || b.monto - a.monto);

  /* Gráfica acumulada: el índice arranca en "Hoy" y sube con cada póliza (mayor a menor impacto) */
  const chartData = [{ label: 'Hoy', indice: baseIndice, monto: 0 }];
  selEntries.map(([id]) => byId.get(Number(id))).filter(Boolean).sort((a, b) => b.monto - a.monto)
    .reduce((cum, p) => { const c = cum + (p.monto || 0); chartData.push({ label: p.poliza, indice: Math.min(Ch + c, B) / B, monto: p.monto }); return c; }, 0);

  const add = (id, val) => setSel(s => ({ ...s, [id]: val }));
  const toggle = (id, val) => setSel(s => ({ ...s, [id]: s[id] === val ? undefined : val }));
  const remove = (id) => setSel(s => ({ ...s, [id]: undefined }));
  const addList = (lista, val) => setSel(s => { const n = { ...s }; lista.forEach(p => { n[p.id] = val; }); return n; });
  const clear = () => setSel({});

  const runBonos = async () => {
    setBonosBusy(true);
    try {
      setBonos(await api.crmIngresosSimulatePromotoria({
        cobrarPolizas: selEntries.filter(([, v]) => v === 'cobrar').map(([k]) => Number(k)),
        rehabilitarPolizas: selEntries.filter(([, v]) => v === 'rehabilitar').map(([k]) => Number(k)),
      }));
    } catch (e) { alert(e.message); } finally { setBonosBusy(false); }
  };

  const impColor = (p, val) => val === 'rehabilitar' ? (URG_META[p.urgencia] || URG_META.BAJA).color : C.amber;

  const Row = ({ p, val }) => {
    const on = sel[p.id] === val;
    const col = impColor(p, val);
    return (
      <div draggable
        onDragStart={() => setDrag({ id: p.id, val })} onDragEnd={() => setDrag(null)}
        onClick={() => toggle(p.id, val)}
        className="crm-mc-row"
        style={{ padding: '7px 10px', gap: 8, cursor: 'grab', borderBottom: '1px solid rgba(11,27,51,.05)', borderLeft: `4px solid ${col}`, background: on ? `${col}12` : '#fff', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <input type="checkbox" style={{ accentColor: col }} checked={on} readOnly />
          <span style={{ minWidth: 0 }}>
            <b style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(11,27,51,.25)' }}
              onClick={(ev) => { ev.stopPropagation(); openExpediente(p.id); }}>{p.poliza}</b>
            {' '}<span style={{ fontSize: 11, color: C.textMuted }}>{p.plan_id}</span>
            <br /><span style={{ fontSize: 11, color: C.textMuted }}>{p.agente}</span>
            {val === 'rehabilitar' && <span style={{ marginLeft: 6 }}><UrgBadge u={p.urgencia} /></span>}
            {val === 'rehabilitar' && p.dias_restantes != null && <span style={{ fontSize: 10.5, color: p.dias_restantes <= 7 ? C.red : p.dias_restantes <= 30 ? '#B45309' : C.textMuted, marginLeft: 6 }}>vence en {p.dias_restantes}d</span>}
          </span>
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}><b>{fmtMoney(p.monto)}</b> <span style={{ color: C.green, fontSize: 11 }}>+{pct(p.impacto_indice, 2)}</span></span>
      </div>
    );
  };

  const gaugeColor = indiceColor(simIndice);

  return (
    <>
      {/* ── ÍNDICE STICKY EN VIVO ── */}
      <div style={{ position: 'sticky', top: 8, zIndex: 20 }}>
        <div className="crm-chart-card" style={{ marginBottom: 12, boxShadow: '0 6px 20px rgba(11,27,51,.10)', border: `1px solid ${gaugeColor}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>Índice de la promotoría (en vivo)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: gaugeColor, lineHeight: 1 }}>{pct(simIndice)}</span>
                <span style={{ fontSize: 14, color: C.textMuted }}>desde {pct(baseIndice)}</span>
                {delta > 0.0001 && <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>▲ +{pct(delta)}</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Parte de lo <b>cobrado hoy</b>; suma pendientes y rehabilitaciones para ver cuánto sube hacia el techo.</div>
            </div>
            <div style={{ display: 'flex', gap: 16, textAlign: 'right', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 11, color: C.textMuted }}>Recuperado</div><b style={{ fontSize: 16 }}>{fmtMoneyFull(selMonto)}</b></div>
              <div><div style={{ fontSize: 11, color: C.textMuted }}>Pólizas</div><b style={{ fontSize: 16 }}>{nCobrar + nRehab}</b><div style={{ fontSize: 10, color: C.textMuted }}>{nCobrar} cobrar · {nRehab} rehab</div></div>
              <div><div style={{ fontSize: 11, color: C.textMuted }}>Techo posible</div><b style={{ fontSize: 16, color: '#0891B2' }}>{pct(promo.indice.siCobraYRehabilitaTodo || simIndice, 1)}</b></div>
            </div>
          </div>
          <IndiceBar actual={simIndice} operativo={baseIndice} marks={[0.84, 0.86, 0.90, 0.94]} />
          {cruza86 && <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: -6 }}><Sparkles size={13} style={{ verticalAlign: -2 }} /> ¡Con esta selección la promotoría cruza el 86% y reactiva bonos!</div>}
          {/* Canasta / drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); if (drag) add(drag.id, drag.val); setDrag(null); }}
            style={{ marginTop: 10, border: `2px dashed ${over ? gaugeColor : 'rgba(11,27,51,.18)'}`, background: over ? `${gaugeColor}0D` : 'transparent', borderRadius: 10, padding: '8px 10px', minHeight: 44, transition: 'all .15s' }}>
            {selEntries.length === 0
              ? <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '6px 0' }}>Arrastra aquí las pólizas (o da clic) para sumarlas al índice — cobros y rehabilitaciones.</div>
              : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selEntries.map(([id, val]) => { const p = byId.get(Number(id)); if (!p) return null; const col = impColor(p, val);
                    return <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${col}15`, color: col, border: `1px solid ${col}40`, borderRadius: 20, padding: '2px 8px', fontSize: 11.5, fontWeight: 600 }}>
                      {p.poliza} · {fmtMoney(p.monto)}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => remove(Number(id))} />
                    </span>; })}
                </div>}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn-primary" disabled={bonosBusy || selEntries.length === 0} onClick={runBonos}><Calculator size={15} /> {bonosBusy ? 'Calculando bonos…' : 'Calcular bonos exactos'}</button>
            {selEntries.length > 0 && <button className="f-tab" style={{ fontSize: 11.5 }} onClick={clear}>Limpiar todo</button>}
            {bonos && <span style={{ fontSize: 13 }}>Bonos: <b>{fmtMoney(bonos.base.bonos)}</b> → <b style={{ color: C.green }}>{fmtMoneyFull(bonos.simulado.bonos)}</b> {bonos.delta.bonos > 0 && <span style={{ color: C.green }}>(+{fmtMoneyFull(bonos.delta.bonos)})</span>}</span>}
          </div>
        </div>
      </div>

      {/* ── Gráfica acumulada ── */}
      {selEntries.length > 0 && (
        <div className="crm-chart-card">
          <h4 style={{ margin: '0 0 2px' }}>Cómo sube el índice al recuperar cada póliza</h4>
          <p className="sub" style={{ marginTop: 0 }}>De mayor a menor impacto. Las líneas marcan los umbrales 84 / 86 / 90 / 94%.</p>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartData} margin={{ top: 8, right: 14, left: 6, bottom: 4 }}>
              <defs><linearGradient id="simIdx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={gaugeColor} stopOpacity={0.5} /><stop offset="100%" stopColor={gaugeColor} stopOpacity={0.03} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,27,51,.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[Math.max(0, Math.floor(baseIndice * 20) / 20 - 0.05), 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, n) => n === 'indice' ? [pct(v), 'Índice'] : [fmtMoneyFull(v), n]} />
              <ReferenceLine y={0.86} stroke={C.amber} strokeDasharray="4 4" />
              <ReferenceLine y={0.84} stroke={C.red} strokeDasharray="4 4" />
              <Area dataKey="indice" stroke={gaugeColor} strokeWidth={2.5} fill="url(#simIdx)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="crm-chart-card" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar póliza, plan o asesor…" style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid rgba(11,27,51,.15)', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Filter size={13} color={C.textMuted} />
            {[['TODAS', 'Toda urgencia'], ['EXTREMA', 'Extrema'], ['ALTA', 'Alta'], ['MEDIA', 'Media']].map(([k, t]) => (
              <button key={k} className="f-tab" style={{ fontSize: 11, ...(urg === k ? { background: C.ink, color: '#fff' } : {}) }} onClick={() => setUrg(k)}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>Vence:</span>
            {[[0, 'Todas'], [7, '≤7d'], [30, '≤30d'], [60, '≤60d']].map(([k, t]) => (
              <button key={k} className="f-tab" style={{ fontSize: 11, ...(venc === k ? { background: C.red, color: '#fff' } : {}) }} onClick={() => setVenc(k)}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Listas ── */}
      <div className="crm-chart-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }}>
          {[{ tit: 'Pendientes de pago', lista: fPend, val: 'cobrar', color: C.amber },
            { tit: 'Rehabilitables', lista: fRehab, val: 'rehabilitar', color: '#0891B2' }].map(grp => (
            <div key={grp.val}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, color: grp.color }}>{grp.tit} ({grp.lista.length})</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="f-tab" style={{ fontSize: 11 }} onClick={() => addList(grp.lista, grp.val)}>Agregar todas</button>
                  <button className="f-tab" style={{ fontSize: 11 }} onClick={() => addList(grp.lista, undefined)}>Quitar</button>
                </div>
              </div>
              <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid rgba(11,27,51,.1)', borderRadius: 8 }}>
                {grp.lista.length === 0 && <p className="empty" style={{ margin: 10 }}>Nada con estos filtros</p>}
                {grp.lista.map(p => <Row key={p.id} p={p} val={grp.val} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
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

  /* Detalle AGREGADO de la promotoría (para Simulador/Proyección sin agente):
     suma primas y bonos de todos los asesores + índice agregado de la promotoría. */
  const detailPromo = (!detail && promo && overview.length) ? {
    agente: { nombre: 'Promotoría — todos los asesores', clave: '' },
    indice: { actual: promo.indice.actual, conPendiente: promo.indice.conPendiente },
    bonos: { total_trimestre: overview.reduce((s, a) => s + (a.bonos?.total_trimestre || 0), 0) },
    primas: {
      ubicacionQ: overview.reduce((s, a) => s + (a.primas?.ubicacionQ || 0), 0),
      pagadaInicialQ: overview.reduce((s, a) => s + (a.primas?.pagadaInicialQ || 0), 0),
      renovacionQ: overview.reduce((s, a) => s + (a.primas?.renovacionQ || 0), 0),
    },
  } : null;

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

      {/* ═══════════ TAB PROYECCIÓN ═══════════
          Promotoría → modelo a futuro completo; agente → calculadora de ingresos personal */}
      {tab === 'proyeccion' && !detail && isAgency && <PromotoriaForecast />}
      {tab === 'proyeccion' && detail && <ProyeccionIngresos detail={detail} />}
      {tab === 'proyeccion' && !detail && !isAgency && detailPromo && <ProyeccionIngresos detail={detailPromo} />}
      {tab === 'proyeccion' && !detail && !isAgency && !detailPromo && <p className="empty">Cargando datos… (o selecciona un agente en el Tablero PIR).</p>}

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
              <div className="info-box" style={{ background: '#E7F5F3', borderColor: `${C.gold}40`, margin: '4px 0 12px' }}>
                <p style={{ margin: 0, fontSize: 12.5 }}>
                  <b>El índice que reporta Prudential ({pct(promo.indice.conPendiente)}) es el "con pendiente de pago"</b> — cuenta las pólizas vigentes que aún no pagan la anualidad como conservadas (se asume que pagarán). El <b>{pct(promo.indice.actual)} al corte</b> es el estricto (solo lo ya pagado). La verdad operativa está entre ambos: se vuelve realidad conforme entran los pagos pendientes.
                </p>
              </div>
              <IndiceBar actual={promo.indice.conPendiente} operativo={promo.indice.siCobraYRehabilitaTodo} marks={[0.84]} />
              <div className="crm-kpi-detail">
                <BonoCard icon={ShieldCheck} label="Índice Prudential (con pendiente)" value={<span style={{ color: promoColor(promo.indice.conPendiente) }}>{pct(promo.indice.conPendiente)}</span>} sub="previo + pendiente de pago — así lo reporta Prudential" color={C.gold} />
                <BonoCard icon={RefreshCw} label="Índice estricto (al corte)" value={<span style={{ color: promoColor(promo.indice.actual) }}>{pct(promo.indice.actual)}</span>} sub="solo lo ya pagado adelante (piso)" />
                <BonoCard icon={TrendingUp} label="Índice hoy (en vivo)" value={<span style={{ color: promoColor(promo.indice.hoy.actual) }}>{pct(promo.indice.hoy.actual)}</span>} sub="estricto, con vencimientos posteriores al corte" />
                <BonoCard icon={RotateCcw} label="Techo: cobrando y rehabilitando todo" value={<span style={{ color: promoColor(promo.indice.siCobraYRehabilitaTodo) }}>{pct(promo.indice.siCobraYRehabilitaTodo)}</span>} sub="cobrar pendientes + rehabilitar canceladas" color={C.green} />
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

      {tab === 'simulador' && !detail && promo && <PromotoriaSimulator promo={promo} openExpediente={openPolExpediente} />}
      {tab === 'simulador' && !detail && !promo && <p className="empty">Cargando datos de la promotoría…</p>}
    </div>
  );
}
