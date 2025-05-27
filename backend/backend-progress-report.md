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
- [ ] Two-Factor Authentication (TOTP support via `otplib`) *(pending)*
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
- [ ] Enable/disable two-factor authentication (using TOTP)
- [ ] Verify TOTP tokens
- [ ] Get 2FA status

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
- [ ] P2P transfers (send/receive)
- [ ] Fund request flow (create, respond, cancel, fulfill)
- [ ] Withdrawals to linked bank account
- [ ] Transaction history & detail view
- [ ] MongoDB sessions for transaction integrity
- [ ] Plan-based transfer limits and fee validation

---

### 📦 Subscription Controller
- [ ] View available plans
- [ ] Get current subscription
- [ ] Change plan (upgrade/downgrade)
- [ ] Cancel auto-renewal
- [ ] Mongo session for atomic balance deduction & plan update

---

### 💰 Deposit Controller
- [ ] Get Binance USDT deposit instructions
- [ ] Submit deposit verification (TXID, screenshot, amount)
- [ ] Track verification status

---

### 🛠 Admin Controller
- [ ] Manage users (CRUD)
- [ ] Manage KYC submissions
- [ ] Approve/reject deposits
- [ ] Manage subscription plans (CRUD)
- [ ] Mongo sessions for atomic KYC/deposit approvals

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

_Last updated: May 20, 2025_
