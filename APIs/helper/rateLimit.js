const sequelize = require("../config/database");
const { RateLimiterMySQL } = require("rate-limiter-flexible");
const { ErrorHandler } = require("./error");

// Rate Limiter

const ready = error => {
	if (error) {
		// log or/and process exit
		throw new ErrorHandler(500, error);
	} else {
		// db and table checked/created
		console.log("Limiter Started");
	}
};

const rateLimiter = new RateLimiterMySQL(
	{
		points: 15,
		duration: 1,
		storeClient: sequelize,
	},
	ready
);

const rateLimiterMiddleware = (req, res, next) => {
	rateLimiter
		.consume(req.ip)
		.then(() => {
			next();
		})
		.catch(() => {
			next(new ErrorHandler(429, `Too Many Requests ${req.ip}`));
		});
};

module.exports = rateLimiterMiddleware;
