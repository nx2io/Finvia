import mongoose from 'mongoose';

// Model to manage peer-to-peer fund requests between users
const fundRequestSchema = new mongoose.Schema({
    requesterUserId: { // The user initiating the request
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    requesterWalletId: { // The wallet the funds should eventually go to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },
    requestedUserId: { // The user from whom the funds are requested
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Request amount must be positive'] // Minimum request amount
        // Use mongoose-decimal128 for precision
    },
    currency: { // Currency of the requested amount (should match requester's wallet currency)
        type: String,
        required: true,
        enum: ['USD', 'SAR', 'EUR']
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending',  // Request sent, awaiting response
            'accepted', // Request accepted by the recipient, awaiting fulfillment (transfer)
            'rejected', // Request declined by the recipient
            'fulfilled',// Request successfully paid by the recipient
            'expired',  // Request timed out without action
            'cancelled' // Request cancelled by the requester
        ],
        default: 'pending',
        index: true
    },
    note: { // Optional message from the requester
        type: String,
        trim: true,
        maxLength: 200
    },
    // Transaction ID of the fulfilling payment
    fulfillmentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        index: true
    },
    rejectionReason: { // Optional reason if rejected
        type: String,
        trim: true,
        maxLength: 200
    },
    expiresAt: { // Optional expiry date for the request
        type: Date,
        index: true
        // Set default expiry (e.g., 7 days) in application logic if needed
    },
    requestedAt: { 
        type: Date, 
        default: Date.now, 
        immutable: true 
    },
    lastUpdatedAt: { 
        type: Date, 
        default: Date.now 
    }

}, { timestamps: { createdAt: 'requestedAt', updatedAt: 'lastUpdatedAt' } });

// Indexes for common queries
fundRequestSchema.index({ requesterUserId: 1, status: 1 });
fundRequestSchema.index({ requestedUserId: 1, status: 1 });
fundRequestSchema.index({ status: 1, expiresAt: 1 });

// Pre-save hook to update lastUpdatedAt timestamp
fundRequestSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.lastUpdatedAt = new Date();
    }
    // Prevent modification after final states
    if (!this.isNew && ['fulfilled', 'rejected', 'expired', 'cancelled'].includes(this.get('status', null, { getters: false })) && this.isModified()) {
       // Allow modification only if fulfillmentTransactionId is being added to an 'accepted' request
       if (!(this.status === 'accepted' && this.isModified('status') && this.get('status') === 'fulfilled' && this.isModified('fulfillmentTransactionId'))) {
            return next(new Error('Cannot modify a request in a final state (' + this.status + ').'));
       }
    }
    next();
});

const FundRequest = mongoose.model('FundRequest', fundRequestSchema);

export default FundRequest;

