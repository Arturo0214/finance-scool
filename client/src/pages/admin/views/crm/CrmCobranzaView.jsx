/**
 * CrmCobranzaView — Cobranza (solo administración)
 * Cobros pendientes + flujo de caja anticipado (modela fraccionamiento por
 * forma_pago) + envío de correo a cada finance consultant con sus próximas
 * cobranzas a vencer. Fuente: GET /api/crm/cobranza (crm_policies).
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { getCrmCSS, fmtDate } from './crmShared';
import { Receipt, TrendingUp, AlertTriangle, Users, Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';

const money = (n) => `$${(Math.round(Number(n) || 0)).toLocaleString('es-MX')}`;

/* Clases que no están en getAdminCSS/getCrmCSS (crm-btn/crm-card/crm-table). */
const COBRANZA_CSS = `
.crm-card{background:#fff;border:1px solid #E4E8F0;border-radius:14px;box-shadow:0 1px 2px rgba(16,35,59,.04)}
.crm-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid #E4E8F0;background:#fff;color:#16233B;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}
.crm-btn:hover:not(:disabled){background:#F2F4F8}
.crm-btn:disabled{opacity:.55;cursor:not-allowed}
.crm-btn-primary{background:#003DA5;color:#fff;border-color:#003DA5}
.crm-btn-primary:hover:not(:disabled){background:#002B75}
.crm-table{width:100%;border-collapse:collapse;font-size:13px}
.crm-table th{text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5B6B84;border-bottom:1px solid #E4E8F0;position:sticky;top:0;background:#F7F9FC;z-index:1}
.crm-table td{padding:10px 14px;border-bottom:1px solid #F0F2F6}
.crm-table tr:hover td{background:#F7F9FC}
.spin{animation:cbspin 1s linear infinite}
@keyframes cbspin{to{transform:rotate(360deg)}}
`;

/* Semáforo por días (positivo = vencido) */
function semaforo(dias) {
  if (dias == null) return { label: 'Sin fecha', bg: C.border, text: C.textMuted };
  if (dias > 0) return { label: `Vencida ${dias}d`, bg: C.redBg, text: C.red };
  const faltan = -dias;
  if (faltan <= 7) return { label: `En ${faltan}d`, bg: C.amberBg, text: C.amber };
  if (faltan <= 30) return { label: `En ${faltan}d`, bg: C.blueBg, text: C.blue };
  return { label: `En ${faltan}d`, bg: C.greenBg, text: C.green };
}

export default function CrmCobranzaView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const [tab, setTab]         = useState('flujo');
  const [filtroConsultor, setFiltroConsultor] = useState('');
  const [sending, setSending] = useState(null);   // clave | 'ALL'
  const [sendMsg, setSendMsg] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setData(await api.crmGetCobranza()); }
    catch (e) { setErr(e.message || 'No se pudo cargar la cobranza'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pendientes = useMemo(() => {
    const list = (data?.pendientes || []);
    return filtroConsultor ? list.filter(p => p.clave === filtroConsultor) : list;
  }, [data, filtroConsultor]);

  const flujoMax = useMemo(() => Math.max(1, ...(data?.flujo || []).map(f => f.total)), [data]);

  const notificar = async (clave) => {
    const quien = clave ? (data.consultores.find(c => c.clave === clave)?.nombre || clave) : 'todos los consultores con correo';
    if (!window.confirm(`¿Enviar correo de cobranza a ${quien}?`)) return;
    setSending(clave || 'ALL'); setSendMsg(null);
    try {
      const r = await api.crmCobranzaNotificar(clave || null);
      const n = (r.enviados || []).length, f = (r.fallidos || []).length;
      setSendMsg({ ok: true, text: `Enviados: ${n}${f ? ` · fallidos: ${f}` : ''}${(r.sinItemsOCorreo || []).length ? ` · sin correo/cobranzas: ${r.sinItemsOCorreo.length}` : ''}` });
    } catch (e) {
      setSendMsg({ ok: false, text: e.message || 'No se pudo enviar' });
    } finally { setSending(null); }
  };

  if (loading) return <><style>{getCrmCSS() + COBRANZA_CSS}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando cobranza...</p></div></>;
  if (err) return <><style>{getCrmCSS() + COBRANZA_CSS}</style><div className="view"><p style={{ color: C.red, padding: 24 }}>⚠️ {err} <button className="crm-btn" onClick={load} style={{ marginLeft: 12 }}>Reintentar</button></p></div></>;

  const t = data.totales || {};
  const kpis = [
    { label: 'Por cobrar (pendientes)', value: money(t.pendienteMonto), sub: `${t.pendientesCount || 0} recibos`, icon: AlertTriangle, color: C.amber, bg: C.amberBg },
    { label: 'Entrada próximos 30 días', value: money(t.flujo30), sub: 'flujo anticipado', icon: TrendingUp, color: C.green, bg: C.greenBg },
    { label: 'Prima anual en cartera', value: money(t.primaAnualTotal), sub: `${t.polizasActivas || 0} pólizas activas`, icon: Receipt, color: C.primary, bg: C.blueBg },
    { label: 'Consultores', value: (data.consultores || []).length, sub: `${(data.consultores || []).filter(c => c.email).length} con correo`, icon: Users, color: C.gold, bg: C.goldBg },
  ];

  return (
    <div className="view">
      <style>{getCrmCSS() + COBRANZA_CSS}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Receipt size={22} /> Cobranza</h1>
          <p className="view-subtitle">Cobros pendientes y flujo de caja anticipado · correos de cobranza por consultor</p>
        </div>
        <div className="crm-toolbar-right">
          <button className="crm-btn crm-btn-primary" disabled={sending} onClick={() => notificar(null)}>
            {sending === 'ALL' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar a todos
          </button>
        </div>
      </div>

      {sendMsg && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 10, background: sendMsg.ok ? C.greenBg : C.redBg, color: sendMsg.ok ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          {sendMsg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {sendMsg.text}
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ background: k.bg, color: k.color }}><k.icon size={22} /></div>
            <div><p className="stat-label">{k.label}</p><p className="stat-value">{k.value}</p><p className="stat-sub" style={{ color: C.textLight, fontSize: 12 }}>{k.sub}</p></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[['flujo', 'Flujo de caja'], ['pendientes', `Cobros pendientes (${t.pendientesCount || 0})`], ['consultores', 'Por consultor']].map(([id, label]) => (
          <button key={id} className={`f-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── Flujo de caja anticipado ── */}
      {tab === 'flujo' && (
        <div className="crm-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 4px' }}>Entrada esperada por mes (12 meses)</h3>
          <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 20px' }}>Prima anual repartida según forma de pago (anual/semestral/trimestral/mensual).</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 240, borderBottom: `1px solid ${C.border}`, paddingBottom: 2 }}>
            {(data.flujo || []).map((f) => (
              <div key={f.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${f.label}: ${money(f.total)} · ${f.count} recibos`}>
                <span style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, whiteSpace: 'nowrap' }}>{money(f.total)}</span>
                <div style={{ width: '100%', maxWidth: 46, height: `${Math.max(2, (f.total / flujoMax) * 190)}px`, background: `linear-gradient(180deg, ${C.gold}, ${C.primary})`, borderRadius: '6px 6px 0 0' }} />
                <span style={{ fontSize: 11, color: C.text, marginTop: 6 }}>{f.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cobros pendientes ── */}
      {tab === 'pendientes' && (
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
            <select className="crm-select" value={filtroConsultor} onChange={e => setFiltroConsultor(e.target.value)}>
              <option value="">Todos los consultores</option>
              {(data.consultores || []).filter(c => c.pendientesCount > 0).map(c => <option key={c.clave} value={c.clave}>{c.nombre} ({c.pendientesCount})</option>)}
            </select>
            <span style={{ fontSize: 13, color: C.textMuted }}>{pendientes.length} recibos · {money(pendientes.reduce((s, p) => s + p.monto, 0))}</span>
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 560, overflow: 'auto' }}>
            <table className="crm-table">
              <thead><tr><th>Estado</th><th>Cliente</th><th>Póliza</th><th>Consultor</th><th>Forma</th><th style={{ textAlign: 'right' }}>Monto</th><th>Vence</th></tr></thead>
              <tbody>
                {pendientes.map((p, i) => {
                  const s = semaforo(p.diasVencido);
                  return (
                    <tr key={i}>
                      <td><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.text, whiteSpace: 'nowrap' }}>{s.label}</span></td>
                      <td style={{ fontWeight: 600 }}>{p.cliente}</td>
                      <td style={{ color: C.textMuted }}>{p.poliza}</td>
                      <td>{p.consultor}</td>
                      <td style={{ textTransform: 'capitalize', color: C.textMuted }}>{p.forma_pago}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.monto)}</td>
                      <td style={{ color: C.textMuted }}>{p.vencimiento ? fmtDate(p.vencimiento) : '—'}</td>
                    </tr>
                  );
                })}
                {!pendientes.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>Sin cobros pendientes 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Por consultor ── */}
      {tab === 'consultores' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {(data.consultores || []).map((c) => (
            <div className="crm-card" key={c.clave} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</p>
                  <p style={{ fontSize: 12, color: c.email ? C.textMuted : C.red, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={12} /> {c.email || 'sin correo'}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: C.textLight, whiteSpace: 'nowrap' }}>{c.clave}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, margin: '14px 0 12px' }}>
                <div><p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Pendiente</p><p style={{ fontWeight: 700, margin: 0, color: c.pendienteMonto > 0 ? C.amber : C.text }}>{money(c.pendienteMonto)}</p><p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>{c.pendientesCount} recibos</p></div>
                <div><p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Prima anual</p><p style={{ fontWeight: 700, margin: 0 }}>{money(c.primaAnual)}</p><p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>{c.polizas} pólizas</p></div>
                <div><p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Próxima</p><p style={{ fontWeight: 600, margin: 0, fontSize: 13 }}>{c.proxima ? fmtDate(c.proxima) : '—'}</p></div>
              </div>
              <button className="crm-btn" disabled={!c.email || sending} onClick={() => notificar(c.clave)} style={{ width: '100%', justifyContent: 'center', opacity: c.email ? 1 : 0.5 }}>
                {sending === c.clave ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Enviar su cobranza
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
