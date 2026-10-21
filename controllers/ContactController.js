import ContactMessage from '../models/ContactMessage.js';
import { sendEmail } from '../services/emailService.js';
import { getSettingMap } from '../services/storeContentSettingsService.js';

export const submitContact = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const order_number = String(req.body.order_number || '').trim() || null;
    const message = String(req.body.message || '').trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email.' });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ error: 'Please enter a message (at least 10 characters).' });
    }

    const row = await ContactMessage.create({
      name,
      email,
      order_number,
      message,
      status: 'new',
    });

    const settings = await getSettingMap(['contact_email']);
    const ownerEmail =
      (settings.contact_email || '').trim() ||
      (process.env.ORDER_NOTIFICATION_EMAIL || '').trim() ||
      (process.env.GMAIL_USER || '').trim();

    if (ownerEmail) {
      await sendEmail({
        to: ownerEmail,
        subject: `Contact form: ${name}${order_number ? ` (Order ${order_number})` : ''}`,
        html: `
          <h2>New contact message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Order #:</strong> ${escapeHtml(order_number || '—')}</p>
          <p><strong>Message:</strong></p>
          <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
          <p style="color:#666">Saved as contact_messages #${row.id}</p>
        `,
      }).catch((err) => console.warn('Contact notify email failed:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Thanks — your message was sent. We will get back to you soon.',
      id: row.id,
    });
  } catch (error) {
    console.error('Contact submit error:', error);
    res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
};

export const listContactMessages = async (req, res) => {
  try {
    const rows = await ContactMessage.findAll({
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    res.json({ messages: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateContactStatus = async (req, res) => {
  try {
    const row = await ContactMessage.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.status = req.body.status || row.status;
    await row.save();
    res.json({ message: row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
