import mongoose from 'mongoose';

// Tracks the specific subscription instance for a user
const userSubscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
        // unique: true // A user might have a history of subscriptions, so not unique
    },
    planId: { // Reference to the specific SubscriptionPlan
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: true,
        index: true
    },
    // Store key details from the plan at the time of subscription for historical accuracy
    planDetails: {
        planIdString: { type: String, required: true }, // e.g., 'PREMIUM_MONTHLY'
        name: { type: String, required: true },
        price: { type: Number, required: true },
        currency: { type: String, required: true },
        billingCycle: { type: String, required: true, enum: ['monthly', 'yearly', 'free'] }
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending_payment', // Initial state before first payment (if not free)
            'active',          // Subscription is currently active
            'past_due',        // Payment failed, grace period might apply
            'cancelled',       // Cancelled by user or admin
            'expired'          // Reached end date and not renewed
        ],
        default: 'active',
        index: true
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: { // Calculated based on startDate and billingCycle
        type: Date,
        required: function() { return this.planDetails.billingCycle !== 'free'; } // Required if not free
    },
    // Optional: Track the transaction used to pay for this subscription period
    paymentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    // Optional: Auto-renewal setting
    autoRenew: {
        type: Boolean,
        default: function() { return this.planDetails.billingCycle !== 'free'; } // Default to true for paid plans
    },
    cancellationReason: { // Reason if status is 'cancelled'
        type: String,
        trim: true
    },
    cancelledAt: { type: Date }

}, { timestamps: true }); // Adds createdAt, updatedAt

// Indexes
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1 });

// Pre-save hook to calculate endDate
userSubscriptionSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('startDate') || this.isModified('planDetails.billingCycle')) {
        if (this.planDetails.billingCycle === 'monthly') {
            this.endDate = new Date(this.startDate);
            this.endDate.setMonth(this.endDate.getMonth() + 1);
        } else if (this.planDetails.billingCycle === 'yearly') {
            this.endDate = new Date(this.startDate);
            this.endDate.setFullYear(this.endDate.getFullYear() + 1);
        } else { // 'free' or other cases
            this.endDate = undefined; // No specific end date for free plans unless defined otherwise
        }
    }
    // Ensure status is appropriate (e.g., if free, should be active)
    if (this.planDetails.billingCycle === 'free') {
        this.status = 'active';
        this.endDate = undefined;
        this.autoRenew = false;
    }

    // Update user model with current subscription info (denormalization)
    // This should ideally be handled in the application logic after successful save
    // Example: User.findByIdAndUpdate(this.userId, { 'subscription.planId': this.planId, 'subscription.status': this.status, 'subscription.expiresAt': this.endDate });

    next();
});

const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);

export default UserSubscription;

