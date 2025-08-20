import express from "express";
import passport from "passport";
import {register, login, authStatus, resetPassword, logout, setup2FA, reset2FA, verify2FA, require2FA} from "../controllers/authController.js";
import { verifyEmail } from "../../utils/verifyEmail.js";
import { forgotPassword } from "../../utils/forgotPassword.js";


const router = express.Router();

//Register
router.post("/register", register);
//login
router.post("/login", passport.authenticate("local"), login);
//auth status
router.get("/status", authStatus);
//logout
router.post("/logout", logout);
//reset password
router.post("/reset-password", resetPassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-email", verifyEmail);

//2FA setup
router.post("/2fa/setup", (req, res, next) => {
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `unauthorized`});
}, setup2FA);

//verify route
router.post("/2fa/verify", (req, res, next) => {
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `Unauthorized`});
}, verify2FA)

//reset route
router.post("/2fa/reset", (req, res, next) => {
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `Unauthorized`});
}, reset2FA)

router.get('/ses-data', require2FA, (req, res) => {
	// This route requires 2FA verification
	res.json({ sensitiveData: "Here's your protected data" });
});

export default router;