const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const cors = require("cors");
const helmet = require("helmet");
const cron = require("node-cron");
const firebase = require("firebase-admin");
const pool = require("./config/database");
const moment = require("moment");
const gcm = require("node-gcm");
const MySQLStore = require("express-mysql-session")(session);
const { dashLogger } = require("./helper/logger");

const { host, user, password, database } = require("./utils/Constant");

const sender = new gcm.Sender("############################");

const app = express();
app.use(helmet());
app.use(cors());

const admin = require("./routes/admin");
const simTracking = require("./routes/simTracking");
const accounts = require("./routes/accounts");
const survellance = require("./routes/survellance");

const PORT = process.env.PORT || 9000;

app.set("view engine", "ejs");

const options = {
	host: host,
	user: user,
	password: password,
	database: database,
};

const sessionStore = new MySQLStore(options, pool);

app.use(
	bodyParser.urlencoded({
		extended: false,
	})
);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
	session({
		secret: "secret",
		resave: true,
		store: sessionStore,
		saveUninitialized: true,
		cookie: {
			secure: false,
			httpOnly: false,
		},
	})
);

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

app.use(function (req, res, next) {
	res.locals.success_msg = req.flash("success_msg");
	res.locals.error_msg = req.flash("error_msg");
	res.locals.error = req.flash("error");
	res.locals.user = req.user || null;
	next();
});

app.get("/signature/:signature", (req, res) => {
	res.sendFile(path.join(__dirname, `/public/images/signature/${req.params.signature}`));
});

app.get("/", (req, res) => {
	res.render("index");
});

app.get("/400", (req, res) => {
	res.render("400");
});

app.use("/admin", admin);
app.use("/simTracking", simTracking);
app.use("/accounts", accounts);
app.use("/survellance", survellance);

app.use((req, res, next) => {
	const err = new Error("Not Found");
	err.status = 404;
	res.render("404");
});

const server = app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`);
});

cron.schedule(
	"0 10,6 * * *",
	async () => {
		try {
			const trans = await pool.query(
				"SELECT * FROM `trans_tab` WHERE ISNULL(acc_name) OR ISNULL(ifsc) OR ISNULL(bankAcc)"
			);
			if (trans.length) {
				let message = new gcm.Message({
					data: {
						key1: "msg1",
						type: "alert",
						title: "KYC incomplete!!",
						body: "Your KYC is not completed. Please complete the KYC.",
					},
				});
				let regTokens = [];
				for (let i = 0; i < trans.length; i++) {
					regTokens.push(`${trans[i].fcm_token}`);
				}
				// Actually send the message
				sender.send(
					message,
					{
						registrationTokens: regTokens,
					},
					function (err, response) {
						if (err) console.error(err);
						else {
							console.log(response);
							if (response.success == 1) {
								return res.send({
									code: 1,
								});
							}
						}
					}
				);
			}
		} catch (error) {
			console.error(error);
			dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		}
	},
	{
		scheduled: true,
		timezone: "Asia/Kolkata",
	}
);

server.timeout = 120000;
