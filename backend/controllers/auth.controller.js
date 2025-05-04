import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../models/user.model.js';
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from "../utils/emails.js";

import { getOrSetCache } from "../utils/cache.js";

export const signUp = async (req, res, next) => {
  try {
    const { name, email, password, username } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }
    if (!name || !email || !password || !username) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({ 
      name,
      email,
      username,
      password: hashedPassword,
      avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      isBanned: false,
      isVerified: false,
      verificationToken,
      verificationTokenSentAt: Date.now(),
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    await user.save();

    await sendVerificationEmail(user.email, verificationToken);
    const token = generateTokenAndSetCookie(res, user._id);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        token,
        user: user,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.password) {
      return res.status(401).json({ success: false, message: "set your password first" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }
		if (!user.isVerified) {
			return res.status(401).json({ success: false, message: "unverify your email" });
		}
		if (user.isBanned) {
			return res.status(403).json({ success: false, message: "you are banned" });
		}

    const token = generateTokenAndSetCookie(res, user._id);

    user.lastLogin = new Date();
		await user.save();

    res.status(200).json({
      success: true,
      message: 'User signed in successfully',
      data: {
        token,
        user,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ success: true, message: 'User signed out successfully' });
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  try {
    console.log("Google User Data:", req.user); // ✅ سجل البيانات لمعرفة المحتوى

    const { displayName, email, photos } = req.user || {}; // 🔹 تجنب كسر الكود إذا لم يتم جلب بيانات صحيحة

    if (!email) {
      return res.status(400).json({ success: false, error: "No email provided by Google" });
    }

    let baseUsername = email.split("@")[0];
    let username = baseUsername;

    // البحث عن المستخدم بالـ email
    let user = await User.findOne({ email });

    if (!user) {
      // التأكد من أن اسم المستخدم غير مستخدم
      let existingUser = await User.findOne({ username });
      let counter = 1;

      while (existingUser) {
        username = `${baseUsername}${counter}`; // إضافة رقم لجعل الاسم فريدًا
        existingUser = await User.findOne({ username });
        counter++;
      }

      user = new User({
        name: displayName,
        email: email,
        avatar: photos[0]?.value,
        username: username,
        isVerified: true,
        password: undefined,
        resetPasswordExpiresAt: null,
        resetPasswordToken: null,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      });
      await sendWelcomeEmail(user.email, user.name);

      await user.save();
    }

    const token = generateTokenAndSetCookie(res, user._id);
    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const verifyEmail = async (req, res, next) => {
	const { code } = req.body;
	try {
		const user = await User.findOne({
			verificationToken: code,
			verificationTokenExpiresAt: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
		}

		user.isVerified = true;
		user.verificationToken = undefined;
		user.verificationTokenExpiresAt = undefined;
		await user.save();

		await sendWelcomeEmail(user.email, user.name);

		const token = generateTokenAndSetCookie(res, user._id);

		res.status(200).json({
			success: true,
			message: "Email verified successfully",
			token: token,
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const resendVerificationEmail = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "User is already verified" });
    }

    const cooldownTime = 60 * 1000;
    const now = Date.now();

    if (user.verificationTokenSentAt && now - user.verificationTokenSentAt < cooldownTime) {
      const remainingTime = Math.ceil((cooldownTime - (now - user.verificationTokenSentAt)) / 1000);
      return res.status(400).json({
        success: false,
        message: `Please wait ${remainingTime} seconds before requesting a new code.`,
      });
    }

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationToken = verificationToken;
    user.verificationTokenSentAt = Date.now();
    user.verificationTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

    await user.save();

    await sendVerificationEmail(user.email, verificationToken);

    res.status(200).json({ success: true, message: "Verification email sent" });
  } catch (error) {
    next(error);
  }
}

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;

    await user.save();

    // send email
    await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`);

    res.status(200).json({ success: true, message: "Password reset link sent to your email" });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "خطاء في الرابط او منتهى الصلاحية" });
    }

    // update password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    await sendResetSuccessEmail(user.email);

    res.status(200).json({ success: true, message: "تمت إعادة تعيين كلمة المرور" });
  } catch (error) {
    next(error);
  }
};

export const checkAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const bannedUser = async (req, res, next) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.isBanned = !user.isBanned;
    await user.save();
    res.status(200).json({ success: true, message: "User banned successfully", user });
  } catch (error) {
    next(error);
  }
};

export const unbannedUser = async (req, res, next) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.isBanned = false;
    await user.save();
    res.status(200).json({ success: true, message: "User un-banned successfully", user });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  const userId = req.params.id;
  try {

    const user = await getOrSetCache(`user:${userId}`, async () => {
      return await User.findById(userId).select("-password");
    }, 60);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const getUserByEmail = async (req, res, next) => {
  const email = req.params.email;
  try {

    const user = await getOrSetCache(`user:${email}`, async () => {
      return await User.findOne({ $or: [{ email: email }, { username: email }] }).select("-password");
    }, 60
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.findByIdAndDelete(userId);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, req.body, { new: true });
    res.status(200).json({ success: true, message: "User updated successfully", updatedUser });
  } catch (error) {
    next(error);
  }
};