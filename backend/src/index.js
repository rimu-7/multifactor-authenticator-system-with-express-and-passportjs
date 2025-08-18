import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import authRoutes from "./routes/authRoutes.js";
import sequelize from "./config/dbConnect.js";
import "./config/passportConfig.js"

dotenv.config();

const app = express();

// Test and connect to DB
(async () => {
	try {
		await sequelize.authenticate();
		console.log("✅ Connected to MySQL");
		await sequelize.sync(); // Optional: sync models automatically
		console.log("✅ Models synced");
	} catch (error) {
		console.error("❌ Unable to connect to DB:", error);
	}
})();


// Middleware
const corsOptions = {
	origin: "*",
	credentials: true,
};
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

app.use(
	session({
		secret: process.env.SESSION_SECRET || "secret",
		resave: false,
		saveUninitialized: false,
		cookie: { maxAge: 60000 * 60 },
	})
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);

// Example route
app.get("/", (req, res) => {
	res.send("Still Alive!");
});

// Listen App
const PORT = process.env.PORT || 4501;
app.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});
