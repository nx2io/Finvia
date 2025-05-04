import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../config/env.js'; // Assuming ENCRYPTION_KEY is loaded into env config

const ALGORITHM = 'aes-256-gcm';
// Key length check (should be done in env config loading ideally)
const ENG_KEY = ENCRYPTION_KEY.toString('hex');
if (!ENG_KEY /* || Buffer.from(ENG_KEY, 'hex').length >= 32 */) {
  throw new Error('Invalid ENCRYPTION_KEY: Must be a 32-byte hex-encoded string.');
}
const key = Buffer.from(ENG_KEY, 'hex');

/**
 * Encrypts text using AES-256-GCM.
 * @param {string} text The text to encrypt.
 * @returns {string} The encrypted text in format 'iv:authTag:encryptedData' (hex encoded).
 * Returns null if input is null or undefined.
 */
export const encrypt = (text) => {
  if (text == null) { // Check for null or undefined
    return null;
  }
  try {
    const iv = crypto.randomBytes(12); // 96 bits is recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Combine IV, authTag, and encrypted data, encode as hex
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    // In a real app, use a proper logger
    throw new Error('Encryption failed.'); // Or handle more gracefully
  }
};

/**
 * Decrypts text encrypted with AES-256-GCM.
 * @param {string} encryptedText The encrypted text in format 'iv:authTag:encryptedData' (hex encoded).
 * @returns {string} The original decrypted text.
 * Returns null if input is null, undefined, or invalid format.
 */
export const decrypt = (encryptedText) => {
  if (encryptedText == null) { // Check for null or undefined
    return null;
  }
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      console.error('Decryption failed: Invalid encrypted text format.');
      return null; // Or throw an error
    }
    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    // Avoid leaking error details in production, log securely
    // Check specifically for 'Unsupported state or unable to authenticate data' which indicates tampering or wrong key
    if (error.message.includes('Unsupported state') || error.message.includes('authenticate data')) {
        console.error('Decryption failed: Data authentication failed. Possible tampering or incorrect key.');
    }
    return null; // Return null on failure to avoid propagating errors
  }
};

