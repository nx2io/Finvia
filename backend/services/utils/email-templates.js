export const VERIFICATION_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التحقق من البريد الإلكتروني</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap');
  </style>
</head>
<body dir="rtl" style="font-family: 'Cairo', sans-serif !important; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #005EFF, #2196F3); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">التحقق من البريد الإلكتروني</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>مرحبًا،</p>
    <p>شكرًا لتسجيلك! :</p>
    <div style="text-align: center; margin: 30px 0;">
      <a>{verificationCode}</span>
    </div>
    <p>أدخل هذا الرمز في صفحة التحقق لإكمال التسجيل.</p>
    <p>سينتهي هذا الرمز في غضون 15 دقيقة لأسباب أمنية.</p>
    <p>إذا لم تقم بإنشاء حساب معنا، يرجى تجاهل هذا البريد الإلكتروني.</p>
    <p>مع أطيب التحيات،<br>فريق AnimeRay</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_SUCCESS_TEMPLATE = `
<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تم إعادة تعيين كلمة المرور بنجاح</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap');
  </style>
</head>
<body dir="rtl" style="font-family: 'Cairo', sans-serif !important; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #005EFF, #2196F3); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">تم إعادة تعيين كلمة المرور بنجاح</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>مرحبًا،</p>
    <p>نحن نكتب لتأكيد أنه تم إعادة تعيين كلمة المرور بنجاح.</p>
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #005EFF; color: white; width: 50px; height: 50px; line-height: 50px; border-radius: 50%; display: inline-block; font-size: 30px;">
        ✓
      </div>
    </div>
    <p>إذا لم تقم ببدء عملية إعادة تعيين كلمة المرور هذه، يرجى الاتصال بفريق الدعم الخاص بنا على الفور.</p>
    <p>لأسباب أمنية، نوصي بما يلي:</p>
    <ul>
      <li>استخدم كلمة مرور قوية وفريدة</li>
      <li>قم بتمكين المصادقة الثنائية إذا كانت متوفرة</li>
      <li>تجنب استخدام نفس كلمة المرور عبر عدة مواقع</li>
    </ul>
    <p>شكرًا لمساعدتنا في الحفاظ على أمان حسابك.</p>
    <p>مع أطيب التحيات،<br>فريق AnimeRay</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
  </div>
</body>
</html>

`;

export const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap');
  </style>
</head>
<body dir="rtl" style="font-family: 'Cairo', sans-serif !important; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #005EFF, #2196F3); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">إعادة تعيين كلمة المرور</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>مرحبًا،</p>
    <p>لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. إذا لم تكن قد قمت بهذا الطلب، يرجى تجاهل هذا البريد الإلكتروني.</p>
    <p>لإعادة تعيين كلمة المرور، انقر على الزر أدناه:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{resetURL}" style="background-color: #005EFF; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">إعادة تعيين كلمة المرور</a>
    </div>
    <p>سينتهي هذا الرابط في غضون ساعة لأسباب أمنية.</p>
    <p>مع أطيب التحيات،<br>فريق AnimeRay</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>هذه رسالة تلقائية، يرجى عدم الرد على هذا البريد الإلكتروني.</p>
  </div>
</body>
</html>

`;



export const generateEmailTemplate = ({
  userName,
  subscriptionName,
  renewalDate,
  planName,
  price,
  paymentMethod,
  accountSettingsLink,
  supportLink,
  daysLeft,
}) => `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f7fa;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <tr>
            <td style="background-color: #4a90e2; text-align: center;">
                <p style="font-size: 54px; line-height: 54px; font-weight: 800;">SubDub</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 40px 30px;">                
                <p style="font-size: 16px; margin-bottom: 25px;">Hello <strong style="color: #4a90e2;">${userName}</strong>,</p>
                
                <p style="font-size: 16px; margin-bottom: 25px;">Your <strong>${subscriptionName}</strong> subscription is set to renew on <strong style="color: #4a90e2;">${renewalDate}</strong> (${daysLeft} days from today).</p>
                
                <table cellpadding="15" cellspacing="0" border="0" width="100%" style="background-color: #f0f7ff; border-radius: 10px; margin-bottom: 25px;">
                    <tr>
                        <td style="font-size: 16px; border-bottom: 1px solid #d0e3ff;">
                            <strong>Plan:</strong> ${planName}
                        </td>
                    </tr>
                    <tr>
                        <td style="font-size: 16px; border-bottom: 1px solid #d0e3ff;">
                            <strong>Price:</strong> ${price}
                        </td>
                    </tr>
                    <tr>
                        <td style="font-size: 16px;">
                            <strong>Payment Method:</strong> ${paymentMethod}
                        </td>
                    </tr>
                </table>
                
                <p style="font-size: 16px; margin-bottom: 25px;">If you'd like to make changes or cancel your subscription, please visit your <a href="${accountSettingsLink}" style="color: #4a90e2; text-decoration: none;">account settings</a> before the renewal date.</p>
                
                <p style="font-size: 16px; margin-top: 30px;">Need help? <a href="${supportLink}" style="color: #4a90e2; text-decoration: none;">Contact our support team</a> anytime.</p>
                
                <p style="font-size: 16px; margin-top: 30px;">
                    Best regards,<br>
                    <strong>The SubDub Team</strong>
                </p>
            </td>
        </tr>
        <tr>
            <td style="background-color: #f0f7ff; padding: 20px; text-align: center; font-size: 14px;">
                <p style="margin: 0 0 10px;">
                    SubDub Inc. | 123 Main St, Anytown, AN 12345
                </p>
                <p style="margin: 0;">
                    <a href="#" style="color: #4a90e2; text-decoration: none; margin: 0 10px;">Unsubscribe</a> | 
                    <a href="#" style="color: #4a90e2; text-decoration: none; margin: 0 10px;">Privacy Policy</a> | 
                    <a href="#" style="color: #4a90e2; text-decoration: none; margin: 0 10px;">Terms of Service</a>
                </p>
            </td>
        </tr>
    </table>
</div>
`;

export const emailTemplates = [
  {
    label: "7 days before reminder",
    generateSubject: (data) =>
      `📅 Reminder: Your ${data.subscriptionName} Subscription Renews in 7 Days!`,
    generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 7 }),
  },
  {
    label: "5 days before reminder",
    generateSubject: (data) =>
      `⏳ ${data.subscriptionName} Renews in 5 Days – Stay Subscribed!`,
    generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 5 }),
  },
  {
    label: "2 days before reminder",
    generateSubject: (data) =>
      `🚀 2 Days Left!  ${data.subscriptionName} Subscription Renewal`,
    generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 2 }),
  },
  {
    label: "1 days before reminder",
    generateSubject: (data) =>
      `⚡ Final Reminder: ${data.subscriptionName} Renews Tomorrow!`,
    generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 1 }),
  },
];