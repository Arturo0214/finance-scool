/**
 * CrmCommissionsView — Comisiones y conciliación contra pagos de GNP
 * Comisión = monto manual o prima × %. Flujo: pendiente → pagada por GNP → conciliada.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { X, RefreshCw, CheckCircle2, DollarSign, Scale, HandCoins } from 'lucide-react';
import { getCrmCSS, fmtMoney, fmtMoneyFull, fmtDate, MESES } from './crmShared';

const COM_ESTATUS = [
  { id: 'pendiente',  label: 'Pendiente',      bg: C.amberBg, text: C.amber },
  { id: 'pagada_gnp', label: 'Pagada por GNP', bg: C.blueBg,  text: C.blue  },
  { id: 'conciliada', label: 'Conciliada',     bg: C.greenBg, text: C.green },
];
const comInfo = (id) => COM_ESTATUS.find(e => e.id === id) || COM_ESTATUS[0];
const montoDe = (p) => Number(p.comision_monto) || (Number(p.comision_pct) ? (Number(p.prima) || 0) * Number(p.comision_pct) / 100 : 0);

export default function CrmCommissionsView({ isAgency }) {
  const [policies, setPolicies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([api.crmGetPolicies(), api.crmGetAgents()]);
      // Solo pólizas pagadas generan comisión
      setPolicies((p.policies || []).filter(x => x.estatus === 'pagada'));
      setAgents(a.agents || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = policies.filter(p => {
    if (agentFilter && String(p.agent_id) !== agentFilter) return false;
    if (statusFilter !== 'todas' && (p.comision_estatus || 'pendiente') !== statusFilter) return false;
    return true;
  });

  const totals = useMemo(() => {
    const t = { estimada: 0, pagada: 0, conciliada: 0, porConciliar: 0 };
    for (const p of filtered) {
      const m = montoDe(p);
      t.estimada += m;
      const st = p.comision_estatus || 'pendiente';
      if (st === 'pagada_gnp') { t.pagada += m; t.porConciliar += m; }
      if (st === 'conciliada') { t.pagada += m; t.conciliada += m; }
    }
    return t;
  }, [filtered]);

  const save = async () => {
    setSaving(true);
    try {
      await api.crmUpdatePolicy(form.id, {
        comision_pct: form.comision_pct === '' ? null : Number(form.comision_pct),
        comision_monto: form.comision_monto === '' ? null : Number(form.comision_monto),
        comision_estatus: form.comision_estatus || 'pendiente',
        comision_fecha: form.comision_fecha || null,
        comision_notas: form.comision_notas || null,
      });
      setForm(null); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const quickAdvance = async (p) => {
    const next = (p.comision_estatus || 'pendiente') === 'pendiente' ? 'pagada_gnp' : 'conciliada';
    try {
      await api.crmUpdatePolicy(p.id, { comision_estatus: next, comision_fecha: new Date().toISOString().slice(0, 10) });
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <><style>{getCrmCSS()}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando comisiones...</p></div></>;

  return (
    <div className="view">
      <style>{getCrmCSS()}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title">Comisiones</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>Conciliación contra pagos reales de GNP — {filtered.length} pólizas pagadas</p>
        </div>
        <div className="crm-toolbar-right">
          {isAgency && (
            <select className="crm-select" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Todos los asesores</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><DollarSign size={20} /></div>
          <div><p className="stat-label">Comisión estimada</p><p className="stat-value">{fmtMoney(totals.estimada)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><HandCoins size={20} /></div>
          <div><p className="stat-label">Pagada por GNP</p><p className="stat-value">{fmtMoney(totals.pagada)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.amberBg, color: C.amber }}><Scale size={20} /></div>
          <div><p className="stat-label">Por conciliar</p><p className="stat-value">{fmtMoney(totals.porConciliar)}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: C.greenBg, color: C.green }}><CheckCircle2 size={20} /></div>
          <div><p className="stat-label">Conciliada</p><p className="stat-value">{fmtMoney(totals.conciliada)}</p></div>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 18 }}>
        <button className={`f-tab${statusFilter === 'todas' ? ' active' : ''}`} onClick={() => setStatusFilter('todas')}>Todas</button>
        {COM_ESTATUS.map(s => (
          <button key={s.id} className={`f-tab${statusFilter === s.id ? ' active' : ''}`} onClick={() => setStatusFilter(s.id)}>
            {s.label} ({policies.filter(p => (p.comision_estatus || 'pendiente') === s.id && (!agentFilter || String(p.agent_id) === agentFilter)).length})
          </button>
        ))}
      </div>

      {/* Desktop */}
      <div className="tbl-wrap desktop-only-table">
        <table>
          <thead>
            <tr><th>Póliza / Cliente</th>{isAgency && <th>Asesor</th>}<th>Prima</th><th>% Comisión</th><th>Comisión</th><th>Estatus</th><th>Fecha</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="empty">Sin pólizas pagadas con estos filtros</td></tr>}
            {filtered.map(p => {
              const s = comInfo(p.comision_estatus || 'pendiente');
              const m = montoDe(p);
              return (
                <tr key={p.id} className="crm-rank-row" onClick={() => setForm({ ...p, comision_pct: p.comision_pct ?? '', comision_monto: p.comision_monto ?? '', comision_notas: p.comision_notas ?? '', comision_fecha: p.comision_fecha ?? '' })}>
                  <td><b>{p.plan}</b> {p.poliza ? `· ${p.poliza}` : ''}<br /><span style={{ fontSize: 11.5, color: C.textMuted }}>{p.crm_clients?.nombre}</span></td>
                  {isAgency && <td style={{ fontSize: 12.5 }}>{p.crm_agents?.nombre}</td>}
                  <td>{fmtMoney(p.prima)}</td>
                  <td>{p.comision_pct ? `${Number(p.comision_pct)}%` : '—'}</td>
                  <td><b style={{ color: m ? C.green : C.textLight }}>{m ? fmtMoneyFull(m) : 'Definir'}</b></td>
                  <td><span className="badge" style={{ background: s.bg, color: s.text }}>{s.label}</span></td>
                  <td style={{ fontSize: 12.5, color: C.textMuted }}>{fmtDate(p.comision_fecha)}</td>
                  <td>
                    {(p.comision_estatus || 'pendiente') !== 'conciliada' && m > 0 && (
                      <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); quickAdvance(p); }}>
                        {(p.comision_estatus || 'pendiente') === 'pendiente' ? '→ Pagada GNP' : '→ Conciliar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="mobile-only-cards" style={{ flexDirection: 'column' }}>
        {filtered.length === 0 && <p className="empty">Sin pólizas pagadas con estos filtros</p>}
        {filtered.map(p => {
          const s = comInfo(p.comision_estatus || 'pendiente');
          const m = montoDe(p);
          return (
            <div key={p.id} className="crm-mobile-card" onClick={() => setForm({ ...p, comision_pct: p.comision_pct ?? '', comision_monto: p.comision_monto ?? '', comision_notas: p.comision_notas ?? '', comision_fecha: p.comision_fecha ?? '' })}>
              <div className="crm-mc-top">
                <div>
                  <div className="crm-mc-name">{p.plan}</div>
                  <span style={{ fontSize: 11.5, color: C.textMuted }}>{p.crm_clients?.nombre}</span>
                </div>
                <span className="badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
              </div>
              <div className="crm-mc-row"><span>Prima</span><b>{fmtMoney(p.prima)}</b></div>
              <div className="crm-mc-row"><span>Comisión {p.comision_pct ? `(${Number(p.comision_pct)}%)` : ''}</span><b style={{ color: C.green }}>{m ? fmtMoneyFull(m) : 'Definir'}</b></div>
            </div>
          );
        })}
      </div>

      {/* Modal edición */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Comisión — {form.plan} {form.poliza ? `· ${form.poliza}` : ''}</h2>
              <button className="close-btn" onClick={() => setForm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="info-box" style={{ marginBottom: 16 }}>
                <p>Cliente: <b>{form.crm_clients?.nombre}</b> · Prima {fmtMoneyFull(form.prima)} · Pagada {fmtDate(form.fecha_pago)}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <div className="field">
                  <label>% de comisión</label>
                  <input type="number" step="0.5" placeholder="ej. 30" value={form.comision_pct} onChange={e => setForm({ ...form, comision_pct: e.target.value })} />
                </div>
                <div className="field">
                  <label>Monto manual (opcional)</label>
                  <input type="number" placeholder="prevalece sobre %" value={form.comision_monto} onChange={e => setForm({ ...form, comision_monto: e.target.value })} />
                </div>
                <div className="field">
                  <label>Estatus</label>
                  <select value={form.comision_estatus || 'pendiente'} onChange={e => setForm({ ...form, comision_estatus: e.target.value })}>
                    {COM_ESTATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Fecha pago GNP / conciliación</label>
                  <input type="date" value={form.comision_fecha} onChange={e => setForm({ ...form, comision_fecha: e.target.value })} />
                </div>
              </div>
              <div className="field"><label>Notas de conciliación</label><textarea rows={2} value={form.comision_notas} onChange={e => setForm({ ...form, comision_notas: e.target.value })} /></div>
              <p style={{ fontSize: 13, color: C.textMuted }}>
                Comisión resultante: <b style={{ color: C.green }}>{fmtMoneyFull(Number(form.comision_monto) || (Number(form.comision_pct) ? (Number(form.prima) || 0) * Number(form.comision_pct) / 100 : 0))}</b>
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
