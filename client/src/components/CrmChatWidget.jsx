/**
 * CrmChatWidget — Copiloto Comercial S-COOL (chatbot flotante del CRM).
 * Pregúntale por tu índice, cuánto te falta para el siguiente bono, qué vender,
 * la carrera de la promotoría, etc. El servidor arma el contexto EN VIVO desde
 * la base (motor PIR + corte del Reporte de pólizas) en cada pregunta, scoped
 * por rol: el asesor solo ve lo suyo; agencia/admin toda la promotoría.
 */
import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { MessageCircleQuestion, X, Send, Sparkles } from 'lucide-react';

/* Markdown ligero → HTML seguro: el modelo responde con **negritas**, listas y
   títulos; esto los estiliza en vez de mostrar los asteriscos crudos. */
function mdToHtml(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  const lines = esc.split('\n');
  let html = '', enLista = false;
  for (const raw of lines) {
    const l = raw.trimEnd();
    const li = /^\s*[-•]\s+(.*)/.exec(l);
    if (li) {
      if (!enLista) { html += '<ul>'; enLista = true; }
      html += `<li>${inline(li[1])}</li>`;
      continue;
    }
    if (enLista) { html += '</ul>'; enLista = false; }
    const h = /^#{1,3}\s+(.*)/.exec(l);
    if (h) { html += `<p class="ccw-h">${inline(h[1])}</p>`; continue; }
    if (l.trim() === '') { html += '<div class="ccw-sp"></div>'; continue; }
    html += `<p>${inline(l)}</p>`;
  }
  if (enLista) html += '</ul>';
  return html;
}

const SUGERENCIAS = [
  '¿Cuánto me falta para mi siguiente bono?',
  '¿Qué debo vender este mes para subir mi prima?',
  '¿Cómo va la carrera del trimestre?',
  '¿Qué pólizas debo rehabilitar hoy?',
];

const css = `
  .ccw-fab{position:fixed;right:22px;bottom:22px;z-index:900;width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;
    background:linear-gradient(140deg,#0B1B33,#0A2A66);color:#E8CFA6;display:flex;align-items:center;justify-content:center;
    box-shadow:0 8px 26px rgba(5,22,54,.45), 0 0 0 2px rgba(193,151,91,.45);transition:transform .18s}
  .ccw-fab:hover{transform:scale(1.07)}
  .ccw-panel{position:fixed;right:22px;bottom:86px;z-index:901;width:392px;max-width:calc(100vw - 30px);height:540px;max-height:calc(100vh - 120px);
    background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(5,22,54,.35);display:flex;flex-direction:column;overflow:hidden;
    border:1px solid rgba(11,27,51,.1);animation:ccwIn .22s ease}
  @keyframes ccwIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .ccw-head{background:linear-gradient(135deg,#0B1B33,#0A2A66);color:#fff;padding:13px 16px;display:flex;align-items:center;gap:9px}
  .ccw-head b{font-size:13.5px}
  .ccw-head span{font-size:10.5px;opacity:.75;display:block}
  .ccw-msgs{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#F6F8FB}
  .ccw-m{max-width:86%;padding:9px 12px;border-radius:13px;font-size:12.8px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
  .ccw-m.user{align-self:flex-end;background:#0B1B33;color:#fff;border-bottom-right-radius:4px}
  .ccw-m.bot{align-self:flex-start;background:#fff;border:1px solid rgba(11,27,51,.09);color:#1c2b40;border-bottom-left-radius:4px}
  .ccw-m.bot p{margin:0 0 2px}
  .ccw-m.bot .ccw-h{font-weight:700;color:#0B1B33;margin:6px 0 2px}
  .ccw-m.bot .ccw-sp{height:7px}
  .ccw-m.bot ul{margin:2px 0 4px;padding-left:18px}
  .ccw-m.bot li{margin:2px 0}
  .ccw-m.bot b{color:#0B1B33}
  .ccw-m.bot code{background:rgba(11,27,51,.06);border-radius:4px;padding:0 4px;font-size:12px}
  .ccw-hint{position:fixed;right:88px;bottom:30px;z-index:899;background:#0B1B33;color:#fff;border-radius:14px 14px 4px 14px;
    padding:10px 14px;font-size:12.5px;max-width:230px;box-shadow:0 10px 30px rgba(5,22,54,.35);animation:ccwHint .4s ease;cursor:pointer;line-height:1.4}
  .ccw-hint b{color:#E8CFA6}
  .ccw-hint .ccw-hint-x{position:absolute;top:4px;right:7px;opacity:.6;font-size:11px}
  .ccw-hint::after{content:'';position:absolute;right:-7px;bottom:8px;border:7px solid transparent;border-left-color:#0B1B33;border-bottom:none}
  @keyframes ccwHint{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes ccwPulse{0%,100%{box-shadow:0 8px 26px rgba(5,22,54,.45),0 0 0 2px rgba(193,151,91,.45)}50%{box-shadow:0 8px 26px rgba(5,22,54,.45),0 0 0 8px rgba(193,151,91,.18)}}
  .ccw-fab.pulse{animation:ccwPulse 2.2s ease-in-out infinite}
  .ccw-sug{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#F6F8FB}
  .ccw-sug button{border:1px solid rgba(11,27,51,.14);background:#fff;border-radius:16px;padding:5px 10px;font-size:11px;cursor:pointer;color:#33475f}
  .ccw-sug button:hover{border-color:#0088E0;color:#0088E0}
  .ccw-input{display:flex;gap:8px;padding:11px 12px;border-top:1px solid rgba(11,27,51,.08);background:#fff}
  .ccw-input textarea{flex:1;resize:none;border:1px solid rgba(11,27,51,.15);border-radius:11px;padding:8px 11px;font-size:12.8px;font-family:inherit;height:38px;outline:none}
  .ccw-input textarea:focus{border-color:#0088E0}
  .ccw-send{border:none;border-radius:11px;width:40px;background:linear-gradient(140deg,#0088E0,#0B5FAB);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .ccw-send:disabled{opacity:.5;cursor:default}
  .ccw-typing{align-self:flex-start;font-size:11px;color:#6b7a90;padding:2px 6px}
`;

/* Panel de chat reutilizable: lo usan el widget flotante y el Coach de ventas
   en grande de la Incubadora (modo 'coach'). Cada instancia lleva su historial. */
export function ChatPanel({ modo = null, sugerencias = SUGERENCIAS, intro, alto = null }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const enviar = async (q) => {
    const pregunta = (q ?? text).trim();
    if (!pregunta || busy) return;
    const nuevos = [...msgs, { role: 'user', content: pregunta }];
    setMsgs(nuevos); setText(''); setBusy(true);
    try {
      const r = await api.crmChat(nuevos.slice(-10), modo);
      setMsgs([...nuevos, { role: 'assistant', content: r.respuesta }]);
    } catch (e) {
      setMsgs([...nuevos, { role: 'assistant', content: `⚠ ${e.message || 'No pude responder, intenta de nuevo.'}` }]);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(alto ? { height: alto, flex: '0 0 auto' } : {}) }}>
      <div className="ccw-msgs">
        {msgs.length === 0 && <div className="ccw-m bot">{intro}</div>}
        {msgs.map((m, i) => m.role === 'user'
          ? <div key={i} className="ccw-m user">{m.content}</div>
          : <div key={i} className="ccw-m bot" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />)}
        {busy && <div className="ccw-typing">Copiloto escribiendo…</div>}
        <div ref={endRef} />
      </div>
      {msgs.length === 0 && (
        <div className="ccw-sug">
          {sugerencias.map(s => <button key={s} onClick={() => enviar(s)}>{s}</button>)}
        </div>
      )}
      <div className="ccw-input">
        <textarea value={text} placeholder="Escribe tu pregunta…" onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <button className="ccw-send" disabled={busy || !text.trim()} onClick={() => enviar()} title="Enviar"><Send size={15} /></button>
      </div>
    </div>
  );
}

export const chatCSS = css;

export default function CrmChatWidget({ isAgency }) {
  const [open, setOpen] = useState(false);
  // Burbuja "¿Necesitas ayuda?": visible hasta que abren el chat o la cierran
  const [hint, setHint] = useState(() => localStorage.getItem('fsc_copiloto_hint') !== 'off');

  const abrir = () => { setOpen(o => !o); setHint(false); localStorage.setItem('fsc_copiloto_hint', 'off'); };
  const cerrarHint = (e) => { e.stopPropagation(); setHint(false); localStorage.setItem('fsc_copiloto_hint', 'off'); };

  return (
    <>
      <style>{css}</style>
      {open && (
        <div className="ccw-panel">
          <div className="ccw-head">
            <Sparkles size={17} color="#E8CFA6" />
            <div style={{ flex: 1 }}>
              <b>Copiloto S-COOL</b>
              <span>{isAgency ? 'Con el contexto vivo de toda la promotoría' : 'Con el contexto vivo de tu cartera y tus bonos'}</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}><X size={17} /></button>
          </div>
          <ChatPanel intro="¡Hola! Soy tu copiloto comercial. Pregúntame cuánto te falta para tu siguiente bono, qué vender para subir tu prima, cómo va tu índice o la carrera del trimestre. 🏁" />
        </div>
      )}
      {hint && !open && (
        <div className="ccw-hint" onClick={abrir} title="Abrir el Copiloto">
          <span className="ccw-hint-x" onClick={cerrarHint}>✕</span>
          👋 <b>¿Necesitas ayuda?</b> Pregúntame cuánto te falta para tu bono, qué cobrar o qué rehabilitar hoy.
        </div>
      )}
      <button className={`ccw-fab${hint && !open ? ' pulse' : ''}`} onClick={abrir} title="Copiloto S-COOL — pregúntame sobre tus bonos, índice y cartera">
        {open ? <X size={22} /> : <MessageCircleQuestion size={24} />}
      </button>
    </>
  );
}
