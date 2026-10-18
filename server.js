import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { sequelize } from './models/index.js'; // Ensure this points to your db.js logic

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import uploadRoutes from './routes/upload.js';
import tempAdminRoutes from './routes/tempAdmin.js';
import reviewRoutes from './routes/reviewRoutes.js';
import sizeRoutes from './routes/sizeRoutes.js';
import stockRoutes from './routes/stock.js';
import websiteSetting from './routes/websiteSettings.js';
import paymentRoutes from './routes/payments.js';
import shippingRoutes from './routes/shipping.js';
import { handleStripeWebhook } from './controllers/PaymentController.js';
import { ensureShippingSettings } from './services/shippingSettingsService.js';
import { ensureFailedEmailTimestamps } from './scripts/fixFailedEmailTimestamps.js';
import { getSitemap, rebuildSitemap } from './controllers/SitemapController.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { refreshSitemapAsync } from './services/sitemapService.js';

const app = express();

const PORT = process.env.PORT || 10004; 

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(cors({ 
  origin: [
    'https://ibelievethis.us',
    'https://www.ibelievethis.us',
    'https://charlie-bells.vercel.app',
    'https://www.charlie-bells.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature']
}));
app.options(/(.*)/, cors());
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Stripe webhooks need the raw body for signature verification
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

 
app.use('/uploads', express.static('uploads'));

// Routes  
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/temp-admin', tempAdminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/sizes', sizeRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/website-settings', websiteSetting);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);

// Live SEO sitemap (DB-driven — new products appear automatically)
app.get('/sitemap.xml', getSitemap);
app.get('/api/sitemap.xml', getSitemap);
app.post('/api/sitemap/rebuild', authenticateToken, requireAdmin, rebuildSitemap);

// Health check endpoint (Deployment verify karne ke liye best hai)
app.get('/api/health', (req, res) => {
  const resendFrom = process.env.RESEND_FROM || '';
  const resendKey = process.env.RESEND_API_KEY || '';
  const ownerRaw = (process.env.ORDER_NOTIFICATION_EMAIL || process.env.GMAIL_USER || '').trim();
  const ownerHint = ownerRaw.includes('@')
    ? `${ownerRaw.slice(0, 3)}***@${ownerRaw.split('@')[1]}`
    : null;
  res.json({
    status: 'OK',
    message: 'IBelieveThis E-commerce API is running',
    timestamp: new Date().toISOString(),
    email: {
      resend_key: Boolean(resendKey),
      resend_key_suffix: resendKey ? resendKey.slice(-6) : null,
      resend_from: resendFrom || null,
      resend_testing_mode: /onboarding@resend\.dev/i.test(resendFrom) || !resendFrom,
      gmail_smtp: Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS),
      owner_notify: Boolean(ownerRaw),
      owner_email_hint: ownerHint,
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database sync and server start
const startServer = async () => {
  try {
    // 1. Connection check
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Normalize failed_emails timestamps BEFORE sync({ alter }) — otherwise
    // Sequelize tries ADD COLUMN created_at NOT NULL and crashes on existing rows.
    // Safe when table is missing (fresh Render DB) — sync creates it.
    await ensureFailedEmailTimestamps();
    console.log('Failed email table timestamps ready.');

    // Create / alter tables FIRST — fresh DBs have no website_settings yet
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully. Tables are ready!');

    // Seed defaults only after tables exist
    await ensureShippingSettings();
    console.log('Shipping settings ready.');

    // Warm sitemap file on boot so Frontend/public stays in sync for local/static hosts
    refreshSitemapAsync();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1); // Error ki surat mein process band kar dein
  }
};

startServer();