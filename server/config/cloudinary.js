const cloudinary = require('cloudinary').v2;

// Credenciales SIEMPRE por variables de entorno (CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Los valores por defecto son el
// cloud legado y deben eliminarse cuando estén configuradas en Railway.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dbowaer8j',
  api_key: process.env.CLOUDINARY_API_KEY || '997518445624243',
  api_secret: process.env.CLOUDINARY_API_SECRET || '534PTf4UBCkUXl2J15IkI2kNSD4',
});

module.exports = cloudinary;
