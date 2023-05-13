const express = require("express");
const gcm = require("node-gcm");
const router = express.Router();
const pool = require("../config/database");
const formidable = require("formidable");
const fs = require("fs-extra");
const moment = require("moment");
const http = require("http");
const firebase = require("firebase-admin");
const csc = require("country-state-city").default;

const { apiLogger } = require("../helper/logger");
const { parse } = require("path");
const { firebaseUrl, loadUrl } = require("../utils/Constant");

//const dbFire = firebase.database();

const sender = new gcm.Sender("AIzaSyAX8Aus9gi2xRUYaSTBAHdRa1FrNc9TYfc");
const authkey = "172372Anbk2vu0jf5ce270fe";

async function sendOtp(mob, otp) {
	try {
		let num = `91${mob}`;
		let msg = `Your OTP for login is ${otp}`;
		let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=ROADEX&mobiles=${num}&authkey=${authkey}&route=4&message=${msg}`;

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
			"INSERT INTO loginotp (mob,otp) VALUES (?,?) ON DUPLICATE KEY UPDATE otp = VALUES(otp)",
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
		const [check] = await pool.query("SELECT * FROM `loginotp` WHERE mob = ? AND otp = ?", [
			body.mob,
			body.otp,
		]);

		return res.send({
			code: check ? 1 : 0,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/fcm_trans", async (req, res) => {
	try {
		const check = await pool.query("SELECT fcm_token FROM trans_tab WHERE mob= ?", [
			req.body.mob,
		]);
		if (check.length === 0) {
			return res.send({
				msg: "server error",
				code: 0,
			});
		} else if (check[0].fcm_token === req.body.fcm) {
			return res.send({
				msg: "not changed",
				code: 1,
			});
		} else {
			await pool.query("UPDATE trans_tab SET fcm_token= ? WHERE mob = ?", [
				req.body.fcm,
				req.body.mob,
			]);
			return res.send({
				msg: "fcm updated",
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.get("/country", async (req, res) => {
	try {
		const counteies = csc.getAllCountries();
		return res.send({
			counteies: counteies,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/state", async (req, res) => {
	try {
		const result = csc.getStatesOfCountry(req.body.id);
		return res.send({
			states: result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.get("/state", async (req, res) => {
	try {
		const result = await pool.query("SELECT `id`, `state` FROM `state_list`");
		return res.send({
			result: result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/city", async (req, res) => {
	try {
		const city = await pool.query(
			"SELECT id,city FROM `cities` WHERE state = ? ORDER BY city",
			[req.body.state]
		);
		return res.send({
			result: city,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/checkMob", async (req, res) => {
	try {
		const trans = await pool.query("SELECT * FROM `trans_tab` WHERE mob = ? AND u_flag = 1", [
			req.body.mob,
		]);
		return res.send({
			data: {
				flag: trans.length ? 1 : 0,
				id: trans.length ? trans[0].id : 0,
			},
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/checkEmail", async (req, res) => {
	try {
		const trans = await pool.query("SELECT * FROM `trans_tab` WHERE email = ? AND u_flag = 1", [
			req.body.email,
		]);
		return res.send({
			data: {
				flag: trans.length ? 1 : 0,
				id: trans.length ? trans[0].id : 0,
			},
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.put("/addTrans", async (req, res) => {
	try {
		const body = {
			...req.body,
		};
		const check = await pool.query("SELECT * FROM trans_tab WHERE mob = ?", [body.mob]);
		if (check.length) {
			if (check[0].u_flag == 1) {
				return res.send({
					msg: "Transporter is already registered",
					code: 0,
				});
			} else {
				await pool.query(
					"UPDATE `trans_tab` SET `name`= ?,`city`= ?,`state`= ?,`country`= ?,`fleet_size`= ?,`add_by`= 1,`email`= ?,`referred`= ? WHERE mob = ?",
					[
						body.name,
						body.city,
						body.state,
						body.country,
						body.fleet_size,
						body.email,
						body.referred,
						body.mob,
					]
				);
				return res.send({
					id: check[0].id,
					code: 1,
				});
			}
		} else {
			const insert = await pool.query(
				"INSERT INTO trans_tab (name,city,state,country,fleet_size,mob,email,add_by,referred) VALUES (?,?,?,?,?,?,?,?,?)",
				[
					body.name,
					body.city,
					body.state,
					body.country,
					body.fleet_size,
					body.mob,
					body.email,
					1,
					body.referred,
				]
			);
			return res.send({
				id: insert.insertId,
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/addTransPic", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					code: 0,
				});
			} else {
				const trans = await pool.query("SELECT mob,u_flag FROM trans_tab WHERE mob = ?", [
					fields.mob,
				]);
				if (trans.length) {
					if (trans[0].u_flag === 0) {
						if (files.aadhar_trans_pic) {
							if (files.aadhar_trans_pic.size > 0) {
								let oldpath = files.aadhar_trans_pic.path;
								let newpath = `./public/images/transporter/aadhar_trans/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											aadhar_trans_pic: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET aadhar_trans_pic = ? WHERE trans_tab.mob = ?",
											[pic.aadhar_trans_pic, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.aadhar_trans_back) {
							if (files.aadhar_trans_back.size > 0) {
								let oldpath = files.aadhar_trans_back.path;
								let newpath = `./public/images/transporter/aadhar_trans_back/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											aadhar_trans_back: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET aadhar_trans_back = ? WHERE trans_tab.mob = ?",
											[pic.aadhar_trans_back, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.prof_trans_pic) {
							if (files.prof_trans_pic.size > 0) {
								let oldpath = files.prof_trans_pic.path;
								let newpath = `./public/images/transporter/profile/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											prof_trans_pic: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET prof_trans_pic = ? WHERE trans_tab.mob = ?",
											[pic.prof_trans_pic, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.pancard_image) {
							if (files.pancard_image.size > 0) {
								let oldpath = files.pancard_image.path;
								let newpath = `./public/images/transporter/pancard/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											pancard_image: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET pancard_image = ? WHERE trans_tab.mob = ?",
											[pic.pancard_image, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.gst_image) {
							if (files.gst_image.size > 0) {
								let oldpath = files.gst_image.path;
								let newpath = `./public/images/transporter/gst/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											gst_image: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET gst_image = ? WHERE trans_tab.mob = ?",
											[pic.gst_image, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.tds_declaration_image) {
							if (files.tds_declaration_image.size > 0) {
								let oldpath = files.tds_declaration_image.path;
								let newpath = `./public/images/transporter/tdsdeclaration/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											tds_declaration_image: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET tds_declaration_image = ? WHERE trans_tab.mob = ?",
											[pic.tds_declaration_image, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else if (files.cheque_image) {
							if (files.cheque_image.size > 0) {
								let oldpath = files.cheque_image.path;
								let newpath = `./public/images/transporter/cheque/${fields.mob}.jpg`;
								fs.rename(oldpath, newpath, async error => {
									if (error) {
										console.error(error);
										apiLogger.error(
											`Error : ${error},Request : ${req.originalUrl}`
										);
										return res.send({
											msg: "Connection Error",
											code: 0,
										});
									} else {
										console.log("Success");
										const pic = {
											cheque_image: `${fields.mob}.jpg`,
										};
										await pool.query(
											"UPDATE trans_tab SET cheque_image = ? WHERE trans_tab.mob = ?",
											[pic.cheque_image, fields.mob]
										);
										return res.send({
											code: 1,
										});
									}
								});
							} else {
								return res.send({
									code: 0,
								});
							}
						} else {
							return res.send({
								code: 0,
							});
						}
					} else {
						return res.send({
							code: 0,
							msg: "Profile Already Completed",
						});
					}
				} else {
					return res.send({
						code: 0,
						msg: "Transporter Not found",
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

router.post("/uflagTrans", async (req, res) => {
	try {
		await pool.query("UPDATE trans_tab SET u_flag = 1 WHERE trans_tab.mob = ?", [req.body.mob]);
		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/transDetails", async (req, res) => {
	try {
		const trans = await pool.query(
			"SELECT *,(ISNULL(bankAcc)+ISNULL(acc_name)+ISNULL(ifsc)) AS completed FROM `trans_tab` WHERE id = ?",
			[req.body.id]
		);
		return res.send({
			code: 1,
			data: trans,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getReferalCode", async (req, res) => {
	try {
		const referal = await pool.query("SELECT referalCode FROM `trans_tab` WHERE id = ?", [
			req.body.id,
		]);
		if (referal.length) {
			if (referal[0].referalCode) {
				return res.send({ code: 1, data: referal[0].referalCode });
			} else {
				function generateOTP() {
					let digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
					let OTP = "";
					for (let i = 0; i < 7; i++) {
						OTP += digits[Math.floor(Math.random() * 20)];
					}
					return OTP;
				}
				const referalCode = generateOTP();
				await pool.query("UPDATE `trans_tab` SET `referalCode`= ? WHERE id = ?", [
					referalCode,
					req.body.id,
				]);
				return res.send({ code: 1, data: referalCode });
			}
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/drivers", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT driver_tab.d_name,vehicle_table.v_type,vehicle_table.v_num,main_map.vehicle_id,main_map.d_av,main_map.t_av,? AS 'transId' FROM `main_map` INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id AND vehicle_table.t_id = ? INNER JOIN driver_tab ON driver_tab.Did = main_map.Did",
			[req.body.transId, req.body.transId]
		);
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

router.post("/turnOff", async (req, res) => {
	try {
		const [check] = await pool.query(
			"SELECT trip.trip_id,trip.status FROM trip INNER JOIN main_map ON main_map.Did = trip.Did AND main_map.vehicle_id = ? ORDER BY trip.trip_id DESC LIMIT 1",
			[req.body.v_id]
		);
		if (check) {
			if (check.status === 2) {
				await pool.query("UPDATE main_map SET t_av = 1,d_av= 1 WHERE vehicle_id = ?", [
					req.body.v_id,
				]);
				const Did = req.body.Did;
				dbFire
					.ref(`/${firebaseUrl}/${Did}`)
					.update({
						t_av: "1",
						d_av: "1",
					})
					.then(function () {
						return res.send({
							code: 1,
						});
					})
					.catch(function () {
						res.send({
							code: 0,
						});
					});
			} else {
				return res.send({ code: 0, msg: "Driver is in a trip" });
			}
		} else {
			await pool.query("UPDATE main_map SET t_av = 1,d_av= 1 WHERE vehicle_id = ?", [
				req.body.v_id,
			]);
			const Did = req.body.Did;
			dbFire
				.ref(`/${firebaseUrl}/${Did}`)
				.update({
					t_av: "1",
					d_av: "1",
				})
				.then(function () {
					return res.send({
						code: 1,
					});
				})
				.catch(function () {
					res.send({
						code: 0,
					});
				});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/turnOn", async (req, res) => {
	try {
		await pool.query("UPDATE main_map SET t_av = 0,d_av= 0 WHERE vehicle_id = ?", [
			req.body.v_id,
		]);
		const Did = req.body.Did;
		dbFire
			.ref(`/${firebaseUrl}/${Did}`)
			.update({
				t_av: "0",
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
				});
			});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/profilePic", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					code: 0,
				});
			} else {
				const trans = await pool.query("SELECT mob FROM trans_tab WHERE id = ?", [
					fields.id,
				]);
				if (trans.length) {
					if (files.prof_trans_pic) {
						if (files.prof_trans_pic.size > 0) {
							let oldpath = files.prof_trans_pic.path;
							let newpath = `./public/images/prof_trans/${trans[0].mob}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								} else {
									console.log("Success");
									const pic = {
										prof_trans_pic: `${trans[0].mob}.jpg`,
									};
									await pool.query(
										"UPDATE trans_tab SET prof_trans_pic = ? WHERE id = ?",
										[pic.prof_trans_pic, fields.id]
									);
									return res.send({
										code: 1,
										msg: "Updated",
									});
								}
							});
						} else {
							return res.send({
								code: 0,
								msg: "Error",
							});
						}
					} else {
						return res.send({
							code: 0,
							msg: "Error",
						});
					}
				} else {
					return res.send({
						code: 0,
						msg: "Transporter Not found",
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

router.post("/profile", async (req, res) => {
	try {
		const body = {
			...req.body,
		};
		await pool.query(
			"UPDATE `trans_tab` SET `bankAcc`= ?,`acc_name`= ?,`ifsc`= ?,`fleet_size`= ?,`city`= ?,`state`= ? WHERE id = ?",
			[
				body.bankAcc,
				body.acc_name,
				body.ifsc,
				body.fleet_size,
				body.city,
				body.state,
				body.id,
			]
		);
		return res.send({ code: 1, msg: "Updated" });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getDriver", async (req, res) => {
	try {
		const driver = await pool.query(
			"SELECT trans_tab.name,driver_tab.*,cities.city as sahar,main_map.vehicle_id,main_map.t_av,main_map.d_av,vehicle_table.v_type,vehicle_table.v_num,trip.trip_id,trip.status FROM trans_tab INNER JOIN driver_tab ON trans_tab.id=driver_tab.tid INNER JOIN cities ON driver_tab.city=cities.id LEFT JOIN main_map ON driver_tab.Did=main_map.Did LEFT JOIN vehicle_table ON main_map.vehicle_id=vehicle_table.v_id LEFT JOIN trip ON driver_tab.Did=trip.Did WHERE trans_tab.id=?",
			[req.body.transId]
		);
		let newResult1 = new Map();
		driver.map((v, i) => {
			if (newResult1.has(v.Did)) {
				if (newResult1.get(v.Did).trip_id < v.trip_id) newResult1.set(v.Did, v);
			} else newResult1.set(v.Did, v);
		});
		let result = [...newResult1.values()];
		res.send({
			result,
			code: 2,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/addDriver", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					code: 0,
				});
			}
			const check = await pool.query("SELECT phn,u_flag FROM driver_tab WHERE phn = ?", [
				fields.phn,
			]);
			if (!check.length) {
				if (files.prof_pic) {
					if (files.prof_pic.size > 0) {
						let oldpath = files.prof_pic.path;
						let newpath = `./public/images/driver/profile/${fields.phn}.jpg`;
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
							const Did = await pool.query(
								"SELECT MAX(id)+1 AS noDid FROM driver_tab"
							);
							const driver = {
								phn: fields.phn,
								did: `Driver${Did[0].noDid}`,
								prof_pic: `${fields.phn}.jpg`,
							};
							await pool.query(
								"INSERT INTO driver_tab (Did,prof_pic,phn) VALUES (?,?,?)",
								[driver.did, driver.prof_pic, driver.phn]
							);
							return res.send({
								code: 1,
							});
						});
					} else {
						return res.send({
							code: 0,
						});
					}
				} else {
					return res.send({
						code: 0,
					});
				}
			} else {
				if (check[0].u_flag === 0) {
					if (files.prof_pic)
						if (files.prof_pic.size > 0) {
							let oldpath = files.prof_pic.path;
							let newpath = `./public/images/driver/profile/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								}
								console.log("Success");
								const driver = {
									prof_pic: `${fields.phn}.jpg`,
								};
								await pool.query(
									"UPDATE driver_tab SET prof_pic = ? WHERE driver_tab.phn = ?",
									[driver.prof_pic, fields.phn]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					if (files.aadhar_front_pic)
						if (files.aadhar_front_pic.size > 0) {
							let oldpath = files.aadhar_front_pic.path;
							let newpath = `./public/images/driver/aadhar_front_pic/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								}
								console.log("Success");
								const driver = {
									aadhar_front_pic: `${fields.phn}.jpg`,
								};
								await pool.query(
									"UPDATE driver_tab SET aadhar_front_pic = ? WHERE driver_tab.phn = ?",
									[driver.aadhar_front_pic, fields.phn]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					if (files.aadhar_pic_back)
						if (files.aadhar_pic_back.size > 0) {
							let oldpath = files.aadhar_pic_back.path;
							let newpath = `./public/images/driver/aadhar_pic_back/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								}
								console.log("Success");
								const driver = {
									aadhar_pic_back: `${fields.phn}.jpg`,
								};
								await pool.query(
									"UPDATE driver_tab SET aadhar_pic_back = ? WHERE driver_tab.phn = ?",
									[driver.aadhar_pic_back, fields.phn]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.json({
								code: 0,
							});
						}
					if (files.dl_pic_front)
						if (files.dl_pic_front.size > 0) {
							let oldpath = files.dl_pic_front.path;
							let newpath = `./public/images/driver/dl_pic_front/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								}
								console.log("Success");
								const driver = {
									dl_pic_front: `${fields.phn}.jpg`,
								};
								await pool.query(
									"UPDATE driver_tab SET dl_pic_front = ? WHERE driver_tab.phn = ?",
									[driver.dl_pic_front, fields.phn]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.json({
								code: 0,
							});
						}
					if (files.dl_pic_back)
						if (files.dl_pic_back.size > 0) {
							let oldpath = files.dl_pic_back.path;
							let newpath = `./public/images/driver/dl_pic_back/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										msg: "Connection Error",
										code: 0,
									});
								}
								console.log("Success");
								const driver = {
									dl_pic_back: `${fields.phn}.jpg`,
								};
								await pool.query(
									"UPDATE driver_tab SET dl_pic_back = ? WHERE driver_tab.phn = ?",
									[driver.dl_pic_back, fields.phn]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
				} else {
					return res.send({
						msg: "Driver already exists",
						code: 404,
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

router.post("/addDriverInfo", async (req, res) => {
	try {
		const check = await pool.query("SELECT phn,u_flag,Did FROM driver_tab WHERE phn = ?", [
			req.body.phn,
		]);
		if (check.length > 0) {
			if (check[0].u_flag === 0) {
				const driver = {
					d_name: req.body.d_name,
					city: req.body.city,
					state: req.body.state,
					country: req.body.country,
					verif_flag: 0,
					add_by: 1,
					u_flag: 1,
					dlNo: req.body.dlNo,
					tid: req.body.tid,
					Did: check[0].Did,
				};
				await pool.query(
					"UPDATE driver_tab SET d_name = ?,verif_flag = ?,city = ?,state = ?,country = ?,tid = ?,add_by = ?,u_flag = ?,dlNo = ? WHERE driver_tab.phn = ?",
					[
						driver.d_name,
						driver.verif_flag,
						driver.city,
						driver.state,
						driver.country,
						driver.tid,
						driver.add_by,
						driver.u_flag,
						driver.dlNo,
						req.body.phn,
					]
				);
				firebase
					.database()
					.ref("driver/" + driver.Did)
					.set({
						location: "0,0",
						d_av: "1",
						t_av: "1",
						trip: "0",
					});
				return res.send({
					code: 1,
				});
			} else {
				return res.send({
					code: 0,
					msg: "Driver already registered.",
				});
			}
		} else {
			return res.send({
				code: 0,
				msg: "Driver not found.",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/addVehicles", async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					code: 0,
				});
			}
			const check = await pool.query(
				"SELECT v_num,u_flag FROM vehicle_table WHERE v_num = ?",
				[fields.vehicle_num]
			);
			if (!check.length) {
				return res.send({
					msg: "Incorrect Vehicle Number",
					code: 0,
				});
			} else {
				if (check[0].u_flag === 0) {
					if (files.pic_v) {
						if (files.pic_v.size > 0) {
							let oldpath = files.pic_v.path;
							let newpath = `./public/images/vehicle/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										code: 0,
									});
								}
								console.log("Success");
								const vehicle = {
									pic_v: `${fields.vehicle_num}.jpg`,
								};
								await pool.query(
									"UPDATE vehicle_table SET pic_v = ? WHERE vehicle_table.v_num = ?",
									[vehicle.pic_v, fields.vehicle_num]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					}

					if (files.pic_rc_front) {
						if (files.pic_rc_front.size > 0) {
							let oldpath = files.pic_rc_front.path;
							let newpath = `./public/images/rc_front/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										code: 0,
									});
								}
								console.log("Success");
								const vehicle = {
									pic_rc_front: `${fields.vehicle_num}.jpg`,
								};
								await pool.query(
									"UPDATE vehicle_table SET pic_rc_front = ? WHERE vehicle_table.v_num = ?",
									[vehicle.pic_rc_front, fields.vehicle_num]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					}

					if (files.pic_rc_back) {
						if (files.pic_rc_back.size > 0) {
							let oldpath = files.pic_rc_back.path;
							let newpath = `./public/images/rc_back/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										code: 0,
									});
								}
								console.log("Success");
								const vehicle = {
									pic_rc_back: `${fields.vehicle_num}.jpg`,
								};
								await pool.query(
									"UPDATE vehicle_table SET pic_rc_back = ? WHERE vehicle_table.v_num = ?",
									[vehicle.pic_rc_back, fields.vehicle_num]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					}

					if (files.insurance_pic) {
						if (files.insurance_pic.size > 0) {
							let oldpath = files.insurance_pic.path;
							let newpath = `./public/images/insurance_pic/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										code: 0,
									});
								}
								console.log("Success");
								const vehicle = {
									insurance_pic: `${fields.vehicle_num}.jpg`,
								};
								await pool.query(
									"UPDATE vehicle_table SET insurance_pic = ? WHERE vehicle_table.v_num = ?",
									[vehicle.insurance_pic, fields.vehicle_num]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					}
					if (files.permit_pic) {
						if (files.permit_pic.size > 0) {
							let oldpath = files.permit_pic.path;
							let newpath = `./public/images/permit_pic/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, async error => {
								if (error) {
									console.error(error);
									apiLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.send({
										code: 0,
									});
								}
								console.log("Success");
								const vehicle = {
									permit_pic: `${fields.vehicle_num}.jpg`,
								};
								await pool.query(
									"UPDATE vehicle_table SET permit_pic = ? WHERE vehicle_table.v_num = ?",
									[vehicle.permit_pic, fields.vehicle_num]
								);
								return res.send({ code: 1 });
							});
						} else {
							return res.send({
								code: 0,
							});
						}
					}
				} else {
					return res.send({
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

router.post("/uflag", async (req, res) => {
	try {
		await pool.query("UPDATE vehicle_table SET u_flag = ? WHERE vehicle_table.v_num = ?", [
			req.body.u_flag,
			req.body.v_num,
		]);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/addVehiclesInfo", async (req, res) => {
	try {
		const check = await pool.query("SELECT v_num,u_flag FROM vehicle_table WHERE v_num = ?", [
			req.body.rc_num,
		]);
		const vehicle = {
			v_num: req.body.rc_num,
			permit_type: req.body.permit,
			active: 0,
			t_id: req.body.t_id,
			v_type: req.body.type,
			verif_flag: 0,
			rc_num: req.body.rc_num,
		};

		if (!check.length) {
			await pool.query(
				"INSERT INTO vehicle_table (v_num,permit_type,active,t_id,v_type,verif_flag,rc_num) VALUES (?,?,?,?,?,?,?)",
				[
					vehicle.v_num,
					vehicle.permit_type,
					vehicle.active,
					vehicle.t_id,
					vehicle.v_type,
					vehicle.verif_flag,
					vehicle.v_num,
				]
			);
			return res.send({ code: 1 });
		} else if (check[0].u_flag === 0) {
			await pool.query(
				"UPDATE `vehicle_table` SET `v_type`= ?,`v_num`= ?,`verif_flag`= ?,`permit_type`= ?,`active`= ?,`t_id`= ?,`rc_num`= ? WHERE `v_num` = ?",
				[
					vehicle.v_type,
					vehicle.v_num,
					vehicle.verif_flag,
					vehicle.permit_type,
					vehicle.active,
					vehicle.t_id,
					vehicle.v_num,
					req.body.v_num,
				]
			);
			return res.send({ code: 1 });
		} else {
			return res.send({
				msg: "Vehicle Already Exists",
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.get("/vType", async (req, res) => {
	try {
		const result = await pool.query("SELECT `type_name` FROM `vehicle_type`");
		return res.send({
			result: result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/reject", async (req, res) => {
	try {
		await pool.query("INSERT INTO `reject`(`tId`, `loadId`) VALUES (?,?)", [
			req.body.tId,
			req.body.loadId,
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

router.post("/accept", async (req, res) => {
	try {
		await pool.query("INSERT INTO `accept`(`tId`, `loadId`) VALUES (?,?)", [
			req.body.tId,
			req.body.loadId,
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

router.post("/getLoad", async (req, res) => {
	try {
		const data = {
			...req.body,
		};

		const result = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
			data.load_id,
		]);

		const coordinate = result[0].lat_long.split("#");

		const list = await pool.query(
			"SELECT driver_tab.*,main_map.gps_val,main_map.t_av,main_map.d_av,ROUND(ST_Distance_Sphere(POINT(SUBSTRING_INDEX(gps_val, ',', -1),SUBSTRING_INDEX(gps_val, ',', 1)),POINT(?,?))/1000,2) AS 'distance' FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.tid = ? HAVING distance < 50000 ORDER BY distance",
			[parseFloat(coordinate[1]), parseFloat(coordinate[0]), req.body.tId]
		);

		return res.send({
			result: result,
			driver: list,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/sosnotification", async (req, res) => {
	try {
		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("YYYY-MM-DD HH:mm");
		const week = moment(date_ver, "YYYY-MM-DD HH:mm")
			.subtract(7, "days")
			.format("YYYY-MM-DD HH:mm");

		const loadData = await pool.query(
			"SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.tId = ?",
			[req.body.tId]
		);
		const loads = loadData.map(x => x.load_id);
		let data = [];
		if (loads.length) {
			data = await pool.query(
				"SELECT load_post.*,vehicle_type.dimension,vehicle_type.capacity,cities.state,'ROADEXPRESS' AS client,IF(STR_TO_DATE(load_post.timet, '%d/%m/%Y %h:%i %p') > ? , 1 , 0) AS 'acceptFlag' FROM trans_tab INNER JOIN load_post ON load_post.city = trans_tab.city LEFT JOIN vehicle_type ON load_post.vehicle_type=vehicle_type.type_name LEFT JOIN cities ON load_post.city=cities.city INNER JOIN users ON users.id = load_post.fromc WHERE load_post.status = 0 AND STR_TO_DATE(load_post.timet, '%d/%m/%Y %h:%i %p') > ? AND trans_tab.id = ? ORDER BY load_post.time DESC",
				[date, week, req.body.tId]
			);
			for (let i = 0; i < data.length; i++) {
				if (loads.includes(data[i].load_id)) {
					data[i].acceptFlag = 0;
				}
			}
		} else {
			data = await pool.query(
				"SELECT load_post.*,vehicle_type.dimension,vehicle_type.capacity,cities.state,'ROADEXPRESS' AS client,IF(STR_TO_DATE(load_post.timet, '%d/%m/%Y %h:%i %p') > ? , 1 , 0) AS 'acceptFlag' FROM trans_tab INNER JOIN load_post ON load_post.city = trans_tab.city LEFT JOIN vehicle_type ON load_post.vehicle_type=vehicle_type.type_name LEFT JOIN cities ON load_post.city=cities.city INNER JOIN users ON users.id = load_post.fromc WHERE load_post.status = 0 AND STR_TO_DATE(load_post.timet, '%d/%m/%Y %h:%i %p') > ? AND trans_tab.id = ? ORDER BY load_post.time DESC",
				[date, week, req.body.tId]
			);
		}
		return res.send({
			result: data,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/nearestDriver", async (req, res) => {
	try {
		const load = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
			req.body.loadId,
		]);
		const coordinate = load[0].lat_long.split("#");

		const list = await pool.query(
			"SELECT driver_tab.*,vehicle_table.v_num,vehicle_table.v_id,main_map.gps_val,main_map.t_av,main_map.d_av,ROUND(ST_Distance_Sphere(POINT(SUBSTRING_INDEX(gps_val, ',', -1),SUBSTRING_INDEX(gps_val, ',', 1)),POINT(?,?))/1000,2) AS 'distance' FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.tid = ? AND vehicle_table.v_id NOT IN (SELECT trip.vehicle_id FROM `trip` WHERE status != 2) AND driver_tab.fcm_token IS NOT NULL HAVING distance < 50000 ORDER BY distance;SELECT driver_tab.*,vehicle_table.v_num,vehicle_table.v_id,main_map.gps_val FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.tid = ? AND fcm_token IS NULL AND vehicle_table.v_id NOT IN (SELECT trip.vehicle_id FROM `trip` WHERE status != 2)",
			[parseFloat(coordinate[1]), parseFloat(coordinate[0]), req.body.tId, req.body.tId]
		);
		const data = [...list[0], ...list[1]];
		res.send({
			code: 1,
			data: data,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.get("/time_send", async (req, res) => {
	try {
		const tot_time = Math.round(new Date().getTime() / 1000);
		return res.send({
			msg: tot_time,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/showmissedload", async (req, res) => {
	try {
		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("YYYY-MM");

		const load = await pool.query(
			"SELECT COUNT(load_post.load_id) AS 'total' FROM `load_post` WHERE created LIKE ?;SELECT COUNT(trip_id) AS 'accepted' FROM trip WHERE t_id = ? AND created LIKE ?",
			[`${date}%`, req.body.trans, `${date}%`]
		);

		let data = {
			total: load[0][0].total,
			accepted: load[1][0].accepted,
			missed: load[0][0].total - load[1][0].accepted,
		};

		JSON.stringify(data);

		res.send({
			result: data,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/payInfo", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT `Did`, `total` FROM `driver_rem` WHERE Did = ?;SELECT `trip_id`, `Did`, `remaining`,`flag` FROM `pay_driver` WHERE Did = ? ORDER BY trip_id;select pay_cli.amount AS total,(pay_cli.amount)*90/100 as main,trip.Did,trip.trip_id,trip.start_time,load_post.pickup_location,load_post.inter_mob,load_post.last_point,cli_acc.amount FROM pay_cli INNER JOIN trip on pay_cli.trip_id=trip.trip_id LEFT JOIN cli_acc on trip.trip_id=cli_acc.trip_id INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE cli_acc.flag=0 AND trip.Did = ? ORDER BY trip.trip_id",
			[req.body.Did, req.body.Did, req.body.Did]
		);
		return res.send({
			code: 1,
			pending: data[0],
			remaining: data[1],
			info: data[2],
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/showVehicle", async (req, res) => {
	try {
		const vehicle = await pool.query(
			"SELECT vehicle_table.*,vehicle_type.*,main_map.Did,main_map.t_av,main_map.d_av,driver_tab.d_name,trip.trip_id,trip.status FROM vehicle_table INNER JOIN vehicle_type on vehicle_table.v_type=vehicle_type.type_name LEFT JOIN main_map on vehicle_table.v_id=main_map.vehicle_id LEFT JOIN trip on main_map.Did=trip.Did left join driver_tab on main_map.Did=driver_tab.Did where vehicle_table.t_id=?",
			[req.body.trans]
		);
		let newResult1 = new Map();
		vehicle.map((v, i) => {
			if (newResult1.has(v.v_id)) {
				if (newResult1.get(v.v_id).trip_id < v.trip_id) newResult1.set(v.v_id, v);
			} else newResult1.set(v.v_id, v);
		});
		let result = [...newResult1.values()];
		res.send({
			result: result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/showVerified", async (req, res) => {
	try {
		const vehicle = await pool.query(
			"SELECT vehicle_table.*,driver_tab.Did,driver_tab.d_name FROM vehicle_table LEFT JOIN main_map ON main_map.vehicle_id = vehicle_table.v_id LEFT JOIN driver_tab ON driver_tab.Did = main_map.Did WHERE vehicle_table.t_id = ? AND vehicle_table.verif_flag = 1 AND vehicle_table.v_id NOT IN (SELECT trip.vehicle_id FROM trip WHERE trip.status != 2)",
			[req.body.tId]
		);
		res.send({
			result: vehicle,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/unVerified", async (req, res) => {
	try {
		const vehicle = await pool.query(
			"SELECT vehicle_table.* FROM vehicle_table WHERE vehicle_table.t_id= ? AND vehicle_table.verif_flag = 0",
			[req.body.tId]
		);
		// const vehicle = await pool.query(
		// 	"SELECT vehicle_table.*,vehicle_type.*,main_map.Did,main_map.t_av,main_map.d_av,driver_tab.d_name,trip.trip_id,trip.status FROM vehicle_table INNER JOIN vehicle_type on vehicle_table.v_type=vehicle_type.type_name LEFT JOIN main_map on vehicle_table.v_id=main_map.vehicle_id LEFT JOIN trip on main_map.Did=trip.Did left join driver_tab on main_map.Did=driver_tab.Did where vehicle_table.t_id=?",
		// 	[req.body.trans]
		// );
		// let newResult1 = new Map();
		// vehicle.map((v, i) => {
		// 	if (newResult1.has(v.v_id)) {
		// 		if (newResult1.get(v.v_id).trip_id < v.trip_id) newResult1.set(v.v_id, v);
		// 	} else newResult1.set(v.v_id, v);
		// });
		// let result = [...newResult1.values()];
		res.send({
			result: vehicle,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/vehicles", async (req, res) => {
	try {
		const vehicle = await pool.query("SELECT * FROM `vehicle_table` WHERE t_id = ?", [
			req.body.trans,
		]);

		res.send({
			data: vehicle,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/showDriver", async (req, res) => {
	try {
		const driver = await pool.query("SELECT * FROM `driver_tab` WHERE tid = ?", [
			req.body.trans,
		]);

		res.send({
			data: driver,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/payInfoVehicle", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT load_post.amount,trip.start_time,load_post.pickup_location,load_post.last_point,load_post.inter_mob FROM trip INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE trip.vehicle_id = ?",
			[req.body.vid]
		);
		if (data.length > 0) {
			return res.send({
				code: 1,
				result: data,
			});
		} else {
			return res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getHistoryTrip", async (req, res) => {
	try {
		const { Did, sort, filter } = req.body;
		let history = [];

		const date_ver = new Date();
		const today = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");

		let { startDate, endDate } = req.body;

		if (startDate === today && endDate === today) {
			startDate = "";
			endDate = "";
		}

		let date = "",
			total = 0;

		if (startDate && endDate) {
			date = `AND STR_TO_DATE(trip.start_time, '%d/%m/%Y') BETWEEN STR_TO_DATE("${startDate}", '%d/%m/%Y') AND STR_TO_DATE("${endDate}", '%d/%m/%Y')`;
		}

		if (sort === "") {
			history = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.distance,trip.start_time,driver_tab.d_name,SUM(CASE WHEN cli_acc.flag = 0 THEN cli_acc.amount ELSE 0 END) AS 'advance',SUM(CASE WHEN cli_acc.flag = 2 THEN cli_acc.amount ELSE 0 END) AS 'final',pay_cli.remaining,vehicle_table.v_num,trip.created,trip.trip_id FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id AND confirmed_load.Did = trip.Did INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pay_cli ON pay_cli.trip_id = trip.trip_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.Did = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY load_post.load_id,trip.trip_id,driver_tab.d_name,pay_cli.id`,
				[Did, `%${filter}%`]
			);
		} else {
			const sorted =
				sort === "KM"
					? "ORDER BY CAST(trip.distance AS DECIMAL(12,3)) DESC"
					: sort === "DATE"
					? "ORDER BY trip.created DESC"
					: "ORDER BY load_post.amount DESC";
			history = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.distance,trip.start_time,driver_tab.d_name,SUM(CASE WHEN cli_acc.flag = 0 THEN cli_acc.amount ELSE 0 END) AS 'advance',SUM(CASE WHEN cli_acc.flag = 2 THEN cli_acc.amount ELSE 0 END) AS 'final',pay_cli.remaining,vehicle_table.v_num,trip.created,trip.trip_id FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id AND confirmed_load.Did = trip.Did INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pay_cli ON pay_cli.trip_id = trip.trip_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.Did = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY load_post.load_id,trip.trip_id,driver_tab.d_name,pay_cli.id ${sorted}`,
				[Did, `%${filter}%`]
			);
		}

		for (let i = 0; i < history.length; i++) {
			if (history[i].remaining < 0) {
				console.log(history[i].remaining, history[i].trip_id);
			}
			total = parseFloat(total) + parseFloat(history[i].remaining);
		}

		console.log(total);

		return res.send({
			code: 1,
			result: history,
			total: parseFloat(total).toFixed(2),
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getHistoryTrip_ve", async (req, res) => {
	try {
		const { vId, sort, filter } = req.body;
		let history = [];

		const date_ver = new Date();
		const today = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");

		let { startDate, endDate } = req.body;

		if (startDate === today && endDate === today) {
			startDate = "";
			endDate = "";
		}

		let date = "",
			total = 0;

		if (startDate && endDate) {
			date = `AND STR_TO_DATE(trip.start_time, '%d/%m/%Y') BETWEEN STR_TO_DATE("${startDate}", '%d/%m/%Y') AND STR_TO_DATE("${endDate}", '%d/%m/%Y')`;
		}

		if (sort === "") {
			history = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.distance,trip.start_time,driver_tab.d_name,SUM(CASE WHEN cli_acc.flag = 0 THEN cli_acc.amount ELSE 0 END) AS 'advance',SUM(CASE WHEN cli_acc.flag = 2 THEN cli_acc.amount ELSE 0 END) AS 'final',pay_cli.remaining,vehicle_table.v_num,trip.trip_id FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id AND confirmed_load.Did = trip.Did INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pay_cli ON pay_cli.trip_id = trip.trip_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.vehicle_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY load_post.load_id,trip.trip_id,driver_tab.d_name,pay_cli.id`,
				[vId, `%${filter}%`]
			);
		} else {
			const sorted =
				sort === "KM"
					? "ORDER BY CAST(trip.distance AS DECIMAL(12,3)) DESC"
					: sort === "DATE"
					? "ORDER BY trip.created DESC"
					: "ORDER BY load_post.amount DESC";
			history = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.distance,trip.start_time,driver_tab.d_name,SUM(CASE WHEN cli_acc.flag = 0 THEN cli_acc.amount ELSE 0 END) AS 'advance',SUM(CASE WHEN cli_acc.flag = 2 THEN cli_acc.amount ELSE 0 END) AS 'final',pay_cli.remaining,vehicle_table.v_num,trip.trip_id FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id AND confirmed_load.Did = trip.Did INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN cli_acc ON cli_acc.trip_id = trip.trip_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pay_cli ON pay_cli.trip_id = trip.trip_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.vehicle_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY load_post.load_id,trip.trip_id,driver_tab.d_name,pay_cli.id ${sorted}`,
				[vId, `%${filter}%`]
			);
		}

		for (let i = 0; i < history.length; i++) {
			total = parseFloat(total) + parseFloat(history[i].remaining);
		}

		return res.send({
			code: 1,
			result: history,
			total: parseFloat(total).toFixed(2),
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/appreview", async (req, res) => {
	try {
		await pool.query(
			"INSERT INTO review_app(transid,inter_fa,perfo,color_sc) VALUES  (?,?,?,?)",
			[req.body.trans, req.body.inter, req.body.perfo, req.body.color_sc]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/trips", async (req, res) => {
	try {
		const trips = await pool.query(
			"SELECT trip.trip_id,trip.start_time,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,vehicle_table.v_num FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN users ON users.id = trip.client_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? AND trip.status = 1 AND trip.subFlag = 0 ORDER BY trip.created DESC",
			[req.body.id]
		);
		return res.send({ code: 1, data: trips });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getDetails", async (req, res) => {
	try {
		const { loadId, tripId } = req.body;
		const data = await pool.query(
			"SELECT load_post.*,confirmed_load.* FROM `load_post` INNER JOIN confirmed_load ON confirmed_load.load_id = load_post.load_id WHERE load_post.load_id = ?;SELECT trip.*,otp.*,otp_hist.*,trip_auth.* FROM trip INNER JOIN otp ON otp.trip_id = trip.trip_id INNER JOIN otp_hist ON otp_hist.trip_id = trip.trip_id LEFT JOIN trip_auth ON trip_auth.trip_id = trip.trip_id WHERE trip.trip_id = ?",
			[loadId, tripId]
		);

		let trip = data[1],
			currentStep = 0,
			load = data[0],
			count = 7,
			details = [];

		details.push(
			{ name: "Vehicel Alloted", time: `${load[0].conf_time}` },
			{ name: "Reached Loading Point", time: `${trip[0].start_time}` },
			{
				name: "Start Loading",
				time: `${trip[0].otp_verf_time ? trip[0].otp_verf_time : ""}`,
			},
			{
				name: "Trip Started",
				time: `${trip[0].start_pic_time ? trip[0].start_pic_time : ""}`,
			}
		);

		let inter = load[0].intermediate_loc.split("^");
		if (inter[0]) {
			count += inter.length;
			for (let i = 0; i < inter.length; i++) {
				details.push(
					{
						name: `Reached Intermediate Location ${i + 1}`,
						time: `${trip[i + 1] ? trip[i + 1].otp_verf_time : ""}`,
					},
					{
						name: `Left Intermediate Location ${i + 1}`,
						time: `${
							trip[i + 1]
								? trip[i + 1].intermediate_endtime
									? trip[i + 1].intermediate_endtime.split("#")[i]
										? trip[i + 1].intermediate_endtime.split("#")[i]
										: ""
									: ""
								: ""
						}`,
					}
				);
			}
		}

		details.push({
			name: "Reached Unloading Point",
			time: `${
				trip.length > 1 && trip[trip.length - 1].point === "end"
					? trip[trip.length - 1].otp_verf_time
						? trip[trip.length - 1].otp_verf_time
						: ""
					: ""
			}`,
		});

		details.push({
			name: "Consignment Unloaded",
			time: `${
				trip.length > 1
					? trip[trip.length - 1].end_pic_time
						? trip[trip.length - 1].end_pic_time
						: ""
					: ""
			}`,
		});

		details.push({
			name: "Trip Complete",
			time: `${trip.length > 1 ? (trip[0].final_endtime ? trip[0].final_endtime : "") : ""}`,
		});

		let completed = 2;

		let tripLength = trip.length;
		if (trip[0].otp_verf_time) {
			completed++;
		}
		if (trip[0].start_pic_time) {
			completed++;
		}
		if (inter[0]) {
			for (let i = 0; i < inter.length; i++) {
				if (trip[i + 1]) {
					completed++;
				}
			}
		}
		if (tripLength > 1 && trip[tripLength - 1].point === "end") {
			if (trip[tripLength - 1].otp_verf_time) {
				completed++;
			}
			if (trip[tripLength - 1].end_pic_time) {
				completed++;
			}
		}
		if (trip[0].final_endtime) {
			completed++;
		}
		currentStep = completed;

		if (count <= 7) {
			load[0]["status"] =
				completed === 2
					? `Reached loading point ${trip[0].start_time}`
					: completed === 3
					? `Start loading ${trip[0].otp_verf_time}`
					: completed === 4
					? `Trip started ${trip[0].start_pic_time}`
					: completed === 5
					? `Reached unloading point ${
							tripLength > 1 ? trip[tripLength - 1].otp_verf_time : ""
					  }`
					: completed === 6
					? `Consignment unloaded <br> ${
							tripLength > 1 ? trip[tripLength - 1].end_pic_time : ""
					  }`
					: completed === 7
					? `Trip completed ${tripLength > 1 ? trip[0].final_endtime : ""}`
					: "";
		} else {
			if (completed <= 4) {
				load[0]["status"] =
					completed === 2
						? `Reached loading point ${trip[0].start_time}`
						: completed === 3
						? `Start loading ${trip[0].otp_verf_time}`
						: completed === 4
						? `Trip started ${trip[0].start_pic_time}`
						: completed === 5
						? `Reached unloading point ${
								tripLength > 1 ? trip[tripLength - 1].otp_verf_time : ""
						  }`
						: completed === 6
						? `Consignment unloaded <br> ${
								tripLength > 1 ? trip[tripLength - 1].end_pic_time : ""
						  }`
						: completed === 7
						? `Trip completed ${tripLength > 1 ? trip[0].final_endtime : ""}`
						: "";
			} else if (completed > 4 + inter.length) {
				completed -= inter.length;

				load[0]["status"] =
					completed === 2
						? `Reached loading point ${trip[0].start_time}`
						: completed === 3
						? `Start loading ${trip[0].otp_verf_time}`
						: completed === 4
						? `Trip started ${trip[0].start_pic_time}`
						: completed === 5
						? `Reached unloading point ${
								tripLength > 1 ? trip[tripLength - 1].otp_verf_time : ""
						  }`
						: completed === 6
						? `Consignment unloaded <br> ${
								tripLength > 1 ? trip[tripLength - 1].end_pic_time : ""
						  }`
						: completed === 7
						? `Trip completed ${tripLength > 1 ? trip[0].final_endtime : ""}`
						: "";
			} else {
				load[0]["status"] = `${
					trip[completed - 4].intermediate_endtime
						? `Left intermediate point ${completed - 4}`
						: `Reached intermediate point ${completed - 4}`
				}`;
			}
		}

		res.send({ code: 1, load, Did: trip[0].Did, currentStep, details });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/removeMapping", async (req, res) => {
	try {
		await pool.query("DELETE FROM main_map WHERE vehicle_id = ? AND Did = ?", [
			req.body.vid,
			req.body.Did,
		]);
		dbFire
			.ref(`/${firebaseUrl}/${req.body.Did}`)
			.update({
				d_av: "1",
				t_av: "1",
			})
			.then(() => {
				return res.send({
					code: 1,
				});
			})
			.catch(error => {
				console.error(error);
				apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.send({
					code: 0,
				});
			});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/full_trip_info", async (req, res) => {
	try {
		const trip = await pool.query(
			"SELECT load_post.* FROM trip inner join confirmed_load on trip.c_load_id=confirmed_load.c_load_id LEFT JOIN load_post on confirmed_load.load_id=load_post.load_id WHERE trip.trip_id=?",
			[req.body.trip_id]
		);
		res.send({
			result: trip,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/mapdriver", async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.Did,driver_tab.d_name,main_map.vehicle_id FROM driver_tab LEFT JOIN main_map on driver_tab.Did=main_map.Did WHERE driver_tab.verif_flag=1 and main_map.vehicle_id is NULL AND driver_tab.tid = ?",
			[req.body.tid]
		);
		return res.send({
			result: result,
			code: 1,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/mapdriver_code", async (req, res) => {
	try {
		const vehicle = await pool.query("SELECT vehicle_id FROM main_map WHERE vehicle_id = ?", [
			req.body.vid,
		]);
		if (vehicle.length > 0) {
			await pool.query("UPDATE main_map SET Did = ? WHERE vehicle_id = ?", [
				req.body.Did,
				req.body.vid,
			]);
		} else {
			await pool.query("INSERT INTO main_map (Did,vehicle_id) VALUES (?,?)", [
				req.body.Did,
				req.body.vid,
			]);
		}
		await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
			req.body.Did,
			req.body.vid,
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

router.post("/alert", async (req, res) => {
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
			sender.send(
				message,
				{
					registrationTokens: regTokens,
				},
				function (err, response) {
					if (err) console.error(err);
					else {
						console.log(response);
						if (response.success) {
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
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/nearestDriver", async (req, res) => {
	try {
		const load = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
			req.body.loadId,
		]);
		const coordinate = load[0].lat_long.split("#");
		const list = await pool.query(
			"SELECT driver_tab.*,vehicle_table.v_num,vehicle_table.v_id,main_map.gps_val,main_map.t_av,main_map.d_av,ROUND(ST_Distance_Sphere(POINT(SUBSTRING_INDEX(gps_val, ',', -1),SUBSTRING_INDEX(gps_val, ',', 1)),POINT(?,?))/1000,2) AS 'distance' FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.tid = ? AND driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) HAVING distance < 50000 AND vehicle_table.v_id NOT IN (SELECT vehicleId FROM `subscription` WHERE status = 1) ORDER BY distance;SELECT driver_tab.*,vehicle_table.v_num,vehicle_table.v_id,main_map.gps_val FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did AND main_map.d_av = 0 AND main_map.t_av = 0 INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.tid = ? AND driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND fcm_token IS NULL AND vehicle_table.v_id NOT IN (SELECT vehicleId FROM `subscription` WHERE status = 1)",
			[parseFloat(coordinate[1]), parseFloat(coordinate[0]), req.body.tId, req.body.tId]
		);
		const data = [...list[0], ...list[1]];
		res.send({
			code: 1,
			data: data,
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.put("/postDriver", async (req, res) => {
	try {
		const data = {
			...req.body,
		};

		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");

		const message = new gcm.Message({
			data: {
				key1: "msg1",
				load: data.load_id,
				title: "New Load Found",
				icon: "ic_launcher",
				body: "This is a notification that will be displayed if your app is in the background.",
			},
		});
		const [loadDetails] = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
			data.load_id,
		]);

		const checkConfirm = await pool.query(
			"SELECT * FROM `pre_confirmed_load` WHERE load_id = ?",
			[data.load_id]
		);

		if (checkConfirm.length === 0) {
			const drivers = data.drivers;

			for (let i = 0; i < drivers.length; i++) {
				const check = await pool.query(
					"SELECT * FROM `pre_confirmed_load` WHERE vehicle_id = ? AND Did = ? AND tId = ? AND load_id = ?",
					[drivers[i].v_id, drivers[i].Did, data.tId, data.load_id]
				);
				if (check.length === 0) {
					await pool.query(
						"INSERT INTO `pre_confirmed_load`(`vehicle_id`, `Did`, `conf_time`, `status`, `load_id`, `tId`, `fromc`) VALUES (?,?,?,?,?,?,?)",
						[
							drivers[i].v_id,
							drivers[i].Did,
							date,
							0,
							data.load_id,
							data.tId,
							loadDetails.fromc,
						]
					);
					await pool.query("UPDATE load_post SET status= 1 WHERE load_id=?", [
						data.load_id,
					]);
					dbFire.ref(`/${firebaseUrl}/update`).update({
						update: `${Math.random()}`,
					});
				}
				const [details] = await pool.query("SELECT * FROM `driver_tab` WHERE Did = ?", [
					drivers[i].Did,
				]);
				if (details) {
					if (details.fcm_token) {
						let regTokens = [`${details.fcm_token}`];
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
								}
							}
						);
					} else {
						let num = `91${details.phn}`;
						let msg = `New Load Found
							Start : ${loadDetails.pickup_location.substring(0, 20)},
							${
								loadDetails.intermediate_loc
									? `Intermediated points : ${loadDetails.intermediate_loc.split(
											"^"
									  )},`
									: ""
							}
							End : ${loadDetails.last_point.substring(0, 20)},
							Time : ${loadDetails.timef.substring(0, 20)}
							`;
						let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=ROADEX&mobiles=${num}&authkey=${authkey}&route=4&message=${msg}&flash=1`;

						http.get(url, function (resp) {
							resp.on("data", function (chunk) {
								console.log(chunk);
							});
						}).on("error", function (e) {
							console.log("Got error: " + e.message);
						});
					}
				}
			}
			return res.send({
				code: 1,
			});
		} else {
			return res.send({
				code: 0,
				msg: "Trip Already Accepted",
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/confirmedTrip", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT DISTINCT load_post.*,'ROADEXPRESS' AS name,vehicle_table.v_num FROM confirmed_load INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER join users ON users.id = confirmed_load.fromc INNER JOIN vehicle_table ON vehicle_table.v_id = confirmed_load.vehicle_id WHERE confirmed_load.tId = ? AND confirmed_load.status = 0",
			[req.body.tId]
		);

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

router.post("/confirmedTripDetails", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT load_post.*,'ROADEXPRESS' AS name FROM confirmed_load INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN users ON users.id = confirmed_load.fromc WHERE confirmed_load.load_id = ? AND confirmed_load.status = 0",
			[req.body.loadId]
		);

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

router.post("/assignedDetails", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT driver_tab.Did,driver_tab.d_name,driver_tab.phn,vehicle_table.v_num,vehicle_table.v_id,confirmed_load.c_load_id FROM `confirmed_load` INNER JOIN driver_tab ON driver_tab.Did = confirmed_load.Did INNER JOIN vehicle_table ON vehicle_table.v_id = confirmed_load.vehicle_id WHERE confirmed_load.load_id = ? AND confirmed_load.tId = ?",
			[req.body.loadId, req.body.tId]
		);

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

router.post("/getList", async (req, res) => {
	try {
		const data = {
			...req.body,
		};

		const details = await pool.query(
			"SELECT * FROM `confirmed_load` WHERE load_id = ? AND tId = ? AND status = 0",
			[data.loadId, data.tId]
		);

		const vehicleList = details.map(x => x.vehicle_id);
		const driverList = details.map(x => x.Did);

		const dataList = await pool.query(
			"SELECT Did,d_name,phn FROM `driver_tab` WHERE tid = ? AND Did NOT IN (?) AND Did NOT IN (SELECT Did FROM trip WHERE trip.status = 1) AND driver_tab.verif_flag = 1;SELECT v_num,v_id FROM load_post INNER JOIN vehicle_table ON vehicle_table.v_type = load_post.vehicle_type WHERE vehicle_table.t_id = ? AND v_id NOT IN (?) AND load_post.load_id = ? AND v_id NOT IN (SELECT vehicle_id FROM trip WHERE status = 1) AND vehicle_table.verif_flag = 1 AND vehicle_table.v_id NOT IN (SELECT vehicleId FROM `subscription` WHERE status = 1)",
			[data.tId, driverList, data.tId, vehicleList, data.loadId]
		);

		return res.send({
			code: 1,
			driver: dataList[0],
			vehicle: dataList[1],
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/updateMapping", async (req, res) => {
	try {
		const data = {
			...req.body,
		};
		await pool.query("DELETE FROM main_map WHERE Did = ?", [data.Did]);
		await pool.query("DELETE FROM main_map WHERE vehicle_id = ?", [data.vehicle_id]);

		await pool.query("INSERT INTO main_map (Did,vehicle_id,d_av,t_av) VALUES (?,?,0,0)", [
			data.Did ? data.Did : data.originalDid,
			data.vehicle_id ? data.vehicle_id : data.originalVid,
		]);

		await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
			data.Did ? data.Did : data.originalDid,
			data.vehicle_id ? data.vehicle_id : data.originalVid,
		]);

		await pool.query(
			"UPDATE `confirmed_load` SET `vehicle_id`= ?,`Did`= ? WHERE c_load_id = ?",
			[
				data.vehicle_id ? data.vehicle_id : data.originalVid,
				data.Did ? data.Did : data.originalDid,
				data.c_load_id,
			]
		);

		await pool.query("INSERT INTO `historyChange`(`c_load_id`, `Did`, `v_id`) VALUES (?,?,?)", [
			data.c_load_id,
			data.Did ? data.Did : data.originalDid,
			data.vehicle_id ? data.vehicle_id : data.originalVid,
		]);

		const [loadDetails] = await pool.query(
			"SELECT load_post.* FROM `confirmed_load` INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE confirmed_load.c_load_id =?",
			[data.c_load_id]
		);

		const message = new gcm.Message({
			data: {
				key1: "msg1",
				load: loadDetails.load_id,
				title: "New Load Found",
				icon: "ic_launcher",
				body: "This is a notification that will be displayed if your app is in the background.",
			},
		});

		if (data.Did !== data.originalDid) {
			const [details] = await pool.query("SELECT * FROM `driver_tab` WHERE Did = ?", [
				data.Did,
			]);
			if (details) {
				if (details.fcm_token) {
					let regTokens = [`${details.fcm_token}`];
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
							}
						}
					);
				} else {
					let num = `91${details.phn}`;
					let msg = `New Load Found
							Start : ${loadDetails.pickup_location.substring(0, 20)},
							${
								loadDetails.intermediate_loc
									? `Intermediated points : ${loadDetails.intermediate_loc.split(
											"^"
									  )},`
									: ""
							}
							End : ${loadDetails.last_point.substring(0, 20)},
							Time : ${loadDetails.timef.substring(0, 20)}
							`;
					let url = `http://api.msg91.com/api/sendhttp.php?route=4&sender=ROADEX&mobiles=${num}&authkey=${authkey}&route=4&message=${msg}&flash=1`;

					http.get(url, function (resp) {
						resp.on("data", function (chunk) {
							console.log(chunk);
						});
					}).on("error", function (e) {
						console.log("Got error: " + e.message);
					});
				}
			}
			dbFire.ref(`/${firebaseUrl}/${data.originalDid}`).update({
				d_av: "1",
				t_av: "1",
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

router.post("/loadType", async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM load_type");
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/vtypes", async (req, res) => {
	try {
		const data = await pool.query("SELECT `type_name` FROM `vehicle_type`");
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/totalAmount", async (req, res) => {
	try {
		const { vType, distance, noVehicle } = req.body;
		if (vType && distance) {
			const [v_type] = await pool.query(
				"SELECT v_type FROM vehicle_type WHERE type_name = ?",
				[vType]
			);
			const [data] = await pool.query(
				"SELECT * FROM `dynamic_matrix` WHERE vehicle_id = ? AND ? BETWEEN start AND end",
				[v_type.v_type, distance]
			);
			if (data) {
				const amount =
					(parseFloat(data.baseFare) + parseInt(data.rate, 10) * distance) *
					parseInt(noVehicle, 10);
				return res.send({ code: 1, data: amount });
			} else {
				return res.send({ code: 0, msg: "Sorry, No rate card found!!" });
			}
		} else {
			return res.send({ code: 0, msg: "Some parameters are missing" });
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/addLoad", async (req, res) => {
	try {
		if (typeof req.body.inter === "object") {
			inter = req.body.inter;
			if (req.body.inter.length === req.body.inter_lat_long.length) {
				inter = inter.join("^");
				req.body.inter_lat_long = req.body.inter_lat_long.join("^");
			} else {
				return res.send({
					code: 0,
					msg: "Error in Latitude Longitude. Please re-enter trip.",
				});
			}
		} else {
			inter = req.body.inter;
		}

		const inter_mob = JSON.stringify(req.body.inter_mob);

		const load = {
			t_id: req.body.t_id,
			type: req.body.type,
			amount: req.body.amount,
			vehicle_type: req.body.vtype,
			pickup_location: req.body.pickup,
			intermediate_loc: inter,
			last_point: req.body.dest,
			timef: req.body.timef,
			timet: req.body.timet,
			flag: 2,
			weight: req.body.weight,
			start_mob: req.body.start_mob,
			end_mob: req.body.end_mob,
			inter_mob: inter_mob,
			city: req.body.city,
			lat_long: req.body.lat_long,
			last_lat_long: req.body.last_lat_long,
			no_vehicle: req.body.no_vehicle,
			inter_lat_long: req.body.inter_lat_long,
			dest_city: req.body.dest_city,
			remark: req.body.remark,
			totalAmount: req.body.totalAmount,
		};
		if (!load.lat_long || !load.last_lat_long) {
			return res.send({ code: 0, msg: "Error in Latitude Longitude. Please re-enter trip." });
		} else {
			const loadId = await pool.query(
				"INSERT INTO load_post(t_id,type,amount,vehicle_type,pickup_location,intermediate_loc,last_point,timef,timet,flag,weight,start_mob,end_mob,inter_mob,city,lat_long,last_lat_long,inter_lat_long,no_vehicle,dest_city,remark,totalAmount,remaining) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
				[
					load.t_id,
					load.type,
					load.amount,
					load.vehicle_type,
					load.pickup_location,
					load.intermediate_loc,
					load.last_point,
					load.timef,
					load.timet,
					load.flag,
					load.weight,
					load.start_mob,
					load.end_mob,
					load.inter_mob,
					load.city,
					load.lat_long,
					load.last_lat_long,
					load.inter_lat_long,
					load.no_vehicle,
					load.dest_city,
					load.remark,
					load.totalAmount,
					load.no_vehicle,
				]
			);
			firebase
				.database()
				.ref("loads/" + loadId.insertId)
				.set({
					id: `${loadId.insertId}`,
					update: `${Math.random()}`,
				});
			const date_ver = new Date();
			const dateLoad = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
			const totalLoad = await pool.query("SELECT tot FROM `total_load` WHERE date = ?", [
				dateLoad,
			]);
			if (totalLoad.length > 0) {
				const total = parseInt(totalLoad[0].tot, 10) + parseInt(load.amount, 10);
				await pool.query("UPDATE `total_load` SET `tot`= ? WHERE date = ?", [
					total,
					dateLoad,
				]);
				return res.send({ code: 1, msg: "Load Added" });
			} else {
				await pool.query("INSERT INTO total_load(date,tot) VALUES (?,?)", [
					dateLoad,
					load.amount,
				]);
				return res.send({ code: 1, msg: "Load Added" });
			}
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/transLoad", async (req, res) => {
	try {
		const { tId } = req.body;
		const data = await pool.query(
			"SELECT * FROM `load_post` WHERE t_Id = ? ORDER BY created DESC",
			[tId]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/tripsHistory", async (req, res) => {
	try {
		const { tid, sort, filter } = req.body;
		const date_ver = new Date();
		const today = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");

		let { startDate, endDate } = req.body;

		if (startDate === today && endDate === today) {
			startDate = "";
			endDate = "";
		}

		let trips = [],
			date = "";

		if (startDate && endDate) {
			date = `AND STR_TO_DATE(trip.start_time, '%d/%m/%Y') BETWEEN STR_TO_DATE("${startDate}", '%d/%m/%Y') AND STR_TO_DATE("${endDate}", '%d/%m/%Y')`;
		}

		if (sort === "") {
			trips = await pool.query(
				`SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,COUNT(pod_pic.pod_id) AS 'pod',trip.start_time,vehicle_table.v_num,trip.distance FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pod_pic ON pod_pic.trip_id = trip.trip_id AND pod_pic.confirm = 1 INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY trip.trip_id,driver_tab.d_name`,
				[tid, `%${filter}%`]
			);
		} else {
			const sorted =
				sort === "KM"
					? "ORDER BY CAST(trip.distance AS DECIMAL(12,3)) DESC"
					: sort === "DATE"
					? "ORDER BY trip.created DESC"
					: "ORDER BY load_post.amount DESC";

			trips = await pool.query(
				`SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,COUNT(pod_pic.pod_id) AS 'pod',trip.start_time,vehicle_table.v_num,trip.distance FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pod_pic ON pod_pic.trip_id = trip.trip_id AND pod_pic.confirm = 1 INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} GROUP BY trip.trip_id,driver_tab.d_name ${sorted}`,
				[tid, `%${filter}%`]
			);
		}

		return res.send({ code: 1, data: trips });
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
					const filename = `${Math.floor(new Date().getTime() / 1000)}.jpg`;
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
			}
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/travelDriver", async (req, res) => {
	try {
		const { Did, sort, filter } = req.body;
		let data = [];

		const date_ver = new Date();
		const today = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");

		let { startDate, endDate } = req.body;

		if (startDate === today && endDate === today) {
			startDate = "";
			endDate = "";
		}

		let date = "",
			total = 0;
		if (startDate && endDate) {
			date = `AND STR_TO_DATE(trip.start_time, '%d/%m/%Y') BETWEEN STR_TO_DATE("${startDate}", '%d/%m/%Y') AND STR_TO_DATE("${endDate}", '%d/%m/%Y')`;
		}

		if (sort === "") {
			data = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.trip_id,trip.distance,trip.created,driver_tab.d_name,vehicle_table.v_num,load_post.weight,trip.start_time FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.Did = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date}`,
				[Did, `%${filter}%`]
			);
		} else {
			const sorted =
				sort === "KM"
					? "ORDER BY CAST(trip.distance AS DECIMAL(12,3)) DESC"
					: sort === "DATE"
					? "ORDER BY trip.created DESC"
					: "ORDER BY load_post.amount DESC";

			data = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.trip_id,trip.distance,trip.created,driver_tab.d_name,vehicle_table.v_num,load_post.weight,trip.start_time FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.Did = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} ${sorted}`,
				[Did, `%${filter}%`]
			);
		}

		for (let i = 0; i < data.length; i++) {
			total = total + data[i].distance;
		}

		return res.send({
			code: 1,
			data: data,
			total: parseFloat(total).toFixed(2),
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/travelVehicle", async (req, res) => {
	try {
		const { vId, sort, filter } = req.body;
		let data = [];

		const date_ver = new Date();
		const today = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");

		let { startDate, endDate } = req.body;

		if (startDate === today && endDate === today) {
			startDate = "";
			endDate = "";
		}

		let date = "",
			total = 0;

		if (startDate && endDate) {
			date = `AND STR_TO_DATE(trip.start_time, '%d/%m/%Y') BETWEEN STR_TO_DATE("${startDate}", '%d/%m/%Y') AND STR_TO_DATE("${endDate}", '%d/%m/%Y')`;
		}

		if (sort === "") {
			data = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.trip_id,trip.distance,trip.created,driver_tab.d_name,vehicle_table.v_num,load_post.weight,trip.start_time FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.vehicle_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date}`,
				[vId, `%${filter}%`]
			);
		} else {
			const sorted =
				sort === "KM"
					? "ORDER BY CAST(trip.distance AS DECIMAL(12,3)) DESC"
					: sort === "DATE"
					? "ORDER BY trip.created DESC"
					: "ORDER BY load_post.amount DESC";

			data = await pool.query(
				`SELECT DISTINCT load_post.load_id,load_post.type,load_post.amount,load_post.vehicle_type,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,trip.trip_id,trip.distance,trip.created,driver_tab.d_name,vehicle_table.v_num,load_post.weight,trip.start_time FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.vehicle_id = ? AND trip.status = 2 AND load_post.vehicle_type LIKE ? ${date} ${sorted}`,
				[vId, `%${filter}%`]
			);
		}
		for (let i = 0; i < data.length; i++) {
			total = total + data[i].distance;
		}

		return res.send({
			code: 1,
			data: data,
			total: parseFloat(total).toFixed(2),
		});
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/podMissing", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,COUNT(pod_pic.pod_id) AS 'pod',trip.start_time AS 'date',vehicle_table.v_num FROM trip INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did LEFT JOIN pod_pic ON pod_pic.trip_id = trip.trip_id WHERE trip.t_id = ? AND trip.status = 2 GROUP BY trip.trip_id,driver_tab.d_name HAVING pod = 0 ORDER BY trip.created DESC",
			[req.body.tId]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/podUnconfirmed", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,trip.start_time AS 'date',vehicle_table.v_num FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN pod_pic ON pod_pic.trip_id = trip.trip_id AND pod_pic.confirm = 0 WHERE trip.t_id = ? AND trip.status = 2 GROUP BY trip.trip_id,driver_tab.d_name ORDER BY trip.created DESC",
			[req.body.tId]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/podPics", async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `pod_pic` WHERE trip_id = ? AND status = 1", [
			req.body.tripId,
		]);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/updatePics", async (req, res) => {
	try {
		const { pod_id } = req.body;
		for (let i = 0; i < pod_id.length; i++) {
			await pool.query("UPDATE `pod_pic` SET status = 1 WHERE pod_id = ?", [pod_id[i]]);
		}
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/podConfirm", async (req, res) => {
	try {
		await pool.query("UPDATE `pod_pic` SET `confirm`= 1 WHERE trip_id = ?", [req.body.tripId]);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/podUnConfirm", async (req, res) => {
	try {
		await pool.query("UPDATE `pod_pic` SET `confirm`= 0 WHERE trip_id = ?", [req.body.tripId]);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/driverList", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT * FROM `driver_tab` WHERE tid = ? AND verif_flag = 1 AND Did NOT IN (SELECT trip.Did FROM trip WHERE trip.status !=2)",
			[req.body.tId]
		);

		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/mapVehicle", async (req, res) => {
	try {
		const data = {
			...req.body,
		};
		await pool.query("DELETE FROM main_map WHERE Did = ?", [data.Did]);
		await pool.query("DELETE FROM main_map WHERE vehicle_id = ?", [data.vehicle_id]);

		await pool.query("INSERT INTO main_map (Did,vehicle_id,d_av,t_av) VALUES (?,?,0,0)", [
			data.Did,
			data.vehicle_id,
		]);

		await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
			data.Did,
			data.vehicle_id,
		]);

		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/subscription", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trip.trip_id,trip.start_time,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,vehicle_table.v_num FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN users ON users.id = trip.client_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? AND trip.status = 1 AND trip.subFlag = 1 ORDER BY trip.created DESC",
			[req.body.tId]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/subscriptionHistory", async (req, res) => {
	try {
		let data = await pool.query(
			"SELECT trip.trip_id,trip.start_time,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,vehicle_table.v_num,trip_auth.start AS 'startDistance',trip_auth.intermediate AS 'interDistance',trip_auth.end AS 'endDistance' FROM trip INNER JOIN trip_auth ON trip_auth.trip_id = trip.trip_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN users ON users.id = trip.client_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.t_id = ? AND trip.status = 2 AND trip.subFlag = 1 ORDER BY trip.created DESC",
			[req.body.tId]
		);
		let count = 0;
		for (let i = 0; i < data.length; i++) {
			data[i]["kmFlag"] = 0;
			if (data[i].startDistance) {
				data[i]["kmFlag"] = 1;
			}
			if (data[i].intermediate_loc) {
				const split = data[i].intermediate_loc.split("^");
				if (data[i].interDistance) {
					if (split.length === data[i].interDistance.split("#")) {
						data[i]["kmFlag"] = 1;
					}
				}
			}
			if (data[i].endDistance) {
				data[i]["kmFlag"] = 1;
			}
			if (data[i].kmFlag === 0) {
				count++;
			}
		}
		return res.send({ code: 1, data: data, count: count });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/loadPoints", async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id WHERE trip.trip_id = ? AND trip.subFlag = 1 ORDER BY trip.created DESC",
			[req.body.tripId]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/getPics", async (req, res) => {
	try {
		const { tripId, pic } = req.body;
		console.log(req.body);
		const trip = await pool.query("SELECT * FROM `trip_auth` WHERE trip_id = ?", [tripId]);
		if (pic === "start") {
			return res.send({
				code: 1,
				pic: trip.length ? trip[0].start_time_pic : null,
				km: trip.length ? trip[0].start : null,
			});
		} else if (pic === "end") {
			return res.send({
				code: 1,
				pic: trip.length ? trip[0].end_pic : null,
				km: trip.length ? trip[0].end : null,
			});
		} else {
			const intermediate = trip.length
				? trip[0].intermediate_pic
					? trip[0].intermediate_pic.split("#")
					: []
				: [];
			const interKm = trip.length
				? trip[0].intermediate
					? trip[0].intermediate.split("#")
					: []
				: [];

			console.log(intermediate, interKm);

			return res.send({
				code: 1,
				pic: trip.length ? intermediate[pic] : null,
				km: interKm.length ? interKm[pic] : null,
			});
		}
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
				const { tripId, pic } = fields;
				if (files.pic_pathee) {
					const filename = `${Math.floor(new Date().getTime() / 1000)}.jpg`;
					let oldpath = files.pic_pathee.path;
					let newpath =
						pic === "start"
							? `./public/images/start_time_pic/${filename}`
							: pic === "end"
							? `./public/images/end_pic/${filename}`
							: `./public/images/intermediate_pic/${filename}`;
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

						// UPDATE `trip_auth` SET `start_time_pic`= ?,`intermediate_pic`= ?,`end_pic`= ? WHERE trip_id = ?
						if (pic === "start") {
							await pool.query(
								"UPDATE `trip_auth` SET `start_time_pic`= ? WHERE trip_id = ?",
								[filename, tripId]
							);
							return res.send({
								code: 1,
							});
						} else if (pic === "end") {
							await pool.query(
								"UPDATE `trip_auth` SET `end_pic`= ? WHERE trip_id = ?"[
									(filename, tripId)
								]
							);
							return res.send({
								code: 1,
							});
						} else {
							const trip = await pool.query(
								"SELECT * FROM `trip_auth` WHERE trip_id = ?",
								[tripId]
							);
							const intermediate = trip.length
								? trip[0].intermediate_pic
									? trip[0].intermediate_pic.split("#")
									: []
								: [];
							intermediate[pic] = filename;
							await pool.query(
								"UPDATE `trip_auth` SET `intermediate_pic`= ? WHERE trip_id = ?",
								[intermediate.join("#"), tripId]
							);
							return res.send({
								code: 1,
							});
						}
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

router.post("/kmUpdate", async (req, res) => {
	try {
		const { tripId, pic, km } = req.body;
		const trip = await pool.query("SELECT * FROM `trip_auth` WHERE trip_id = ?", [tripId]);

		// UPDATE `trip_auth` SET `start`= ?,`intermediate`= ?,`end`= ? WHERE trip_id = ?
		if (pic === "start") {
			await pool.query("UPDATE `trip_auth` SET `start`= ? WHERE trip_id = ?", [km, tripId]);
			return res.send({
				code: 1,
			});
		} else if (pic === "end") {
			await pool.query("UPDATE `trip_auth` SET `end`= ? WHERE trip_id = ?", [km, tripId]);
			return res.send({
				code: 1,
			});
		} else {
			const interKm = trip.length
				? trip[0].intermediate
					? trip[0].intermediate.split("#")
					: []
				: [];
			interKm[pic] = km;
			await pool.query("UPDATE `trip_auth` SET `intermediate`= ? WHERE trip_id = ?", [
				interKm.join("#"),
				tripId,
			]);
			return res.send({
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/podNumber", async (req, res) => {
	try {
		const podMissing = await pool.query(
			"SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name,COUNT(pod_pic.pod_id) AS 'pod' FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did LEFT JOIN pod_pic ON pod_pic.trip_id = trip.trip_id WHERE trip.t_id = ? AND trip.status = 2 GROUP BY trip.trip_id,driver_tab.d_name HAVING pod = 0 ORDER BY trip.created DESC",
			[req.body.tId]
		);
		const podUnconfirmed = await pool.query(
			"SELECT trip.trip_id,load_post.load_id,load_post.pickup_location,load_post.last_point,load_post.intermediate_loc,load_post.weight,load_post.vehicle_type,load_post.amount,load_post.type,'ROADEXPRESS' AS name,driver_tab.d_name FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN pod_pic ON pod_pic.trip_id = trip.trip_id AND pod_pic.confirm = 0 WHERE trip.t_id = ? AND trip.status = 2 GROUP BY trip.trip_id,driver_tab.d_name ORDER BY trip.created DESC",
			[req.body.tId]
		);
		return res.send({ code: 1, data: podMissing.length + podUnconfirmed.length });
	} catch (error) {
		console.error(error);
		apiLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0, msg: "Server Error" });
	}
});

router.post("/loadPush", async (req, res) => {
	try {
		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY hh:mm a");

		const message = new gcm.Message({
			data: {
				key1: "msg1",
				load: 1102,
				title: "New Load Found",
				icon: "ic_launcher",
				body: "This is a notification that will be displayed if your app is in the background.",
			},
		});
		const [loadDetails] = await pool.query("SELECT * FROM `load_post` WHERE load_id = ?", [
			1102,
		]);

		const check = await pool.query(
			"SELECT * FROM `pre_confirmed_load` WHERE vehicle_id = ? AND Did = ? AND tId = ? AND load_id = ?",
			[214, "Driver169", 203, 1102]
		);
		if (check.length === 0) {
			await pool.query(
				"INSERT INTO `pre_confirmed_load`(`vehicle_id`, `Did`, `conf_time`, `status`, `load_id`, `tId`, `fromc`) VALUES (?,?,?,?,?,?,?)",
				[214, "Driver169", date, 0, 1102, 203, loadDetails.fromc]
			);
		}
		const [details] = await pool.query("SELECT * FROM `driver_tab` WHERE Did = ?", [
			"Driver169",
		]);
		if (details) {
			if (details.fcm_token) {
				let regTokens = [`${details.fcm_token}`];
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
						}
					}
				);
			}
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

module.exports = router;
