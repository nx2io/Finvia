import axios from 'axios';

const baseUrl = 'http://localhost:5500';

// 🔐 توكنات مخصصة لكل مستخدم
const tokens = {
  "per.nx.iq@gmail.com": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODFhZDk5MjIzMGJiYWM3MzUyZThjODciLCJpcCI6Ijo6MSIsImlhdCI6MTc0OTgyNjA3NCwiZXhwIjoxNzUwNDMwODc0fQ.0WRG8NlMmaZiKUrif7H2xXkdHOTW5rNsA7if2kPNP3U",
  "work.nx.iq@gmail.com": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODM2MTI0Njg4ODk2MTgwY2ZkNDNkOWIiLCJpcCI6Ijo6MSIsImlhdCI6MTc0OTgyNjEwMywiZXhwIjoxNzUwNDMwOTAzfQ.bss0Az0jaqKp4rluGE1rGf5H1XSEU7Uda08bkErI4hM"
};

// 📦 البيانات المشتركة
const createPayload = (recipientEmail) => ({
  recipientIdentifier: recipientEmail,
  amount: 8.00,
  currency: "SAR",
  note: "Payment for services",
});

// 🚀 إرسال طلب واحد
const sendP2PTransfer = async (data, index, headers) => {
  try {
    const res = await axios.post(`${baseUrl}/v1/transactions/p2p-transfer`, data, { headers });
    console.log(`✅ Request #${index + 1} to ${data.recipientIdentifier}:`, res.data);
  } catch (err) {
    console.error(`❌ Request #${index + 1} to ${data.recipientIdentifier} failed:`, err.response?.data || err.message);
  }
};

// 🧠 تنفيذ كل الطلبات
const run = async () => {
  const recipients = Object.keys(tokens); // ['per.nx.iq@gmail.com', 'work.nx.iq@gmail.com']
  const requests = [];

  recipients.forEach((email) => {
    const headers = {
      'Authorization': tokens[email],
      'Content-Type': 'application/json',
    };

    setInterval(async () => {
      for (let i = 0; i < 10; i++) {
        const payload = createPayload(email);
        requests.push(sendP2PTransfer(payload, i, headers));
      }
    }, 500);
  });

  await Promise.all(requests);
};

run();
