/**
 * HealthView — salud de servidores e integraciones (solo superadmin)
 */
import { useState, useEffect } from 'react';
import { C } from '../constants';
import { RefreshCw, Server, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../../utils/api';

export default function HealthView() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null); // fila expandida

  const load = async () => {
    setBusy(true); setErr('');
    try { setData(await api.get('/health-status')); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const okCount = data ? data.checks.filter(c => c.ok).length : 0;

  return (
    <div className="view">
      <div className="crm-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 className="view-title">Salud del sistema</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>
            {data ? `${okCount}/${data.checks.length} servicios en verde · ${new Date(data.ts).toLocaleTimeString('es-MX')}` : 'Verificando...'}
          </p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={load}><RefreshCw size={15} /> {busy ? 'Verificando...' : 'Verificar ahora'}</button>
      </div>

      {err && <div className="info-box" style={{ background: C.redBg, color: C.red, marginBottom: 16 }}><p>{err}</p></div>}

      {data && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: C.blueBg, color: C.primary }}><Server size={20} /></div>
              <div><p className="stat-label">Backend</p><p className="stat-value" style={{ fontSize: 20 }}>{data.server.entorno}</p>
                <p className="stat-change" style={{ color: C.textMuted }}>uptime {data.server.uptime_min} min · {data.server.memoria_mb} MB · Node {data.server.node}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: okCount === data.checks.length ? C.greenBg : C.amberBg, color: okCount === data.checks.length ? C.green : C.amber }}><Activity size={20} /></div>
              <div><p className="stat-label">Estado general</p><p className="stat-value" style={{ color: okCount === data.checks.length ? C.green : C.amber }}>{okCount === data.checks.length ? 'Operacional' : 'Con avisos'}</p></div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Servicios e integraciones <span style={{ fontSize: 11, fontWeight: 500, color: C.textLight }}>· haz clic en cada uno para ver sus datos</span></h2>
            {data.checks.map(c => {
              const abierto = open === c.name;
              const maxMs = Math.max(...data.checks.map(x => x.ms), 1);
              return (
                <div key={c.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div onClick={() => setOpen(abierto ? null : c.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 6px', cursor: 'pointer', background: abierto ? 'rgba(0,61,165,.03)' : 'transparent', borderRadius: 8 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: c.ok ? C.green : C.red, boxShadow: `0 0 0 4px ${c.ok ? C.greenBg : C.redBg}` }} />
                    <b style={{ flex: 1, fontSize: 14, color: C.ink }}>{c.name}</b>
                    <span style={{ fontSize: 12.5, color: c.ok ? C.textMuted : C.red }}>{c.detalle}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 130, justifyContent: 'flex-end' }}>
                      <span style={{ width: 56, height: 5, borderRadius: 4, background: 'rgba(11,27,51,.08)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.max((c.ms / maxMs) * 100, 4)}%`, background: c.ms < 300 ? C.green : c.ms < 800 ? C.amber : C.red, borderRadius: 4 }} />
                      </span>
                      <span style={{ fontSize: 11.5, color: C.textLight, fontVariantNumeric: 'tabular-nums', width: 52, textAlign: 'right' }}>{c.ms} ms</span>
                      {abierto ? <ChevronUp size={14} color={C.textLight} /> : <ChevronDown size={14} color={C.textLight} />}
                    </span>
                  </div>
                  {abierto && (
                    <div style={{ padding: '4px 6px 16px 33px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                      {c.datos ? Object.entries(c.datos).map(([k, v]) => (
                        <div key={k} style={{ background: 'linear-gradient(180deg,#fff,#FBFCFD)', border: '1px solid rgba(11,27,51,.09)', borderRadius: 10, padding: '10px 13px' }}>
                          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1.3, color: C.textMuted, fontWeight: 700, marginBottom: 3 }}>{k}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{String(v)}</div>
                        </div>
                      )) : <p className="empty" style={{ padding: 10 }}>Sin datos adicionales — {c.detalle}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
