import models from '../models/index.js';

import { getOrSetCache } from '../services/utils/cache.js';


/**
 * POST /v1/exchange/convert
 * @desc Convert an amount from one currency to another based on latest exchange rates
 * @access Private (authentication assumed globally handled)
 */
export async function convertCurrency(req, res) {
  try {
    // Destructure input from request body
    const { from, to, amount } = req.query;

    // Validate required parameters
    if (!from || !to || !amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Invalid parameters' });
    }

    // Attempt to retrieve latest exchange rates from cache or fallback to DB
    const data = await getOrSetCache('exchange_rates_latest', async () => {
      // Fetch the most recent exchange rate document
      const latest = await models.ExchangeRate.findOne().sort({ fetchedAt: -1 }).lean();
      if (!latest) throw new Error('No exchange rates found');
      return latest;
    });

    const { base, rates } = data;

    // Convert amount to base currency if needed
    const amountInBase = from === base
      ? amount
      : amount / rates[from];

    // Convert base amount to target currency
    const convertedAmount = to === base
      ? amountInBase
      : amountInBase * rates[to];

    // Return result with conversion details
    return res.status(200).json({
      from,
      to,
      originalAmount: amount,
      convertedAmount,
      rateUsed: to === base ? 1 / rates[from] : (from === base ? rates[to] : rates[to] / rates[from]),
    });

  } catch (error) {
    console.error('Currency conversion error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
