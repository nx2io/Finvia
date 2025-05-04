const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  walletNumber: {
    type: String,
    required: true,
    unique: true,
    length: 12,
    immutable: true, // cannot be changed after creation
    match: [/^\d{12}$/, 'Wallet number must be exactly 12 digits'],
  },

  currency: {
    type: String,
    enum: ['usd', 'sar', 'eur'],
    required: true,
    immutable: true, 
  },

  balance: {
    type: Number,
    default: 0,
  },

  type: {
    type: String,
    enum: ['main', 'sub'],
    default: 'main',
    required: true,
  },

  walletStatus: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    required: true,
    default: 'active'
  },

  dateOfCreation: {
    type: Date,
    default: Date.now
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
