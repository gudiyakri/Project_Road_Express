const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cluster = require("cluster");
const sequelize = require("./config/database");
const helmet = require("helmet");
const cpu = require("os").cpus().length;
const authorization = require("./helper/jwt");
const { handleError } = require("./helper/error");
const schemaValidator = require("./helper/joi");

const PORT = 9002;

if (cluster.isMaster) {
	console.log(`Master ${process.pid} is running`);
	for (let i = 0; i < cpu; i++) {
		cluster.fork();
	}
	cluster.on("exit", (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
	console.log(`Worker ${process.pid} started`);
	const app = express();

	app.use(helmet());

	const driver = require("./routes/driver");
	const transporter = require("./routes/transporter");
	const transporterAPI = require("./routes/transporterAPI");

	app.use(bodyParser.urlencoded({ limit: "100mb", extended: true, parameterLimit: 50000 }));
	app.use(bodyParser.json({ limit: "100mb" }));
	app.use(express.static(path.join(__dirname, "public")));

	app.use((req, res, next) => {
		console.log(req.originalUrl);
		next();
	});

	app.use("/driver", driver);
	app.use("/transporter", transporter);
	app.use("/transporterAPI", transporterAPI);

	app.listen(PORT, () => {
		console.log(`Server started on port ${PORT}`);
	});
}
