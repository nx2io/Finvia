import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    immutable: true
   },

  depositType: {
    type: String,
    enum: ['crypto', 'card', 'paypal'],
    required: true,
    immutable: true
  },

  cryptocurrencyUsed: {
    type: String,
    default: 'USDT'
  },

  fiatCurrency: {
    type: String,
    enum: ['USD', 'SAR', 'EUR'],
    required: true,
    immutable: true
  },

  amountInUSDT: {
    type: Number,
    required: true,
    immutable: true,
    min: 0
  },

  fees: {
    type: Number,
    required: true,
    immutable: true,
    min: 0
  },

  netAmount: {
    type: Number,
    required: true,
    immutable: true,
    min: 0
  },

  screenshotOfTransferReceipt: {
    type: String,
    required: true,
    immutable: true
  },

  senderWalletAddressOrName: {
    type: String,
    required: true,
    immutable: true
  },

  transactionReferenceNumber: {
    type: String,
    required: true,
    immutable: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    default: 'pending',
    immutable: true
  },

  timestamp: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });


transactionSchema.pre('validate', function (next) {
  if (this.isNew) {
    const baseAmount = this.amountInUSDT;

    const feeRates = {
      crypto: 0.01, // 1%
      card: 0.025,  // 2.5%
      paypal: 0.03  // 3%
    };

    const rate = feeRates[this.depositType] || 0;
    this.fees = parseFloat((baseAmount * rate).toFixed(2));
    this.netAmount = parseFloat((baseAmount - this.fees).toFixed(2));
  }

  next();
});


transactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    if (this.isModified() && ['approved', 'rejected'].includes(this.status)) {
      const err = new Error('Cannot modify approved or rejected transactions.');
      return next(err);
    }
  }
  next();
});

export default mongoose.model('Transaction', transactionSchema);
