import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, MessageCircle, BarChart3, Lightbulb, Target, Wallet, Clock, Landmark, TrendingUp, GraduationCap, Briefcase, FileText, Shield, Brain, Users, CheckCircle, Camera, Linkedin, Volume2, VolumeX } from 'lucide-react';
import Logo from '../components/Logo';

// ==================== ISR 2026 Tax Calculator Logic ====================
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

const UMA_ANUAL = 39606.36;
const CINCO_UMAS = UMA_ANUAL * 5; // ~198,031.80 but doc says 213,973.20 with UMA 2024 108.57
const UMA_DIARIA = 117.16; // 2026
const CINCO_UMAS_ANUALES = 213973.20;
const VALOR_UDI = 8.672954;

function calcISR(ingreso) {
  if (ingreso <= 0) return 0;
  for (const bracket of ISR_TABLE_2026) {
    if (ingreso >= bracket.limInf && ingreso <= bracket.limSup) {
      const excedente = ingreso - bracket.limInf;
      return bracket.cuota + excedente * bracket.pct;
    }
  }
  const last = ISR_TABLE_2026[ISR_TABLE_2026.length - 1];
  const excedente = ingreso - last.limInf;
  return last.cuota + excedente * last.pct;
}

function getMarginalRate(ingreso) {
  for (const bracket of ISR_TABLE_2026) {
    if (ingreso >= bracket.limInf && ingreso <= bracket.limSup) {
      return bracket.pct;
    }
  }
  return 0.35;
}

const TUITION_LIMITS = {
  preescolar: 14200,
  primaria: 12900,
  secundaria: 19900,
  profesional_tecnico: 17100,
  bachillerato: 24500,
};

// ==================== Lazy Video Component ====================
function LazyVideo({ src, className, style, globalMuted = true }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  // Lazy load: start loading when near viewport
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoaded(true); obs.disconnect(); } }, { rootMargin: '200px' });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Track if currently in viewport (for sound)
  useEffect(() => {
    if (!videoRef.current) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.5 });
    obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, [loaded]);

  // Only unmute if globalMuted is off AND this video is in view
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted || !inView;
    }
  }, [globalMuted, inView]);

  return (
    <div ref={ref} className={className} style={style}>
      {loaded && <video ref={videoRef} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}><source src={src} type="video/mp4" /></video>}
    </div>
  );
}

// ==================== Animated Counter Hook ====================
function useCountUp(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!startOnView) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { setStarted(true); obs.disconnect(); } }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let start = 0; const step = end / (duration / 16);
    const timer = setInterval(() => { start += step; if (start >= end) { setCount(end); clearInterval(timer); } else setCount(Math.floor(start)); }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);
  return [count, ref];
}

// ==================== Component ====================
export default function Landing() {
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', incomeType: '', approxIncome: '',
    declaracion: '', retiroPlan: ''
  });
  const [formStatus, setFormStatus] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [heroSlide, setHeroSlide] = useState(0);
  const [visibleSections, setVisibleSections] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const [heroInView, setHeroInView] = useState(true);
  const heroVideoRefs = useRef([]);
  const heroSectionRef = useRef(null);
  const observerRefs = useRef([]);
  const sectionRefs = useRef({});
  const navigate = useNavigate();

  // Animated counters for trust bar
  const [trustCount1, trustRef1] = useCountUp(500, 2000);
  const [trustCount2, trustRef2] = useCountUp(100, 1500);
  const [trustCount3, trustRef3] = useCountUp(10, 1200);

  // Hero carousel slides with videos
  const heroSlides = [
    {
      video: '/assets/hero-shield.mp4',
      title: 'Tu dinero puede hacer más por ti',
      subtitle: 'cuando entiendes cómo moverlo con estrategia',
      stat: '$1,250,000+ MXN',
      statLabel: 'Proyección estimada a 25 años',
    },
    {
      video: '/assets/man-points.mp4',
      title: 'Menos impuestos, más patrimonio',
      subtitle: 'Conecta ahorro, retiro y deducción fiscal de forma inteligente',
      stat: 'Hasta 30%',
      statLabel: 'Devolución estimada de impuestos',
    },
    {
      video: '/assets/flow.mp4',
      title: 'Planea hoy, vive tranquilo mañana',
      subtitle: 'Cada año que esperas, necesitas ahorrar más para llegar al mismo objetivo',
      stat: '25+ años',
      statLabel: 'De crecimiento compuesto a tu favor',
    },
  ];

  // Auto-rotate carousel — wait for current video to finish, then advance
  useEffect(() => {
    const video = heroVideoRefs.current[heroSlide];
    if (!video) return;
    // Restart from beginning so user sees full video
    video.currentTime = 0;
    video.loop = false;
    const onEnded = () => {
      setHeroSlide((prev) => (prev + 1) % heroSlides.length);
    };
    video.addEventListener('ended', onEnded);
    // Fallback: if video is very long (>30s), advance anyway
    const fallback = setTimeout(onEnded, 30000);
    return () => {
      video.removeEventListener('ended', onEnded);
      clearTimeout(fallback);
      video.loop = true;
    };
  }, [heroSlide]);

  // Track hero section visibility — mute all hero videos when scrolled away
  useEffect(() => {
    if (!heroSectionRef.current) return;
    const obs = new IntersectionObserver(([e]) => setHeroInView(e.isIntersecting), { threshold: 0.1 });
    obs.observe(heroSectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Sync mute state on hero videos — only active slide plays sound AND only when hero is in view
  useEffect(() => {
    heroVideoRefs.current.forEach((v, i) => {
      if (v) v.muted = isMuted || !heroInView || i !== heroSlide;
    });
  }, [isMuted, heroSlide, heroInView]);

  // Tax calculator state
  const [taxCalc, setTaxCalc] = useState({
    ingresoAnual: 1200000,
    otrosIngresos: 0,
    medicos: 0,
    funerarios: 0,
    donativos: 0,
    hipotecarios: 0,
    seguroGMM: 0,
    transporteEscolar: 0,
    numHijos: 0,
    hijos: [],
    art185: 0,
    ppr: 100000,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate tax results
  const calcTaxResults = () => {
    const totalIngresos = taxCalc.ingresoAnual + taxCalc.otrosIngresos;
    if (totalIngresos <= 0) return { sinDed: 0, conDedSinRetiro: 0, conDedConRetiro: 0, devolucion: 0, ingresoReal: 0, mensual: 0, pctRecup: 0 };

    // Personal deduction caps
    const capFunerarios = 42794.64;
    const capDonativos = totalIngresos * 0.07;
    const capPersonalTotal = Math.min(totalIngresos * 0.15, CINCO_UMAS_ANUALES);

    let totalPersonal = 0;
    totalPersonal += taxCalc.medicos;
    totalPersonal += Math.min(taxCalc.funerarios, capFunerarios);
    totalPersonal += Math.min(taxCalc.donativos, capDonativos);
    totalPersonal += taxCalc.hipotecarios;
    totalPersonal += taxCalc.seguroGMM;
    totalPersonal += taxCalc.transporteEscolar;

    // Tuition deductions
    taxCalc.hijos.forEach((hijo) => {
      if (hijo.nivel && hijo.monto > 0) {
        const limit = TUITION_LIMITS[hijo.nivel] || 0;
        totalPersonal += Math.min(hijo.monto, limit);
      }
    });

    totalPersonal = Math.min(totalPersonal, capPersonalTotal);

    // Retirement deductions
    const capPPR = Math.min(totalIngresos * 0.10, CINCO_UMAS_ANUALES);
    const capArt185 = 152000;
    const dedArt185 = Math.min(taxCalc.art185, capArt185);
    const dedPPR = Math.min(taxCalc.ppr, capPPR);
    const totalRetiro = dedArt185 + dedPPR;

    // ISR calculations
    const isrSinDed = calcISR(totalIngresos);
    const isrConDedSinRetiro = calcISR(totalIngresos - totalPersonal);
    const isrConDedConRetiro = calcISR(totalIngresos - totalPersonal - totalRetiro);

    const devolucion = isrSinDed - isrConDedConRetiro;
    const ingresoReal = totalIngresos - isrConDedConRetiro;
    const mensual = ingresoReal / 12;
    const pctRecup = totalIngresos > 0 ? getMarginalRate(totalIngresos) * 100 : 0;

    return {
      totalIngresos,
      totalPersonal,
      totalRetiro,
      isrSinDed,
      isrConDedSinRetiro,
      isrConDedConRetiro,
      devolucion,
      devolucionSinRetiro: isrSinDed - isrConDedSinRetiro,
      ingresoReal,
      ingresoRealSinDed: totalIngresos - isrSinDed,
      mensual,
      pctRecup,
    };
  };

  const taxResults = calcTaxResults();

  // Scroll effects
  useEffect(() => {
    const handleScroll = () => setIsNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('slide-up');
          const id = entry.target.dataset.section;
          if (id) setVisibleSections(prev => ({ ...prev, [id]: true }));
        }
      }),
      { threshold: 0.1 }
    );
    observerRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('loading');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormStatus('success');
        setFormData({ name: '', phone: '', email: '', incomeType: '', approxIncome: '', declaracion: '', retiroPlan: '' });
        setTimeout(() => setFormStatus(''), 3000);
      } else { setFormStatus('error'); }
    } catch { setFormStatus('error'); }
  };

  const formatMXN = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-MX');
  };

  const faqItems = [
    { question: '¿Qué es un PPR (Plan Personal de Retiro)?', answer: 'Un PPR es un producto de ahorro e inversión con beneficios fiscales que te permite ahorrar para tu retiro. Puedes deducir hasta el 10% de tus ingresos o 5 UMAs anuales (lo que sea menor) conforme al Art. 151 LISR.' },
    { question: '¿Cuánto puedo deducir cada año?', answer: 'El PPR permite deducir hasta el 10% de tu ingreso anual o 5 UMAs anuales. Además hay deducciones personales con un tope del 15% de tu ingreso o 5 UMAs. Y el Art. 185 permite deducir hasta $152,000 adicionales en cuentas de ahorro para retiro.' },
    { question: '¿Prudential es seguro?', answer: 'Sí. Prudential es una aseguradora regulada por la CNBV (Comisión Nacional Bancaria y de Valores) con presencia global y respaldo institucional en México.' },
    { question: '¿Qué diferencia hay entre el Art. 151 y el Art. 185?', answer: 'El Art. 151 aplica a PPR y tiene un tope de min(10% ingreso, 5 UMAs). El Art. 185 aplica a primas de seguro para retiro con un tope de $152,000. Son complementarios.' },
    { question: '¿Cómo funciona la calculadora de impuestos?', answer: 'Usa la tabla ISR 2026 oficial del SAT. Calcula tu impuesto en tres escenarios: sin deducciones, con deducciones personales, y con deducciones + retiro. La diferencia es tu devolución estimada.' },
    { question: '¿Necesito asesoría personalizada?', answer: 'Sí, ofrecemos consultas donde revisamos tu situación fiscal actual, ingresos, estructura (empleado, freelancer, empresa) y diseñamos la estrategia óptima para ti.' },
  ];

  const styles = `
    /* ==================== Navbar ==================== */
    .landing-navbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      z-index: 1030; transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 1px 0 rgba(0,18,51,0.06);
    }
    .landing-navbar.scrolled {
      box-shadow: 0 4px 20px rgba(0,18,51,0.1);
      background: rgba(255,255,255,0.98);
    }
    .landing-navbar-content {
      max-width: 1200px; margin: 0 auto; padding: 0 1.5rem;
      display: flex; justify-content: space-between; align-items: center; height: 56px;
    }
    .landing-navbar-logo { text-decoration: none; display: flex; align-items: center; }
    .landing-navbar-logo:hover { opacity: 0.85; }
    .landing-navbar-menu {
      display: flex; gap: 2rem; list-style: none; align-items: center;
    }
    .landing-navbar-menu a {
      color: #2D3436; text-decoration: none; font-weight: 500;
      font-size: 0.9rem; transition: color 150ms;
    }
    .landing-navbar-menu a:hover { color: #003DA5; }
    .landing-navbar-cta { display: flex; gap: 1rem; align-items: center; }
    .landing-btn {
      padding: 0.5rem 1.5rem; border-radius: 1.25rem; font-weight: 600;
      font-size: 0.875rem; border: none; cursor: pointer; transition: all 300ms;
      font-family: 'Inter', sans-serif;
    }
    .landing-btn-primary {
      background: linear-gradient(135deg, #003DA5, #0067C5); color: white;
      box-shadow: 0 10px 15px -3px rgba(0,61,165,0.12);
    }
    .landing-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(0,61,165,0.15); }
    .landing-btn-outline { background: transparent; color: #003DA5; border: 1.5px solid #003DA5; border-radius: 2rem; }
    .landing-btn-outline:hover { background: rgba(0,61,165,0.05); }
    .landing-btn-gold {
      background: linear-gradient(135deg, #D4AF37, #C9A84C, #B99830); color: #001233;
      box-shadow: 0 8px 24px rgba(212,175,55,0.3); font-weight: 700;
    }
    .landing-btn-gold:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(212,175,55,0.4); }
    .landing-navbar .landing-btn-outline { color: #003DA5; border-color: #003DA5; }
    .landing-navbar .landing-btn-outline:hover { background: rgba(0,61,165,0.05); }
    .landing-navbar .landing-btn-primary { background: linear-gradient(135deg, #003DA5, #0052D4); color: white; box-shadow: 0 4px 12px rgba(0,61,165,0.2); }
    .landing-navbar .landing-btn-primary:hover { background: linear-gradient(135deg, #002B75, #003DA5); box-shadow: 0 6px 16px rgba(0,61,165,0.3); }
    .landing-hamburger { display: none; flex-direction: column; gap: 5px; background: transparent; border: none; cursor: pointer; }
    .landing-hamburger span { width: 24px; height: 2.5px; background: #2D3436; border-radius: 2px; transition: all 300ms; }

    /* ==================== Hero ==================== */
    .landing-hero {
      background: linear-gradient(160deg, #001233 0%, #001845 30%, #002855 60%, #003DA5 100%);
      padding-top: 56px; position: relative; overflow: hidden;
      display: flex; align-items: center; min-height: 100vh;
    }
    .landing-hero::before {
      content: ''; position: absolute; top: -20%; right: -10%; width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(201,168,76,0.12) 0%, rgba(0,103,197,0.06) 40%, transparent 70%);
      border-radius: 50%; animation: float 8s ease-in-out infinite;
    }
    .landing-hero::after {
      content: ''; position: absolute; bottom: -30%; left: -15%; width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(0,103,197,0.08) 0%, transparent 60%);
      border-radius: 50%; animation: float 10s ease-in-out infinite reverse;
    }
    @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
    .landing-hero-content {
      max-width: 1200px; width: 100%; padding: 2rem 1.5rem;
      display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;
      align-items: center; position: relative; z-index: 1; margin: 0 auto;
    }
    .landing-hero-text h1 {
      color: #FFFFFF; margin-bottom: 1.25rem; font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.15; letter-spacing: -0.03em; font-weight: 800;
      font-family: 'Playfair Display', serif;
    }
    .landing-hero-text h1 span.gold { color: #D4AF37; }
    .landing-hero-text p { color: rgba(255,255,255,0.8); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.7; }
    .landing-hero-cta { display: flex; gap: 1rem; flex-wrap: wrap; }
    .landing-hero-cta .landing-btn { padding: 0.85rem 2rem; font-size: 1rem; min-height: 48px; border-radius: 2rem; }
    .landing-btn-outline-hero {
      background: rgba(255,255,255,0.1); color: white; border: 2px solid rgba(255,255,255,0.4);
      backdrop-filter: blur(8px); font-weight: 600; border-radius: 2rem;
      transition: all 300ms;
    }
    .landing-btn-outline-hero:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.7); transform: translateY(-3px); }

    /* Hero Carousel - Video Based */
    .hero-carousel {
      border-radius: 1.5rem; position: relative; overflow: hidden;
      min-height: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .hero-carousel-video {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
      opacity: 0; transition: opacity 600ms ease; border-radius: 1.5rem;
    }
    .hero-carousel-video.active { opacity: 1; }
    .hero-carousel-overlay {
      position: absolute; inset: 0; border-radius: 1.5rem;
      background: linear-gradient(to top, rgba(0,18,51,0.85) 0%, rgba(0,18,51,0.3) 50%, transparent 100%);
      z-index: 1;
    }
    .hero-slide-content {
      position: absolute; bottom: 0; left: 0; right: 0; padding: 2rem;
      z-index: 2; opacity: 0; transform: translateY(15px); transition: all 500ms ease;
    }
    .hero-slide-content.active { opacity: 1; transform: translateY(0); }
    .hero-slide-title { color: #FFFFFF; font-size: 1.35rem; font-weight: 700; margin-bottom: 0.35rem; line-height: 1.3; font-family: 'Playfair Display', serif; }
    .hero-slide-subtitle { color: rgba(255,255,255,0.75); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; }
    .hero-slide-stat {
      display: inline-flex; align-items: center; gap: 1rem;
      background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.3);
      border-radius: 1rem; padding: 0.75rem 1.25rem;
    }
    .hero-slide-stat-value { color: #D4AF37; font-size: 1.5rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .hero-slide-stat-label { color: rgba(255,255,255,0.7); font-size: 0.8rem; }
    .hero-dots { display: flex; gap: 0.5rem; position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); z-index: 3; }
    .hero-dot {
      width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,0.3); transition: all 300ms;
    }
    .hero-dot.active { background: #D4AF37; width: 24px; border-radius: 4px; box-shadow: 0 0 12px rgba(212,175,55,0.4); }

    /* ==================== Reveal Animations ==================== */
    @keyframes revealUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes revealLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes revealRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(212,175,55,0.2); } 50% { box-shadow: 0 0 40px rgba(212,175,55,0.4); } }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    .reveal-up { opacity: 0; transform: translateY(40px); transition: all 700ms cubic-bezier(0.4,0,0.2,1); }
    .reveal-left { opacity: 0; transform: translateX(-40px); transition: all 700ms cubic-bezier(0.4,0,0.2,1); }
    .reveal-right { opacity: 0; transform: translateX(40px); transition: all 700ms cubic-bezier(0.4,0,0.2,1); }
    .reveal-scale { opacity: 0; transform: scale(0.85); transition: all 700ms cubic-bezier(0.4,0,0.2,1); }
    .revealed { opacity: 1 !important; transform: translateY(0) translateX(0) scale(1) !important; }
    .stagger-1 { transition-delay: 0ms; } .stagger-2 { transition-delay: 150ms; } .stagger-3 { transition-delay: 300ms; }
    .stagger-4 { transition-delay: 450ms; } .stagger-5 { transition-delay: 600ms; }

    /* ==================== Section Base ==================== */
    .landing-section { scroll-margin-top: 80px; }
    .landing-section-padding {
      padding: 3rem 1.5rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .landing-section-compact {
      padding: 2rem 1.5rem;
      min-height: auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .landing-section-light { background: #fff; }
    .landing-section-gray { background: linear-gradient(180deg, #F8F9FC, #F0F2F7); }
    .landing-section-blue { background: linear-gradient(160deg, #001233, #001845, #002B75); color: white; position: relative; overflow: hidden; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
    .landing-section-blue::before {
      content: ''; position: absolute; top: -50%; right: -20%; width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 60%); border-radius: 50%;
    }
    .landing-section-header { text-align: center; margin-bottom: 2.5rem; }
    .landing-section-header h2 {
      color: #001233; font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      margin-bottom: 1rem; line-height: 1.2; font-weight: 700;
      font-family: 'Playfair Display', serif; letter-spacing: -0.02em;
    }
    .landing-section-header p { font-size: 1.05rem; color: #5A6577; max-width: 700px; margin: 0 auto; line-height: 1.7; }
    .landing-section-subtitle {
      color: #C9A84C; font-size: 0.8rem; text-transform: uppercase;
      letter-spacing: 0.15em; font-weight: 700; margin-bottom: 1rem; display: inline-block;
      background: linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.05));
      padding: 0.35rem 1rem; border-radius: 2rem; border: 1px solid rgba(201,168,76,0.2);
    }
    .blue-section-header h2 { color: white; }
    .blue-section-header p { color: rgba(255,255,255,0.85); }

    /* ==================== Brand Identity Block ==================== */
    .brand-block { max-width: 1200px; margin: 0 auto; }
    .brand-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
    .brand-left { position: relative; }
    .brand-video-wrapper {
      border-radius: 1.5rem; overflow: hidden; box-shadow: 0 20px 50px rgba(0,18,51,0.15);
      position: relative; aspect-ratio: 4/3;
    }
    .brand-video-wrapper::after {
      content: ''; position: absolute; inset: 0; border-radius: 1.5rem;
      border: 1px solid rgba(0,61,165,0.1);
    }
    .brand-name-highlight {
      display: inline-block; background: linear-gradient(135deg, #003DA5, #0067C5);
      color: white; padding: 0.6rem 1.75rem; border-radius: 0.75rem;
      font-size: 1.35rem; font-weight: 700; margin: 1.5rem 0;
      box-shadow: 0 8px 24px rgba(0,61,165,0.2);
    }
    .oo-infinity {
      background: linear-gradient(90deg, #43A047, #FDD835, #FF8F00, #E91E63, #00ACC1, #FF6D00, #E53935, #3949AB, #43A047);
      background-size: 300% 100%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: ooRainbow 4s linear infinite;
      font-weight: 800;
    }
    @keyframes ooRainbow { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
    .brand-quote {
      background: linear-gradient(160deg, #001233, #001845);
      border-left: 4px solid #D4AF37; padding: 1.5rem 2rem; border-radius: 0 1rem 1rem 0;
      margin: 2rem 0 0; font-size: 1.15rem; color: white; font-weight: 600; font-style: italic;
      font-family: 'Playfair Display', serif; line-height: 1.5;
      box-shadow: 0 8px 32px rgba(0,18,51,0.15);
    }
    .brand-text { color: #4B5563; font-size: 1rem; line-height: 1.7; margin-bottom: 0.75rem; }
    .brand-text strong { color: #003DA5; }

    /* ==================== Emotional Connection ==================== */
    .emotion-list {
      list-style: none; padding: 0; max-width: 700px; margin: 1.5rem auto;
    }
    .emotion-list li {
      padding: 0.6rem 0; color: #4B5563; font-size: 1.05rem;
      display: flex; align-items: flex-start; gap: 0.5rem;
    }
    .emotion-list li::before { content: ''; display: none; }
    .emotion-check { color: #C9A84C; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
    .emotion-combo {
      display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin: 1rem 0;
    }
    .emotion-combo-item {
      background: linear-gradient(145deg, #001845, #003DA5); color: white;
      padding: 0.85rem 2rem; border-radius: 2rem; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,24,69,0.2); font-size: 0.95rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .emotion-mini { text-align: center; color: #003DA5; font-weight: 600; font-size: 1.1rem; margin-top: 1.5rem; }

    /* ==================== Problem Cards ==================== */
    .landing-problems-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; }
    .landing-problem-card {
      background: white; border: none; border-radius: 1.25rem;
      padding: 2.5rem 2rem; position: relative; overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,18,51,0.06);
      opacity: 0; transform: translateY(30px);
      transition: opacity 600ms ease, transform 600ms ease, box-shadow 400ms ease;
    }
    .landing-problem-card.revealed { opacity: 1; transform: translateY(0); }
    .landing-problem-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, #D4AF37, #C9A84C, #B99830); transform: scaleX(0);
      transform-origin: left; transition: transform 400ms cubic-bezier(0.4,0,0.2,1);
    }
    .landing-problem-card:hover::before { transform: scaleX(1); }
    .landing-problem-card:hover { box-shadow: 0 20px 40px rgba(0,18,51,0.12); }
    .problem-number {
      position: absolute; top: 0.5rem; right: 1rem; font-size: 6rem; font-weight: 900;
      background: linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.15));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; font-family: 'Playfair Display', serif; line-height: 1;
      transition: all 500ms ease; filter: drop-shadow(0 2px 4px rgba(212,175,55,0.2));
    }
    .landing-problem-card:hover .problem-number {
      background: linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.3));
      -webkit-background-clip: text; background-clip: text;
      transform: scale(1.08); filter: drop-shadow(0 4px 8px rgba(212,175,55,0.3));
    }
    .landing-problem-icon {
      width: 60px; height: 60px; background: linear-gradient(145deg, #001845, #003DA5);
      border-radius: 1rem; display: flex; align-items: center; justify-content: center;
      margin-bottom: 1.25rem; color: white;
      box-shadow: 0 8px 20px rgba(0,61,165,0.2);
    }
    .landing-problem-card h3 { color: #001233; margin-bottom: 0.75rem; font-size: 1.2rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .landing-problem-card p { color: #5A6577; line-height: 1.7; margin: 0; font-size: 1rem; }

    /* ==================== Solution Cards ==================== */
    .landing-services-grid {
      max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem;
      position: relative;
    }
    .landing-services-grid::before {
      content: ''; position: absolute; top: 50%; left: 10%; right: 10%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0,61,165,0.15), rgba(212,175,55,0.3), rgba(0,61,165,0.15), transparent);
      z-index: 0;
    }
    .landing-service-card {
      background: white; border-radius: 1.5rem; padding: 2.5rem 2rem;
      border: 1px solid rgba(0,18,51,0.06); position: relative; overflow: visible;
      box-shadow: 0 4px 20px rgba(0,18,51,0.06);
      opacity: 0; transform: translateY(50px) scale(0.95);
      transition: opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1), box-shadow 400ms ease, border-color 400ms ease;
      z-index: 1;
    }
    .landing-service-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 1.5rem 1.5rem 0 0;
      background: linear-gradient(90deg, #001845, #003DA5, #D4AF37); transform: scaleX(0);
      transform-origin: left; transition: transform 500ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .landing-service-card::after {
      content: ''; position: absolute; inset: 0; border-radius: 1.5rem;
      background: linear-gradient(135deg, rgba(0,61,165,0.03), rgba(212,175,55,0.03));
      opacity: 0; transition: opacity 400ms ease; z-index: -1;
    }
    .landing-service-card:hover { box-shadow: 0 24px 48px rgba(0,18,51,0.14); transform: translateY(-8px) scale(1.02); border-color: rgba(0,61,165,0.15); }
    .landing-service-card:hover::before { transform: scaleX(1); }
    .landing-service-card:hover::after { opacity: 1; }
    .landing-service-card.revealed { opacity: 1; transform: translateY(0) scale(1); }
    .landing-service-card.revealed:hover { transform: translateY(-8px) scale(1.02); }

    .service-step-number {
      position: absolute; top: -18px; right: 24px;
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #001845, #003DA5);
      color: white; font-weight: 800; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,61,165,0.3);
      transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), background 400ms ease;
    }
    .landing-service-card:hover .service-step-number {
      transform: scale(1.2) rotate(10deg);
      background: linear-gradient(135deg, #D4AF37, #B99830);
    }

    .landing-service-icon {
      margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center;
      width: 64px; height: 64px; border-radius: 1rem;
      background: linear-gradient(135deg, rgba(0,61,165,0.08), rgba(0,61,165,0.04));
      transition: transform 500ms cubic-bezier(0.34,1.56,0.64,1), background 400ms ease, box-shadow 400ms ease;
    }
    .landing-service-card:hover .landing-service-icon {
      transform: scale(1.1) rotate(-5deg);
      background: linear-gradient(135deg, rgba(0,61,165,0.15), rgba(212,175,55,0.1));
      box-shadow: 0 8px 20px rgba(0,61,165,0.15);
    }

    .landing-service-card h3 { color: #001233; margin-bottom: 0.75rem; font-size: 1.2rem; font-weight: 700; font-family: 'Playfair Display', serif; }
    .landing-service-card p { color: #5A6577; line-height: 1.8; font-size: 0.95rem; }

    .service-tag {
      display: inline-block; margin-top: 1.25rem; padding: 0.35rem 1rem; border-radius: 2rem;
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      background: rgba(0,61,165,0.06); color: #003DA5;
      transition: background 300ms, color 300ms;
    }
    .landing-service-card:hover .service-tag {
      background: linear-gradient(135deg, #001845, #003DA5); color: white;
    }

    /* ==================== Video/Concept Block ==================== */
    .video-concept-block {
      max-width: 800px; margin: 0 auto; text-align: center;
    }
    .video-concept-block p { color: rgba(255,255,255,0.9); font-size: 1.05rem; line-height: 1.8; margin-bottom: 2rem; }

    /* ==================== Tax Calculator ==================== */
    .tax-calc-container {
      max-width: 1200px; margin: 0 auto; background: white;
      border: none; border-radius: 1rem;
      padding: 1.25rem; box-shadow: 0 20px 50px rgba(0,18,51,0.08);
      position: relative; overflow: hidden;
    }
    .tax-calc-container::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(90deg, #D4AF37, #003DA5, #001845);
      border-radius: 1rem 1rem 0 0;
    }
    .tax-calc-support { text-align: center; color: #5A6577; font-size: 0.9rem; margin-bottom: 1rem; font-style: italic; }
    .tax-calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .tax-calc-inputs { display: flex; flex-direction: column; gap: 0.5rem; }
    .tax-input-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .tax-input-group label { font-weight: 600; color: #2D3436; font-size: 0.8rem; }
    .tax-input-group input, .tax-input-group select {
      padding: 0.45rem 0.75rem; border: 1.5px solid #E5E7EB; border-radius: 0.5rem;
      font-size: 0.85rem; transition: all 300ms; font-family: 'Inter', sans-serif;
    }
    .tax-input-group input:focus, .tax-input-group select:focus {
      outline: none; border-color: #003DA5; box-shadow: 0 0 0 3px rgba(0,61,165,0.1);
    }
    .tax-toggle-advanced {
      background: none; border: none; color: #003DA5; font-weight: 600;
      cursor: pointer; font-size: 0.9rem; padding: 0.5rem 0; text-align: left;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .tax-toggle-advanced:hover { color: #0067C5; }
    .tax-results {
      background: linear-gradient(160deg, #001233, #001845);
      border-radius: 1.25rem; padding: 1.5rem; border: none;
      box-shadow: 0 10px 30px rgba(0,18,51,0.15);
    }
    .tax-results h3 { color: #D4AF37; font-size: 1.1rem; margin-bottom: 1rem; text-align: center; font-family: 'Playfair Display', serif; }
    .tax-result-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.6rem 0; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .tax-result-row:last-child { border-bottom: none; }
    .tax-result-label { color: rgba(255,255,255,0.7); font-size: 0.85rem; font-weight: 500; }
    .tax-result-value { color: #FFFFFF; font-size: 1.1rem; font-weight: 700; }
    .tax-result-highlight {
      background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05));
      border: 1px solid rgba(212,175,55,0.3); border-radius: 0.75rem; padding: 1rem;
      margin-top: 0.75rem; text-align: center;
    }
    .tax-result-highlight .tax-result-value { color: #D4AF37; font-size: 1.75rem; font-family: 'Playfair Display', serif; }
    .tax-result-highlight .tax-result-label { color: rgba(255,255,255,0.8); font-weight: 600; font-size: 0.85rem; }
    .tax-scenarios {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem;
    }
    .tax-scenario {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem; padding: 0.75rem; text-align: center;
    }
    .tax-scenario-label { font-size: 0.7rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .tax-scenario-value { font-size: 0.95rem; font-weight: 700; color: #FFFFFF; }

    /* ==================== Para Quien Block ==================== */
    /* ==================== Para Quién + Trust Combined ==================== */
    .landing-trust-bar { background: linear-gradient(160deg, #001233, #001845); }
    .paraquien-grid {
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 3rem; align-items: start;
    }
    .paraquien-cards-col { display: flex; flex-direction: column; gap: 0.65rem; }
    .pq-card {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 0.85rem; padding: 0.85rem 1.25rem;
      color: white; font-size: 0.95rem; font-style: italic;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      opacity: 0; transform: translateX(-30px);
      transition: opacity 600ms ease, transform 600ms ease, background 300ms ease, border-color 300ms ease;
    }
    .pq-card.revealed { opacity: 1; transform: translateX(0); }
    .pq-card:hover { background: rgba(255,255,255,0.2); border-color: rgba(212,175,55,0.5); }
    .pq-icon { flex-shrink: 0; color: #D4AF37; display: flex; align-items: center; }
    .pq-text { line-height: 1.5; }
    .pq-cta-text { color: #D4AF37; font-weight: 600; font-size: 0.95rem; margin-top: 0.75rem; font-style: italic; }

    .paraquien-stats-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    .trust-stat-card {
      position: relative; overflow: hidden;
      background: linear-gradient(145deg, #003DA5, #0052D4);
      border: none; border-radius: 1rem;
      padding: 1.5rem 1.25rem; text-align: center;
      box-shadow: 0 8px 24px rgba(0,61,165,0.35);
      transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 400ms ease;
    }
    .trust-stat-card:hover { transform: translateY(-6px); box-shadow: 0 16px 36px rgba(0,61,165,0.45); }
    .trust-stat-number {
      color: #FFFFFF; font-size: 2.25rem; font-weight: 800; font-family: 'Playfair Display', serif;
      line-height: 1; margin-bottom: 0.4rem;
    }
    .trust-stat-label { color: rgba(255,255,255,0.9); font-size: 0.82rem; line-height: 1.3; font-weight: 500; }
    .trust-stat-bg-icon {
      position: absolute; top: 10px; right: 10px; color: rgba(212,175,55,0.5);
    }

    /* ==================== About Block ==================== */
    .about-block { max-width: 1200px; margin: 0 auto; }
    .about-top { text-align: center; margin-bottom: 3rem; }
    .about-top p { color: #4B5563; font-size: 1.15rem; line-height: 1.8; max-width: 700px; margin: 0 auto; }
    .about-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5rem; margin-bottom: 3rem;
    }
    .about-card {
      background: white; border-radius: 1.25rem; padding: 2rem 1.5rem; text-align: center;
      box-shadow: 0 4px 24px rgba(0,18,51,0.06); transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      position: relative; overflow: hidden; border: 1px solid rgba(0,18,51,0.04);
    }
    .about-card::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, #003DA5, #D4AF37); transform: scaleX(0);
      transform-origin: center; transition: transform 400ms;
    }
    .about-card:hover::before { transform: scaleX(1); }
    .about-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,18,51,0.12); }
    .about-card-icon {
      width: 64px; height: 64px; border-radius: 1rem; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1rem; font-size: 1.75rem;
      background: linear-gradient(145deg, #001845, #003DA5); color: white;
      box-shadow: 0 8px 20px rgba(0,61,165,0.2);
    }
    .about-card h4 {
      color: #001233; font-size: 1rem; font-weight: 700; margin: 0;
      font-family: 'Playfair Display', serif; text-transform: capitalize;
    }
    .about-highlight {
      background: linear-gradient(160deg, #001233, #001845, #002B75);
      border-radius: 1.5rem; padding: 3rem 2.5rem; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 20px 50px rgba(0,18,51,0.25);
    }
    .about-highlight::before {
      content: ''; position: absolute; top: -50%; right: -20%; width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 60%); border-radius: 50%;
    }
    .about-highlight::after {
      content: ''; position: absolute; bottom: -30%; left: -10%; width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(0,103,197,0.08) 0%, transparent 60%); border-radius: 50%;
    }
    .about-highlight p {
      color: white; font-weight: 600; font-size: 1.35rem; line-height: 1.6;
      position: relative; z-index: 1; margin: 0;
      font-family: 'Playfair Display', serif;
    }
    .about-highlight p span { color: #D4AF37; }

    /* ==================== About Full ==================== */
    .about-full { max-width: 1200px; margin: 0 auto; }
    .about-pillars {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;
    }
    .about-pillar-card {
      text-align: center; padding: 2rem 1.25rem; border-radius: 1.25rem;
      background: white; border: 1px solid rgba(0,18,51,0.06);
      box-shadow: 0 4px 16px rgba(0,18,51,0.05);
      transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 400ms ease;
    }
    .about-pillar-card:hover { transform: translateY(-6px); box-shadow: 0 16px 40px rgba(0,18,51,0.12); }
    .about-pillar-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 1rem;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(0,61,165,0.1), rgba(212,175,55,0.08));
      color: #003DA5; transition: background 300ms, color 300ms;
    }
    .about-pillar-card:hover .about-pillar-icon { background: linear-gradient(135deg, #001845, #003DA5); color: white; }
    .about-pillar-card h4 { color: #001233; font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; font-family: 'Playfair Display', serif; }
    .about-pillar-card p { color: #5A6577; font-size: 0.85rem; line-height: 1.6; margin: 0; }
    .about-highlight-bar {
      background: linear-gradient(135deg, #001233, #001845); border-radius: 1rem;
      padding: 1.5rem 2.5rem; text-align: center;
    }
    .about-highlight-bar p {
      color: white; font-weight: 600; font-size: 1.2rem; margin: 0;
      font-family: 'Playfair Display', serif;
    }
    .about-highlight-bar p span { color: #D4AF37; }

    /* ==================== Responsive Grids ==================== */
    .emotion-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;
      align-items: center; max-width: 1000px; margin: 0 auto;
    }
    .sat-grid {
      display: grid; grid-template-columns: 1fr 1.2fr; gap: 2rem; align-items: center;
    }
    .sat-video-col { position: relative; }
    .sat-video-wrapper {
      border-radius: 1.25rem; overflow: hidden; aspect-ratio: 3/4; max-height: 400px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      border: 2px solid rgba(212,175,55,0.2);
    }
    .sat-text-col {}
    .sat-badge-row { display: flex; align-items: center; gap: 0.75rem; }
    .sat-ppr-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08));
      border: 1px solid rgba(212,175,55,0.3); border-radius: 2rem;
      padding: 0.5rem 1.25rem; color: #D4AF37; font-weight: 700; font-size: 0.85rem;
    }

    /* ==================== Contact Form ==================== */
    .landing-contact-form-container {
      max-width: 650px; margin: 0 auto; background: white; padding: 2rem;
      border-radius: 1.25rem; box-shadow: 0 20px 50px rgba(0,18,51,0.12);
      border: none; position: relative; overflow: hidden;
    }
    .landing-contact-form-container::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(90deg, #001845, #003DA5, #D4AF37);
    }
    .landing-contact-form-container h2 { text-align: center; color: #001233; margin-bottom: 1rem; font-size: clamp(1.75rem, 3vw, 2.25rem); font-family: 'Playfair Display', serif; }
    .form-subcopy { text-align: center; color: #4B5563; font-size: 0.9rem; margin-bottom: 1rem; }
    .landing-form-group { display: flex; flex-direction: column; margin-bottom: 0.75rem; }
    .landing-form-group label { font-weight: 600; color: #2D3436; margin-bottom: 0.25rem; font-size: 0.85rem; }
    .landing-form-group input, .landing-form-group select, .landing-form-group textarea {
      padding: 0.6rem 0.85rem; border: 1.5px solid #E5E7EB; border-radius: 0.6rem;
      font-size: 0.9rem; font-family: 'Inter', sans-serif; transition: all 300ms;
    }
    .landing-form-group input:focus, .landing-form-group select:focus, .landing-form-group textarea:focus {
      outline: none; border-color: #003DA5; box-shadow: 0 0 0 3px rgba(0,61,165,0.1);
    }
    .landing-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .landing-form-submit {
      width: 100%; padding: 1.1rem 2rem; background: linear-gradient(145deg, #001845, #003DA5);
      color: white; border: none; border-radius: 2rem; font-weight: 700; font-size: 1.05rem;
      cursor: pointer; transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 10px 30px rgba(0,24,69,0.25); letter-spacing: 0.01em;
    }
    .landing-form-submit:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(0,24,69,0.3); }
    .landing-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .landing-form-success-message { background: #D1FAE5; border: 1.5px solid #10B981; color: #047857; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; text-align: center; font-weight: 500; }
    .landing-form-error-message { background: #FEE2E2; border: 1.5px solid #EF4444; color: #DC2626; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; text-align: center; font-weight: 500; }

    /* ==================== Closing / CTA ==================== */
    .landing-cta-section {
      max-width: 1200px; margin: 0 auto;
      background: linear-gradient(160deg, #001233, #001845, #002B75, #003DA5); background-size: 300% 300%;
      animation: gradientShift 8s ease infinite;
      color: white; text-align: center; padding: 4.5rem 3rem; border-radius: 2rem;
      position: relative; overflow: hidden;
      box-shadow: 0 30px 60px rgba(0,18,51,0.4);
    }
    .landing-cta-section::before {
      content: ''; position: absolute; top: -30%; right: -5%; width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(212,175,55,0.18) 0%, transparent 60%); border-radius: 50%;
      animation: ctaFloat 6s ease-in-out infinite;
    }
    .landing-cta-section::after {
      content: ''; position: absolute; bottom: -20%; left: -5%; width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(0,103,197,0.15) 0%, transparent 60%); border-radius: 50%;
      animation: ctaFloat 8s ease-in-out infinite reverse;
    }
    @keyframes ctaFloat { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px, -20px); } }
    .landing-cta-content { position: relative; z-index: 1; }
    .landing-cta-section h2 {
      color: white; margin-bottom: 1rem; font-size: clamp(1.75rem, 3.5vw, 2.75rem);
      font-weight: 700; font-family: 'Playfair Display', serif;
    }
    .landing-cta-section h2 .cta-highlight {
      background: linear-gradient(90deg, #D4AF37, #F0D060, #D4AF37); background-size: 200%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      animation: shimmer 3s ease infinite;
    }
    .landing-cta-section p { color: rgba(255,255,255,0.95); font-size: 1.1rem; margin-bottom: 1.5rem; max-width: 650px; margin-left: auto; margin-right: auto; line-height: 1.7; }
    .brand-tagline { text-align: center; margin-top: 1rem; margin-bottom: 0.5rem; }
    .brand-tagline p { color: rgba(255,255,255,0.7); font-size: 0.9rem; }
    .brand-tagline strong { color: white; font-size: 1.15rem; }
    .cta-btn-pulse {
      animation: ctaPulse 2.5s ease-in-out infinite;
      position: relative;
    }
    .cta-btn-pulse::after {
      content: ''; position: absolute; inset: -4px; border-radius: inherit;
      background: linear-gradient(135deg, rgba(212,175,55,0.4), transparent, rgba(212,175,55,0.4));
      z-index: -1; filter: blur(8px); opacity: 0; animation: ctaGlow 2.5s ease-in-out infinite;
    }
    @keyframes ctaPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
    @keyframes ctaGlow { 0%,100% { opacity: 0; } 50% { opacity: 1; } }

    /* ==================== FAQ ==================== */
    .landing-faq-container { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .landing-faq-item {
      border: none; border-radius: 1rem; overflow: hidden;
      background: white; box-shadow: 0 2px 12px rgba(0,18,51,0.04);
      border-left: 4px solid transparent;
      transition: all 400ms cubic-bezier(0.4,0,0.2,1);
      opacity: 0; transform: translateY(20px);
      animation: faqReveal 500ms ease forwards;
    }
    .landing-faq-item:nth-child(1) { animation-delay: 0ms; }
    .landing-faq-item:nth-child(2) { animation-delay: 80ms; }
    .landing-faq-item:nth-child(3) { animation-delay: 160ms; }
    .landing-faq-item:nth-child(4) { animation-delay: 240ms; }
    .landing-faq-item:nth-child(5) { animation-delay: 320ms; }
    .landing-faq-item:nth-child(6) { animation-delay: 400ms; }
    @keyframes faqReveal { to { opacity: 1; transform: translateY(0); } }
    .landing-faq-item:hover { box-shadow: 0 8px 28px rgba(0,18,51,0.1); transform: translateY(-2px); }
    .landing-faq-item.open { border-left-color: #003DA5; box-shadow: 0 12px 32px rgba(0,18,51,0.1); }
    .landing-faq-question {
      padding: 1.1rem 1.5rem; background: white; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; color: #001233; font-size: 0.95rem; user-select: none;
      gap: 1rem; transition: background 200ms;
    }
    .landing-faq-question:hover { background: rgba(0,61,165,0.03); }
    .landing-faq-toggle {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,61,165,0.08); color: #003DA5; font-size: 0.75rem;
      transition: all 400ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .landing-faq-item.open .landing-faq-toggle {
      transform: rotate(180deg); background: linear-gradient(135deg, #003DA5, #0052D4); color: white;
    }
    .landing-faq-answer {
      padding: 0 1.5rem; background: white; color: #4B5563; line-height: 1.8;
      max-height: 0; overflow: hidden; transition: max-height 400ms cubic-bezier(0.4,0,0.2,1), padding 400ms; font-size: 0.95rem;
    }
    .landing-faq-item.open .landing-faq-answer { max-height: 500px; padding: 0 1.5rem 1.25rem; }

    /* ==================== Footer ==================== */
    .landing-footer { background: linear-gradient(180deg, #001233, #000D1F); color: white; padding: 3rem 1.5rem 1.5rem; }
    .landing-footer-content { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-bottom: 1.5rem; }
    .landing-footer-column h3 { color: white; margin-bottom: 1.5rem; font-size: 1rem; font-weight: 700; }
    .landing-footer-column p { color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6; font-size: 0.95rem; }
    .landing-footer-column a { color: rgba(255,255,255,0.8); text-decoration: none; display: block; margin-bottom: 1rem; transition: color 300ms; font-size: 0.95rem; }
    .landing-footer-column a:hover { color: #C9A84C; }
    .landing-social-links { display: flex; gap: 1rem; margin-top: 1rem; }
    .landing-social-links a {
      width: 40px; height: 40px; border-radius: 50%; background: rgba(201,168,76,0.15);
      display: flex; align-items: center; justify-content: center; color: #C9A84C;
      transition: all 300ms; margin-bottom: 0;
    }
    .landing-social-links a:hover { background: #C9A84C; color: #003DA5; transform: translateY(-3px); }
    .landing-footer-bottom { text-align: center; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 0.9rem; }

    /* ==================== WhatsApp ==================== */
    .landing-whatsapp-button {
      position: fixed; bottom: 30px; right: 30px; width: 64px; height: 64px;
      background: linear-gradient(145deg, #25D366, #20BD5A); border-radius: 50%; display: flex; align-items: center;
      justify-content: center; box-shadow: 0 8px 32px rgba(37,211,102,0.35);
      cursor: pointer; transition: all 400ms cubic-bezier(0.4,0,0.2,1); z-index: 1030; color: white;
      font-size: 1.5rem; text-decoration: none;
    }
    .landing-whatsapp-button:hover { transform: scale(1.12) translateY(-4px); box-shadow: 0 16px 40px rgba(37,211,102,0.5); }

    .landing-sound-toggle {
      position: fixed; bottom: 30px; left: 30px; width: 48px; height: 48px;
      background: rgba(0,18,51,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 1030; color: white; transition: all 300ms ease;
    }
    .landing-sound-toggle:hover { background: rgba(0,61,165,0.9); transform: scale(1.1); }

    /* ==================== Animations ==================== */
    @keyframes slideInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .slide-up { animation: slideInUp 500ms ease; }

    /* ==================== Responsive ==================== */
    @media (max-width: 768px) {
      .landing-navbar-menu {
        display: none; position: absolute; top: 56px; left: 0; right: 0;
        flex-direction: column; gap: 0; background: rgba(255,255,255,0.98);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        padding: 1.5rem; box-shadow: 0 16px 32px rgba(0,18,51,0.12);
      }
      .landing-navbar-menu.active { display: flex; }
      .landing-navbar-menu li { border-bottom: 1px solid rgba(0,18,51,0.06); padding: 1rem 0; }
      .landing-navbar-menu li:last-child { border-bottom: none; }
      .landing-hamburger { display: flex; }
      .landing-navbar-cta { display: none; }
      .landing-hero-content { grid-template-columns: 1fr; gap: 1.5rem; }
      .landing-hero { padding-top: 56px; min-height: 100vh; }
      .landing-problems-grid, .landing-services-grid { grid-template-columns: 1fr; }
      .tax-calc-grid { grid-template-columns: 1fr; }
      .landing-trust-content { grid-template-columns: repeat(2, 1fr); }
      .landing-footer-content { grid-template-columns: 1fr; }
      .landing-section-padding { padding: 2rem 1rem; min-height: auto; }
      .landing-form-row { grid-template-columns: 1fr; }
      .tax-scenarios { grid-template-columns: 1fr; }
      .about-grid { grid-template-columns: repeat(3, 1fr); }
      .about-highlight p { font-size: 1.1rem; }
      .brand-grid { grid-template-columns: 1fr; }
      .emotion-grid { grid-template-columns: 1fr; gap: 2rem; }
      .sat-grid { grid-template-columns: 1fr; gap: 2rem; }
      .paraquien-grid { grid-template-columns: 1fr; gap: 2rem; }
      .paraquien-stats-col { grid-template-columns: repeat(2, 1fr); }
      .about-pillars { grid-template-columns: repeat(2, 1fr); }
      .about-pillar-card { padding: 1.5rem 1rem; }
      .about-highlight-bar { padding: 1.25rem 1.5rem; }
      .about-highlight-bar p { font-size: 1rem; }
      .hero-carousel { min-height: 300px; }
      .landing-whatsapp-button { bottom: 20px; right: 20px; width: 55px; height: 55px; }
    }
    @media (max-width: 480px) {
      .landing-trust-content { grid-template-columns: 1fr; }
      .hero-carousel { min-height: 220px; }
      .about-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;

  return (
    <>
      <style>{styles}</style>

      {/* ==================== 0. NAVBAR ==================== */}
      <nav className={`landing-navbar ${isNavScrolled ? 'scrolled' : ''}`}>
        <div className="landing-navbar-content">
          <a href="#" className="landing-navbar-logo"><Logo height={38} variant="dark" /></a>
          <button
            className={`landing-hamburger ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
          <ul className={`landing-navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <li><a href="#problema" onClick={() => scrollToSection('problema')}>Problema</a></li>
            <li><a href="#solucion" onClick={() => scrollToSection('solucion')}>Solución</a></li>
            <li><a href="#simulador" onClick={() => scrollToSection('simulador')}>Simulador</a></li>
            <li><a href="#faq" onClick={() => scrollToSection('faq')}>FAQ</a></li>
            <li><a href="#contacto" onClick={() => scrollToSection('contacto')}>Contacto</a></li>
          </ul>
          <div className="landing-navbar-cta">
            <button className="landing-btn landing-btn-primary" onClick={() => scrollToSection('simulador')}>
              Haz tu simulación
            </button>
          </div>
        </div>
      </nav>

      {/* ==================== 1. HERO PRINCIPAL ==================== */}
      <section className="landing-hero" ref={heroSectionRef}>
        <div className="landing-hero-content">
          <div className="landing-hero-text">
            <h1>Haz que tu retiro, tus impuestos y tu dinero <span className="gold">dejen de sentirse complicados</span></h1>
            <p>
              En Finance S C<span className="oo-infinity">oo</span>l hacemos algo muy simple: convertimos lo que antes sonaba pesado
              —números, SAT, ahorro, retiro y estrategia fiscal— en algo fácil de entender,
              útil y hasta emocionante de usar a tu favor.
            </p>
            <div className="landing-hero-cta">
              <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('simulador')}>
                Quiero ver cuánto puedo aprovechar
              </button>
              <button className="landing-btn landing-btn-outline-hero" onClick={() => scrollToSection('simulador')} style={{ padding: '0.85rem 2rem', fontSize: '1rem', minHeight: '48px' }}>
                Ver simulador <ChevronDown size={18} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
          <div className="hero-carousel">
            {heroSlides.map((slide, idx) => (
              <video key={idx} ref={(el) => (heroVideoRefs.current[idx] = el)} className={`hero-carousel-video ${heroSlide === idx ? 'active' : ''}`} autoPlay loop globalMuted={isMuted} playsInline>
                <source src={slide.video} type="video/mp4" />
              </video>
            ))}
            <div className="hero-carousel-overlay" />
            {heroSlides.map((slide, idx) => (
              <div key={idx} className={`hero-slide-content ${heroSlide === idx ? 'active' : ''}`}>
                <div className="hero-slide-title">{slide.title}</div>
                <div className="hero-slide-subtitle">{slide.subtitle}</div>
                <div className="hero-slide-stat">
                  <div className="hero-slide-stat-value">{slide.stat}</div>
                  <div className="hero-slide-stat-label">{slide.statLabel}</div>
                </div>
              </div>
            ))}
            <div className="hero-dots">
              {heroSlides.map((_, idx) => (
                <button key={idx} className={`hero-dot ${heroSlide === idx ? 'active' : ''}`} onClick={() => setHeroSlide(idx)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 2. IDENTIDAD DE MARCA ==================== */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="brand-block" ref={(el) => (observerRefs.current[0] = el)}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Nuestra Historia</span>
            <h2>¿Por qué <span style={{ color: '#003DA5' }}>Finance</span> S C<span className="oo-infinity">oo</span>l?</h2>
          </div>
          <div className="brand-grid">
            <div className="brand-left">
              <div className="brand-video-wrapper">
                <img src="/assets/ppr-hero.png" alt="Plan Personal de Retiro - Ahorra e Invierte a Largo Plazo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              </div>
            </div>
            <div className="brand-right">
              <p className="brand-text">
                Mucha gente escucha nuestro nombre y cree que decimos <strong>Finance School</strong>,
                como si fuéramos una escuela de finanzas. Y sí... suena parecido. Pero hay un juego de palabras que nos define:
              </p>
              <span className="brand-name-highlight">Finance S C<span className="oo-infinity">oo</span>l</span>
              <p className="brand-text">
                Porque las finanzas, los impuestos, el ahorro y el retiro <strong>sí pueden
                entenderse fácil, verse bien y sentirse cool.</strong>
              </p>
              <p className="brand-text">
                Nosotros lo hacemos distinto.
                <strong> Te lo explicamos claro. Te lo aterrizamos a tu vida.</strong> Y te ayudamos a tomar decisiones inteligentes sin hablarte "en chino".
              </p>
              <div className="brand-quote">
                Lo que antes daba flojera aprender, hoy por fin alguien te lo explica padrísimo.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3. CONEXION EMOCIONAL ==================== */}
      <section className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} ref={(el) => (observerRefs.current[1] = el)} data-section="emotion">
          <div className="landing-section-header">
            <h2>Si el SAT, el retiro o los números te dan dolor de cabeza... <span style={{ color: '#003DA5' }}>no eres tú.</span></h2>
            <p>Es como te lo habían contado. La mayoría de las personas nunca recibió una guía real para entender:</p>
          </div>
          <div className="emotion-grid">
            <div>
              <ul className="emotion-list">
                <li className={`reveal-left stagger-1 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo pagar impuestos con estrategia</li>
                <li className={`reveal-left stagger-2 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo construir patrimonio</li>
                <li className={`reveal-left stagger-3 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo preparar su retiro</li>
                <li className={`reveal-left stagger-4 ${visibleSections.emotion ? 'revealed' : ''}`}><span className="emotion-check"><CheckCircle size={20} color="#C9A84C" /></span> Cómo usar herramientas legales a su favor</li>
              </ul>
              <div className="emotion-combo" style={{ justifyContent: 'flex-start' }}>
                <span className="emotion-combo-item">dinero</span>
                <span className="emotion-combo-item">estrategia</span>
                <span className="emotion-combo-item">explicación sencilla</span>
              </div>
            </div>
            <LazyVideo src="/assets/man-points.mp4" className="brand-video-wrapper" globalMuted={isMuted} />
          </div>
          <p className="emotion-mini">Menos confusión. Más claridad. Más control sobre tu futuro.</p>
        </div>
      </section>

      {/* ==================== 4. EL PROBLEMA ==================== */}
      <section id="problema" className="landing-section landing-section-light landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} data-section="problema" ref={(el) => (sectionRefs.current.problema = el)}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">El Problema</span>
            <h2>¿Por qué <span style={{ color: '#D4AF37' }}>sí urge</span> actuar?</h2>
            <p>Porque hay tres cosas que casi siempre pasan al mismo tiempo... y juntas pegan más de lo que parece.</p>
          </div>
          <div className="landing-problems-grid">
            <div className={`landing-problem-card stagger-1 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">01</span>
              <div className="landing-problem-icon"><BarChart3 size={24} strokeWidth={2} /></div>
              <h3>Tu AFORE no siempre va a ser suficiente</h3>
              <p>
                Aunque si cuenta, para muchas personas no alcanza por sí sola para sostener el estilo
                de vida que quisieran en retiro. Esperar a que "eso se resuelva solo" normalmente sale caro.
              </p>
            </div>
            <div className={`landing-problem-card stagger-2 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">02</span>
              <div className="landing-problem-icon"><Wallet size={24} strokeWidth={2} /></div>
              <h3>Pagas impuestos... pero quizá no los estás usando a tu favor</h3>
              <p>
                Muchas personas hacen sus deducciones normales, pero no aprovechan herramientas orientadas
                al retiro que podrían ayudarles a ordenar mejor su estrategia fiscal.
              </p>
            </div>
            <div className={`landing-problem-card stagger-3 ${visibleSections.problema ? 'revealed' : ''}`}>
              <span className="problem-number">03</span>
              <div className="landing-problem-icon"><Clock size={24} strokeWidth={2} /></div>
              <h3>El tiempo sí cuenta. Y mucho.</h3>
              <p>
                Cada año que pasa sin planear retiro pesa. Porque después necesitas ahorrar más,
                más rápido y con más presión para llegar al mismo objetivo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 5. SOLUCION ==================== */}
      <section id="solucion" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} data-section="solucion" ref={(el) => (sectionRefs.current.solucion = el)}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">La Solución</span>
            <h2>Aquí no solo hablas de retiro. Aquí armas una <span style={{ color: '#D4AF37' }}>estrategia inteligente.</span></h2>
            <p>Tres piezas que juntas te ayudan a ver mejor tu dinero hoy y construir mejor tu futuro mañana.</p>
          </div>
          <div className="landing-services-grid">
            <div className={`landing-service-card stagger-1 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">1</span>
              <div className="landing-service-icon"><Landmark size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>PPR Prudential</h3>
              <p>Un vehículo pensado para ayudarte a construir retiro con visión de largo plazo.</p>
              <span className="service-tag">Inversión</span>
            </div>
            <div className={`landing-service-card stagger-2 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">2</span>
              <div className="landing-service-icon"><TrendingUp size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>Estrategia Fiscal Cool</h3>
              <p>Te ayudamos a entender cómo conectar ahorro, retiro y deducción de una forma clara, ordenada y aterrizada a tu caso.</p>
              <span className="service-tag">Optimización</span>
            </div>
            <div className={`landing-service-card stagger-3 ${visibleSections.solucion ? 'revealed' : ''}`}>
              <span className="service-step-number">3</span>
              <div className="landing-service-icon"><GraduationCap size={30} strokeWidth={1.5} color="#003DA5" /></div>
              <h3>Educación Financiera sin rollo</h3>
              <p>Porque antes de decidir, necesitas entender. Y entender bien cambia por completo la forma en la que usas tu dinero.</p>
              <span className="service-tag">Educación</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 6. CONCEPTO VIRAL ==================== */}
      <section className="landing-section landing-section-blue landing-section-padding">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="landing-section-header" style={{ marginBottom: '1.5rem' }}>
            <span className="landing-section-subtitle" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>SAT vs Tu Estrategia</span>
            <h2 style={{ color: 'white' }}>Sí, el SAT puede sentirse como el villano... <span style={{ color: '#D4AF37' }}>pero no tienes que jugar sin estrategia</span></h2>
          </div>
          <div className="sat-grid">
            <div className="sat-video-col">
              <LazyVideo src="/assets/hero-shield.mp4" className="sat-video-wrapper" globalMuted={isMuted} />
            </div>
            <div className="sat-text-col">
              <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '1.25rem' }}>
                La idea no es "pelearte" con el SAT. La idea es dejar de improvisar.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', lineHeight: '1.8', marginBottom: '2rem' }}>
                Si ya generas ingresos, si ya pagas impuestos y si además quieres construir algo para ti,
                vale la pena revisar si estás usando bien las herramientas que existen.
              </p>
              <div className="sat-badge-row">
                <div className="sat-ppr-badge">
                  <Shield size={18} strokeWidth={2} />
                  <span>Respaldado por PPR Prudential</span>
                </div>
              </div>
              <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('simulador')} style={{ marginTop: '1.5rem' }}>
                Quiero revisar mi caso
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 7. CALCULADORA ISR 2026 ==================== */}
      <section id="simulador" className="landing-section landing-section-light" style={{ padding: '1rem 1rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <span className="landing-section-subtitle" style={{ marginBottom: '0.5rem' }}>Simulador Fiscal 2026</span>
            <h2 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: '#001233', fontFamily: "'Playfair Display', serif", fontWeight: 700, margin: 0 }}>Ponlo en números</h2>
          </div>
          <div className="tax-calc-container">
            <div className="tax-calc-grid">
              <div className="tax-calc-inputs">
                <div className="tax-input-group">
                  <label>Ingreso Anual Bruto</label>
                  <input
                    type="number" placeholder="Ej: 1,200,000"
                    value={taxCalc.ingresoAnual || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, ingresoAnual: Number(e.target.value) })}
                  />
                </div>
                <div className="tax-input-group">
                  <label>Otros Ingresos Anuales</label>
                  <input
                    type="number" placeholder="Ej: 0"
                    value={taxCalc.otrosIngresos || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, otrosIngresos: Number(e.target.value) })}
                  />
                </div>
                <div className="tax-input-group">
                  <label>Aportación a PPR (Plan Personal de Retiro)</label>
                  <input
                    type="number" placeholder="Ej: 100,000"
                    value={taxCalc.ppr || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, ppr: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                    Tope: {formatMXN(Math.min((taxCalc.ingresoAnual + taxCalc.otrosIngresos) * 0.10, CINCO_UMAS_ANUALES))} (10% ingreso o 5 UMAs)
                  </span>
                </div>
                <div className="tax-input-group">
                  <label>Primas Seguro Retiro (Art. 185 LISR)</label>
                  <input
                    type="number" placeholder="Ej: 0"
                    value={taxCalc.art185 || ''}
                    onChange={(e) => setTaxCalc({ ...taxCalc, art185: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Tope: $152,000</span>
                </div>

                <button className="tax-toggle-advanced" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? '▲' : '▼'} Deducciones personales (opcional)
                </button>

                {showAdvanced && (
                  <>
                    <div className="tax-input-group">
                      <label>Honorarios médicos y dentales</label>
                      <input type="number" value={taxCalc.medicos || ''} onChange={(e) => setTaxCalc({ ...taxCalc, medicos: Number(e.target.value) })} />
                    </div>
                    <div className="tax-input-group">
                      <label>Gastos funerarios</label>
                      <input type="number" value={taxCalc.funerarios || ''} onChange={(e) => setTaxCalc({ ...taxCalc, funerarios: Number(e.target.value) })} />
                      <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Tope: $42,794.64 (1 UMA anual)</span>
                    </div>
                    <div className="tax-input-group">
                      <label>Donativos</label>
                      <input type="number" value={taxCalc.donativos || ''} onChange={(e) => setTaxCalc({ ...taxCalc, donativos: Number(e.target.value) })} />
                      <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Tope: 7% de tu ingreso</span>
                    </div>
                    <div className="tax-input-group">
                      <label>Intereses reales créditos hipotecarios</label>
                      <input type="number" value={taxCalc.hipotecarios || ''} onChange={(e) => setTaxCalc({ ...taxCalc, hipotecarios: Number(e.target.value) })} />
                    </div>
                    <div className="tax-input-group">
                      <label>Seguro de Gastos Médicos Mayores</label>
                      <input type="number" value={taxCalc.seguroGMM || ''} onChange={(e) => setTaxCalc({ ...taxCalc, seguroGMM: Number(e.target.value) })} />
                    </div>
                    <div className="tax-input-group">
                      <label>Transporte escolar obligatorio</label>
                      <input type="number" value={taxCalc.transporteEscolar || ''} onChange={(e) => setTaxCalc({ ...taxCalc, transporteEscolar: Number(e.target.value) })} />
                    </div>
                  </>
                )}
              </div>

              <div className="tax-results">
                <h3>Tu escenario fiscal 2026</h3>

                <div className="tax-scenarios">
                  <div className="tax-scenario">
                    <div className="tax-scenario-label">ISR sin deducciones</div>
                    <div className="tax-scenario-value">{formatMXN(taxResults.isrSinDed)}</div>
                  </div>
                  <div className="tax-scenario">
                    <div className="tax-scenario-label">ISR con ded. personales</div>
                    <div className="tax-scenario-value">{formatMXN(taxResults.isrConDedSinRetiro)}</div>
                  </div>
                  <div className="tax-scenario">
                    <div className="tax-scenario-label">ISR con retiro + ded.</div>
                    <div className="tax-scenario-value" style={{ color: '#10B981' }}>{formatMXN(taxResults.isrConDedConRetiro)}</div>
                  </div>
                </div>

                <div className="tax-result-highlight">
                  <div className="tax-result-label">Devolución de impuestos estimada</div>
                  <div className="tax-result-value">{formatMXN(taxResults.devolucion)}</div>
                </div>

                <div className="tax-result-row">
                  <span className="tax-result-label">Ingreso real (después de ISR)</span>
                  <span className="tax-result-value">{formatMXN(taxResults.ingresoReal)}</span>
                </div>
                <div className="tax-result-row">
                  <span className="tax-result-label">Promedio mensual</span>
                  <span className="tax-result-value">{formatMXN(taxResults.mensual)}</span>
                </div>
                <div className="tax-result-row">
                  <span className="tax-result-label">Tasa marginal</span>
                  <span className="tax-result-value">{taxResults.pctRecup.toFixed(0)}%</span>
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button className="landing-btn landing-btn-gold" onClick={() => scrollToSection('contacto')}>
                    Quiero calcular mi escenario completo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 8. PARA QUIEN + CONFIANZA ==================== */}
      <section className="landing-section landing-trust-bar landing-section-padding" data-section="paraquien" ref={(el) => (sectionRefs.current.paraquien = el)}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="landing-section-header" style={{ marginBottom: '2rem' }}>
            <span className="landing-section-subtitle" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>Te Identificas</span>
            <h2 style={{ color: 'white', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Esto hace sentido si tú piensas algo así...</h2>
          </div>

          <div className="paraquien-grid">
            <div className="paraquien-cards-col">
              {[
                { icon: <Briefcase size={20} strokeWidth={2} />, text: '"Mi dinero no está construyendo futuro."' },
                { icon: <FileText size={20} strokeWidth={2} />, text: '"Pago impuestos y no sé si lo hago de la mejor forma."' },
                { icon: <Target size={20} strokeWidth={2} />, text: '"Quiero ahorrar con estrategia, no a ciegas."' },
                { icon: <Clock size={20} strokeWidth={2} />, text: '"No quiero llegar a los 60 y empezar a preocuparme."' },
                { icon: <Lightbulb size={20} strokeWidth={2} />, text: '"Que alguien me explique esto fácil."' },
              ].map((item, i) => (
                <div key={i} className={`pq-card reveal-left stagger-${i + 1} ${visibleSections.paraquien ? 'revealed' : ''}`}>
                  <span className="pq-icon">{item.icon}</span>
                  <span className="pq-text">{item.text}</span>
                </div>
              ))}
              <p className="pq-cta-text">Si te sonó una sola, ya vale la pena revisarlo.</p>
            </div>

            <div className="paraquien-stats-col">
              <div className="trust-stat-card" ref={trustRef1}>
                <div className="trust-stat-number">{trustCount1}+</div>
                <div className="trust-stat-label">Clientes asesorados</div>
                <Users size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card" ref={trustRef2}>
                <div className="trust-stat-number">{trustCount2}%</div>
                <div className="trust-stat-label">Enfoque regulado</div>
                <CheckCircle size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card" ref={trustRef3}>
                <div className="trust-stat-number">{trustCount3}+</div>
                <div className="trust-stat-label">Años de experiencia fiscal</div>
                <Brain size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
              <div className="trust-stat-card">
                <div className="trust-stat-number">AAA</div>
                <div className="trust-stat-label">Respaldo Prudential</div>
                <Shield size={24} strokeWidth={1.5} className="trust-stat-bg-icon" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 10. QUIENES SOMOS ==================== */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="about-full" ref={(el) => (observerRefs.current[9] = el)}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Quiénes Somos</span>
            <h2>No somos la típica firma que te habla complicado <span style={{ color: '#D4AF37' }}>para sonar inteligente</span></h2>
            <p>En Finance S C<span className="oo-infinity">oo</span>l creemos que la verdadera inteligencia está en hacer entendible lo importante. Por eso acompañamos a personas y familias a tomar mejores decisiones sobre:</p>
          </div>

          <div className="about-pillars">
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Landmark size={28} strokeWidth={1.5} /></div>
              <h4>Retiro</h4>
              <p>Planeación para que tu futuro no dependa de la improvisación.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><TrendingUp size={28} strokeWidth={1.5} /></div>
              <h4>Patrimonio</h4>
              <p>Estrategias para crecer lo que ya construiste con visión a largo plazo.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Wallet size={28} strokeWidth={1.5} /></div>
              <h4>Ahorro</h4>
              <p>No cualquier ahorro: ahorro con intención y dirección clara.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Shield size={28} strokeWidth={1.5} /></div>
              <h4>Seguros</h4>
              <p>Protección real para ti y tu familia, sin letra chiquita.</p>
            </div>
            <div className="about-pillar-card">
              <div className="about-pillar-icon"><Brain size={28} strokeWidth={1.5} /></div>
              <h4>Inteligencia Fiscal</h4>
              <p>Usar las reglas del juego a tu favor, no en tu contra.</p>
            </div>
          </div>

          <div className="about-highlight-bar">
            <p>Si lo entiendes, lo puedes <span>decidir mejor.</span> Y si lo decides mejor, tu dinero <span>trabaja distinto.</span></p>
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Dudas Comunes</span>
            <h2>Preguntas Frecuentes</h2>
          </div>
          <div className="landing-faq-container">
            {faqItems.map((item, idx) => (
              <div key={idx} className={`landing-faq-item ${openFaqIndex === idx ? 'open' : ''}`}>
                <div className="landing-faq-question" onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}>
                  <span>{item.question}</span>
                  <span className="landing-faq-toggle">&#9660;</span>
                </div>
                <div className="landing-faq-answer">{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 11. FORMULARIO DE CONVERSION ==================== */}
      <section id="contacto" className="landing-section landing-section-light landing-section-padding">
        <div className="landing-contact-form-container">
          <h2>Descubre si hoy puedes hacer más con tu dinero</h2>
          <p className="form-subcopy">
            Déjanos tus datos y uno de nuestros consultores te ayuda a revisar si esta estrategia hace sentido para ti.
          </p>
          {formStatus === 'success' && <div className="landing-form-success-message">¡Gracias! Nos pondremos en contacto pronto.</div>}
          {formStatus === 'error' && <div className="landing-form-error-message">Hubo un error. Intenta nuevamente.</div>}
          <form onSubmit={handleFormSubmit}>
            <div className="landing-form-group">
              <label>Nombre</label>
              <input type="text" placeholder="Tu nombre completo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>Teléfono</label>
                <input type="tel" placeholder="+52 55 1234 5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
              <div className="landing-form-group">
                <label>Correo</label>
                <input type="email" placeholder="tu@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>Tipo de ingreso</label>
                <select value={formData.incomeType} onChange={(e) => setFormData({ ...formData, incomeType: e.target.value })} required>
                  <option value="">Selecciona...</option>
                  <option value="empleado">Empleado</option>
                  <option value="freelancer">Freelancer / Independiente</option>
                  <option value="empresario">Empresario</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div className="landing-form-group">
                <label>Ingreso aproximado mensual</label>
                <select value={formData.approxIncome} onChange={(e) => setFormData({ ...formData, approxIncome: e.target.value })} required>
                  <option value="">Selecciona...</option>
                  <option value="20k-50k">$20,000 - $50,000</option>
                  <option value="50k-100k">$50,000 - $100,000</option>
                  <option value="100k-200k">$100,000 - $200,000</option>
                  <option value="200k+">$200,000+</option>
                </select>
              </div>
            </div>
            <div className="landing-form-row">
              <div className="landing-form-group">
                <label>¿Haces declaración anual?</label>
                <select value={formData.declaracion} onChange={(e) => setFormData({ ...formData, declaracion: e.target.value })}>
                  <option value="">Selecciona...</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                  <option value="no_se">No estoy seguro</option>
                </select>
              </div>
              <div className="landing-form-group">
                <label>¿Ya tienes algo para tu retiro?</label>
                <select value={formData.retiroPlan} onChange={(e) => setFormData({ ...formData, retiroPlan: e.target.value })}>
                  <option value="">Selecciona...</option>
                  <option value="si_ppr">Sí, tengo PPR</option>
                  <option value="si_otro">Sí, otro instrumento</option>
                  <option value="no">No, nada aún</option>
                  <option value="no_se">No sé</option>
                </select>
              </div>
            </div>
            <button type="submit" className="landing-form-submit" disabled={formStatus === 'loading'}>
              {formStatus === 'loading' ? 'Enviando...' : 'Quiero mi diagnóstico personalizado'}
            </button>
          </form>
        </div>
      </section>

      {/* ==================== 12. CIERRE FINAL ==================== */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="landing-cta-section">
          <div className="landing-cta-content">
            <h2>Tu retiro no debería empezar a importarte <span className="cta-highlight">cuando ya sea tarde</span></h2>
            <p>
              Cuando entiendes cómo conectar estrategia fiscal, ahorro y retiro, las decisiones cambian.
              Y cuando alguien por fin te lo explica fácil, también cambia tu forma de verlo.
            </p>
            <div className="brand-tagline">
              <strong>Finance S C<span className="oo-infinity">oo</span>l</strong>
              <p>Porque las finanzas también se pueden entender cool.</p>
            </div>
            <button className="landing-btn landing-btn-gold cta-btn-pulse" onClick={() => scrollToSection('contacto')} style={{ marginTop: '1.5rem', fontSize: '1.05rem', padding: '1rem 2.5rem' }}>
              Agenda tu asesoría gratuita
            </button>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-column">
            <Logo height={55} variant="light" />
            <p style={{ marginTop: '12px' }}>
              Porque las finanzas también se pueden entender cool.
              Estrategia fiscal + PPR + Educación financiera.
            </p>
          </div>
          <div className="landing-footer-column">
            <h3>Links</h3>
            <a href="#problema">Problema</a>
            <a href="#solucion">Solución</a>
            <a href="#simulador">Simulador</a>
            <a href="#faq">FAQ</a>
            <a href="#contacto">Contacto</a>
          </div>
          <div className="landing-footer-column">
            <h3>Síguenos</h3>
            <div className="landing-social-links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Camera size={18} /></a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><Linkedin size={18} /></a>
              <a href="https://wa.me/5215551234567" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; 2026 Finance SCool. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* WhatsApp Button */}
      <button className="landing-sound-toggle" onClick={() => setIsMuted(!isMuted)} aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}>
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      <a
        href="https://wa.me/5215551234567?text=Hola%20Finance%20SCool%2C%20quiero%20agendar%20una%20consulta"
        target="_blank" rel="noopener noreferrer"
        className="landing-whatsapp-button" aria-label="WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    </>
  );
}
