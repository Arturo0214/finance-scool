/**
 * CrmPipelineView — Kanban del pipeline por asesor
 * Arrastra clientes entre etapas (desktop) o cambia etapa desde la tarjeta
 * (móvil). Admin elige el asesor; cada asesor ve solo su tablero.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Phone, GripVertical, RefreshCw, Search, Plus, X, CalendarCheck } from 'lucide-react';
import { getCrmCSS, ETAPAS, BENCHMARK_SEMANAL, fmtMoney } from './crmShared';

/* ── Mis citas: conteo por periodo (semana/mes/trimestre/año) vs el periodo
   anterior, a partir de los recordatorios tipo "cita" (tienen fecha). ── */
const GRANULARIDADES = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'anio', label: 'Año' },
];

function periodoDe(fechaStr, gran) {
  const d = new Date(`${String(fechaStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  if (gran === 'anio') return { key: `${y}`, label: `${y}` };
  if (gran === 'trimestre') { const q = Math.ceil((d.getMonth() + 1) / 3); return { key: `${y}-Q${q}`, label: `Q${q} ${y}` }; }
  if (gran === 'mes') return { key: `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) };
  // semana: lunes como inicio
  const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return { key: lunes.toISOString().slice(0, 10), label: `sem. del ${lunes.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` };
}

function CitasSection({ citas, titulo }) {
  const [gran, setGran] = useState('mes');
  const hoy = new Date();
  const actual = periodoDe(hoy.toISOString(), gran);

  const porPeriodo = new Map();
  for (const c of citas) {
    const p = periodoDe(c.fecha, gran);
    if (!p) continue;
    if (!porPeriodo.has(p.key)) porPeriodo.set(p.key, { ...p, total: 0, realizadas: 0 });
    const g = porPeriodo.get(p.key);
    g.total++;
    if (c.estatus === 'completado') g.realizadas++;
  }
  const ordenados = [...porPeriodo.values()].sort((a, b) => a.key.localeCompare(b.key));
  const idxActual = ordenados.findIndex(p => p.key === actual.key);
  const act = idxActual >= 0 ? ordenados[idxActual] : { ...actual, total: 0, realizadas: 0 };
  const prev = idxActual > 0 ? ordenados[idxActual - 1]
    : (idxActual === -1 && ordenados.length ? ordenados[ordenados.length - 1] : null);
  const delta = prev ? act.total - prev.total : null;
  const historial = ordenados.slice(-6);
  const maxH = Math.max(1, ...historial.map(p => p.total));

  return (
    <div className="crm-chart-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}><CalendarCheck size={16} style={{ verticalAlign: -2, color: C.gold }} /> Citas — {titulo}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {GRANULARIDADES.map(g => (
            <button key={g.id} className={`f-tab${gran === g.id ? ' active' : ''}`} onClick={() => setGran(g.id)}>{g.label}</button>
          ))}
        </div>
      </div>
      <p className="sub" style={{ margin: '4px 0 14px' }}>Recordatorios tipo "cita" por fecha — agenda tus citas desde el expediente del cliente o Recordatorios para que cuenten aquí.</p>
      <div className="crm-kpi-detail">
        <div className="crm-kpi-box">
          <div className="k-label">Este {gran === 'anio' ? 'año' : gran} ({act.label})</div>
          <div className="k-value">{act.total}</div>
          <div className="k-sub">{act.realizadas} realizadas · {act.total - act.realizadas} por venir</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">{gran === 'anio' ? 'Año' : gran.charAt(0).toUpperCase() + gran.slice(1)} anterior {prev ? `(${prev.label})` : ''}</div>
          <div className="k-value">{prev ? prev.total : '—'}</div>
          <div className="k-sub">{prev ? `${prev.realizadas} realizadas` : 'sin citas registradas'}</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Comparativo</div>
          <div className="k-value" style={{ color: delta === null ? C.textLight : delta >= 0 ? C.green : C.red }}>
            {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
          </div>
          <div className="k-sub">{delta === null ? 'aún sin periodo previo' : delta >= 0 ? 'vas arriba del periodo anterior 💪' : 'agenda más citas para alcanzarlo'}</div>
        </div>
      </div>
      {historial.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 6 }}>
          {historial.map(p => (
            <div key={p.key} style={{ textAlign: 'center', flex: 1, maxWidth: 90 }}>
              <div style={{ height: 54, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ width: 26, height: `${Math.max(8, (p.total / maxH) * 54)}px`, borderRadius: 6, background: p.key === act.key ? C.gold : 'rgba(11,27,51,.15)' }} title={`${p.total} citas`} />
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{p.label}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{p.total}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Reporte de ritmo: tasas de transición de industria + forecast ──
   Modelo: cada semana un cliente avanza una etapa con la tasa de
   transición de industria (15→10→8→4→2→1). Con el stock actual se
   estima en cuántos días llega el próximo cierre. */
function RitmoReport({ clients, titulo }) {
  const pre = BENCHMARK_SEMANAL.slice(0, 5); // etapas antes de "emitida"
  const rates = pre.map((b, i) => BENCHMARK_SEMANAL[i + 1].meta / b.meta); // [.67,.8,.5,.5,.5]
  const stock = pre.map(b => clients.filter(c => c.etapa === b.id).length);
  const probCierre = pre.map((_, i) => rates.slice(i).reduce((a, r) => a * r, 1));
  const esperados = stock.reduce((s, n, i) => s + n * probCierre[i], 0);

  // semana en que el acumulado de cierres esperados llega a 1
  let dias = null, acum = 0;
  for (let w = 1; w <= 5 && dias === null; w++) {
    for (let i = 0; i < 5; i++) if (5 - i === w) acum += stock[i] * probCierre[i];
    if (acum >= 1) dias = w * 7;
  }
  const porProspecto = probCierre[0]; // ≈ 1/15
  const faltan = esperados >= 1 ? 0 : Math.ceil((1 - esperados) / porProspecto);

  return (
    <div className="crm-chart-card" style={{ marginBottom: 20 }}>
      <h3>📈 Reporte de ritmo — {titulo}</h3>
      <p className="sub">Proceso de 8 pasos vs benchmark semanal de la industria (15 → 10 → 8 → 4 → 2 → 1)</p>
      <div className="crm-kpi-detail">
        <div className="crm-kpi-box">
          <div className="k-label">Próximo cierre estimado</div>
          <div className="k-value" style={{ color: dias ? C.green : C.amber }}>{dias ? `~${dias} días` : '—'}</div>
          <div className="k-sub">{dias ? 'a tu ritmo actual, con tasas de industria' : 'el pipeline actual no alcanza para 1 cierre'}</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">Cierres en tu pipeline</div>
          <div className="k-value">{esperados.toFixed(1)}</div>
          <div className="k-sub">pólizas esperadas del stock actual</div>
        </div>
        <div className="crm-kpi-box">
          <div className="k-label">{faltan > 0 ? 'Prospectos faltantes' : 'Ritmo saludable'}</div>
          <div className="k-value" style={{ color: faltan > 0 ? C.red : C.green }}>{faltan > 0 ? `+${faltan}` : '✓'}</div>
          <div className="k-sub">{faltan > 0 ? 'para asegurar tu próximo cierre' : 'mantén 15 prospectos nuevos por semana'}</div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Etapa</th><th>En tu tablero</th><th>Benchmark semanal</th><th>Tasa de transición</th></tr></thead>
          <tbody>
            {pre.map((b, i) => {
              const e = ETAPAS.find(x => x.id === b.id);
              const ok = stock[i] >= b.meta;
              return (
                <tr key={b.id}>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color }} />{e.label}</span></td>
                  <td><b style={{ color: ok ? C.green : C.amber }}>{stock[i]}</b></td>
                  <td style={{ color: C.textMuted }}>{b.meta}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>→ {(rates[i] * 100).toFixed(0)}% pasa a {ETAPAS.find(x => x.id === BENCHMARK_SEMANAL[i + 1].id)?.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: C.textLight, margin: '10px 0 0' }}>
        Con el histórico de cambios de etapa (bitácora) las tasas se irán personalizando por asesor; hoy se usan las de industria.
      </p>
    </div>
  );
}

const KANBAN_CSS = `
  .kb-board { display:flex; gap:14px; overflow-x:auto; padding-bottom:16px; align-items:flex-start; -webkit-overflow-scrolling:touch; }
  .kb-col { min-width:238px; width:238px; flex-shrink:0; background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(246,248,251,.92)); border-radius:16px; border:1px solid rgba(11,27,51,.08); display:flex; flex-direction:column; max-height:calc(100vh - 300px); box-shadow:0 1px 2px rgba(11,27,51,.03); }
  .kb-col.drag-over { border-color:${C.gold}; background:${C.goldBg}; box-shadow:0 0 0 3px rgba(193,151,91,.25), 0 12px 28px -18px rgba(11,27,51,.35); }
  .kb-col-head { padding:13px 15px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(11,27,51,.07); position:sticky; top:0; z-index:1; }
  .kb-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; box-shadow:0 0 0 3px rgba(11,27,51,.06); }
  .kb-col-title { font-size:11.5px; font-weight:700; color:${C.ink}; flex:1; text-transform:uppercase; letter-spacing:1.2px; }
  .kb-count { font-size:11.5px; font-weight:700; color:${C.textMuted}; background:${C.white}; border:1px solid rgba(11,27,51,.1); border-radius:12px; padding:1px 8px; font-variant-numeric:tabular-nums; }
  .kb-col-total { font-size:11px; font-weight:700; color:${C.green}; padding:8px 4px 0; font-variant-numeric:tabular-nums; }
  .kb-col-body { padding:10px; overflow-y:auto; display:flex; flex-direction:column; gap:9px; min-height:60px; }
  .kb-card { background:linear-gradient(180deg,#fff,#FDFDFB); border:1px solid rgba(11,27,51,.09); border-radius:12px; padding:11px 13px; cursor:grab; transition:box-shadow .18s, transform .18s, opacity .15s, border-color .18s; box-shadow:0 1px 2px rgba(11,27,51,.04); }
  .kb-card:hover { transform:translateY(-2px); border-color:rgba(11,27,51,.16); box-shadow:0 12px 24px -14px rgba(0,43,117,.4); }
  .kb-card:active { cursor:grabbing; }
  .kb-card.dragging { opacity:.45; transform:rotate(1.5deg) scale(.98); }
  .kb-card-name { font-size:13px; font-weight:700; color:${C.ink}; display:flex; align-items:center; gap:6px; }
  .kb-card-sub { font-size:11px; color:${C.textMuted}; margin-top:2px; }
  .kb-card-meta { display:flex; justify-content:space-between; align-items:center; margin-top:9px; gap:6px; }
  .kb-prima { font-size:11.5px; font-weight:700; color:${C.green}; font-variant-numeric:tabular-nums; }
  .kb-move { display:none; }
  .kb-empty { font-size:11.5px; color:${C.textLight}; text-align:center; padding:16px 6px; border:1.5px dashed rgba(11,27,51,.15); border-radius:10px; font-style:italic; }
  @media(max-width:768px){
    .kb-col { min-width:78vw; width:78vw; max-height:none; }
    .kb-board { scroll-snap-type:x mandatory; }
    .kb-col { scroll-snap-align:start; }
    .kb-card { cursor:default; }
    .kb-move { display:block; width:100%; margin-top:8px; padding:7px 8px; border:1px solid rgba(11,27,51,.14); border-radius:8px; font-size:12px; font-family:inherit; background:${C.white}; color:${C.text}; }
  }
`;

export default function CrmPipelineView({ isAgency }) {
  const [clients, setClients] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [agentFilter, setAgentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [search, setSearch] = useState('');
  const [reminders, setReminders] = useState([]);
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [embudoEtapa, setEmbudoEtapa] = useState(null); // etapa expandida en el embudo
  const [newForm, setNewForm] = useState(null); // alta manual de prospecto desde el pipeline
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);   // tarjeta abierta: datos + notas por etapa
  const [notes, setNotes] = useState(null);
  const [noteText, setNoteText] = useState('');

  const openDetail = async (c) => {
    setDetail(c); setNotes(null); setNoteText('');
    try { const d = await api.crmGetNotes(c.id); setNotes(d.notes || []); }
    catch { setNotes([]); }
  };

  const addNote = async () => {
    if (!noteText.trim() || !detail) return;
    const etapa = ETAPAS.find(e => e.id === detail.etapa);
    try {
      await api.crmCreateNote({ client_id: detail.id, tipo: 'nota', texto: `[${etapa?.label || detail.etapa}] ${noteText.trim()}` });
      setNoteText('');
      const d = await api.crmGetNotes(detail.id);
      setNotes(d.notes || []);
    } catch (e) { alert(e.message); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, a, r] = await Promise.all([
        api.crmGetClients(), api.crmGetPolicies(), api.crmGetAgents(),
        api.crmGetReminders().catch(() => ({ reminders: [] })),
      ]);
      setClients(c.clients || []); setPolicies(p.policies || []); setAgents(a.agents || []);
      setReminders(r.reminders || []);
      if (!agentFilter && (a.agents || []).length) setAgentFilter(String(a.agents[0].id));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [agentFilter]);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const createProspecto = async () => {
    if (!newForm.nombre) return alert('El nombre es requerido');
    if (isAgency && !agentFilter) return alert('Selecciona un asesor en el filtro para asignarle el prospecto');
    setSaving(true);
    try {
      await api.crmCreateClient({
        nombre: newForm.nombre, telefono: newForm.telefono, ocupacion: newForm.ocupacion,
        etapa: newForm.etapa, origen: newForm.origen || 'referido', aseguradora: newForm.aseguradora || 'PRU',
        ...(isAgency ? { agent_id: Number(agentFilter) } : {}),
      });
      setNewForm(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const primaByClient = useMemo(() => {
    const m = {};
    for (const p of policies) {
      if (p.estatus === 'cancelada') continue;
      m[p.client_id] = (m[p.client_id] || 0) + (Number(p.prima) || 0);
    }
    return m;
  }, [policies]);

  const visible = clients.filter(c => {
    if (isAgency && agentFilter && String(c.agent_id) !== agentFilter) return false;
    if (search && !(c.nombre || '').toLowerCase().includes(search.toLowerCase())) return false;
    /* Filtro de fechas: leads dados de alta en el rango — con un mes o una
       semana seleccionada se ve en qué estatus quedó cada lead de ese periodo */
    const alta = String(c.created_at || '').slice(0, 10);
    if (fDesde && alta && alta < fDesde) return false;
    if (fHasta && alta && alta > fHasta) return false;
    return true;
  });
  const currentAgent = agents.find(a => String(a.id) === agentFilter);

  const moveClient = async (clientId, etapa) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || client.etapa === etapa) return;
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, etapa } : c)); // optimista
    try { await api.crmUpdateClient(clientId, { etapa }); }
    catch (e) { alert(e.message); load(); }
  };

  if (loading) return <><style>{getCrmCSS()}{KANBAN_CSS}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando pipeline...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}{KANBAN_CSS}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Pipeline</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {isAgency && currentAgent ? `Kanban de ${currentAgent.nombre}` : 'Arrastra tus clientes entre etapas'}
          </p>
        </div>
        <div className="crm-toolbar-right">
          <div className="crm-search-wrap">
            <Search size={15} />
            <input className="crm-search" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.clave})</option>)}
              <option value="">— Todos los asesores —</option>
            </select>
          )}
          <input type="date" className="crm-select" title="Alta desde" value={fDesde} onChange={e => setFDesde(e.target.value)} />
          <input type="date" className="crm-select" title="Alta hasta" value={fHasta} onChange={e => setFHasta(e.target.value)} />
          {(fDesde || fHasta) && (
            <button className="f-tab" onClick={() => { setFDesde(''); setFHasta(''); }} title="Quitar filtro de fechas">✕ fechas</button>
          )}
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
          <button className="btn-primary" onClick={() => setNewForm({ nombre: '', telefono: '', ocupacion: '', etapa: 'prospecto', origen: 'referido', aseguradora: 'PRU' })}>
            <Plus size={15} /> Nuevo prospecto
          </button>
        </div>
      </div>

      {/* Citas del periodo vs el anterior (semana/mes/trimestre/año) */}
      <CitasSection
        citas={reminders.filter(r => r.tipo === 'cita' && (!isAgency || !agentFilter || String(r.agent_id) === agentFilter))}
        titulo={isAgency ? (!agentFilter ? 'Promotoría' : (currentAgent?.nombre || '')) : 'tu agenda'} />

      {/* ══ Embudo de leads: todos los leads del asesor con su estatus.
          Con el filtro de fechas se ve en qué estatus quedaron los leads
          dados de alta en ese mes o semana. ══ */}
      <div className="crm-chart-card" style={{ marginBottom: 20 }}>
        <h3>🔻 Embudo de leads {isAgency && currentAgent ? `— ${currentAgent.nombre}` : ''}</h3>
        <p className="sub">
          {visible.length} leads{(fDesde || fHasta) ? ` dados de alta ${fDesde ? `desde ${fDesde}` : ''}${fHasta ? ` hasta ${fHasta}` : ''}` : ' en total'} · haz clic en una etapa para ver quiénes están ahí
        </p>
        {(() => {
          const total = visible.length || 1;
          return ETAPAS.map(etapa => {
            const items = visible.filter(c => c.etapa === etapa.id);
            const pct = items.length / total;
            const abierta = embudoEtapa === etapa.id;
            return (
              <div key={etapa.id} style={{ marginBottom: 6 }}>
                <div onClick={() => setEmbudoEtapa(abierta ? null : etapa.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: etapa.color, flexShrink: 0 }} />
                  <span style={{ width: 150, fontSize: 12.5, fontWeight: 600, color: C.ink, flexShrink: 0 }}>{etapa.label}</span>
                  <div style={{ flex: 1, height: 18, background: 'rgba(11,27,51,.05)', borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct * 100, items.length ? 3 : 0)}%`, height: '100%', background: `${etapa.color}99`, borderRadius: 9, transition: 'width .4s' }} />
                  </div>
                  <b style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{items.length}</b>
                  <span style={{ width: 52, fontSize: 11, color: C.textMuted, textAlign: 'right' }}>{Math.round(pct * 100)}%</span>
                </div>
                {abierta && (
                  <div style={{ margin: '4px 0 10px 169px' }}>
                    {items.length === 0 && <p className="empty" style={{ padding: 8 }}>Nadie en esta etapa</p>}
                    {items.map(c => (
                      <div key={c.id} className="crm-mc-row" style={{ borderBottom: '1px solid rgba(11,27,51,.06)', padding: '5px 0', cursor: 'pointer' }}
                        onClick={() => openDetail(c)}>
                        <span><b>{c.nombre}</b> <span style={{ fontSize: 11, color: C.textMuted }}>{c.telefono || ''}</span></span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>
                          alta {String(c.created_at || '').slice(0, 10)} · últ. mov. {String(c.updated_at || c.created_at || '').slice(0, 10)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Reporte de ritmo solo para administración: a los asesores los desmotiva
          verse abajo del benchmark (acuerdo reunión 30-jul-2026) */}
      {isAgency && <RitmoReport clients={visible} titulo={!agentFilter ? 'Promotoría' : (currentAgent?.nombre || 'Pipeline')} />}

      {/* ══ Detalle de la tarjeta: datos del cliente + notas por etapa ══ */}
      {detail && (() => {
        const etapa = ETAPAS.find(e => e.id === detail.etapa) || ETAPAS[0];
        return (
          <div className="modal-overlay" onClick={() => setDetail(null)}>
            <div className="modal crm-modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h2>{detail.nombre}</h2>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: `${etapa.color}1A`, color: etapa.color }}>{etapa.label}</span>
                    <select className="crm-select" style={{ padding: '4px 10px', fontSize: 12 }} value={detail.etapa}
                      onChange={e => { moveClient(detail.id, e.target.value); setDetail({ ...detail, etapa: e.target.value }); }}>
                      {ETAPAS.map(et => <option key={et.id} value={et.id}>Mover a: {et.label}</option>)}
                    </select>
                    {detail.telefono && (
                      <a href={`https://wa.me/${detail.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                        style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none', fontSize: 12.5 }}>WhatsApp ↗</a>
                    )}
                  </div>
                </div>
                <button className="close-btn" onClick={() => setDetail(null)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                {/* Datos del cliente */}
                <div className="crm-kpi-detail" style={{ marginBottom: 14 }}>
                  <div className="crm-kpi-box"><div className="k-label">Contacto</div><div style={{ fontSize: 13.5 }}>{detail.telefono || '—'}<br /><span style={{ color: C.textMuted, fontSize: 12 }}>{detail.email || ''}</span></div></div>
                  <div className="crm-kpi-box"><div className="k-label">Ocupación</div><div style={{ fontSize: 13.5 }}>{detail.ocupacion || '—'}{detail.empresa ? ` · ${detail.empresa}` : ''}</div></div>
                  <div className="crm-kpi-box"><div className="k-label">Origen / Cartera</div><div style={{ fontSize: 13.5, textTransform: 'capitalize' }}>{detail.origen || '—'} · {detail.aseguradora === 'IL' ? 'Insignia Life' : 'Prudential'}</div></div>
                  {primaByClient[detail.id] > 0 && <div className="crm-kpi-box"><div className="k-label">Prima en pólizas</div><div style={{ fontSize: 13.5, fontWeight: 700, color: C.green }}>{fmtMoney(primaByClient[detail.id])}</div></div>}
                </div>
                {detail.motivo_no_compra && (
                  <div className="info-box" style={{ marginBottom: 12, background: C.amberBg, borderColor: `${C.amber}40` }}>
                    <p>🚧 <b>Objeción registrada:</b> {detail.motivo_no_compra}</p>
                  </div>
                )}
                {detail.notas && <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14 }}>📄 {detail.notas}</p>}

                {/* Notas por etapa */}
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Notas de seguimiento</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <textarea rows={2} style={{ flex: 1, padding: '9px 12px', border: '1px solid rgba(11,27,51,.14)', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder={`Nota en "${etapa.label}" — qué pasó, qué sigue...`}
                    value={noteText} onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }} />
                  <button className="btn-primary" disabled={!noteText.trim()} onClick={addNote}><Plus size={15} /></button>
                </div>
                {notes === null && <div className="loading-wrap" style={{ minHeight: 60 }}><div className="spinner" /></div>}
                {notes !== null && notes.length === 0 && <p className="empty">Sin notas aún — deja la primera para este cliente.</p>}
                {(notes || []).map(n => (
                  <div key={n.id} className="crm-file-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="fname" style={{ whiteSpace: 'pre-wrap' }}>{n.texto}</div>
                      <div className="fmeta">{n.user_name || ''} · {new Date(n.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Alta manual de prospecto (asesores y admin) ══ */}
      {newForm && (
        <div className="modal-overlay" onClick={() => setNewForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Nuevo prospecto {isAgency && currentAgent ? `— ${currentAgent.nombre}` : ''}</h2>
              <button className="close-btn" onClick={() => setNewForm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0 14px' }}>
                <div className="field"><label>Nombre *</label><input value={newForm.nombre} onChange={e => setNewForm({ ...newForm, nombre: e.target.value })} /></div>
                <div className="field"><label>Teléfono</label><input value={newForm.telefono} onChange={e => setNewForm({ ...newForm, telefono: e.target.value })} /></div>
                <div className="field"><label>Ocupación</label><input value={newForm.ocupacion} onChange={e => setNewForm({ ...newForm, ocupacion: e.target.value })} /></div>
                <div className="field"><label>Etapa</label>
                  <select value={newForm.etapa} onChange={e => setNewForm({ ...newForm, etapa: e.target.value })}>
                    {ETAPAS.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>Origen</label>
                  <select value={newForm.origen} onChange={e => setNewForm({ ...newForm, origen: e.target.value })}>
                    {['referido', 'frio', 'campania', 'evento', 'otro'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="field"><label>Aseguradora</label>
                  <select value={newForm.aseguradora} onChange={e => setNewForm({ ...newForm, aseguradora: e.target.value })}>
                    <option value="PRU">Prudential</option><option value="IL">Insignia Life</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setNewForm(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={createProspecto}>{saving ? 'Guardando...' : 'Crear prospecto'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="kb-board">
        {ETAPAS.map(etapa => {
          const items = visible.filter(c => c.etapa === etapa.id);
          const totalPrima = items.reduce((s, c) => s + (primaByClient[c.id] || 0), 0);
          return (
            <div
              key={etapa.id}
              className={`kb-col${overCol === etapa.id ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setOverCol(etapa.id); }}
              onDragLeave={() => setOverCol(o => (o === etapa.id ? null : o))}
              onDrop={e => { e.preventDefault(); setOverCol(null); if (dragId) moveClient(dragId, etapa.id); setDragId(null); }}
            >
              <div className="kb-col-head" style={{ background: `${etapa.color}0D`, borderRadius: '16px 16px 0 0' }}>
                <span className="kb-dot" style={{ background: etapa.color }} />
                <span className="kb-col-title">{etapa.label}</span>
                <span className="kb-count">{items.length}</span>
                <button title={`Agregar cliente en ${etapa.label}`} onClick={() => setNewForm({ nombre: '', telefono: '', ocupacion: '', etapa: etapa.id, origen: 'referido', aseguradora: 'PRU' })}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.textMuted, padding: 2, display: 'inline-flex' }}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="kb-col-body">
                {totalPrima > 0 && <div className="kb-col-total">Prima: {fmtMoney(totalPrima)}</div>}
                {items.length === 0 && <div className="kb-empty">Suelta aquí</div>}
                {items.map(c => (
                  <div
                    key={c.id}
                    className={`kb-card${dragId === c.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => { if (!dragId) openDetail(c); }}
                  >
                    <div className="kb-card-name"><GripVertical size={12} style={{ color: C.textLight, flexShrink: 0 }} />{c.nombre}</div>
                    {(c.ocupacion || c.empresa) && <div className="kb-card-sub">{c.ocupacion}{c.empresa ? ` · ${c.empresa}` : ''}</div>}
                    {isAgency && !agentFilter && c.crm_agents?.nombre && <div className="kb-card-sub">👤 {c.crm_agents.nombre}</div>}
                    <div className="kb-card-meta">
                      {primaByClient[c.id] ? <span className="kb-prima">{fmtMoney(primaByClient[c.id])}</span> : <span className="kb-card-sub" style={{ textTransform: 'capitalize' }}>{c.origen || ''}</span>}
                      {c.telefono && (
                        <a href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          style={{ color: '#25D366', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
                          <Phone size={13} />
                        </a>
                      )}
                    </div>
                    {/* Móvil: mover con selector */}
                    <select className="kb-move" value={c.etapa} onClick={e => e.stopPropagation()} onChange={e => moveClient(c.id, e.target.value)}>
                      {ETAPAS.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
