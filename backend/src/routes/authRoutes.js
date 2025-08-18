import express from "express";
import passport from "passport";
import {register, login, authStatus, logout, setup2FA, reset2FA, verify2FA} from "../controllers/authController.js";


const router = express.Router();

//Register
router.post("/register", register);
//login
router.post("/login",passport.authenticate("local"), login);
//auth status
router.get("/status", authStatus);
//logout
router.post("/logout", logout);

//2FA setup
router.post("/2fa/setup",(req,res)=>{
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `Unauthorized`});
} ,setup2FA);

//verify route
router.post("/2fa/verify", (req,res)=>{
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `Unauthorized`});
} ,verify2FA)

//reset route
router.post("/2fa/reset", (req,res)=>{
	if (req.isAuthenticated()) return next();
	res.status(401).json({message: `Unauthorized`});
} ,reset2FA)

export default router;