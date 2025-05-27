import { Router } from 'express';
import { query } from 'express-validator';

// Import controller
import { convertCurrency } from '../controllers/exchange.controller.js';

// Import validation error handler
import { handleValidationErrors } from '../validators/wallet.validator.js';

const exchangeRouter = Router();

// --- Currency Conversion Endpoint ---

// POST /v1/exchange/convert
// Converts an amount from one currency to another using latest cached exchange rates
exchangeRouter.get('/convert', [
  query('from').notEmpty().isIn(['USD', 'SAR', 'EUR', 'AED', 'CNY']).withMessage('Invalid source currency'),
  query('to').notEmpty().isIn(['USD', 'SAR', 'EUR', 'AED', 'CNY']).withMessage('Invalid target currency'),
  query('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number')
], handleValidationErrors, convertCurrency);

export default exchangeRouter;
