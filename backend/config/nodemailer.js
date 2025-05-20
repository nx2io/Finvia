import nodemailer from 'nodemailer';

export const accountEmail = '61sky07@gmail.com';
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // use SSL for secure connec
  auth: {
    user: accountEmail,
    pass: 'hpbd tasw xqtn dxrx',
  },
});

export default transporter;