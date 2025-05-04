import mongoose from 'mongoose';

const beneficiarySchema = new mongoose.Schema({
  beneficiaryName: {
    type: String,
    required: true,
    trim: true
  },
  beneficiaryEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
  },
  beneficiaryPhone: {
    countryCode: { type: String, required: true },
    number: { type: String, required: true }
  }
}, { _id: false });


const bankAccountSchema = new mongoose.Schema({
  accountHolderName: { type: String, required: true, trim: true },
  iban: {
    type: String,
    required: true,
    match: [/^[A-Z0-9]{15,34}$/, 'Invalid IBAN format']
  },
  bankAccountNumber: {
    type: String,
    required: true,
    match: [/^\d{6,20}$/, 'Invalid account number']
  },
  bankName: { type: String, required: true, trim: true },
  bankCountry: { type: String, required: true, trim: true },
  swiftCode: { type: String, trim: true },
  type: {
    type: String,
    enum: ['local', 'international', 'digital'],
    default: 'local'
  },
  isDefault: { type: Boolean, default: false }
}, { _id: false });


const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'User Name is required'],
    trim: true,
    minLength: 2,
    maxLength: 70,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minLength: 2,
    maxLength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
  },
  phone: {
    countryCode: { type: String, required: true },
    number: { type: String, required: true }
  },
  nationality: { type: String, required: true },
  gender: { type: String, required: true },
  birthDate: { type: Date, required: true },

  password: {
    type: String,
    required: false,
    minLength: 6,
  },
  avatar: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },

  // twoFactorAuthentication: {
  //   isEnabled: { type: Boolean, default: false },
  //   secret: { type: String }
  // },

  kyc: {
    documentType: { type: String, enum: ['ID', 'Passport'], required: true },
    documentNumber: { type: String, required: true },
    frontImage: { type: String, required: true },
    backImage: { type: String }
  },
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },

  verificationToken: String,
  verificationTokenSentAt: Date,
  verificationTokenExpiresAt: Date,

  resetPasswordToken: String,
  resetPasswordExpiresAt: Date,

  beneficiaries: [beneficiarySchema],

  bankAccounts: [bankAccountSchema],

  walletCreationTimestamp: { type: Date, default: Date.now },
  lastUpdateTimestamp: { type: Date, default: Date.now },
  lastLoginTimestamp: { type: Date },
  lastActivityTimestamp: { type: Date }

}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
