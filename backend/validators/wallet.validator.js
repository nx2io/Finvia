import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for creating a wallet (if applicable, often created with user)
// export const createWalletValidationRules = () => { ... };

// Validation rules for transferring funds between wallets (example)
export const walletTransferValidationRules = () => {
  return [
    body('recipientWalletId').isMongoId().withMessage('Invalid Recipient Wallet ID format'),
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').notEmpty().withMessage('Currency is required').isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'), // Adjust allowed currencies
    body('description').optional().isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters').trim(),
  ];
};

// Validation rules for routes requiring a wallet ID parameter
export const walletIdParamValidationRules = () => {
  return [
    param('walletId').isMongoId().withMessage('Invalid Wallet ID format'),
  ];
};

// Add more validation rules for other wallet actions as needed

