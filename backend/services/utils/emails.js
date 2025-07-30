import {
	PASSWORD_RESET_REQUEST_TEMPLATE,
	PASSWORD_RESET_SUCCESS_TEMPLATE,
	VERIFICATION_EMAIL_TEMPLATE,
} from "./email-templates.js";
import { mailtrapClient, sender } from "../../config/mailtrap.js";

export const sendVerificationEmail = async (email, verificationToken) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "تحقق من بريدك الإلكتروني",
			html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken),
			category: "التحقق من البريد الإلكتروني",
		});

		console.log("تم إرسال البريد الإلكتروني بنجاح", response);
	} catch (error) {
		console.error(`خطأ في إرسال التحقق`, error);

		throw new Error(`خطأ في إرسال البريد الإلكتروني للتحقق: ${error}`);
	}
};

export const sendWelcomeEmail = async (email, name) => {
	const recipient = [{ email }];
	const Name = name;

	const WELCOME_EMAIL_TEMPLATE = `
	<!DOCTYPE html>
	<html lang="ar">
	<head>
	  	<meta charset="UTF-8">
	  	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	  	<title>أهلاً بك في خدمتنا</title>
	  	<link rel="preconnect" href="https://fonts.googleapis.com">
  		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  		<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet">
	</head>
	<body style="font-family: 'Cairo', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
	    <h1 style="color: white; margin: 0;">مرحباً، ${Name}!</h1>
	  </div>
	  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
	    <p>نحن متحمسون لانضمامك إلينا. لنبدأ الآن!</p>
	    <p>إذا كان لديك أي استفسارات، لا تتردد في الاتصال بفريق الدعم لدينا.</p>
	    <p>مع أطيب التحيات،<br>فريق التطبيق</p>
	  </div>
	  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
	    <p>هذه رسالة آلية، يرجى عدم الرد على هذا البريد.</p>
	  </div>
	</body>
	</html>
	`;

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "مرحباً بك في AnimeRay!",
			html: WELCOME_EMAIL_TEMPLATE,
			category: "بريد الترحيب",
		});

		console.log("تم إرسال البريد الإلكتروني الترحيبي بنجاح", response);
	} catch (error) {
		console.error(`خطأ في إرسال البريد الإلكتروني الترحيبي`, error);

		throw new Error(`خطأ في إرسال البريد الإلكتروني الترحيبي: ${error}`);
	}
};

export const sendPasswordResetEmail = async (email, resetURL) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "إعادة تعيين كلمة المرور",
			html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL),
			category: "إعادة تعيين كلمة المرور",
		});
	} catch (error) {
		console.error(`خطأ في إرسال بريد إعادة تعيين كلمة المرور`, error);

		throw new Error(`خطأ في إرسال بريد إعادة تعيين كلمة المرور: ${error}`);
	}
};

export const sendResetSuccessEmail = async (email) => {
	const recipient = [{ email }];

	try {
		const response = await mailtrapClient.send({
			from: sender,
			to: recipient,
			subject: "إعادة تعيين كلمة المرور ناجحة",
			html: PASSWORD_RESET_SUCCESS_TEMPLATE,
			category: "إعادة تعيين كلمة المرور",
		});

		console.log("تم إرسال بريد إعادة تعيين كلمة المرور بنجاح", response);
	} catch (error) {
		console.error(`خطأ في إرسال البريد الإلكتروني لنجاح إعادة تعيين كلمة المرور`, error);

		throw new Error(`خطأ في إرسال البريد الإلكتروني لنجاح إعادة تعيين كلمة المرور: ${error}`);
	}
};
