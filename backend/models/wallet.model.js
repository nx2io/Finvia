import mongoose from 'mongoose';

// Defines the structure for sub-wallets within a main wallet account
const subWalletSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true, 
        maxLength: 50 
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: 0
        // Consider using mongoose-decimal128 for precise currency handling
    },
    // currency field is inherited from the main wallet
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, { _id: true }); // Each sub-wallet gets its own ID

const walletSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true, 
        unique: true // Assuming one main wallet per user for this core model
    },
    // Wallet number might be better generated and less guessable
    walletNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
        // Consider a more secure, potentially non-sequential format
        // Example: Use a UUID or a combination of user ID hash + random string
        // Removed length and digit match constraints for flexibility
    },
    // Primary currency for the wallet (e.g., USD)
    primaryCurrency: {
        type: String,
        enum: ['USD', 'SAR', 'EUR'], // Define allowed currencies
        required: true,
        default: 'USD', // Default to USD as per requirement
        immutable: true // Currency usually doesn't change once set
    },
    // Main balance in the primary currency
    mainBalance: {
        type: Number,
        required: true,
        default: 0,
        min: 0
        // Consider using mongoose-decimal128 for precise currency handling
    },
    // Array to hold sub-wallets for internal fund segregation
    subWallets: [subWalletSchema],
    
    // Status of the main wallet
    status: {
        type: String,
        enum: ['active', 'suspended', 'frozen', 'closed'],
        required: true,
        default: 'active',
        index: true
    },
    // Reason for suspension or freeze
    statusReason: {
        type: String,
        trim: true
    },
    // Security features like transaction limits (can be overridden by subscription)
    dailyTransactionLimit: { type: Number, default: 1000 }, // Example limit
    monthlyTransactionLimit: { type: Number, default: 10000 }, // Example limit

    // Timestamps
    createdAt: { 
        type: Date, 
        default: Date.now, 
        immutable: true 
    },
    lastUpdatedAt: { 
        type: Date, 
        default: Date.now 
    }

}, { timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdatedAt' } });

// Index for faster user wallet lookups
walletSchema.index({ userId: 1 });

// Pre-save hook to update lastUpdatedAt timestamp
walletSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.lastUpdatedAt = new Date();
    }
    next();
});

// Virtual property to calculate total balance (main + all sub-wallets)
walletSchema.virtual('totalBalance').get(function() {
    const subWalletTotal = this.subWallets.reduce((sum, sub) => sum + sub.balance, 0);
    return this.mainBalance + subWalletTotal;
});

// SECURITY: Ensure all balance updates (mainBalance, subWallets.balance) are performed atomically
// using operations like findOneAndUpdate with $inc. This prevents race conditions and ensures data integrity.
// Example (in application logic):
// await Wallet.findOneAndUpdate(
//   { _id: walletId, mainBalance: { $gte: amountToDecrement } }, // Ensure sufficient funds
//   { $inc: { mainBalance: -amountToDecrement } },
//   { new: true, session } // Use sessions for multi-document transactions if needed
// );

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;

