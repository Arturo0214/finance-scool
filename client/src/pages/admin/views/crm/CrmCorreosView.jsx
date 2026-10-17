/**
 * CrmCorreosView — Bandeja de Correos admin-only (Arturo·Ingrid·Flavio·Karina).
 * Lee el Gmail de las cuentas conectadas (uso principal: el correo de
 * integración de Flavio para ver los OTP de Prudential al entrar al portal).
 * Solo lectura. Gating por whitelist (frontend + backend CORREOS_EMAILS).
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { Mail, RefreshCw, Search, ShieldAlert, Key, X, Inbox, Link2, Copy, Check } from 'lucide-react';

const SOCIO_LABEL = { arturo: 'Arturo', ingrid: 'Ingrid', flavio: 'Flavio' };

const fmtFecha = (d) => { try { return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
const nombreDe = (from) => (from || '').replace(/<.*>/, '').replace(/"/g, '').trim() || from;

const CO_CSS = `
  .co { --gold:${C.gold}; --ink:${C.ink}; --hair:#E4E8F0; }
  @keyframes coRise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  .co-plaque { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:16px; padding:18px 24px; border-radius:16px; background:radial-gradient(130% 170% at 8% 0%, #14315E 0%, ${C.ink} 55%, #081324 100%); box-shadow:0 14px 36px -22px rgba(4,12,26,.6); animation:coRise .5s ease backwards; }
  .co-plaque h1 { font-family:'Fraunces',Georgia,serif; font-size:25px; font-weight:600; margin:0; color:#F2E4C8; display:flex; align-items:center; gap:10px; }
  .co-plaque p { font-size:12px; color:rgba(233,240,250,.6); margin:3px 0 0; }
  .co-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
  .co-buz { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; padding:8px 14px; border-radius:20px; border:1px solid var(--hair); background:#fff; color:${C.textMuted}; cursor:pointer; transition:all .18s; }
  .co-buz.on { border-color:var(--gold); color:#8A6A34; background:${C.goldBg}; }
  .co-btn { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:12px; font-weight:700; border-radius:9px; padding:8px 13px; cursor:pointer; border:1px solid var(--hair); background:#fff; color:${C.textMuted}; transition:all .18s; }
  .co-btn:hover { border-color:var(--gold); color:#8A6A34; }
  .co-btn.gold { background:linear-gradient(180deg,#C8A066,#A87F45); color:#fff; border-color:transparent; }
  .co-btn.on { border-color:#B97F1E; color:#B97F1E; background:${C.amberBg}; }
  .co-search { position:relative; display:flex; align-items:center; min-width:220px; flex:1; max-width:340px; }
  .co-search svg { position:absolute; left:12px; color:${C.textLight}; }
  .co-search input { width:100%; padding:8px 13px 8px 34px; border:1px solid var(--hair); border-radius:20px; font-size:12.5px; font-family:inherit; outline:none; background:#fff; }
  .co-search input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(193,151,91,.14); }

  .co-list { display:flex; flex-direction:column; gap:7px; animation:coRise .5s .05s ease backwards; }
  .co-item { display:flex; align-items:flex-start; gap:12px; background:#fff; border:1px solid var(--hair); border-radius:12px; padding:12px 15px; cursor:pointer; transition:all .18s; }
  .co-item:hover { border-color:rgba(193,151,91,.5); box-shadow:0 10px 22px -16px rgba(0,43,117,.3); }
  .co-item.unread { border-left:3px solid var(--gold); }
  .co-item.pru { background:linear-gradient(180deg,#FFFDF8,#FBF4E3); border-color:rgba(193,151,91,.5); }
  .co-dot { width:9px; height:9px; border-radius:50%; margin-top:5px; flex-shrink:0; background:${C.gold}; }
  .co-dot.read { background:transparent; }
  .co-item-main { flex:1; min-width:0; }
  .co-item-top { display:flex; align-items:center; gap:8px; }
  .co-de { font-size:13px; font-weight:700; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; }
  .co-pru-tag { font-size:9px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; color:#8A6A34; background:${C.goldBg}; border:1px solid rgba(193,151,91,.4); padding:2px 7px; border-radius:9px; }
  .co-fecha { margin-left:auto; font-size:11px; color:${C.textLight}; white-space:nowrap; }
  .co-asunto { font-size:12.5px; color:${C.text}; font-weight:600; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .co-snip { font-size:11.5px; color:${C.textMuted}; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .co-empty, .co-note { background:#fff; border:1px dashed var(--hair); border-radius:14px; padding:30px 20px; text-align:center; color:${C.textMuted}; font-size:13px; }
  .co-note svg { color:${C.amber}; margin-bottom:8px; }

  .co-overlay { position:fixed; inset:0; background:rgba(5,16,36,.4); backdrop-filter:blur(2px); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .co-modal { background:#fff; border-radius:16px; width:min(620px, 96vw); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 70px -30px rgba(4,12,26,.6); border:1px solid rgba(193,151,91,.35); animation:coRise .25s ease; }
  .co-modal-h { display:flex; align-items:center; justify-content:space-between; padding:15px 20px; background:radial-gradient(140% 180% at 10% 0%, #14315E 0%, ${C.ink} 60%); color:#F2E4C8; }
  .co-modal-h h3 { margin:0; font-size:15px; font-weight:700; max-width:460px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .co-modal-h button { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); color:#E9DFC8; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .co-modal-meta { padding:12px 20px; border-bottom:1px solid var(--hair); font-size:12px; color:${C.textMuted}; }
  .co-otp { display:flex; align-items:center; gap:10px; margin:14px 20px; padding:14px 16px; border-radius:12px; background:linear-gradient(180deg,#FFFDF8,#FBF4E3); border:1px solid rgba(193,151,91,.5); }
  .co-otp-code { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:700; letter-spacing:4px; color:#8A6A34; }
  .co-body { padding:4px 20px 20px; overflow-y:auto; font-size:13px; line-height:1.6; color:${C.text}; white-space:pre-wrap; word-break:break-word; }
`;

export default function CrmCorreosView() {
  const [buzones, setBuzones] = useState([]);
  const [sel, setSel] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [q, setQ] = useState('');
  const [soloPru, setSoloPru] = useState(false);
  const [estado, setEstado] = useState(null); // {reconectar, sinGmail, email}
  const [abierto, setAbierto] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { (async () => {
    try { const b = await api.correosBuzones(); setBuzones(b); setSel(b.find(x => x.socioKey === 'flavio')?.socioKey || b[0]?.socioKey || null); }
    catch { /* */ } finally { setLoading(false); }
  })(); }, []);

  const cargar = useCallback(async () => {
    if (!sel) return;
    setListLoading(true); setEstado(null);
    try {
      const r = await api.correosList(sel, { q: q.trim() || undefined, prudential: soloPru });
      setMensajes(r.mensajes || []);
      if (r.reconectar) setEstado({ reconectar: true, email: r.email });
      if (r.sinGmail) setEstado({ sinGmail: true });
    } catch (e) { setEstado({ error: e.message }); setMensajes([]); }
    finally { setListLoading(false); }
  }, [sel, q, soloPru]);
  useEffect(() => { cargar(); }, [sel, soloPru]); // eslint-disable-line

  const abrir = async (id) => {
    setAbierto({ cargando: true });
    try { setAbierto(await api.correoGet(id, sel)); }
    catch (e) { setAbierto({ error: e.message }); }
  };
  const copiar = (t) => { navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); };
  const conectar = async () => { try { const { url } = await api.getGoogleAuthUrl(); window.location.href = url; } catch { /* */ } };

  return (
    <div className="co">
      <style>{CO_CSS}</style>
      <div className="co-plaque">
        <div>
          <h1><Mail size={22} /> Correos</h1>
          <p>Bandeja de administración · los correos que llegan a las cuentas conectadas (OTP de Prudential incluidos)</p>
        </div>
        <button className="co-btn" onClick={cargar} disabled={listLoading} style={{ background: 'rgba(255,255,255,.06)', color: '#D6B37E', borderColor: 'rgba(193,151,91,.4)' }}>
          <RefreshCw size={13} className={listLoading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {loading ? <p className="co-empty">Cargando bandejas…</p> : buzones.length === 0 ? (
        <div className="co-note">
          <ShieldAlert size={34} />
          <p>Aún no hay ninguna cuenta de Google conectada.<br />Conecta el correo de integración (Flavio) para ver aquí los correos de Prudential.</p>
          <button className="co-btn gold" style={{ margin: '12px auto 0' }} onClick={conectar}><Link2 size={14} /> Conectar correo</button>
        </div>
      ) : (
        <>
          <div className="co-bar">
            {buzones.map(b => (
              <button key={b.socioKey} className={`co-buz${sel === b.socioKey ? ' on' : ''}`} onClick={() => setSel(b.socioKey)}>
                <Inbox size={13} /> {SOCIO_LABEL[b.socioKey] || b.socioKey} <span style={{ opacity: .6, fontWeight: 500 }}>{b.email}</span>
              </button>
            ))}
            <button className={`co-btn${soloPru ? ' on' : ''}`} onClick={() => setSoloPru(s => !s)}>
              <Key size={13} /> Solo Prudential
            </button>
            <form className="co-search" onSubmit={e => { e.preventDefault(); cargar(); }}>
              <Search size={13} />
              <input placeholder="Buscar en el correo…" value={q} onChange={e => setQ(e.target.value)} />
            </form>
          </div>

          {estado?.reconectar && (
            <div className="co-note"><ShieldAlert size={30} />
              <p>El correo <b>{estado.email}</b> está conectado pero sin permiso de lectura de Gmail.<br />Reconéctalo una vez para autorizar el acceso a la bandeja.</p>
              <button className="co-btn gold" style={{ margin: '12px auto 0' }} onClick={conectar}><Link2 size={14} /> Reconectar y autorizar Gmail</button>
            </div>
          )}
          {estado?.sinGmail && <div className="co-note">Esa bandeja no está conectada todavía.</div>}
          {estado?.error && <div className="co-note" style={{ color: C.red }}>{estado.error}</div>}

          {!estado && (listLoading
            ? <p className="co-empty">Cargando correos…</p>
            : mensajes.length === 0
              ? <p className="co-empty">Sin correos {soloPru ? 'de Prudential' : ''} en esta bandeja.</p>
              : (
                <div className="co-list">
                  {mensajes.map(m => (
                    <div key={m.id} className={`co-item${m.noLeido ? ' unread' : ''}${m.esPrudential ? ' pru' : ''}`} onClick={() => abrir(m.id)}>
                      <span className={`co-dot${m.noLeido ? '' : ' read'}`} />
                      <div className="co-item-main">
                        <div className="co-item-top">
                          <span className="co-de">{nombreDe(m.de)}</span>
                          {m.esPrudential && <span className="co-pru-tag">Prudential</span>}
                          <span className="co-fecha">{fmtFecha(m.fecha)}</span>
                        </div>
                        <div className="co-asunto">{m.asunto}</div>
                        <div className="co-snip">{m.snippet}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
        </>
      )}

      {abierto && (
        <div className="co-overlay" onClick={() => setAbierto(null)}>
          <div className="co-modal" onClick={e => e.stopPropagation()}>
            <div className="co-modal-h">
              <h3>{abierto.cargando ? 'Cargando…' : abierto.asunto || '(sin asunto)'}</h3>
              <button onClick={() => setAbierto(null)}><X size={15} /></button>
            </div>
            {abierto.cargando ? <p className="co-empty" style={{ border: 'none' }}>Abriendo correo…</p>
              : abierto.error ? <p className="co-empty" style={{ border: 'none', color: C.red }}>{abierto.error}</p>
                : (
                  <>
                    <div className="co-modal-meta">De: <b>{nombreDe(abierto.de)}</b> · {fmtFecha(abierto.fecha)}</div>
                    {abierto.otp && (
                      <div className="co-otp">
                        <Key size={20} style={{ color: '#8A6A34' }} />
                        <div><div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8A6A34', fontWeight: 800 }}>Código detectado</div>
                          <span className="co-otp-code">{abierto.otp}</span></div>
                        <button className="co-btn gold" style={{ marginLeft: 'auto' }} onClick={() => copiar(abierto.otp)}>{copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}</button>
                      </div>
                    )}
                    <div className="co-body">{abierto.cuerpo}</div>
                  </>
                )}
          </div>
        </div>
      )}
    </div>
  );
}
