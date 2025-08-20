import bcrypt from "bcryptjs";
import User from "../models/userSchema.js";
import speakeasy, { generateSecret } from "speakeasy";
import qrCode from "qrcode";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { generateTokenAndSetCookie } from "../../utils/generateTokenAndSetCookie.js";
dotenv.config();



//----------------------------------------------------------------------

// Middleware to check if 2FA is verified
export const require2FA = (req, res, next) => {
  if (req.user && req.user.isMfaActive && !req.session.twoFactorVerified) {
    return res.status(403).json({ error: "2FA verification required" });
  }
  next();
};






//----------------------------------------------------------------------


//User register

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

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long and contain at least one letter and one number",
      });
    }

    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

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
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 3600000),
      isMfaActive: false,
      twoFactorSecret: null,
    });

    await user.save();

    generateTokenAndSetCookie(res, user.id);

    // Send email with verification code
    const transporter = nodemailer.createTransport({
      service: "gmail", 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"MyApp" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Verify your email",
      text: `Your verification code is: ${verificationToken}`,
    });

    res.status(201).json({
      message: `User registered successfully`,
      user: {
        ...user,
        password: null,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Something went wrong during registration",
      message: error.message,
    });
  }
};



//----------------------------------------------------------------------

//User login
export const login = async (req, res) => {
  try {
    if (!req.user.isVerified) {
      return res.status(403).json({ error: "Please verify your email first" });
    }

    console.log(`Authenticated user: ${req.user.username}`);

    // Reset 2FA verification status on new login
    if (req.session) {
      req.session.twoFactorVerified = false;
    }

    const user = await User.findByPk(req.user.id);

    const transporter = nodemailer.createTransport({
      service: "gmail", // or SMTP settings
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Security Team" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "New Login Notification",
      html: `
        <h2>Hello ${user.firstName || "User"},</h2>
        <p>A new login was detected on your account.</p>
        <p><b>Details:</b></p>
        <ul>
          <li><b>Username:</b> ${user.username}</li>
          <li><b>Time:</b> ${new Date().toLocaleString()}</li>
          <li><b>IP Address:</b> ${req.ip || "Unknown"}</li>
        </ul>
        <p>If this was <b>not you</b>, please change your password immediately.</p>
        <br/>
        <p>Stay safe,</p>
        <p><b>Your App Security Team</b></p>
      `,
    });

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




//----------------------------------------------------------------------

//User auth Status
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


//----------------------------------------------------------------------

// Reset password
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



//----------------------------------------------------------------------
//User Logout


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



//----------------------------------------------------------------------

//2FA setup

export const setup2FA = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Generate secret with otpauth URL
    const secret = speakeasy.generateSecret({
      name: `MyApp (${req.user.username})`,
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
    const qrCodeDataUrl = qrCode.toDataURL(secret.otpauth_url);

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


//----------------------------------------------------------------------

// Verify 2FA
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
      window: 1, // ±30s tolerance
    });

    if (verified) {
      req.session.twoFactorVerified = true;
      if (req.session.save) await req.session.save();

      // (Optional) Send confirmation email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"MyApp" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "2FA Verification Successful",
        html: `<p>Your 2FA verification was successful!</p>`,
      });

      return res.status(200).json({
        message: "2FA verification successful",
        verified: true,
      });
    } else {
      return res.status(400).json({
        message: "2FA verification failed. Invalid token.",
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





//----------------------------------------------------------------------

// Reset 2FA
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

    //Already verified in session
    if (req.session?.twoFactorVerified) {
      verified = true;
    }

    //Verify fresh token if provided
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

    // --- Send Email Notification ---
    const transporter = nodemailer.createTransport({
      service: "gmail", // or "Outlook365", "Yahoo", or use SMTP settings
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Security Team" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "2FA Reset Notification",
      html: `
        <h2>Hello ${user.firstName || "User"},</h2>
        <p>Your Two-Factor Authentication (2FA) has been <b>reset</b> on your account.</p>
        <p>If this was <b>not you</b>, please reset your password immediately and contact support.</p>
        <br/>
        <p>Stay safe,</p>
        <p><b>Your App Security Team</b></p>
      `,
    });

    res.status(200).json({ message: "2FA reset successfully and email sent" });
  } catch (error) {
    console.error("2FA Reset Error:", error);
    res.status(500).json({
      error: "Error resetting 2FA",
      message: error.message,
    });
  }
};
