/**
 * Correo para reportes del CRM — Nodemailer (Gmail app password).
 * Requiere EMAIL_USER y EMAIL_PASS en el entorno.
 */
const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER / EMAIL_PASS no configurados');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

async function sendMailWithPdf({ to, subject, text, filename, buffer }) {
  return getTransporter().sendMail({
    from: `"Incubadora S-COOL CRM" <${process.env.EMAIL_USER}>`,
    to, subject, text,
    attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
  });
}

async function sendMail({ to, subject, text, cc, replyTo }) {
  return getTransporter().sendMail({
    from: `"Incubadora S-COOL CRM" <${process.env.EMAIL_USER}>`,
    to, subject, text,
    ...(cc ? { cc } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
}

/* Transporter a partir de una config SMTP arbitraria (remitente configurable
   de cobranza: el correo de Flavio o un cobranza@dominio). */
function buildTransporter(smtp) {
  return nodemailer.createTransport({
    host: smtp.host || 'smtp.gmail.com',
    port: Number(smtp.port) || 465,
    secure: smtp.secure !== false,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

/* Envía usando una config SMTP dada (si trae user+pass); si no, cae al
   remitente por defecto (EMAIL_USER/EMAIL_PASS del entorno). */
async function sendMailVia(smtp, { from, to, cc, replyTo, subject, text }) {
  const usar = smtp && smtp.user && smtp.pass;
  const transport = usar ? buildTransporter(smtp) : getTransporter();
  const fromAddr = from || `"Incubadora S-COOL CRM" <${process.env.EMAIL_USER}>`;
  return transport.sendMail({
    from: fromAddr, to, subject, text,
    ...(cc ? { cc } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
}

module.exports = { sendMailWithPdf, sendMail, sendMailVia, buildTransporter };
