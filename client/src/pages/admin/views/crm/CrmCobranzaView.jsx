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
import { Receipt, TrendingUp, AlertTriangle, Users, Mail, Send, Loader2, CheckCircle2, X } from 'lucide-react';

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

const lblS = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5B6B84', margin: '10px 0 4px' };
const inpS = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4E8F0', fontSize: 13, marginBottom: 4, boxSizing: 'border-box' };

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
  const [preview, setPreview] = useState(null);   // { clave, loading, data, error }
  const [bulk, setBulk]       = useState(null);    // { loading, list, error }
  const [selected, setSelected] = useState(() => new Set());
  const [mailCfg, setMailCfg] = useState(null);   // null=cerrado | objeto con el form
  const [correos, setCorreos] = useState(null);   // { loading, list, error } — todos los correos a enviar

  const loadCorreos = async () => {
    setCorreos({ loading: true });
    try {
      const d = await api.crmCobranzaPreviewTodos();
      const base = (d.consultores || []).filter(Boolean);
      // Muestra la lista de inmediato; el cuerpo de cada correo se trae con el
      // endpoint por-clave (ya desplegado) para no depender de preview-todos.body.
      setCorreos({ list: base, diasVentana: d.diasVentana });
      const pend = base.filter(c => !c.sinCorreo && !c.body);
      const CONC = 4;
      for (let i = 0; i < pend.length; i += CONC) {
        const lote = pend.slice(i, i + CONC);
        const res = await Promise.all(lote.map(async c => {
          try { const p = await api.crmCobranzaPreview(c.clave); return { clave: c.clave, subject: p.subject, body: p.body }; }
          catch { return { clave: c.clave }; }
        }));
        setCorreos(prev => (prev && prev.list)
          ? { ...prev, list: prev.list.map(c => { const u = res.find(r => r.clave === c.clave); return (u && u.body) ? { ...c, subject: u.subject, body: u.body } : c; }) }
          : prev);
      }
    } catch (e) { setCorreos({ error: e.message }); }
  };
  // Recarga cada vez que se entra a la pestaña (no se queda con datos viejos).
  useEffect(() => { if (tab === 'correos') loadCorreos(); }, [tab]); // eslint-disable-line

  const abrirRemitente = async () => {
    setMailCfg({ loading: true });
    try {
      const c = await api.crmMailConfigGet();
      setMailCfg({ ...c, smtp_pass: '', testTo: '', saving: false, testing: false, msg: null });
    } catch (e) { setMailCfg({ error: e.message }); }
  };
  const guardarRemitente = async () => {
    setMailCfg(m => ({ ...m, saving: true, msg: null }));
    try {
      await api.crmMailConfigSave({
        from_name: mailCfg.from_name, smtp_user: mailCfg.smtp_user, smtp_pass: mailCfg.smtp_pass,
        smtp_host: mailCfg.smtp_host, smtp_port: mailCfg.smtp_port, smtp_secure: mailCfg.smtp_secure,
      });
      setMailCfg(m => ({ ...m, saving: false, has_pass: m.has_pass || !!m.smtp_pass, smtp_pass: '', msg: { ok: true, text: 'Remitente guardado. Ahora envía una prueba para validarlo.' } }));
    } catch (e) { setMailCfg(m => ({ ...m, saving: false, msg: { ok: false, text: e.message } })); }
  };
  const probarRemitente = async () => {
    if (!mailCfg.testTo) { setMailCfg(m => ({ ...m, msg: { ok: false, text: 'Escribe un correo para la prueba.' } })); return; }
    setMailCfg(m => ({ ...m, testing: true, msg: null }));
    try {
      const r = await api.crmMailConfigTest(mailCfg.testTo);
      setMailCfg(m => ({ ...m, testing: false, msg: { ok: true, text: `Prueba enviada a ${r.enviadoA} desde ${r.remitente}.` } }));
    } catch (e) { setMailCfg(m => ({ ...m, testing: false, msg: { ok: false, text: e.message } })); }
  };

  const load = async () => {
    setLoading(true); setErr(null);
    try { setData(await api.crmGetCobranza()); }
    catch (e) { setErr(e.message || 'No se pudo cargar la cobranza'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const [reportSending, setReportSending] = useState(false);
  const enviarReporteTelegram = async () => {
    setReportSending(true); setSendMsg(null);
    try {
      const r = await api.crmAgentReportSend();
      const t = r?.resumen || {};
      const okTg = r?.telegram?.ok;
      setSendMsg({
        ok: !!okTg,
        text: okTg
          ? `Reporte enviado a Telegram · ${t.agentesConPendiente || 0} agentes con pendientes, ${money(t.vencTotalMonto || 0)} vencido.`
          : `No se pudo enviar a Telegram (${r?.telegram?.skipped || r?.telegram?.error || 'sin canal configurado'}).`,
      });
    } catch (e) {
      setSendMsg({ ok: false, text: e.message || 'Error al enviar el reporte' });
    } finally { setReportSending(false); }
  };

  const pendientes = useMemo(() => {
    const list = (data?.pendientes || []);
    return filtroConsultor ? list.filter(p => p.clave === filtroConsultor) : list;
  }, [data, filtroConsultor]);

  const flujoMax = useMemo(() => Math.max(1, ...(data?.flujo || []).map(f => f.total)), [data]);

  // Abre el modal con el cuerpo del correo que se enviaría (sin mandarlo).
  const abrirPreview = async (clave) => {
    setPreview({ clave, loading: true });
    try {
      const d = await api.crmCobranzaPreview(clave);
      setPreview({ clave, data: d });
    } catch (e) {
      setPreview({ clave, error: e.message || 'No se pudo cargar la vista previa' });
    }
  };

  // Envía un consultor (desde su modal de preview). El modal es la confirmación.
  const enviar = async (clave) => {
    setSending(clave); setSendMsg(null);
    try {
      const r = await api.crmCobranzaNotificar(clave);
      const n = (r.enviados || []).length, f = (r.fallidos || []).length;
      setSendMsg({ ok: n > 0 || f === 0, text: `Enviados: ${n}${f ? ` · fallidos: ${f}` : ''}` });
      setPreview(null);
    } catch (e) {
      setSendMsg({ ok: false, text: e.message || 'No se pudo enviar' });
    } finally { setSending(null); }
  };

  // Abre el modal de envío masivo con selección (quién sí, quién no).
  const openBulk = async () => {
    setBulk({ loading: true }); setSendMsg(null);
    try {
      const d = await api.crmCobranzaPreviewTodos();
      const list = d.consultores || [];
      setBulk({ list });
      setSelected(new Set(list.filter(c => !c.sinCorreo).map(c => c.clave)));
    } catch (e) { setBulk({ error: e.message || 'No se pudo cargar la lista' }); }
  };
  const toggleSel = (clave) => setSelected(prev => { const n = new Set(prev); n.has(clave) ? n.delete(clave) : n.add(clave); return n; });

  // Envía a los seleccionados en el modal masivo.
  const enviarSeleccionados = async () => {
    const claves = [...selected];
    if (!claves.length) return;
    setSending('ALL'); setSendMsg(null);
    try {
      const r = await api.crmCobranzaNotificarClaves(claves);
      const n = (r.enviados || []).length, f = (r.fallidos || []).length;
      setSendMsg({ ok: n > 0 || f === 0, text: `Enviados: ${n}${f ? ` · fallidos: ${f}` : ''}` });
      setBulk(null);
    } catch (e) { setSendMsg({ ok: false, text: e.message || 'No se pudo enviar' }); }
    finally { setSending(null); }
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
          <button className="crm-btn" onClick={abrirRemitente} title="Configura el correo desde el que salen los cobros (el de Flavio o un cobranza@dominio)">
            <Mail size={15} /> Remitente
          </button>
          <button className="crm-btn" disabled={reportSending} onClick={enviarReporteTelegram} title="Envía al grupo de Telegram el resumen de agentes con cobros pendientes/vencidos">
            {reportSending ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Reporte a Telegram
          </button>
          <button className="crm-btn crm-btn-primary" disabled={sending || (bulk && bulk.loading)} onClick={openBulk}>
            {bulk && bulk.loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar a todos
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
        {[['flujo', 'Flujo de caja'], ['pendientes', `Cobros pendientes (${t.pendientesCount || 0})`], ['consultores', 'Por consultor'], ['correos', 'Correos']].map(([id, label]) => (
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
            <div className="crm-card" key={c.clave} style={{ padding: 16, cursor: 'pointer' }}
                 onClick={() => abrirPreview(c.clave)} title="Ver el correo que se enviará">
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
              <button className="crm-btn" onClick={(e) => { e.stopPropagation(); abrirPreview(c.clave); }} style={{ width: '100%', justifyContent: 'center' }}>
                <Mail size={14} /> Ver correo
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'correos' && (
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={16} color={C.primary} /> Correos que se enviarán</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Vista previa del correo que recibirá cada consultor. Revísalos antes de disparar con “Enviar a todos”.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {correos?.list && <div style={{ fontSize: 12.5, color: C.textMuted }}>{correos.list.filter(c => !c.sinCorreo).length} con correo · {correos.list.filter(c => c.sinCorreo).length} sin correo</div>}
              <button className="crm-btn" disabled={correos?.loading} onClick={loadCorreos} title="Volver a generar la vista previa">
                {correos?.loading ? <Loader2 size={14} className="spin" /> : <Mail size={14} />} Actualizar
              </button>
            </div>
          </div>
          {correos?.loading ? <p style={{ padding: 24, color: C.textMuted }}><Loader2 size={15} className="spin" /> Generando correos…</p>
            : correos?.error ? <p style={{ padding: 24, color: C.red }}>⚠️ {correos.error}</p>
              : !correos?.list?.length ? <p style={{ padding: 24, color: C.textMuted }}>No hay cobranzas por enviar en la ventana actual.</p>
                : (
                  <div style={{ maxHeight: '70vh', overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {correos.list.map(c => (
                      <div key={c.clave} style={{ border: `1px solid ${c.sinCorreo ? C.redBg : '#E4E8F0'}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: '#F7F9FC', borderBottom: '1px solid #EEF1F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.nombre} <span style={{ color: C.textMuted, fontWeight: 500 }}>· {c.clave}</span></div>
                            <div style={{ fontSize: 12, color: c.sinCorreo ? C.red : C.textMuted }}>
                              {c.sinCorreo ? '⚠️ Sin correo registrado — no se le enviará' : `Para: ${c.email}`} · CC: Flavio
                            </div>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.primary }}>{money(c.total)} · {c.count} recibos</div>
                        </div>
                        <div style={{ padding: '10px 14px' }}>
                          {c.sinCorreo ? (
                            <div style={{ fontSize: 12.5, color: C.textMuted }}>Este consultor no tiene correo registrado — no se le enviará.</div>
                          ) : !c.body ? (
                            <div style={{ fontSize: 12.5, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="spin" /> Cargando cuerpo del correo…</div>
                          ) : (<>
                            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Asunto: <span style={{ fontWeight: 500 }}>{c.subject}</span></div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 12.5, color: '#2A3850', lineHeight: 1.5, background: '#FCFDFE', border: '1px solid #EEF1F6', borderRadius: 8, padding: '10px 12px' }}>{c.body}</pre>
                          </>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
        </div>
      )}

      {/* ── Modal: vista previa del correo ── */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,22,54,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(5,22,54,.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={18} /> Correo de cobranza</h3>
              <button className="crm-btn" onClick={() => setPreview(null)} style={{ padding: '4px 10px' }}><X size={16} /></button>
            </div>

            <div style={{ padding: 20, overflow: 'auto' }}>
              {preview.loading && <div style={{ textAlign: 'center', padding: 30, color: C.textMuted }}><Loader2 size={22} className="spin" /><p>Generando vista previa...</p></div>}
              {preview.error && <p style={{ color: C.red }}>⚠️ {preview.error}</p>}
              {preview.data && preview.data.sinCobranzas && <p style={{ color: C.textMuted, textAlign: 'center', padding: 20 }}>Este consultor no tiene cobranzas próximas a vencer.</p>}
              {preview.data && !preview.data.sinCobranzas && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 8, columnGap: 10, fontSize: 13, marginBottom: 16 }}>
                    <span style={{ color: C.textMuted }}>Para:</span>
                    <span style={{ fontWeight: 600, color: preview.data.sinCorreo ? C.red : C.text }}>{preview.data.nombre} {preview.data.email ? `<${preview.data.email}>` : '· SIN CORREO (no se puede enviar)'}</span>
                    <span style={{ color: C.textMuted }}>Asunto:</span>
                    <span style={{ fontWeight: 600 }}>{preview.data.subject}</span>
                  </div>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: C.text, maxHeight: '42vh', overflow: 'auto' }}>
                    {preview.data.body}
                  </div>
                </>
              )}
            </div>

            {preview.data && !preview.data.sinCobranzas && (
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="crm-btn" onClick={() => setPreview(null)}>Cerrar</button>
                <button className="crm-btn crm-btn-primary" disabled={preview.data.sinCorreo || sending} onClick={() => enviar(preview.clave)} title={preview.data.sinCorreo ? 'Este consultor no tiene correo' : ''}>
                  {sending === preview.clave ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar este correo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: envío masivo con selección ── */}
      {bulk && !bulk.loading && (
        <div onClick={() => setBulk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,22,54,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(5,22,54,.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Send size={18} /> Enviar cobranza — elige a quién</h3>
              <button className="crm-btn" onClick={() => setBulk(null)} style={{ padding: '4px 10px' }}><X size={16} /></button>
            </div>

            {bulk.error && <p style={{ color: C.red, padding: 20 }}>⚠️ {bulk.error}</p>}
            {bulk.list && (
              <>
                <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <button className="crm-btn" style={{ padding: '4px 10px' }} onClick={() => setSelected(new Set(bulk.list.filter(c => !c.sinCorreo).map(c => c.clave)))}>Todos</button>
                  <button className="crm-btn" style={{ padding: '4px 10px' }} onClick={() => setSelected(new Set())}>Ninguno</button>
                  <span style={{ marginLeft: 'auto', color: C.textMuted }}>{selected.size} de {bulk.list.filter(c => !c.sinCorreo).length} con correo</span>
                </div>
                <div style={{ overflow: 'auto', padding: '6px 0' }}>
                  {bulk.list.map((c) => (
                    <label key={c.clave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', cursor: c.sinCorreo ? 'not-allowed' : 'pointer', opacity: c.sinCorreo ? 0.5 : 1, borderBottom: `1px solid ${C.bg}` }}>
                      <input type="checkbox" disabled={c.sinCorreo} checked={selected.has(c.clave)} onChange={() => toggleSel(c.clave)} style={{ width: 17, height: 17, accentColor: C.primary }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{c.nombre} <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirPreview(c.clave); }} style={{ marginLeft: 6, fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>ver correo</button></p>
                        <p style={{ margin: 0, fontSize: 12, color: c.sinCorreo ? C.red : C.textMuted }}>{c.email || 'sin correo'}</p>
                      </div>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{money(c.total)}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>{c.count} recibos</p>
                      </div>
                    </label>
                  ))}
                  {!bulk.list.length && <p style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No hay cobranzas próximas a vencer.</p>}
                </div>
                <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="crm-btn" onClick={() => setBulk(null)}>Cancelar</button>
                  <button className="crm-btn crm-btn-primary" disabled={!selected.size || sending} onClick={enviarSeleccionados}>
                    {sending === 'ALL' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Enviar a {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mailCfg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,23,48,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={() => setMailCfg(null)}>
          <div className="crm-card" style={{ width: '100%', maxWidth: 520, padding: 0, maxHeight: '92vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={18} color={C.primary} /> Remitente de cobranza</h3>
              <button className="crm-btn" style={{ padding: '4px 8px' }} onClick={() => setMailCfg(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {mailCfg.loading ? <p style={{ color: C.textMuted }}><Loader2 size={15} className="spin" /> Cargando…</p>
                : mailCfg.error ? <p style={{ color: C.red }}>{mailCfg.error}</p>
                  : (<>
                    <p style={{ fontSize: 13, color: C.textMuted, marginTop: 0 }}>Conecta el correo desde el que salen los cobros (el de Flavio o un <b>cobranza@tudominio</b>). Con Gmail usa una <b>contraseña de aplicación</b>, no la normal.</p>
                    <label style={lblS}>Nombre del remitente</label>
                    <input style={inpS} value={mailCfg.from_name || ''} onChange={e => setMailCfg(m => ({ ...m, from_name: e.target.value }))} placeholder="Cobranza · Finance S-Cool" />
                    <label style={lblS}>Correo (usuario SMTP)</label>
                    <input style={inpS} value={mailCfg.smtp_user || ''} onChange={e => setMailCfg(m => ({ ...m, smtp_user: e.target.value }))} placeholder="cobranza@grupointegraccion.com" />
                    <label style={lblS}>Contraseña {mailCfg.has_pass ? '(guardada — deja vacío para conservarla)' : '(de aplicación)'}</label>
                    <input style={inpS} type="password" value={mailCfg.smtp_pass || ''} onChange={e => setMailCfg(m => ({ ...m, smtp_pass: e.target.value }))} placeholder={mailCfg.has_pass ? '••••••••' : 'contraseña de aplicación'} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 2 }}>
                        <label style={lblS}>Servidor SMTP</label>
                        <input style={inpS} value={mailCfg.smtp_host || ''} onChange={e => setMailCfg(m => ({ ...m, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lblS}>Puerto</label>
                        <input style={inpS} value={mailCfg.smtp_port || ''} onChange={e => setMailCfg(m => ({ ...m, smtp_port: e.target.value }))} placeholder="465" />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '10px 0' }}>
                      <input type="checkbox" checked={mailCfg.smtp_secure !== false} onChange={e => setMailCfg(m => ({ ...m, smtp_secure: e.target.checked }))} /> Conexión segura (SSL/TLS)
                    </label>
                    <button className="crm-btn crm-btn-primary" disabled={mailCfg.saving} onClick={guardarRemitente}>
                      {mailCfg.saving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} Guardar remitente
                    </button>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E4E8F0' }}>
                      <label style={lblS}>Enviar prueba a</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...inpS, marginBottom: 0 }} value={mailCfg.testTo || ''} onChange={e => setMailCfg(m => ({ ...m, testTo: e.target.value }))} placeholder="tu-correo@ejemplo.com" />
                        <button className="crm-btn" disabled={mailCfg.testing} onClick={probarRemitente} style={{ whiteSpace: 'nowrap' }}>
                          {mailCfg.testing ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Probar
                        </button>
                      </div>
                      <p style={{ fontSize: 11.5, color: C.textMuted, margin: '6px 0 0' }}>Guarda primero; la prueba usa la configuración guardada.</p>
                    </div>
                    {mailCfg.msg && (
                      <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 9, background: mailCfg.msg.ok ? C.greenBg : C.redBg, color: mailCfg.msg.ok ? C.green : C.red, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {mailCfg.msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {mailCfg.msg.text}
                      </div>
                    )}
                  </>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
