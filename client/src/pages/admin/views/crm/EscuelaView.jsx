/**
 * EscuelaView — "Escuela S-Cool".
 * La ÚNICA sección que ve un agente en formación (Clave T) hasta obtener su
 * Clave C. Academia estilo banca privada: el camino de 8 etapas como pieza
 * central motivacional + el coach (Sofia) embebido para resolver dudas.
 * El CRM completo (pólizas, cobranza, ingresos) se desbloquea solo al llegar
 * a la Clave C — esta vista se lo recuerda con elegancia, no con candados.
 */
import { C } from '../../constants';
import {
  FileSignature, GraduationCap, CalendarCheck, BookOpen,
  BadgeCheck, Handshake, Briefcase, KeyRound, Sparkles, Lock,
} from 'lucide-react';
import { getCrmCSS } from './crmShared';
import { ChatPanel, chatCSS } from '../../../../components/CrmChatWidget';

/* ── El camino Clave T → Clave C (contenido oficial de la promotoría) ── */
const CAMINO = [
  { n: 1, titulo: 'Documentación Clave T', desc: 'Entrega tus documentos y firma. Obtienes tu Clave T.', dur: '1 sem', Icon: FileSignature },
  { n: 2, titulo: 'Ingreso a Escuela FSC', desc: 'Inducción teórica. Arranca tu formación.', dur: '1 sem', Icon: GraduationCap },
  { n: 3, titulo: 'Agendar examen de cédula', desc: 'Agenda tu examen con CEI.', dur: '1 sem', Icon: CalendarCheck },
  { n: 4, titulo: 'Estudio + Expediente + Examen', desc: 'Estudia, integra tu expediente CNSF y presenta.', dur: '2 sem', Icon: BookOpen },
  { n: 5, titulo: 'Cédula CNSF', desc: 'Se genera tu cédula.', dur: '2 sem', Icon: BadgeCheck },
  { n: 6, titulo: 'Primeros negocios', desc: 'Tus primeras ventas.', dur: 'en paralelo', Icon: Handshake },
  { n: 7, titulo: 'Expediente Prudential', desc: 'Se sube tu alta a Prudential.', dur: '1 sem', Icon: Briefcase },
  { n: 8, titulo: 'Clave C + Contrato', desc: 'Obtienes tu Clave C y firmas tu contrato. Se desbloquea el CRM.', dur: '1 sem', Icon: KeyRound, final: true },
];

const SUGERENCIAS = [
  '¿Qué documentos necesito para mi Clave T?',
  '¿Cómo me preparo para el examen de cédula?',
  'Dame un tip para mis primeros negocios',
];

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

/* ── Estilos propios de la Escuela (scoped .esc-) ── */
const ESCUELA_CSS = `
  .esc-wrap{max-width:1180px;margin:0 auto}

  /* Hero — salón principal de la academia */
  .esc-hero{position:relative;overflow:hidden;border-radius:20px;padding:46px 44px 42px;color:#fff;
    background:linear-gradient(148deg,${C.navy} 0%,${C.ink} 55%,#102447 100%);
    border:1px solid rgba(193,151,91,.35);box-shadow:0 22px 60px rgba(5,22,54,.30);margin-bottom:34px}
  .esc-hero::before{content:'';position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(620px 300px at 82% -10%,rgba(193,151,91,.22),transparent 65%),
               radial-gradient(420px 260px at -5% 110%,rgba(0,136,224,.14),transparent 70%)}
  .esc-hero::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
    background:repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.012) 22px 23px)}
  .esc-hero-inner{position:relative;z-index:1;display:flex;gap:30px;align-items:center;flex-wrap:wrap}
  .esc-crest{flex:0 0 auto;width:86px;height:86px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 32% 28%,#E8CFA6,${C.gold} 58%,#8F6B37);color:${C.navy};
    box-shadow:0 10px 26px rgba(193,151,91,.4),inset 0 2px 5px rgba(255,255,255,.55),0 0 0 6px rgba(193,151,91,.16);
    animation:escGlow 3.2s ease-in-out infinite}
  @keyframes escGlow{0%,100%{box-shadow:0 10px 26px rgba(193,151,91,.4),inset 0 2px 5px rgba(255,255,255,.55),0 0 0 6px rgba(193,151,91,.16)}
    50%{box-shadow:0 10px 26px rgba(193,151,91,.4),inset 0 2px 5px rgba(255,255,255,.55),0 0 0 11px rgba(193,151,91,.07)}}
  .esc-kicker{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:2.6px;
    text-transform:uppercase;color:#E8CFA6;margin-bottom:10px}
  .esc-kicker::before,.esc-kicker::after{content:'';height:1px;width:26px;background:linear-gradient(90deg,transparent,${C.gold});display:inline-block}
  .esc-kicker::after{background:linear-gradient(90deg,${C.gold},transparent)}
  .esc-hero h1{margin:0;font-size:clamp(30px,4.4vw,44px);line-height:1.08;font-weight:600;letter-spacing:.3px}
  .esc-hero h1 i{font-style:italic;color:#E8CFA6}
  .esc-hero-sub{margin:12px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,.82);max-width:620px}
  .esc-hero-sub b{color:#E8CFA6;font-weight:700}
  .esc-hero-note{margin-top:18px;display:inline-flex;align-items:center;gap:9px;font-size:12.5px;color:rgba(255,255,255,.75);
    border:1px solid rgba(193,151,91,.35);border-radius:30px;padding:7px 16px;background:rgba(193,151,91,.08)}

  /* Encabezados de sección */
  .esc-sec{display:flex;align-items:baseline;gap:14px;margin:0 0 6px}
  .esc-sec h2{margin:0;font-size:24px;font-weight:600;color:${C.ink};letter-spacing:.2px}
  .esc-sec .esc-rule{flex:1;height:1px;background:linear-gradient(90deg,${C.gold} 0%,rgba(193,151,91,.1) 85%,transparent)}
  .esc-sec-sub{margin:0 0 22px;font-size:13px;color:${C.textMuted}}

  /* El camino — 8 etapas */
  .esc-path{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:38px;position:relative}
  .esc-step{position:relative;background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:48px 18px 16px;
    box-shadow:0 2px 8px rgba(5,22,54,.05);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;
    opacity:0;animation:escUp .5s ease forwards}
  .esc-step:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(5,22,54,.12);border-color:rgba(193,151,91,.55)}
  @keyframes escUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .esc-step:nth-child(1){animation-delay:.03s}.esc-step:nth-child(2){animation-delay:.09s}
  .esc-step:nth-child(3){animation-delay:.15s}.esc-step:nth-child(4){animation-delay:.21s}
  .esc-step:nth-child(5){animation-delay:.27s}.esc-step:nth-child(6){animation-delay:.33s}
  .esc-step:nth-child(7){animation-delay:.39s}.esc-step:nth-child(8){animation-delay:.45s}
  /* hilo dorado entre etapas (solo escritorio) */
  .esc-step:not(:nth-child(4n))::after{content:'';position:absolute;top:30px;right:-19px;width:20px;height:1px;
    background:linear-gradient(90deg,${C.gold},rgba(193,151,91,.25));z-index:0}
  .esc-medal{position:absolute;top:-16px;left:18px;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 32% 28%,#EAD3AC,${C.gold} 60%,#9A7440);color:${C.navy};
    font-family:${SERIF};font-size:19px;font-weight:700;
    box-shadow:0 6px 14px rgba(193,151,91,.45),inset 0 1.5px 3px rgba(255,255,255,.6),0 0 0 4px ${C.card}}
  .esc-step-ico{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;
    background:${C.goldBg};color:${C.gold};border:1px solid rgba(193,151,91,.3)}
  .esc-step h3{margin:0 0 7px;font-family:${SERIF};font-size:16.5px;font-weight:600;color:${C.ink};line-height:1.25}
  .esc-step p{margin:0;font-size:12.8px;line-height:1.55;color:${C.textMuted}}
  .esc-dur{display:inline-flex;align-items:center;gap:5px;margin-top:12px;font-size:10.5px;font-weight:700;letter-spacing:1.3px;
    text-transform:uppercase;color:${C.gold};background:${C.goldBg};border:1px solid rgba(193,151,91,.3);border-radius:20px;padding:3px 11px}
  /* Etapa final — aquí se abre el CRM */
  .esc-step.final{background:linear-gradient(150deg,${C.navy},${C.ink} 70%);border-color:rgba(193,151,91,.6);
    box-shadow:0 10px 30px rgba(5,22,54,.35)}
  .esc-step.final::before{content:'';position:absolute;inset:0;border-radius:16px;pointer-events:none;
    background:radial-gradient(240px 140px at 85% 0%,rgba(193,151,91,.28),transparent 70%)}
  .esc-step.final h3{color:#fff}
  .esc-step.final p{color:rgba(255,255,255,.78)}
  .esc-step.final .esc-step-ico{background:rgba(193,151,91,.18);border-color:rgba(193,151,91,.5);color:#E8CFA6}
  .esc-step.final .esc-dur{background:rgba(193,151,91,.16);color:#E8CFA6;border-color:rgba(193,151,91,.45)}
  .esc-unlock{position:relative;display:flex;align-items:center;gap:7px;margin-top:11px;font-size:11.5px;font-weight:700;color:${C.navy};
    background:linear-gradient(135deg,#EAD3AC,${C.gold});border-radius:9px;padding:7px 11px;box-shadow:0 4px 12px rgba(193,151,91,.35)}

  /* Coach */
  .esc-coach{border:1px solid ${C.border};border-top:3px solid ${C.gold};border-radius:16px;overflow:hidden;background:${C.card};
    box-shadow:0 4px 18px rgba(5,22,54,.07);margin-bottom:30px;display:flex;flex-direction:column}
  .esc-coach-head{background:linear-gradient(135deg,${C.navy},#0A2A66);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px}
  .esc-coach-head .esc-coach-dot{width:40px;height:40px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 32% 28%,#EAD3AC,${C.gold} 60%,#9A7440);color:${C.navy};
    box-shadow:inset 0 1.5px 3px rgba(255,255,255,.55)}
  .esc-coach-head b{font-family:${SERIF};font-size:16.5px;font-weight:600;display:block}
  .esc-coach-head span{font-size:12px;opacity:.78;display:block;margin-top:1px}

  /* Cierre */
  .esc-cierre{display:flex;align-items:center;gap:14px;border:1px dashed rgba(193,151,91,.55);background:${C.goldBg};
    border-radius:14px;padding:16px 20px;margin-bottom:28px}
  .esc-cierre p{margin:0;font-size:13px;line-height:1.6;color:${C.text}}
  .esc-cierre b{color:${C.ink}}
  .esc-cierre .esc-lockico{flex:0 0 auto;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:#fff;border:1px solid rgba(193,151,91,.4);color:${C.gold}}

  @media(max-width:1020px){
    .esc-path{grid-template-columns:repeat(2,1fr)}
    .esc-step:not(:nth-child(4n))::after{display:none}
    .esc-step:nth-child(odd)::after{content:'';position:absolute;top:30px;right:-19px;width:20px;height:1px;display:block;
      background:linear-gradient(90deg,${C.gold},rgba(193,151,91,.25))}
  }
  @media(max-width:640px){
    .esc-hero{padding:30px 22px}
    .esc-hero-inner{gap:18px}
    .esc-path{grid-template-columns:1fr}
    .esc-step::after,.esc-step:nth-child(odd)::after{display:none!important}
  }
`;

export default function EscuelaView() {
  return (
    <>
      <style>{getCrmCSS() + chatCSS + ESCUELA_CSS}</style>
      <div className="esc-wrap">

        {/* ── Hero ── */}
        <section className="esc-hero">
          <div className="esc-hero-inner">
            <div className="esc-crest"><GraduationCap size={40} strokeWidth={1.6} /></div>
            <div style={{ flex: '1 1 380px' }}>
              <div className="esc-kicker">Finance S-Cool · Academia de asesores</div>
              <h1 style={{ fontFamily: SERIF }}>Escuela <i>S-Cool</i></h1>
              <p className="esc-hero-sub">
                Tu camino de <b>Clave T</b> a <b>Clave C</b> — máximo 8 semanas.
                Bienvenido: a partir de hoy no caminas solo. Aquí está cada paso de tu
                formación, en orden y con tiempos claros, y un coach disponible a toda
                hora para cualquier duda. Tu única misión es avanzar una etapa a la vez.
              </p>
              <div className="esc-hero-note">
                <Sparkles size={14} color={C.gold} /> 8 etapas · un solo destino: tu contrato como asesor Prudential
              </div>
            </div>
          </div>
        </section>

        {/* ── El camino ── */}
        <div className="esc-sec">
          <h2 style={{ fontFamily: SERIF }}>El camino</h2>
          <div className="esc-rule" />
        </div>
        <p className="esc-sec-sub">Ocho etapas, de la firma de tus documentos a la apertura de tu CRM. Cada medallón es un logro.</p>

        <div className="esc-path">
          {CAMINO.map(({ n, titulo, desc, dur, Icon, final }) => (
            <div key={n} className={`esc-step${final ? ' final' : ''}`}>
              <div className="esc-medal">{n}</div>
              <div className="esc-step-ico"><Icon size={17} strokeWidth={1.9} /></div>
              <h3>{titulo}</h3>
              <p>{desc}</p>
              <div className="esc-dur">{dur}</div>
              {final && (
                <div className="esc-unlock"><KeyRound size={14} /> Aquí se abre tu CRM</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Coach ── */}
        <div className="esc-sec">
          <h2 style={{ fontFamily: SERIF }}>Tu coach</h2>
          <div className="esc-rule" />
        </div>
        <p className="esc-sec-sub">Disponible 24/7 — pregúntale lo que sea de tu proceso, de ventas o de producto.</p>

        <div className="esc-coach">
          <div className="esc-coach-head">
            <div className="esc-coach-dot"><Sparkles size={19} strokeWidth={1.8} /></div>
            <div>
              <b>Tu coach · pregúntale lo que sea</b>
              <span>Dudas de documentos, del examen de cédula, de tus primeros negocios — aquí se resuelven.</span>
            </div>
          </div>
          <ChatPanel
            modo="coach"
            alto="calc(100vh - 360px)"
            intro="¡Hola! Soy tu coach en la Escuela S-Cool 🎓 Pregúntame lo que sea de tu proceso, ventas o producto."
            sugerencias={SUGERENCIAS}
          />
        </div>

        {/* ── Cierre ── */}
        <div className="esc-cierre">
          <div className="esc-lockico"><Lock size={17} /></div>
          <p>
            Mientras tengas tu <b>Clave T</b>, este es tu campus: estudia, pregunta y avanza.
            El CRM completo — <b>pólizas, cobranza e ingresos</b> — se desbloquea automáticamente
            en cuanto obtengas tu <b>Clave C</b>. Nos vemos del otro lado. 🥂
          </p>
        </div>

      </div>
    </>
  );
}
