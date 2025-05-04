import { body, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules for user registration
export const registerValidationRules = () => {
  return [
    body('fullName').notEmpty().withMessage('Full Name is required').isLength({ min: 2, max: 100 }).trim(),
    body('username').notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }).trim().toLowerCase()
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    // Basic phone validation - adjust as needed for specific country codes/formats
    body('phone.countryCode').notEmpty().withMessage('Country code is required').trim(),
    body('phone.number').notEmpty().withMessage('Phone number is required').trim(), //.isMobilePhone() // Consider using isMobilePhone with locale
    body('nationality').notEmpty().withMessage('Nationality is required').trim(),
    body('birthDate').notEmpty().withMessage('Birth date is required').isISO8601().toDate(),
  ];
};

// Validation rules for user login
export const loginValidationRules = () => {
  return [
    // Allow login with either email or username
    body('loginIdentifier').notEmpty().withMessage('Email or Username is required').trim(),
    body('password').notEmpty().withMessage('Password is required'),
  ];
};

