/**
 * CrmSemillasView — "Semillas": base de leads viva y customizable (solo agencia).
 * Grid tipo hoja de cálculo: filtros, columnas ocultables/eliminables (borrar solo
 * Arturo), columnas-fórmula estilo Excel. Cada lead es una semilla: al abrirla ves
 * sus servicios derivados (de cada categoría de gasto brota una oportunidad) y su
 * bitácora de seguimiento — "qué pasó con cada una".
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  Sprout, Search, RefreshCw, Columns3, Plus, Trash2, X, Eye, EyeOff,
  TrendingUp, MessageSquarePlus, ArrowRight, Sigma, MapPin, Building2, CircleDollarSign,
} from 'lucide-react';
import { getCrmCSS, fmtMoney } from './crmShared';

/* Evaluador de fórmula seguro: {col_key} → valor numérico; solo aritmética. */
function evalFormula(formula, data) {
  if (!formula) return '';
  const expr = String(formula).replace(/\{([a-z0-9_]+)\}/gi, (_, k) => {
    const v = Number(data?.[k]); return Number.isFinite(v) ? v : 0;
  });
  if (!/^[-+*/(). 0-9]+$/.test(expr)) return '⚠';
  try { const r = Function(`"use strict";return (${expr})`)(); return Number.isFinite(r) ? Math.round(r * 100) / 100 : '⚠'; }
  catch { return '⚠'; }
}

const SERV_ESTATUS = ['detectado', 'contactado', 'propuesta', 'ganado', 'perdido'];
const SERV_COLOR = { detectado: C.textMuted, contactado: '#0891B2', propuesta: C.amber, ganado: C.green, perdido: C.red };

function fmtCell(col, data) {
  if (col.tipo === 'formula') { const v = evalFormula(col.formula, data); return typeof v === 'number' ? v.toLocaleString('es-MX') : v; }
  const raw = data?.[col.col_key];
  if (raw == null || raw === '') return '';
  if (col.tipo === 'money') return fmtMoney(raw);
  if (col.tipo === 'bool') return raw ? '✓' : '';
  if (col.tipo === 'number') return Number(raw).toLocaleString('es-MX');
  return String(raw);
}

export default function CrmSemillasView() {
  const [columnas, setColumnas] = useState([]);
  const [leads, setLeads] = useState([]);
  const [puedeBorrar, setPuedeBorrar] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [colMenu, setColMenu] = useState(false);
  const [addCol, setAddCol] = useState(null);      // {label,tipo,formula}
  const [sel, setSel] = useState(null);            // {lead, servicios, seguimientos}
  const [nota, setNota] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [cols, lds] = await Promise.all([api.crmSemillasColumnas(), api.crmSemillasLeads()]);
      setColumnas(cols.columnas || []); setPuedeBorrar(!!cols.puede_borrar_columnas);
      setLeads(lds.leads || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Cerrar drawer / panel con Escape
  useEffect(() => {
    if (!sel && !addCol) return;
    const onKey = (e) => { if (e.key === 'Escape') { setSel(null); setAddCol(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, addCol]);

  const visibles = useMemo(() => columnas.filter(c => c.visible).sort((a, b) => a.orden - b.orden), [columnas]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? leads.filter(l => JSON.stringify(l.data).toLowerCase().includes(t)) : leads;
  }, [leads, q]);

  const toggleCol = async (col) => {
    setColumnas(cs => cs.map(c => c.id === col.id ? { ...c, visible: !c.visible } : c));
    try { await api.crmSemillasColUpdate(col.id, { visible: !col.visible }); } catch { load(); }
  };
  const delCol = async (col) => {
    if (!window.confirm(`¿Eliminar la columna "${col.label}"? (no borra los datos, solo la columna)`)) return;
    try { await api.crmSemillasColDelete(col.id); setColumnas(cs => cs.filter(c => c.id !== col.id)); }
    catch (e) { alert(e.message); }
  };
  const crearCol = async () => {
    if (!addCol?.label) return;
    try { const r = await api.crmSemillasColCreate({ ...addCol, orden: 500 }); setColumnas(cs => [...cs, r.columna]); setAddCol(null); }
    catch (e) { alert(e.message); }
  };

  const abrir = async (lead) => {
    setSel({ lead, servicios: [], seguimientos: [], loading: true });
    try { const d = await api.crmSemillasLead(lead.id); setSel({ ...d, loading: false }); }
    catch (e) { setErr(e.message); setSel(null); }
  };
  const cambiarServ = async (s, estatus) => {
    setSel(v => ({ ...v, servicios: v.servicios.map(x => x.id === s.id ? { ...x, estatus } : x) }));
    try { await api.crmSemillasServicioUpdate(s.id, { estatus }); } catch { /* noop */ }
  };
  const agregarNota = async () => {
    if (!nota.trim() || !sel) return;
    try {
      const r = await api.crmSemillasSeguimiento(sel.lead.id, { texto: nota.trim() });
      setSel(v => ({ ...v, seguimientos: [r.seguimiento, ...v.seguimientos] })); setNota('');
    } catch (e) { alert(e.message); }
  };

  const nombreDe = (l) => l.data?.razon_social || l.data?.grupo_holding || l.data?.tmk_id || `Semilla ${l.id}`;

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando semillas...</p></div></>;

  return (
    <>
      <style>{getCrmCSS()}</style>
      <style>{`
        .sem-grid{overflow:auto;border:1px solid ${C.line};border-radius:12px;max-height:calc(100vh - 230px)}
        .sem-grid table{border-collapse:separate;border-spacing:0;font-size:12.5px}
        .sem-grid th{position:sticky;top:0;background:${C.navy};color:#fff;font-weight:700;text-align:left;padding:9px 12px;white-space:nowrap;z-index:2}
        .sem-grid td{padding:8px 12px;border-bottom:1px solid ${C.line};white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis}
        .sem-grid tbody tr{cursor:pointer}
        .sem-grid tbody tr:hover td{background:${C.goldBg}}
        .sem-backdrop{position:fixed;inset:0;background:rgba(5,22,54,.28);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:1100;animation:semfade .2s ease}
        .sem-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,94vw);background:#fff;box-shadow:-12px 0 40px rgba(5,22,54,.18);z-index:1200;display:flex;flex-direction:column;animation:semin .2s ease}
        @keyframes semin{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}
        @keyframes semfade{from{opacity:0}to{opacity:1}}
        .sem-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px}
        .colmenu{position:absolute;top:42px;right:0;background:#fff;border:1px solid ${C.line};border-radius:12px;box-shadow:0 10px 34px rgba(5,22,54,.16);z-index:30;width:280px;max-height:420px;overflow:auto;padding:6px}
      `}</style>

      <div className="crm-toolbar">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Sprout size={20} color={C.green} /> Semillas</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>{filtered.length} de {leads.length} leads · cada semilla, sus servicios y su historia.</p>
        </div>
        <div className="crm-toolbar-right" style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} color={C.textMuted} style={{ position: 'absolute', left: 10, top: 9 }} />
            <input className="crm-input" style={{ paddingLeft: 32, width: 220 }} placeholder="Filtrar..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="crm-btn ghost" onClick={() => setColMenu(v => !v)}><Columns3 size={15} /> Columnas</button>
          <button className="crm-btn ghost" onClick={load}><RefreshCw size={15} /></button>
          {colMenu && (
            <div className="colmenu">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
                <b style={{ fontSize: 12 }}>Columnas visibles</b>
                <button className="crm-btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setAddCol({ label: '', tipo: 'text', formula: '' })}><Plus size={12} /> Nueva</button>
              </div>
              {columnas.sort((a, b) => a.orden - b.orden).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', fontSize: 12.5 }}>
                  <button className="crm-icon-btn" onClick={() => toggleCol(c)} title={c.visible ? 'Ocultar' : 'Mostrar'}>
                    {c.visible ? <Eye size={14} color={C.green} /> : <EyeOff size={14} color={C.textMuted} />}
                  </button>
                  <span style={{ flex: 1, color: c.visible ? C.ink : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}{c.tipo === 'formula' && <Sigma size={11} style={{ marginLeft: 4 }} />}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{c.grupo}</span>
                  {puedeBorrar && <button className="crm-icon-btn" onClick={() => delCol(c)} title="Eliminar (solo Arturo)"><Trash2 size={13} color={C.red} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {err && <div className="crm-chart-card" style={{ borderLeft: `4px solid ${C.red}`, color: C.red }}>{err}</div>}

      {/* Grid */}
      <div className="sem-grid">
        <table>
          <thead><tr>{visibles.map(c => <th key={c.id} style={{ minWidth: c.ancho }}>{c.label}{c.tipo === 'formula' && <Sigma size={11} style={{ marginLeft: 4, verticalAlign: -1 }} />}</th>)}</tr></thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} onClick={() => abrir(l)}>
                {visibles.map(c => {
                  const val = fmtCell(c, l.data);
                  const isMoney = c.tipo === 'money';
                  return <td key={c.id} style={{ fontWeight: c.col_key === 'razon_social' ? 700 : 400, color: isMoney ? C.ink : undefined, textAlign: (isMoney || c.tipo === 'number' || c.tipo === 'formula') ? 'right' : 'left' }}>
                    {c.tipo === 'bool' && val ? <span className="sem-chip" style={{ background: C.greenBg, color: C.green }}>✓</span> : val}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Nueva columna */}
      {addCol && (<>
        <div className="sem-backdrop" onClick={() => setAddCol(null)} />
        <div className="sem-drawer" style={{ width: 'min(420px,94vw)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Nueva columna</h3><button className="crm-icon-btn" onClick={() => setAddCol(null)}><X size={18} /></button>
          </div>
          <label className="crm-label">Nombre</label>
          <input className="crm-input" value={addCol.label} onChange={e => setAddCol({ ...addCol, label: e.target.value })} placeholder="p.ej. Potencial anual" />
          <label className="crm-label" style={{ marginTop: 10 }}>Tipo</label>
          <select className="crm-select" value={addCol.tipo} onChange={e => setAddCol({ ...addCol, tipo: e.target.value })}>
            <option value="text">Texto</option><option value="number">Número</option><option value="money">Dinero</option>
            <option value="pct">Porcentaje</option><option value="bool">Sí/No</option><option value="formula">Fórmula (Excel)</option>
          </select>
          {addCol.tipo === 'formula' && (
            <>
              <label className="crm-label" style={{ marginTop: 10 }}>Fórmula</label>
              <input className="crm-input" value={addCol.formula} onChange={e => setAddCol({ ...addCol, formula: e.target.value })} placeholder="{gasto_prom_6m} * 12 - {cv_2026}" />
              <p className="sub" style={{ fontSize: 11, marginTop: 4 }}>Usa <code>{'{col_key}'}</code> para referir otras columnas. Solo aritmética (+ − × ÷).</p>
            </>
          )}
          <button className="crm-btn" style={{ marginTop: 16, width: '100%' }} onClick={crearCol}>Crear columna</button>
        </div>
      </>)}

      {/* Drawer de la semilla */}
      {sel && (<>
        <div className="sem-backdrop" onClick={() => setSel(null)} />
        <div className="sem-drawer">
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.line}`, background: `linear-gradient(135deg,${C.navy},${C.ink})`, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, opacity: .7, display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={13} /> {sel.lead.data?.tmk_id}</div>
                <h3 style={{ margin: '4px 0 2px', color: '#fff' }}>{nombreDe(sel.lead)}</h3>
                <div style={{ fontSize: 12, opacity: .85, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {sel.lead.data?.industria && <span>{sel.lead.data.industria}</span>}
                  {sel.lead.data?.estado && <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {sel.lead.data.estado}{sel.lead.data?.municipio ? `, ${sel.lead.data.municipio}` : ''}</span>}
                </div>
              </div>
              <button className="crm-icon-btn" style={{ color: '#fff' }} onClick={() => setSel(null)}><X size={18} /></button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {sel.loading ? <div className="spinner" /> : <>
              {/* Servicios derivados */}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={15} color={C.green} /> Servicios de esta semilla ({sel.servicios.length})
              </div>
              {sel.servicios.length === 0 && <p className="sub">Sin servicios derivados aún.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {sel.servicios.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1px solid ${C.line}`, borderRadius: 10, borderLeft: `4px solid ${SERV_COLOR[s.estatus] || C.line}` }}>
                    <CircleDollarSign size={15} color={SERV_COLOR[s.estatus]} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.categoria}</div>
                      {s.monto_estimado > 0 && <div style={{ fontSize: 11.5, color: C.textMuted }}>Gasto detectado {fmtMoney(s.monto_estimado)}/año</div>}
                    </div>
                    <select className="crm-select" style={{ padding: '4px 8px', fontSize: 11.5 }} value={s.estatus} onChange={e => cambiarServ(s, e.target.value)}>
                      {SERV_ESTATUS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Bitácora */}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MessageSquarePlus size={15} color={C.accent} /> Seguimiento
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="crm-input" style={{ flex: 1 }} placeholder="Registra qué pasó..." value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarNota()} />
                <button className="crm-btn" onClick={agregarNota}>Añadir</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sel.seguimientos.map(sg => (
                  <div key={sg.id} style={{ padding: '8px 12px', background: C.bg, borderRadius: 9, fontSize: 12.5 }}>
                    <div>{sg.texto}</div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{sg.user_name || 'agencia'} · {new Date(sg.created_at).toLocaleString('es-MX')}</div>
                  </div>
                ))}
                {sel.seguimientos.length === 0 && <p className="sub">Aún sin registros. Cada contacto cuenta la historia de la semilla.</p>}
              </div>

              {/* Datos completos */}
              <details style={{ marginTop: 20 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: C.textMuted, fontWeight: 700 }}>Ver todos los datos</summary>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
                  {columnas.filter(c => sel.lead.data?.[c.col_key] != null && sel.lead.data?.[c.col_key] !== '').sort((a, b) => a.orden - b.orden).map(c => (
                    <div key={c.id} style={{ fontSize: 12 }}><span style={{ color: C.textMuted }}>{c.label}: </span><b>{fmtCell(c, sel.lead.data)}</b></div>
                  ))}
                </div>
              </details>
            </>}
          </div>
        </div>
      </>)}
    </>
  );
}
