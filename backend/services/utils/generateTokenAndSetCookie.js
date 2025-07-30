import jwt from "jsonwebtoken";
import { NODE_ENV, JWT_SECRET } from "../../config/env.js";

/**
 * Generates a JWT token including user ID and IP address, and sets it as an HTTP-only cookie.
 * @param {object} res - Express response object.
 * @param {string} userId - The user's ID.
 * @param {string} clientIp - The client's IP address from the request.
 * @returns {string} The generated JWT token.
 */
export const generateTokenAndSetCookie = (res, userId, clientIp) => {
	// Include userId and clientIp in the payload
	const payload = { userId };
	// Only include IP if it's available
	// Consider security implications: IP addresses can change (mobile networks, VPNs)
	// Binding strictly to IP might lock out legitimate users.
	// A less strict approach might be preferred in some cases, or use it as one factor among others.
	// For this implementation, we'll include it as requested.
	// if (clientIp) {
	//   payload.ip = clientIp;
	// }
	// Let's include it for now as requested, but add a comment about potential issues.
	payload.ip = clientIp || null; // Store IP or null if not available

	const token = jwt.sign(payload, JWT_SECRET, {
		// Consider a shorter expiry for tokens bound to IP?
		// expiresIn: "1d", // Example: 1 day expiry
		// Using the original 7d expiry for now
		 expiresIn: "7d",
	});

	// Set cookie
	const cookieOptions = {
		 httpOnly: true,
		 secure: NODE_ENV === "production",
		 sameSite: "strict",
		 maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	};

	// If running in production over HTTPS, ensure secure=true
	// if (NODE_ENV === "production") {
	//     cookieOptions.secure = true;
	// }

	 res.cookie("token", token, cookieOptions);

	 return token;
};

