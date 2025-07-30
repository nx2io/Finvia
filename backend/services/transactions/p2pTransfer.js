import mongoose from "mongoose";

import Transaction from "../../models/transaction.model.js";
import User from "../../models/user.model.js";

import { convertCurrency, getUserPlanDetails, updateBalance, generateUniqueTransactionId } from "../utils/helpers.js";
import { clearCache } from "../utils/cache.js";


export const processP2PTransfer = async (data) => {
    console.log('🔄 Starting P2P transfer process:', data);
    const { TXID, senderUserId, recipientIdentifier, amount, currency, note } = data;

    if (!recipientIdentifier || !amount || amount <= 0 || !currency) {
        return { success: false, message: 'Recipient, amount, and currency are required' };
    }

    try {
        const session = await mongoose.startSession();
        session.startTransaction();

        console.log('🔍 Finding sender and recipient...');
        const sender = await User.findById(senderUserId).populate('mainWalletId').session(session);
        const recipient = await User.findOne({ $or: [{ email: recipientIdentifier }, { username: recipientIdentifier }] })
            .populate('mainWalletId').session(session);

        if (!sender || !sender.mainWalletId || !recipient || !recipient.mainWalletId || senderUserId === recipient._id.toString()) {
            throw new Error('Sender or recipient data invalid');
        }

        console.log('💰 Calculating amounts...');
        const senderWallet = sender.mainWalletId;
        const recipientWallet = recipient.mainWalletId;
        const amountInUSD = await convertCurrency(amount, senderWallet.primaryCurrency, 'USD');
        const feeInSenderCurrency = await convertCurrency(0.20, 'USD', senderWallet.primaryCurrency);
        const senderAmount = await convertCurrency(amount, currency, senderWallet.primaryCurrency);
        const recipientAmount = await convertCurrency(amount, currency, recipientWallet.primaryCurrency);

        if (senderAmount > senderWallet.mainBalance) throw new Error('Insufficient funds.');

        const planDetails = await getUserPlanDetails(senderUserId, session);
        if (amountInUSD > planDetails.transactionLimits.maxSingleTransaction) {
            throw new Error(`Transaction amount exceeds the limit of ${planDetails.transactionLimits.maxSingleTransaction}`);
        }

        // const today = new Date().setHours(0, 0, 0, 0);
        // const dailyTotal = await Transaction.aggregate([
        //     { $match: { userId: sender._id, createdAt: { $gte: new Date(today) }, status: 'completed' } },
        //     { $group: { _id: null, total: { $sum: '$amount' } } }
        // ]);
        // if (dailyTotal[0]?.total + amountInUSD > planDetails.transactionLimits.dailyVolume) {
        //     throw new Error('Daily transaction limit exceeded.');
        // }

        console.log('💸 Updating balances...');
        const totalDebit = senderAmount + feeInSenderCurrency;
        await updateBalance(senderWallet._id, -totalDebit, null, session);
        await updateBalance(recipientWallet._id, recipientAmount, null, session);

        console.log('📝 Creating transactions...');
        const now = new Date();
        const senderTx = new Transaction({
            TXID,
            userUID: sender.UUID,
            userId: sender._id,
            walletId: senderWallet._id,
            walletNumber: senderWallet.walletNumber,
            type: 'P2P_SEND',
            status: 'completed',
            amount: senderAmount,
            currency,
            fee: feeInSenderCurrency,
            netAmount: -totalDebit,
            description: note || `Sent to ${recipient.username}`,
            recipientUserId: recipient._id,
            recipientUserUID: recipient.UUID,
            recipientWalletId: recipientWallet._id,
            recipientWalletNumber: recipientWallet.walletNumber,
            initiatedAt: now,
            completedAt: now,
        });
        await senderTx.save({ session });

        const recipientTx = new Transaction({
            TXID: await generateUniqueTransactionId(),
            userUID: recipient.UUID,
            userId: recipient._id,
            walletId: recipientWallet._id,
            walletNumber: recipientWallet.walletNumber,
            type: 'P2P_RECEIVE',
            status: 'completed',
            amount: recipientAmount,
            currency: recipientWallet.primaryCurrency,
            fee: 0,
            netAmount: recipientAmount,
            description: note || `Received from ${sender.username}`,
            senderUserId: sender._id,
            senderUserUID: sender.UUID,
            senderWalletId: senderWallet._id,
            senderWalletNumber: senderWallet.walletNumber,
            relatedTransactionId: senderTx._id,
            relatedTransactionUID: senderTx.TXID,
            initiatedAt: now,
            completedAt: now,
        });
        await recipientTx.save({ session });

        senderTx.relatedTransactionId = recipientTx._id;
        await senderTx.save({ session });

        await session.commitTransaction();
        session.endSession();

        await clearCache(`walletDetails:${senderUserId}`);
        await clearCache(`walletDetails:${recipient._id}`);

        console.log('✅ P2P transfer completed successfully');
        return {
            success: true,
            message: 'Transfer successful',
            data: { transactionId: senderTx._id, senderTx, recipientTx }
        };
    } catch (error) {
        console.error("❌ P2P Transfer Error:", error);
        return { success: false, message: error.message || 'An error occurred during transfer.' };
    } // finally {
    //     try {
    //         await session.endSession();
    //     } catch (releaseError) {
    //         console.warn('⚠️ Failed to release Redlock:', releaseError);
    //     }
    //     console.log(`🔓 Released lock for user ${senderUserId}`);
    // }
};
