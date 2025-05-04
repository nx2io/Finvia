import jwt from "jsonwebtoken";
import { NODE_ENV, JWT_SECRET } from "../config/env.js";

export const generateTokenAndSetCookie = (res, userId) => {
	const token = jwt.sign({ userId }, JWT_SECRET, {
		expiresIn: "7d",
	});

	res.cookie("token", token, {
		httpOnly: true,
		secure: NODE_ENV === "production",
		sameSite: "strict",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	return token;
};
