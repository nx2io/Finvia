import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js'; // Needed for populating wallet info
import { getOrSetCache, clearCache } from "../utils/cache.js";
import validator from 'validator'; // For bank account validation

// --- Profile Management ---

/**
 * @description Get the profile of the currently authenticated user
 * @route GET /v1/users/profile/me
 * @access Private
 */
export const getMyProfile = async (req, res, next) => {
  try {
    // req.userId is set by the authorize middleware
    const userId = req.userId;

    // Use cache for frequently accessed profile data
    const userProfile = await getOrSetCache(`userProfile:${userId}`, async () => {
      // Populate related data: main wallet and current subscription details
      // Select fields to exclude sensitive data like password, tokens etc.
      return await User.findById(userId)
        .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires -__v')
        .populate('mainWalletId', 'walletNumber primaryCurrency mainBalance status') // Populate basic wallet info
        // Populate subscription details if needed (consider performance)
        // .populate('subscription.planId', 'name price billingCycle');
    }, 120); // Cache for 120 seconds

    if (!userProfile) {
      // Should not happen if token is valid and user exists
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    console.error("Get My Profile Error:", error);
    next(error);
  }
};

/**
 * @description Update the profile of the currently authenticated user
 * @route PUT /v1/users/profile/me
 * @access Private
 */
export const updateMyProfile = async (req, res, next) => {
  // SECURITY: Add input validation middleware for allowed fields
  const userId = req.userId;
  const { fullName, phone, preferences, avatarUrl } = req.body;

  // Construct update object with only allowed fields
  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (phone && phone.countryCode && phone.number) updateData.phone = phone; // Basic validation
  if (preferences) updateData.preferences = preferences; // Needs deeper validation if complex
  if (avatarUrl && validator.isURL(avatarUrl)) updateData.avatarUrl = avatarUrl;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
      .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires -__v');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    // Clear cache for this user
    await clearCache(`userProfile:${userId}`);
    await clearCache(`user:${userId}`);

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
  } catch (error) {
    console.error("Update My Profile Error:", error);
    // Handle potential validation errors (e.g., invalid phone format if model validation fails)
    if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
    }
    next(error);
  }
};

// --- KYC Management ---

/**
 * @description Submit KYC documents for verification
 * @route POST /v1/users/kyc/submit
 * @access Private
 */
export const submitKyc = async (req, res, next) => {
  // SECURITY: Add input validation middleware
  // SECURITY: Handle file uploads securely (e.g., to S3), store URLs/paths only.
  const userId = req.userId;
  const { documentType, documentNumber, frontImageUrl, backImageUrl } = req.body; // Assuming URLs are provided after upload

  if (!documentType || !documentNumber || !frontImageUrl) {
    return res.status(400).json({ success: false, message: 'Missing required KYC fields' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if KYC already submitted and pending/verified
    if (user.kyc && (user.kyc.status === 'pending' || user.kyc.status === 'verified')) {
        return res.status(400).json({ success: false, message: `KYC status is already ${user.kyc.status}` });
    }

    // SECURITY: Encrypt documentNumber at application layer before saving
    // const encryptedDocNumber = encrypt(documentNumber);

    user.kyc = {
      documentType,
      documentNumber: documentNumber, // Store encrypted version here
      frontImage: frontImageUrl,
      backImage: backImageUrl, // Optional
      status: 'pending', // Initial status
      submittedAt: new Date(),
    };
    user.isKycVerified = false; // Reset verification status on new submission

    await user.save();

    // Clear cache
    await clearCache(`userProfile:${userId}`);
    await clearCache(`user:${userId}`);

    // Notify admin/KYC system? (Out of scope for controller)

    res.status(200).json({ success: true, message: 'KYC documents submitted successfully', data: user.kyc });
  } catch (error) {
    console.error("Submit KYC Error:", error);
    next(error);
  }
};

/**
 * @description Get the current KYC status for the authenticated user
 * @route GET /v1/users/kyc/status
 * @access Private
 */
export const getKycStatus = async (req, res, next) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).select('kyc isKycVerified');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.kyc) {
        return res.status(200).json({ success: true, message: 'KYC not yet submitted', data: { status: 'not_submitted' } });
    }

    // SECURITY: Decrypt documentNumber if needed for display (likely not needed here)
    res.status(200).json({ success: true, data: { ...user.kyc.toObject(), isOverallVerified: user.isKycVerified } });
  } catch (error) {
    console.error("Get KYC Status Error:", error);
    next(error);
  }
};

// --- Bank Account Management ---

/**
 * @description Add a new bank account for the authenticated user
 * @route POST /v1/users/bank-accounts
 * @access Private
 */
export const addBankAccount = async (req, res, next) => {
  // SECURITY: Add input validation middleware (IBAN, SWIFT formats)
  const userId = req.userId;
  const { accountHolderName, iban, bankName, bankCountry, swiftCode } = req.body;

  if (!accountHolderName || !iban || !bankName || !bankCountry) {
    return res.status(400).json({ success: false, message: 'Missing required bank account fields' });
  }

  // Additional validation
  if (!validator.isIBAN(iban)) {
      return res.status(400).json({ success: false, message: 'Invalid IBAN format' });
  }
  if (swiftCode && !validator.isBIC(swiftCode)) {
      return res.status(400).json({ success: false, message: 'Invalid SWIFT/BIC format' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if IBAN already exists for this user
    const existingAccount = user.bankAccounts.find(acc => acc.iban === iban);
    if (existingAccount) {
        return res.status(409).json({ success: false, message: 'Bank account with this IBAN already exists' });
    }

    // SECURITY: Encrypt IBAN and potentially SWIFT code before saving
    // const encryptedIban = encrypt(iban);
    // const encryptedSwift = swiftCode ? encrypt(swiftCode) : undefined;

    const newAccount = {
      accountHolderName,
      iban: iban, // Store encrypted version
      bankName,
      bankCountry,
      swiftCode: swiftCode, // Store encrypted version if applicable
      isDefault: user.bankAccounts.length === 0, // Make first account default
      addedAt: new Date(),
    };

    user.bankAccounts.push(newAccount);
    await user.save();

    // Find the newly added account to return its ID
    const addedAccount = user.bankAccounts[user.bankAccounts.length - 1];

    // Clear cache
    await clearCache(`userProfile:${userId}`);
    await clearCache(`user:${userId}`);

    res.status(201).json({ success: true, message: 'Bank account added successfully', data: addedAccount });
  } catch (error) {
    console.error("Add Bank Account Error:", error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
    }
    next(error);
  }
};

/**
 * @description List bank accounts for the authenticated user
 * @route GET /v1/users/bank-accounts
 * @access Private
 */
export const listBankAccounts = async (req, res, next) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId).select('bankAccounts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // SECURITY: Decrypt IBAN/SWIFT if needed for display (consider masking parts of it)
    // const decryptedAccounts = user.bankAccounts.map(acc => ({ ...acc.toObject(), iban: decrypt(acc.iban) }));

    res.status(200).json({ success: true, data: user.bankAccounts });
  } catch (error) {
    console.error("List Bank Accounts Error:", error);
    next(error);
  }
};

/**
 * @description Delete a bank account for the authenticated user
 * @route DELETE /v1/users/bank-accounts/:accountId
 * @access Private
 */
export const deleteBankAccount = async (req, res, next) => {
  const userId = req.userId;
  const accountId = req.params.accountId;

  if (!accountId) {
      return res.status(400).json({ success: false, message: 'Bank account ID is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const accountIndex = user.bankAccounts.findIndex(acc => acc._id.toString() === accountId);
    if (accountIndex === -1) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    const deletedAccount = user.bankAccounts.splice(accountIndex, 1)[0];

    // If the deleted account was the default, set another one as default if possible
    if (deletedAccount.isDefault && user.bankAccounts.length > 0) {
        user.bankAccounts[0].isDefault = true;
    }

    await user.save();

    // Clear cache
    await clearCache(`userProfile:${userId}`);
    await clearCache(`user:${userId}`);

    res.status(200).json({ success: true, message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error("Delete Bank Account Error:", error);
    next(error);
  }
};

/**
 * @description Set a default bank account for the authenticated user
 * @route PUT /v1/users/bank-accounts/:accountId/default
 * @access Private
 */
export const setDefaultBankAccount = async (req, res, next) => {
    const userId = req.userId;
    const accountId = req.params.accountId;

    if (!accountId) {
        return res.status(400).json({ success: false, message: 'Bank account ID is required' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let found = false;
        user.bankAccounts.forEach(acc => {
            if (acc._id.toString() === accountId) {
                acc.isDefault = true;
                found = true;
            } else {
                acc.isDefault = false;
            }
        });

        if (!found) {
            return res.status(404).json({ success: false, message: 'Bank account not found' });
        }

        await user.save();

        // Clear cache
        await clearCache(`userProfile:${userId}`);
        await clearCache(`user:${userId}`);

        res.status(200).json({ success: true, message: 'Default bank account updated successfully', data: user.bankAccounts });
    } catch (error) {
        console.error("Set Default Bank Account Error:", error);
        next(error);
    }
};

// --- 2FA Management (Placeholder - Requires library like 'otplib' and more complex flow) ---

/**
 * @description Get 2FA status for the authenticated user
 * @route GET /v1/users/2fa/status
 * @access Private
 */
export const getTwoFactorStatus = async (req, res, next) => {
    const userId = req.userId;
    try {
        const user = await User.findById(userId).select('twoFactorAuth');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: { isEnabled: user.twoFactorAuth?.isEnabled || false, method: user.twoFactorAuth?.method } });
    } catch (error) {
        console.error("Get 2FA Status Error:", error);
        next(error);
    }
};

/**
 * @description Initiate enabling 2FA (Generate secret, return QR code data)
 * @route POST /v1/users/2fa/enable/initiate
 * @access Private
 */
export const initiateEnableTwoFactor = async (req, res, next) => {
    // 1. Check if already enabled
    // 2. Generate TOTP secret using otplib
    // 3. Store secret temporarily (e.g., in user doc, marked as unverified)
    // 4. Generate QR code data (otpauth:// URL)
    // 5. Return QR code data and secret (for manual entry) to user
    res.status(501).json({ success: false, message: 'Not Implemented Yet' });
};

/**
 * @description Verify TOTP code and finalize enabling 2FA
 * @route POST /v1/users/2fa/enable/verify
 * @access Private
 */
export const verifyEnableTwoFactor = async (req, res, next) => {
    // 1. Get user and temporary secret
    // 2. Get TOTP code from request body
    // 3. Verify code using otplib and the stored secret
    // 4. If valid: Mark 2FA as enabled, store encrypted secret permanently
    // 5. If invalid: Return error
    res.status(501).json({ success: false, message: 'Not Implemented Yet' });
};

/**
 * @description Disable 2FA (Requires verification, e.g., password or current 2FA code)
 * @route POST /v1/users/2fa/disable
 * @access Private
 */
export const disableTwoFactor = async (req, res, next) => {
    // 1. Verify user identity (e.g., require password or current 2FA code)
    // 2. Find user
    // 3. Update user doc to disable 2FA, clear secret
    res.status(501).json({ success: false, message: 'Not Implemented Yet' });
};

// --- User Search ---

/**
 * @description Search for users by username or email (for P2P transfers)
 * @route GET /v1/users/search
 * @access Private
 */
export const searchUsers = async (req, res, next) => {
    const query = req.query.q;
    const currentUserId = req.userId;

    if (!query || query.length < 3) {
        return res.status(400).json({ success: false, message: 'Search query must be at least 3 characters long' });
    }

    try {
        // Search by username or email, case-insensitive
        // Exclude the current user from results
        // Limit results for performance
        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude self
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
        .select('username fullName avatarUrl') // Return only necessary fields
        .limit(10);

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error("Search Users Error:", error);
        next(error);
    }
};

// --- Admin/Other User Functions (From original auth controller, keep or move to admin) ---

// These functions were in the original auth controller but might belong here or in an admin controller.
// They need appropriate authorization middleware.

/**
 * @description Get any user by ID (Admin or specific permission needed)
 * @route GET /v1/users/:id
 * @access Restricted (Admin)
 */
export const getUserById = async (req, res, next) => {
  // SECURITY: Add Admin authorization middleware
  const userId = req.params.id;
  try {
    const user = await getOrSetCache(`user:${userId}`, async () => {
      return await User.findById(userId).select("-password -__v");
    }, 60);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Get User By ID Error:", error);
    next(error);
  }
};

/**
 * @description Get list of all users (Admin needed)
 * @route GET /v1/users/
 * @access Restricted (Admin)
 */
export const listAllUsers = async (req, res, next) => {
    // SECURITY: Add Admin authorization middleware
    try {
        // Add pagination later
        const users = await User.find().select('-password -__v');
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        console.error("List All Users Error:", error);
        next(error);
    }
};

