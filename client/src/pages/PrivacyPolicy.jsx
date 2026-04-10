import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#e0e0e0', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #1a2332' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Logo size={40} />
        </div>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: '1px solid #4fc3f7', color: '#4fc3f7', padding: '0.5rem 1.2rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Volver al inicio
        </button>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <h1 style={{ color: '#4fc3f7', fontSize: '2rem', marginBottom: '0.5rem' }}>Política de Privacidad</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>Última actualización: 9 de abril de 2026</p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>1. Información General</h2>
          <p style={{ lineHeight: 1.7 }}>
            <strong>Finance SCool</strong> ("nosotros", "nuestro" o "la aplicación") es una plataforma educativa especializada en
            Planes Personales de Retiro (PPR) y estrategias fiscales en México. Nos comprometemos a proteger la privacidad
            de nuestros usuarios y a manejar su información personal de manera responsable y transparente, en cumplimiento
            con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>2. Información que Recopilamos</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '0.8rem' }}>Podemos recopilar los siguientes tipos de información:</p>
          <ul style={{ lineHeight: 1.9, paddingLeft: '1.5rem' }}>
            <li><strong>Información de cuenta:</strong> nombre, correo electrónico y datos de autenticación cuando te registras o inicias sesión.</li>
            <li><strong>Datos de uso:</strong> información sobre cómo interactúas con la aplicación, páginas visitadas y funcionalidades utilizadas.</li>
            <li><strong>Datos de cálculos fiscales:</strong> información financiera que ingresas voluntariamente en nuestras herramientas de cálculo de ISR y PPR. Estos datos se procesan localmente y no se almacenan en nuestros servidores.</li>
            <li><strong>Información del dispositivo:</strong> tipo de navegador, sistema operativo y dirección IP con fines de seguridad y mejora del servicio.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>3. Uso de la Información</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '0.8rem' }}>Utilizamos la información recopilada para:</p>
          <ul style={{ lineHeight: 1.9, paddingLeft: '1.5rem' }}>
            <li>Proporcionar y mantener nuestros servicios educativos sobre finanzas personales y estrategias fiscales.</li>
            <li>Personalizar tu experiencia en la plataforma.</li>
            <li>Enviar comunicaciones relacionadas con el servicio (si has dado tu consentimiento).</li>
            <li>Mejorar la funcionalidad y el rendimiento de la aplicación.</li>
            <li>Garantizar la seguridad de tu cuenta y prevenir actividades fraudulentas.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>4. Compartición de Datos</h2>
          <p style={{ lineHeight: 1.7 }}>
            <strong>No vendemos, alquilamos ni compartimos tu información personal</strong> con terceros para fines comerciales.
            Podemos compartir información únicamente en los siguientes casos:
          </p>
          <ul style={{ lineHeight: 1.9, paddingLeft: '1.5rem' }}>
            <li>Con proveedores de servicios que nos ayudan a operar la plataforma (hosting, analytics), bajo estrictos acuerdos de confidencialidad.</li>
            <li>Cuando sea requerido por ley o por autoridades competentes.</li>
            <li>Para proteger nuestros derechos legales o la seguridad de nuestros usuarios.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>5. Seguridad de los Datos</h2>
          <p style={{ lineHeight: 1.7 }}>
            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información personal,
            incluyendo cifrado de datos en tránsito (HTTPS/TLS), autenticación segura con tokens JWT,
            y controles de acceso estrictos a nuestros sistemas.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>6. Tus Derechos (Derechos ARCO)</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '0.8rem' }}>
            De acuerdo con la LFPDPPP, tienes derecho a:
          </p>
          <ul style={{ lineHeight: 1.9, paddingLeft: '1.5rem' }}>
            <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre ti.</li>
            <li><strong>Rectificación:</strong> solicitar la corrección de tus datos si son inexactos.</li>
            <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos personales.</li>
            <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos para fines específicos.</li>
          </ul>
          <p style={{ lineHeight: 1.7, marginTop: '0.8rem' }}>
            Para ejercer cualquiera de estos derechos, contáctanos a: <strong>contacto@financescool.com</strong>
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>7. Cookies y Tecnologías Similares</h2>
          <p style={{ lineHeight: 1.7 }}>
            Utilizamos cookies y tecnologías similares para mejorar tu experiencia, recordar tus preferencias
            y analizar el uso de la plataforma. Puedes configurar tu navegador para rechazar cookies,
            aunque esto podría afectar algunas funcionalidades del servicio.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>8. Servicios de Terceros</h2>
          <p style={{ lineHeight: 1.7 }}>
            Nuestra aplicación puede utilizar servicios de terceros como Meta (Facebook), Supabase y Cloudinary.
            Cada uno de estos servicios tiene sus propias políticas de privacidad. Te recomendamos revisarlas
            para entender cómo manejan tu información.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>9. Menores de Edad</h2>
          <p style={{ lineHeight: 1.7 }}>
            Finance SCool no está dirigido a menores de 18 años. No recopilamos intencionalmente información
            personal de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos de inmediato.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>10. Cambios a esta Política</h2>
          <p style={{ lineHeight: 1.7 }}>
            Nos reservamos el derecho de actualizar esta política de privacidad en cualquier momento.
            Cualquier cambio será publicado en esta página con la fecha de actualización correspondiente.
            Te recomendamos revisar esta política periódicamente.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.8rem' }}>11. Contacto</h2>
          <p style={{ lineHeight: 1.7 }}>
            Si tienes preguntas o inquietudes sobre esta política de privacidad o sobre el manejo de tus datos personales,
            puedes contactarnos a través de:
          </p>
          <ul style={{ lineHeight: 1.9, paddingLeft: '1.5rem' }}>
            <li><strong>Email:</strong> contacto@financescool.com</li>
            <li><strong>Plataforma:</strong> Finance SCool</li>
          </ul>
        </section>

        <div style={{ borderTop: '1px solid #1a2332', paddingTop: '1.5rem', marginTop: '2rem', color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>
          © 2026 Finance SCool. Todos los derechos reservados.
        </div>
      </main>
    </div>
  );
}
