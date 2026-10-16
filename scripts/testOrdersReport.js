import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';

const API = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 3002}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const token = jwt.sign(
  { id: 3, email: 'hamzahj342@gmail.com', role: 'super_admin' },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const get = async (path) => {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

const shipping = await get('/shipping');
console.log('GET /shipping:', shipping.status, shipping.body);

const report = await get('/orders/report?from=2026-01-01&to=2026-12-31');
console.log(
  'GET /orders/report:',
  report.status,
  report.body.summary
    ? `orders=${report.body.summary.total_orders} revenue=$${report.body.summary.revenue}`
    : report.body.error
);
