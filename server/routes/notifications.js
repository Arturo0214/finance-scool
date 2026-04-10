const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDB } = require('../models/database');
const router = express.Router();

router.use(verifyToken);

// GET /notifications — list notifications for current user (or all for superadmin)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    let query = db.from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Superadmin/admin sees all; others see only theirs
    if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
      query = query.eq('user_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const unreadCount = (data || []).filter(n => !n.is_read).length;
    res.json({ notifications: data || [], unreadCount });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// POST /notifications/:id/read — mark single as read
router.post('/:id/read', async (req, res) => {
  try {
    const db = getDB();
    await db.from('notifications').update({ is_read: true }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /notifications/mark-all-read — mark all as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const db = getDB();
    let query = db.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (!['superadmin', 'agencia', 'admin'].includes(req.user.role)) {
      query = query.eq('user_id', req.user.id);
    }
    await query;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// DELETE /notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.from('notifications').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;

// Helper: create notification (used by other routes)
module.exports.createNotification = async function createNotification({ type, message, data, link, userId }) {
  try {
    const db = getDB();
    await db.from('notifications').insert([{
      user_id: userId || null,
      type: type || 'info',
      message,
      data: data || {},
      link: link || null,
      is_read: false,
    }]);
  } catch (err) {
    console.error('Create notification error:', err);
  }
};
