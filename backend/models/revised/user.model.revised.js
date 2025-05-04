import mongoose from 'mongoose';
import validator from 'validator'; // Using validator library for more robust validation

// Note: Sensitive data like document numbers should be encrypted at the application layer before saving.

const kycSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: ['ID', 'Passport'],
    required: true
  },
  documentNumber: { // SECURITY: Encrypt this field at the application layer before saving and decrypt upon retrieval when necessary.
    type: String,
    required: true,
    trim: true
  },
  frontImage: { // Store URL or path to the image
    type: String,
    required: true
  },
  backImage: { // Optional, store URL or path
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'resubmit_required'],
    default: 'pending'
  },
  rejectionReason: { // Optional reason if KYC is rejected
    type: String,
    trim: true
  },
  verifiedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false });

const bankAccountSchema = new mongoose.Schema({
  accountHolderName: { type: String, required: true, trim: true },
  iban: { // SECURITY: Encrypt this field at the application layer before saving and decrypt upon retrieval when necessary.
    type: String,
    required: true,
    validate: [validator.isIBAN, 'Invalid IBAN format']
  },
  bankName: { type: String, required: true, trim: true },
  bankCountry: { type: String, required: true, trim: true }, // Use ISO country codes?
  swiftCode: { // SECURITY: Encrypt this field if stored, especially if combined with IBAN.
    type: String,
    trim: true,
    validate: [validator.isBIC, 'Invalid SWIFT/BIC code']
  },
  isDefault: { type: Boolean, default: false },
  addedAt: { type: Date, default: Date.now }
  // Removed bankAccountNumber as IBAN usually suffices, reduces data duplication/risk
  // Removed 'type' as it can often be inferred or isn't strictly necessary for transfers
}, { _id: true }); // Give bank accounts their own IDs for easier reference

const twoFactorAuthSchema = new mongoose.Schema({
  isEnabled: { type: Boolean, default: false },
  secret: { type: String }, // SECURITY: Store this TOTP secret encrypted at rest. Ensure secure key management.
  method: { type: String, enum: ['sms', 'authenticator_app'], default: 'authenticator_app' }
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full Name is required'],
    trim: true,
    minLength: 2,
    maxLength: 100,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minLength: 3,
    maxLength: 30,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address'],
  },
  phone: {
    countryCode: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true } // Consider validation based on country code
  },
  password: { // SECURITY: Store only a strong hash (e.g., bcrypt) of the password. Implement hashing in the application layer before saving.
    type: String,
    required: true,
    minLength: 8, // Enforce stronger password
    select: false // Don't return password hash by default
  },
  avatarUrl: {
    type: String,
    validate: [validator.isURL, 'Invalid URL format'],
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },
  nationality: { type: String, required: true, trim: true }, // Use ISO country codes?
  birthDate: { type: Date, required: true },

  kyc: kycSchema,
  isKycVerified: { type: Boolean, default: false, index: true }, // Denormalized for quick checks

  twoFactorAuth: twoFactorAuthSchema,

  status: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended', 'banned', 'closed'],
    default: 'pending_verification',
    index: true
  },
  suspensionReason: { type: String, trim: true },
  banReason: { type: String, trim: true },

  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  isEmailVerified: { type: Boolean, default: false, index: true },

  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // Link to the user's current subscription plan
  subscription: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' }, // Reflects UserSubscription status
    expiresAt: { type: Date }
  },

  // Embedded bank accounts
  bankAccounts: [bankAccountSchema],

  // Reference to main wallet (sub-wallets might be separate or handled differently)
  mainWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },

  preferences: {
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  },

  lastLoginTimestamp: { type: Date },
  ipAddresses: [{ ip: String, timestamp: Date }] // Log IPs for security

}, { timestamps: true }); // Adds createdAt and updatedAt

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'phone.countryCode': 1, 'phone.number': 1 });
userSchema.index({ status: 1 });

// Pre-save hook for hashing password (implementation detail for application layer)
// userSchema.pre('save', async function(next) { ... });

// Method for password comparison (implementation detail for application layer)
// userSchema.methods.comparePassword = async function(candidatePassword) { ... };

const User = mongoose.model('User', userSchema);

export default User;

