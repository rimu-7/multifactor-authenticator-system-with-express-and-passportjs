import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/userSchema.js"; // Make sure this is a Sequelize model

passport.use(
	new LocalStrategy(
		async (username, password, done) => {
			try {
				const user = await User.findOne({ where: { username } });
				if (!user) {
					return done(null, false, { message: "User not found" });
				}
				
				const isMatch = await bcrypt.compare(password, user.password);
				if (!isMatch) {
					return done(null, false, { message: "Wrong password" });
				}
				
				return done(null, user);
			} catch (error) {
				return done(error);
			}
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user.id);
	console.log("serializeUser", user);
});

passport.deserializeUser(async (id, done) => {
	try {
		const user = await User.findByPk(id); // This works with Sequelize
		done(null, user);
	} catch (err) {
		done(err);
	}
});