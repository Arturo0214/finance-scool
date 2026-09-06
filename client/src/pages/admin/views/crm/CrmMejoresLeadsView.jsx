/**
 * CrmMejoresLeadsView — CRM de seguimiento de la base "Mejores Leads"
 * (Tesipedia, corte limpio 2026-09-06 con precios reales de cotización).
 * Solo administración: reactivación por WhatsApp, estado de seguimiento,
 * asignación y bitácora de notas. Sin cotizador.
 *
 * Diseño: "salón de la bóveda" — placa de tesorería en marino grabado
 * champagne sobre porcelana, lomos de libro mayor como pestañas, sellos
 * de lacre para el estado de cotización y bitácora tipo timeline.
 */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Search, MessageCircle, ChevronDown, RefreshCw, Stethoscope, HeartPulse, Gem } from 'lucide-react';

const BUCKETS = [
  { id: 'compradores',  label: 'Compradores VIP', roman: 'I',   sub: 'Ya pagaron — upsell, referidos y testimonio',            money: 'pagado' },
  { id: 'prioritarios', label: 'Prioritarios',    roman: 'II',  sub: 'Cotización ≥$15k o médico+posgrado — reactivar primero', money: 'juego' },
  { id: 'resto',        label: 'Potenciales',     roman: 'III', sub: 'Alto valor en segunda prioridad',                        money: 'juego' },
];
const esComprador = (b) => b === 'compradores';

const SEG_STATUSES = [
  { id: 'pendiente',  label: 'Pendiente',  color: '#B97F1E' },
  { id: 'contactado', label: 'Contactado', color: '#2563EB' },
  { id: 'interesado', label: 'Interesado', color: '#7C3AED' },
  { id: 'negociando', label: 'Negociando', color: '#0891B2' },
  { id: 'convertido', label: 'Convertido', color: '#0E8A63' },
  { id: 'descartado', label: 'Descartado', color: '#C93A3A' },
];
const segInfo = (id) => SEG_STATUSES.find(s => s.id === id) || SEG_STATUSES[0];

const COTIZ = {
  PAGADA:   { label: 'Pagada',   cls: 'pagada' },
  approved: { label: 'Aceptada', cls: 'aceptada' },
  pending:  { label: 'Abierta',  cls: 'abierta' },
};

const PAGE = 50;

const fmtMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
};
const fmtMoneyFull = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fmtFecha = (d) => {
  if (!d) return '—';
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' });
};
const montoDe = (l) => esComprador(l.bucket) ? (Number(l.pago) || Number(l.precio_real) || 0) : (Number(l.precio_real) || 0);

/* ─────────────────────────────────────────────────────────────── */

export default function CrmMejoresLeadsView() {
  const [leads, setLeads] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState('compradores');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [nivelFilter, setNivelFilter] = useState('');
  const [medicoFilter, setMedicoFilter] = useState(false);
  const [asignadoFilter, setAsignadoFilter] = useState('');
  const [orden, setOrden] = useState('score');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [notaDraft, setNotaDraft] = useState('');
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { leads: data, admins: adm } = await api.crmGetMejoresLeads();
      setLeads(data || []);
      setAdmins(adm || []);
    } catch (e) { console.error(e); alert(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => { setPage(0); setExpanded(null); }, [bucket, statusFilter, nivelFilter, medicoFilter, asignadoFilter, search, orden]);

  const enBucket = useMemo(() => leads.filter(l => l.bucket === bucket), [leads, bucket]);
  const niveles = useMemo(() => [...new Set(enBucket.map(l => l.nivel).filter(Boolean))].sort(), [enBucket]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = enBucket.filter(l => {
      if (statusFilter !== 'todos' && (l.seg_status || 'pendiente') !== statusFilter) return false;
      if (nivelFilter && l.nivel !== nivelFilter) return false;
      if (medicoFilter && !l.medico) return false;
      if (asignadoFilter === 'sin' && l.seg_assigned_to) return false;
      if (asignadoFilter && asignadoFilter !== 'sin' && l.seg_assigned_to !== asignadoFilter) return false;
      if (q) {
        const blob = `${l.nombre || ''} ${l.whatsapp || ''} ${l.telefono || ''} ${l.carrera || ''} ${l.tema || ''} ${l.vendedor || ''} ${l.atendido_por || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    if (orden === 'precio') out.sort((a, b) => montoDe(b) - montoDe(a));
    else if (orden === 'fecha') out.sort((a, b) => String(b.fecha_lead || '').localeCompare(String(a.fecha_lead || '')));
    else out.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return out;
  }, [enBucket, statusFilter, nivelFilter, medicoFilter, asignadoFilter, search, orden]);

  const statusCounts = useMemo(() => {
    const c = Object.fromEntries(SEG_STATUSES.map(s => [s.id, 0]));
    for (const l of enBucket) c[l.seg_status || 'pendiente']++;
    return c;
  }, [enBucket]);

  const tesoro = useMemo(() => {
    let pagado = 0, pipeline = 0;
    const porBucket = Object.fromEntries(BUCKETS.map(b => [b.id, 0]));
    for (const l of leads) {
      if (esComprador(l.bucket)) { pagado += Number(l.pago) || 0; porBucket[l.bucket] += Number(l.pago) || 0; }
      else { pipeline += Number(l.precio_real) || 0; porBucket[l.bucket] += Number(l.precio_real) || 0; }
    }
    return { pagado, pipeline, porBucket };
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const visibles = filtrados.slice(page * PAGE, (page + 1) * PAGE);

  const update = async (lead, data) => {
    setSaving(lead.id);
    try {
      const { lead: actualizado } = await api.crmUpdateMejorLead(lead.id, data);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...actualizado } : l));
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  };

  const agregarNota = async (lead) => {
    if (!notaDraft.trim()) return;
    await update(lead, { nota: notaDraft });
    setNotaDraft('');
  };

  const waLink = (l) => {
    const num = String(l.whatsapp || l.telefono || '').replace(/\D/g, '');
    return num ? `https://wa.me/${num}` : null;
  };

  if (loading) {
    return (
      <div className="view">
        <style>{MLV_CSS}</style>
        <div className="loading-wrap"><div className="spinner" /><p>Abriendo la bóveda de leads...</p></div>
      </div>
    );
  }

  const bucketInfo = BUCKETS.find(b => b.id === bucket);
  const animKey = `${bucket}|${statusFilter}|${nivelFilter}|${medicoFilter}|${asignadoFilter}|${search}|${orden}|${page}`;

  /* ── Sub-renderers compartidos entre libro mayor y fichas ── */

  const renderSeguimiento = (l) => (
    <span className="mlv-seg">
      <span className="mlv-pill-select" style={{ '--st': segInfo(l.seg_status).color }}>
        <select
          disabled={saving === l.id}
          value={l.seg_status || 'pendiente'}
          onChange={e => update(l, { seg_status: e.target.value })}
        >
          {SEG_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </span>
      <span className="mlv-assign-select">
        <select
          disabled={saving === l.id}
          value={l.seg_assigned_to || ''}
          onChange={e => update(l, { seg_assigned_to: e.target.value })}
        >
          <option value="">Sin asignar</option>
          {admins.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
      </span>
    </span>
  );

  const renderAcciones = (l) => (
    <span className="mlv-actions">
      {waLink(l) && (
        <a className="mlv-icon-btn wa" title="Abrir WhatsApp" href={waLink(l)} target="_blank" rel="noreferrer">
          <MessageCircle size={14} />
        </a>
      )}
      <button
        className={`mlv-icon-btn expand${expanded === l.id ? ' open' : ''}`}
        title={expanded === l.id ? 'Cerrar expediente' : 'Abrir expediente'}
        onClick={() => { setExpanded(expanded === l.id ? null : l.id); setNotaDraft(''); }}
      >
        <ChevronDown size={14} />
      </button>
    </span>
  );

  const renderBadges = (l) => (
    <>
      {l.medico === 'SI' && <i className="mlv-medic" title="Médico"><Stethoscope size={11} /></i>}
      {l.medico === 'salud' && <i className="mlv-medic salud" title="Área de la salud"><HeartPulse size={11} /></i>}
      {l.perfil === 'ALTO' && <i className="mlv-alto" title="Perfil alto">ALTO</i>}
    </>
  );

  const renderCotizChip = (l) => {
    const c = COTIZ[l.estado_cotiz];
    if (!c) return <i className="mlv-cotiz sin">sin cotiz.</i>;
    return <i className={`mlv-cotiz ${c.cls}`}>{c.label}{l.num_cotiz > 1 ? ` ×${l.num_cotiz}` : ''}</i>;
  };

  const renderDetalle = (l) => (
    <div className="mlv-dossier">
      <div className="mlv-dossier-head">
        <span className="mlv-dossier-title">Expediente</span>
        <span className="mlv-dossier-rule" />
        <span className="mlv-dossier-folio">Folio {String(l.id).padStart(4, '0')}</span>
      </div>
      <div className="mlv-dossier-grid">
        <span><i>WhatsApp</i><b>{l.whatsapp || '—'}</b></span>
        <span><i>Teléfono</i><b>{l.telefono || '—'}</b></span>
        <span><i>Servicio</i><b>{l.servicio || '—'}{l.paginas ? ` · ${l.paginas} págs` : ''}</b></span>
        <span><i>Cotización</i><b>{l.fuente_precio === 'cotización' ? `${l.num_cotiz || 1} emitida${(l.num_cotiz || 1) > 1 ? 's' : ''} · últ. ${fmtFecha(l.ult_cotiz)}` : 'sin cotización'}</b></span>
        {esComprador(l.bucket) && <span><i>Pagó</i><b>{l.pago ? fmtMoneyFull(l.pago) : '—'}</b></span>}
        <span><i>Vendedor</i><b>{l.vendedor || l.atendido_por || '—'}</b></span>
        <span><i>Lead desde</i><b>{fmtFecha(l.fecha_lead)}{l.campana ? ` · ${l.campana}` : ''}</b></span>
        {l.razon_descarte && <span><i>Razón descarte</i><b>{l.razon_descarte}</b></span>}
        {l.seg_last_contact && <span><i>Último movimiento</i><b>{fmtFecha(String(l.seg_last_contact).slice(0, 10))}</b></span>}
      </div>
      {l.tema && <p className="mlv-tema">“{l.tema}”</p>}
      {l.notas_origen && <p className="mlv-notas-origen"><i>Notas de origen:</i> {l.notas_origen}</p>}

      <div className="mlv-dossier-head" style={{ marginTop: 18 }}>
        <span className="mlv-dossier-title">Bitácora</span>
        <span className="mlv-dossier-rule" />
        <span className="mlv-dossier-folio">{(l.seg_notes_log || []).length} nota{(l.seg_notes_log || []).length === 1 ? '' : 's'}</span>
      </div>
      {(l.seg_notes_log || []).length === 0 && <p className="mlv-bitacora-empty">Aún sin movimientos registrados.</p>}
      <div className="mlv-timeline">
        {(l.seg_notes_log || []).slice().reverse().map((n, i) => (
          <div key={i} className="mlv-tl-entry">
            <span className="mlv-tl-dot" />
            <div>
              <p className="mlv-tl-text">{n.text}</p>
              <p className="mlv-tl-meta">{n.by} · {new Date(n.at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mlv-nota-form">
        <input
          placeholder="Asentar nota de seguimiento..."
          value={notaDraft} onChange={e => setNotaDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') agregarNota(l); }}
        />
        <button disabled={saving === l.id || !notaDraft.trim()} onClick={() => agregarNota(l)}>
          {saving === l.id ? '…' : 'Asentar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="view mlv">
      <style>{MLV_CSS}</style>

      {/* ══ Placa de tesorería ══ */}
      <header className="mlv-plaque">
        <div className="mlv-plaque-frame" aria-hidden="true" />
        <Gem className="mlv-plaque-gem" size={130} strokeWidth={0.55} aria-hidden="true" />
        <div className="mlv-plaque-left">
          <p className="mlv-overline"><span /><em>Bóveda Tesipedia · corte 6 sep 2026 · precios reales</em><span /></p>
          <h1 className="mlv-title">Mejores Leads</h1>
          <p className="mlv-sub">{bucketInfo.sub}</p>
        </div>
        <div className="mlv-plaque-stats">
          <div className="mlv-pstat">
            <i>Cobrado real</i>
            <b>{fmtMoney(tesoro.pagado)}</b>
            <u>{leads.filter(l => esComprador(l.bucket)).length} compradores</u>
          </div>
          <div className="mlv-pstat-divider" />
          <div className="mlv-pstat">
            <i>Pipeline abierto</i>
            <b>{fmtMoney(tesoro.pipeline)}</b>
            <u>{leads.filter(l => !esComprador(l.bucket)).length.toLocaleString('es-MX')} potenciales</u>
          </div>
          <button className="mlv-refresh" onClick={load} title="Actualizar"><RefreshCw size={14} /></button>
        </div>
      </header>

      {/* ══ Lomos del libro mayor (buckets) ══ */}
      <nav className="mlv-tabs" role="tablist">
        {BUCKETS.map(b => {
          const n = leads.filter(l => l.bucket === b.id).length;
          return (
            <button key={b.id} role="tab" aria-selected={bucket === b.id}
              className={`mlv-tab${bucket === b.id ? ' active' : ''}`} onClick={() => setBucket(b.id)}>
              <span className="mlv-tab-roman">{b.roman}</span>
              <span className="mlv-tab-body">
                <span className="mlv-tab-label">{b.label}</span>
                <span className="mlv-tab-count">{n.toLocaleString('es-MX')} leads · {fmtMoney(tesoro.porBucket[b.id])} {b.money === 'pagado' ? 'pagado' : 'en juego'}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* ══ Placas KPI por estado de seguimiento (clic = filtrar) ══ */}
      <div className="mlv-kpis">
        {SEG_STATUSES.map((s, i) => {
          const share = enBucket.length ? statusCounts[s.id] / enBucket.length : 0;
          return (
            <button key={s.id} className={`mlv-kpi${statusFilter === s.id ? ' active' : ''}`}
              style={{ '--st': s.color, '--d': `${i * 55}ms` }}
              onClick={() => setStatusFilter(statusFilter === s.id ? 'todos' : s.id)}>
              <span className="mlv-kpi-label"><span className="mlv-kpi-dot" />{s.label}</span>
              <span className="mlv-kpi-value">{statusCounts[s.id]}</span>
              <span className="mlv-kpi-bar"><span style={{ width: `${Math.max(share * 100, statusCounts[s.id] ? 2 : 0)}%` }} /></span>
            </button>
          );
        })}
      </div>

      {/* ══ Búsqueda, filtros y orden ══ */}
      <div className="mlv-toolbar">
        <div className="mlv-search">
          <Search size={14} />
          <input placeholder="Buscar nombre, teléfono, carrera, tema, vendedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="mlv-filters">
          <span className="mlv-sorter" role="group" aria-label="Ordenar por">
            {[['score', 'Score'], ['precio', 'Precio'], ['fecha', 'Fecha']].map(([id, lab]) => (
              <button key={id} className={orden === id ? 'on' : ''} onClick={() => setOrden(id)}>{lab}</button>
            ))}
          </span>
          <select className="mlv-select" value={nivelFilter} onChange={e => setNivelFilter(e.target.value)}>
            <option value="">Todos los niveles</option>
            {niveles.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="mlv-select" value={asignadoFilter} onChange={e => setAsignadoFilter(e.target.value)}>
            <option value="">Cualquier asignación</option>
            <option value="sin">Sin asignar</option>
            {admins.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <button className={`mlv-toggle${medicoFilter ? ' on' : ''}`} onClick={() => setMedicoFilter(m => !m)}>
            <Stethoscope size={13} /> Salud
          </button>
          {(statusFilter !== 'todos' || nivelFilter || medicoFilter || asignadoFilter || search) && (
            <button className="mlv-clear" onClick={() => { setStatusFilter('todos'); setNivelFilter(''); setMedicoFilter(false); setAsignadoFilter(''); setSearch(''); }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      <p className="mlv-count-line">
        <span>{filtrados.length.toLocaleString('es-MX')} de {enBucket.length.toLocaleString('es-MX')} en este libro</span>
        <span className="mlv-count-rule" />
        <span>orden: {orden === 'score' ? 'score' : orden === 'precio' ? 'precio' : 'lead más reciente'}</span>
      </p>

      {filtrados.length === 0 && (
        <div className="mlv-empty">
          <Gem size={30} strokeWidth={1} />
          <p>Ningún lead responde a estos criterios.</p>
        </div>
      )}

      {/* ══ Libro mayor (desktop) ══ */}
      {filtrados.length > 0 && (
        <div className="mlv-ledger desktop-only-table" key={`t-${animKey}`}>
          <div className="mlv-ledger-head">
            <span>Lead</span>
            <span>Carrera / Tema</span>
            <span className="r">{esComprador(bucket) ? 'Pagó' : 'En juego'}</span>
            <span>Seguimiento</span>
            <span className="r">Acciones</span>
          </div>
          {visibles.map((l, i) => (
            <div key={l.id} className={`mlv-row-wrap${expanded === l.id ? ' open' : ''}`} style={{ '--d': `${Math.min(i, 14) * 30}ms` }}>
              <div className="mlv-row">
                <span className="mlv-cell-lead">
                  <span className="mlv-seal" title={`Score ${l.score ?? '—'}`}>{l.score ?? '—'}</span>
                  <span>
                    <span className="mlv-name">{l.nombre || 'Sin nombre'}{renderBadges(l)}</span>
                    <span className="mlv-name-sub">{l.nivel || '—'}{l.vendedor ? ` · ${l.vendedor}` : ''}</span>
                  </span>
                </span>
                <span className="mlv-cell-tema">
                  <b>{l.carrera || '—'}</b>
                  <i title={l.tema || ''}>{l.tema || ''}</i>
                </span>
                <span className="mlv-cell-precio r">
                  <b>{montoDe(l) ? fmtMoneyFull(montoDe(l)) : '—'}</b>
                  {renderCotizChip(l)}
                </span>
                <span>{renderSeguimiento(l)}</span>
                <span className="r">{renderAcciones(l)}</span>
              </div>
              {expanded === l.id && renderDetalle(l)}
            </div>
          ))}
        </div>
      )}

      {/* ══ Fichas (móvil) ══ */}
      <div className="mobile-only-cards mlv-cards" key={`c-${animKey}`}>
        {visibles.map((l, i) => (
          <div key={l.id} className="mlv-card" style={{ '--d': `${Math.min(i, 10) * 35}ms` }}>
            <div className="mlv-card-top">
              <span className="mlv-seal">{l.score ?? '—'}</span>
              <span className="mlv-card-id">
                <span className="mlv-name">{l.nombre || 'Sin nombre'}{renderBadges(l)}</span>
                <span className="mlv-name-sub">{l.nivel || '—'} · {l.carrera || '—'}</span>
              </span>
              {renderAcciones(l)}
            </div>
            <div className="mlv-card-mid">
              <span><i>{esComprador(l.bucket) ? 'Pagó' : 'En juego'}</i><b>{montoDe(l) ? fmtMoneyFull(montoDe(l)) : '—'}</b></span>
              <span><i>Cotización</i>{renderCotizChip(l)}</span>
            </div>
            {renderSeguimiento(l)}
            {expanded === l.id && renderDetalle(l)}
          </div>
        ))}
      </div>

      {/* ══ Paginación ══ */}
      {totalPages > 1 && (
        <div className="mlv-pager">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span>Folio {page + 1} de {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CSS — "salón de la bóveda": placa de tesorería marino grabada en
   champagne sobre porcelana; hairlines, Fraunces, sellos de lacre.
   ═══════════════════════════════════════════════════════════════ */
const GOLD = '#C1975B';
const INK = '#0B1B33';

const MLV_CSS = `
  .mlv { --gold:${GOLD}; --ink:${INK}; --hair:rgba(11,27,51,.09); }

  @keyframes mlvRise { from { opacity:0; transform:translateY(9px); } to { opacity:1; transform:none; } }
  @keyframes mlvUnfold { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
  @keyframes mlvGlow { from { opacity:.16; } to { opacity:.3; } }

  /* ── Placa de tesorería ── */
  .mlv-plaque { position:relative; overflow:hidden; display:flex; justify-content:space-between; align-items:center; gap:22px; flex-wrap:wrap; margin-bottom:22px; padding:26px 30px 24px; border-radius:18px; background:radial-gradient(120% 160% at 8% 0%, #14315E 0%, ${INK} 52%, #081324 100%); box-shadow:0 18px 44px -22px rgba(4,12,26,.65), inset 0 1px 0 rgba(255,255,255,.07); animation:mlvRise .5s ease backwards; }
  .mlv-plaque-frame { position:absolute; inset:9px; border:1px solid rgba(193,151,91,.32); border-radius:12px; pointer-events:none; }
  .mlv-plaque-frame::before { content:'◆'; position:absolute; top:-8px; left:50%; transform:translateX(-50%); font-size:9px; color:rgba(193,151,91,.75); background:transparent; padding:0 8px; }
  .mlv-plaque-gem { position:absolute; right:-14px; bottom:-32px; color:rgba(193,151,91,.5); opacity:.2; pointer-events:none; animation:mlvGlow 4s ease-in-out infinite alternate; }
  .mlv-plaque-left { position:relative; min-width:0; }
  .mlv-overline { display:flex; align-items:center; gap:10px; margin:0 0 7px; }
  .mlv-overline span { height:1px; width:26px; background:linear-gradient(90deg,transparent,rgba(193,151,91,.85)); }
  .mlv-overline span:last-child { background:linear-gradient(90deg,rgba(193,151,91,.85),transparent); }
  .mlv-overline em { font-style:normal; font-size:9.5px; letter-spacing:2.6px; text-transform:uppercase; color:#D6B37E; font-weight:700; white-space:nowrap; }
  /* .admin-wrap h1 pisa el color con inherit — se necesita mayor especificidad */
  .admin-wrap .mlv h1.mlv-title { font-family:'Fraunces',Georgia,serif; font-size:31px; font-weight:600; letter-spacing:-.4px; margin:0; color:#F2E4C8; text-shadow:0 1px 0 rgba(0,0,0,.35), 0 0 22px rgba(193,151,91,.35); }
  .mlv-sub { font-size:12.5px; color:rgba(233,240,250,.6); margin:5px 0 0; }
  .mlv-plaque-stats { position:relative; display:flex; align-items:center; gap:22px; }
  .mlv-pstat { display:flex; flex-direction:column; }
  .mlv-pstat i { font-style:normal; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(214,179,126,.85); font-weight:700; }
  .mlv-pstat b { font-family:'Fraunces',Georgia,serif; font-size:26px; font-weight:600; color:#F6F1E6; font-variant-numeric:tabular-nums; letter-spacing:-.4px; line-height:1.15; }
  .mlv-pstat u { text-decoration:none; font-size:10.5px; color:rgba(233,240,250,.5); }
  .mlv-pstat-divider { width:1px; align-self:stretch; background:linear-gradient(180deg,transparent,rgba(193,151,91,.4),transparent); }
  .mlv-refresh { width:36px; height:36px; border-radius:50%; border:1px solid rgba(193,151,91,.4); background:rgba(255,255,255,.04); color:#D6B37E; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .25s; }
  .mlv-refresh:hover { border-color:var(--gold); background:rgba(193,151,91,.14); transform:rotate(90deg); }

  /* ── Lomos del libro mayor ── */
  .mlv-tabs { display:flex; gap:10px; margin-bottom:20px; animation:mlvRise .5s .06s ease backwards; }
  .mlv-tab { flex:1; display:flex; align-items:center; gap:12px; text-align:left; padding:13px 16px; cursor:pointer; font-family:inherit; background:linear-gradient(180deg,#fff,#FCFCFA); border:1px solid var(--hair); border-radius:14px 14px 4px 4px; position:relative; overflow:hidden; transition:all .25s ease; }
  .mlv-tab::after { content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:linear-gradient(90deg,transparent 4%, var(--gold), transparent 96%); opacity:0; transition:opacity .25s; }
  .mlv-tab:hover { border-color:rgba(11,27,51,.2); transform:translateY(-1px); }
  .mlv-tab.active { border-color:rgba(193,151,91,.55); box-shadow:0 12px 26px -18px rgba(0,43,117,.45); }
  .mlv-tab.active::after { opacity:1; }
  .mlv-tab-roman { font-family:'Fraunces',Georgia,serif; font-size:19px; font-weight:600; color:rgba(11,27,51,.24); width:28px; text-align:center; flex-shrink:0; transition:color .25s; }
  .mlv-tab.active .mlv-tab-roman { color:var(--gold); }
  .mlv-tab-body { display:flex; flex-direction:column; min-width:0; }
  .mlv-tab-label { font-size:13.5px; font-weight:700; color:var(--ink); letter-spacing:.1px; white-space:nowrap; }
  .mlv-tab-count { font-size:10.5px; color:${C.textMuted}; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* ── Placas KPI ── */
  .mlv-kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:20px; }
  .mlv-kpi { font-family:inherit; text-align:left; background:linear-gradient(180deg,#fff,#FDFDFB); border:1px solid var(--hair); border-radius:12px; padding:11px 13px 10px; cursor:pointer; position:relative; transition:all .22s ease; animation:mlvRise .45s var(--d) ease backwards; }
  .mlv-kpi::before { content:''; position:absolute; top:0; left:12px; right:12px; height:2px; border-radius:0 0 2px 2px; background:linear-gradient(90deg,transparent,var(--st),transparent); opacity:0; transition:opacity .25s; }
  .mlv-kpi:hover { transform:translateY(-2px); box-shadow:0 12px 24px -18px rgba(0,43,117,.4); }
  .mlv-kpi:hover::before, .mlv-kpi.active::before { opacity:.8; }
  .mlv-kpi.active { border-color:color-mix(in srgb, var(--st) 55%, transparent); box-shadow:0 10px 22px -16px color-mix(in srgb, var(--st) 60%, transparent); }
  .mlv-kpi-label { display:flex; align-items:center; gap:6px; font-size:9.5px; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; color:${C.textMuted}; }
  .mlv-kpi-dot { width:6px; height:6px; border-radius:50%; background:var(--st); box-shadow:0 0 0 3px color-mix(in srgb, var(--st) 16%, transparent); }
  .mlv-kpi-value { display:block; font-family:'Fraunces',Georgia,serif; font-size:24px; font-weight:600; color:var(--ink); margin:5px 0 7px; font-variant-numeric:tabular-nums; letter-spacing:-.4px; line-height:1; }
  .mlv-kpi-bar { display:block; height:2px; background:rgba(11,27,51,.07); border-radius:2px; overflow:hidden; }
  .mlv-kpi-bar span { display:block; height:100%; background:var(--st); border-radius:2px; transition:width .6s ease; }

  /* ── Toolbar ── */
  .mlv-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .mlv-search { position:relative; display:flex; align-items:center; flex:1; min-width:230px; max-width:420px; }
  .mlv-search svg { position:absolute; left:13px; color:${C.textLight}; pointer-events:none; }
  .mlv-search input { width:100%; padding:9px 14px 9px 36px; border:1px solid var(--hair); border-radius:22px; font-size:13px; font-family:inherit; background:#fff; color:${C.text}; outline:none; box-shadow:0 1px 2px rgba(11,27,51,.04); transition:border-color .2s, box-shadow .2s; }
  .mlv-search input:focus { border-color:var(--gold); box-shadow:0 0 0 3.5px rgba(193,151,91,.16); }
  .mlv-filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .mlv-sorter { display:inline-flex; border:1px solid var(--hair); border-radius:20px; overflow:hidden; background:#fff; }
  .mlv-sorter button { font-family:inherit; font-size:11.5px; font-weight:700; letter-spacing:.3px; padding:7.5px 13px; border:none; background:none; color:${C.textMuted}; cursor:pointer; transition:all .2s; }
  .mlv-sorter button + button { border-left:1px solid var(--hair); }
  .mlv-sorter button.on { background:linear-gradient(180deg,#FBF4E6,#F5EBD6); color:#8A6A34; }
  .mlv-select { padding:8px 12px; border:1px solid var(--hair); border-radius:10px; font-size:12.5px; font-family:inherit; background:#fff; color:${C.text}; outline:none; cursor:pointer; transition:border-color .2s; }
  .mlv-select:focus { border-color:var(--gold); }
  .mlv-toggle { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:20px; border:1px solid var(--hair); background:#fff; font-size:12.5px; font-weight:600; font-family:inherit; color:${C.textMuted}; cursor:pointer; transition:all .2s; }
  .mlv-toggle:hover { border-color:var(--gold); color:#8A6A34; }
  .mlv-toggle.on { background:linear-gradient(180deg,#FBF4E6,#F7EDD9); border-color:rgba(193,151,91,.6); color:#8A6A34; }
  .mlv-clear { border:none; background:none; font-family:inherit; font-size:12px; font-weight:600; color:${C.red}; cursor:pointer; padding:8px 6px; letter-spacing:.2px; }
  .mlv-clear:hover { text-decoration:underline; }

  .mlv-count-line { display:flex; align-items:center; gap:12px; font-size:10.5px; letter-spacing:1.6px; text-transform:uppercase; font-weight:700; color:${C.textLight}; margin:14px 0 10px; }
  .mlv-count-rule { flex:1; height:1px; background:var(--hair); }

  /* ── Libro mayor (desktop) ── */
  .mlv-ledger { background:linear-gradient(180deg,#fff,#FDFDFC); border:1px solid var(--hair); border-radius:16px; box-shadow:0 1px 2px rgba(11,27,51,.03), 0 14px 34px -28px rgba(11,27,51,.35); overflow:hidden; }
  .mlv-ledger-head, .mlv-row { display:grid; grid-template-columns:minmax(190px,1.15fr) minmax(180px,1.3fr) 128px 320px 92px; gap:14px; align-items:center; padding:0 20px; }
  .mlv-ledger-head { padding-top:13px; padding-bottom:11px; border-bottom:1px solid var(--hair); font-size:9.5px; letter-spacing:1.8px; text-transform:uppercase; font-weight:700; color:${C.textMuted}; background:linear-gradient(180deg,#FBFBF9,#F7F8F6); }
  .mlv-ledger-head .r, .mlv-row .r { text-align:right; justify-self:end; }
  .mlv-row-wrap { border-bottom:1px solid rgba(11,27,51,.055); animation:mlvRise .4s var(--d) ease backwards; transition:background .2s; }
  .mlv-row-wrap:last-child { border-bottom:none; }
  .mlv-row-wrap:hover { background:rgba(193,151,91,.045); }
  .mlv-row-wrap.open { background:linear-gradient(180deg,rgba(193,151,91,.07),rgba(193,151,91,.02)); }
  .mlv-row { padding-top:11px; padding-bottom:11px; }

  .mlv-cell-lead { display:flex; align-items:center; gap:11px; min-width:0; }
  .mlv-seal { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:'Fraunces',Georgia,serif; font-size:13px; font-weight:600; color:#8A6A34; background:radial-gradient(circle at 30% 25%, #FBF4E6, #F1E3C8); box-shadow:inset 0 0 0 1px rgba(193,151,91,.5), 0 1px 3px rgba(11,27,51,.1); font-variant-numeric:tabular-nums; }
  .mlv-name { display:flex; align-items:center; gap:6px; font-size:13.5px; font-weight:700; color:var(--ink); min-width:0; }
  .mlv-name-sub { display:block; font-size:11px; color:${C.textMuted}; margin-top:1px; }
  .mlv-medic { display:inline-flex; color:${C.green}; }
  .mlv-medic.salud { color:#0891B2; }
  .mlv-alto { font-style:normal; font-size:8.5px; font-weight:800; letter-spacing:1.2px; color:#8A6A34; background:linear-gradient(180deg,#FBF4E6,#F3E7CE); border:1px solid rgba(193,151,91,.5); border-radius:4px; padding:1.5px 5px; }
  .mlv-cell-tema { min-width:0; }
  .mlv-cell-tema b { display:block; font-size:12.5px; font-weight:600; color:${C.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mlv-cell-tema i { display:block; font-style:normal; font-size:11.5px; color:${C.textMuted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mlv-cell-precio b { display:block; font-family:'Fraunces',Georgia,serif; font-size:15px; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; letter-spacing:-.2px; }

  /* Sello de estado de cotización */
  .mlv-cotiz { display:inline-block; font-style:normal; font-size:9px; font-weight:800; letter-spacing:1px; text-transform:uppercase; border-radius:4px; padding:2px 6px; margin-top:2px; }
  .mlv-cotiz.pagada { color:${C.green}; background:${C.greenBg}; box-shadow:inset 0 0 0 1px rgba(14,138,99,.28); }
  .mlv-cotiz.aceptada { color:#2563EB; background:#EFF4FE; box-shadow:inset 0 0 0 1px rgba(37,99,235,.25); }
  .mlv-cotiz.abierta { color:${C.amber}; background:${C.amberBg}; box-shadow:inset 0 0 0 1px rgba(185,127,30,.28); }
  .mlv-cotiz.sin { color:${C.textLight}; background:rgba(11,27,51,.045); }

  /* ── Seguimiento: pill-selects ── */
  .mlv-seg { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
  .mlv-pill-select, .mlv-assign-select { position:relative; display:inline-flex; }
  .mlv-pill-select select { appearance:none; -webkit-appearance:none; font-family:inherit; font-size:11.5px; font-weight:700; color:var(--st); background:color-mix(in srgb, var(--st) 9%, #fff); border:1px solid color-mix(in srgb, var(--st) 35%, transparent); border-radius:20px; padding:5.5px 24px 5.5px 12px; cursor:pointer; outline:none; transition:box-shadow .2s; }
  .mlv-pill-select::after { content:''; position:absolute; right:10px; top:50%; width:5px; height:5px; border-right:1.5px solid var(--st); border-bottom:1.5px solid var(--st); transform:translateY(-70%) rotate(45deg); pointer-events:none; }
  .mlv-pill-select select:focus { box-shadow:0 0 0 3px color-mix(in srgb, var(--st) 20%, transparent); }
  .mlv-assign-select select { appearance:none; -webkit-appearance:none; font-family:inherit; font-size:11.5px; font-weight:600; color:${C.textMuted}; background:#fff; border:1px solid var(--hair); border-radius:20px; padding:5.5px 24px 5.5px 12px; cursor:pointer; outline:none; transition:border-color .2s; }
  .mlv-assign-select::after { content:''; position:absolute; right:10px; top:50%; width:5px; height:5px; border-right:1.5px solid ${C.textLight}; border-bottom:1.5px solid ${C.textLight}; transform:translateY(-70%) rotate(45deg); pointer-events:none; }
  .mlv-assign-select select:focus { border-color:var(--gold); }
  .mlv-seg select:disabled { opacity:.5; cursor:wait; }

  /* ── Acciones ── */
  .mlv-actions { display:inline-flex; gap:6px; }
  .mlv-icon-btn { width:30px; height:30px; border-radius:50%; border:1px solid var(--hair); background:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:${C.textMuted}; transition:all .22s; box-shadow:0 1px 2px rgba(11,27,51,.04); }
  .mlv-icon-btn:hover { transform:translateY(-1px); }
  .mlv-icon-btn.wa:hover { border-color:#25D366; color:#25D366; background:#ECFDF5; }
  .mlv-icon-btn.expand svg { transition:transform .25s ease; }
  .mlv-icon-btn.expand.open { border-color:var(--gold); color:#8A6A34; background:#FBF4E6; }
  .mlv-icon-btn.expand.open svg { transform:rotate(180deg); }
  .mlv-icon-btn.expand:hover { border-color:var(--gold); color:#8A6A34; }

  /* ── Expediente ── */
  .mlv-dossier { margin:2px 20px 16px 62px; padding:16px 20px 18px; background:linear-gradient(180deg,#FBFAF7,#F8F6F1); border:1px solid rgba(193,151,91,.3); border-left:2px solid var(--gold); border-radius:4px 12px 12px 4px; animation:mlvUnfold .3s ease backwards; }
  .mlv-dossier-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
  .mlv-dossier-title { font-family:'Fraunces',Georgia,serif; font-size:13px; font-weight:600; color:#8A6A34; letter-spacing:.4px; }
  .mlv-dossier-rule { flex:1; height:1px; background:linear-gradient(90deg,rgba(193,151,91,.45),transparent); }
  .mlv-dossier-folio { font-size:9.5px; letter-spacing:1.6px; text-transform:uppercase; font-weight:700; color:${C.textLight}; font-variant-numeric:tabular-nums; }
  .mlv-dossier-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px 20px; }
  .mlv-dossier-grid span i { display:block; font-style:normal; font-size:9px; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; color:${C.textLight}; }
  .mlv-dossier-grid span b { font-size:12.5px; font-weight:600; color:${C.text}; word-break:break-word; }
  .mlv-tema { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:13.5px; color:${C.text}; line-height:1.55; margin:13px 0 0; padding-left:2px; }
  .mlv-notas-origen { font-size:12px; color:${C.textMuted}; margin:9px 0 0; }
  .mlv-notas-origen i { font-style:normal; font-weight:700; }

  .mlv-bitacora-empty { font-size:12px; color:${C.textLight}; font-style:italic; margin:0 0 8px; }
  .mlv-timeline { position:relative; padding-left:2px; }
  .mlv-tl-entry { position:relative; display:flex; gap:11px; padding:0 0 11px 2px; }
  .mlv-tl-entry:not(:last-child)::before { content:''; position:absolute; left:6px; top:12px; bottom:-2px; width:1px; background:rgba(193,151,91,.4); }
  .mlv-tl-dot { width:9px; height:9px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #E8CC9C, var(--gold)); box-shadow:0 0 0 2.5px rgba(193,151,91,.18); flex-shrink:0; margin-top:4px; }
  .mlv-tl-text { font-size:12.5px; color:${C.text}; margin:0; line-height:1.5; }
  .mlv-tl-meta { font-size:10.5px; color:${C.textLight}; margin:2px 0 0; letter-spacing:.3px; }

  .mlv-nota-form { display:flex; gap:8px; margin-top:10px; }
  .mlv-nota-form input { flex:1; min-width:0; padding:8.5px 14px; border:1px solid rgba(193,151,91,.35); border-radius:20px; font-size:12.5px; font-family:inherit; background:#fff; outline:none; color:${C.text}; transition:border-color .2s, box-shadow .2s; }
  .mlv-nota-form input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(193,151,91,.15); }
  .mlv-nota-form button { font-family:inherit; font-size:12px; font-weight:700; letter-spacing:.3px; padding:8.5px 18px; border-radius:20px; border:none; cursor:pointer; color:#fff; background:linear-gradient(180deg,#D0A76B,#B98C4C); box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 4px 10px -4px rgba(138,106,52,.55); transition:transform .15s, box-shadow .2s; }
  .mlv-nota-form button:hover:not(:disabled) { transform:translateY(-1px); }
  .mlv-nota-form button:disabled { opacity:.45; cursor:not-allowed; }

  /* ── Fichas móvil ── */
  .mlv-cards { flex-direction:column; gap:10px; }
  .mlv-card { background:linear-gradient(180deg,#fff,#FDFDFB); border:1px solid var(--hair); border-top:2px solid rgba(193,151,91,.55); border-radius:6px 6px 14px 14px; padding:13px 14px; box-shadow:0 2px 10px rgba(11,27,51,.05); animation:mlvRise .4s var(--d) ease backwards; }
  .mlv-card-top { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
  .mlv-card-id { flex:1; min-width:0; }
  .mlv-card-mid { display:flex; justify-content:space-between; align-items:center; gap:10px; border-top:1px solid rgba(11,27,51,.055); border-bottom:1px solid rgba(11,27,51,.055); padding:8px 0; margin-bottom:10px; }
  .mlv-card-mid span i:first-child { display:block; font-style:normal; font-size:9px; letter-spacing:1.3px; text-transform:uppercase; font-weight:700; color:${C.textLight}; }
  .mlv-card-mid span b { font-family:'Fraunces',Georgia,serif; font-size:14px; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
  .mlv-card-mid span:last-child { text-align:right; }
  .mlv-card .mlv-dossier { margin:12px 0 0; }

  /* ── Vacío y paginación ── */
  .mlv-empty { text-align:center; padding:52px 20px; color:${C.textLight}; }
  .mlv-empty svg { color:rgba(193,151,91,.5); }
  .mlv-empty p { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:14.5px; margin:10px 0 0; }
  .mlv-pager { display:flex; gap:14px; justify-content:center; align-items:center; margin-top:18px; }
  .mlv-pager button { font-family:inherit; font-size:12.5px; font-weight:600; padding:7.5px 16px; border-radius:20px; border:1px solid var(--hair); background:#fff; color:${C.text}; cursor:pointer; transition:all .2s; }
  .mlv-pager button:hover:not(:disabled) { border-color:var(--gold); color:#8A6A34; }
  .mlv-pager button:disabled { opacity:.4; cursor:not-allowed; }
  .mlv-pager span { font-size:10.5px; letter-spacing:1.6px; text-transform:uppercase; font-weight:700; color:${C.textMuted}; font-variant-numeric:tabular-nums; }

  /* ── Responsive ── */
  @media(max-width:1280px){
    .mlv-tabs { flex-wrap:wrap; }
    .mlv-tab { min-width:200px; }
  }
  @media(max-width:1180px){
    .mlv-ledger-head, .mlv-row { grid-template-columns:minmax(170px,1.1fr) minmax(150px,1fr) 112px 300px 88px; gap:10px; padding:0 14px; }
  }
  @media(max-width:768px){
    .mlv-plaque { padding:20px 18px; }
    .mlv-plaque-frame { inset:6px; }
    .mlv-overline em { white-space:normal; letter-spacing:1.6px; font-size:8.5px; line-height:1.5; }
    .admin-wrap .mlv h1.mlv-title { font-size:25px; }
    .mlv-plaque-stats { width:100%; justify-content:space-between; gap:14px; }
    .mlv-pstat b { font-size:21px; }
    .mlv-tabs { flex-direction:column; gap:7px; }
    .mlv-tab { border-radius:10px; padding:11px 14px; min-width:0; }
    .mlv-kpis { grid-template-columns:repeat(3,1fr); gap:7px; }
    .mlv-kpi { padding:9px 10px 8px; }
    .mlv-kpi-value { font-size:20px; }
    .mlv-search { max-width:none; }
    .mlv-filters { width:100%; }
    .mlv-filters .mlv-select { flex:1; }
    .mlv-sorter { width:100%; }
    .mlv-sorter button { flex:1; }
    .mlv-dossier { margin:12px 0 0; padding:13px 14px 15px; }
    .mlv-cards { display:flex !important; }
  }
`;
