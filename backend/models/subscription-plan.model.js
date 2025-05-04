import mongoose from 'mongoose';

// Defines the available subscription plans offered by the wallet service
const subscriptionPlanSchema = new mongoose.Schema({
    planId: { // A unique identifier for the plan (e.g., 'free', 'premium_monthly')
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    name: { // User-friendly name of the plan
        type: String,
        required: [true, 'Subscription plan name is required'],
        trim: true,
        maxLength: 100
    },
    description: { // Detailed description of the plan's benefits
        type: String,
        trim: true,
        maxLength: 500
    },
    price: {
        type: Number,
        required: [true, 'Subscription plan price is required'],
        min: [0, 'Price cannot be negative']
        // Use mongoose-decimal128 for precision
    },
    currency: {
        type: String,
        required: true,
        enum: ['USD', 'SAR', 'EUR'], // Match wallet currencies
        default: 'USD'
    },
    billingCycle: {
        type: String,
        required: true,
        enum: ['monthly', 'yearly', 'free'] // Billing frequency
    },
    // --- Feature Limits & Fees --- (Examples, adjust as needed)
    transactionLimits: {
        dailyVolume: { type: Number, default: 1000 }, // Max total value per day
        monthlyVolume: { type: Number, default: 10000 }, // Max total value per month
        dailyCount: { type: Number, default: 50 }, // Max number of transactions per day
        maxSingleTransaction: { type: Number, default: 500 } // Max value for a single transaction
    },
    fees: {
        withdrawalFeePercent: { type: Number, default: 1.5, min: 0 }, // Percentage fee for withdrawals
        withdrawalFeeFixed: { type: Number, default: 0.5, min: 0 }, // Fixed fee for withdrawals (applied in addition or instead?)
        p2pTransferFeePercent: { type: Number, default: 0, min: 0 } // Fee for P2P transfers (should be 0 as per req)
        // Add other fee types as needed
    },
    features: [{ // List of specific features enabled by this plan
        type: String,
        trim: true
        // e.g., ['priority_support', 'advanced_reporting', 'sub_accounts']
    }],
    isPublic: { // Whether the plan is available for new users to select
        type: Boolean,
        default: true
    },
    isActive: { // Allows admins to disable a plan without deleting it
        type: Boolean,
        default: true,
        index: true
    },
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

// Index for quick lookup of active public plans
subscriptionPlanSchema.index({ isActive: 1, isPublic: 1 });
subscriptionPlanSchema.index({ planId: 1 });

// Pre-save hook to update lastUpdatedAt timestamp
subscriptionPlanSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.lastUpdatedAt = new Date();
    }
    // Ensure 'free' plan always has price 0
    if (this.billingCycle === 'free') {
        this.price = 0;
    }
    next();
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

export default SubscriptionPlan;

