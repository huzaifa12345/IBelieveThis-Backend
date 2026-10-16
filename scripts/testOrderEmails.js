import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from '../services/emailService.js';

const run = async () => {
  console.log('Email config check:');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'set' : 'MISSING');
  console.log('  RESEND_FROM:', process.env.RESEND_FROM || '(default onboarding@resend.dev)');
  console.log('  ORDER_NOTIFICATION_EMAIL:', process.env.ORDER_NOTIFICATION_EMAIL || '(falls back to GMAIL_USER)');
  console.log('  GMAIL_USER:', process.env.GMAIL_USER || 'MISSING');
  console.log('  GMAIL_PASS:', process.env.GMAIL_PASS ? 'set' : 'MISSING');

  const owner = process.env.ORDER_NOTIFICATION_EMAIL || process.env.GMAIL_USER;
  const resendOwner = 'musasuleman417@gmail.com';

  console.log('\n1) Resend account owner (should succeed via Resend):');
  const r1 = await sendEmail({
    to: resendOwner,
    subject: 'Charlie Bells — Resend path test',
    html: '<p>This email was sent through the Resend path.</p>',
  });
  console.log('   ', r1);

  console.log('\n2) Store owner inbox (Resend may fail → Gmail fallback):');
  const r2 = await sendEmail({
    to: owner,
    subject: 'Charlie Bells — Owner notification test',
    html: '<p>New-order owner notification path is working.</p><p>Subtotal / Tax / Shipping / Total will appear on real orders.</p>',
  });
  console.log('   ', r2);

  console.log('\n3) Customer-style recipient (same as owner for this test):');
  const r3 = await sendEmail({
    to: owner,
    subject: 'Charlie Bells — Customer confirmation test',
    html: '<p>Thank you for your order. Customer confirmation path is working.</p>',
  });
  console.log('   ', r3);

  const ok = r1.success || r2.success;
  console.log(ok ? '\n✅ At least one delivery path works.' : '\n❌ Both email paths failed.');
  process.exit(ok ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
