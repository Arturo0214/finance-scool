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

module.exports = { sendMailWithPdf };
