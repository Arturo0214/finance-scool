/**
 * CmdK — buscador global del panel (⌘K / Ctrl+K)
 * Busca clientes, pólizas y recordatorios del CRM y navega directo:
 * un cliente abre su expediente, una póliza pre-filtra la vista de pólizas.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Contact, FileText, Bell, CornerDownLeft } from 'lucide-react';
import { api } from '../utils/api';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function CmdK() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null); // { clients, policies, reminders }
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQ(''); setSel(0); return; }
    setTimeout(() => inputRef.current?.focus(), 40);
    if (!data) {
      Promise.all([api.crmGetClients().catch(() => ({})), api.crmGetPolicies().catch(() => ({})), api.crmGetReminders().catch(() => ({}))])
        .then(([c, p, r]) => setData({ clients: c.clients || [], policies: p.policies || [], reminders: r.reminders || [] }));
    }
  }, [open]); // eslint-disable-line

  const results = useCallback(() => {
    if (!data || norm(q).length < 2) return [];
    const nq = norm(q);
    const out = [];
    for (const c of data.clients) {
      if (norm(c.nombre).includes(nq) || (c.telefono || '').includes(q)) {
        out.push({ tipo: 'cliente', icon: Contact, titulo: c.nombre, sub: `${c.etapa || ''}${c.crm_agents?.nombre ? ' · ' + c.crm_agents.nombre : ''}`, go: () => { sessionStorage.setItem('crm_open_client', c.id); navigate('/admin/crm-clientes'); } });
      }
      if (out.length >= 6) break;
    }
    for (const p of data.policies) {
      if (norm(`${p.plan} ${p.poliza} ${p.crm_clients?.nombre}`).includes(nq)) {
        out.push({ tipo: 'póliza', icon: FileText, titulo: `${p.plan || 'Póliza'}${p.poliza ? ' · ' + p.poliza : ''}`, sub: p.crm_clients?.nombre || '', go: () => { sessionStorage.setItem('crm_polizas_search', p.poliza || p.crm_clients?.nombre || p.plan || ''); navigate('/admin/crm-polizas'); } });
      }
      if (out.length >= 12) break;
    }
    for (const r of data.reminders) {
      if (norm(r.titulo).includes(nq)) {
        out.push({ tipo: 'recordatorio', icon: Bell, titulo: r.titulo, sub: `${r.fecha || ''}${r.crm_clients?.nombre ? ' · ' + r.crm_clients.nombre : ''}`, go: () => navigate('/admin/crm-recordatorios') });
      }
      if (out.length >= 15) break;
    }
    return out.slice(0, 12);
  }, [data, q, navigate])();

  if (!open) return null;

  const pick = (r) => { r.go(); setOpen(false); };

  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,22,54,.45)', backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', height: 'fit-content', background: '#fff', borderRadius: 16, boxShadow: '0 30px 70px -20px rgba(5,22,54,.55)', overflow: 'hidden', border: '1px solid rgba(11,27,51,.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(11,27,51,.08)' }}>
          <Search size={17} style={{ color: '#8D9AB1', flexShrink: 0 }} />
          <input ref={inputRef} value={q}
            onChange={e => { setQ(e.target.value); setSel(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && results[sel]) pick(results[sel]);
            }}
            placeholder="Buscar clientes, pólizas, recordatorios..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', color: '#16233B', background: 'none' }} />
          <kbd style={{ fontSize: 10.5, color: '#8D9AB1', border: '1px solid rgba(11,27,51,.15)', borderRadius: 6, padding: '2px 7px', fontFamily: 'inherit' }}>esc</kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {norm(q).length < 2 && <p style={{ padding: '22px 18px', fontSize: 13, color: '#8D9AB1', margin: 0 }}>Escribe al menos 2 letras... {!data && '(cargando datos)'}</p>}
          {norm(q).length >= 2 && results.length === 0 && <p style={{ padding: '22px 18px', fontSize: 13, color: '#8D9AB1', margin: 0 }}>Sin resultados para "{q}"</p>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} onClick={() => pick(r)} onMouseEnter={() => setSel(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', cursor: 'pointer', background: sel === i ? 'rgba(0,61,165,.06)' : 'transparent', borderLeft: sel === i ? '3px solid #C1975B' : '3px solid transparent' }}>
                <Icon size={16} style={{ color: sel === i ? '#003DA5' : '#8D9AB1', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#16233B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</div>
                  <div style={{ fontSize: 11.5, color: '#8D9AB1', textTransform: 'capitalize' }}>{r.tipo}{r.sub ? ` · ${r.sub}` : ''}</div>
                </div>
                {sel === i && <CornerDownLeft size={13} style={{ color: '#8D9AB1' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
