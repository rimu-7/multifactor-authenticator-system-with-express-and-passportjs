import bcrypt from "bcryptjs";
import User from "../models/userSchema.js";
import speakeasy from "speakeasy";
import qrCode from "qrcode";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

// Middleware to check if 2FA is verified
export const require2FA = (req, res, next) => {
  if (req.user && req.user.isMfaActive && !req.session.twoFactorVerified) {
    return res.status(403).json({ error: "2FA verification required" });
  }
  next();
};

export const register = async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;

    // Input validation
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Password strength validation (min 8 chars, at least one number and one letter)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long and contain at least one letter and one number",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      isMfaActive: false,
      twoFactorSecret: null,
    });

    await user.save();
    res.status(201).json({ message: `User registered successfully`, user });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Something went wrong during registration",
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    console.log(`Authenticated user: ${req.user.username}`);

    // Reset 2FA verification status on new login
    if (req.session) {
      req.session.twoFactorVerified = false;
    }

    res.status(200).json({
      message: "User logged in successfully",
      username: req.user.username,
      isMfaActive: req.user.isMfaActive,
      userId: req.user.id,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error during login",
      message: error.message,
    });
  }
};

export const authStatus = async (req, res) => {
  try {
    if (req.user) {
      res.status(200).json({
        message: `User logged in`,
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
        },
        isMfaActive: req.user.isMfaActive,
        is2faVerified: req.session?.twoFactorVerified || false,
      });
    } else {
      res.status(401).json({ error: "Unauthorized user" });
    }
  } catch (error) {
    console.error("Auth status error:", error);
    res.status(500).json({
      error: "Error checking authentication status",
      message: error.message,
    });
  }
};


export const resetPassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = req.user;

    // Reset password logic
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Both old and new passwords are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const logout = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ error: "User not logged in" });
    }

    req.logout((error) => {
      if (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
          error: "Error during logout",
          message: error.message,
        });
      }

      // Destroy session completely
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destruction error:", err);
          }
        });
      }

      res.status(200).json({ message: `Logged out successfully` });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Error during logout",
      message: error.message,
    });
  }
};

export const setup2FA = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Generate secret with otpauth URL
    const secret = speakeasy.generateSecret({
      name: `MyApp (${req.user.username})`, // shown in Google Authenticator
      issuer: "ki r bolbo",
    });

    // Save base32 secret in DB
    await User.update(
      {
        twoFactorSecret: secret.base32,
        isMfaActive: true,
      },
      { where: { id: req.user.id } }
    );

    // Use the otpauth_url directly (don’t rebuild)
    const qrCodeDataUrl = await qrCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      message: "2FA setup successfully",
      secret: secret.base32, // backup code
      qrcode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("2FA Setup Error:", error);
    res.status(500).json({
      error: "Error setting up 2FA",
      message: error.message,
    });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    if (!token) {
      return res.status(400).json({ error: "2FA token is required" });
    }

    // Fetch fresh user from DB
    const user = await User.findByPk(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA not set up for this user" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1, // smaller window = more secure, 1 = ±30s tolerance
    });

    if (verified) {
      req.session.twoFactorVerified = true;
      if (req.session.save) await req.session.save();

      res.status(200).json({
        message: "2FA verification successful",
        verified: true,
      });
    } else {
      // Debug helper (can disable later)
      const currentToken = speakeasy.totp({
        secret: user.twoFactorSecret,
        encoding: "base32",
      });
      console.log("Expected token:", currentToken, "Received:", token);

      res.status(400).json({
        error: "Invalid 2FA token",
        verified: false,
      });
    }
  } catch (error) {
    console.error("2FA Verification Error:", error);
    res.status(500).json({
      error: "Error verifying 2FA token",
      message: error.message,
    });
  }
};

export const reset2FA = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { token } = req.body;

    // Always fetch fresh user
    const user = await User.findByPk(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA is not set up for this user" });
    }

    let verified = false;

    // Option 1: Already verified in session
    if (req.session?.twoFactorVerified) {
      verified = true;
    }

    // Option 2: Verify fresh token if provided
    if (token) {
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token,
        window: 1,
      });
    }

    if (!verified) {
      return res
        .status(400)
        .json({ error: "2FA verification required to reset" });
    }

    // Reset 2FA
    await User.update(
      { twoFactorSecret: null, isMfaActive: false },
      { where: { id: user.id } }
    );

    if (req.session) req.session.twoFactorVerified = false;

    res.status(200).json({ message: "2FA reset successfully" });
  } catch (error) {
    console.error("2FA Reset Error:", error);
    res.status(500).json({
      error: "Error resetting 2FA",
      message: error.message,
    });
  }
};
