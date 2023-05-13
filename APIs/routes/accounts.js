const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const moment = require("moment");
const gcm = require("node-gcm");
const { ensureAuthenticatedAdmin } = require("../helper/auth");
const firebase = require("firebase-admin");

const { dashLogger } = require("../helper/logger");

router.get("/clientWise", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT id,name FROM users WHERE flag = 0");
		return res.render("admin/clientWise", {
			client: data,
			currentClient: null,
			history: null,
			adv: null,
			ledger: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);npn
		return res.redirect("/400");
	}
});

router.get("/clientWise/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT * FROM users WHERE id = ?;SELECT trip.*,pay_cli.*,cli_rem.*,cli_advn.*,accounts.*,load_post.pickup_location,load_post.last_point,load_post.amount,load_post.clientAmount,vehicle_table.v_type,vehicle_table.v_num,users.name AS 'client',trans_tab.name AS 'trans',driver_tab.d_name AS 'driver',trip.trip_id AS 'tripId' FROM `trip` LEFT JOIN pay_cli ON pay_cli.trip_id = trip.trip_id LEFT JOIN cli_rem ON cli_rem.client_id = trip.client_id LEFT JOIN cli_advn ON cli_advn.client_id = trip.client_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id LEFT JOIN cities ON cities.id = load_post.city INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN accounts ON accounts.trip_id = trip.trip_id INNER JOIN users ON users.id = trip.client_id INNER JOIN trans_tab ON trans_tab.id = trip.t_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did WHERE trip.client_id = ? AND trip.status = 2 ORDER BY trip.trip_id DESC;SELECT * FROM `cli_advn` WHERE client_id = ?;SELECT trip.trip_id,trip.start_time,trip.final_endtime,cli_acc.*,load_post.pickup_location,load_post.last_point,driver_tab.d_name,trip.vehicle_id,vehicle_table.v_num FROM `trip` INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN confirmed_load on confirmed_load.c_load_id=trip.c_load_id INNER JOIN load_post on load_post.load_id=confirmed_load.load_id inner JOIN driver_tab ON driver_tab.Did = trip.Did LEFT JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.client_id = ? ORDER BY trip.trip_id;SELECT id,name FROM users WHERE flag = 0",
			[req.params.id, req.params.id, req.params.id, req.params.id, req.params.id]
		);

		for (let i = 0; i < data[1].length; i++) {
			data[1][i]["pod"] = "NOT RECEIVED";
			const check = await pool.query(
				"SELECT * FROM `pod_pic` WHERE trip_id = ? AND confirm = 1",
				[data[1][i].tripId]
			);
			if (check.length) {
				data[1][i]["pod"] = "RECEIVED";
			}
		}

		return res.render("admin/clientWise", {
			client: data[4],
			currentClient: data[0],
			history: data[1],
			adv: data[2],
			ledger: data[3],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/edit/:tripId", async (req, res) => {
	try {
		const { tripId } = req.params;
		const data = await pool.query(
			"SELECT trip.*,pay_cli.*,cli_rem.*,cli_advn.*,accounts.*,load_post.pickup_location,load_post.last_point,load_post.amount,load_post.clientAmount,vehicle_table.v_num,vehicle_table.v_type,users.name AS 'client',trans_tab.name AS 'trans',driver_tab.d_name AS 'driver',trip.trip_id AS 'tripId',trip.client_id AS 'client_Id' FROM `trip` LEFT JOIN pay_cli ON pay_cli.trip_id = trip.trip_id LEFT JOIN cli_rem ON cli_rem.client_id = trip.client_id LEFT JOIN cli_advn ON cli_advn.client_id = trip.client_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id LEFT JOIN cities ON cities.id = load_post.city INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN accounts ON accounts.trip_id = trip.trip_id INNER JOIN users ON users.id = trip.client_id INNER JOIN trans_tab ON trans_tab.id = trip.t_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did WHERE trip.trip_id = ? AND trip.status = 2 ORDER BY trip.trip_id DESC",
			[tripId]
		);

		for (let i = 0; i < data.length; i++) {
			data[i]["pod"] = "NOT RECEIVED";
			const check = await pool.query(
				"SELECT * FROM `pod_pic` WHERE trip_id = ? AND confirm = 1",
				[data[i].tripId]
			);
			if (check.length) {
				data[i]["pod"] = "RECEIVED";
			}
		}

		return res.render("admin/edit", {
			data: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/edit", ensureAuthenticatedAdmin(), async (req, res) => {
	const body = {
		...req.body,
	};
	console.log(body);
	const currentDate = new Date();
	const date = moment.utc(currentDate).utcOffset("+05:30").format("DD/MM/YYYY HH:mm");
	try {
		await pool.query(
			"UPDATE `accounts` SET `date`= ?,`unloading`= ?,`detention`= ?,`returnFare`= ?,`diesel`= ?,`clientAdv`= ?,`roadAdv`= ?,`driverPayStatus`= ?,`driverPayDate`= ?,`clientPayStatus`= ?,`invoice`= ?,`lrNo`= ? WHERE trip_id = ?",
			[
				body.date,
				body.unloading,
				body.detention,
				body.returnFare,
				body.diesel,
				body.clientAdv,
				body.roadAdv,
				body.driverPayStatus,
				body.driverPayStatus === "PAID" ? date : null,
				body.clientPayStatus,
				body.invoice,
				body.lrNo,
				body.tripId,
			]
		);
		if (body.pod === "RECEIVED") {
			await pool.query("UPDATE `pod_pic` SET `confirm`= 1 WHERE trip_id = ?", [body.tripId]);
		} else {
			await pool.query("UPDATE `pod_pic` SET `confirm`= 0 WHERE trip_id = ?", [body.tripId]);
		}
		req.flash("success_msg", "Advance Added");
		return res.redirect(`/accounts/clientWise/${body.client_Id}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/ledgerRem", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT rem FROM cli_rem WHERE client_id = ?", [
			req.body.client,
		]);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/path_gen", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT gps_val FROM path_gen WHERE trip_id = ?", [
			req.body.trip,
		]);
		return res.send({
			code: 1,
			result: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/latlo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT load_post.lat_long,load_post.last_lat_long,load_post.inter_lat_long FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.trip_id = ?",
			[req.body.trip]
		);
		res.send({
			code: 1,
			result: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/paymentInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT pay_cli.amount AS total,cli_acc.flag,cli_acc.amount FROM pay_cli LEFT JOIN cli_acc ON cli_acc.trip_id = pay_cli.trip_id WHERE pay_cli.trip_id = ?",
			[req.body.trip]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/info", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT pod_pic.pic_pathee,pod_pic.signature,trip_auth.start_time_pic,trip_auth.intermediate_pic,trip_auth.end_pic FROM pod_pic LEFT JOIN trip_auth ON trip_auth.trip_id = pod_pic.trip_id WHERE pod_pic.trip_id = ?",
			[req.body.trip]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/cliAdvn", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT `id`, `name` FROM `users` WHERE `confirmed` = ?", [
			2,
		]);
		return res.render("admin/cliAdvn", {
			client: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addCliAdvn", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const date = new Date();
		const dateAdvn = moment.utc(date).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");
		const advance = {
			adv: req.body.amount,
			cheque: req.body.cheque,
			online: req.body.online,
			mode: req.body.mode,
			client_id: req.body.client,
		};
		await pool.query(
			"INSERT INTO `cli_advn`(`adv`, `date_1`, `cheque`, `online`, `mode`, `client_id`) VALUES (?,?,?,?,?,?)",
			[advance.adv, dateAdvn, advance.cheque, advance.online, advance.mode, advance.client_id]
		);
		const cli_rem = await pool.query("SELECT * FROM cli_rem WHERE client_id = ?", [
			advance.client_id,
		]);
		if (cli_rem.length) {
			let rem = parseInt(advance.adv, 10) + parseInt(cli_rem[0].rem, 10);
			let remain = parseInt(advance.adv, 10) + parseInt(cli_rem[0].rem, 10);

			if (rem >= 0) {
				const pay_cli = await pool.query(
					"SELECT * FROM pay_cli WHERE paid = 0 AND client_id = ?",
					[req.body.client]
				);

				for (let i = 0; i < pay_cli.length; i++) {
					rem = rem - parseInt(pay_cli[i].remaining, 10);
					await pool.query("INSERT INTO cli_acc(trip_id,flag,amount) VALUES (?,?,?)", [
						pay_cli[i].trip_id,
						1,
						pay_cli[i].remaining,
					]);
					await pool.query(
						"UPDATE pay_cli SET paid = 1,remaining = 0 WHERE trip_id = ?",
						[pay_cli[i].trip_id]
					);
				}

				await pool.query("UPDATE cli_rem SET rem = ? WHERE client_id = ?", [
					remain,
					req.body.client,
				]);
			} else {
				await pool.query("UPDATE `cli_rem` SET `rem`= ? WHERE `client_id` = ?", [
					remain,
					req.body.client,
				]);
			}
		} else {
			await pool.query("INSERT INTO cli_rem(rem,client_id) VALUES (?,?)", [
				advance.adv,
				advance.client_id,
			]);
		}
		req.flash("success_msg", "Advance Added");
		return res.redirect("/accounts/cliAdvn");
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/transWise", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT id,name FROM trans_tab WHERE u_flag = 1");
		res.render("admin/transWise", {
			trans: result,
			currentTrans: null,
			history: null,
			ledger: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/transWise/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT id,name FROM trans_tab WHERE id = ?;SELECT trip.*,pay_cli.*,cli_rem.*,cli_advn.*,accounts.*,load_post.pickup_location,load_post.last_point,load_post.amount,load_post.clientAmount,vehicle_table.v_type,vehicle_table.v_num,users.name AS 'client',trans_tab.name AS 'trans',driver_tab.d_name AS 'driver',trip.trip_id AS 'tripId' FROM `trip` LEFT JOIN pay_cli ON pay_cli.trip_id = trip.trip_id LEFT JOIN cli_rem ON cli_rem.client_id = trip.client_id LEFT JOIN cli_advn ON cli_advn.client_id = trip.client_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id LEFT JOIN cities ON cities.id = load_post.city INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN accounts ON accounts.trip_id = trip.trip_id INNER JOIN users ON users.id = trip.client_id INNER JOIN trans_tab ON trans_tab.id = trip.t_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did WHERE trip.t_id = ? AND trip.status = 2 ORDER BY trip.trip_id DESC;SELECT trip.trip_id,trip.start_time,trip.final_endtime,cli_acc.*,load_post.pickup_location,load_post.last_point,driver_tab.d_name,trip.vehicle_id,vehicle_table.v_num FROM `trip` INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN confirmed_load on confirmed_load.c_load_id=trip.c_load_id INNER JOIN load_post on load_post.load_id=confirmed_load.load_id inner JOIN driver_tab ON driver_tab.Did = trip.Did LEFT JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? ORDER BY trip.trip_id;SELECT id,name FROM trans_tab WHERE u_flag = 1",
			[req.params.id, req.params.id, req.params.id, req.params.id, req.params.id]
		);
		res.render("admin/transWise", {
			trans: result[3],
			currentTrans: result[0],
			history: result[1],
			ledger: result[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/ledgerRemTrans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT SUM(pay_driver.remaining) AS rem, trip.t_id FROM trip INNER JOIN pay_driver ON trip.trip_id = pay_driver.trip_id WHERE trip.t_id = ?",
			[req.body.trans]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/driverWise", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT Did,d_name FROM driver_tab");
		return res.render("admin/driverWise", {
			driver: data,
			currentDriver: null,
			acc: null,
			sub: null,
			total: null,
			pending: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/driverWise/:Did", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT Did,d_name FROM driver_tab;SELECT Did,d_name FROM driver_tab WHERE Did = ?;select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,cli_acc.amount,((pay_cli.amount)*90/100 - cli_acc.amount) AS NEW_BAL,load_post.type,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,users.name FROM pay_cli LEFT JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id AND confirmed_load.Did = ? LEFT JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN users ON users.id = trip.client_id WHERE cli_acc.flag=0 AND trip.Did = ?;select pay_cli.amount,cli_acc.trip_id,trip.Did,cli_acc.amount AS sub FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=2 AND trip.Did = ?;SELECT `trip_id`, `Did`, `remaining`,`flag` FROM `pay_driver` WHERE Did = ?;SELECT `Did`, `total` FROM `driver_rem` WHERE Did = ?",
			[
				req.params.Did,
				req.params.Did,
				req.params.Did,
				req.params.Did,
				req.params.Did,
				req.params.Did,
			]
		);
		req.session.currentDid = data[1];
		return res.render("admin/driverWise", {
			driver: data[0],
			currentDriver: data[1],
			acc: data[2],
			sub: data[3],
			total: data[4],
			pending: data[5],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addDriverPayment", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const driverDetails = await pool.query("SELECT * FROM `driver_rem` WHERE Did = ?");
		if (driverDetails.length > 0) {
			const subPaid = req.body.amount;
			const paid = parseInt(driverDetails[0].total, 10) - parseInt(req.body.amount, 10);
			await pool.query("UPDATE `driver_rem` SET `total`= ? WHERE Did = ?", [
				paid,
				req.session.currentDid[0].Did,
			]);
			const trip = await pool.query(
				"SELECT `trip_id`, `Did`, `remaining`, `flag` FROM `pay_driver` WHERE Did = ? AND flag = 0 ORDER BY trip_id",
				[req.session.currentDid[0].Did]
			);
			if (trip.length > 0) {
				for (let i = 0; i < trip.length; i++) {
					if (parseInt(subPaid, 10) >= parseInt(trip[i].remaining, 10)) {
						subPaid = parseInt(subPaid, 10) - parseInt(trip[i].remaining, 10);
						await pool.query(
							"UPDATE `pay_driver` SET `remaining`= 0,`flag`= 1 WHERE Did = ? AND trip_id = ?",
							[req.session.currentDid[0].Did, trip[i].trip_id]
						);
					} else if (parseInt(subPaid, 10) > 0) {
						const money = parseInt(trip[i].remaining, 10) - parseInt(subPaid, 10);
						await pool.query(
							"UPDATE `pay_driver` SET `remaining`= ? WHERE Did = ? AND trip_id = ?",
							[money, req.session.currentDid[0].Did, trip[i].trip_id]
						);
						subPaid = 0;
					}
				}
				req.flash("success_msg", "Driver Paid");
				return res.redirect(`/accounts/driverWise/${req.session.currentDid[0].Did}`);
			} else {
				req.flash("success_msg", "Driver Paid");
				res.redirect(`/accounts/driverWise/${req.session.currentDid[0].Did}`);
			}
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

module.exports = router;
