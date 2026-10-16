import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const API = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 3002}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const tokenFor = (role) =>
  jwt.sign({ id: 999, email: `${role}@test.local`, role }, JWT_SECRET, { expiresIn: '5m' });

const call = async (label, headers, query = '') => {
  const res = await fetch(`${API}/payments/audits${query}`, { headers });
  const body = await res.json().catch(() => ({}));
  const detail = res.ok
    ? `${body.audits?.length ?? 0} rows, total=${body.pagination?.total}, summary=${JSON.stringify(body.summary)}`
    : body.error;
  console.log(`${label}: ${res.status} - ${detail}`);
  return { status: res.status, body };
};

await call('No token          ', {});
await call('Customer token    ', { Authorization: `Bearer ${tokenFor('customer')}` });
await call('Admin token       ', { Authorization: `Bearer ${tokenFor('admin')}` });
await call('Super admin token ', { Authorization: `Bearer ${tokenFor('super_admin')}` });

console.log('\nFilters as super admin:');
const auth = { Authorization: `Bearer ${tokenFor('super_admin')}` };
await call('status=failed     ', auth, '?status=failed');
await call('source=webhook    ', auth, '?source=webhook');
await call('days=1            ', auth, '?days=1');
await call('search=retry      ', auth, '?search=retry-tester@example.com');
await call('paged limit=2     ', auth, '?limit=2&page=2');
