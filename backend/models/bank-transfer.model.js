const mongoose = require('mongoose');

const bankTransferSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  targetCurrency: {
    type: String,
    enum: ['USD'],
    required: true
  },

  amountToBeWithdrawn: {
    type: Number,
    required: true,
    min: 1
  },

  fees: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  netAmount: {
    type: Number,
    required: true,
    min: 0
  },

  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },  

  referenceNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },

  notes: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    required: true,
    default: 'pending'
  },

  requestTimestamp: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now }

}, { timestamps: true });

bankTransferSchema.pre('save', function (next) {
  if (!this.isNew && ['completed', 'failed'].includes(this.status) && this.isModified()) {
    return next(new Error('Cannot modify a completed or failed transfer'));
  }

  // احسب المبلغ الصافي تلقائياً
  if (this.isModified('amountToBeWithdrawn') || this.isModified('fees')) {
    this.netAmount = this.amountToBeWithdrawn - this.fees;
  }

  next();
});

const BankTransfer = mongoose.model('BankTransfer', bankTransferSchema);

export default BankTransfer
