/**
 * CrmCitasView — "Inteligencia de citas" (Fireflies.ai).
 * Lista las reuniones grabadas, muestra su resumen + temas + action items, y
 * permite volcarlos al expediente de un cliente (nota + tareas/pendientes).
 *
 * Se activa con FIREFLIES_API_KEY en el server. Mientras no exista la llave,
 * la vista muestra instrucciones de conexión en lugar de fallar — así queda
 * "preparado todo" y enciende solo cuando se confirmen las licencias.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Mic, RefreshCw, Search, CheckCircle2, ListTodo, Sparkles,
  Calendar, Users, AlertTriangle, PlugZap, ArrowRight, FileText,
} from 'lucide-react';
import { getCrmCSS, fmtDate } from './crmShared';

export default function CrmCitasView() {
  const [status, setStatus] = useState(null);      // { enabled }
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);            // transcript detalle
  const [loading, setLoading] = useState(true);
  const [loadingDet, setLoadingDet] = useState(false);
  const [err, setErr] = useState('');

  // Importar a cliente
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const st = await api.crmFirefliesStatus();
      setStatus(st);
      if (st.enabled) {
        const r = await api.crmFirefliesTranscripts(30);
        setList(r.transcripts || []);
      }
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetalle = async (id) => {
    setLoadingDet(true); setSel(null); setImportMsg(null); setMatches([]); setQ('');
    try { const r = await api.crmFirefliesTranscript(id); setSel(r.transcript); }
    catch (e) { setErr(e.message); }
    finally { setLoadingDet(false); }
  };

  const buscarClientes = async (text) => {
    setQ(text); setImportMsg(null);
    if (text.trim().length < 2) { setMatches([]); return; }
    try { const r = await api.crmGetClients({ q: text.trim() }); setMatches((r.clients || []).slice(0, 6)); }
    catch { setMatches([]); }
  };

  const importar = async (client) => {
    if (!sel) return;
    setImporting(true); setImportMsg(null);
    try {
      const r = await api.crmFirefliesImport(client.id, sel.id);
      setImportMsg({ ok: true, text: `Importado a ${client.nombre}: 1 nota + ${r.tareas} pendiente(s).` });
      setMatches([]); setQ('');
    } catch (e) { setImportMsg({ ok: false, text: e.message }); }
    finally { setImporting(false); }
  };

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando citas...</p></div></>;

  return (
    <>
      <style>{getCrmCSS()}</style>
      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Mic size={20} color={C.accent} /> Inteligencia de citas</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>Resúmenes y pendientes de tus reuniones, directo al expediente del cliente.</p>
        </div>
        <div className="crm-toolbar-right">
          {status?.enabled && <span className="midia-chip" style={{ background: C.greenBg, color: C.green, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}><CheckCircle2 size={13} /> Fireflies conectado</span>}
          <button className="crm-btn ghost" onClick={load}><RefreshCw size={15} /> Actualizar</button>
        </div>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red, display: 'flex', gap: 8 }}><AlertTriangle size={16} /> {err}</div>}

      {/* ── Estado: no conectado ── */}
      {status && !status.enabled && (
        <div className="crm-chart-card" style={{ maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: C.amberBg, display: 'grid', placeItems: 'center' }}><PlugZap size={22} color={C.amber} /></div>
            <div><b style={{ fontSize: 16 }}>Fireflies aún no está conectado</b><div style={{ fontSize: 12.5, color: C.textMuted }}>Todo el módulo ya está listo; solo falta la llave.</div></div>
          </div>
          <ol style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.7, paddingLeft: 18, margin: '8px 0' }}>
            <li>Confirmar la licencia y modalidad de Fireflies (Ingrid).</li>
            <li>En Fireflies: <b>Settings → Developer Settings → API Key</b>.</li>
            <li>Cargar esa llave como <code>FIREFLIES_API_KEY</code> en Railway (servicio del backend).</li>
            <li>Volver aquí y pulsar <b>Actualizar</b>. Se listarán las reuniones automáticamente.</li>
          </ol>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Al conectar podrás: ver el resumen de cada cita, sus temas clave y sus action items, y volcarlos como <b>nota + tareas</b> en el expediente del cliente con un clic.</div>
        </div>
      )}

      {/* ── Conectado: lista + detalle ── */}
      {status?.enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Lista de reuniones */}
          <div className="crm-chart-card" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, marginBottom: 8 }}>Reuniones recientes ({list.length})</div>
            {list.length === 0 && <div style={{ fontSize: 12.5, color: C.textMuted, padding: 12 }}>No hay reuniones grabadas todavía.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
              {list.map(t => (
                <button key={t.id} onClick={() => openDetalle(t.id)}
                  className="crm-btn ghost"
                  style={{ textAlign: 'left', display: 'block', padding: '9px 11px', border: `1px solid ${sel?.id === t.id ? C.accent : 'rgba(11,27,51,.1)'}`, background: sel?.id === t.id ? `${C.accent}0d` : '#fff' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, display: 'flex', gap: 10 }}>
                    <span><Calendar size={11} style={{ verticalAlign: -1 }} /> {fmtDate(t.fecha)}</span>
                    {t.duracion_min != null && <span>{t.duracion_min} min</span>}
                    {t.participantes?.length > 0 && <span><Users size={11} style={{ verticalAlign: -1 }} /> {t.participantes.length}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalle */}
          <div>
            {loadingDet && <div className="crm-chart-card"><div className="spinner" /> Cargando resumen…</div>}
            {!loadingDet && !sel && <div className="crm-chart-card" style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}><FileText size={30} color={C.line} /><p style={{ margin: '10px 0 0' }}>Elige una reunión para ver su resumen y sus pendientes.</p></div>}
            {sel && (
              <div className="crm-chart-card">
                <h3 style={{ margin: '0 0 2px' }}>{sel.titulo}</h3>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{fmtDate(sel.fecha)}{sel.duracion_min != null ? ` · ${sel.duracion_min} min` : ''}{sel.organizador ? ` · ${sel.organizador}` : ''}</div>

                {sel.resumen && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Sparkles size={14} /> Resumen</div>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.ink, margin: 0, whiteSpace: 'pre-wrap' }}>{sel.resumen}</p>
                  </div>
                )}
                {sel.temas?.length > 0 && (
                  <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {sel.temas.map((k, i) => <span key={i} className="midia-chip" style={{ background: '#EEF2F7', color: C.textMuted, padding: '3px 9px', borderRadius: 20, fontSize: 11 }}>{k}</span>)}
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><ListTodo size={15} color={C.green} /> Pendientes detectados ({sel.action_items.length})</div>
                {sel.action_items.length === 0 && <div style={{ fontSize: 12.5, color: C.textMuted }}>La reunión no generó action items.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sel.action_items.map((ai, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '5px 0', borderBottom: '1px solid rgba(11,27,51,.05)' }}>
                      <CheckCircle2 size={14} color={C.green} style={{ marginTop: 2, flexShrink: 0 }} /> <span>{ai}</span>
                    </div>
                  ))}
                </div>

                {/* Importar a cliente */}
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Volcar al expediente de un cliente</div>
                  <div style={{ position: 'relative', maxWidth: 380 }}>
                    <Search size={15} color={C.textMuted} style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input className="crm-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Busca al cliente por nombre…" value={q} onChange={e => buscarClientes(e.target.value)} />
                    {matches.length > 0 && (
                      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(5,22,54,.12)', zIndex: 20, overflow: 'hidden' }}>
                        {matches.map(m => (
                          <button key={m.id} className="crm-btn ghost" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', border: 'none', borderRadius: 0, padding: '9px 12px' }}
                            disabled={importing} onClick={() => importar(m)}>
                            <span style={{ fontWeight: 600, color: C.ink }}>{m.nombre}</span>
                            <span style={{ color: C.accent, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>Importar <ArrowRight size={13} /></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {importMsg && (
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: importMsg.ok ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {importMsg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {importMsg.text}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
