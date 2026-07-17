/**
 * HealthView — Estado del sistema (solo agencia/superadmin)
 * Diseño premium: hero de estado global, tarjetas de servicio con anillo
 * de latencia, auto-refresh configurable y detalle expandible por servicio.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '../constants';
import {
  RefreshCw, Server, Activity, Database, Cloud, Globe, Bot, Sparkles,
  MessageCircle, ShieldCheck, ShieldAlert, Cpu, MemoryStick, Clock, ChevronDown,
} from 'lucide-react';
import { api } from '../../../utils/api';

const ICONS = {
  'Base de datos (Supabase)': Database,
  'Cloudinary (dihxi7zgv)': Cloud,
  'Frontend (Netlify)': Globe,
  'Sofía / n8n': Bot,
  'Copiloto IA (Anthropic)': Sparkles,
  'WhatsApp Cloud API': MessageCircle,
  'Vigilancia de seguridad': ShieldCheck,
  'Cifrado CRM': ShieldCheck,
};

const REFRESH = [['Off', 0], ['30s', 30000], ['1m', 60000], ['5m', 300000]];
const latColor = (ms) => (ms < 300 ? C.green : ms < 800 ? C.amber : C.red);

const HEALTH_CSS = `
  @keyframes hbPulse { 0%,100% { transform:scale(1); opacity:.55; } 50% { transform:scale(1.35); opacity:0; } }
  @keyframes hbRise  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .hb-hero {
    position:relative; overflow:hidden; border-radius:18px; padding:26px 28px; margin-bottom:20px; color:#fff;
    background:radial-gradient(600px 300px at 88% -20%, rgba(0,136,224,.28), transparent 60%), linear-gradient(160deg,#051636,#06255C);
    box-shadow:0 24px 50px -28px rgba(5,22,54,.6);
  }
  .hb-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; position:relative; }
  .hb-dot::after { content:''; position:absolute; inset:0; border-radius:50%; background:inherit; animation:hbPulse 2.4s ease-out infinite; }
  .hb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
  .hb-card {
    background:linear-gradient(180deg,#fff,#FDFDFC); border:1px solid rgba(11,27,51,.09); border-radius:16px; overflow:hidden;
    box-shadow:0 1px 2px rgba(11,27,51,.03), 0 10px 30px -26px rgba(11,27,51,.35); transition:box-shadow .2s, transform .2s;
    animation:hbRise .45s ease backwards;
  }
  .hb-card:hover { transform:translateY(-2px); box-shadow:0 2px 4px rgba(11,27,51,.05), 0 18px 40px -24px rgba(0,43,117,.4); }
  .hb-card-head { display:flex; align-items:center; gap:12px; padding:15px 17px; cursor:pointer; }
  .hb-ico { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .hb-body { padding:0 17px 16px; display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .hb-metric { background:linear-gradient(180deg,#FBFCFD,#F5F7FA); border:1px solid rgba(11,27,51,.07); border-radius:10px; padding:9px 12px; }
  .hb-metric .m-k { font-size:9px; text-transform:uppercase; letter-spacing:1.2px; color:${C.textMuted}; font-weight:700; margin-bottom:2px; }
  .hb-metric .m-v { font-size:14.5px; font-weight:700; color:${C.ink}; font-variant-numeric:tabular-nums; word-break:break-word; }
  .hb-seg { display:inline-flex; background:rgba(11,27,51,.05); border-radius:9px; padding:3px; gap:2px; }
  .hb-seg button { border:none; background:none; padding:5px 11px; border-radius:7px; font-size:12px; font-weight:600; color:${C.textMuted}; cursor:pointer; font-family:inherit; transition:all .15s; }
  .hb-seg button.on { background:#fff; color:${C.primary}; box-shadow:0 1px 3px rgba(11,27,51,.12); }
`;

export default function HealthView() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});
  const [autoMs, setAutoMs] = useState(0);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setData(await api.get('/health-status')); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clearInterval(timerRef.current);
    if (autoMs > 0) timerRef.current = setInterval(() => { if (!document.hidden) load(); }, autoMs);
    return () => clearInterval(timerRef.current);
  }, [autoMs, load]);

  const okCount = data ? data.checks.filter(c => c.ok).length : 0;
  const total = data ? data.checks.length : 0;
  const allOk = data && okCount === total;
  const secDown = data && data.checks.some(c => c.name === 'Vigilancia de seguridad' && !c.ok);
  const heroColor = allOk ? C.green : C.amber;

  return (
    <div className="view">
      <style>{HEALTH_CSS}</style>

      <div className="crm-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 className="view-title">Estado del sistema</h1>
          <p className="view-subtitle" style={{ marginBottom: 0 }}>Monitoreo de servidores, integraciones y seguridad en tiempo real</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="hb-seg">
            {REFRESH.map(([l, ms]) => (
              <button key={l} className={autoMs === ms ? 'on' : ''} onClick={() => setAutoMs(ms)}>{l}</button>
            ))}
          </div>
          <button className="btn-primary" disabled={busy} onClick={load}><RefreshCw size={15} style={{ animation: busy ? 'spin .8s linear infinite' : 'none' }} /> {busy ? 'Verificando' : 'Verificar'}</button>
        </div>
      </div>

      {err && <div className="info-box" style={{ background: C.redBg, color: C.red, marginBottom: 16 }}><p>{err}</p></div>}

      {data && (
        <>
          {/* Hero de estado global */}
          <div className="hb-hero">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${heroColor}22`, border: `2px solid ${heroColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {allOk ? <ShieldCheck size={26} color={heroColor} /> : <ShieldAlert size={26} color={heroColor} />}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(232,207,166,.8)', fontWeight: 700 }}>Estado general</div>
                  <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 27, fontWeight: 600, color: '#fff', lineHeight: 1.15 }}>
                    {allOk ? 'Todo operacional' : secDown ? 'Alerta de seguridad' : 'Con avisos'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                    {okCount}/{total} servicios en verde · actualizado {new Date(data.ts).toLocaleTimeString('es-MX')}
                    {autoMs > 0 && ` · auto ${REFRESH.find(r => r[1] === autoMs)[0]}`}
                  </div>
                </div>
              </div>
              {/* Métricas del backend */}
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                {[[Server, 'Entorno', data.server.entorno], [Clock, 'Uptime', `${data.server.uptime_min} min`], [MemoryStick, 'Memoria', `${data.server.memoria_mb} MB`], [Cpu, 'Node', data.server.node]].map(([Ico, k, v]) => (
                  <div key={k} style={{ minWidth: 70 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', fontWeight: 700, marginBottom: 3 }}><Ico size={11} /> {k}</div>
                    <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 16, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjetas de servicio */}
          <div className="hb-grid">
            {data.checks.map((c, i) => {
              const Ico = ICONS[c.name] || Activity;
              const abierto = open[c.name];
              const color = c.ok ? C.green : C.red;
              return (
                <div key={c.name} className="hb-card" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="hb-card-head" onClick={() => setOpen(o => ({ ...o, [c.name]: !o[c.name] }))}>
                    <div className="hb-ico" style={{ background: c.ok ? C.greenBg : C.redBg, color }}><Ico size={19} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: c.ok ? C.textMuted : C.red, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.detalle}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: latColor(c.ms), fontVariantNumeric: 'tabular-nums' }}>{c.ms}ms</span>
                      <span className="hb-dot" style={{ background: color }} />
                      <ChevronDown size={15} color={C.textLight} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </div>
                  </div>
                  {abierto && (
                    <div className="hb-body">
                      {c.datos ? Object.entries(c.datos).map(([k, v]) => (
                        <div key={k} className="hb-metric"><div className="m-k">{k}</div><div className="m-v">{String(v)}</div></div>
                      )) : <div className="hb-metric" style={{ gridColumn: '1 / -1' }}><div className="m-v" style={{ fontWeight: 500 }}>{c.detalle}</div></div>}
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
