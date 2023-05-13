const express = require("express");
const gcm = require("node-gcm");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const formidable = require("formidable");
const fs = require("fs-extra");
const moment = require("moment");
const http = require("http");
const firebase = require("firebase-admin");

const serviceAccount = require("../config/serviceAccount.json");
const { apiLogger } = require("../helper/logger");
const { firebaseUrl, loadUrl } = require("../utils/Constant");

//const dbFire = firebase.database();

const sender = new gcm.Sender("#####################");
const authkey = "#####################";

async function send_mob(otp, data, load) {
	try {
		console.log(data, load);
		const result = await pool.query(
			"SELECT start_mob,end_mob,inter_mob FROM load_post WHERE load_id= ?",
			[load]
		);

		if (data === "start") {
			let mob = result[0].start_mob;

			let num = `91${mob}`;

			let msg = `Your OTP is ${otp} for the booking id ${load}.
			-RoadExpress`;
			let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=${num}&authkey=${authkey}&message=${msg}&DLT_TE_ID=#####################`;

			http.get(url, function (resp) {
				resp.on("data", function (chunk) {
					console.log(chunk);
				});
			}).on("error", function (e) {
				console.log("Got error: " + e.message);
			});
		} else if (data === "end") {
			let mob = result[0].end_mob;

			let num = `91${mob}`;
			let msg = `Your OTP is ${otp} for the booking id ${load}.
			-RoadExpress`;
			let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=${num}&authkey=${authkey}&message=${msg}&DLT_TE_ID=#####################`;

			http.get(url, function (resp) {
				resp.on("data", function (chunk) {
					console.log(chunk);
				});
			}).on("error", function (e) {
				console.log("Got error: " + e.message);
			});
		} else {
			let mob = result[0].inter_mob ? JSON.parse(result[0].inter_mob) : "";
			let num;

			if (typeof mob == "string") {
				num = `91${mob}`;
			} else {
				num = `91${mob[data]}`;
			}

			let msg = `Your OTP is ${otp} for the booking id ${load}.
			-RoadExpress`;
			let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=${num}&authkey=${authkey}&message=${msg}&DLT_TE_ID=#####################`;

			http.get(url, function (resp) {
				resp.on("data", function (chunk) {
					console.log(chunk);
				});
			}).on("error", function (e) {
				console.log("Got error: " + e.message);
			});
		}
	} catch (error) {
		console.error(error);
		// apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
}

async function sendOtp(mob, otp) {
	try {
		let num = `91${mob}`;
		let msg = `Your OTP for login is ${otp}.
		-RoadExpress`;
		let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=${num}&authkey=${authkey}&route=4&message=${msg}&DLT_TE_ID=1207161964020230252`;

		http.get(url, function (resp) {
			resp.on("data", function (chunk) {
				console.log(chunk);
			});
		}).on("error", function (e) {
			console.log("Got error: " + e.message);
			apiLogger.error(`Error : ${e.message},Request : sendOtp()`);
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
	}
}

async function sendTrack(start, end, inter_mob, load, trip) {
	try {
		let mob = JSON.parse(inter_mob);
		let num = [];
		num.push(`91${start}`, `91${end}`);

		if (typeof mob == "string") {
			num.push(`91${mob}`);
		} else {
			for (let i = 0; i < mob.length; i++) {
				num.push(`91${mob[i]}`);
			}
		}

		const phn = num.join();

		const text = `Dear customer, your trip has started for Booking id:- ${load}.
		Track here:- client.rxp.thecodebucket.com/trackStatus/${trip}.
		-RoadExpress`;

		const url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=TESTIN&mobiles=${phn}&authkey=${authkey}&message=${text}&DLT_TE_ID=#####################`;

		http.get(url, function (resp) {
			resp.on("data", function (chunk) {
				console.log(chunk);
			});
		}).on("error", function (e) {
			console.log("Got error: " + e.message);
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
	}
}

router.post("/otp", async (req, res) => {
	try {
		function generateOTP() {
			const digits = "0123456789";
			let OTP = "";
			for (let i = 0; i < 4; i++) {
				OTP += digits[Math.floor(Math.random() * 10)];
			}
			return OTP;
		}
		const opt = generateOTP();
		await pool.query(
			"INSERT INTO driverotp (mob,otp) VALUES (?,?) ON DUPLICATE KEY UPDATE otp = VALUES(otp)",
			[req.body.mob, opt]
		);

		await sendOtp(req.body.mob, opt);

		return res.send({
			code: 1,
			data: {
				msg: "Otp Sent",
			},
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/verifyOtp", async (req, res) => {
	try {
		const body = {
			...req.body,
		};
		const [check] = await pool.query("SELECT * FROM `driverotp` WHERE mob = ? AND otp = ?", [
			body.mob,
			body.otp,
		]);

		if (check) {
			const driver = await pool.query(
				"SELECT driver_tab.*,main_map.vehicle_id FROM driver_tab LEFT JOIN main_map on driver_tab.Did=main_map.Did WHERE driver_tab.phn = ?",
				[body.mob]
			);
			if (driver.length) {
				return res.send({
					code: 1,
					data: driver,
					msg: "Otp Verified",
				});
			} else {
				return res.send({
					code: 0,
					msg: "No driver with this phone number or the driver is not mapped. Please contact your transporter",
				});
			}
		} else {
			return res.send({
				code: 0,
				msg: "Incorrect OTP",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/login", async (req, res) => {
	try {
		const driver = await pool.query(
			"SELECT driver_tab.*,main_map.vehicle_id FROM driver_tab LEFT JOIN main_map on driver_tab.Did=main_map.Did WHERE driver_tab.phn = ?",
			[req.body.mob]
		);
		console.log(driver);
		if (driver.length > 0) {
			if (driver[0].vehicle_id != null) {
				if (driver[0].verif_flag == 1) {
					bcrypt.compare(req.body.password, driver[0].password, (error, isMatch) => {
						if (error) {
							console.error(error);
							return res.send({
								code: 0,
								msg: "Server Error",
							});
						} else if (isMatch) {
							return res.send({
								result: driver,
								code: 1,
								msg: "Done",
							});
						} else {
							return res.send({
								msg: "password not correct",
								code: 0,
							});
						}
					});
				} else {
					res.send({
						msg: "Driver not verified",
						code: 0,
					});
				}
			} else {
				res.send({
					msg: "Vehicle not mapped",
					code: 4,
				});
			}
		} else {
			res.send({
				msg: "Driver not registered",
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/accpted", async (req, res) => {
	try {
		const data = await pool.query("SELECT count(trip_id) FROM `trip` WHERE Did = ?", [
			req.body.Did,
		]);
		res.send({
			result: data,
			code: 1,
			msg: "Accepted",
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/missed", async (req, res) => {
	try {
		const missed = await pool.query("SELECT count(trip_id) FROM `trip` WHERE NOT Did=?", [
			req.body.Did,
		]);
		res.send({
			result: missed,
			code: 1,
			msg: "Missed",
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});
router.post("/reject", async (req, res) => {
	try {
		const reject = await pool.query("SELECT count(id) FROM `missed_load` WHERE Did=?", [
			req.body.Did,
		]);
		res.send({
			result: reject,
			code: 1,
			msg: "Rejected",
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});
router.get("/masterOtp", async (req, res) => {
	try {
		const masterOtp = await pool.query("SELECT masterOtp FROM masterOtp");
		res.send({
			result: masterOtp,
			code: 1,
			msg: "Master OTP",
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/payment", async (req, res) => {
	try {
		const cli = req.body.cli;
		const cust = req.body.cust;
		const trip = req.body.trip;
		if (cli == 1) {
			const date_ver = new Date();
			const date_verif = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
			const time_verif = moment.utc(date_ver).utcOffset("+05:30").format("hh:mm a");
			const tot_time = `${date_verif} ${time_verif}`;

			await pool.query(
				"UPDATE payment_table SET tot_save = ?, time = ? WHERE trip_id = ? and cust_id =?",
				[1, tot_time, trip, cust]
			);

			return res.send({
				msg: "Trip Completed",
				code: 1,
			});
		} else {
			const rem = parseInt(req.body.remaining, 10) - parseInt(req.body.money, 10);
			let paid = 0;
			await pool.query("INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)", [
				trip,
				2,
				req.body.money,
			]);

			// Accounts
			await pool.query("UPDATE `accounts` SET `clientFinal`= ? WHERE trip_id = ?", [
				req.body.money,
				trip,
			]);

			if (rem === 0) {
				paid = 1;
				await pool.query(
					"UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?",
					[paid, rem, trip, req.body.remaining, cust]
				);
				return res.send({
					msg: "Trip Completed",
					code: 1,
				});
			} else {
				const cli_rem = await pool.query("SELECT * FROM `cli_rem` WHERE `client_id` = ?", [
					cust,
				]);
				if (cli_rem.length > 0) {
					const rem1 = parseInt(cli_rem[0].rem, 10) - rem;
					if (rem1 >= 0) {
						await pool.query(
							"UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?",
							[1, 0, trip, req.body.remaining, cust]
						);
						await pool.query("UPDATE cli_rem SET rem = ? WHERE client_id = ?", [
							rem1,
							cust,
						]);
						await pool.query(
							"INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)",
							[trip, 1, rem]
						);

						return res.send({
							msg: "Trip Completed",
							code: 1,
						});
					} else {
						if (parseInt(cli_rem[0].rem, 10) > 0) {
							const rem2 = -1 * rem1;
							await pool.query(
								"UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?",
								[0, rem2, trip, req.body.remaining, cust]
							);
							await pool.query(
								"INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)",
								[trip, 1, parseInt(cli_rem[0].rem, 10)]
							);
						} else {
							await pool.query(
								"UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?",
								[0, rem, trip, req.body.remaining, cust]
							);
						}
						await pool.query("UPDATE cli_rem SET rem = ? WHERE client_id = ?", [
							rem1,
							cust,
						]);
						return res.send({
							msg: "Trip Completed",
							code: 1,
						});
					}
				} else {
					await pool.query(
						"UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?",
						[paid, rem, trip, req.body.remaining, cust]
					);
					await pool.query("INSERT INTO cli_rem(rem,client_id) VALUES(?,?)", [
						rem * -1,
						cust,
					]);
					return res.send({
						msg: "Trip Completed",
						code: 1,
					});
				}
			}
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/payInfo", (req, res) => {
	pool.getConnection((err, db) => {
		if (err) {
			console.log(err);
		} else {
			var sqlquery =
				"SELECT `Did`, `total` FROM `driver_rem` WHERE Did = ?;SELECT `trip_id`, `Did`, `remaining`,`flag` FROM `pay_driver` WHERE Did = ? ORDER BY trip_id;select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,trip.start_time,load_post.pickup_location,load_post.inter_mob,load_post.last_point,cli_acc.amount FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE cli_acc.flag=0 AND trip.Did = ? ORDER BY trip.trip_id";
			db.query(sqlquery, [req.body.Did, req.body.Did, req.body.Did], (err, result) => {
				if (err)
					return res.send({
						code: 0,
						msg: "Connection Error",
					});
				else {
					return res.send({
						code: 1,
						pending: result[0],
						remaining: result[1],
						info: result[2],
					});
				}
			});
		}
		db.release();
	});
});

router.post("/getHistoryTrip", (req, res) => {
	pool.getConnection((err, db) => {
		if (err) {
			res.send({
				code: 0,
				msg: "Server Error",
			});
		} else {
			var sql =
				"SELECT DISTINCT  load_post.* FROM load_post INNER JOIN confirmed_load ON confirmed_load.load_id=load_post.load_id INNER JOIN trip ON confirmed_load.Did=trip.Did WHERE  trip.status=2 and trip.Did=?";
			db.query(sql, [req.body.Did], (err, result) => {
				if (err) {
					res.send({
						code: 0,
						msg: "Server Error",
					});
				} else {
					res.send({
						result,
						code: 2,
					});
				}
			});
			db.release();
		}
	});
});

router.post("/advnPayment", async (req, res) => {
	try {
		const cli = req.body.cli;
		const cust = req.body.cust;
		const trip = req.body.trip;

		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
		const time = moment.utc(date_ver).utcOffset("+05:30").format("hh:mm a");
		const tot_time = `${date} ${time}`;

		function generateOTP() {
			const digits = "abcdefghijklmnopqrstuvwxyz0123456789";
			let OTP = "";
			for (let i = 0; i < 8; i++) {
				OTP += digits[Math.floor(Math.random() * 10)];
			}
			return OTP;
		}
		const payid = `${cust}${generateOTP()}`;
		const trans_id = `${trip}${payid}`;

		if (cli == 1) {
			if (req.body.adv_am == 0) {
				await pool.query(
					"INSERT INTO `payment_table`(`pay_id`,`trip_id`,`tot_money`,`cust_id`) VALUES  (?,?,?,?)",
					[payid, trip, req.body.tot_am, cust]
				);
			} else {
				await pool.query(
					"INSERT INTO `payment_table`(`pay_id`, `trip_id`, `tot_money`, `cust_id`,`advn`) VALUES  (?,?,?,?,?)",
					[payid, trip, req.body.tot_am, cust, 1]
				);
			}
			await pool.query(
				"INSERT INTO `advn`(`pay_id`, `trans_id`, `mode`,`driver_cnf`,`datetime`,`amount`) VALUES  (?,?,?,?,?,?)",
				[payid, trans_id, 0, 1, tot_time, req.body.adv_am]
			);
			return res.send({
				msg: parseInt(req.body.tot_am, 10) - parseInt(req.body.adv_am, 10),
				code: 1,
			});
		} else if (cli == 0) {
			let remaining = parseInt(req.body.tot_am, 10) - parseInt(req.body.adv_am, 10);
			await pool.query(
				"INSERT INTO `pay_cli`(`pay_id`, `trip_id`, `amount`,`trans_id`, `client_id`,`date_1`,`remaining`) VALUES (?,?,?,?,?,?,?)",
				[payid, trip, req.body.tot_am, trans_id, cust, date, remaining]
			);
			await pool.query("INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)", [
				trip,
				0,
				req.body.adv_am,
			]);
			await pool.query("UPDATE `accounts` SET `clientAdv`= ? WHERE trip_id = ?", [
				req.body.adv_am,
				trip,
			]);
			return res.send({
				msg: "Advance Added",
				remaining,
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/send_Driver", async (req, res) => {
	try {
		const driver = await pool.query(
			"SELECT driver_tab.*,cities.city as sahar,main_map.vehicle_id,main_map.t_av,main_map.d_av,vehicle_table.v_type,vehicle_table.v_num FROM driver_tab  INNER JOIN cities ON driver_tab.city=cities.id LEFT JOIN main_map ON driver_tab.Did=main_map.Did LEFT JOIN vehicle_table ON main_map.vehicle_id=vehicle_table.v_id WHERE driver_tab.Did=?",
			[req.body.Did]
		);
		res.send({
			result: driver,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/vehicleInfo", async (req, res) => {
	try {
		const vehicle = await pool.query(
			"SELECT vehicle_table.pic_rc_front,vehicle_table.pic_rc_back,vehicle_table.v_num,vehicle_table.permit_type,vehicle_table.pic_v,main_map.Did FROM vehicle_table INNER JOIN main_map ON main_map.vehicle_id = vehicle_table.v_id WHERE vehicle_table.v_id = ?",
			[req.body.v_id]
		);
		return res.send({ code: 1, result: vehicle });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/tunOff", async (req, res) => {
	try {
		await pool.query("UPDATE main_map SET t_av = 1 WHERE vehicle_id = ?", [req.body.v_id]);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/fcm", async (req, res) => {
	try {
		const check = await pool.query("SELECT Did FROM `driver_tab` WHERE Did = ?", [
			req.body.Did,
		]);
		if (check.length) {
			await pool.query("UPDATE driver_tab SET fcm_token= ? WHERE Did=?", [
				req.body.fcm,
				req.body.Did,
			]);
			return res.send({ code: 1 });
		} else {
			return res.send({
				msg: "Check the Driver id",
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/check_status", async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT d_av,t_av FROM main_map WHERE Did= ? AND vehicle_id=?",
			[req.body.Did, req.body.vid]
		);
		return res.send({
			result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/vid_send_dri", async (req, res) => {
	try {
		const check = await pool.query(
			"SELECT main_map.vehicle_id ,vehicle_table.v_num,vehicle_table.v_type FROM main_map inner join vehicle_table on main_map.vehicle_id=vehicle_table.v_id WHERE main_map.Did= ?",
			[req.body.Did]
		);
		if (check.length != 0) {
			const vid = check[0].vehicle_id;
			const vnum = check[0].v_num;
			const vtype = check[0].v_type;
			return res.send({
				vid,
				vnum,
				vtype,
				code: 1,
			});
		} else {
			return res.send({
				msg: "not mapped",
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/fcm_check", async (req, res) => {
	try {
		const check = await pool.query(
			"SELECT driver_tab.fcm_token,main_map.vehicle_id FROM driver_tab inner join main_map on driver_tab.Did=main_map.Did WHERE driver_tab.Did = ?",
			[req.body.Did]
		);

		dbFire.ref(`/${firebaseUrl}/${req.body.Did}`).update({
			update: `0`,
		});

		if (check.length) {
			const vid = check[0].vehicle_id;
			const vehicle = await pool.query(
				"SELECT v_num,v_type FROM `vehicle_table` WHERE v_id = ?",
				[vid]
			);
			if (check[0].fcm_token === req.body.fcm) {
				if (vehicle.length != 0) {
					return res.send({
						msg: "not changed",
						vid: vid,
						v_num: vehicle[0].v_num,
						v_type: vehicle[0].v_type,
						code: 1,
					});
				} else {
					return res.send({
						msg: "not changed",
						map: "not mapped",
						code: 1,
					});
				}
			} else {
				await pool.query("UPDATE driver_tab SET fcm_token= ? WHERE Did=?", [
					req.body.fcm,
					req.body.Did,
				]);
				if (vehicle.length != 0) {
					return res.send({
						vid: vid,
						v_num: vehicle[0].v_num,
						v_type: vehicle[0].v_type,
						code: 1,
					});
				} else {
					return res.send({
						map: "not mapped",
						code: 1,
					});
				}
			}
		} else {
			return res.send({
				map: "not mapped",
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/load_sos_send", async (req, res) => {
	try {
		const check = await pool.query(
			"SELECT load_post.load_id, load_post.flag, load_post.fromc, load_post.time, load_post.status, load_post.type, (load_post.amount/load_post.no_vehicle) as amount, load_post.vehicle_type, load_post.pickup_location, load_post.lat_long, load_post.inter_lat_long, load_post.last_lat_long, load_post.city, load_post.dest_city, load_post.intermediate_loc, load_post.last_point, load_post.timef, load_post.timet, load_post.weight, load_post.inter_mob, load_post.start_mob, load_post.end_mob, load_post.no_vehicle,users.flag as cli,cities.state as ins,cities.state as des FROM load_post inner join users on load_post.fromc=users.id inner join cities on load_post.city=cities.id WHERE load_post.load_id=?",
			[req.body.load_id]
		);
		if (check.length > 0) {
			const city = check[0].city;
			const vehicle_type = check[0].vehicle_type;

			if (check[0].cli == 0) {
				res.send({
					result: check,
					cli: 0,
					rate: 0,
					code: 1,
				});
			} else if (check[0].cli == 1) {
				const rate = await pool.query(
					"select rate from cust_vehicle_Rate where city=? and vehicle_id=?",
					[city, vehicle_type]
				);
				if (rate.length > 0) {
					res.send({
						result: rate,
						cli: 1,
						rate: rate[0].rate,
						code: 1,
					});
				}
			}
		} else {
			res.send({
				code: 0,
				msg: "Server Error",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/load_to_cnfload", async (req, res) => {
	try {
		const vehicle = await pool.query("SELECT vehicle_id FROM `main_map` WHERE Did = ?", [
			req.body.Did,
		]);

		const driverCheck = await pool.query(
			"SELECT * FROM `trip` WHERE vehicle_id = ? AND status != 2",
			[vehicle[0].vehicle_id]
		);
		if (driverCheck.length === 0) {
			const mobile = await pool.query(
				"SELECT start_mob,end_mob,inter_mob,amount,load_name,load_quan,load_type,insurance_num,users.name,pickup_location,last_point,intermediate_loc FROM `load_post` INNER JOIN users ON users.id = load_post.fromc WHERE load_id = ?",
				[req.body.load]
			);
			const check = await pool.query(
				"SELECT * FROM `confirmed_load` WHERE Did = ? AND load_id = ? AND fromc = ?",
				[req.body.Did, req.body.load, req.body.fromc]
			);
			if (check.length > 0) {
				return res.send({
					code: 1,
					data: mobile,
				});
			} else {
				dbFire.ref(`/${firebaseUrl}/update`).update({
					update: `${Math.random()}`,
				});
				if (vehicle.length > 0) {
					const flag = req.body.flag;
					const vechile_id = vehicle[0].vehicle_id;
					if (flag == 1) {
						const pending_load = await pool.query(
							"SELECT count,confirm_ids FROM `pending_load` WHERE load_id = ?",
							[req.body.load]
						);
						if (pending_load.length > 0) {
							const count = pending_load[0].count + 1;
							const confirm_ids = `${pending_load[0].confirm_ids},${req.body.Did}`;
							await pool.query(
								"UPDATE pending_load SET count= ?,confirm_ids=? WHERE load_id=?",
								[count, confirm_ids, req.body.load]
							);
							sendConfirm(
								mobile[0].start_mob,
								mobile[0].end_mob,
								mobile[0].inter_mob,
								mobile[0].load_name,
								mobile[0].load_quan,
								mobile[0].load_type,
								mobile[0].insurance_num,
								req.body.load,
								mobile[0].name,
								mobile[0].pickup_location,
								mobile[0].last_point
							);
							return res.send({
								msg: "saved for future",
								code: 1,
								data: mobile,
							});
						} else {
							return res.send({
								msg: "no load present",
								code: 1,
							});
						}
					} else {
						await pool.query("UPDATE load_post SET status= 1 WHERE load_id=?", [
							req.body.load,
						]);
						const date_ver = new Date();
						const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
						const time = moment.utc(date_ver).utcOffset("+05:30").format("hh:mm a");
						const tot_time = `${date} ${time}`;

						await pool.query(
							"INSERT INTO confirmed_load (vehicle_id,Did,conf_time,status,load_id,fromc) VALUES (?,?,?,?,?,?)",
							[vechile_id, req.body.Did, tot_time, 0, req.body.load, req.body.fromc]
						);
						await pool.query(
							"INSERT INTO `notification`(`load_id`, `client_id`, `Did`, `status`) VALUES (?,?,?,?)",
							[req.body.load, req.body.fromc, req.body.Did, 0]
						);
						dbFire
							.ref(`/${loadUrl}/${req.body.load}`)
							.remove()
							.then(function () {
								console.log("Remove succeeded.");
								sendConfirm(
									mobile[0].start_mob,
									mobile[0].end_mob,
									mobile[0].inter_mob,
									mobile[0].load_name,
									mobile[0].load_quan,
									mobile[0].load_type,
									mobile[0].insurance_num,
									req.body.load,
									mobile[0].name,
									mobile[0].pickup_location,
									mobile[0].last_point
								);
								return res.send({
									msg: "You have successfully confirmed the load..",
									code: 1,
									data: mobile,
								});
							})
							.catch(function (error) {
								console.log("Remove failed: " + error.message);
								return res.send({
									code: 0,
									msg: "Server Error",
								});
							});
					}
				} else {
					return res.send({
						msg: "Driver not mapped with any vehicle",
						code: 0,
					});
				}
			}
		} else {
			return res.send({
				code: 0,
				msg: "Already in trip",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/load_to_reject", async (req, res) => {
	try {
		await pool.query("UPDATE load_post SET flag = 0 WHERE load_id = ?", [req.body.load]);
		const map = await pool.query(
			"SELECT main_map.vehicle_id,driver_tab.tid FROM `main_map` inner join driver_tab on main_map.Did=driver_tab.Did WHERE main_map.Did =?",
			[req.body.Did]
		);
		if (map.length) {
			const tr = map[0].tid;
			const vechile_id = map[0].vehicle_id;
			const date_ver = new Date();
			const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
			const time = moment.utc(date_ver).utcOffset("+05:30").format("hh:mm a");
			const tot_time = `${date} ${time}`;
			if (req.body.flag == 1) {
				await pool.query(
					"INSERT INTO `missed_load`(`vehicle_id`,`Did`,`transporter_id`,`date_1`, `load_id`,`priority`) VALUES (?,?,?,?,?,?)",
					[vechile_id, req.body.Did, tr, tot_time, req.body.load, 1]
				);
				return res.send({
					msg: "You have rejected the load..",
					code: 1,
				});
			} else {
				await pool.query(
					"INSERT INTO `missed_load`(`vehicle_id`,`Did`,`transporter_id`,`date_1`, `load_id`) VALUES (?,?,?,?,?)",
					[vechile_id, req.body.Did, tr, tot_time, req.body.load]
				);
				return res.send({
					msg: "You have rejected the load..",
					code: 1,
				});
			}
		} else {
			res.send({
				msg: "Driver not mapped with any vehicle",
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/confirm_to_trip", async (req, res) => {
	try {
		const check = await pool.query(
			"SELECT confirmed_load.*,users.flag,driver_tab.tid FROM confirmed_load inner join users on confirmed_load.fromc=users.id inner join driver_tab on confirmed_load.Did=driver_tab.Did WHERE confirmed_load.load_id = ? AND confirmed_load.Did = ?",
			[req.body.load, req.body.Did]
		);
		if (check.length) {
			const client = check[0].fromc;
			const flag = check[0].flag;
			const driver = check[0].Did;
			const c_load_id = check[0].c_load_id;
			const tid = check[0].tid;
			const [load] = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
				req.body.load,
			]);
			await pool.query("UPDATE confirmed_load SET status= 1 WHERE c_load_id=? AND Did = ?", [
				c_load_id,
				req.body.Did,
			]);
			const trip = await pool.query(
				"SELECT * FROM `trip` WHERE c_load_id = ? AND Did = ? AND client_id = ?",
				[c_load_id, driver, client]
			);
			if (trip.length === 0) {
				const date_ver = new Date();
				const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
				const time = moment.utc(date_ver).utcOffset("+05:30").format("hh:mm a");
				const tot_time = `${date} ${time}`;

				const tripId = await pool.query(
					"INSERT INTO `trip`(`c_load_id`, `start_time`, `Did`, `status`,`client_id`,`t_id`,`subFlag`, `vehicle_id`) VALUES  (?,?,?,?,?,?,?,?)",
					[c_load_id, tot_time, driver, 0, client, tid, load.subFlag, check[0].vehicle_id]
				);
				const trip_id = tripId.insertId;

				sendTrack(load.start_mob, load.end_mob, load.inter_mob, req.body.load, trip_id);

				await pool.query("INSERT INTO `otp`(`trip_id`) VALUES (?)", [trip_id]);
				await pool.query(
					"INSERT INTO `accounts`(`trip_id`, `loadId`, `tId`, `Did`, `cId`, `vId`) VALUES (?,?,?,?,?,?)",
					[trip_id, req.body.load, tid, req.body.Did, client, check[0].vehicle_id]
				);
				if (flag == 0) {
					dbFire
						.ref(`/${loadUrl}/${req.body.load}`)
						.update({
							update: `${Math.random()}`,
						})
						.then(async () => {
							let message = new gcm.Message({
								data: {
									key1: "msg1",
									loadId: req.body.load,
									type: "trip_info",
									tripId: trip_id,
									title: "New Notification",
									icon: "ic_launcher",
									body: `Trip status updated for Booking Id ${req.body.load}`,
								},
							});
							const fcm = await pool.query(
								"SELECT fcm_token FROM `trans_tab` WHERE id = ?",
								[tid]
							);
							let regTokens = [`${fcm[0].fcm_token}`];
							sender.send(
								message,
								{
									registrationTokens: regTokens,
								},
								function (err, response) {
									if (err) console.error(error);
									else {
										if (response) {
											console.log(response);
										}
									}
								}
							);
						});

					dbFire
						.ref(`/${firebaseUrl}/${driver}`)
						.update({
							trip: `${client}`,
						})
						.then(function () {
							return res.send({
								msg: "You have successfully confirmed the load..",
								trip_id: trip_id,
								code: 1,
							});
						})
						.catch(function () {
							console.log("Here");
							return res.send({
								code: 0,
							});
						});
				} else {
					return res.send({
						msg: "You have successfully confirmed the load..",
						trip_id: trip_id,
						code: 1,
					});
				}
			} else {
				dbFire
					.ref(`/${firebaseUrl}/${driver}`)
					.update({
						trip: `${client}`,
					})
					.then(function () {
						return res.send({
							msg: "You have successfully confirmed the load..",
							trip_id: trip[0].trip_id,
							code: 1,
						});
					})
					.catch(function (error) {
						console.log("Here2", error);
						return res.send({
							code: 0,
						});
					});
			}
		} else {
			res.send({
				result: "Driver not mapped with any vehicle",
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/otp_send", async (req, res) => {
	try {
		function generateOTP() {
			// Declare a digits variable which stores all digits
			const digits = "0123456789";
			let OTP = "";
			for (let i = 0; i < 6; i++) {
				OTP += digits[Math.floor(Math.random() * 10)];
			}
			return OTP;
		}
		const otp = generateOTP();
		const data = req.body.data;
		const load = req.body.load;

		await pool.query("UPDATE otp SET otp=?,point=? WHERE trip_id=?", [
			otp,
			data,
			req.body.trip,
		]);

		await pool.query("INSERT INTO `otp_hist`(`trip_id`,`otp`,`point`) VALUES (?,?,?)", [
			req.body.trip,
			otp,
			data,
		]);
		dbFire
			.ref(`/${loadUrl}/${load}`)
			.update({
				update: `${Math.random()}`,
			})
			.then(async () => {
				let message = new gcm.Message({
					data: {
						key1: "msg1",
						loadId: load,
						type: "trip_info",
						tripId: req.body.trip,
						title: "New Notification",
						icon: "ic_launcher",
						body: `Trip status updated for Booking Id ${load}`,
					},
				});
				const fcm = await pool.query(
					"SELECT fcm_token FROM `trans_tab` INNER JOIN trip ON trip.t_id = trans_tab.id WHERE trip.trip_id = ?",
					[req.body.trip]
				);
				let regTokens = [`${fcm[0].fcm_token}`];
				sender.send(
					message,
					{
						registrationTokens: regTokens,
					},
					function (err, response) {
						if (err) console.error(error);
						else {
							if (response) {
								console.log(response);
							}
						}
					}
				);
			});

		await send_mob(otp, data, load);
		return res.send({
			msg: otp,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/after_otp_checked", async (req, res) => {
	try {
		const date = new Date();
		const dateAdvn = moment.utc(date).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");

		await pool.query("UPDATE otp_hist SET otp_verf_time=?,status=? WHERE otp=?", [
			dateAdvn,
			1,
			req.body.otp,
		]);
		await pool.query("UPDATE trip SET status=? WHERE trip_id=?", [1, req.body.trip]);

		const load = await pool.query(
			"SELECT load_post.load_id FROM `trip` INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.trip_id = ?",
			[req.body.trip]
		);
		dbFire
			.ref(`/${loadUrl}/${load[0].load_id}`)
			.update({
				update: `${Math.random()}`,
			})
			.then(async () => {
				let message = new gcm.Message({
					data: {
						key1: "msg1",
						loadId: load[0].load_id,
						tripId: req.body.trip,
						type: "trip_info",
						title: "New Notification",
						icon: "ic_launcher",
						body: `Trip status updated for Booking Id ${load[0].load_id}`,
					},
				});
				const fcm = await pool.query(
					"SELECT fcm_token FROM `trans_tab` INNER JOIN trip ON trip.t_id = trans_tab.id WHERE trip.trip_id = ?",
					[req.body.trip]
				);
				let regTokens = [`${fcm[0].fcm_token}`];
				sender.send(
					message,
					{
						registrationTokens: regTokens,
					},
					function (err, response) {
						if (err) console.error(error);
						else {
							if (response) {
								console.log(response);
							}
						}
					}
				);
			});
		return res.send({
			msg: "OK flag is changed",
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/confirm_load", async (req, res) => {
	try {
		const date_ver = new Date();
		const confi_time = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");

		await pool.query(
			"INSERT INTO confirmed_load (vehicle_id,Did,conf_time,status,load_id) VALUES (?,?,?,?,?)",
			[req.body.v_id, req.body.Did, confi_time, 0, req.body.l_id]
		);

		return res.send({
			msg: "You have successfully confirmed the load..",
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/tripAuth", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					msg: "Connection Error",
					code: 0,
				});
			} else {
				const date = new Date();
				const dateAdvn = moment.utc(date).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");

				const load = await pool.query(
					"SELECT load_post.load_id,trip.subFlag FROM `trip` INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.trip_id = ?",
					[fields.trip]
				);
				dbFire
					.ref(`/${loadUrl}/${load[0].load_id}`)
					.update({
						update: `${Math.random()}`,
					})
					.then(async () => {
						console.log(load[0].load_id, fields.trip);

						let message = new gcm.Message({
							data: {
								key1: "msg1",
								loadId: load[0].load_id,
								tripId: fields.trip,
								type: load[0].subFlag == "0" ? "trip_info" : "subscription",
								title: "New Notification",
								icon: "ic_launcher",
								body:
									load[0].subFlag == "0"
										? `Trip status updated for Booking Id ${load[0].load_id}`
										: `A pic has been added for Booking Id ${load[0].load_id}`,
							},
						});

						const fcm = await pool.query(
							"SELECT fcm_token FROM `trans_tab` INNER JOIN trip ON trip.t_id = trans_tab.id WHERE trip.trip_id = ?",
							[fields.trip]
						);
						let regTokens = [`${fcm[0].fcm_token}`];
						sender.send(
							message,
							{
								registrationTokens: regTokens,
							},
							function (err, response) {
								if (err) console.error(error);
								else {
									if (response) {
										console.log(response);
									}
								}
							}
						);
					});

				if (files.start_time_pic) {
					let oldpath = files.start_time_pic.path;
					let newpath = `./public/images/start_time_pic/${fields.vehicle_num}${fields.trip}.jpg`;
					fs.rename(oldpath, newpath, async error => {
						if (error) {
							console.error(error);
							apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.send({
								msg: "Connection Error",
								code: 0,
							});
						}
						console.log("Success");
						const trip = {
							start_time_pic: `${fields.vehicle_num}${fields.trip}.jpg`,
							trip_id: fields.trip,
						};
						const trip_auth = await pool.query(
							"SELECT * FROM `trip_auth`WHERE trip_id = ? AND start_time_pic = ?",
							[trip.trip_id, trip.start_time_pic]
						);

						if (trip_auth.length === 0) {
							await pool.query(
								"INSERT INTO `trip_auth`(`trip_id`, `start_time_pic`, `start_pic_time`) VALUES (?,?,?)",
								[trip.trip_id, trip.start_time_pic, dateAdvn]
							);
							const tripInfo = await pool.query(
								"SELECT * FROM `trip` WHERE trip_id = ?",
								[trip.trip_id]
							);

							await pool.query(
								"INSERT INTO `notification`(`load_id`, `trip_id`, `client_id`, `Did`, `status`) VALUES (?,?,?,?,?)",
								[
									load[0].load_id,
									tripInfo[0].trip_id,
									tripInfo[0].client_id,
									tripInfo[0].Did,
									1,
								]
							);
							return res.send({
								msg: "Start Riding",
								code: 1,
							});
						} else {
							return res.send({
								msg: "Start Riding",
								code: 1,
							});
						}
					});
				} else if (files.intermediate_pic) {
					let oldpath = files.intermediate_pic.path;
					let newpath = `./public/images/intermediate_pic/${fields.vehicle_num}${fields.trip}${fields.flag}.jpg`;
					fs.rename(oldpath, newpath, async error => {
						if (error) {
							console.error(error);
							apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.send({
								msg: "Connection Error",
								code: 0,
							});
						}
						console.log("Success");
						if (fields.flag == 0) {
							const trip = {
								intermediate_pic: `${fields.vehicle_num}${fields.trip}${fields.flag}.jpg`,
							};
							await pool.query(
								"UPDATE trip_auth SET intermediate_pic = ?,intermediate_endtime = ? WHERE trip_id = ?",
								[trip.intermediate_pic, dateAdvn, fields.trip]
							);
						} else {
							const inter = await pool.query(
								"SELECT intermediate_pic FROM trip_auth WHERE trip_id = ?",
								[fields.trip]
							);
							const trip = {
								intermediate_pic: `${inter[0].intermediate_pic}#${fields.vehicle_num}${fields.trip}${fields.flag}.jpg`,
							};
							await pool.query(
								"UPDATE trip_auth SET intermediate_pic = ? WHERE trip_id = ?",
								[trip.intermediate_pic, fields.trip]
							);
						}
						const interTime = await pool.query(
							"SELECT `intermediate_endtime` FROM `trip` WHERE trip_id = ?",
							[fields.trip]
						);

						await pool.query(
							"UPDATE `trip` SET `intermediate_endtime`= ? WHERE trip_id = ?",
							[`${interTime[0].intermediate_endtime}#${dateAdvn}`, fields.trip]
						);
						return res.send({
							msg: "Start Riding",
							code: 1,
						});
					});
				} else if (files.end_pic) {
					let oldpath = files.end_pic.path;
					let newpath = `./public/images/end_pic/${fields.vehicle_num}${fields.trip}.jpg`;
					fs.rename(oldpath, newpath, async error => {
						if (error) {
							console.error(error);
							apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.send({
								msg: "Connection Error",
								code: 0,
							});
						}
						console.log("Success");
						const trip = {
							end_pic: `${fields.vehicle_num}${fields.trip}.jpg`,
						};
						await pool.query(
							"UPDATE trip_auth SET end_pic = ?,end_pic_time = ? WHERE trip_id = ?",
							[trip.end_pic, dateAdvn, fields.trip]
						);
						return res.send({
							msg: "Trip Complete",
							code: 1,
						});
					});
				} else {
					return res.send({
						msg: "Connection Error",
						code: 0,
					});
				}
			}
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/pod", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					msg: "Connection Error",
					code: 0,
				});
			} else {
				if (files.pic_pathee) {
					const filename = `${fields.vehicle_num}${fields.trip}${Math.floor(
						new Date().getTime() / 1000
					)}.jpg`;
					let oldpath = files.pic_pathee.path;
					let newpath = `./public/images/pod/${filename}`;
					fs.rename(oldpath, newpath, async error => {
						if (error) {
							console.error(error);
							apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.send({
								msg: "Connection Error",
								code: 0,
							});
						}
						console.log("Success POD");
						const pod = {
							pic_pathee: filename,
						};

						await pool.query(
							"INSERT INTO `pod_pic`(`pic_pathee`,`trip_id`) VALUES (?,?)",
							[pod.pic_pathee, fields.trip]
						);
						return res.send({
							code: 1,
						});
					});
				}
				if (files.signature) {
					let oldpath = files.signature.path;
					let newpath = `./public/images/signature/${fields.vehicle_num}${fields.trip}.3gp`;
					fs.rename(oldpath, newpath, async error => {
						if (error) {
							console.error(error);
							apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.send({
								msg: "Connection Error",
								code: 0,
							});
						}
						console.log("Success POD2");
						const pod = {
							signature: `${fields.vehicle_num}${fields.trip}.3gp`,
						};
						await pool.query("UPDATE pod_pic SET signature = ? WHERE trip_id = ?", [
							pod.signature,
							fields.trip,
						]);
						return res.send({
							msg: "Signature Added",
							code: 1,
						});
					});
				}
			}
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/turnOffd", async (req, res) => {
	try {
		await pool.query("UPDATE main_map SET d_av = 1 WHERE vehicle_id = ?", [req.body.v_id]);
		const Did = req.body.Did;
		dbFire
			.ref(`/${firebaseUrl}/${Did}`)
			.update({
				d_av: "1",
			})
			.then(function () {
				return res.send({
					code: 1,
				});
			})
			.catch(function () {
				return res.send({
					code: 0,
					msg: "Server Error",
				});
			});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/turnOnd", async (req, res) => {
	try {
		await pool.query("UPDATE main_map SET d_av = 0 WHERE vehicle_id = ?", [req.body.v_id]);
		const Did = req.body.Did;
		dbFire
			.ref(`/${firebaseUrl}/${Did}`)
			.update({
				d_av: "0",
			})
			.then(function () {
				return res.send({
					code: 1,
				});
			})
			.catch(function () {
				return res.send({
					code: 0,
					msg: "Server Error",
				});
			});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/trip_complete", async (req, res) => {
	try {
		const latlo = req.body.latlo;

		console.log(req.body);

		if (req.body.trip) {
			await pool.query("UPDATE confirmed_load SET status = 2 WHERE load_id = ?", [
				req.body.load,
			]);
			await pool.query("UPDATE load_post SET status = ? WHERE load_id = ?", [
				2,
				req.body.load,
			]);
			dbFire
				.ref(`/${loadUrl}/${req.body.load}`)
				.update({
					update: `${Math.random()}`,
				})
				.then(async () => {
					let message = new gcm.Message({
						data: {
							key1: "msg1",
							loadId: req.body.load,
							tripId: req.body.trip,
							type: "trip_info",
							title: "New Notification",
							icon: "ic_launcher",
							body: `Trip status updated for Booking Id ${req.body.load}`,
						},
					});
					const fcm = await pool.query(
						"SELECT fcm_token FROM `trans_tab` INNER JOIN trip ON trip.t_id = trans_tab.id WHERE trip.trip_id = ?",
						[req.body.trip]
					);

					let regTokens = [`${fcm[0].fcm_token}`];
					sender.send(
						message,
						{
							registrationTokens: regTokens,
						},
						function (err, response) {
							if (err) console.error(error);
							else {
								if (response) {
									console.log(response);
								}
							}
						}
					);
				});
			let gps_val;
			const gps = await pool.query("SELECT `gps_val` FROM `path_gen` WHERE trip_id=?", [
				req.body.trip,
			]);
			if (gps.length) {
				if (gps[0].gps_val == null) {
					gps_val = latlo;
				} else {
					gps_val = `${gps[0].gps_val}^${latlo}`;
				}
				await pool.query("UPDATE `path_gen` SET `gps_val`= ? WHERE trip_id = ?", [
					gps_val,
					req.body.trip,
				]);
			} else {
				await pool.query("INSERT INTO path_gen(trip_id,gps_val) VALUES(?,?)", [
					req.body.trip,
					latlo,
				]);
			}

			const gpsNew = await pool.query("SELECT `gps_val` FROM `path_gen` WHERE trip_id=?", [
				req.body.trip,
			]);

			const calDistance = calcDistance(gpsNew[0].gps_val.split("^"));

			const date = new Date();
			const dateAdvn = moment.utc(date).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");
			let lateTime = parseFloat(req.body.late_time) - 360;

			await pool.query(
				"UPDATE trip SET status = ?,vehicle_id=?,final_endtime = ?,distance = ?,late_time = ? WHERE trip_id = ?",
				[2, req.body.vid, dateAdvn, calDistance, lateTime, req.body.trip]
			);

			const trip = await pool.query("SELECT * FROM `trip` WHERE trip_id = ?", [
				req.body.trip,
			]);

			await pool.query(
				"INSERT INTO `notification`(`load_id`, `trip_id`, `client_id`, `Did`, `status`) VALUES (?,?,?,?,?)",
				[req.body.load, req.body.trip, trip[0].client_id, req.body.Did, 2]
			);
			const pay_cli = await pool.query(
				"select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,cli_acc.amount,((pay_cli.amount)*90/100 - cli_acc.amount) AS NEW_BAL FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=0 AND trip.Did = ?;select pay_cli.amount,cli_acc.trip_id,trip.Did,cli_acc.amount AS sub FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=2 AND trip.Did = ?",
				[req.body.Did, req.body.Did]
			);
			let tot = 0,
				remaining = 0;

			if (pay_cli[0].length > 0 && pay_cli[1].length > 0) {
				let sub = pay_cli[1];
				let acc = pay_cli[0];
				for (let i = 0; i < acc.length; i++) {
					for (let j = 0; j < sub.length; j++) {
						if (sub[j].trip_id == acc[i].trip_id) {
							let final = parseInt(acc[i].NEW_BAL, 10) - parseInt(sub[j].sub, 10);
							if (final > 0) {
								tot = tot + final;
								break;
							} else {
								tot = tot + final;
								break;
							}
						}
					}
				}

				const pay_cli_details = await pool.query(
					"select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,cli_acc.amount,((pay_cli.amount)*90/100 - cli_acc.amount) AS NEW_BAL FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=0 AND trip.Did = ? AND trip.trip_id = ?;select pay_cli.amount,cli_acc.trip_id,trip.Did,cli_acc.amount AS sub FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=2 AND trip.Did = ? AND trip.trip_id = ?",
					[req.body.Did, req.body.trip, req.body.Did, req.body.trip]
				);
				let subs = pay_cli_details[1];
				let newBal = pay_cli_details[0];
				for (let j = 0; j < subs.length; j++) {
					remaining = newBal[0].NEW_BAL - parseInt(subs[j].sub, 10);
				}

				await pool.query(
					"INSERT INTO `pay_driver`(`trip_id`, `Did`, `remaining`) VALUES (?,?,?)",
					[req.body.trip, req.body.Did, remaining]
				);
				const driver_rem = await pool.query("SELECT * FROM `driver_rem` WHERE Did = ?", [
					req.body.Did,
				]);

				if (driver_rem.length > 0) {
					const driverRem = parseInt(remaining, 10) + parseInt(driver_rem[0].total, 10);

					await pool.query("UPDATE `driver_rem` SET `total`= ? WHERE Did = ?", [
						driverRem,
						req.body.Did,
					]);

					dbFire.ref(`/${firebaseUrl}/${req.body.Did}`).update({
						trip: "0",
					});
					return res.send({
						code: 1,
						msg: "Complete",
					});
				} else {
					await pool.query("INSERT INTO `driver_rem`(`Did`, `total`) VALUES (?,?)", [
						req.body.Did,
						tot,
					]);
					dbFire.ref(`/${firebaseUrl}/${req.body.Did}`).update({
						trip: "0",
					});
					return res.send({
						code: 1,
						msg: "Complete",
					});
				}
			} else {
				dbFire.ref(`/${firebaseUrl}/${req.body.Did}`).update({
					trip: "0",
				});
				return res.send({
					code: 1,
					msg: "Complete",
				});
			}
		} else {
			return res.send({
				code: 1,
				msg: "Complete",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

function calcDistance(location) {
	let sum = 0;
	for (let i = 1; i < location.length; i++) {
		let loc = location[i - 1].split(",");
		let lat1 = parseFloat(parseFloat(loc[0]).toFixed(4));
		let lon1 = parseFloat(parseFloat(loc[1]).toFixed(4));

		let curLoc = location[i].split(",");
		let lat2 = parseFloat(parseFloat(curLoc[0]).toFixed(4));
		let lon2 = parseFloat(parseFloat(curLoc[1]).toFixed(4));

		let R = 6371; // Radius of the earth in km
		let dLat = deg2rad(lat2 - lat1); // deg2rad below
		let dLon = deg2rad(lon2 - lon1);
		let a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(deg2rad(lat1)) *
				Math.cos(deg2rad(lat2)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		let d = R * c; // Distance in km
		if (!Number.isNaN(d)) {
			sum = sum + d;
		}
	}

	return sum;
}

function deg2rad(deg) {
	return deg * (Math.PI / 180);
}

router.post("/path_gen", async (req, res) => {
	try {
		const date_ver = new Date();
		const dateTime = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY HH:mm");

		const type = req.body.type;
		const latlo = req.body.latlo;
		const trip = req.body.trip;
		const v_id = req.body.v_id;
		const Did = req.body.Did;
		const distance = req.body.distance;
		const latest = latlo.split("^");
		let gps_val;
		if (type == 1) {
			dbFire
				.ref(`/${firebaseUrl}/${Did}`)
				.update({
					location: `${latest[latest.length - 1]}`,
					lastUpdated: dateTime,
				})
				.then(async () => {
					const gps = await pool.query(
						"SELECT `gps_val` FROM `path_gen` WHERE trip_id=?",
						[trip]
					);
					if (gps.length) {
						if (gps[0].gps_val == null) {
							gps_val = latlo;
						} else {
							gps_val = `${gps[0].gps_val}^${latlo}`;
						}
						await pool.query("UPDATE `path_gen` SET `gps_val`= ? WHERE trip_id = ?", [
							gps_val,
							trip,
						]);
					} else {
						await pool.query("INSERT INTO path_gen(trip_id,gps_val) VALUES(?,?)", [
							trip,
							latlo,
						]);
					}

					const gpsNew = await pool.query(
						"SELECT `gps_val` FROM `path_gen` WHERE trip_id=?",
						[trip]
					);

					const calDistance = calcDistance(gpsNew[0].gps_val.split("^"));
					await pool.query("UPDATE `trip` SET `distance`= ? WHERE trip_id = ?", [
						calDistance,
						trip,
					]);
					await pool.query(
						"UPDATE `main_map` SET `gps_val`= ?,lastUpdated = ? WHERE Did = ?",
						[latest[latest.length - 1], dateTime, Did]
					);
					return res.send({
						msg: "gps Added",
						code: 1,
					});
				})
				.catch(function () {
					res.send({
						code: 0,
						msg: "Server Error",
					});
				});
		} else {
			dbFire
				.ref(`/${firebaseUrl}/${Did}`)
				.update({
					location: `${latest[latest.length - 1]}`,
					lastUpdated: dateTime,
				})
				.then(async () => {
					await pool.query(
						"UPDATE `main_map` SET `gps_val`= ?,lastUpdated = ? WHERE Did = ?",
						[latest[latest.length - 1], dateTime, Did]
					);
					return res.send({
						code: 1,
					});
				})
				.catch(function () {
					return res.send({
						code: 0,
						msg: "Server Error",
					});
				});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/rate", async (req, res) => {
	try {
		await pool.query("INSERT INTO `rating`(`final_rate`, `trip_id`) VALUES (?,?)", [
			req.body.rate,
			req.body.trip,
		]);
		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/count", async (req, res) => {
	try {
		const body = {
			...req.body,
		};

		let data = [];

		if (body.type === "start" || body.type === "end") {
			data = await pool.query(
				"SELECT loadInfo.*,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc FROM `loadInfo` INNER JOIN load_post ON load_post.load_id = loadInfo.loadId WHERE loadId = ? AND loadInfo.type = ? AND loadType = 'Pieces'",
				[body.loadId, body.type === "start" ? "pickup" : "drop"]
			);
		} else {
			const temp = await pool.query(
				"SELECT loadInfo.*,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc FROM `loadInfo` INNER JOIN load_post ON load_post.load_id = loadInfo.loadId WHERE loadId = ? AND loadInfo.type NOT IN ('pickup','drop') AND loadType = 'Pieces'",
				[body.loadId]
			);
			for (let i = 0; i < temp.length; i++) {
				console.log(temp[i].type.split("_")[0], body.type, temp[i]);
				if (temp[i].type.split("_")[0] == body.type) {
					data.push(temp[i]);
				}
			}
		}

		return res.send({
			code: 1,
			data: data,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/difference", async (req, res) => {
	try {
		const body = {
			...req.body,
		};

		await pool.query("UPDATE `loadInfo` SET `difference`= ? WHERE loadId = ? AND type = ?", [
			body.difference,
			body.loadId,
			body.type === "start" ? "pickup" : body.type === "end" ? "drop" : body.type,
		]);

		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/updateRoute", async (req, res) => {
	try {
		const body = {
			...req.body,
		};

		if (body.tripId) {
			const [data] = await pool.query(
				"SELECT load_post.*,users.name,driver_tab.d_name,vehicle_table.v_num FROM `trip` INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN users ON users.id = trip.client_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.trip_id = ?",
				[body.tripId]
			);

			const text = `Driver ${data.d_name.substring(0, 20)}(${
				data.v_num
			}) has changed his route. Booking Id- ${data.load_id}.
From ${data.pickup_location.substring(0, 20)}
To ${data.last_point.substring(0, 20)}.
-RoadExpress`;

			const url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=8210762095&authkey=${authkey}&message=${text}&DLT_TE_ID=1207161964042125134`;

			http.get(url, function (resp) {
				resp.on("data", function (chunk) {
					console.log(chunk);
				});
			}).on("error", function (e) {
				console.log("Got error: " + e.message);
			});
		}

		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/checkRoute", async (req, res) => {
	try {
		const body = {
			...req.body,
		};

		const trip = await pool.query(
			"SELECT * FROM `route` WHERE tripId = ? AND start = ? AND end = ?",
			[body.tripId, body.start, body.end]
		);

		if (trip.length) {
			return res.send({
				code: 1,
				data: trip[0].route,
			});
		} else {
			if (body.route) {
				await pool.query(
					"INSERT INTO `route` (`tripId`, `start`, `end`, `route`) VALUES (?,?,?,?)",
					[body.tripId, body.start, body.end, body.route]
				);
			}
			return res.send({
				code: 1,
				data: body.route,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

function sendConfirm(
	start,
	end,
	inter_mob,
	name,
	quan,
	type,
	insurance_num,
	load,
	client,
	pickup,
	drop
) {
	let mob = JSON.parse(inter_mob);
	let num = [];
	num.push(`91${start}`, `91${end}`);

	if (typeof mob == "string") {
		num.push(`91${mob}`);
	} else {
		for (let i = 0; i < mob.length; i++) {
			num.push(`91${mob[i]}`);
		}
	}

	const phn = num.join();

	let text = `Dear customer, your consignment has been placed.
		Booking id:- ${load}
		Name:- ${client.substring(0, 20)}
		Pickup location- ${pickup.substring(0, 20)}
		Drop location- ${drop.substring(0, 20)}.
		-RoadExpress`;

	text = `${text}`;

	// let msg = `An load has been placed with booking id ${load}`;
	let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=#######&mobiles=${phn}&authkey=${authkey}&message=${text}&DLT_TE_ID=1207161964059451179`;

	http.get(url, function (resp) {
		resp.on("data", function (chunk) {
			console.log(chunk);
		});
	}).on("error", function (e) {
		console.log("Got error: " + e.message);
	});
}

module.exports = router;
