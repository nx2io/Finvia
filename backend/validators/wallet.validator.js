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
    body('from').isString().isLength({max: 15 }).withMessage('Invalid Source Wallet ID format'),
    body('to').isString().isLength({max: 15 }).withMessage('Invalid Destination Wallet ID format'),
    body('amount').isNumeric().withMessage('Amount must be numeric').toFloat().isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').notEmpty().isIn(['USD', 'SAR', 'EUR']).withMessage('Invalid currency'), // Match source/destination currency?
    body('description').optional().isLength({ max: 200 }).trim(),
  ];
};

// Validation rules for routes requiring a wallet ID parameter
export const walletIdParamValidationRules = () => {
  return [
    param('walletId').isMongoId().withMessage('Invalid Wallet ID format'),
  ];
};

