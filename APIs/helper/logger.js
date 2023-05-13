const winston = require("winston");
require("winston-daily-rotate-file");

const apiLog = new winston.transports.DailyRotateFile({
	filename: "./logs/api-%DATE%.log",
	datePattern: "YYYY-MM-DD",
	zippedArchive: true,
	maxSize: "20m",
	maxFiles: "14d",
});

const dashLog = new winston.transports.DailyRotateFile({
	filename: "./logs/dash-%DATE%.log",
	datePattern: "YYYY-MM-DD",
	zippedArchive: true,
	maxSize: "20m",
	maxFiles: "14d",
});

const api = winston.createLogger({
	transports: [
		apiLog,
		new winston.transports.Console({
			colorize: true,
		}),
	],
});

const dash = winston.createLogger({
	transports: [
		dashLog,
		new winston.transports.Console({
			colorize: true,
		}),
	],
});

module.exports = {
	apiLogger: api,
	dashLogger: dash,
};
