const { clientLogger } = require("./logger");

class ErrorHandler extends Error {
	constructor(statusCode, message) {
		super();
		this.statusCode = statusCode;
		this.message = message;
	}
}

const handleError = (err, req, res) => {
	const { statusCode, message } = err;

	clientLogger.error(`Error : ${message},Request : ${req.originalUrl}`);
	if (statusCode === 500) {
		return res.status(statusCode).json({
			status: "Failure",
			msg: "Server Error",
		});
	} else {
		return res.status(statusCode).json({
			status: "Failure",
			msg: message,
		});
	}
};
module.exports = {
	ErrorHandler,
	handleError,
};
