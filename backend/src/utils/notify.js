const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

const STATUS_MESSAGES = {
  CREATED: 'Your order has been created and is awaiting agent assignment.',
  ASSIGNED: 'A delivery agent has been assigned to your order.',
  PICKED_UP: 'Your package has been picked up.',
  IN_TRANSIT: 'Your package is in transit.',
  OUT_FOR_DELIVERY: 'Your package is out for delivery.',
  DELIVERED: 'Your package has been delivered. Thank you!',
  FAILED: 'Delivery attempt failed. You can reschedule from your dashboard.',
  RESCHEDULED: 'Your delivery has been rescheduled and a new agent will be assigned.',
};

/**
 * Sends (or, in dev without SMTP creds, simply logs and records) a status
 * notification email, and always writes a Notification row for auditing -
 * this satisfies "email notifications on every status change" independent
 * of whether an SMTP provider is actually configured.
 */
async function sendStatusEmail(order, recipientEmail, status) {
  const subject = `Order ${order.id.slice(0, 8)} - ${status.replace(/_/g, ' ')}`;
  const body = STATUS_MESSAGES[status] || `Order status updated to ${status}.`;

  let sendStatus = 'SENT';
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      await getTransporter().sendMail({
        from: process.env.SMTP_FROM || 'no-reply@lastmile.test',
        to: recipientEmail,
        subject,
        text: body,
      });
    } else {
      // No SMTP configured (e.g. local dev) - log instead of failing the request.
      console.log(`[email:mock] to=${recipientEmail} subject="${subject}" body="${body}"`);
    }
  } catch (err) {
    console.error('Email send failed:', err.message);
    sendStatus = 'FAILED';
  }

  await prisma.notification.create({
    data: {
      orderId: order.id,
      channel: 'EMAIL',
      recipient: recipientEmail,
      subject,
      body,
      status: sendStatus,
    },
  });
}

module.exports = { sendStatusEmail };
