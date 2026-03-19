import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, MessageCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function Landing() {
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [formStatus, setFormStatus] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const observerRefs = useRef([]);
  const navigate = useNavigate();

  // Scroll animations
  useEffect(() => {
    const handleScroll = () => {
      setIsNavScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('slide-up');
          }
        });
      },
      { threshold: 0.1 }
    );

    observerRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // Smooth scroll to sections
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  // Handle form submission
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
        setFormData({ name: '', email: '', phone: '', message: '' });
        setTimeout(() => setFormStatus(''), 3000);
      } else {
        setFormStatus('error');
      }
    } catch (error) {
      setFormStatus('error');
      console.error('Error:', error);
    }
  };

  // Calculator state
  const [calcInputs, setCalcInputs] = useState({
    age: 35,
    salary: 60000,
    years: 25,
    growth: 5,
  });

  const calculateProjection = () => {
    const monthlyContribution = (calcInputs.salary * 0.05) / 12;
    const monthlyRate = calcInputs.growth / 100 / 12;
    const months = calcInputs.years * 12;
    const futureValue = monthlyContribution * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) || months);
    return {
      monthlyContribution: monthlyContribution.toFixed(2),
      totalContributed: (monthlyContribution * months).toFixed(2),
      projectedBalance: futureValue.toFixed(2),
      taxSavings: (calcInputs.salary * 0.05 * 0.35).toFixed(2),
    };
  };

  const results = calculateProjection();

  const faqItems = [
    {
      question: 'Qué es un PPR (Plan Personal de Retiro)?',
      answer: 'Un PPR es un producto de ahorro e inversión con beneficios fiscales que te permite ahorrar para tu retiro con deducciones de hasta 198,000 MXN anuales conforme al Art. 151 LISR.',
    },
    {
      question: 'Cuál es la ventaja de una Estrategia Fiscal Integral?',
      answer: 'Va más allá del PPR. Analizamos tus ingresos completos y optimizamos todas tus opciones: deducciones (Art. 151, 152), créditos fiscales, estructura de inversión, y hasta fideicomisos si aplica.',
    },
    {
      question: 'Prudential es seguro?',
      answer: 'Sí. Prudential es una aseguradora regulada por la CNBV (Comisión Nacional Bancaria y de Valores) con más de 80 años en México y calificación de solvencia AA.',
    },
    {
      question: 'Cuánto puedo deducir cada año?',
      answer: 'Hasta 198,000 MXN por año en aportaciones a tu PPR, siempre y cuando no excedas el 20% de tus ingresos gravables del ejercicio anterior. Dependiendo de tu situación, también pueden aplicar otras deducciones.',
    },
    {
      question: 'Necesito asesoría personalizada?',
      answer: 'Sí, ofrecemos 1:1 consulting donde revisamos tu situación fiscal actual, ingresos, estructura legal (empresa propia, empleado, freelancer) y diseñamos la estrategia óptima para ti.',
    },
    {
      question: 'Cómo es el proceso de inversión?',
      answer: 'Primero haces un plan personalizado basado en tu perfil de riesgo y horizonte (5, 10, 25 años). Invertimos en fondos diversificados con costo bajo y supervisamos anualmente tu avance.',
    },
  ];

  const testimonials = [
    {
      name: 'Carlos M.',
      role: 'Consultor Independiente',
      text: 'Gracias a la estrategia fiscal, pasé de pagar 89,000 MXN en impuestos a 54,000. Ahorro que reinvierto en mi retiro.',
      stars: 5,
      initials: 'CM',
    },
    {
      name: 'María L.',
      role: 'Empresaria',
      text: 'El PPR con educación financiera me cambió la perspectiva sobre mi jubilación. Tengo un plan real ahora.',
      stars: 5,
      initials: 'ML',
    },
    {
      name: 'Roberto G.',
      role: 'Ejecutivo',
      text: 'Finance SCool me ahorró horas de research. Ahora sé exactamente qué hacer con mis ahorros e impuestos.',
      stars: 5,
      initials: 'RG',
    },
  ];

  const styles = `
    /* Component-specific styles for Landing */
    .landing-navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #003DA5 0%, #002B75 100%);
      border-bottom: none;
      z-index: 1030;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
    }

    .landing-navbar.scrolled {
      box-shadow: 0 4px 12px -1px rgba(0, 0, 0, 0.2);
      background: linear-gradient(135deg, #002B75 0%, #001A4D 100%);
    }

    .landing-navbar-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
    }

    .landing-navbar-logo {
      text-decoration: none;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .landing-navbar-logo:hover {
      opacity: 0.85;
    }

    .landing-navbar-menu {
      display: flex;
      gap: 2.5rem;
      list-style: none;
      align-items: center;
    }

    .landing-navbar-menu a {
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.95rem;
      transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .landing-navbar-menu a:hover {
      color: #FFFFFF;
    }

    .landing-navbar-cta {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .landing-btn {
      padding: 0.5rem 1.5rem;
      border-radius: 1.25rem;
      font-weight: 600;
      font-size: 0.875rem;
      border: none;
      cursor: pointer;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .landing-btn-primary {
      background: linear-gradient(135deg, #003DA5 0%, #0067C5 100%);
      color: white;
      box-shadow: 0 10px 15px -3px rgba(0, 61, 165, 0.12);
    }

    .landing-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(0, 61, 165, 0.15);
    }

    .landing-btn-outline {
      background-color: transparent;
      color: #003DA5;
      border: 1.5px solid #003DA5;
    }

    .landing-btn-outline:hover {
      background-color: #F7F8FC;
    }

    .landing-navbar .landing-btn-outline {
      color: #FFFFFF;
      border-color: rgba(255, 255, 255, 0.5);
    }

    .landing-navbar .landing-btn-outline:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: #FFFFFF;
    }

    .landing-navbar .landing-btn-primary {
      background: #FFFFFF;
      color: #003DA5;
      box-shadow: none;
    }

    .landing-navbar .landing-btn-primary:hover {
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .landing-hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: transparent;
      border: none;
      cursor: pointer;
    }

    .landing-hamburger span {
      width: 24px;
      height: 2.5px;
      background-color: #FFFFFF;
      border-radius: 2px;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-hamburger.active span:nth-child(1) {
      transform: rotate(45deg) translate(10px, 10px);
    }

    .landing-hamburger.active span:nth-child(2) {
      opacity: 0;
    }

    .landing-hamburger.active span:nth-child(3) {
      transform: rotate(-45deg) translate(7px, -7px);
    }

    /* Hero Section */
    .landing-hero {
      background: linear-gradient(135deg, #FFFFFF 0%, #F7F8FC 100%);
      color: #2D3436;
      padding-top: 100px;
      padding-bottom: 3rem;
      position: relative;
      overflow: hidden;
      min-height: auto;
      display: flex;
      align-items: center;
    }

    .landing-hero::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(0, 61, 165, 0.05) 0%, transparent 70%);
      border-radius: 50%;
      transform: translate(100px, -100px);
    }

    .landing-hero-content {
      max-width: 1200px;
      width: 100%;
      padding: 0 1.5rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
      position: relative;
      z-index: 1;
      margin: 0 auto;
    }

    .landing-hero-text h1 {
      color: #003DA5;
      margin-bottom: 1.5rem;
      font-size: clamp(2rem, 5vw, 2.75rem);
      line-height: 1.2;
      letter-spacing: -0.02em;
      font-weight: 700;
    }

    .landing-hero-text p {
      color: #4B5563;
      font-size: 1.0625rem;
      margin-bottom: 2rem;
      line-height: 1.8;
    }

    .landing-hero-cta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .landing-hero-cta .landing-btn {
      padding: 1rem 2rem;
      font-size: 1rem;
      min-height: 48px;
    }

    .landing-hero-card {
      background: white;
      border: 1px solid rgba(0, 61, 165, 0.1);
      border-radius: 1.5rem;
      padding: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 61, 165, 0.08);
      animation: slideInRight 500ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-hero-card-title {
      color: #003DA5;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .landing-hero-chart {
      width: 100%;
      height: 200px;
      margin-top: 1.5rem;
    }

    .landing-hero-card-value {
      margin-top: 1rem;
      color: #003DA5;
      font-size: 1.5rem;
      font-weight: 700;
    }

    /* Trust Bar */
    .landing-trust-bar {
      background-color: #F7F8FC;
      padding: 2rem 1.5rem;
      border-top: 1px solid rgba(0, 61, 165, 0.08);
      border-bottom: 1px solid rgba(0, 61, 165, 0.08);
    }

    .landing-trust-content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      text-align: center;
    }

    .landing-trust-item h3 {
      color: #003DA5;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    .landing-trust-item p {
      color: #4B5563;
      font-size: 0.95rem;
      margin: 0;
    }

    /* Section Styles */
    .landing-section {
      scroll-margin-top: 100px;
    }

    .landing-section-padding {
      padding: 4rem 1.5rem;
    }

    .landing-section-light {
      background-color: #FFFFFF;
    }

    .landing-section-gray {
      background-color: #F7F8FC;
    }

    .landing-section-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .landing-section-header h2 {
      color: #003DA5;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      margin-bottom: 1rem;
      line-height: 1.2;
      letter-spacing: -0.01em;
      font-weight: 700;
    }

    .landing-section-header p {
      font-size: 1.0625rem;
      color: #4B5563;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .landing-section-subtitle {
      color: #C9A84C;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-bottom: 1rem;
      display: inline-block;
    }

    /* Problems Grid */
    .landing-problems-grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }

    .landing-problem-card {
      background: white;
      border: 1px solid rgba(0, 61, 165, 0.08);
      border-radius: 1.25rem;
      padding: 2rem;
      text-align: center;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-problem-card:hover {
      border-color: #C9A84C;
      box-shadow: 0 8px 16px rgba(201, 168, 76, 0.12);
      transform: translateY(-8px);
    }

    .landing-problem-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      color: white;
      font-size: 1.75rem;
    }

    .landing-problem-card h3 {
      color: #003DA5;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .landing-problem-card p {
      color: #4B5563;
      line-height: 1.8;
      margin: 0;
      font-size: 0.95rem;
    }

    /* Services Grid */
    .landing-services-grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }

    .landing-service-card {
      background: white;
      border-radius: 1.25rem;
      padding: 2rem;
      border: 1px solid rgba(0, 61, 165, 0.08);
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .landing-service-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #003DA5, #0067C5);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-service-card:hover::before {
      transform: scaleX(1);
    }

    .landing-service-card:hover {
      border-color: #C9A84C;
      box-shadow: 0 8px 16px rgba(201, 168, 76, 0.12);
      transform: translateY(-8px);
    }

    .landing-service-card.featured {
      border: 2px solid #C9A84C;
      box-shadow: 0 8px 16px rgba(201, 168, 76, 0.12);
      position: relative;
    }

    .landing-service-card.featured::after {
      content: 'Destacado';
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      background: linear-gradient(135deg, #C9A84C, #B99830);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .landing-service-icon {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .landing-service-card h3 {
      color: #003DA5;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .landing-service-card p {
      color: #4B5563;
      line-height: 1.8;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
    }

    .landing-service-features {
      list-style: none;
      margin: 0 0 1.5rem 0;
      padding: 0;
    }

    .landing-service-features li {
      padding: 0.5rem 0;
      color: #4B5563;
      display: flex;
      align-items: center;
      font-size: 0.95rem;
    }

    .landing-service-features li::before {
      content: '✓';
      color: #003DA5;
      font-weight: 700;
      margin-right: 1rem;
      font-size: 1.1rem;
    }

    /* Steps Container */
    .landing-steps-container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      position: relative;
    }

    .landing-step-card {
      background: white;
      border: 1px solid rgba(0, 61, 165, 0.08);
      border-radius: 1.25rem;
      padding: 2rem;
      text-align: center;
      position: relative;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-step-card:hover {
      border-color: #C9A84C;
      box-shadow: 0 8px 16px rgba(201, 168, 76, 0.12);
      transform: translateY(-4px);
    }

    .landing-step-number {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.25rem;
      margin: 0 auto 1.5rem;
    }

    .landing-step-card h3 {
      color: #003DA5;
      margin-bottom: 1rem;
      font-size: 1.125rem;
      font-weight: 700;
    }

    .landing-step-card p {
      color: #4B5563;
      font-size: 0.95rem;
      margin: 0;
      line-height: 1.6;
    }

    /* Calculator */
    .landing-calculator-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border: 1px solid rgba(0, 61, 165, 0.1);
      border-radius: 1.25rem;
      padding: 2.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 61, 165, 0.08);
    }

    .landing-calculator-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.5rem;
    }

    .landing-calculator-inputs {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .landing-slider-group {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .landing-slider-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .landing-slider-label span:first-child {
      font-weight: 600;
      color: #2D3436;
      font-size: 0.95rem;
    }

    .landing-slider-label span:last-child {
      color: #003DA5;
      font-weight: 700;
      font-size: 1.1rem;
    }

    .landing-slider-group input[type='range'] {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(90deg, #F7F8FC 0%, #F7F8FC 100%);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    .landing-slider-group input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(0, 61, 165, 0.08);
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-slider-group input[type='range']::-webkit-slider-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 10px 15px -3px rgba(0, 61, 165, 0.12);
    }

    .landing-slider-group input[type='range']::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      cursor: pointer;
      border: none;
      box-shadow: 0 4px 6px -1px rgba(0, 61, 165, 0.08);
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-calculator-results {
      background: linear-gradient(135deg, rgba(0, 61, 165, 0.02) 0%, rgba(0, 103, 197, 0.02) 100%);
      border-radius: 1.25rem;
      padding: 2rem;
      border: 1.5px solid #003DA5;
    }

    .landing-result-item {
      padding: 1.5rem 0;
      border-bottom: 1px solid rgba(0, 61, 165, 0.08);
    }

    .landing-result-item:last-child {
      border-bottom: none;
    }

    .landing-result-label {
      color: #4B5563;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .landing-result-value {
      color: #003DA5;
      font-size: 1.75rem;
      font-weight: 700;
    }

    /* Testimonials */
    .landing-testimonials-grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }

    .landing-testimonial-card {
      background: white;
      border-radius: 1.25rem;
      padding: 2rem;
      border: 1px solid rgba(0, 61, 165, 0.08);
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-testimonial-card:hover {
      border-color: #C9A84C;
      box-shadow: 0 8px 16px rgba(201, 168, 76, 0.12);
      transform: translateY(-4px);
    }

    .landing-stars {
      color: #C9A84C;
      font-size: 1.1rem;
      margin-bottom: 1rem;
      letter-spacing: 2px;
    }

    .landing-testimonial-text {
      color: #4B5563;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
      line-height: 1.8;
      font-style: italic;
    }

    .landing-testimonial-author {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .landing-author-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .landing-author-info h4 {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      color: #2D3436;
      font-weight: 700;
    }

    .landing-author-info p {
      color: #9CA3AF;
      font-size: 0.85rem;
      margin: 0;
    }

    /* FAQ */
    .landing-faq-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .landing-faq-item {
      border: 1px solid rgba(0, 61, 165, 0.08);
      border-radius: 1rem;
      margin-bottom: 1rem;
      overflow: hidden;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-faq-item:hover {
      border-color: #003DA5;
      box-shadow: 0 4px 6px -1px rgba(0, 61, 165, 0.08);
    }

    .landing-faq-question {
      padding: 1.5rem;
      background: #F7F8FC;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      color: #003DA5;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
      font-size: 0.95rem;
    }

    .landing-faq-question:hover {
      background: #EEF1F8;
    }

    .landing-faq-toggle {
      color: #003DA5;
      font-size: 1.25rem;
      transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }

    .landing-faq-item.open .landing-faq-toggle {
      transform: rotate(180deg);
    }

    .landing-faq-answer {
      padding: 0 1.5rem 1.5rem;
      background: white;
      color: #4B5563;
      line-height: 1.8;
      max-height: 0;
      overflow: hidden;
      transition: max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), padding 300ms cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.95rem;
    }

    .landing-faq-item.open .landing-faq-answer {
      max-height: 500px;
      padding: 1.5rem;
    }

    /* CTA Section */
    .landing-cta-section {
      max-width: 1200px;
      margin: 0 auto;
      background: linear-gradient(135deg, #003DA5 0%, #0067C5 100%);
      color: white;
      text-align: center;
      padding: 3rem 2rem;
      border-radius: 1.25rem;
      position: relative;
      overflow: hidden;
    }

    .landing-cta-section::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(201, 168, 76, 0.08) 0%, transparent 70%);
      border-radius: 50%;
    }

    .landing-cta-content {
      position: relative;
      z-index: 1;
    }

    .landing-cta-section h2 {
      color: white;
      margin-bottom: 1rem;
      font-size: clamp(1.75rem, 4vw, 2.25rem);
      line-height: 1.2;
      letter-spacing: -0.01em;
      font-weight: 700;
    }

    .landing-cta-section p {
      color: rgba(255, 255, 255, 0.95);
      font-size: 1.0625rem;
      margin-bottom: 2rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.6;
    }

    /* Contact Form */
    .landing-contact-form-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 2.5rem;
      border-radius: 1.25rem;
      box-shadow: 0 10px 15px -3px rgba(0, 61, 165, 0.12);
      border: 1px solid rgba(0, 61, 165, 0.08);
    }

    .landing-contact-form-container h2 {
      text-align: center;
      color: #003DA5;
      margin-bottom: 2rem;
      font-size: 1.75rem;
      font-weight: 700;
    }

    .landing-form-group {
      display: flex;
      flex-direction: column;
      margin-bottom: 1.5rem;
    }

    .landing-form-group label {
      font-weight: 600;
      color: #2D3436;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }

    .landing-form-group input,
    .landing-form-group textarea {
      padding: 1rem;
      border: 1.5px solid #E5E7EB;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .landing-form-group input:focus,
    .landing-form-group textarea:focus {
      outline: none;
      border-color: #003DA5;
      box-shadow: 0 0 0 3px rgba(0, 61, 165, 0.1);
    }

    .landing-form-group textarea {
      resize: vertical;
      min-height: 120px;
    }

    .landing-form-group textarea::placeholder,
    .landing-form-group input::placeholder {
      color: #9CA3AF;
    }

    .landing-form-checkbox {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .landing-form-checkbox input[type='checkbox'] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: #003DA5;
    }

    .landing-form-checkbox label {
      margin: 0;
      cursor: pointer;
      font-size: 0.95rem;
      color: #4B5563;
    }

    .landing-form-submit {
      width: 100%;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #003DA5, #0067C5);
      color: white;
      border: none;
      border-radius: 1.25rem;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 15px -3px rgba(0, 61, 165, 0.12);
    }

    .landing-form-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(0, 61, 165, 0.15);
    }

    .landing-form-submit:active {
      transform: translateY(0);
    }

    .landing-form-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .landing-form-success-message {
      background: #D1FAE5;
      border: 1.5px solid #10B981;
      color: #047857;
      padding: 1.5rem;
      border-radius: 0.75rem;
      margin-bottom: 1.5rem;
      text-align: center;
      font-weight: 500;
    }

    .landing-form-error-message {
      background: #FEE2E2;
      border: 1.5px solid #EF4444;
      color: #DC2626;
      padding: 1.5rem;
      border-radius: 0.75rem;
      margin-bottom: 1.5rem;
      text-align: center;
      font-weight: 500;
    }

    /* Footer */
    .landing-footer {
      background-color: #003DA5;
      color: white;
      padding: 4rem 1.5rem 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .landing-footer-content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3rem;
      margin-bottom: 3rem;
    }

    .landing-footer-column h3 {
      color: white;
      margin-bottom: 1.5rem;
      font-size: 1rem;
      font-weight: 700;
    }

    .landing-footer-column p {
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 1rem;
      line-height: 1.6;
      font-size: 0.95rem;
    }

    .landing-footer-column a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      display: block;
      margin-bottom: 1rem;
      transition: color 300ms cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.95rem;
    }

    .landing-footer-column a:hover {
      color: #C9A84C;
    }

    .landing-social-links {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .landing-social-links a {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(201, 168, 76, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #C9A84C;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      margin-bottom: 0;
    }

    .landing-social-links a:hover {
      background: #C9A84C;
      color: #003DA5;
      transform: translateY(-3px);
    }

    .landing-footer-bottom {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.9rem;
    }

    /* WhatsApp Button */
    .landing-whatsapp-button {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 60px;
      height: 60px;
      background: #25D366;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 25px -5px rgba(0, 61, 165, 0.15);
      cursor: pointer;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1030;
      color: white;
      font-size: 1.5rem;
      text-decoration: none;
    }

    .landing-whatsapp-button:hover {
      transform: scale(1.1) translateY(-3px);
      box-shadow: 0 20px 40px rgba(37, 211, 102, 0.4);
    }

    .landing-whatsapp-button:active {
      transform: scale(1) translateY(-1px);
    }

    /* Animations */
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .slide-up {
      animation: slideInUp 500ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .landing-navbar-menu {
        display: none;
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        flex-direction: column;
        gap: 0;
        background: linear-gradient(135deg, #003DA5 0%, #002B75 100%);
        padding: 1.5rem;
        border-bottom: none;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
      }

      .landing-navbar-menu.active {
        display: flex;
      }

      .landing-navbar-menu li {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem 0;
      }

      .landing-navbar-menu li:last-child {
        border-bottom: none;
      }

      .landing-hamburger {
        display: flex;
      }

      .landing-navbar-cta {
        display: none;
      }

      .landing-hero-content {
        grid-template-columns: 1fr;
        gap: 2rem;
      }

      .landing-hero {
        padding-top: 80px;
        padding-bottom: 2rem;
      }

      .landing-problems-grid,
      .landing-services-grid,
      .landing-testimonials-grid {
        grid-template-columns: 1fr;
      }

      .landing-steps-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }

      .landing-calculator-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .landing-trust-content {
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }

      .landing-footer-content {
        grid-template-columns: 1fr;
        gap: 2rem;
      }

      .landing-section-padding {
        padding: 2.5rem 1.5rem;
      }

      .landing-whatsapp-button {
        bottom: 20px;
        right: 20px;
        width: 55px;
        height: 55px;
        font-size: 1.25rem;
      }
    }

    @media (max-width: 480px) {
      .landing-steps-container,
      .landing-trust-content {
        grid-template-columns: 1fr;
      }

      .landing-hero-card {
        margin-top: 2rem;
      }

      .landing-cta-section {
        padding: 2rem 1.5rem;
      }
    }
  `;

  return (
    <>
      <style>{styles}</style>

      {/* Navbar */}
      <nav className={`landing-navbar ${isNavScrolled ? 'scrolled' : ''}`}>
        <div className="landing-navbar-content">
          <a href="#" className="landing-navbar-logo"><Logo height={38} variant="light" /></a>
          <button
            className={`landing-hamburger ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <ul className={`landing-navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <li><a href="#problemas" onClick={() => scrollToSection('problemas')}>Problemas</a></li>
            <li><a href="#servicios" onClick={() => scrollToSection('servicios')}>Servicios</a></li>
            <li><a href="#como-funciona" onClick={() => scrollToSection('como-funciona')}>Cómo Funciona</a></li>
            <li><a href="#simulador" onClick={() => scrollToSection('simulador')}>Simulador</a></li>
            <li><a href="#faq" onClick={() => scrollToSection('faq')}>FAQ</a></li>
          </ul>
          <div className="landing-navbar-cta">
            <button className="landing-btn landing-btn-outline">Contacto</button>
            <button className="landing-btn landing-btn-primary" onClick={() => navigate('/admin/login')}>Acceso</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-text">
            <h1>Planifica tu Retiro Premium con Prudential + Estrategia Fiscal</h1>
            <p>
              Un PPR inteligente combinado con optimización fiscal integral. Ahorra 198,000 MXN al año en impuestos,
              invierte de forma diversificada y asegura un retiro sin preocupaciones. Con asesoría 1:1 personalizada.
            </p>
            <div className="landing-hero-cta">
              <button className="landing-btn landing-btn-primary" onClick={() => scrollToSection('contacto')}>
                Agendar Consulta Gratis
              </button>
              <button className="landing-btn landing-btn-outline" onClick={() => scrollToSection('simulador')}>
                Ver Proyección <ChevronDown size={18} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
          <div className="landing-hero-card">
            <div className="landing-hero-card-title">Proyección de Retiro (25 años)</div>
            <svg className="landing-hero-chart" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
              <rect x="50" y="20" width="330" height="180" fill="rgba(0,61,165,0.03)" stroke="rgba(0,61,165,0.1)" strokeWidth="1.5" rx="8" />
              <line x1="50" y1="100" x2="380" y2="100" stroke="rgba(0,61,165,0.05)" strokeWidth="1" />
              <line x1="50" y1="140" x2="380" y2="140" stroke="rgba(0,61,165,0.05)" strokeWidth="1" />
              <polyline points="60,150 120,130 180,90 240,60 300,40 360,30" fill="none" stroke="#003DA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polygon points="60,150 120,130 180,90 240,60 300,40 360,30 360,200 300,200 240,200 180,200 120,200 60,200" fill="rgba(0,61,165,0.08)" />
              <line x1="50" y1="200" x2="380" y2="200" stroke="rgba(0,61,165,0.3)" strokeWidth="1.5" />
              <line x1="50" y1="20" x2="50" y2="200" stroke="rgba(0,61,165,0.3)" strokeWidth="1.5" />
              <text x="210" y="230" fill="rgba(0,61,165,0.6)" fontSize="12" textAnchor="middle">Años</text>
              <text x="20" y="110" fill="rgba(0,61,165,0.6)" fontSize="12" textAnchor="middle">Balance</text>
            </svg>
            <div className="landing-hero-card-value">
              $1,250,000+ MXN proyectado
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="landing-trust-bar">
        <div className="landing-trust-content">
          <div className="landing-trust-item">
            <h3>500+</h3>
            <p>Clientes Asesorados</p>
          </div>
          <div className="landing-trust-item">
            <h3>CNBV</h3>
            <p>Regulado</p>
          </div>
          <div className="landing-trust-item">
            <h3>Art. 151</h3>
            <p>Deducible</p>
          </div>
          <div className="landing-trust-item">
            <h3>80+ Años</h3>
            <p>Prudential México</p>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section id="problemas" className="landing-section landing-section-light landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">El Problema</span>
            <h2>Por qué es crítico actuar ahora</h2>
            <p>La mayoría de mexicanos enfrenta estos 3 problemas simultáneamente sin solución integral</p>
          </div>
          <div className="landing-problems-grid">
            <div className="landing-problem-card" ref={(el) => (observerRefs.current[0] = el)}>
              <div className="landing-problem-icon">📊</div>
              <h3>AFORE Insuficiente</h3>
              <p>
                La pensión promedio del AFORE es ~$3,000 MXN/mes. No alcanza ni para gastos básicos.
                Necesitas fondos adicionales propios.
              </p>
            </div>
            <div className="landing-problem-card" ref={(el) => (observerRefs.current[1] = el)}>
              <div className="landing-problem-icon">💰</div>
              <h3>Impuestos Excesivos</h3>
              <p>
                Si tienes ingresos altos o negocio propio, pagas hasta 35% en impuestos.
                Casi nadie conoce las deducciones legales de Art. 151 LISR.
              </p>
            </div>
            <div className="landing-problem-card" ref={(el) => (observerRefs.current[2] = el)}>
              <div className="landing-problem-icon">⏰</div>
              <h3>Tiempo es tu Enemigo</h3>
              <p>
                Cada año que esperas cuesta. Con 30 años hasta retiro tienes tiempo.
                Con 50+ años es muy tarde. El tiempo compuesto es oro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicios" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Nuestros Servicios</span>
            <h2>Soluciones Integrales para tu Retiro</h2>
            <p>Tres pilares que se complementan para máxima protección fiscal y retiro seguro</p>
          </div>
          <div className="landing-services-grid">
            <div className="landing-service-card" ref={(el) => (observerRefs.current[3] = el)}>
              <div className="landing-service-icon">🏦</div>
              <h3>PPR Prudential</h3>
              <p>
                Plan Personal de Retiro con Prudential. Deducciones hasta 198,000 MXN/año.
                Inversión diversificada, custodia segura, rendimientos competitivos.
              </p>
              <ul className="landing-service-features">
                <li>Deducible Art. 151 LISR</li>
                <li>Fondos de inversión diversificados</li>
                <li>Comisiones bajas (0.8% - 1.2%)</li>
                <li>Rescate flexible</li>
              </ul>
              <button className="landing-btn landing-btn-primary">Más Info</button>
            </div>

            <div className="landing-service-card featured" ref={(el) => (observerRefs.current[4] = el)}>
              <div className="landing-service-icon">📈</div>
              <h3>Estrategia Fiscal Integral</h3>
              <p>
                Análisis profundo de tu situación actual. Optimizamos impuestos en base a tu estructura
                (empleado, freelancer, empresa), deducciones, créditos y alternativas legales.
              </p>
              <ul className="landing-service-features">
                <li>Auditoría fiscal actual</li>
                <li>Optimización Art. 151, 152</li>
                <li>Fideicomisos si aplica</li>
                <li>Plan anual personalizado</li>
              </ul>
              <button className="landing-btn landing-btn-primary">Contratar Ahora</button>
            </div>

            <div className="landing-service-card" ref={(el) => (observerRefs.current[5] = el)}>
              <div className="landing-service-icon">🎓</div>
              <h3>Educación Financiera</h3>
              <p>
                Talleres, artículos y mentoría sobre retiro, inversión e impuestos.
                Entiende el por qué de cada decisión, no solo ejecuta.
              </p>
              <ul className="landing-service-features">
                <li>Webinars mensuales</li>
                <li>Biblioteca de recursos</li>
                <li>Asesoría 1:1 trimestral</li>
                <li>Actualizaciones fiscales 2026</li>
              </ul>
              <button className="landing-btn landing-btn-primary">Acceder</button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="como-funciona" className="landing-section landing-section-light landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">El Proceso</span>
            <h2>Cómo Empezamos tu Plan</h2>
          </div>
          <div className="landing-steps-container">
            <div className="landing-step-card" ref={(el) => (observerRefs.current[6] = el)}>
              <div className="landing-step-number">1</div>
              <h3>Consulta Gratis</h3>
              <p>Llamada de 30 min para entender tu situación, ingresos y metas de retiro.</p>
            </div>
            <div className="landing-step-card" ref={(el) => (observerRefs.current[7] = el)}>
              <div className="landing-step-number">2</div>
              <h3>Análisis Profundo</h3>
              <p>Revisamos documentos, calculamos proyecciones y oportunidades fiscales.</p>
            </div>
            <div className="landing-step-card" ref={(el) => (observerRefs.current[8] = el)}>
              <div className="landing-step-number">3</div>
              <h3>Plan Personalizado</h3>
              <p>Entregamos reporte con estrategia, números y pasos accionables.</p>
            </div>
            <div className="landing-step-card" ref={(el) => (observerRefs.current[9] = el)}>
              <div className="landing-step-number">4</div>
              <h3>Implementación</h3>
              <p>Abrimos PPR, invertimos fondos, y te acompañamos en revisiones anuales.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="simulador" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Herramienta Interactiva</span>
            <h2>Simulador de Retiro</h2>
            <p>Ajusta los parámetros y ve tu proyección en tiempo real</p>
          </div>
          <div className="landing-calculator-container">
            <div className="landing-calculator-grid">
              <div className="landing-calculator-inputs">
                <div className="landing-slider-group">
                  <div className="landing-slider-label">
                    <span>Edad Actual</span>
                    <span>{calcInputs.age} años</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={calcInputs.age}
                    onChange={(e) => setCalcInputs({ ...calcInputs, age: parseInt(e.target.value) })}
                  />
                </div>

                <div className="landing-slider-group">
                  <div className="landing-slider-label">
                    <span>Ingreso Anual</span>
                    <span>${calcInputs.salary.toLocaleString('es-MX')}</span>
                  </div>
                  <input
                    type="range"
                    min="30000"
                    max="500000"
                    step="10000"
                    value={calcInputs.salary}
                    onChange={(e) => setCalcInputs({ ...calcInputs, salary: parseInt(e.target.value) })}
                  />
                </div>

                <div className="landing-slider-group">
                  <div className="landing-slider-label">
                    <span>Años hasta Retiro</span>
                    <span>{calcInputs.years} años</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={calcInputs.years}
                    onChange={(e) => setCalcInputs({ ...calcInputs, years: parseInt(e.target.value) })}
                  />
                </div>

                <div className="landing-slider-group">
                  <div className="landing-slider-label">
                    <span>Crecimiento Anual (Fondos)</span>
                    <span>{calcInputs.growth}%</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    value={calcInputs.growth}
                    onChange={(e) => setCalcInputs({ ...calcInputs, growth: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="landing-calculator-results">
                <div className="landing-result-item">
                  <div className="landing-result-label">Aportación Mensual (5% salario)</div>
                  <div className="landing-result-value">${parseFloat(results.monthlyContribution).toLocaleString('es-MX')}</div>
                </div>
                <div className="landing-result-item">
                  <div className="landing-result-label">Total Aportado</div>
                  <div className="landing-result-value">${parseFloat(results.totalContributed).toLocaleString('es-MX')}</div>
                </div>
                <div className="landing-result-item">
                  <div className="landing-result-label">Proyección de Balance</div>
                  <div className="landing-result-value" style={{ color: '#10B981' }}>
                    ${parseFloat(results.projectedBalance).toLocaleString('es-MX')}
                  </div>
                </div>
                <div className="landing-result-item">
                  <div className="landing-result-label">Ahorro Fiscal Anual (35%)</div>
                  <div className="landing-result-value" style={{ color: '#F59E0B' }}>
                    ${parseFloat(results.taxSavings).toLocaleString('es-MX')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Historias Reales</span>
            <h2>Lo que Dicen Nuestros Clientes</h2>
          </div>
          <div className="landing-testimonials-grid">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="landing-testimonial-card" ref={(el) => (observerRefs.current[10 + idx] = el)}>
                <div className="landing-stars">{'⭐'.repeat(testimonial.stars)}</div>
                <p className="landing-testimonial-text">"{testimonial.text}"</p>
                <div className="landing-testimonial-author">
                  <div className="landing-author-avatar">{testimonial.initials}</div>
                  <div className="landing-author-info">
                    <h4>{testimonial.name}</h4>
                    <p>{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="landing-section landing-section-gray landing-section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="landing-section-header">
            <span className="landing-section-subtitle">Dudas Comunes</span>
            <h2>Preguntas Frecuentes</h2>
          </div>
          <div className="landing-faq-container">
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                className={`landing-faq-item ${openFaqIndex === idx ? 'open' : ''}`}
                ref={(el) => (observerRefs.current[13 + idx] = el)}
              >
                <div
                  className="landing-faq-question"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                >
                  <span>{item.question}</span>
                  <span className="landing-faq-toggle">▼</span>
                </div>
                <div className="landing-faq-answer">{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-section landing-section-light landing-section-padding">
        <div className="landing-cta-section">
          <div className="landing-cta-content">
            <h2>Asegura tu Retiro Hoy</h2>
            <p>
              No esperes más. Con tu situación fiscal actual estás dejando dinero en la mesa.
              Agenda una consulta gratis de 30 minutos y descubre cuánto podrías ahorrar.
            </p>
            <button className="landing-btn landing-btn-primary" onClick={() => scrollToSection('contacto')}>
              Agendar Consulta Gratis
            </button>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contacto" className="landing-section landing-section-light landing-section-padding">
        <div className="landing-contact-form-container">
          <h2>Cuéntanos tu Situación</h2>
          {formStatus === 'success' && (
            <div className="landing-form-success-message">
              ¡Gracias! Nos pondremos en contacto pronto.
            </div>
          )}
          {formStatus === 'error' && (
            <div className="landing-form-error-message">
              Hubo un error. Por favor intenta nuevamente.
            </div>
          )}
          <form onSubmit={handleFormSubmit}>
            <div className="landing-form-group">
              <label>Nombre</label>
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="landing-form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="landing-form-group">
              <label>Teléfono</label>
              <input
                type="tel"
                placeholder="+52 55 1234 5678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="landing-form-group">
              <label>Mensaje</label>
              <textarea
                placeholder="Cuéntanos sobre tu situación fiscal y metas de retiro..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              ></textarea>
            </div>
            <div className="landing-form-checkbox">
              <input type="checkbox" id="terms" required />
              <label htmlFor="terms">Acepto términos y política de privacidad</label>
            </div>
            <button
              type="submit"
              className="landing-form-submit"
              disabled={formStatus === 'loading'}
            >
              {formStatus === 'loading' ? 'Enviando...' : 'Enviar Consulta'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-column">
            <Logo height={55} variant="light" />
            <p style={{marginTop: '12px'}}>
              Estrategia fiscal integral + PPR + Educación financiera para tu retiro premium.
            </p>
          </div>
          <div className="landing-footer-column">
            <h3>Links</h3>
            <a href="#servicios">Servicios</a>
            <a href="#como-funciona">Cómo Funciona</a>
            <a href="#faq">FAQ</a>
            <a href="#contacto">Contacto</a>
          </div>
          <div className="landing-footer-column">
            <h3>Síguenos</h3>
            <div className="landing-social-links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📷</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">💼</a>
              <a href="https://wa.me/5215551234567" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; 2026 Finance SCool. Todos los derechos reservados. | Regulado por CNBV</p>
        </div>
      </footer>

      {/* WhatsApp Button */}
      <a
        href="https://wa.me/5215551234567?text=Hola%20Finance%20SCool%2C%20quiero%20agendar%20una%20consulta"
        target="_blank"
        rel="noopener noreferrer"
        className="landing-whatsapp-button"
        aria-label="WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    </>
  );
}
