import { Order, OrderItem, Product, User, Size, FailedEmailModel } from '../models/index.js';
import { Op } from 'sequelize';
import Stock from '../models/Stock.js';
import { sendEmail } from '../services/emailService.js';
import { stripe, isStripeConfigured } from '../config/stripe.js';
import { buildOrderItems, totalsFromSubtotal, toCents } from '../utils/orderTotals.js';
import { recordPaymentAudit, describePaymentIntent } from '../services/paymentAuditService.js';

// Read at call-time so Render/dotenv env is always current (not frozen at import).
function getEmailFrom() {
  return process.env.RESEND_FROM || `"Charlie Bells" <orders@charlie-bells.com>`;
}
function getOwnerNotifyEmail() {
  const raw = process.env.ORDER_NOTIFICATION_EMAIL || process.env.GMAIL_USER || '';
  const email = String(raw).trim().replace(/^["']|["']$/g, '');
  return email || null;
}

// Create new order
const createOrder = async (req, res) => {
  try {
    console.log('Request body:', req.body); // Debug log
    
    const { 
      items, 
      shipping_address, 
      billing_address, 
      notes,
      transaction_id
    } = req.body;

    // Always bind order to the authenticated customer (JWT). Never trust body.user_id.
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Login required to place an order' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }
    
    if (!shipping_address) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    const { calculatedSubtotal, orderItems } = await buildOrderItems(items);
    const totals = await totalsFromSubtotal(calculatedSubtotal);
    const taxAmount = totals.taxAmount;
    const shippingAmount = totals.shippingAmount;
    const totalAmount = totals.totalAmount;
    const taxRatePercent = totals.taxRatePercent ?? 8.3;

    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }
    if (!transaction_id) {
      return res.status(400).json({ error: 'Card payment is required to complete this order' });
    }

    const existingPaidOrder = await Order.findOne({ where: { transaction_id } });
    if (existingPaidOrder) {
      return res.status(200).json({
        message: 'Order already created for this payment',
        order: existingPaidOrder,
      });
    }

    const stripePaymentIntent = await stripe.paymentIntents.retrieve(transaction_id, {
      expand: ['latest_charge'],
    });
    if (stripePaymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Card payment has not been completed' });
    }
    if (stripePaymentIntent.amount !== toCents(totalAmount)) {
      return res.status(400).json({ error: 'Paid amount does not match the order total' });
    }

    const order_number = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const order = await Order.create({
      order_number,
      user_id: userId,
      status: 'pending',
      subtotal: calculatedSubtotal,
      tax_amount: taxAmount,
      shipping_amount: shippingAmount,
      total_amount: totalAmount,
      currency: 'USD',
      shipping_address,
      billing_address,
      notes: notes || '',
      payment_method: 'stripe',
      payment_status: 'paid',
      transaction_id
    });

    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    await OrderItem.bulkCreate(orderItemsWithOrderId);

    const completeOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'image_url']
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    const auditedIntent = describePaymentIntent(stripePaymentIntent);
    const shippingName = `${shipping_address?.firstName || shipping_address?.first_name || ''} ${shipping_address?.lastName || shipping_address?.last_name || ''}`.trim();

    await recordPaymentAudit({
      ...auditedIntent,
      status: 'succeeded',
      source: 'order',
      order_id: order.id,
      order_number,
      // The order's own contact details are authoritative here.
      customer_email: shipping_address?.email || billing_address?.email || auditedIntent.customer_email || null,
      customer_name: shippingName || auditedIntent.customer_name || null,
      customer_phone: shipping_address?.phone || billing_address?.phone || auditedIntent.customer_phone || null,
    });

    // Send emails BEFORE responding so Render doesn't drop the work after the HTTP response.
    const emailFrom = getEmailFrom();
    const ownerEmail = getOwnerNotifyEmail();
    const customerEmail =
      shipping_address?.email ||
      billing_address?.email ||
      completeOrder?.user?.email ||
      null;

    let emailStatus = { customer: 'skipped', owner: 'skipped' };

    if (customerEmail) {
      const customerName =
        `${shipping_address?.firstName || shipping_address?.first_name || ''} ${shipping_address?.lastName || shipping_address?.last_name || ''}`.trim() ||
        completeOrder?.user?.first_name ||
        'Customer';
      const customerPhone = shipping_address?.phone || billing_address?.phone || 'N/A';
      const shippingLine = [
        shipping_address?.address,
        shipping_address?.city,
        shipping_address?.state,
        shipping_address?.zipCode || shipping_address?.zip_code,
        shipping_address?.country || 'United States',
      ].filter(Boolean).join(', ');

      const orderItemsHtml =
        completeOrder.order_items
          ?.map(
            (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.product_snapshot?.name || item.product?.name || 'Product'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${Number(item.unit_price || 0).toFixed(2)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${Number(item.total_price || 0).toFixed(2)}</td>
        </tr>
      `,
          )
          .join('') || '';

      const totalsHtml = `
              <div style="margin-top:16px;">
                <p style="margin:0;color:#374151;"><strong>Subtotal:</strong> $${Number(calculatedSubtotal).toFixed(2)}</p>
                <p style="margin:0;color:#374151;"><strong>Tax (${Number(taxRatePercent)}%):</strong> $${Number(taxAmount).toFixed(2)}</p>
                <p style="margin:0;color:#374151;"><strong>Shipping:</strong> ${Number(shippingAmount) === 0 ? 'FREE' : `$${Number(shippingAmount).toFixed(2)}`}</p>
                <p style="margin:4px 0 0;font-size:16px;color:#111827;"><strong>Total Paid:</strong> $${Number(totalAmount).toFixed(2)}</p>
              </div>`;

      const itemsTableHtml = `
              <table style="border-collapse:collapse;width:100%;max-width:620px;">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb;">Product</th>
                    <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #e5e7eb;">Qty</th>
                    <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #e5e7eb;">Price</th>
                    <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItemsHtml}
                </tbody>
              </table>`;

      const customerEmailHtml = `
            <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111827;">
              <h2 style="color:#111827;">Thank you for your order, ${customerName}!</h2>
              <p style="color:#4b5563;">We've received your order <strong>${order_number}</strong>. Our team will review and prepare it for shipping.</p>
              <h3 style="margin-top:18px;color:#111827;">Order Summary</h3>
              ${itemsTableHtml}
              ${totalsHtml}
              <h3 style="margin-top:18px;color:#111827;">Ship To</h3>
              <p style="margin:0;color:#374151;">${shippingLine || 'Address on file'}</p>
              <p style="margin-top:18px;color:#6b7280;font-size:13px;">
                This email was sent from Charlie Bells.
              </p>
            </div>
          `;

      const customerSubject = `Your Charlie Bells Order ${order_number}`;
      const ownerSubject = `New Charlie Bells Order ${order_number}`;
      const ownerName = 'Store Owner';
      const ownerEmailHtml = `
            <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111827;">
              <h2 style="color:#111827;">New order received</h2>
              <p style="color:#4b5563;">A new order has been placed with order number <strong>${order_number}</strong>.</p>
              <h3 style="margin-top:18px;color:#111827;">Customer details</h3>
              <p style="margin:0;color:#374151;"><strong>Name:</strong> ${customerName}</p>
              <p style="margin:0;color:#374151;"><strong>Email:</strong> ${customerEmail}</p>
              <p style="margin:0;color:#374151;"><strong>Phone:</strong> ${customerPhone}</p>
              <p style="margin:0;color:#374151;"><strong>Ship to:</strong> ${shippingLine || 'N/A'}</p>
              <p style="margin:0;color:#374151;"><strong>Payment:</strong> ${(completeOrder.payment_method || 'stripe').toUpperCase()} · ${completeOrder.payment_status || 'paid'}</p>
              ${completeOrder.transaction_id ? `<p style="margin:0;color:#374151;"><strong>Payment Intent:</strong> ${completeOrder.transaction_id}</p>` : ''}
              <h3 style="margin-top:18px;color:#111827;">Order summary</h3>
              ${itemsTableHtml}
              ${totalsHtml}
              <p style="margin-top:18px;color:#6b7280;font-size:13px;">
                This notification is from Charlie Bells.
              </p>
            </div>
          `;

      try {
        console.log(`📧 Sending order emails for ${order_number} → customer=${customerEmail}, owner=${ownerEmail || 'not configured'}`);

        const customerResult = await sendEmail({
          to: customerEmail,
          subject: customerSubject,
          html: customerEmailHtml,
          from: emailFrom,
        });

        if (customerResult.success) {
          emailStatus.customer = `sent:${customerResult.provider}`;
          console.log(`✅ Customer order email sent (${customerResult.provider})`);
        } else {
          emailStatus.customer = `failed:${customerResult.error || 'unknown'}`;
          console.error('❌ Customer email failed. Storing for retry...');
          try {
            await FailedEmailModel.create({
              order_id: completeOrder.id,
              customer_email: customerEmail,
              customer_name: customerName,
              order_number: order_number,
              email_subject: customerSubject,
              email_html: customerEmailHtml,
              retry_count: 0,
              status: 'pending',
              error_message: customerResult.error || 'Customer email send failed',
            });
          } catch (dbError) {
            console.error('❌ Failed to store customer email in database:', dbError.message);
          }
        }

        if (ownerEmail) {
          const ownerResult = await sendEmail({
            to: ownerEmail,
            subject: ownerSubject,
            html: ownerEmailHtml,
            from: emailFrom,
          });

          if (ownerResult.success) {
            emailStatus.owner = `sent:${ownerResult.provider}`;
            console.log(`✅ Owner order email sent (${ownerResult.provider})`);
          } else {
            emailStatus.owner = `failed:${ownerResult.error || 'unknown'}`;
            console.error('❌ Owner email failed. Storing for retry...');
            try {
              await FailedEmailModel.create({
                order_id: completeOrder.id,
                customer_email: ownerEmail,
                customer_name: ownerName,
                order_number: order_number,
                email_subject: ownerSubject,
                email_html: ownerEmailHtml,
                retry_count: 0,
                status: 'pending',
                error_message: ownerResult.error || 'Owner email send failed',
              });
            } catch (dbError) {
              console.error('❌ Failed to store owner email in database:', dbError.message);
            }
          }
        } else {
          emailStatus.owner = 'not_configured';
          console.warn('⚠️ ORDER_NOTIFICATION_EMAIL is not set — store owner was not notified');
        }
      } catch (emailError) {
        console.error('❌ Order email sending failed:', emailError.message);
        emailStatus.customer = emailStatus.customer.startsWith('sent') ? emailStatus.customer : `error:${emailError.message}`;
      }
    } else {
      console.warn('⚠️ Order created without a customer email — confirmation emails skipped');
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: completeOrder,
      email_status: emailStatus,
    });

  } catch (error) {
    console.error('Order creation error:', error);

    // A charged customer without an order needs to be visible in the audit trail.
    if (req.body?.transaction_id) {
      const failedShipping = req.body?.shipping_address || {};
      await recordPaymentAudit({
        payment_intent_id: req.body.transaction_id,
        status: 'order_failed',
        source: 'order',
        customer_email: failedShipping.email || null,
        customer_name: `${failedShipping.firstName || failedShipping.first_name || ''} ${failedShipping.lastName || failedShipping.last_name || ''}`.trim() || null,
        customer_phone: failedShipping.phone || null,
        error_message: error.message,
      });
    }

    if (!res.headersSent) {
      res.status(400).json({ error: error.message });
    }
  }
};
// Get order history for a user
const getUserOrders = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    
    const offset = (page - 1) * limit;
    const where = { user_id };
    
    if (status) {
      where.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'image_url']
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const order = await Order.findOne({
      where: { id, user_id },
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'image_url', 'description']
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update order status (Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_number } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = order.status;
    const updateData = { status };
    if (tracking_number) {
      updateData.tracking_number = tracking_number;
    }

    // If order is being marked as delivered, reduce stock
    if (status === 'delivered' && oldStatus !== 'delivered') {
      try {
        const orderItems = await OrderItem.findAll({
          where: { order_id: id },
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'stock_quantity']
          }]
        });

        for (const item of orderItems) {
          // Reduce stock from Products table (general stock)
          await Product.decrement('stock_quantity', {
            by: item.quantity,
            where: { id: item.product_id }
          });

          // Reduce stock from Stock table (size-specific stock)
          if (item.selected_size) {
            // Find the size record by size name
            const sizeRecord = await Size.findOne({
              where: { size: item.selected_size }
            });

            if (sizeRecord) {
              // Find the stock record for this product and size
              const stockRecord = await Stock.findOne({
                where: { 
                  product_id: item.product_id,
                  size_id: sizeRecord.id
                }
              });
              
              if (stockRecord) {
                const newQuantity = Math.max(0, stockRecord.quantity - item.quantity);
                await Stock.update(
                  { quantity: newQuantity },
                  { where: { id: stockRecord.id } }
                );
                console.log(`Stock reduced for product ${item.product_id}, size ${item.selected_size}: ${stockRecord.quantity} -> ${newQuantity}`);
              } else {
                console.warn(`No stock record found for product ${item.product_id}, size ${item.selected_size}`);
              }
            } else {
              console.warn(`Size not found: ${item.selected_size}`);
            }
          } else {
            console.warn(`No selected size for order item ${item.id}`);
          }
        }

        console.log(`Stock reduced for order ${id} - status changed to delivered`);
      } catch (stockError) {
        console.error('Error reducing stock:', stockError);
        // Continue with order status update even if stock reduction fails
      }
    }

    await order.update(updateData);

    const updatedOrder = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'image_url']
          }]
        }
      ]
    });

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all orders (Admin only)
const getAllOrders = async (req, res) => {
  try {
    console.log('INFO [ORDERS/GET_ALL]: Starting orders fetch');
    const { page = 1, limit = 300, status } = req.query;
    
    console.log('INFO [ORDERS/GET_ALL]: Query params:', { page, limit, status });
    
    const offset = (page - 1) * limit;
    const where = {};
    
    if (status) {
      where.status = status;
    }

    console.log('INFO [ORDERS/GET_ALL]: Querying database');

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'price', 'image_url']
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    console.log('INFO [ORDERS/GET_ALL]: Found', count, 'orders');

    res.json({
      orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancel order (User can only cancel their own pending orders)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const order = await Order.findOne({
      where: { id, user_id, status: 'pending' },
      include: [{
        model: OrderItem,
        as: 'order_items'
      }]
    });

    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found or cannot be cancelled' 
      });
    }

    // Update order status
    await order.update({ status: 'cancelled' });

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Retry failed emails
const retryFailedEmails = async (req, res) => {
  try {
    const failedEmails = await FailedEmailModel.findAll({
      where: {
        status: 'pending',
        retry_count: { [Op.lt]: 5 },
      },
      limit: 10,
    });

    let successCount = 0;
    let failureCount = 0;

    for (const failedEmail of failedEmails) {
      const result = await sendEmail({
        to: failedEmail.customer_email,
        subject: failedEmail.email_subject,
        html: failedEmail.email_html,
        from: getEmailFrom(),
      });

      if (result.success) {
        await failedEmail.update({ status: 'sent', last_retry_at: new Date() });
        successCount++;
      } else {
        await failedEmail.update({
          retry_count: failedEmail.retry_count + 1,
          last_retry_at: new Date(),
          status: failedEmail.retry_count >= 4 ? 'failed' : 'pending',
          error_message: result.error || 'Retry failed',
        });
        failureCount++;
      }
    }

    res.json({
      message: 'Email retry completed',
      successCount,
      failureCount,
      totalProcessed: failedEmails.length,
    });
  } catch (error) {
    console.error('Retry failed emails error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get failed emails
const getFailedEmails = async (req, res) => {
  try {
    const failedEmails = await FailedEmailModel.findAll({
      order: [['id', 'DESC']],
      limit: 50,
    });

    res.json({
      failedEmails,
      total: failedEmails.length,
    });
  } catch (error) {
    console.error('Get failed emails error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Retry single email
const retrySingleEmail = async (req, res) => {
  try {
    const { emailId } = req.params;
    const failedEmail = await FailedEmailModel.findByPk(emailId);
    if (!failedEmail) {
      return res.status(404).json({ error: 'Failed email not found' });
    }

    const result = await sendEmail({
      to: failedEmail.customer_email,
      subject: failedEmail.email_subject,
      html: failedEmail.email_html,
      from: getEmailFrom(),
    });

    if (result.success) {
      await failedEmail.update({ status: 'sent', last_retry_at: new Date() });
    } else {
      await failedEmail.update({
        retry_count: failedEmail.retry_count + 1,
        last_retry_at: new Date(),
        status: failedEmail.retry_count >= 4 ? 'failed' : 'pending',
        error_message: result.error || 'Retry failed',
      });
    }

    res.json({
      success: result.success,
      message: result.success ? 'Email sent successfully' : 'Email still failed',
    });
  } catch (error) {
    console.error('Retry single email error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Admin orders report with optional custom date range + status filter.
 * Returns summary cards and a detailed order list for the selected period.
 */
const getOrdersReport = async (req, res) => {
  try {
    const { from, to, status, payment_status } = req.query;
    const where = {};

    if (from || to) {
      where.created_at = {};
      if (from) {
        const start = new Date(from);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ error: 'Invalid "from" date. Use YYYY-MM-DD.' });
        }
        start.setHours(0, 0, 0, 0);
        where.created_at[Op.gte] = start;
      }
      if (to) {
        const end = new Date(to);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ error: 'Invalid "to" date. Use YYYY-MM-DD.' });
        }
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
      if (from && to && new Date(from) > new Date(to)) {
        return res.status(400).json({ error: '"from" date cannot be after "to" date' });
      }
    }

    if (status) where.status = status;
    if (payment_status) where.payment_status = payment_status;

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'sku', 'image_url'],
          }],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const emptyBucket = () => ({ count: 0, revenue: 0 });
    const byStatus = {};
    const byPaymentStatus = {};

    let totalRevenue = 0;
    let totalTax = 0;
    let totalShipping = 0;
    let totalSubtotal = 0;
    let paidRevenue = 0;
    let itemsSold = 0;

    const rows = orders.map((order) => {
      const subtotal = Number(order.subtotal || 0);
      const tax = Number(order.tax_amount || 0);
      const shipping = Number(order.shipping_amount || 0);
      const total = Number(order.total_amount || 0);
      const itemCount = (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      totalSubtotal += subtotal;
      totalTax += tax;
      totalShipping += shipping;
      totalRevenue += total;
      itemsSold += itemCount;
      if (order.payment_status === 'paid') paidRevenue += total;

      if (!byStatus[order.status]) byStatus[order.status] = emptyBucket();
      byStatus[order.status].count += 1;
      byStatus[order.status].revenue += total;

      const payKey = order.payment_status || 'unknown';
      if (!byPaymentStatus[payKey]) byPaymentStatus[payKey] = emptyBucket();
      byPaymentStatus[payKey].count += 1;
      byPaymentStatus[payKey].revenue += total;

      const addr = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address || '{}')
        : (order.shipping_address || {});

      return {
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        transaction_id: order.transaction_id,
        customer_name: `${addr.firstName || addr.first_name || order.user?.first_name || ''} ${addr.lastName || addr.last_name || order.user?.last_name || ''}`.trim() || 'Guest',
        customer_email: addr.email || order.user?.email || null,
        customer_phone: addr.phone || null,
        item_count: itemCount,
        subtotal,
        tax_amount: tax,
        shipping_amount: shipping,
        total_amount: total,
        currency: order.currency || 'USD',
      };
    });

    const averageOrderValue = orders.length ? totalRevenue / orders.length : 0;

    res.json({
      filters: {
        from: from || null,
        to: to || null,
        status: status || null,
        payment_status: payment_status || null,
      },
      summary: {
        total_orders: orders.length,
        items_sold: itemsSold,
        subtotal: Math.round(totalSubtotal * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        shipping: Math.round(totalShipping * 100) / 100,
        revenue: Math.round(totalRevenue * 100) / 100,
        paid_revenue: Math.round(paidRevenue * 100) / 100,
        average_order_value: Math.round(averageOrderValue * 100) / 100,
        by_status: byStatus,
        by_payment_status: byPaymentStatus,
      },
      orders: rows,
    });
  } catch (error) {
    console.error('Orders report error:', error);
    res.status(500).json({ error: error.message || 'Unable to build orders report' });
  }
};

export {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  getOrdersReport,
  cancelOrder,
  retryFailedEmails,
  getFailedEmails,
  retrySingleEmail
};
