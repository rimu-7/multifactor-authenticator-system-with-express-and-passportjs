import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config(); // must be before process.env usage

const sequelize = new Sequelize(
	process.env.MYSQL_DB,
	process.env.MYSQL_USER,
	process.env.MYSQL_PASSWORD,
	{
		host: process.env.MYSQL_HOST,
		dialect: "mysql",
		logging: false,
	}
);

export default sequelize;
