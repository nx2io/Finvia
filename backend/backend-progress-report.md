# ✅ Backend Progress Report

## 📌 Overview
This document summarizes the current backend progress for the platform, including verified functionalities, ongoing developments, and planned features.

---

## ✅ Completed Features

### 🔐 Auth Controller
- [x] User registration
- [x] User login
- [x] Logout
- [x] Email verification
- [x] Password reset (Forgot / Reset password)
- [x] Token validity check
- [ ] Resend email verification token *(pending)*
- [ ] `googleCallback` for Google OAuth *(pending)*

---

### 👤 User Controller
- [x] Get authenticated user profile
- [x] Update profile (name, phone, etc.)
- [x] Submit KYC verification documents
- [x] Check current KYC verification status
- [x] Add bank account
- [x] Delete bank account
- [x] List linked bank accounts
- [x] Set a bank account as default
- [x] Two-Factor Authentication (TOTP support via `otplib`)
- [ ] Search users by name/email (for P2P transfers) *(pending)*

---

### 💼 Wallet Controller
- [x] Get wallet details (main & sub-wallets)
- [x] Create sub-wallet
- [x] Rename sub-wallet
- [x] Delete sub-wallet (if balance is zero)
- [x] Transfer between:
  - Main ↔ Sub-wallets
  - Sub-wallet ↔ Sub-wallet

---

### 📈 Currency Rates
- [x] Hourly currency price updater (SAR, AED, EUR, CNY → USD)
- [x] Database schema for exchange rates
- [x] Integrated auto-updater for currency conversion

---

### 🤖 Telegram Bot (notiva)
- [x] Health check command integration
- [x] Currency update notification

---

## 🔜 Features Coming Soon

### 🔁 Token Management
- [ ] `accessToken` and `refreshToken` implementation for secure session handling

---

### 🔐 2FA Support
- [x] Enable/disable two-factor authentication (using TOTP)
- [x] Verify TOTP tokens
- [x] Get 2FA status

---

### 🌐 IP Analysis
- [ ] IP tracking and enrichment for logins, transfers, and KYC

---

### 📊 Rate Limiting
- [ ] Dynamic rate limits per route/functionality

---

### 🔁 Wallet Currency Conversion
- [x] Auto-convert amount from source wallet's currency to destination wallet's currency

---

## 🚧 Pending Controller Validations

### 💸 Transaction Controller
- [x] P2P transfers (send/receive)
- [x] Fund request flow (create, respond, cancel, fulfill)
- [ ] Withdrawals to linked bank account
- [x] Transaction history & detail view
- [x] MongoDB sessions for transaction integrity
- [ ] Plan-based transfer limits and fee validation *(NEED TO CHECK)*

---

### 📦 Subscription Controller
- [x] View available plans
- [x] Get current subscription
- [x] Change plan (upgrade/downgrade)
- [x] Cancel auto-renewal
- [x] Mongo session for atomic balance deduction & plan update

---

### 💰 Deposit Controller
- [x] Get Binance USDT deposit instructions
- [x] Submit deposit verification (TXID, screenshot, amount)
- [x] Track verification status

---

### 🛠 Admin Controller
- [x] Manage users (CRUD)
- [x] Manage KYC submissions
- [x] Approve/reject deposits
- [x] Manage subscription plans (CRUD)
- [x] Mongo sessions for atomic KYC/deposit approvals

---

## 📁 Database Models Added
- `ExchangeRate`: Stores current FX rates (updated hourly)

---

## 🧩 Integrations
- [x] `notiva` Telegram Bot
- [x] Exchange rate updater (hourly)
- [ ] GeoIP enrichment service
- [ ] Access/refresh token infrastructure

---

_Last updated: JUN 13, 2025_
