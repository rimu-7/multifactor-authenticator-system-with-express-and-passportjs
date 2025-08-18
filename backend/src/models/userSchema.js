// models/User.js
import {DataTypes} from "sequelize";
import sequelize from "../config/dbConnect.js"; // import the sequelize instance

const generateId = (length = 32) => {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()_{}?><,./';[]=-";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
};


const User = sequelize.define(
	"User",
	{
		id: {
			type: DataTypes.STRING(32),
			primaryKey: true,
			allowNull: false,
			unique: true,
			defaultValue: generateId,
		},
		firstName: {
			type: String,
			required: true,
		},
		lastName: {
			type: String,
			required: true,
		},
		username: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		email: {
			type: String,
			required: true,
		},
		
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		isMfaActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		twoFactor: {
			type: DataTypes.STRING,
		},
	},
	{
		timestamps: true, // createdAt & updatedAt
	}
);

export default User;
