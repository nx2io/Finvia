const mongoose = require('mongoose');

const topupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivingWalletAddress: { type: String, required: true },
  amountReceivedInUSDT: { type: Number, required: true },
  screenshotOfBinanceTransfer: { type: String, required: true },
  transactionHashOrReferenceNumber: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Topup', topupSchema);