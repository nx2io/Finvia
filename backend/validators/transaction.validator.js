import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for creating a bank transfer request
export const bankTransferValidationRules = () => {
  return [
    body('targetCurrency').isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid target currency'),
    body('amountToBeWithdrawn').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
    // Fees might be calculated server-side, but if sent from client, validate
    body('fees').optional().isNumeric().withMessage('Fees must be numeric').toFloat().isFloat({ min: 0 }).withMessage('Fees cannot be negative'),
    // netAmount should ideally be calculated server-side, not sent by client
    body('bankAccountId').isMongoId().withMessage('Invalid Bank Account ID format'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters').trim(),
  ];
};

// Validation rules for creating a top-up request (example)
export const topupValidationRules = () => {
  return [
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
    body('currency').isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'), // Adjust allowed currencies as needed
    body('paymentMethod').isIn(['credit_card', 'bank_transfer', 'crypto']).withMessage('Invalid payment method'), // Example methods
    // Add more validation based on payment method if necessary
  ];
};

// Validation rules for routes requiring a transaction ID parameter
export const transactionIdParamValidationRules = () => {
  return [
    param('transactionId').isMongoId().withMessage('Invalid Transaction ID format'),
  ];
};

// Add more validation rules for other transaction types (e.g., wallet-to-wallet)

