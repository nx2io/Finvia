
# 📱 Digital Wallet API

## 📘 Introduction

This document provides a detailed explanation of the **controllers** and **routes** used in the **Digital Wallet** application. The system is built with scalability, security, and maintainability in mind, following a modified **Model-View-Controller (MVC)** pattern tailored for RESTful APIs.

- **Models** (`/models`): Define data structures and interact with MongoDB.
- **Controllers** (`/controllers`): Handle business logic and process incoming requests.
- **Routes** (`/routes`): Map API endpoints to their corresponding controllers and attach relevant middleware.
- **Middlewares** (`/middlewares`): Provide functionality such as authentication, authorization, validation, and error handling.

---

## 📂 Controllers

### 1. `auth.controller.js` – Authentication & Registration

Handles user authentication and session management.

#### Main Functions:
- `signUp`: Registers a new user, creates a primary wallet, and assigns a free subscription plan.
- `signIn`: Authenticates a user.
- `signOut`: Logs out the user.
- `googleCallback`: Google OAuth login/register handler.
- `verifyEmail`: Verifies email with a provided activation code.
- `resendVerificationEmail`: Resends email verification code.
- `forgotPassword`: Initiates password reset.
- `resetPassword`: Completes password reset.
- `checkAuth`: Validates the auth token and returns user data.

#### Notes:
- Passwords are hashed using `bcryptjs`.
- JWT tokens are managed via `generateTokenAndSetCookie`.
- Wallet and free subscription are created automatically during signup or Google OAuth.
- Recommended: use middleware for input validation and rate-limiting.

---

### 2. `user.controller.js` – User Profile, KYC, Bank Accounts, 2FA

Handles user profile updates, identity verification, bank accounts, two-factor auth, and user search.

#### Main Functions:
- `getMyProfile`, `updateMyProfile`
- `submitKyc`, `getKycStatus`
- `addBankAccount`, `listBankAccounts`, `deleteBankAccount`, `setDefaultBankAccount`
- `getTwoFactorStatus`, `initiateEnableTwoFactor`, `verifyEnableTwoFactor`, `disableTwoFactor`
- `searchUsers`

#### Notes:
- All functions require user authentication via the `authorize` middleware.
- Sensitive data (e.g., ID numbers, IBAN) should be encrypted.
- Validation middleware recommended.

---

### 3. `wallet.controller.js` – Wallet Management

Manages the user’s primary and sub-wallets.

#### Main Functions:
- `getWalletDetails`
- `createSubWallet`, `updateSubWallet`, `deleteSubWallet`
- `transferInternal`: Transfers between main and sub-wallets.

#### Notes:
- Atomic balance updates are performed using `updateBalance()` with `$inc` and `findOneAndUpdate`.
- MongoDB sessions ensure transaction integrity for multi-step operations.
- Internal transfers are logged in the `Transaction` model.

---

### 4. `transaction.controller.js` – Financial Transactions

Handles peer-to-peer transfers, fund requests, and withdrawals.

#### Main Functions:
- `getTransactionHistory`, `getTransactionDetails`
- `sendP2PTransfer`
- `requestFunds`, `listReceivedFundRequests`, `listSentFundRequests`, `respondToFundRequest`, `cancelFundRequest`, `fulfillFundRequest`
- `initiateWithdrawal`

#### Notes:
- MongoDB sessions used for complex operations.
- User limits and fees are validated via `getUserPlanDetails`.
- Transactions are logged separately for sender and receiver.
- Withdrawal requests are marked as pending for later external processing.

---

### 5. `subscription.controller.js` – Subscriptions

Manages subscription plans and user subscriptions.

#### Main Functions:
- `listAvailablePlans`
- `getMySubscription`
- `changeSubscription`: Upgrades/downgrades plans.
- `cancelSubscription`: Disables auto-renew.

#### Notes:
- Uses `SubscriptionPlan` and `UserSubscription` models.
- MongoDB sessions ensure atomic updates when changing plans.
- Canceling means auto-renew is off; plan remains active until the billing cycle ends.

---

### 6. `deposit.controller.js` – USDT Deposits via Binance

Handles deposits using USDT with automatic verification through Binance APIs.

#### Main Functions:
- `getDepositInstructions`: Returns deposit address, network, and memo.
- `submitDepositVerification`: User submits transaction details and screenshot.
- `getDepositVerificationStatus`

#### Notes:
- Admin intervention is only needed on failed verifications.
- `BinanceDepositVerification` model is used to track submissions.
- Successful deposits update wallet balance and create a transaction.
- Environment variable required: `BINANCE_USDT_DEPOSIT_ADDRESS`.

---

### 7. `admin.controller.js` – Admin Operations

Provides admin-level functionality for managing the platform.

#### Main Functions:
- **User Management**: `listUsers`, `getUserDetails`, `updateUserStatus`, `deleteUser`
- **KYC Review**: `listPendingKyc`, `reviewKyc`
- **Deposit Review**: `listPendingDeposits`, `approveDeposit`, `rejectDeposit`
- **Subscription Plans**: `listAllSubscriptionPlans`, `createSubscriptionPlan`, `updateSubscriptionPlan`

#### Notes:
- All endpoints require admin privileges via `authorizeAdmin`.
- Uses MongoDB sessions for multi-step operations (e.g., deposit approval, user deletion).
- Approving deposits also updates user wallet balances atomically.

---

## 🌐 Routes

Routes are defined in `/routes`, each file corresponding to a controller.

| File                 | Base Path             | Description                                              |
|----------------------|------------------------|----------------------------------------------------------|
| `auth.routes.js`     | `/api/v1/auth/`        | Authentication and registration                          |
| `user.routes.js`     | `/api/v1/users/`       | Profile, KYC, banks, 2FA, user search                    |
| `wallet.routes.js`   | `/api/v1/wallet/`      | Wallet and sub-wallet operations                         |
| `transaction.routes.js` | `/api/v1/transactions/` | Transaction history, P2P, fund requests, withdrawals  |
| `subscription.routes.js` | `/api/v1/subscriptions/` | Subscription plan management                          |
| `deposit.routes.js`  | `/api/v1/deposit/`      | USDT deposit operations via Binance                      |
| `admin.routes.js`    | `/api/v1/admin/`        | Admin-only management routes                             |

---

## 🔐 Middlewares

| Middleware              | File                                | Purpose                                                                 |
|-------------------------|-------------------------------------|-------------------------------------------------------------------------|
| `authorize`             | `/middlewares/auth.middleware.js`   | Validates JWT and attaches `userId` to `req`                            |
| `authorizeAdmin`        | `/middlewares/auth.middleware.js`   | Ensures the user is an admin                                            |
| `passport`              | `passport.js`                       | Used for Google OAuth authentication                                   |

### Suggested Additional Middleware:
- **Input Validation**: Use `express-validator` for validating `req.body`, `req.params`, `req.query`
- **Rate Limiting**: Use `express-rate-limit` to protect from abuse and brute-force attacks

---

## 🧩 Environment Variables (Suggested)

```env
# PORT
PORT=...
SERVER_URL=...
BASE_URL=...

# ENVIRONMENT
NODE_ENV=...

# DATABASE
MONGODB_URI=...
CLICKHOUSE_URL=...
# REDIS_URL=...
REDIS_URL=...
DEFAULT_EXPIRATION=...

# Encryption Keys
JWT_SECRET=...
ENCRYPTION_KEY=...
JWT_EXPIRES_IN=...
EMAIL_PASSWORD=...

#Open Exchange Rates
OPR_APP_KEY=...

#Binance 
BINANCE_USDT_DEPOSIT_ADDRESS=...
BINANCE_USDT_DEPOSIT_MEMO=...
BINANCE_USDT_DEPOSIT_NETWORK=...

# ARCJET
ARCJET_KEY=...
ARCJET_ENV=...

# UPSTASH
QSTASH_URL=...
QSTASH_TOKEN=...

# Mailtrap
MAILTRAP_TOKEN=...
MAILTRAP_ENDPOINT=...

#Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_USERNAME=...
TELEGRAM_CHAT_ID=...
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

```

---

## ✅ Final Notes

* Ensure **MongoDB sessions** are used for all critical multi-step operations.
* Encrypt and protect all **sensitive user data**.
* Implement **logging** and **monitoring** for transaction and deposit activities.
* Consider adding **unit and integration tests** for all controllers.

---

> Built with ❤️ for secure and scalable digital finance.

