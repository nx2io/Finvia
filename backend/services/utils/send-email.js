import { emailTemplates } from './email-templates.js';
import dayjs from 'dayjs';
import { mailtrapClient, sender } from '../../config/mailtrap.js'; // مسار صحيح حسب مشروعك

export const sendReminderEmail = async ({ to, type, subscription }) => {
  if (!to || !type) throw new Error('Missing required parameters');

  const template = emailTemplates.find((t) => t.label === type);

  if (!template) throw new Error('Invalid email type');

  const mailInfo = {
    userName: subscription.user.name,
    subscriptionName: subscription.name,
    renewalDate: dayjs(subscription.renewalDate).format('MMM D, YYYY'),
    planName: subscription.name,
    price: `${subscription.currency} ${subscription.price} (${subscription.frequency})`,
    paymentMethod: subscription.paymentMethod,
  };

  const message = template.generateBody(mailInfo);
  const subject = template.generateSubject(mailInfo);

  try {
    const response = await mailtrapClient.send({
      from: sender,
      to: [{ email: to }],
      subject: subject,
      html: message,
    });

    console.log("Mailtrap email sent:", response);
  } catch (error) {
    console.error("Error sending email via Mailtrap:", error);
  }
};
