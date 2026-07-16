/**
 * PortalCliente — página pública donde el cliente final consulta sus
 * pólizas y descarga sus documentos con un enlace firmado (30 días)
 * que le comparte su asesor desde el CRM.
 */
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const ESTATUS = {
  en_tramite: { label: 'En trámite', bg: '#EDE9FE', text: '#6D28D9' },
  pendiente_pago: { label: 'Pendiente de pago', bg: '#FBF4E6', text: '#B97F1E' },
  pagada: { label: 'Vigente / Pagada', bg: '#EBF7F1', text: '#0E8A63' },
  cancelada: { label: 'Cancelada', bg: '#FBEFEF', text: '#C93A3A' },
};
const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const fecha = (d) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default function PortalCliente() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    if (!t) { setError('Enlace incompleto. Pide a tu asesor uno nuevo.'); return; }
    api.crmPortalData(t).then(setData).catch(e => setError(e.message));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F8', fontFamily: "'Archivo','Inter',sans-serif", color: '#16233B' }}>
      {/* Header navy */}
      <div style={{ background: 'linear-gradient(160deg,#051636,#06255C)', padding: '34px 20px 70px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: '#E8CFA6', fontWeight: 700 }}>Finance SCool</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 27, fontWeight: 600, margin: '10px 0 4px' }}>
          {data ? `Hola, ${data.cliente.nombre.split(' ')[0]}` : 'Portal del cliente'}
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.65)' }}>Tus pólizas y documentos, siempre a la mano</p>
      </div>

      <div style={{ maxWidth: 680, margin: '-40px auto 0', padding: '0 16px 50px' }}>
        {error && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 10px 30px -20px rgba(5,22,54,.4)' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
            <p style={{ margin: 0, fontSize: 14.5 }}>{error}</p>
          </div>
        )}
        {!data && !error && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 10px 30px -20px rgba(5,22,54,.4)' }}>Cargando...</div>
        )}
        {data && (
          <>
            {/* Pólizas */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '22px 22px 10px', boxShadow: '0 10px 30px -20px rgba(5,22,54,.4)', border: '1px solid rgba(11,27,51,.06)', marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 18, margin: '0 0 14px' }}>Mis pólizas</h2>
              {data.polizas.length === 0 && <p style={{ color: '#5B6B84', fontSize: 13.5 }}>Aún no tienes pólizas registradas.</p>}
              {data.polizas.map(p => {
                const s = ESTATUS[p.estatus] || ESTATUS.en_tramite;
                return (
                  <div key={p.id} style={{ border: '1px solid rgba(11,27,51,.09)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 15 }}>{p.plan || 'Póliza'}</b>
                      <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 700 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#5B6B84', marginTop: 4 }}>{p.poliza ? `No. ${p.poliza} · ` : ''}Prima {money(p.prima)} ({p.forma_pago})</div>
                    <div style={{ fontSize: 12.5, color: '#5B6B84' }}>
                      {p.suma_asegurada ? `Suma asegurada ${money(p.suma_asegurada)} · ` : ''}
                      {p.fecha_renovacion ? `Renueva el ${fecha(p.fecha_renovacion)}` : p.fecha_emision ? `Emitida el ${fecha(p.fecha_emision)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Documentos */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '22px 22px 10px', boxShadow: '0 10px 30px -20px rgba(5,22,54,.4)', border: '1px solid rgba(11,27,51,.06)', marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 18, margin: '0 0 4px' }}>Mis documentos</h2>
              <p style={{ fontSize: 12, color: '#8D9AB1', margin: '0 0 14px' }}>Los enlaces de descarga son seguros y expiran en 1 hora — recarga la página si alguno vence.</p>
              {data.archivos.length === 0 && <p style={{ color: '#5B6B84', fontSize: 13.5, paddingBottom: 12 }}>Aún no hay documentos en tu expediente.</p>}
              {data.archivos.map(f => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(11,27,51,.09)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, textDecoration: 'none', color: '#16233B' }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, wordBreak: 'break-all' }}>{f.nombre}</span>
                    <span style={{ fontSize: 11.5, color: '#8D9AB1', textTransform: 'capitalize' }}>{f.categoria} · {fecha(f.created_at)}</span>
                  </span>
                  <span style={{ color: '#003DA5', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>Descargar ↓</span>
                </a>
              ))}
            </div>

            {/* Asesor */}
            {data.asesor && (
              <div style={{ background: 'linear-gradient(160deg,#051636,#06255C)', borderRadius: 16, padding: '20px 22px', color: '#fff', boxShadow: '0 10px 30px -20px rgba(5,22,54,.5)' }}>
                <div style={{ fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: '#E8CFA6', fontWeight: 700, marginBottom: 6 }}>Tu asesor</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15.5 }}>{data.asesor.nombre}</b>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {data.asesor.telefono && (
                      <a href={`https://wa.me/${String(data.asesor.telefono).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                        style={{ background: '#25D366', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                    )}
                    {data.asesor.email && (
                      <a href={`mailto:${data.asesor.email}`} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,.25)' }}>
                        Correo
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#8D9AB1', marginTop: 22 }}>Enlace privado válido por 30 días · Finance SCool · Datos protegidos con cifrado</p>
          </>
        )}
      </div>
    </div>
  );
}
