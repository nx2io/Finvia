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
