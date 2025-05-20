import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for adding a bank account
export const addBankAccountValidationRules = () => {
  return [
    body('accountHolderName')
      .notEmpty().withMessage('Account holder name is required')
      .trim(),

    body('iban')
      .notEmpty().withMessage('IBAN is required')
      .isIBAN().withMessage('Invalid IBAN format'),

    body('accountNumber')
      .notEmpty().withMessage('Account Number is required')
      .isNumeric().withMessage('Account Number must be numeric'),

    body('bankName')
      .notEmpty().withMessage('Bank name is required')
      .trim(),

    body('bankCountry')
      .notEmpty().withMessage('Bank country is required')
      .isISO31661Alpha2().withMessage('Bank country must be a valid ISO 3166-1 alpha-2 code')
      .trim(),

    body('currency')
      .notEmpty().withMessage('Currency is required')
      .isISO4217().withMessage('Invalid currency code'),

    body('swiftCode')
      .optional({ checkFalsy: true })
      .isBIC().withMessage('Invalid SWIFT/BIC code')
      .trim(),

    body('isDefault')
      .optional()
      .isBoolean().withMessage('isDefault must be a boolean'),
  ];
};

// Validation rules for updating user profile (example)
export const updateProfileValidationRules = () => {
  return [
    body('fullName').optional().isLength({ min: 2, max: 100 }).trim(),
    body('phone.countryCode').optional().trim(),
    body('phone.number').optional().trim(), // Add more specific phone validation if needed
    body('nationality').optional().trim(),
    body('birthDate').optional().isISO8601().toDate(),
    // Do not allow changing email/username/password here, use dedicated routes
  ];
};

// Validation rules for routes requiring a user ID parameter
export const userIdParamValidationRules = () => {
  return [
    param('userId').isMongoId().withMessage('Invalid User ID format'),
  ];
};

// You can add more specific validation rules for other user-related actions here
// e.g., KYC submission, preference updates, etc.

