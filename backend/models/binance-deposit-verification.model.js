import mongoose from 'mongoose';

// Tracks the verification status of USDT deposits made via Binance
const binanceDepositVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Reference to the initial 'pending' DEPOSIT transaction created when user submits info
    depositTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true,
        unique: true, // Each verification attempt corresponds to one deposit transaction
        index: true
    },
    // Information provided by the user
    userProvidedInfo: {
        binanceTxId: { type: String, required: true, trim: true }, // Transaction hash from Binance
        amountUSDT: { type: Number, required: true },
        senderAddress: { type: String, trim: true }, // Optional: Sender's wallet address
        screenshotUrl: { type: String } // URL of the uploaded screenshot
    },
    // Status of the API verification process
    status: {
        type: String,
        required: true,
        enum: [
            'pending',        // Waiting for API check
            'processing',     // API check in progress
            'verified',       // API confirmed the transaction successfully
            'mismatch',       // API found transaction, but details (amount?) don't match
            'not_found',      // API could not find the transaction hash
            'api_error',      // Error communicating with Binance API
            'manual_review'   // Needs admin intervention
        ],
        default: 'pending',
        index: true
    },
    // Details received from the Binance API (if successful)
    apiResponseData: {
        type: mongoose.Schema.Types.Mixed // Store relevant data returned by Binance API
    },
    // Error details if verification failed
    failureReason: {
        type: String,
        trim: true
    },
    // Timestamps
    createdAt: { 
        type: Date, 
        default: Date.now, 
        immutable: true 
    },
    lastCheckedAt: { 
        type: Date 
    },
    verifiedAt: { // Timestamp when status becomes 'verified'
        type: Date 
    }

}, { timestamps: { createdAt: 'createdAt', updatedAt: 'lastCheckedAt' } });

// Indexes
binanceDepositVerificationSchema.index({ status: 1 });
binanceDepositVerificationSchema.index({ 'userProvidedInfo.binanceTxId': 1 });

// Pre-save hook to set verifiedAt timestamp
binanceDepositVerificationSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'verified' && !this.verifiedAt) {
        this.verifiedAt = new Date();
    }
    // Update the corresponding Transaction status based on verification outcome
    // This logic is better handled in the application layer after successful save
    // Example: if (this.status === 'verified') { Transaction.findByIdAndUpdate(this.depositTransactionId, { status: 'completed' }); }
    // Example: if (['mismatch', 'not_found', 'api_error'].includes(this.status)) { Transaction.findByIdAndUpdate(this.depositTransactionId, { status: 'failed', failureReason: this.failureReason }); }
    next();
});

const BinanceDepositVerification = mongoose.model('BinanceDepositVerification', binanceDepositVerificationSchema);

export default BinanceDepositVerification;

