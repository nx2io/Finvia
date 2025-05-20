// services/exchange-rate.js
import cron from 'node-cron';

import ExchangeRate from '../models/exchange-rate.model';
import logger from '../logger/winston.logger';
import { notifyOwner } from './notiva.js'; // سنصنع هذا بعد قليل

import { OPR_APP_KEY } from '../config/env';

const API_URL = `https://openexchangerates.org/api/latest.json?app_id=${OPR_APP_KEY}`;

let failureCount = 0;

async function fetchAndSaveRates(retries = 3) {
  try {
    const response = await fetch(API_URL, {
      headers: {
        'User-Agent': 'ExchangeRateService-Bun/1.0 (+https://yourdomain.com)',
      },
    });

    if (!response.ok) throw new Error(`API returned status ${response.status}`);

    const data = await response.json();
    const rates = data.rates;

    // 🟢 إنشاء سجل جديد بدل التحديث
    await new ExchangeRate({
      base: 'USD',
      rates: {
        AED: rates.AED,
        SAR: rates.SAR,
        USD: rates.USD,
        EUR: rates.EUR,
        CNY: rates.CNY,
      },
      fetchedAt: new Date(),
    }).save();

    failureCount = 0; // Reset failures
    logger.http('✅ [Bun] Exchange rates saved as new record');
    await notifyOwner('Exchange rates fetched and saved as new record.', true);
  } catch (err) {
    failureCount++;
    logger.error(`❌ [Bun] Failed to fetch rates. Attempt ${failureCount}/${retries}:`, err);

    if (failureCount >= retries) {
      logger.error(`🔔 Failed ${retries} times. Notifying owner...`);
      await notifyOwner( `Failed to fetch exchange rates ${retries} times in a row.`, false, retries );
      failureCount = 0; // Reset after notification
    } else {
      // Retry with a delay (5 seconds)
      setTimeout(() => fetchAndSaveRates(retries), 5000);
    }
  }
}

export function startExchangeRateService() {
  fetchAndSaveRates(); // عند بدء السيرفر
  cron.schedule('0 * * * *', () => fetchAndSaveRates()); // كل ساعة
}
