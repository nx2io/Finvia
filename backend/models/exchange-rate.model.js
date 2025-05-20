import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema({
  base: {
    type: String,
    required: true,
    default: 'USD'
  },
  rates: {
    AED: { type: Number, required: true },
    SAR: { type: Number, required: true },
    USD: { type: Number, required: true },
    EUR: { type: Number, required: true },
    CNY: { type: Number, required: true }
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  }
});

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);

export default ExchangeRate;