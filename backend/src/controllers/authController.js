import bcrypt from 'bcryptjs';
import User from "../models/userSchema.js";

export const register = async (req, res) => {
	try {
		const {firstName, lastName, username, email, password} = req.body;
		const hashedPassword = await bcrypt.hash(password, 12);
		const user = new User({
			firstName,
			lastName,
			username,
			email,
			password: hashedPassword,
			isMfaActive: false,
		});
		console.log(user);
		await user.save();
		res.status(201).json({message: `user registered successfully `, user})
		
	} catch (error) {
		res.status(500).json({error: "Something went wrong", message: error});
	}
}


export const login = async (req, res) => {
	res.status(200).json({
		message: `User logged in`,
		username: req.user.username,
		isMfaActive: req.user.isMfaActive
	});
};


export const authStatus = async (req, res) => {
	if (req.user){
		res.status(200).json({
			message: `User logged in`,
			username: req.user.username,
			isMfaActive: req.user.isMfaActive
		})
	}else {
		res.status(400).json({message:"Unauthorized user"});
	}
}
export const logout = async (req, res) => {
	if (!req.user) res.status(400).json({message:"Unauthorized user"});
	req.logout((error)=>{
		if (error){
			return res.status(500).json({error:" user not logged in"});
		}
		res.status(200).json({message:"Logged out successful"});
	})
}
export const setup2FA = async () => {
}
export const verify2FA = async () => {
}
export const reset2FA = async () => {
}