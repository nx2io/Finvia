import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/user.model.js';

// Middleware for general user authorization with IP check
export const authorize = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Fallback to checking cookie if header is not present
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // --- IP Address Verification ---
    const currentIp = req.clientIp; // Get IP from request-ip middleware
    // Check if IP exists in the token and if it matches the current request IP
    // Allow requests if IP is not in the token (for backward compatibility or if IP was not available at generation)
    // Strict check: if (decoded.ip && decoded.ip !== currentIp) {
    // Lenient check (allow if token has no IP or if IPs match):
    if (decoded.ip && decoded.ip !== currentIp) {
        console.warn(`IP mismatch for user ${decoded.userId}. Token IP: ${decoded.ip}, Request IP: ${currentIp}`);
        // Depending on security policy, you might log this and still allow, or deny access.
        // For this implementation, we deny access on mismatch as requested.
        return res.status(401).json({ message: 'Unauthorized: IP address mismatch' });
    }
    // --- End IP Verification ---

    // Find user by ID from token
    // Use lean() for performance if only reading data, but we might need full Mongoose doc later
    const user = await User.findById(decoded.userId).populate('mainWalletId').lean();

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    // Check user status (e.g., banned, suspended)
    if (user.status === 'suspended' || user.status === 'banned' || user.status === 'closed') {
        return res.status(403).json({ message: `Forbidden: Account status is ${user.status}` });
    }

    // Attach user object (excluding sensitive fields) to the request
    req.user = user; // The full user object is attached here

    next();
  } catch (error) {
    let message = 'Unauthorized';
    if (error.name === 'JsonWebTokenError') {
        message = 'Unauthorized: Invalid token';
    } else if (error.name === 'TokenExpiredError') {
        message = 'Unauthorized: Token expired';
    }
    console.error("Authorization Error:", error.message); // Log specific error
    res.status(401).json({ message: message }); // Avoid sending detailed error message
  }
};

// Middleware for admin authorization with IP check
export const authorizeAdmin = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // --- IP Address Verification ---
    const currentIp = req.clientIp;
    if (decoded.ip && decoded.ip !== currentIp) {
        console.warn(`IP mismatch for admin user ${decoded.userId}. Token IP: ${decoded.ip}, Request IP: ${currentIp}`);
        return res.status(401).json({ message: 'Unauthorized: IP address mismatch' });
    }
    // --- End IP Verification ---

    const user = await User.findById(decoded.userId);

    // Check if user exists and has admin role
    // Note: Ensure 'role' field exists in your User model
    if (!user || user.role !== 'admin') { 
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    // Check user status
    if (user.status === 'suspended' || user.status === 'banned' || user.status === 'closed') {
        return res.status(403).json({ message: `Forbidden: Account status is ${user.status}` });
    }

    req.user = user; // Attach admin user object

    next();
  } catch (error) {
    let message = 'Unauthorized';
    if (error.name === 'JsonWebTokenError') {
        message = 'Unauthorized: Invalid token';
    } else if (error.name === 'TokenExpiredError') {
        message = 'Unauthorized: Token expired';
    }
    console.error("Admin Authorization Error:", error.message);
    res.status(401).json({ message: message });
  }
};

