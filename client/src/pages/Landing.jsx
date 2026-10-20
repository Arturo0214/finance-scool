import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, MessageCircle, ArrowRight, Check } from 'lucide-react';
import Logo from '../components/Logo';
import ChatSofia from '../components/ChatSofia';
import { getWhatsAppURL, trackWhatsAppClick, trackCalculadoraISR, trackMetaViewContent, initScrollTracking, trackMetaLead } from '../utils/tracking';

/* ============================================================================
   Finance S-Cool — Landing "Fresh Fintech"
   Dirección: fintech claro y fresco (vibra Lemonade / Mercury / Wise).
   Fondo claro + muchísimo aire, tipografía grande y segura (Bricolage Grotesque
   display + Hanken Grotesk cuerpo), UN acento verde esmeralda, mockups limpios.
   Sin mención a Prudential. Conserva la lógica probada: calculadora ISR 2026,
   formulario → /api/leads (+ping Telegram), chat Sofia, tracking Meta Pixel.
   ========================================================================== */

const API_URL = import.meta.env.VITE_API_URL || '/api';
const CALENDLY = 'https://calendly.com/ingrid-escobar-grupointegraccion/new-meeting';

// ===== ISR 2026 =====
const ISR_TABLE_2026 = [
  { limInf: 0.01, limSup: 10135.11, cuota: 0, pct: 0.0192 },
  { limInf: 10135.12, limSup: 86022.11, cuota: 171.88, pct: 0.064 },
  { limInf: 86022.12, limSup: 151176.19, cuota: 4461.94, pct: 0.1088 },
  { limInf: 151176.20, limSup: 175735.66, cuota: 10723.55, pct: 0.16 },
  { limInf: 175735.67, limSup: 210403.69, cuota: 14194.54, pct: 0.1792 },
  { limInf: 210403.70, limSup: 424353.97, cuota: 19682.13, pct: 0.2136 },
  { limInf: 424353.98, limSup: 668840.14, cuota: 60049.40, pct: 0.2352 },
  { limInf: 668840.15, limSup: 1276925.98, cuota: 110842.74, pct: 0.30 },
  { limInf: 1276925.99, limSup: 1702567.97, cuota: 271981.99, pct: 0.32 },
  { limInf: 1702567.98, limSup: 5107703.92, cuota: 392294.17, pct: 0.34 },
  { limInf: 5107703.93, limSup: Infinity, cuota: 1414947.85, pct: 0.35 },
];
const CINCO_UMAS_ANUALES = 213973.20;
function calcISR(a) {
  if (a <= 0) return 0;
  for (const b of ISR_TABLE_2026) if (a >= b.limInf && a <= b.limSup) return b.cuota + (a - b.limInf) * b.pct;
  const l = ISR_TABLE_2026[ISR_TABLE_2026.length - 1];
  return l.cuota + (a - l.limInf) * l.pct;
}
function tasaMarginal(a) { for (const b of ISR_TABLE_2026) if (a >= b.limInf && a <= b.limSup) return b.pct; return 0.35; }
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtK = (n) => n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace('.0', '') + 'M' : '$' + Math.round(n / 1000) + 'k';

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.fx-rv').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function useCountUp(end, duration = 1800) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let raf, t0 = null, done = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done) {
        done = true;
        const step = (t) => { if (!t0) t0 = t; const p = Math.min((t - t0) / duration, 1); const e2 = 1 - Math.pow(1 - p, 3); setN(e2 * end); if (p < 1) raf = requestAnimationFrame(step); else setN(end); };
        raf = requestAnimationFrame(step); io.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [end, duration]);
  return [n, ref];
}

// Casos (ilustrativos — reemplazar por reales con consentimiento)
const CASOS = [
  { ini: 'AM', nombre: 'Dr. Alejandro M.', rol: 'Cirujano · CDMX', stat: '+$82,000', k: 'recuperados de ISR', quote: 'Lo que pagaba de impuestos hoy regresa a mi retiro. Nunca imaginé que fuera posible ordenarlo así.' },
  { ini: 'LG', nombre: 'Laura G.', rol: 'Fundadora · Guadalajara', stat: '35%', k: 'menos ISR al año', quote: 'Pasé de no entender nada de impuestos a tener una estrategia clara. Ahorro y deduzco al mismo tiempo.' },
  { ini: 'FR', nombre: 'Familia Ríos', rol: 'Monterrey', stat: '2 en 1', k: 'retiro + protección', quote: 'Protegimos a nuestros hijos y arrancamos nuestro retiro el mismo mes. El acompañamiento fue total.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useReveal();

  useEffect(() => { try { initScrollTracking(); trackMetaViewContent({ seccion: 'Landing_Home' }); } catch { /* best-effort */ } }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [s1, r1] = useCountUp(900);
  const [s2, r2] = useCountUp(4.9, 1500);
  const [s3, r3] = useCountUp(10);

  // Calculadora
  const [ingresoMensual, setIngresoMensual] = useState(80000);
  const anual = ingresoMensual * 12;
  const isr = calcISR(anual);
  const marg = tasaMarginal(anual);
  const aportacion = Math.min(anual * 0.10, CINCO_UMAS_ANUALES);
  const devolucion = aportacion * marg;
  const isrOpt = Math.max(0, isr - devolucion);
  const pct = isr > 0 ? Math.round((devolucion / isr) * 100) : 0;
  const proy = (() => { let v = 0; for (let i = 0; i < 20; i++) v = (v + aportacion) * 1.08; return v; })();
  useEffect(() => { const t = setTimeout(() => { try { trackCalculadoraISR(ingresoMensual, devolucion); } catch { /* noop */ } }, 1200); return () => clearTimeout(t); }, [ingresoMensual, devolucion]);

  // Formulario
  const [form, setForm] = useState({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
  const [errs, setErrs] = useState({});
  const [status, setStatus] = useState('');
  const sanitize = (s) => s.replace(/[<>"'&]/g, '').trim();
  const setF = (k, v) => { setForm((d) => ({ ...d, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };
  const validate = () => {
    const e = {};
    const name = form.name.trim();
    if (!name || name.length < 2) e.name = 'Ingresa tu nombre';
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(name)) e.name = 'Nombre no válido';
    if (!/^\d{10,15}$/.test(form.phone.replace(/[\s\-().+]/g, ''))) e.phone = 'Teléfono válido (10 dígitos)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim().toLowerCase())) e.email = 'Correo no válido';
    if (!form.incomeType) e.incomeType = 'Elige una opción';
    if (!form.approxIncome) e.approxIncome = 'Elige una opción';
    return e;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    setStatus('loading');
    try {
      const payload = { name: sanitize(form.name), phone: form.phone.replace(/[^\d+\-() ]/g, ''), email: form.email.trim().toLowerCase(), incomeType: form.incomeType, approxIncome: form.approxIncome, declaracion: form.declaracion, retiroPlan: form.retiroPlan };
      const r = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      setStatus('success');
      try { trackMetaLead({ tipo: 'CTA Landing Form', categoria: payload.incomeType, valor_estimado: 0, ingreso: payload.approxIncome }); } catch { /* noop */ }
      const nm = payload.name, em = payload.email;
      setForm({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
      setTimeout(() => setStatus(''), 4500);
      if (window.Calendly) window.Calendly.initPopupWidget({ url: CALENDLY, prefill: { name: nm, email: em } });
    } catch { setStatus('error'); }
  };

  const goto = (id) => { setNavOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="fx">
      <style>{CSS}</style>

      {/* ───── NAV ───── */}
      <nav className={`fx-nav ${scrolled ? 'on' : ''}`}>
        <div className="fx-wrap fx-nav-in">
          <a className="fx-brand" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" /></a>
          <div className="fx-nav-links">
            <a onClick={() => goto('como')}>Cómo funciona</a>
            <a onClick={() => goto('calculadora')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Resultados</a>
            <a onClick={() => goto('para-quien')}>Para quién</a>
          </div>
          <div className="fx-nav-r">
            <button className="fx-link" onClick={() => navigate('/login')}>Entrar</button>
            <button className="fx-btn fx-btn-green fx-sm" onClick={() => goto('contacto')}>Empezar gratis</button>
            <button className="fx-burger" onClick={() => setNavOpen((o) => !o)} aria-label="Menú">{navOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>
        {navOpen && (
          <div className="fx-nav-mobile">
            <a onClick={() => goto('como')}>Cómo funciona</a>
            <a onClick={() => goto('calculadora')}>Calculadora</a>
            <a onClick={() => goto('casos')}>Resultados</a>
            <a onClick={() => goto('para-quien')}>Para quién</a>
            <button className="fx-btn fx-btn-green" onClick={() => goto('contacto')}>Empezar gratis</button>
          </div>
        )}
      </nav>

      {/* ───── HERO ───── */}
      <header className="fx-hero" id="top">
        <div className="fx-wrap fx-hero-grid">
          <div className="fx-hero-copy">
            <span className="fx-pill fx-rv"><span className="fx-pulse" /> Asesoría fiscal + retiro, en simple</span>
            <h1 className="fx-rv">Paga menos impuestos. <span className="fx-ink-green">Construye tu retiro.</span></h1>
            <p className="fx-lede fx-rv">Convertimos parte de lo que hoy pagas de ISR en patrimonio para tu futuro. Una estrategia clara, deducible y hecha para ti — sin letras chiquitas.</p>
            <div className="fx-hero-cta fx-rv">
              <button className="fx-btn fx-btn-green fx-lg" onClick={() => goto('calculadora')}>Calcular mi ahorro <ArrowRight size={18} /></button>
              <button className="fx-btn fx-btn-soft fx-lg" onClick={() => goto('contacto')}>Agenda gratis</button>
            </div>
            <div className="fx-social fx-rv">
              <div className="fx-avs"><span>👨‍⚕️</span><span>👩‍💼</span><span>🧑‍💻</span><span>👨‍🔧</span></div>
              <div className="fx-social-txt"><b>★ 4.9/5</b> · +900 familias ya optimizan su dinero</div>
            </div>
          </div>

          {/* mockup producto */}
          <div className="fx-hero-art fx-rv">
            <div className="fx-blob" aria-hidden />
            <div className="fx-prodcard">
              <div className="fx-pc-head">
                <div className="fx-pc-dot" /><span>Tu plan — resumen</span>
              </div>
              <div className="fx-pc-main">
                <div className="fx-pc-k">Recuperas de ISR este año</div>
                <div className="fx-pc-big">~{fmt(devolucion)}</div>
                <div className="fx-pc-bar"><i style={{ width: `${Math.min(100, Math.max(16, pct))}%` }} /><em>−{pct}%</em></div>
              </div>
              <div className="fx-pc-row">
                <div><span>Aportación anual</span><b>{fmt(aportacion)}</b></div>
                <div><span>Retiro proyectado</span><b className="g">{fmtK(proy)}</b></div>
              </div>
              <div className="fx-pc-foot"><Check size={15} /> 100% deducible · dentro del art. 151</div>
            </div>
            <div className="fx-fchip fx-fchip-1">💸 −{pct}% de ISR</div>
            <div className="fx-fchip fx-fchip-2">📈 Tu retiro, en marcha</div>
          </div>
        </div>
      </header>

      {/* ───── TRUST STRIP ───── */}
      <div className="fx-trust">
        <div className="fx-wrap fx-trust-in">
          <span>Estrategia fiscal</span><i /><span>PPR deducible</span><i /><span>Retiro con rendimiento</span><i /><span>Protección familiar</span><i /><span>Acompañamiento anual</span>
        </div>
      </div>

      {/* ───── CÓMO FUNCIONA ───── */}
      <section id="como" className="fx-sec">
        <div className="fx-wrap">
          <div className="fx-head fx-rv">
            <span className="fx-eyebrow">Una estrategia, tres resultados</span>
            <h2>Es más simple de lo que crees.</h2>
            <p>No es un seguro más: es tu dinero trabajando en tres frentes a la vez.</p>
          </div>
          <div className="fx-benes">
            {[
              { e: '🏦', t: 'Pagas menos ISR', d: 'Un plan deducible baja tu base gravable. Aportas, deduces y recuperas parte de tu ISR en la declaración anual — dentro de los topes del art. 151.' },
              { e: '🌱', t: 'Construyes tu retiro', d: 'Ese mismo dinero crece con rendimiento real y aportaciones a tu ritmo. Ves la proyección año con año, sin sorpresas.' },
              { e: '🛡️', t: 'Proteges a tu familia', d: 'Si algo pasa, los tuyos quedan cubiertos. Tranquilidad patrimonial con una aseguradora de clase mundial.' },
            ].map((b, i) => (
              <div className="fx-bene fx-rv" key={i} style={{ '--i': i }}>
                <div className="fx-bene-emoji">{b.e}</div>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CALCULADORA ───── */}
      <section id="calculadora" className="fx-sec fx-sec-tint">
        <div className="fx-wrap">
          <div className="fx-head fx-rv">
            <span className="fx-eyebrow">Calculadora ISR 2026</span>
            <h2>¿Cuánto podrías recuperar?</h2>
            <p>Mueve tu ingreso y velo al instante. Es una estimación; tu asesor afina el número contigo.</p>
          </div>
          <div className="fx-calc fx-rv">
            <div className="fx-calc-l">
              <div className="fx-calc-k">Tu ingreso mensual aproximado</div>
              <div className="fx-calc-amt">{fmt(ingresoMensual)}<small>/mes</small></div>
              <input type="range" min="15000" max="400000" step="5000" value={ingresoMensual} onChange={(e) => setIngresoMensual(+e.target.value)} className="fx-range" style={{ '--p': `${((ingresoMensual - 15000) / (400000 - 15000)) * 100}%` }} />
              <div className="fx-calc-range"><span>$15k</span><span>$400k +</span></div>
              <div className="fx-calc-mini">
                <div><span>ISR anual hoy</span><b>{fmt(isr)}</b></div>
                <div><span>Con tu plan</span><b>{fmt(isrOpt)}</b></div>
              </div>
            </div>
            <div className="fx-calc-r">
              <div className="fx-calc-rk">Podrías recuperar</div>
              <div className="fx-calc-rbig">~{fmt(devolucion)}</div>
              <div className="fx-calc-rsub">hasta <b>−{pct}%</b> de tu ISR, convertido en tu retiro</div>
              <button className="fx-btn fx-btn-green fx-lg fx-w100" onClick={() => goto('contacto')}>Quiero esta estrategia <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ───── RESULTADOS ───── */}
      <section id="casos" className="fx-sec">
        <div className="fx-wrap">
          <div className="fx-head fx-rv">
            <span className="fx-eyebrow">Resultados reales</span>
            <h2>Gente como tú, con el control.</h2>
          </div>
          <div className="fx-cases">
            {CASOS.map((c) => (
              <figure className="fx-case fx-rv" key={c.ini}>
                <div className="fx-stars">★★★★★</div>
                <div className="fx-case-stat"><b>{c.stat}</b><span>{c.k}</span></div>
                <blockquote>“{c.quote}”</blockquote>
                <figcaption><span className="fx-case-ava">{c.ini}</span><span><b>{c.nombre}</b><em>{c.rol}</em></span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───── STATS BAND ───── */}
      <section className="fx-band">
        <div className="fx-wrap fx-band-grid">
          <div className="fx-bstat" ref={r1}><b>+{Math.round(s1)}</b><span>familias asesoradas</span></div>
          <div className="fx-bstat" ref={r2}><b>{s2.toFixed(1)}<i>/5</i></b><span>satisfacción</span></div>
          <div className="fx-bstat" ref={r3}><b>{Math.round(s3)}+</b><span>años de experiencia</span></div>
          <div className="fx-bstat"><b>100%</b><span>deducible (art. 151)</span></div>
        </div>
      </section>

      {/* ───── PARA QUIÉN ───── */}
      <section id="para-quien" className="fx-sec fx-sec-tint">
        <div className="fx-wrap">
          <div className="fx-head fx-rv">
            <span className="fx-eyebrow">Para quién es</span>
            <h2>Si generas ingresos, es para ti.</h2>
          </div>
          <div className="fx-who">
            {[
              { e: '👨‍⚕️', t: 'Médicos y profesionistas', s: 'Consulta u honorarios: deduce y ordena tu retiro.' },
              { e: '🏢', t: 'Empresarios y dueños', s: 'Separa tu patrimonio y optimiza lo que pagas al SAT.' },
              { e: '💻', t: 'Freelancers y PyME', s: 'Ingresos variables, estrategia flexible que se adapta.' },
              { e: '📈', t: 'Empleados de alto ingreso', s: 'Recupera ISR en tu declaración y construye tu futuro.' },
            ].map((w, i) => (
              <div className="fx-whocard fx-rv" key={i}><span className="fx-who-e">{w.e}</span><b>{w.t}</b><p>{w.s}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA + FORM ───── */}
      <section id="contacto" className="fx-sec">
        <div className="fx-wrap">
          <div className="fx-cta fx-rv">
            <div className="fx-cta-l">
              <span className="fx-eyebrow light">Diagnóstico sin costo</span>
              <h2>Agenda tu sesión gratis.</h2>
              <p>Déjanos tus datos y un asesor te muestra, con tus números, cuánto puedes ahorrar y cómo quedaría tu retiro. Sin compromiso.</p>
              <ul className="fx-perks">
                <li><Check size={17} /> 20 min por WhatsApp o videollamada</li>
                <li><Check size={17} /> Con tus cifras reales, no promesas</li>
                <li><Check size={17} /> 100% deducible, 0% presión</li>
              </ul>
            </div>
            <form className="fx-form" onSubmit={submit}>
              <div className="fx-f"><input placeholder="Nombre completo" value={form.name} onChange={(e) => setF('name', e.target.value)} />{errs.name && <span className="fx-err">{errs.name}</span>}</div>
              <div className="fx-f"><input placeholder="WhatsApp (10 dígitos)" inputMode="tel" value={form.phone} onChange={(e) => setF('phone', e.target.value)} />{errs.phone && <span className="fx-err">{errs.phone}</span>}</div>
              <div className="fx-f"><input placeholder="Correo electrónico" inputMode="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />{errs.email && <span className="fx-err">{errs.email}</span>}</div>
              <div className="fx-f-row">
                <div className="fx-f"><select value={form.incomeType} onChange={(e) => setF('incomeType', e.target.value)}><option value="">¿Cómo generas ingresos?</option><option value="empleado">Empleado</option><option value="freelancer">Freelancer / Honorarios</option><option value="empresario">Empresario / Dueño</option><option value="mixto">Mixto</option></select>{errs.incomeType && <span className="fx-err">{errs.incomeType}</span>}</div>
                <div className="fx-f"><select value={form.approxIncome} onChange={(e) => setF('approxIncome', e.target.value)}><option value="">Ingreso mensual</option><option value="20k-50k">$20k – $50k</option><option value="50k-100k">$50k – $100k</option><option value="100k-200k">$100k – $200k</option><option value="200k+">Más de $200k</option></select>{errs.approxIncome && <span className="fx-err">{errs.approxIncome}</span>}</div>
              </div>
              <button className="fx-btn fx-btn-green fx-lg fx-w100" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Enviando…' : <>Agendar mi diagnóstico <ArrowRight size={18} /></>}</button>
              {status === 'success' && <div className="fx-msg ok"><Check size={16} /> ¡Listo! Un asesor te contactará muy pronto.</div>}
              {status === 'error' && <div className="fx-msg bad">Hubo un error. Escríbenos por WhatsApp y te atendemos.</div>}
              <p className="fx-legal">🔒 Tus datos están seguros y no se comparten con terceros.</p>
            </form>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="fx-footer">
        <div className="fx-wrap fx-foot">
          <div style={{ maxWidth: 320 }}>
            <a className="fx-brand" href="#top" onClick={(e) => { e.preventDefault(); goto('top'); }}><Logo height={30} layout="inline" variant="light" /></a>
            <p>Estrategia fiscal y de retiro, en simple. Pagas menos impuestos y construyes tu patrimonio.</p>
            <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('footer')} className="fx-foot-wa"><MessageCircle size={17} /> WhatsApp</a>
          </div>
          <div className="fx-foot-cols">
            <div><h4>Explora</h4><a onClick={() => goto('como')}>Cómo funciona</a><a onClick={() => goto('calculadora')}>Calculadora</a><a onClick={() => goto('casos')}>Resultados</a><a onClick={() => goto('para-quien')}>Para quién</a></div>
            <div><h4>Contacto</h4><a onClick={() => goto('contacto')}>Agenda gratis</a><a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer">WhatsApp</a><a onClick={() => navigate('/login')}>Entrar</a></div>
          </div>
        </div>
        <div className="fx-wrap fx-copy"><span>© 2026 Finance S-Cool · Hecho en México</span><span>financescool.com.mx</span></div>
      </footer>

      <a href={getWhatsAppURL()} target="_blank" rel="noopener noreferrer" className="fx-wa" aria-label="WhatsApp" onClick={() => trackWhatsAppClick('sticky')}><MessageCircle size={27} /></a>
      <ChatSofia />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.fx{
  --bg:#FFFFFF;--paper:#F1F7F2;--mint:#E3F6EA;--mint2:#D2F0DC;
  --ink:#0A1F16;--ink2:#46564E;--faint:#86998F;--line:#E6EDE8;
  --green:#00B368;--green-d:#059356;--green-ink:#053D2A;--forest:#0B2018;
  --r:16px;--r-lg:26px;--r-pill:100px;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--ink);background:var(--bg);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.fx *{margin:0;padding:0;box-sizing:border-box}
.fx h1,.fx h2,.fx h3{font-family:'Bricolage Grotesque','Hanken Grotesk',sans-serif;font-weight:700;line-height:1.04;letter-spacing:-.025em}
.fx a{color:inherit;text-decoration:none;cursor:pointer}
.fx-wrap{max-width:1160px;margin:0 auto;padding:0 26px}
.fx-ink-green{color:var(--green)}

/* buttons */
.fx-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:'Hanken Grotesk';font-weight:700;font-size:16px;padding:13px 24px;border-radius:var(--r-pill);cursor:pointer;border:2px solid transparent;transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s,background .22s,color .22s}
.fx-btn.fx-sm{padding:9px 18px;font-size:14.5px}
.fx-btn.fx-lg{padding:15px 28px;font-size:16.5px}
.fx-btn.fx-w100{width:100%}
.fx-btn-green{background:var(--green);color:#fff;box-shadow:0 12px 26px -12px rgba(0,179,104,.7)}
.fx-btn-green:hover{background:var(--green-d);transform:translateY(-3px);box-shadow:0 18px 34px -12px rgba(0,179,104,.8)}
.fx-btn-soft{background:var(--mint);color:var(--green-ink);border-color:transparent}
.fx-btn-soft:hover{background:var(--mint2);transform:translateY(-3px)}
.fx-link{background:none;border:none;color:var(--ink2);font-family:'Hanken Grotesk';font-weight:600;font-size:14.5px;cursor:pointer}
.fx-link:hover{color:var(--green)}

/* nav */
.fx-nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.8);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid transparent;transition:border .3s,box-shadow .3s}
.fx-nav.on{border-bottom:1px solid var(--line);box-shadow:0 8px 28px -20px rgba(10,31,22,.4)}
.fx-nav-in{display:flex;align-items:center;justify-content:space-between;height:72px}
.fx-brand{display:flex;align-items:center}
.fx-nav-links{display:flex;gap:32px;font-size:15px;font-weight:600;color:var(--ink2)}
.fx-nav-links a:hover{color:var(--green)}
.fx-nav-r{display:flex;align-items:center;gap:14px}
.fx-burger{display:none;background:none;border:none;color:var(--ink);cursor:pointer}
.fx-nav-mobile{display:none;flex-direction:column;gap:6px;padding:16px 26px 22px;background:#fff;border-bottom:1px solid var(--line)}
.fx-nav-mobile a{padding:11px 0;font-weight:600;color:var(--ink)}
.fx-nav-mobile .fx-btn{margin-top:8px}

/* hero */
.fx-hero{position:relative;padding:72px 0 80px;overflow:hidden;background:
  radial-gradient(60% 80% at 92% 0%, var(--mint) 0%, transparent 60%),var(--bg)}
.fx-hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:54px;align-items:center}
.fx-pill{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;font-weight:700;color:var(--green-ink);background:var(--mint);padding:8px 16px;border-radius:var(--r-pill)}
.fx-pulse{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 0 rgba(0,179,104,.5);animation:fxPulse 2s infinite}
@keyframes fxPulse{0%{box-shadow:0 0 0 0 rgba(0,179,104,.5)}70%{box-shadow:0 0 0 8px rgba(0,179,104,0)}100%{box-shadow:0 0 0 0 rgba(0,179,104,0)}}
.fx-hero-copy h1{font-size:clamp(42px,6vw,78px);margin:22px 0;font-weight:800;letter-spacing:-.035em}
.fx-lede{font-size:clamp(17px,1.9vw,20px);color:var(--ink2);max-width:40ch;margin-bottom:30px}
.fx-hero-cta{display:flex;gap:13px;flex-wrap:wrap}
.fx-social{display:flex;align-items:center;gap:14px;margin-top:30px}
.fx-avs{display:flex}.fx-avs span{width:40px;height:40px;border-radius:50%;border:3px solid #fff;margin-left:-13px;display:grid;place-items:center;font-size:18px;background:var(--mint);box-shadow:0 4px 12px -4px rgba(10,31,22,.25)}
.fx-avs span:first-child{margin:0}
.fx-social-txt{font-size:14px;color:var(--ink2)}.fx-social-txt b{color:var(--ink)}

/* hero mockup */
.fx-hero-art{position:relative;display:flex;justify-content:center}
.fx-blob{position:absolute;width:118%;height:118%;background:radial-gradient(circle at 60% 40%,var(--mint2),var(--mint) 45%,transparent 72%);border-radius:50%;z-index:0;filter:blur(6px)}
.fx-prodcard{position:relative;z-index:2;width:min(380px,100%);background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:0 30px 70px -28px rgba(10,31,22,.3)}
.fx-pc-head{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:var(--faint);padding-bottom:16px;border-bottom:1px solid var(--line)}
.fx-pc-dot{width:10px;height:10px;border-radius:50%;background:var(--green)}
.fx-pc-main{padding:18px 0}
.fx-pc-k{font-size:13px;color:var(--ink2);font-weight:600}
.fx-pc-big{font-family:'Bricolage Grotesque';font-size:46px;font-weight:800;color:var(--green);letter-spacing:-.03em;line-height:1.05;margin:4px 0 14px}
.fx-pc-bar{position:relative;height:12px;border-radius:7px;background:var(--paper);overflow:hidden;display:flex;align-items:center}
.fx-pc-bar i{display:block;height:100%;border-radius:7px;background:linear-gradient(90deg,var(--green),#3DDc8f);transition:width .4s}
.fx-pc-bar em{position:absolute;right:10px;font-style:normal;font-size:11px;font-weight:800;color:var(--green-ink)}
.fx-pc-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.fx-pc-row span{display:block;font-size:12px;color:var(--faint);margin-bottom:3px}
.fx-pc-row b{font-family:'Bricolage Grotesque';font-size:20px;font-weight:700;color:var(--ink)}
.fx-pc-row b.g{color:var(--green)}
.fx-pc-foot{display:flex;align-items:center;gap:7px;margin-top:14px;font-size:12.5px;font-weight:600;color:var(--green-ink)}
.fx-pc-foot svg{color:var(--green)}
.fx-fchip{position:absolute;z-index:3;background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 14px;font-size:13px;font-weight:700;color:var(--ink);box-shadow:0 14px 30px -12px rgba(10,31,22,.25)}
.fx-fchip-1{top:6px;left:-10px;animation:fxBob 4s ease-in-out infinite}
.fx-fchip-2{bottom:26px;right:-14px;animation:fxBob 4s ease-in-out infinite 1s}
@keyframes fxBob{50%{transform:translateY(-9px)}}

/* trust strip */
.fx-trust{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--paper)}
.fx-trust-in{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:18px;padding:18px 26px;font-size:14px;font-weight:600;color:var(--ink2)}
.fx-trust-in i{width:5px;height:5px;border-radius:50%;background:var(--green);opacity:.6}

/* sections */
.fx-sec{padding:92px 0}
.fx-sec-tint{background:var(--paper)}
.fx-head{max-width:640px;margin:0 auto 54px;text-align:center}
.fx-head h2{font-size:clamp(30px,4.4vw,50px);margin-top:14px;font-weight:800;letter-spacing:-.03em}
.fx-head p{color:var(--ink2);margin-top:14px;font-size:17.5px}
.fx-eyebrow{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--green)}
.fx-eyebrow.light{color:var(--green)}

/* beneficios */
.fx-benes{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.fx-bene{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:34px;transition:transform .3s,box-shadow .3s,border-color .3s}
.fx-bene:hover{transform:translateY(-7px);box-shadow:0 28px 56px -28px rgba(10,31,22,.28);border-color:var(--mint2)}
.fx-bene-emoji{width:62px;height:62px;border-radius:18px;background:var(--mint);display:grid;place-items:center;font-size:30px;margin-bottom:20px}
.fx-bene h3{font-size:23px;margin-bottom:10px;font-weight:700}
.fx-bene p{color:var(--ink2);font-size:15.5px}
.fx-sec-tint .fx-bene{background:#fff}

/* calculadora */
.fx-calc{display:grid;grid-template-columns:1.1fr 1fr;gap:0;max-width:940px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 30px 70px -36px rgba(10,31,22,.28)}
.fx-calc-l{padding:38px}
.fx-calc-k{font-size:13px;font-weight:700;color:var(--ink2)}
.fx-calc-amt{font-family:'Bricolage Grotesque';font-size:46px;font-weight:800;color:var(--ink);margin:6px 0 24px;letter-spacing:-.03em}
.fx-calc-amt small{font-size:17px;color:var(--faint);font-weight:500}
.fx-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;background:linear-gradient(90deg,var(--green) var(--p),var(--mint2) var(--p));outline:none}
.fx-range::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#fff;border:5px solid var(--green);cursor:pointer;box-shadow:0 3px 10px rgba(0,179,104,.4)}
.fx-range::-moz-range-thumb{width:24px;height:24px;border:5px solid var(--green);border-radius:50%;background:#fff;cursor:pointer}
.fx-calc-range{display:flex;justify-content:space-between;font-size:12px;color:var(--faint);margin-top:9px}
.fx-calc-mini{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px;padding-top:22px;border-top:1px solid var(--line)}
.fx-calc-mini span{display:block;font-size:12px;color:var(--faint);margin-bottom:4px}
.fx-calc-mini b{font-family:'Bricolage Grotesque';font-size:21px;font-weight:700;color:var(--ink)}
.fx-calc-r{padding:38px;background:linear-gradient(160deg,var(--green-ink),#0a5236);color:#fff;display:flex;flex-direction:column;justify-content:center}
.fx-calc-rk{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9EEFC4}
.fx-calc-rbig{font-family:'Bricolage Grotesque';font-size:clamp(44px,6vw,60px);font-weight:800;line-height:1;margin:8px 0;letter-spacing:-.03em}
.fx-calc-rsub{font-size:14px;color:rgba(255,255,255,.82);margin-bottom:22px}
.fx-calc-rsub b{color:#fff}
.fx-calc-r .fx-btn-green{background:#fff;color:var(--green-ink)}
.fx-calc-r .fx-btn-green:hover{background:var(--mint)}

/* casos */
.fx-cases{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.fx-case{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:28px;box-shadow:0 20px 50px -30px rgba(10,31,22,.25);transition:transform .3s,box-shadow .3s}
.fx-case:hover{transform:translateY(-6px);box-shadow:0 30px 60px -28px rgba(10,31,22,.32)}
.fx-stars{color:#FFB020;font-size:15px;letter-spacing:1px;margin-bottom:14px}
.fx-case-stat{margin-bottom:12px}
.fx-case-stat b{display:block;font-family:'Bricolage Grotesque';font-size:36px;font-weight:800;color:var(--green);line-height:1;letter-spacing:-.03em}
.fx-case-stat span{font-size:12.5px;color:var(--ink2);font-weight:600}
.fx-case blockquote{font-size:15px;color:var(--ink2);line-height:1.55;min-height:90px}
.fx-case figcaption{display:flex;align-items:center;gap:11px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
.fx-case-ava{width:42px;height:42px;border-radius:12px;background:var(--mint);color:var(--green-ink);font-weight:800;display:grid;place-items:center;font-size:14px}
.fx-case figcaption b{display:block;font-size:14.5px;color:var(--ink)}
.fx-case figcaption em{font-style:normal;font-size:12.5px;color:var(--faint)}

/* stats band */
.fx-band{background:var(--forest);color:#fff;padding:64px 0}
.fx-band-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;text-align:center}
.fx-bstat b{display:block;font-family:'Bricolage Grotesque';font-size:clamp(34px,4.6vw,52px);font-weight:800;color:#fff;line-height:1;letter-spacing:-.03em}
.fx-bstat b i{font-style:normal;color:#9EEFC4;font-size:.5em}
.fx-bstat span{display:block;font-size:13.5px;color:rgba(255,255,255,.66);margin-top:8px}

/* para quien */
.fx-who{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.fx-whocard{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:26px;transition:transform .3s,box-shadow .3s}
.fx-whocard:hover{transform:translateY(-6px);box-shadow:0 24px 50px -28px rgba(10,31,22,.25)}
.fx-who-e{font-size:32px;display:block;margin-bottom:14px}
.fx-whocard b{font-size:16.5px;display:block;margin-bottom:5px}
.fx-whocard p{color:var(--ink2);font-size:14px}

/* cta + form */
.fx-cta{display:grid;grid-template-columns:1fr 1fr;gap:0;background:linear-gradient(155deg,var(--green-ink),#0a5236);border-radius:32px;overflow:hidden;color:#fff}
.fx-cta-l{padding:50px 46px}
.fx-cta-l .fx-eyebrow{color:#9EEFC4}
.fx-cta-l h2{color:#fff;font-size:clamp(30px,3.8vw,46px);margin:14px 0 14px;font-weight:800;letter-spacing:-.03em}
.fx-cta-l p{color:rgba(255,255,255,.8);font-size:16px;max-width:42ch}
.fx-perks{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:12px}
.fx-perks li{display:flex;align-items:center;gap:10px;font-size:15px;color:rgba(255,255,255,.9)}
.fx-perks svg{color:#9EEFC4;flex:none}
.fx-form{background:#fff;padding:40px;display:flex;flex-direction:column;gap:13px}
.fx-f{display:flex;flex-direction:column;gap:5px}
.fx-f-row{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.fx-form input,.fx-form select{width:100%;padding:14px 16px;border:1.5px solid var(--line);border-radius:13px;font-size:15px;font-family:'Hanken Grotesk';color:var(--ink);background:#fff;outline:none;transition:border .18s}
.fx-form input:focus,.fx-form select:focus{border-color:var(--green)}
.fx-err{font-size:12px;color:#E5484D;font-weight:600}
.fx-msg{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;padding:12px 15px;border-radius:12px}
.fx-msg.ok{background:var(--mint);color:var(--green-ink)}
.fx-msg.bad{background:#FDECEC;color:#C5353A}
.fx-legal{font-size:12px;color:var(--faint);text-align:center;margin-top:2px}

/* footer */
.fx-footer{background:var(--forest);color:#fff;padding:60px 0 40px}
.fx-footer .fx-brand{filter:none}
.fx-foot{display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap}
.fx-foot>div p{color:rgba(255,255,255,.6);font-size:14.5px;margin-top:14px;max-width:320px}
.fx-foot-wa{display:inline-flex;align-items:center;gap:8px;margin-top:16px;color:#9EEFC4;font-weight:600;font-size:14px}
.fx-foot-cols{display:flex;gap:60px;flex-wrap:wrap}
.fx-foot-cols h4{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:#9EEFC4;margin-bottom:14px;font-weight:800}
.fx-foot-cols a{display:block;color:rgba(255,255,255,.7);font-size:14.5px;padding:6px 0}.fx-foot-cols a:hover{color:#fff}
.fx-copy{margin-top:44px;padding-top:24px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;color:rgba(255,255,255,.5);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}

/* whatsapp */
.fx-wa{position:fixed;bottom:28px;right:28px;width:60px;height:60px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;color:#fff;z-index:40;box-shadow:0 12px 32px rgba(37,211,102,.42);transition:transform .35s}
.fx-wa:hover{transform:scale(1.1) translateY(-3px)}

/* reveal */
.fx-rv{opacity:0;transform:translateY(24px);transition:opacity .75s cubic-bezier(.2,.8,.2,1),transform .75s cubic-bezier(.2,.8,.2,1)}
.fx-rv.in{opacity:1;transform:none}
.fx-bene.fx-rv{transition-delay:calc(var(--i) * 90ms)}

/* responsive */
@media(max-width:940px){
  .fx-hero-grid,.fx-calc,.fx-cta{grid-template-columns:1fr}
  .fx-hero-grid{gap:48px}
  .fx-hero-art{margin-top:8px}
  .fx-benes,.fx-cases{grid-template-columns:1fr}
  .fx-who{grid-template-columns:1fr 1fr}
  .fx-calc-r{border-top:1px solid var(--line)}
  .fx-cta-l{padding:40px 30px}
}
@media(max-width:720px){
  .fx-nav-links{display:none}
  .fx-nav-r .fx-link{display:none}
  .fx-burger{display:grid;place-items:center}
  .fx-nav-mobile{display:flex}
  .fx-sec{padding:64px 0}
  .fx-band-grid,.fx-who{grid-template-columns:1fr 1fr}
  .fx-f-row{grid-template-columns:1fr}
  .fx-wa{bottom:18px;right:16px;width:52px;height:52px}
}
`;
