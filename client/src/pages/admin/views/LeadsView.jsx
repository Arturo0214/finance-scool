import { useState } from 'react';
import { C, SPANISH_LABELS, STATUS_COLORS } from '../constants';
import { Search, Eye, X } from 'lucide-react';

const INCOME_TYPE_LABELS = { empleado: 'Empleado', freelancer: 'Freelancer', empresario: 'Empresario', mixto: 'Mixto' };
const INCOME_RANGE_LABELS = { '20k-50k': '$20k–$50k', '50k-100k': '$50k–$100k', '100k-200k': '$100k–$200k', '200k+': '$200k+' };
const DECLARACION_LABELS = { si: 'Sí', no: 'No', no_se: 'No sabe' };
const RETIRO_LABELS = { si_ppr: 'Sí, PPR', si_otro: 'Sí, otro', no: 'No', no_se: 'No sabe' };

function LeadModal({ lead, onClose, onStatusChange }) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [newStatus, setNewStatus] = useState(lead.status);
  const isCTA = lead.source === 'cta_landing';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{lead.name}</h2>
          <button className="close-btn" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="modal-body">
          <div className="field"><label>{SPANISH_LABELS.email}</label><p>{lead.email || '—'}</p></div>
          <div className="field"><label>{SPANISH_LABELS.phone}</label><p>{lead.phone}</p></div>
          <div className="field"><label>{SPANISH_LABELS.service}</label><p>{lead.service || 'PPR'}</p></div>
          <div className="field"><label>{SPANISH_LABELS.source}</label><p>{lead.source || 'Web'}</p></div>
          {isCTA && (
            <>
              <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '12px 0' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: C.primary, marginBottom: 8 }}>Datos del diagnóstico CTA</p>
              <div className="lead-detail-grid">
                <div className="field"><label>{SPANISH_LABELS.incomeType}</label><p>{INCOME_TYPE_LABELS[lead.income_type] || '—'}</p></div>
                <div className="field"><label>{SPANISH_LABELS.approxIncome}</label><p>{INCOME_RANGE_LABELS[lead.approx_income] || '—'}</p></div>
                <div className="field"><label>{SPANISH_LABELS.declaracion}</label><p>{DECLARACION_LABELS[lead.declaracion] || '—'}</p></div>
                <div className="field"><label>{SPANISH_LABELS.retiroPlan}</label><p>{RETIRO_LABELS[lead.retiro_plan] || '—'}</p></div>
              </div>
            </>
          )}
          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '12px 0' }} />
          <div className="field">
            <label>{SPANISH_LABELS.status}</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="en_proceso">En Proceso</option>
              <option value="convertido">Convertido</option>
            </select>
          </div>
          <div className="field">
            <label>{SPANISH_LABELS.notes}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={() => { onStatusChange(lead, newStatus); onClose(); }}>{SPANISH_LABELS.save}</button>
          <button className="btn-secondary" onClick={onClose}>{SPANISH_LABELS.cancel}</button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsView({ leads, searchTerm, setSearchTerm, leadFilter, setLeadFilter, selectedLead, setSelectedLead, showLeadModal, setShowLeadModal, onStatusChange }) {
  const [sourceFilter, setSourceFilter] = useState('Todos');
  const filteredLeads = sourceFilter === 'Todos' ? leads : leads.filter(l => l.source === sourceFilter);
  return (
    <>
      <style>{`
        .leads-head { display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
        .search-box { display:flex; align-items:center; background:${C.white}; border:1px solid ${C.border}; border-radius:8px; padding:10px 14px; gap:8px; }
        .search-box input { flex:1; border:none; outline:none; font-size:14px; font-family:inherit; background:none; color:${C.text}; }
        .source-filters { display:flex; gap:8px; flex-wrap:wrap; }
        .src-tab { padding:6px 14px; border-radius:20px; border:1px solid ${C.border}; background:${C.white}; cursor:pointer; font-size:13px; font-family:inherit; color:${C.textMuted}; transition:all .2s; }
        .src-tab.active { background:${C.primary}; color:${C.white}; border-color:${C.primary}; }
        .lead-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .cta-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
      `}</style>
    <div className="view">
      <h1 className="view-title">{SPANISH_LABELS.leads}</h1>
      <div className="leads-head">
        <div className="search-box">
          <Search size={18} color={C.textMuted} />
          <input type="text" placeholder={SPANISH_LABELS.search} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['Todos', 'nuevo', 'contactado', 'en_proceso', 'convertido'].map(status => (
            <button key={status} className={`f-tab${leadFilter === status ? ' active' : ''}`} onClick={() => setLeadFilter(status)}>
              {status === 'Todos' ? 'Todos' : status === 'nuevo' ? 'Nuevo' : status === 'contactado' ? 'Contactado' : status === 'en_proceso' ? 'En Proceso' : 'Convertido'}
            </button>
          ))}
        </div>
        <div className="source-filters">
          {['Todos', 'cta_landing', 'landing', 'whatsapp'].map(src => (
            <button key={src} className={`src-tab${sourceFilter === src ? ' active' : ''}`} onClick={() => setSourceFilter(src)}>
              {src === 'Todos' ? 'Todas las fuentes' : src === 'cta_landing' ? 'CTA Landing' : src === 'landing' ? 'Landing' : 'WhatsApp'}
            </button>
          ))}
        </div>
      </div>

      <div className="tbl-wrap">
        {filteredLeads.length === 0 ? <p className="empty">{SPANISH_LABELS.noLeads}</p> : (
          <table>
            <thead>
              <tr>
                <th>{SPANISH_LABELS.name}</th><th>{SPANISH_LABELS.phone}</th>
                <th>{SPANISH_LABELS.email}</th><th>{SPANISH_LABELS.source}</th>
                <th>{SPANISH_LABELS.status}</th><th>{SPANISH_LABELS.date}</th>
                <th>{SPANISH_LABELS.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => {
                const sc = STATUS_COLORS[lead.status] || { bg: C.bg, text: C.textMuted };
                const isCTA = lead.source === 'cta_landing';
                return (
                  <tr key={lead.id}>
                    <td>{lead.name}</td><td>{lead.phone}</td>
                    <td>{lead.email || '—'}</td>
                    <td>
                      <span className="cta-badge" style={{ background: isCTA ? '#EFF6FF' : '#F0FDF4', color: isCTA ? C.primary : C.green }}>
                        {isCTA ? 'CTA' : lead.source || 'Web'}
                      </span>
                    </td>
                    <td><span className="badge" style={{ backgroundColor: sc.bg, color: sc.text }}>{lead.status}</span></td>
                    <td>{new Date(lead.created_at || lead.createdAt || Date.now()).toLocaleDateString('es-MX')}</td>
                    <td>
                      <button className="action-btn" onClick={() => { setSelectedLead(lead); setShowLeadModal(true); }} title="Ver detalles">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showLeadModal && selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => { setShowLeadModal(false); setSelectedLead(null); }} onStatusChange={onStatusChange} />
      )}
    </div>
    </>
  );
}
