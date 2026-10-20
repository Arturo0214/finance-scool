import { useState, useEffect, useRef } from 'react';
import { getWhatsAppURL, trackMetaLead, trackWhatsAppClick } from '../utils/tracking';

/**
 * ChatSofia — asesora digital 24/7 en la landing de Finance S-Cool.
 * ──────────────────────────────────────────────────────────────────
 * Conversación GUIADA (determinista, sin costo de API, nunca inventa precios,
 * nunca dice "cancelar"): saluda, califica (objetivo, ingreso, declaración,
 * retiro) y captura nombre + WhatsApp → cae en el MISMO pipeline de leads
 * (POST /api/leads source=chat_web) que ya dispara el ping instantáneo a
 * Telegram con botón de WhatsApp. Al cerrar, ofrece agendar sesión (Calendly).
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const CALENDLY = 'https://calendly.com/ingrid-escobar-grupointegraccion/new-meeting';

const OBJETIVOS = [
  { label: 'Pagar menos ISR', service: 'fiscal', tag: 'Quiere pagar menos impuestos' },
  { label: 'Armar mi retiro', service: 'retiro', tag: 'Quiere armar su retiro' },
  { label: 'Proteger a mi familia', service: 'PPR', tag: 'Quiere proteger a su familia' },
  { label: 'Invertir mejor', service: 'PPR', tag: 'Quiere invertir mejor' },
];
const INGRESOS = [
  { label: 'Empleado', value: 'empleado' },
  { label: 'Freelancer / Honorarios', value: 'freelancer' },
  { label: 'Empresario / Dueño', value: 'empresario' },
  { label: 'Mixto', value: 'mixto' },
];
const RANGOS = [
  { label: '$20k – $50k', value: '20k-50k' },
  { label: '$50k – $100k', value: '50k-100k' },
  { label: '$100k – $200k', value: '100k-200k' },
  { label: 'Más de $200k', value: '200k+' },
];
const DECLARA = [
  { label: 'Sí declaro', value: 'si' },
  { label: 'No', value: 'no' },
  { label: 'No estoy seguro', value: 'no_se' },
];
const RETIRO = [
  { label: 'Sí, un PPR', value: 'si_ppr' },
  { label: 'Sí, otro', value: 'si_otro' },
  { label: 'Aún no', value: 'no' },
  { label: 'No sé qué es', value: 'no_se' },
];

// Orden del guion → pregunta que Sofia hace al ENTRAR a cada etapa
const PREGUNTAS = {
  objetivo: '¡Hola! Soy Sofia, tu asesora digital de Finance S-Cool 👋 En menos de 1 minuto te ayudo a ver cómo pagar menos impuestos y construir tu retiro. ¿Qué te gustaría lograr primero?',
  ingreso: 'Perfecto. ¿Cómo generas tus ingresos principalmente?',
  rango: '¿En qué rango está tu ingreso mensual aproximado? (solo para orientar tu estrategia)',
  declara: '¿Actualmente declaras impuestos ante el SAT?',
  retiro: '¿Ya cuentas con un plan de retiro propio (PPR o aportaciones voluntarias)?',
  nombre: '¡Genial! Con esto ya puedo preparar tu diagnóstico. ¿Cuál es tu nombre?',
  telefono: 'Mucho gusto 🙌 ¿A qué número de WhatsApp te contacta tu asesor? (10 dígitos)',
  correo: '¿Y tu correo? Así te mandamos tu diagnóstico por escrito. (Si prefieres, toca "Omitir").',
};

export default function ChatSofia() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('objetivo');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState({});
  const scrollRef = useRef(null);
  const startedRef = useRef(false);

  const pushUser = (text) => setMessages((m) => [...m, { from: 'user', text }]);
  const pushBot = (text, delay = 650) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { from: 'bot', text }]);
    }, delay);
  };
  const goTo = (nextStage, delay) => {
    setStage(nextStage);
    if (PREGUNTAS[nextStage]) pushBot(PREGUNTAS[nextStage], delay);
  };

  // Arranca la conversación la primera vez que se abre
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      pushBot(PREGUNTAS.objetivo);
    }
  }, [open]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // ——— manejadores por etapa (chips) ———
  function pickObjetivo(o) {
    pushUser(o.label);
    setData((d) => ({ ...d, service: o.service, message: o.tag }));
    goTo('ingreso');
  }
  function pickIngreso(o) { pushUser(o.label); setData((d) => ({ ...d, incomeType: o.value })); goTo('rango'); }
  function pickRango(o) { pushUser(o.label); setData((d) => ({ ...d, approxIncome: o.value })); goTo('declara'); }
  function pickDeclara(o) { pushUser(o.label); setData((d) => ({ ...d, declaracion: o.value })); goTo('retiro'); }
  function pickRetiro(o) { pushUser(o.label); setData((d) => ({ ...d, retiroPlan: o.value })); goTo('nombre'); }

  // ——— etapas de texto ———
  function submitText() {
    const v = input.trim();
    setError('');
    if (stage === 'nombre') {
      if (v.length < 2 || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(v)) { setError('Escribe tu nombre (solo letras).'); return; }
      const nombre = v.slice(0, 60);
      pushUser(nombre);
      setData((d) => ({ ...d, name: nombre }));
      setInput('');
      goTo('telefono');
    } else if (stage === 'telefono') {
      const dig = v.replace(/\D/g, '');
      if (dig.length < 10 || dig.length > 13) { setError('Necesito un WhatsApp válido (10 dígitos).'); return; }
      pushUser(v);
      setData((d) => ({ ...d, phone: v }));
      setInput('');
      goTo('correo');
    } else if (stage === 'correo') {
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setError('Ese correo no se ve válido. Puedes tocar "Omitir".'); return; }
      pushUser(v || 'Prefiero omitirlo');
      finalizar({ ...data, email: v || '' });
      setInput('');
    }
  }

  function omitirCorreo() {
    pushUser('Prefiero omitirlo');
    finalizar({ ...data, email: '' });
  }

  async function finalizar(d) {
    setStage('enviando');
    setTyping(true);
    const primer = (d.name || '').split(/\s+/)[0] || '';
    const payload = {
      name: d.name, phone: d.phone, email: d.email || '',
      service: d.service || 'PPR', message: d.message || '',
      incomeType: d.incomeType || '', approxIncome: d.approxIncome || '',
      declaracion: d.declaracion || '', retiroPlan: d.retiroPlan || '',
      source: 'chat_web',
    };
    let ok = false;
    try {
      const r = await fetch(`${API_URL}/leads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      ok = r.ok;
    } catch { ok = false; }
    try { trackMetaLead({ tipo: 'Chat Sofia', categoria: d.incomeType || '', valor_estimado: 0, ingreso: d.approxIncome || '' }); } catch { /* tracking best-effort */ }
    setTyping(false);
    setStage('listo');
    setMessages((m) => [...m, {
      from: 'bot',
      text: ok
        ? `¡Listo${primer ? ', ' + primer : ''}! 🎉 Tu asesor de Finance S-Cool te contactará por WhatsApp muy pronto con tu diagnóstico. Si quieres, agenda tu sesión ahora mismo 👇`
        : `¡Gracias${primer ? ', ' + primer : ''}! Para no perder tu lugar, escríbenos directo por WhatsApp y con gusto seguimos 👇`,
    }]);
  }

  const waPrefill = encodeURIComponent(`Hola, soy ${data.name || ''}. Acabo de platicar con Sofia y quiero mi diagnóstico de Finance S-Cool.`);

  function renderInputArea() {
    if (typing) return null;
    const chips = (arr, fn) => (
      <div className="sofia-chips">
        {arr.map((o) => (
          <button key={o.label} className="sofia-chip" onClick={() => fn(o)}>{o.label}</button>
        ))}
      </div>
    );
    if (stage === 'objetivo') return chips(OBJETIVOS, pickObjetivo);
    if (stage === 'ingreso') return chips(INGRESOS, pickIngreso);
    if (stage === 'rango') return chips(RANGOS, pickRango);
    if (stage === 'declara') return chips(DECLARA, pickDeclara);
    if (stage === 'retiro') return chips(RETIRO, pickRetiro);
    if (stage === 'nombre' || stage === 'telefono' || stage === 'correo') {
      return (
        <div className="sofia-inputwrap">
          {error && <div className="sofia-err">{error}</div>}
          {stage === 'correo' && <button className="sofia-skip" onClick={omitirCorreo}>Omitir</button>}
          <div className="sofia-inputrow">
            <input
              className="sofia-input"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitText(); }}
              placeholder={stage === 'nombre' ? 'Tu nombre…' : stage === 'telefono' ? '55 1234 5678' : 'tucorreo@ejemplo.com'}
              type={stage === 'telefono' ? 'tel' : stage === 'correo' ? 'email' : 'text'}
              inputMode={stage === 'telefono' ? 'tel' : 'text'}
              autoFocus
            />
            <button className="sofia-send" onClick={submitText} aria-label="Enviar">➤</button>
          </div>
        </div>
      );
    }
    if (stage === 'listo') {
      return (
        <div className="sofia-chips sofia-cta">
          <button className="sofia-chip sofia-chip-gold" onClick={() => {
            if (window.Calendly) window.Calendly.initPopupWidget({ url: CALENDLY, prefill: { name: data.name, email: data.email } });
            else window.open(CALENDLY, '_blank', 'noopener');
          }}>📅 Agendar mi sesión</button>
          <a className="sofia-chip sofia-chip-wa" href={`${getWhatsAppURL()}${getWhatsAppURL().includes('?') ? '&' : '?'}text=${waPrefill}`}
             target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('chat_sofia')}>
            💬 Escribir por WhatsApp
          </a>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <style>{sofiaCSS}</style>

      {!open && (
        <button className="sofia-launcher" onClick={() => setOpen(true)} aria-label="Abrir chat con Sofia">
          <span className="sofia-launcher-av">S</span>
          <span className="sofia-launcher-txt">
            <strong>Chatea con Sofia</strong>
            <em>Tu asesora · responde ahora</em>
          </span>
          <span className="sofia-dot" />
        </button>
      )}

      {open && (
        <div className="sofia-panel" role="dialog" aria-label="Chat con Sofia">
          <header className="sofia-head">
            <div className="sofia-head-av">S</div>
            <div className="sofia-head-info">
              <strong>Sofia</strong>
              <span><i className="sofia-online" /> Asesora digital · en línea</span>
            </div>
            <button className="sofia-close" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </header>

          <div className="sofia-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`sofia-msg sofia-${m.from}`}>
                {m.from === 'bot' && <span className="sofia-msg-av">S</span>}
                <span className="sofia-bubble">{m.text}</span>
              </div>
            ))}
            {typing && (
              <div className="sofia-msg sofia-bot">
                <span className="sofia-msg-av">S</span>
                <span className="sofia-bubble sofia-typing"><i /><i /><i /></span>
              </div>
            )}
          </div>

          <div className="sofia-foot">{renderInputArea()}</div>
          <div className="sofia-brand">🔒 Finance S-Cool · Tus datos están seguros</div>
        </div>
      )}
    </>
  );
}

const sofiaCSS = `
.sofia-launcher {
  position: fixed; right: 30px; bottom: 106px; z-index: 1035;
  display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 8px;
  background: linear-gradient(135deg, #001233, #003DA5); color: #fff;
  border: 1px solid rgba(212,175,55,0.45); border-radius: 999px; cursor: pointer;
  box-shadow: 0 10px 34px rgba(0,18,51,0.4); font-family: 'Inter', sans-serif;
  transition: transform 300ms cubic-bezier(.4,0,.2,1), box-shadow 300ms; animation: sofiaPop .5s ease both;
}
.sofia-launcher:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 16px 42px rgba(0,61,165,0.5); }
.sofia-launcher-av {
  width: 40px; height: 40px; border-radius: 50%; flex: 0 0 40px;
  background: linear-gradient(135deg, #D4AF37, #C9A84C); color: #001233;
  display: flex; align-items: center; justify-content: center; font-weight: 800;
  font-family: 'Playfair Display', serif; font-size: 1.2rem;
}
.sofia-launcher-txt { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
.sofia-launcher-txt strong { font-size: .92rem; font-weight: 700; }
.sofia-launcher-txt em { font-size: .72rem; font-style: normal; color: rgba(255,255,255,.72); }
.sofia-dot { position: absolute; top: 6px; left: 36px; width: 11px; height: 11px; border-radius: 50%; background: #25D366; border: 2px solid #001233; box-shadow: 0 0 0 0 rgba(37,211,102,.6); animation: sofiaPulse 2s infinite; }

.sofia-panel {
  position: fixed; right: 30px; bottom: 30px; z-index: 1045;
  width: min(384px, calc(100vw - 32px)); height: min(610px, calc(100vh - 90px));
  display: flex; flex-direction: column; background: #F7F8FC;
  border-radius: 20px; overflow: hidden; font-family: 'Inter', sans-serif;
  box-shadow: 0 24px 70px rgba(0,18,51,0.45); border: 1px solid rgba(0,18,51,0.08);
  animation: sofiaUp .35s cubic-bezier(.25,.46,.45,.94) both;
}
.sofia-head {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: linear-gradient(135deg, #001233, #003DA5); color: #fff;
}
.sofia-head-av {
  width: 42px; height: 42px; border-radius: 50%; flex: 0 0 42px;
  background: linear-gradient(135deg, #D4AF37, #C9A84C); color: #001233;
  display: flex; align-items: center; justify-content: center; font-weight: 800;
  font-family: 'Playfair Display', serif; font-size: 1.3rem;
}
.sofia-head-info { display: flex; flex-direction: column; flex: 1; line-height: 1.25; }
.sofia-head-info strong { font-size: 1.02rem; font-family: 'Playfair Display', serif; }
.sofia-head-info span { font-size: .74rem; color: rgba(255,255,255,.8); display: flex; align-items: center; gap: 6px; }
.sofia-online { width: 8px; height: 8px; border-radius: 50%; background: #25D366; display: inline-block; box-shadow: 0 0 0 0 rgba(37,211,102,.6); animation: sofiaPulse 2s infinite; }
.sofia-close { background: rgba(255,255,255,.12); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: .9rem; transition: background 200ms; }
.sofia-close:hover { background: rgba(255,255,255,.25); }

.sofia-body { flex: 1; overflow-y: auto; padding: 16px 14px 6px; display: flex; flex-direction: column; gap: 10px; }
.sofia-msg { display: flex; align-items: flex-end; gap: 8px; max-width: 92%; animation: sofiaFade .3s ease both; }
.sofia-msg.sofia-user { align-self: flex-end; flex-direction: row-reverse; }
.sofia-msg-av { width: 26px; height: 26px; flex: 0 0 26px; border-radius: 50%; background: linear-gradient(135deg,#D4AF37,#C9A84C); color:#001233; font-weight:800; font-size:.72rem; display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; }
.sofia-bubble { padding: 10px 14px; border-radius: 16px; font-size: .9rem; line-height: 1.45; white-space: pre-wrap; }
.sofia-bot .sofia-bubble { background: #fff; color: #001233; border: 1px solid rgba(0,18,51,.07); border-bottom-left-radius: 5px; box-shadow: 0 2px 8px rgba(0,18,51,.05); }
.sofia-user .sofia-bubble { background: linear-gradient(135deg, #003DA5, #0067C5); color: #fff; border-bottom-right-radius: 5px; }

.sofia-typing { display: inline-flex; gap: 4px; align-items: center; padding: 13px 14px; }
.sofia-typing i { width: 7px; height: 7px; border-radius: 50%; background: #9CA3AF; display: inline-block; animation: sofiaBlink 1.4s infinite both; }
.sofia-typing i:nth-child(2) { animation-delay: .2s; }
.sofia-typing i:nth-child(3) { animation-delay: .4s; }

.sofia-foot { padding: 8px 12px 4px; }
.sofia-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sofia-chip {
  flex: 1 1 calc(50% - 8px); min-width: 120px; padding: 10px 12px; cursor: pointer;
  background: #fff; border: 1.5px solid #003DA5; color: #003DA5; border-radius: 12px;
  font-size: .84rem; font-weight: 600; font-family: 'Inter', sans-serif; transition: all 180ms; text-align: center; text-decoration: none;
}
.sofia-chip:hover { background: #003DA5; color: #fff; transform: translateY(-2px); }
.sofia-cta { flex-direction: column; }
.sofia-cta .sofia-chip { flex: 1 1 auto; }
.sofia-chip-gold { background: linear-gradient(135deg,#D4AF37,#C9A84C); border-color: #C9A84C; color: #001233; }
.sofia-chip-gold:hover { background: linear-gradient(135deg,#C9A84C,#B99830); color: #001233; }
.sofia-chip-wa { background: #25D366; border-color: #25D366; color: #fff; display: block; }
.sofia-chip-wa:hover { background: #20BD5A; color: #fff; }

.sofia-inputwrap { display: flex; flex-direction: column; gap: 6px; }
.sofia-err { font-size: .76rem; color: #EF4444; padding: 0 4px; }
.sofia-skip { align-self: flex-start; background: none; border: none; color: #003DA5; font-size: .8rem; cursor: pointer; text-decoration: underline; padding: 0 4px; }
.sofia-inputrow { display: flex; gap: 8px; }
.sofia-input { flex: 1; padding: 11px 14px; border: 1.5px solid rgba(0,18,51,.15); border-radius: 12px; font-size: .9rem; font-family: 'Inter', sans-serif; outline: none; transition: border 180ms; }
.sofia-input:focus { border-color: #003DA5; }
.sofia-send { width: 44px; flex: 0 0 44px; border: none; border-radius: 12px; background: linear-gradient(135deg,#003DA5,#0067C5); color: #fff; font-size: 1rem; cursor: pointer; transition: transform 180ms; }
.sofia-send:hover { transform: scale(1.06); }

.sofia-brand { text-align: center; font-size: .68rem; color: #9CA3AF; padding: 2px 0 10px; }

@keyframes sofiaUp { from { opacity: 0; transform: translateY(24px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes sofiaPop { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sofiaFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sofiaPulse { 0% { box-shadow: 0 0 0 0 rgba(37,211,102,.6); } 70% { box-shadow: 0 0 0 7px rgba(37,211,102,0); } 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); } }
@keyframes sofiaBlink { 0%,80%,100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }

@media (max-width: 768px) {
  .sofia-launcher { right: 16px; bottom: 82px; padding: 7px 14px 7px 7px; }
  .sofia-launcher-av { width: 34px; height: 34px; flex: 0 0 34px; font-size: 1rem; }
  .sofia-dot { left: 30px; }
  .sofia-panel { right: 12px; left: 12px; bottom: 16px; width: auto; height: min(74vh, 560px); }
}
`;
