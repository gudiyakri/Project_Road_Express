const camelcaseKeys = require("camelcase-keys");
const crypto = require("crypto");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

const { getDate } = require("../helper/time");
const { ErrorHandler } = require("../helper/error");

module.exports = {
	camelize: obj => {
		try {
			return camelcaseKeys(JSON.parse(JSON.stringify(obj)), { deep: true });
		} catch (error) {
			throw new ErrorHandler(500, error);
		}
	},
	getToken: async (token, uId) => {
		try {
			const CreatedDate = getDate("YYYY-MM-DD HH:mm:ss");

			const resetToken = crypto.randomBytes(20).toString("hex"),
				resetPasswordExpires = Date.now() + 3600000; // 1 hr

			await token.create({
				UserID: uId,
				Token: resetToken,
				Expire: resetPasswordExpires,
				CreatedBy: `U-${uId}`,
				CreatedDate: CreatedDate,
			});

			return resetToken;
		} catch (error) {
			console.error(error);
			throw new ErrorHandler(500, error);
		}
	},
	verifyToken: async (token, resetToken) => {
		try {
			if (!resetToken) {
				throw new ErrorHandler(421, "Invalid or expired token provided");
			}
			const tokenData = await token.findOne({
				where: {
					Token: resetToken,
					Status: "UNUSED",
					Expire: {
						[Op.gt]: Date.now(),
					},
				},
			});

			if (!tokenData) {
				throw new ErrorHandler(421, "Invalid or expired token provided");
			}

			return tokenData;
		} catch (error) {
			throw new ErrorHandler(500, error);
		}
	},
};
