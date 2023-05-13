const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const moment = require("moment");
const gcm = require("node-gcm");
const { ensureAuthenticatedAdmin } = require("../helper/auth");
const firebase = require("firebase-admin");

const { dashLogger } = require("../helper/logger");
const { firebaseUrl, loadUrl } = require("../utils/Constant");

//const dbFire = firebase.database();

router.get("/incomming", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT city,id FROM cities");
		return res.render("admin/incomming", {
			city: data,
			currentCity: null,
			trip: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/incomming/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT city FROM cities WHERE cities.id = ?;SELECT trip.*,load_post.*,users.name,driver_tab.d_name,driver_tab.phn,vehicle_table.v_num FROM trip INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) AND load_post.dest_city = ? INNER JOIN users ON users.id = trip.client_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = (SELECT main_map.vehicle_id FROM main_map WHERE main_map.Did = trip.Did) WHERE trip.status <> 2;SELECT city,id FROM cities",
			[req.params.id, req.params.id]
		);
		return res.render("admin/incomming", {
			currentCity: data[0],
			city: data[2],
			trip: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/outgoing", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT city,id FROM cities");
		return res.render("admin/outgoing", {
			city: data,
			currentCity: null,
			trip: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/outgoing/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT city FROM cities WHERE cities.id = ?;SELECT trip.*,load_post.*,users.name,driver_tab.d_name,driver_tab.phn,vehicle_table.v_num FROM trip INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) AND load_post.city = ? INNER JOIN users ON users.id = trip.client_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = (SELECT main_map.vehicle_id FROM main_map WHERE main_map.Did = trip.Did) WHERE trip.status <> 2;SELECT city,id FROM cities",
			[req.params.id, req.params.id]
		);
		return res.render("admin/outgoing", {
			currentCity: data[0],
			city: data[2],
			trip: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/trips", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT load_post.*,confirmed_load.c_load_id,confirmed_load.vehicle_id,confirmed_load.Did,confirmed_load.conf_time,confirmed_load.status as currentStatus,trip.*,otp.point,trip_auth.start_pic_time,trip_auth.end_pic_time,users.name,cities.city AS `source`,driver_tab.d_name,vehicle_table.v_num FROM load_post LEFT JOIN confirmed_load ON confirmed_load.load_id = load_post.load_id LEFT JOIN trip ON trip.c_load_id = confirmed_load.c_load_id LEFT JOIN driver_tab ON driver_tab.Did = confirmed_load.Did INNER JOIN cities ON load_post.city = cities.id LEFT JOIN otp ON otp.trip_id = trip.trip_id LEFT JOIN trip_auth ON trip_auth.trip_id = trip.trip_id LEFT JOIN vehicle_table ON vehicle_table.v_id = (SELECT main_map.vehicle_id FROM main_map WHERE main_map.Did = confirmed_load.Did) INNER JOIN users ON users.id = load_post.fromc WHERE load_post.status != '2' ORDER BY STR_TO_DATE(load_post.timef,'%d/%m/%Y') DESC;SELECT load_post.*,users.name,cities.city AS `source` FROM `load_post` INNER JOIN users ON users.id = load_post.fromc INNER JOIN cities ON cities.id = load_post.city WHERE addFlag = 1"
		);
		return res.render("admin/trips", {
			trip: data[0],
			extra: data[1],
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
			"SELECT load_post.lat_long,load_post.last_lat_long,load_post.inter_lat_long FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE trip.trip_id = ?",
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

router.post("/tripEnd", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { trip, loadId } = req.body;
		await pool.query("UPDATE confirmed_load SET status = 2 WHERE load_id = ?", [loadId]);
		await pool.query("UPDATE load_post SET status = ? WHERE load_id = ?", [2, loadId]);
		dbFire.ref(`/${loadUrl}/${loadId}`).update({
			update: `${Math.random()}`,
		});
		const date = new Date();
		const dateAdvn = moment.utc(date).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");
		let lateTime = -360;

		const tripDetails = await pool.query(
			"SELECT load_post.*,confirmed_load.vehicle_id AS vid,confirmed_load.Did FROM load_post LEFT JOIN confirmed_load ON confirmed_load.load_id = load_post.load_id WHERE load_post.load_id = ?",
			[loadId]
		);
		await pool.query(
			"UPDATE trip SET status = ?,vehicle_id=?,final_endtime = ?,distance = ?,late_time = ? WHERE trip_id = ?",
			[2, tripDetails[0].vid, dateAdvn, 0, lateTime, trip]
		);
		const tripInfo = await pool.query("SELECT * FROM `trip` WHERE trip_id = ?", [trip]);
		await pool.query(
			"INSERT INTO `notification`(`load_id`, `trip_id`, `client_id`, `Did`, `status`) VALUES (?,?,?,?,?)",
			[loadId, trip, tripInfo[0].client_id, tripDetails[0].Did, 2]
		);
		const pay_cli = await pool.query(
			"select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,cli_acc.amount,((pay_cli.amount)*90/100 - cli_acc.amount) AS NEW_BAL FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=0 AND trip.Did = ?;select pay_cli.amount,cli_acc.trip_id,trip.Did,cli_acc.amount AS sub FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=2 AND trip.Did = ?",
			[tripDetails[0].Did, tripDetails[0].Did]
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
			const pay_cliTrip = await pool.query(
				"select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,cli_acc.amount,((pay_cli.amount)*90/100 - cli_acc.amount) AS NEW_BAL FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=0 AND trip.Did = ? AND trip.trip_id = ?;select pay_cli.amount,cli_acc.trip_id,trip.Did,cli_acc.amount AS sub FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id WHERE cli_acc.flag=2 AND trip.Did = ? AND trip.trip_id = ?",
				[tripDetails[0].Did, trip, tripDetails[0].Did, trip]
			);
			let subs = pay_cliTrip[1];
			let newBal = pay_cliTrip[0];
			for (let j = 0; j < subs.length; j++) {
				remaining = newBal[0].NEW_BAL - parseInt(subs[j].sub, 10);
			}
			await pool.query(
				"INSERT INTO `pay_driver`(`trip_id`, `Did`, `remaining`) VALUES (?,?,?)",
				[trip, tripDetails[0].Did, remaining]
			);

			const driver_rem = await pool.query("SELECT * FROM `driver_rem` WHERE Did = ?", [
				tripDetails[0].Did,
			]);
			if (driver_rem.length > 0) {
				let driverRem = parseInt(remaining, 10) + parseInt(driver_rem[0].total, 10);

				await pool.query("UPDATE `driver_rem` SET `total`= ? WHERE Did = ?", [
					driverRem,
					tripDetails[0].Did,
				]);
				dbFire
					.ref(`/${firebaseUrl}/${tripDetails[0].Did}`)
					.update({
						trip: "0",
						update: "1",
					})
					.then(function () {
						req.flash("success_msg", "Trip Ended");
						return res.redirect("/survellance/trips");
					})
					.catch(function () {
						req.flash("success_msg", "Trip Ended");
						return res.redirect("/survellance/trips");
					});
			} else {
				await pool.query("INSERT INTO `driver_rem`(`Did`, `total`) VALUES (?,?)", [
					tripDetails[0].Did,
					tot,
				]);
				dbFire
					.ref(`/${firebaseUrl}/${tripDetails[0].Did}`)
					.update({
						trip: "0",
						update: "1",
					})
					.then(function () {
						req.flash("success_msg", "Trip Ended");
						return res.redirect("/survellance/trips");
					})
					.catch(function () {
						req.flash("success_msg", "Trip Ended");
						return res.redirect("/survellance/trips");
					});
			}
		} else {
			dbFire
				.ref(`/${firebaseUrl}/${tripDetails[0].Did}`)
				.update({
					trip: "0",
					update: "1",
				})
				.then(function () {
					req.flash("success_msg", "Trip Ended");
					return res.redirect("/survellance/trips");
				})
				.catch(function () {
					req.flash("success_msg", "Trip Ended");
					return res.redirect("/survellance/trips");
				});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/history", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT trip.trip_id,trip.start_time,trip.status,trip.final_endtime,users.name AS CliName,driver_tab.Did,driver_tab.d_name,driver_tab.phn,vehicle_table.v_num,trans_tab.name,trans_tab.mob,pay_cli.amount,pay_cli.remaining,load_post.pickup_location,load_post.last_point FROM `trip` INNER JOIN users ON users.id = trip.client_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN trans_tab ON trans_tab.id = trip.t_id INNER JOIN pay_cli ON pay_cli.trip_id = trip.trip_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.status = 2"
		);
		res.render("admin/history", {
			history: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/path_gen", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		console.log(req.body);
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

router.get("/trip/:trip", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT * FROM `trip_auth` INNER JOIN trip ON trip.trip_id = trip_auth.trip_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.trip_id = ?",
			[req.params.trip]
		);

		const interLen = data[0].intermediate_loc.split("^");

		res.render("admin/tripKm", {
			trip: data,
			interLen: interLen.length,
			tripId: req.params.trip,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/update", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = {
			...req.body,
		};
		let inter = data.inter.join("#");

		await pool.query(
			"UPDATE `trip_auth` SET `start`= ?,`intermediate`= ?,`end`= ? WHERE trip_id = ?",
			[data.start, inter, data.end, data.trip]
		);
		return res.redirect(`/survellance/trip/${data.trip}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/route", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { trip } = req.body;
		const data = await pool.query("SELECT * FROM `route` WHERE tripId = ?", [trip]);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

module.exports = router;
