import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();

  // If already logged in, redirect
  if (user) {
    navigate('/admin/dashboard');
    return null;
  }

  // Wait for auth check before showing login form
  if (authLoading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>
        <p style={{ color:'#64748B' }}>Verificando sesión...</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Email o contraseña incorrectos');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('osvaldosuarezcruz@gmail.com');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .login-brand {
          flex: 1;
          background: linear-gradient(135deg, #003DA5 0%, #0067C5 50%, #0088E0 100%);
          color: #fff;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .login-brand::before {
          content: '';
          position: absolute;
          top: -30%;
          right: -20%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
          border-radius: 50%;
        }
        .login-brand::after {
          content: '';
          position: absolute;
          bottom: -20%;
          left: -10%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%);
          border-radius: 50%;
        }
        .login-brand-content {
          position: relative;
          z-index: 2;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        .login-brand-logo {
          margin-bottom: 48px;
        }
        .login-logo {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .login-logo span {
          color: #C9A84C;
        }
        .login-tagline {
          font-size: 1rem;
          opacity: 0.85;
          margin-bottom: 48px;
          font-weight: 300;
        }
        .login-features {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 48px;
        }
        .login-feature {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .login-feature-icon {
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.15);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .login-feature p {
          margin: 0;
          font-size: 0.95rem;
          opacity: 0.9;
          color: #fff;
        }
        .login-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.15);
        }
        .login-stat h3 {
          font-size: 1.6rem;
          font-weight: 800;
          margin-bottom: 2px;
          color: #C9A84C;
        }
        .login-stat p {
          font-size: 0.8rem;
          opacity: 0.7;
          margin: 0;
          color: #fff;
        }
        .login-form-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 48px 40px;
          background: #fff;
        }
        .login-form-container {
          width: 100%;
          max-width: 400px;
        }
        .login-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #64748B;
          font-size: 0.85rem;
          margin-bottom: 32px;
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
          padding: 0;
          transition: color 0.2s;
        }
        .login-back:hover {
          color: #003DA5;
        }
        .login-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .login-subtitle {
          color: #64748B;
          font-size: 0.9rem;
          margin-bottom: 32px;
          line-height: 1.5;
        }
        .login-error {
          padding: 12px 16px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          color: #DC2626;
          font-size: 0.9rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .login-input-group {
          margin-bottom: 20px;
        }
        .login-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }
        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input-icon {
          position: absolute;
          left: 14px;
          color: #94A3B8;
          pointer-events: none;
          z-index: 1;
        }
        .login-input {
          width: 100%;
          padding: 12px 14px 12px 44px;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          font-size: 0.95rem;
          font-family: inherit;
          transition: all 0.2s;
          outline: none;
          background: #F8FAFC;
          color: #0F172A;
          box-sizing: border-box;
        }
        .login-input:focus {
          border-color: #003DA5;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,61,165,0.1);
        }
        .login-input::placeholder {
          color: #94A3B8;
        }
        .login-eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          color: #94A3B8;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .login-eye-btn:hover {
          color: #003DA5;
        }
        .login-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          font-size: 0.85rem;
        }
        .login-remember {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748B;
          cursor: pointer;
        }
        .login-remember input {
          width: 16px;
          height: 16px;
          accent-color: #003DA5;
          cursor: pointer;
        }
        .login-forgot {
          color: #003DA5;
          text-decoration: none;
          font-weight: 500;
        }
        .login-forgot:hover {
          text-decoration: underline;
        }
        .login-submit {
          width: 100%;
          padding: 13px 24px;
          background: linear-gradient(135deg, #003DA5, #0067C5);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
          box-shadow: 0 4px 12px rgba(0,61,165,0.25);
        }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,61,165,0.35);
        }
        .login-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          gap: 12px;
          color: #94A3B8;
          font-size: 0.8rem;
        }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E2E8F0;
        }
        .login-demo {
          width: 100%;
          padding: 12px 24px;
          background: #F8FAFC;
          color: #334155;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .login-demo:hover {
          background: #EEF1F8;
          border-color: #003DA5;
          color: #003DA5;
        }
        .login-footer {
          margin-top: 32px;
          text-align: center;
          color: #94A3B8;
          font-size: 0.8rem;
        }
        .login-footer a {
          color: #003DA5;
          text-decoration: none;
        }
        @media (max-width: 900px) {
          .login-page {
            flex-direction: column;
          }
          .login-brand {
            padding: 32px 24px;
            min-height: auto;
          }
          .login-features {
            display: none;
          }
          .login-stats {
            display: none;
          }
          .login-tagline {
            margin-bottom: 0;
          }
          .login-form-side {
            padding: 32px 24px;
          }
        }
      `}</style>

      {/* Left - Branding */}
      <div className="login-brand">
        <div className="login-brand-content">
          <div className="login-brand-logo">
            <Logo height={140} variant="light" />
          </div>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">📊</div>
              <p>Optimización Fiscal Art. 151 LISR</p>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">🛡️</div>
              <p>PPR Prudential con fondos diversificados</p>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">📈</div>
              <p>Simulador interactivo de retiro</p>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">🤝</div>
              <p>Asesoría 1:1 personalizada</p>
            </div>
          </div>

          <div className="login-stats">
            <div className="login-stat">
              <h3>500+</h3>
              <p>Clientes</p>
            </div>
            <div className="login-stat">
              <h3>$198K</h3>
              <p>Deducción máx.</p>
            </div>
            <div className="login-stat">
              <h3>145+</h3>
              <p>Años Prudential</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="login-form-side">
        <div className="login-form-container">
          <button className="login-back" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Volver al inicio
          </button>

          <h2 className="login-title">Bienvenido de vuelta</h2>
          <p className="login-subtitle">Inicia sesión para acceder a tu panel de administración</p>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label className="login-label">Email</label>
              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />
                <input
                  type="email"
                  className="login-input"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-label">Contraseña</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input type="checkbox" /> Recordarme
              </label>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="login-divider">
            <span>o usa credenciales de prueba</span>
          </div>

          <button type="button" className="login-demo" onClick={fillDemo}>
            Llenar con cuenta demo
          </button>

          <div className="login-footer">
            <p>🔒 Conexión segura con encriptación SSL</p>
          </div>
        </div>
      </div>
    </div>
  );
}
