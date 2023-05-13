const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const pool = require("../config/database");

module.exports = function (passport) {
	passport.use(
		"admin",
		new LocalStrategy(async (username, password, done) => {
			const admin = await pool.query("SELECT * FROM log_tab WHERE u_id = ?", [username]);
			if (admin.length) {
				bcrypt.compare(password, admin[0].pass, (error, isMatch) => {
					if (error) console.log(error);
					if (isMatch) {
						return done(null, admin);
					} else {
						return done(null, false, { message: "Incorrect Password" });
					}
				});
			} else {
				return done(null, false, { message: "Incorrect Username" });
			}
		})
	);

	passport.serializeUser(function (user, done) {
		done(null, user[0].id);
	});

	passport.deserializeUser(async (uid, done) => {
		try {
			const user = await pool.query("SELECT * FROM log_tab WHERE id = ?", [uid]);
			if (user.length != 0) {
				done(null, user[0]);
			} else {
				done(null, null);
			}
		} catch (error) {
			throw err;
		}
	});
};
