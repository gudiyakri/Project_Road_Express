const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const passport = require("passport");
const formidable = require("formidable");
const fs = require("fs-extra");
const moment = require("moment");
const gcm = require("node-gcm");
const { ensureAuthenticatedAdmin } = require("../helper/auth");
const firebase = require("firebase-admin");
const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");
const fastcsv = require("fast-csv");
const axios = require("axios");
const csc = require("country-state-city").default;

const { dashLogger } = require("../helper/logger");

const serviceAccount = require("../config/serviceAccount.json");
const {
	firebaseUrl,
	loadUrl,
	TRACCAR,
	USERNAME,
	PASSTRACCAR,
	base64Id,
} = require("../utils/Constant");

// firebase.initializeApp({
// 	credential: firebase.credential.cert(serviceAccount),
// 	databaseURL: "https://bot-dectnx.firebaseio.com",
// });

// //const dbFire = firebase.database();

const sender = new gcm.Sender("##########################");

router.get("/", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			'SELECT DISTINCT(YEAR(STR_TO_DATE(date, "%d/%m/%Y"))) AS year FROM total_load;SELECT DISTINCT(state) AS state FROM `cities` WHERE 1'
		);
		return res.render("admin/index", {
			year: data[0],
			state: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/city", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT * FROM cities;SELECT `id`, `state` FROM `state_list`"
		);
		return res.render("admin/city", {
			city: data[0],
			state: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/addDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.name,trans_tab.id,cities.city AS sahar FROM trans_tab INNER JOIN cities WHERE trans_tab.city = cities.id ORDER BY trans_tab.id;SELECT trans_tab.name,driver_tab.*,cities.city as sahar FROM trans_tab INNER JOIN driver_tab ON trans_tab.id=driver_tab.tid INNER JOIN cities ON driver_tab.city=cities.id AND driver_tab.active = 0;SELECT state FROM state_list"
		);
		return res.render("admin/addDriver", {
			trans: data[0],
			driver: data[1],
			state: data[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/addTrans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.*,count(vehicle_table.v_id) AS fleet,cities.city as sahar FROM `trans_tab` LEFT JOIN `vehicle_table` ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city=cities.id GROUP BY trans_tab.id ORDER BY fleet DESC ;SELECT id,state from state_list"
		);
		return res.render("admin/addTrans", {
			trans: data[0],
			state: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/search", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT id,city FROM cities WHERE state=?", [
			req.body.state,
		]);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/vehicles", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.name,trans_tab.id,cities.city AS sahar FROM trans_tab INNER JOIN cities WHERE trans_tab.city = cities.id ORDER BY trans_tab.id;SELECT type_name,dimension,capacity FROM vehicle_type;SELECT trans_tab.name,trans_tab.mob,vehicle_table.*,cities.city AS sahar FROM vehicle_table INNER JOIN trans_tab ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city = cities.id"
		);
		return res.render("admin/vehicles", {
			trans: data[0],
			info: null,
			type: data[1],
			vehicles: null,
			allVehicles: data[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/login", async (req, res) => {
	try {
		passport.authenticate("admin", {
			successRedirect: "/admin",
			failureRedirect: "/",
			failureFlash: true,
		})(req, res);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addTrans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			}
			const transDetails = await pool.query("SELECT mob FROM trans_tab WHERE mob = ?", [
				fields.mob,
			]);
			if (transDetails.length) {
				req.flash("error_msg", "Transporter is already registered");
				return res.redirect("/admin/addTrans");
			} else {
				if (files.aadhar_trans_pic) {
					if (files.aadhar_trans_pic.size > 0) {
						let oldpath = files.aadhar_trans_pic.path;
						let newpath = `./public/images/transporter/aadhar_trans/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				if (files.prof_trans_pic) {
					if (files.prof_trans_pic.size > 0) {
						let oldpath = files.prof_trans_pic.path;
						let newpath = `./public/images/transporter/profile/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				if (files.aadhar_trans_back)
					if (files.aadhar_trans_back.size > 0) {
						let oldpath = files.aadhar_trans_back.path;
						let newpath = `./public/images/transporter/aadhar_trans_back/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, async error => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							} else {
								console.log("Success");
							}
						});
					}
				if (files.pancard_image) {
					if (files.pancard_image.size > 0) {
						let oldpath = files.pancard_image.path;
						let newpath = `./public/images/transporter/pancard/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				if (files.gst_image) {
					if (files.gst_image.size > 0) {
						let oldpath = files.gst_image.path;
						let newpath = `./public/images/transporter/gst/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				if (files.cheque_image) {
					if (files.cheque_image.size > 0) {
						let oldpath = files.cheque_image.path;
						let newpath = `./public/images/transporter/cheque/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				if (files.tds_declaration_image) {
					if (files.tds_declaration_image.size > 0) {
						let oldpath = files.tds_declaration_image.path;
						let newpath = `./public/images/transporter/tdsdeclaration/${fields.mob}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				}
				const trans = {
					name: fields.username,
					city: fields.city,
					state: fields.state,
					fleet_size: fields.fleet,
					mob: fields.mob,

					email: fields.email,
					u_flag: 1,

					aadhar_trans_pic: `${fields.mob}.jpg`,
					prof_trans_pic: `${fields.mob}.jpg`,
					aadhar_trans_back: `${fields.mob}.jpg`,
					pancard_image: `${fields.mob}.jpg`,
					gst_image: `${fields.mob}.jpg`,
					cheque_image: `${fields.mob}.jpg`,
					tds_declaration_image: `${fields.mob}.jpg`,
				};
				await pool.query(
					"INSERT INTO trans_tab (name,city,state,fleet_size,mob,email,u_flag,aadhar_trans_pic,prof_trans_pic,aadhar_trans_back,pancard_image,gst_image,cheque_image,tds_declaration_image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
					[
						trans.name,
						trans.city,
						trans.state,
						trans.fleet_size,
						trans.mob,

						trans.email,
						trans.u_flag,

						trans.aadhar_trans_pic,
						trans.prof_trans_pic,
						trans.aadhar_trans_back,
						trans.pancard_image,
						trans.gst_image,
						trans.cheque_image,
						trans.tds_declaration_image,
					]
				);
				req.flash("success_msg", "Transporter Added");
				return res.redirect("/admin/addTrans");
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/vehicles/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.name,trans_tab.state,trans_tab.fleet_size,trans_tab.mob,vehicle_table.*,cities.city AS sahar FROM trans_tab LEFT JOIN vehicle_table ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city = cities.id WHERE trans_tab.id = ?;SELECT trans_tab.name,trans_tab.id,cities.city AS sahar FROM trans_tab INNER JOIN cities WHERE trans_tab.city = cities.id ORDER BY trans_tab.name;SELECT type_name,dimension,capacity FROM vehicle_type;SELECT trans_tab.name,trans_tab.mob,vehicle_table.*,cities.city AS sahar FROM vehicle_table INNER JOIN trans_tab ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city = cities.id",
			[req.params.id]
		);
		req.session.transid = req.params.id;
		res.render("admin/vehicles", {
			trans: data[1],
			type: data[2],
			vehicles: data[0],
			allVehicles: data[3],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const vehicleDetails = await pool.query(
					"SELECT v_num FROM vehicle_table WHERE v_num = ?",
					[fields.vehicle_num]
				);
				if (vehicleDetails.length) {
					req.flash("error_msg", "Vehicle is already registered");
					return res.redirect("/admin/vehicles");
				} else {
					if (files.pic_rc_back) {
						if (files.pic_rc_back.size > 0) {
							let oldpath = files.pic_rc_back.path;
							let newpath = `./public/images/rc_back/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						} else {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
					}
					if (files.pic_rc_front) {
						if (files.pic_rc_front.size > 0) {
							let oldpath = files.pic_rc_front.path;
							let newpath = `./public/images/rc_front/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						} else {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
					}
					if (files.pic_v) {
						if (files.pic_v.size > 0) {
							let oldpath = files.pic_v.path;
							let newpath = `./public/images/vehicle/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						} else {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
					}
					if (files.insurance_pic) {
						if (files.insurance_pic.size > 0) {
							let oldpath = files.insurance_pic.path;
							let newpath = `./public/images/insurance_pic/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						} else {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
					}
					if (files.permit_pic) {
						if (files.permit_pic.size > 0) {
							let oldpath = files.permit_pic.path;
							let newpath = `./public/images/permit_pic/${fields.vehicle_num}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						} else {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
					}
					const vehicle = {
						v_type: fields.type,
						v_num: fields.vehicle_num,
						pic_rc_front: `${fields.vehicle_num}.jpg`,
						pic_rc_back: `${fields.vehicle_num}.jpg`,
						pic_v: `${fields.vehicle_num}.jpg`,
						verif_flag: false,
						insurance_num: fields.insurance_num,
						permit_type: fields.permit,
						active: false,
						rc_exp: fields.rc_exp,
						t_id: req.session.transid,
						permit_pic: `${fields.vehicle_num}.jpg`,
						insurance_pic: `${fields.vehicle_num}.jpg`,
					};
					await pool.query(
						"INSERT INTO vehicle_table (v_type,v_num,pic_rc_front,pic_rc_back,pic_v,verif_flag,insurance_num,permit_type,active,t_id,rc_exp,insurance_pic,permit_pic) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
						[
							vehicle.v_type,
							vehicle.v_num,
							vehicle.pic_rc_front,
							vehicle.pic_rc_back,
							vehicle.pic_v,
							vehicle.verif_flag,
							vehicle.insurance_num,
							vehicle.permit_type,
							vehicle.active,
							vehicle.t_id,
							vehicle.rc_exp,
							vehicle.insurance_pic,
							vehicle.permit_pic,
						]
					);
					req.flash("success_msg", "Vehicle Added");
					return res.redirect(`/admin/vehicles/${req.session.transid}`);
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/display/:type/:pic", ensureAuthenticatedAdmin(), async (req, res) => {
	res.render("admin/display", {
		type: req.params.type,
		vehicles: req.params.pic,
	});
});

router.post("/addCity", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const check = await pool.query("SELECT city FROM cities WHERE city = ?", [req.body.city]);
		if (check.length) {
			req.flash("error_msg", "City already registered");
			return res.redirect("/admin/city");
		} else {
			const city = {
				city: req.body.city,
				state: req.body.state,
			};
			await pool.query("INSERT INTO cities (state,city) VALUES (?,?)", [
				city.state,
				city.city,
			]);
			req.flash("success_msg", "City Added");
			return res.redirect(`/admin/city`);
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.log(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			}
			const driverDetails = await pool.query("SELECT phn FROM driver_tab WHERE phn = ?", [
				fields.phn,
			]);
			if (driverDetails.length) {
				req.flash("error_msg", "Driver is already registered");
				return res.redirect("/admin/addDriver");
			} else {
				if (files.prof_pic) {
					let oldpath = files.prof_pic.path;
					let newpath = `./public/images/driver/profile/${fields.phn}.jpg`;
					fs.rename(oldpath, newpath, error => {
						if (error) {
							console.log(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
				}
				if (files.dl_pic_back) {
					let oldpath = files.dl_pic_back.path;
					let newpath = `./public/images/driver/dl_pic_back/${fields.phn}.jpg`;
					fs.rename(oldpath, newpath, error => {
						if (error) {
							console.log(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
				}
				if (files.dl_pic_front) {
					let oldpath = files.dl_pic_front.path;
					let newpath = `./public/images/driver/dl_pic_front/${fields.phn}.jpg`;
					fs.rename(oldpath, newpath, error => {
						if (error) {
							console.log(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
				}
				if (files.aadhar_front_pic) {
					let oldpath = files.aadhar_front_pic.path;
					let newpath = `./public/images/driver/aadhar_front_pic/${fields.phn}.jpg`;
					fs.rename(oldpath, newpath, error => {
						if (error) {
							console.log(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
				}
				if (files.aadhar_pic_back) {
					let oldpath = files.aadhar_pic_back.path;
					let newpath = `./public/images/driver/aadhar_pic_back/${fields.phn}.jpg`;
					fs.rename(oldpath, newpath, error => {
						if (error) {
							console.log(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
				}
				const Did = await pool.query("SELECT MAX(id)+1 AS noDid FROM driver_tab");
				const driver = {
					did: `Driver${Did[0].noDid}`,
					d_name: fields.name,
					phn: fields.phn,
					prof_pic: `${fields.phn}.jpg`,
					aadhar_front_pic: `${fields.phn}.jpg`,
					aadhar_pic_back: `${fields.phn}.jpg`,
					dl_pic_front: `${fields.phn}.jpg`,
					dl_pic_back: `${fields.phn}.jpg`,
					verif_flag: false,
					city: fields.city,
					state: fields.state,
					birthday: fields.birthday,
					tid: fields.trans,
					add_by: "0",

					u_flag: 1,
					lice_exp: fields.lice_exp,
				};
				await pool.query(
					"INSERT INTO driver_tab (Did,d_name,phn,prof_pic,aadhar_front_pic,aadhar_pic_back,dl_pic_front,dl_pic_back,verif_flag,city,state,birthday,tid,add_by,u_flag,lice_exp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
					[
						driver.did,
						driver.d_name,
						driver.phn,
						driver.prof_pic,
						driver.aadhar_front_pic,
						driver.aadhar_pic_back,
						driver.dl_pic_front,
						driver.dl_pic_back,
						driver.verif_flag,
						driver.city,
						driver.state,
						driver.birthday,
						driver.tid,
						driver.add_by,

						driver.u_flag,
						driver.lice_exp,
					]
				);
				firebase
					.database()
					.ref("driver_test/" + driver.did)
					.set({
						location: "0,0",
						d_av: "1",
						t_av: "1",
						trip: "0",
						updated: "1",
					});
				req.flash("success_msg", "Driver Added");
				return res.redirect("/admin/addDriver");
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/update/:Did", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const date_ver = new Date();
		const date_verif = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
		await pool.query("UPDATE driver_tab SET verif_flag= 1,date_verif = ? WHERE Did = ?", [
			date_verif,
			req.params.Did,
		]);

		req.flash("success_msg", "Driver Verified");
		return res.redirect("/admin/addDriver");
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/updateV/:v_id/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const date_ver = new Date();
		const date_verif = moment(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
		await pool.query(
			"UPDATE vehicle_table SET verif_flag= 1,verif_flag_date = ? WHERE v_id = ?",
			[date_verif, req.params.v_id]
		);
		req.flash("success_msg", "Vehicle Verified");
		return res.redirect(`/admin/vehicles/${req.params.id}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/maps/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM cities WHERE id = ?", [req.params.id]);
		return res.render("admin/maps", {
			city: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/mapD", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.id,trans_tab.name,cities.city FROM trans_tab INNER JOIN cities WHERE trans_tab.city = cities.id"
		);
		return res.render("admin/mapD", {
			trans: data,
			info: null,
			vehicles: null,
			driver: null,
			mapped: null,
			transporter: null,
			gps: [],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/mapD/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.*,vehicle_table.*,cities.city AS sahar FROM trans_tab LEFT JOIN vehicle_table ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city = cities.id WHERE trans_tab.id = ? AND vehicle_table.v_id NOT IN (SELECT vehicle_id FROM main_map);SELECT driver_tab.* FROM driver_tab WHERE driver_tab.tid = ? AND driver_tab.Did NOT IN (SELECT Did FROM main_map);SELECT trans_tab.*,vehicle_table.*,main_map.*,driver_tab.d_name,cities.city AS sahar,gps.* FROM trans_tab LEFT JOIN vehicle_table ON trans_tab.id=vehicle_table.t_id INNER JOIN cities ON trans_tab.city = cities.id INNER JOIN main_map ON main_map.vehicle_id = vehicle_table.v_id LEFT JOIN gps ON gps.serviceId = main_map.gpsId INNER JOIN driver_tab ON main_map.Did = driver_tab.Did WHERE trans_tab.id = ?;SELECT trans_tab.*,cities.city AS sahar FROM trans_tab INNER JOIN cities ON trans_tab.city = cities.id WHERE trans_tab.id = ?;SELECT trans_tab.id,trans_tab.name,cities.city FROM trans_tab INNER JOIN cities WHERE trans_tab.city = cities.id",
			[req.params.id, req.params.id, req.params.id, req.params.id]
		);
		const gps = await pool.query("SELECT * FROM `gps`");

		return res.render("admin/mapD", {
			trans: data[4],
			vehicles: data[0],
			driver: data[1],
			mapped: data[2],
			transporter: data[3],
			gps: gps,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/update", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const map = {
			Did: req.body.Did,
			v_id: req.body.v_id,
		};

		await pool.query("INSERT INTO main_map (Did,vehicle_id) VALUES (?,?)", [map.Did, map.v_id]);
		await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
			map.Did,
			map.v_id,
		]);

		req.flash("success_msg", "Driver Mapped");
		return res.send(map);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateMapping", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const update = {
			Did: req.body.Did,
			v_id: req.body.v_id,
			gpsId: req.body.gpsId,
		};
		const data = await pool.query("SELECT `Did` FROM `main_map` WHERE vehicle_id = ?", [
			update.v_id,
		]);

		await pool.query("UPDATE main_map SET gpsId = NULL WHERE gpsId = ?", [
			update.gpsId,
			update.v_id,
		]);

		if (update.Did) {
			await pool.query(
				"UPDATE main_map SET Did = ?,d_av = 1,t_av = 1,gpsId = ? WHERE vehicle_id = ?",
				[update.Did, update.gpsId, update.v_id]
			);
			await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
				update.Did,
				update.v_id,
			]);
		} else {
			await pool.query(
				"UPDATE main_map SET Did = ?,d_av = 1,t_av = 1,gpsId = ? WHERE vehicle_id = ?",
				[data[0].Did, update.gpsId, update.v_id]
			);
			await pool.query("INSERT INTO mapping_dummy (Did,vehicle_id) VALUES (?,?)", [
				data[0].Did,
				update.v_id,
			]);
		}

		dbFire
			.ref(`/${firebaseUrl}/${data[0].Did}`)
			.update({
				d_av: "1",
				t_av: "1",
			})
			.then(function () {
				req.flash("success_msg", "Driver Update");
				return res.send(update);
			})
			.catch(function () {
				return res.send({
					code: 0,
				});
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateStatus", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const remove = {
			Did: req.body.Did,
			vehicleId: req.body.vehicleId,
			flag: req.body.flag,
		};
		await pool.query(
			"UPDATE `main_map` SET `d_av`= ?,`t_av`= ? WHERE vehicle_id = ? AND Did = ?",
			[remove.flag, remove.flag, remove.vehicleId, remove.Did]
		);
		dbFire
			.ref(`/${firebaseUrl}/${remove.Did}`)
			.update({
				d_av: `${remove.flag}`,
				t_av: `${remove.flag}`,
			})
			.then(function () {
				req.flash("success_msg", "Driver Updated");
				return res.send(remove);
			})
			.catch(function () {
				return res.send({
					code: 0,
				});
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/removeMapping", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const remove = {
			Did: req.body.Did,
			v_id: req.body.v_id,
		};
		await pool.query("DELETE FROM main_map WHERE vehicle_id = ? AND Did = ?", [
			remove.v_id,
			remove.Did,
		]);
		dbFire
			.ref(`/${firebaseUrl}/${remove.Did}`)
			.update({
				d_av: "1",
				t_av: "1",
			})
			.then(function () {
				req.flash("success_msg", "Driver Removed");
				return res.send(remove);
			})
			.catch(function () {
				return res.send({
					code: 0,
				});
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/sos", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM cities");
		return res.render("admin/sos", {
			city: data,
			driver: null,
			currentCity: null,
			company: null,
			load: null,
			loadType: null,
			list: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/sos/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		req.session.cid = req.params.id;
		const data = await pool.query(
			"SELECT driver_tab.*,trans_tab.*,main_map.*,vehicle_table.*,cities.city AS sahar FROM driver_tab INNER JOIN cities ON driver_tab.city = cities.id INNER JOIN trans_tab ON driver_tab.tid = trans_tab.id INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON main_map.vehicle_id = vehicle_table.v_id WHERE driver_tab.city = ? AND driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND main_map.d_av = 0 AND main_map.t_av = 0;SELECT city,id FROM cities WHERE cities.id = ?;SELECT * FROM load_type;SELECT Did FROM `driver_tab` WHERE city = ?;SELECT * FROM cities",
			[req.params.id, req.params.id, req.params.id]
		);
		return res.render("admin/sos", {
			city: data[4],
			driver: data[0],
			currentCity: data[1],
			company: null,
			load: null,
			loadType: data[2],
			list: data[3],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addSos", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		let inter;
		if (typeof req.body.inter == "object") {
			inter = req.body.inter;
			inter = inter.join("^");
		} else if (req.body.inter.length == 0) {
			inter = "";
		} else {
			inter = req.body.inter;
		}
		let inter_mob = JSON.stringify(req.body.inter_mob);

		const load = {
			fromc: req.body.name,
			type: req.body.type,
			amount: req.body.amount,
			vehicle_type: req.body.vtype,
			pickup_location: req.body.pickup,
			intermediate_loc: inter,
			last_point: req.body.dest,
			timef: req.body.timef,
			timet: req.body.timet,
			flag: req.body.flag,
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
			did: req.body.did,
		};
		await pool.query(
			"INSERT INTO load_post(fromc,type,amount,vehicle_type,pickup_location,intermediate_loc,last_point,timef,timet,flag,weight,start_mob,end_mob,inter_mob,city,lat_long,last_lat_long,no_vehicle,inter_lat_long,dest_city) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
			[
				load.fromc,
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
				load.no_vehicle,
				load.inter_lat_long,
				load.dest_city,
			]
		);
		const total = await pool.query(
			"SELECT tot FROM `total_load` WHERE id = (SELECT MAX(id) FROM total_load)"
		);
		const date_ver = new Date();
		const dateLoad = moment.utc(date_ver).utcOffset("+05:30").format("DD/MM/YYYY");
		const tot = total[0].tot + parseInt(load.amount, 10);
		await pool.query("INSERT INTO total_load(date,tot) VALUES (?,?)", [dateLoad, tot]);

		req.flash("success_msg", "SOS Sent");
		return res.redirect(`/admin/sos/${req.session.cid}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/vtypes", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT `type_name` FROM `vehicle_type`");
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/findDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM trans_tab WHERE city =  ?", [
			req.body.citys,
		]);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/self", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT trans_tab.* FROM trans_tab ;SELECT trans_tab.name,driver_tab.*,cities.city as sahar FROM trans_tab INNER JOIN driver_tab ON trans_tab.id=driver_tab.tid INNER JOIN cities ON driver_tab.city=cities.id ;SELECT state FROM state_list"
		);
		return res.render("admin/self", {
			trans: data[0],
			driver: data[1],
			state: data[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addSelf", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.log(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const driverDetails = await pool.query("SELECT phn FROM driver_tab WHERE phn = ?", [
					fields.phn,
				]);
				if (driverDetails.length) {
					req.flash("error_msg", "Driver is already registered");
					return res.redirect("/admin/addDriver");
				} else {
					if (files.prof_pic) {
						if (files.prof_pic.size > 0) {
							let oldpath = files.prof_pic.path;
							let newpath = `./public/images/profile/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.log(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					}
					if (
						(files.dl_pic_back,
						{
							overwrite: true,
						})
					) {
						if (files.dl_pic_back.size > 0) {
							let oldpath = files.dl_pic_back.path;
							let newpath = `./public/images/dl_pic_back/${fields.phn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.log(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					}
					if (files.dl_pic_front) {
						let oldpath = files.dl_pic_front.path;
						let newpath = `./public/images/dl_pic_front/${fields.phn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.log(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					if (files.aadhar_front_pic) {
						let oldpath = files.aadhar_front_pic.path;
						let newpath = `./public/images/aadhar_front_pic/${fields.phn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.log(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
						let newpathTrans = `./public/images/aadhar_trans/${fields.phn}.jpg`;
						fs.rename(oldpath, newpathTrans, error => {
							if (error) {
								console.log(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					const Did = await pool.query("SELECT MAX(id)+1 AS noDid FROM driver_tab");

					const driver = {
						name: fields.trans,
						did: `Driver${Did[0].noDid}`,
						d_name: fields.name,
						phn: fields.phn,
						prof_pic: `${fields.phn}.jpg`,
						aadhar_front_pic: `${fields.phn}.jpg`,
						dl_pic_front: `${fields.phn}.jpg`,
						dl_pic_back: `${fields.phn}.jpg`,
						verif_flag: false,
						city: fields.city,
						state: fields.state,
						birthday: fields.birthday,
						fleet_size: fields.fleet,
						add_by: "0",
						bankAccd: fields.bankAcc,
						email: fields.email,
						acc_name: fields.acc_name,
						ifsc: fields.ifsc,
					};
					const transId = await pool.query(
						"INSERT INTO trans_tab (name,city,state,fleet_size,mob,bankAcc,acc_name,ifsc,aadhar_trans_pic) VALUES (?,?,?,?,?,?,?,?,?)",
						[
							driver.name,
							driver.city,
							driver.state,
							driver.fleet_size,
							driver.phn,
							driver.bankAccd,
							driver.acc_name,
							driver.ifsc,
							driver.aadhar_front_pic,
						]
					);

					await pool.query(
						"INSERT INTO driver_tab (Did,d_name,phn,prof_pic,aadhar_front_pic,dl_pic_front,dl_pic_back,verif_flag,city,state,birthday,tid,add_by,bankAccd,acc_name,ifsc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
						[
							driver.did,
							driver.d_name,
							driver.phn,
							driver.prof_pic,
							driver.aadhar_front_pic,
							driver.dl_pic_front,
							driver.dl_pic_back,
							driver.verif_flag,
							driver.city,
							driver.state,
							driver.birthday,
							transId.insertId,
							driver.add_by,
							driver.bankAccd,
							driver.acc_name,
							driver.ifsc,
						]
					);
					req.flash("success_msg", "Driver Added");
					return res.redirect("/admin/addDriver");
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/addUser", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const state = await pool.query("SELECT id,state from state_list");
		return res.render("admin/addUser", {
			state: state,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addUser", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const userDetails = await pool.query("SELECT email FROM users WHERE email = ?", [
					fields.email,
				]);
				if (userDetails.length) {
					req.flash("error_msg", "Client is already registered!!");
					return res.redirect("/admin/addUser");
				} else {
					const userId = await pool.query("SELECT MAX(uId)+1 AS noUser FROM users");
					if (files.profilePic) {
						if (files.profilePic.size > 0) {
							let oldpath = files.profilePic.path;
							let newpath = `./public/images/userProf/${fields.email}.jpg`;
							fs.rename(oldpath, newpath, err => {
								if (err) {
									console.log(err);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					}
					const user = {
						id: `rc_${userId[0].noUser}`,
						name: fields.name,
						city: fields.city,
						state: fields.state,
						address: fields.address,
						mob: fields.mob,
						email: fields.email,
						password: fields.password,
						flag: 0,
						designation: fields.desig,
						employee_id: fields.emp_id,
						surge_charge: fields.surge_charge,
						confirmed: 2,
						gst: fields.gst,
						profilePic: `${fields.email}.jpg`,
						rateType: fields.rateMatrix,
						waitFlag: fields.waitFlag,
					};
					const salt = await bcrypt.genSalt(10);
					const password = await bcrypt.hash(user.password, salt);

					const insertId = await pool.query(
						"INSERT INTO `users`(`id`, `name`, `city`, `state`, `address`, `mob`, `email`, `password`, `flag`,`designation`,`employee_id`,`confirmed`,`surge_charge`,`gst`, `profile`, `rateType`, `waitFlag`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
						[
							user.id,
							user.name,
							user.city,
							user.state,
							user.address,
							user.mob,
							user.email,
							password,
							user.flag,
							user.designation,
							user.employee_id,
							user.confirmed,
							user.surge_charge,
							user.gst,
							user.profilePic,
							user.rateType,
							user.waitFlag,
						]
					);
					req.flash("success_msg", "Client added!");

					if (fields.subFlag) {
						console.log("Success");
						const { vehicle, date, km, amount, rate } = fields;
						try {
							if (typeof vehicle === "string") {
								const [vehicleInfo] = await pool.query(
									"SELECT * FROM vehicle_table WHERE v_id = ?",
									[vehicle]
								);
								await pool.query(
									"INSERT INTO `subscription`(`clientId`, `tId`, `vehicleId`, `fromDate`, `toDate`, `km`, `amount`, `rate`) VALUES (?,?,?,?,?,?,?,?)",
									[
										insertId.insertId,
										vehicleInfo.t_id,
										vehicleInfo.v_id,
										date.split(" ")[0],
										date.split(" ")[2],
										km,
										amount,
										rate,
									]
								);
							} else {
								for (let i = 0; i < vehicle.length; i++) {
									const [vehicleInfo] = await pool.query(
										"SELECT * FROM vehicle_table WHERE v_id = ?",
										[vehicle[i]]
									);
									await pool.query(
										"INSERT INTO `subscription`(`clientId`, `tId`, `vehicleId`, `fromDate`, `toDate`, `km`, `amount`, `rate`) VALUES (?,?,?,?,?,?,?,?)",
										[
											insertId.insertId,
											vehicleInfo.t_id,
											vehicleInfo.v_id,
											date.split(" ")[0],
											date.split(" ")[2],
											km,
											amount,
											rate,
										]
									);
								}
							}
							req.flash("success_msg", "Subscription added!");
						} catch (error) {
							if (error.code === "ER_DUP_ENTRY") {
								req.flash(
									"error",
									"Subscription already added for the given period for the client and vehicle"
								);
							} else {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.render("/400");
							}
						}
					}

					return res.redirect("/admin/addUser");
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/trip", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM cities;SELECT id,state from state_list");
		return res.render("admin/trip", {
			city: data[0],
			state: data[1],
			currentCity: null,
			loadType: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/trip/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		req.session.cid = req.params.id;
		const data = await pool.query(
			"SELECT city,id FROM cities WHERE cities.id = ?;SELECT * FROM load_type;SELECT * FROM cities;SELECT id,state from state_list",
			[req.params.id]
		);
		return res.render("admin/trip", {
			city: data[2],
			currentCity: data[0],
			loadType: data[1],
			state: data[3],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/findCompany", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT id,name,rateType,waitFlag FROM users WHERE city = ?",
			[req.body.citys]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addTrip", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		let inter, loadName, loadQuan, loadType, invoice, load_amount;

		if (typeof req.body.inter == "object") {
			inter = req.body.inter;
			if (req.body.inter.length === req.body.inter_lat_long.split("^").length - 1) {
				inter = inter.join("^");
			} else {
				req.flash("error_msg", "Error in Latitude Longitude. Please re-enter trip.");
				return res.redirect(`/admin/trip/${req.session.cid}`);
			}
		} else if (req.body.inter.length == 0) {
			inter = "";
		} else {
			inter = req.body.inter;
		}

		if (typeof req.body.load_name === "object") {
			loadName = req.body.load_name;
			loadName = loadName.join("^");
		} else if (req.body.load_name.length === 0) {
			loadName = "";
		} else {
			loadName = req.body.load_name;
		}

		if (typeof req.body.load_quan === "object") {
			loadQuan = req.body.load_quan;
			loadQuan = loadQuan.join("^");
		} else if (req.body.load_quan.length === 0) {
			loadQuan = "";
		} else {
			loadQuan = req.body.load_quan;
		}

		if (typeof req.body.load_type === "object") {
			loadType = req.body.load_type;
			loadType = loadType.join("^");
		} else if (req.body.load_type.length === 0) {
			loadType = "";
		} else {
			loadType = req.body.load_type;
		}

		if (typeof req.body.invoice_num === "object") {
			invoice = req.body.invoice_num;
			invoice = invoice.join("^");
		} else if (req.body.invoice_num.length === 0) {
			invoice = "";
		} else {
			invoice = req.body.invoice_num;
		}

		if (typeof req.body.load_amount === "object") {
			load_amount = req.body.load_amount;
			load_amount = load_amount.join("^");
		} else if (req.body.load_amount.length === 0) {
			load_amount = "";
		} else {
			load_amount = req.body.load_amount;
		}

		const inter_mob = JSON.stringify(req.body.inter_mob);

		const load = {
			fromc: req.body.name,
			type: req.body.type,
			amount: req.body.amount,
			vehicle_type: req.body.vtype,
			pickup_location: req.body.pickup,
			intermediate_loc: inter,
			last_point: req.body.dest,
			timef: req.body.timef,
			timet: req.body.timet,
			flag: req.body.flag,
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
			clientAmount: req.body.clientAmount,
			loadName: loadName,
			loadQuan: loadQuan,
			loadType: loadType,
			invoice_num: invoice,
			load_amount: load_amount,
		};
		if (!load.lat_long || !load.last_lat_long) {
			req.flash("error_msg", "Error in Latitude Longitude. Please re-enter trip");
			return res.redirect(`/admin/trip/${req.session.cid}`);
		} else {
			const loadId = await pool.query(
				"INSERT INTO load_post(fromc,type,amount,clientAmount,vehicle_type,pickup_location,intermediate_loc,last_point,timef,timet,flag,weight,start_mob,end_mob,inter_mob,city,lat_long,last_lat_long,inter_lat_long,no_vehicle,dest_city,remark,load_name,load_quan,load_type,invoice_num,load_amount,totalAmount,remaining) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
				[
					load.fromc,
					load.type,
					load.amount,
					load.clientAmount,
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
					load.loadName,
					load.loadQuan,
					load.loadType,
					load.invoice_num,
					load.load_amount,
					load.totalAmount,
					load.no_vehicle,
				]
			);
			firebase
				.database()
				.ref("loads_test/" + loadId.insertId)
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
				const total = parseInt(totalLoad[0].tot, 10) + parseInt(load.clientAmount, 10);
				await pool.query("UPDATE `total_load` SET `tot`= ? WHERE date = ?", [
					total,
					dateLoad,
				]);
				req.flash("success_msg", "Trip Added");
				return res.redirect(`/admin/trip/${req.session.cid}`);
			} else {
				await pool.query("INSERT INTO total_load(date,tot) VALUES (?,?)", [
					dateLoad,
					load.clientAmount,
				]);
				req.flash("success_msg", "Trip Added");
				return res.redirect(`/admin/trip/${req.session.cid}`);
			}
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/placement", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			`SELECT load_post.*,users.name,pending_load.count,cities.city AS sahar FROM load_post INNER JOIN users on load_post.fromc = users.id INNER JOIN cities ON load_post.city = cities.id LEFT JOIN pending_load ON load_post.load_id = pending_load.load_id WHERE load_post.status != 2 AND load_post.status != 1 AND load_post.cancelFlag = 0 ORDER BY created DESC,STR_TO_DATE(load_post.timef,'%d/%m/%Y') DESC`
		);
		return res.render("admin/placement", {
			load: data,
			currentClient: null,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/sos/:id/:load_id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		req.session.cid = req.params.id;
		req.session.load_id = req.params.load_id;

		const data = await pool.query(
			"SELECT trans_tab.*,cities.city AS 'sahar' FROM `trans_tab` INNER JOIN cities ON trans_tab.city =  cities.id WHERE trans_tab.city = ?;SELECT city,id FROM cities WHERE cities.id = ?;SELECT * FROM cities;SELECT users.name FROM users INNER JOIN load_post ON load_post.fromc = users.id WHERE load_post.load_id = ?;SELECT * FROM load_type;SELECT driver_tab.Did FROM driver_tab INNER JOIN cities ON driver_tab.city = cities.id INNER JOIN trans_tab ON driver_tab.tid = trans_tab.id INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON main_map.vehicle_id = vehicle_table.v_id INNER JOIN load_post ON load_post.vehicle_type = vehicle_table.v_type WHERE driver_tab.city = ? AND driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND load_post.load_id = ?",
			[req.params.id, req.params.id, req.params.load_id, req.params.id, req.params.load_id]
		);
		return res.render("admin/sos", {
			city: data[2],
			trans: data[0],
			currentCity: data[1],
			company: data[3],
			load: req.params.load_id,
			loadType: data[4],
			list: data[5],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/book", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		await pool.query("UPDATE load_post SET flag = 1 WHERE load_id = ?", [req.body.load_id]);
		const load = await pool.query(
			"SELECT load_id,driver_ids FROM pending_load WHERE load_id = ?",
			[req.body.load_id]
		);

		if (load.length) {
			let drivers = `${load[0].driver_ids},${req.body.loadD}`;
			await pool.query("UPDATE pending_load SET driver_ids = ? WHERE load_id = ?", [
				drivers,
				req.body.load_id,
			]);
		} else {
			await pool.query("INSERT INTO pending_load (load_id,driver_ids) VALUES(?,?)", [
				req.body.load_id,
				req.body.loadD,
			]);
		}

		let message = new gcm.Message({
			data: {
				key1: "msg1",
				load: req.body.load_id,
				title: "New Load Found",
				icon: "ic_launcher",
				body: "This is a notification that will be displayed if your app is in the background.",
			},
		});
		const fcm = await pool.query("SELECT fcm_token FROM `driver_tab` WHERE Did = ?", [
			req.body.loadD,
		]);
		const regTokens = [`${fcm[0].fcm_token}`];
		const loadId = req.body.load_id;
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
						res.send({
							loadId,
							code: 1,
						});
					} else {
						res.send({
							code: 0,
						});
					}
				}
			}
		);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/loadedDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT load_id,driver_ids FROM pending_load WHERE load_id = ?",
			[req.body.load_id]
		);
		if (data.length) {
			return res.send({
				drivers: data[0].driver_ids,
				code: 1,
			});
		} else {
			return res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/autofill", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const load = await pool.query(
			"SELECT load_post.*,users.name,cities.city AS sahar FROM `load_post` INNER JOIN users ON load_post.fromc = users.id INNER JOIN cities ON cities.id = load_post.city WHERE load_post.load_id = ?",
			[req.body.load_id]
		);
		if (load.length) {
			return res.send({
				result: load,
				code: 1,
			});
		} else {
			return res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/UpdateSos", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const inter = JSON.stringify(req.body.inter);
		const inter_mob = JSON.stringify(req.body.inter_mob);
		const load = {
			fromc: req.body.name,
			type: req.body.type,
			amount: req.body.amount,
			vehicle_type: req.body.vtype,
			pickup_location: req.body.pickup,
			intermediate_loc: inter,
			last_point: req.body.dest,
			timef: req.body.timef,
			timet: req.body.timet,
			flag: req.body.flag,
			weight: req.body.weight,
			start_mob: req.body.start_mob,
			end_mob: req.body.end_mob,
			inter_mob: inter_mob,
			city: req.body.city,
			lat_long: req.body.lat_long,
			last_lat_long: req.body.last_lat_long,
			no_vehicle: req.body.no_vehicle,
			inter_lat_long: req.body.inter_lat_long,
		};

		await pool.query(
			"UPDATE `load_post` SET `flag`= ?,`fromc`= ?,`type`= ?,`amount`= ?,`vehicle_type`= ?,`pickup_location`= ?,`lat_long`= ?,`inter_lat_long`= ?,`last_lat_long`= ?,`city`= ?,`intermediate_loc`= ?,`last_point`= ?,`timef`= ?,`timet`= ?,`weight`= ?,`inter_mob`= ?,`start_mob`= ?,`end_mob`= ?,`no_vehicle`= ? WHERE load_id = ?",
			[
				load.flag,
				load.fromc,
				load.type,
				load.amount,
				load.vehicle_type,
				load.pickup_location,
				load.lat_long,
				load.inter_lat_long,
				load.last_lat_long,
				load.city,
				load.intermediate_loc,
				load.last_point,
				load.timef,
				load.timet,
				load.weight,
				load.inter_mob,
				load.start_mob,
				load.end_mob,
				load.no_vehicle,
				req.session.load_id,
			]
		);
		req.flash("success_msg", "Load Updated");
		return res.redirect(`/admin/sos/${req.session.cid}/${req.session.load_id}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/findLoad", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const load = await pool.query(
			"SELECT load_post.load_id,load_post.type,load_post.amount,users.name FROM load_post INNER JOIN users ON load_post.fromc = users.id WHERE load_post.load_id = ?",
			[req.body.load]
		);
		return res.send({
			result: load[0],
			code: 1,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("400");
	}
});

router.post("/checkLoad", ensureAuthenticatedAdmin(), async (req, res) => {
	let data = [];
	const loadId = dbFire.ref(`/${loadUrl}`);
	loadId.once("value", snap => {
		snap.forEach(function (child) {
			data.push(child.val().id);
		});
		res.send(JSON.stringify(data));
	});
});

router.post("/send_not", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		let message = new gcm.Message({
			data: {
				key1: "msg1",
				load: req.body.load_id,
				type: "loadNotification",
				title: "New Load Found",
				icon: "ic_launcher",
				body: "You have a new booking notification.",
			},
		});
		await pool.query("UPDATE load_post SET flag = 2 WHERE load_id = ?", [req.body.load_id]);
		const fcm = await pool.query("SELECT fcm_token FROM `trans_tab` WHERE id = ?", [
			req.body.transId,
		]);

		const regTokens = [`${fcm[0].fcm_token}`];
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
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/send_not_trans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		// Prepare a message to be sent
		const message = new gcm.Message({
			data: {
				key1: "msg1",
				load: req.body.load_id,
				type: "SOS",
				title: "New Load Found",
				icon: "ic_launcher",
				body: "This is a notification that will be displayed if your app is in the background.",
			},
		});
		await pool.query("UPDATE load_post SET flag = 2 WHERE load_id = ?", [req.body.load_id]);

		const loadId = req.body.load_id;
		let regTokens = [];
		const fcm = await pool.query("SELECT fcm_token,name FROM `trans_tab` WHERE city = ?", [
			req.body.city,
		]);
		for (let i = 0; i < fcm.length; i++) {
			regTokens.push(`${fcm[i].fcm_token}`);
		}
		sender.send(
			message,
			{
				registrationTokens: regTokens,
			},
			function (err, response) {
				if (err) {
					console.error(error);
					dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
					return res.send({
						code: 0,
					});
				} else {
					if (response) {
						console.log(response);
						return res.send({
							code: 1,
						});
					}
				}
			}
		);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/masterOtp", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(`SELECT masterOtp FROM masterOtp WHERE id = '1'`);
		return res.render("admin/otp", {
			otp: data[0].masterOtp,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/createMaster", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		await pool.query(`UPDATE masterOtp SET masterOtp = ? WHERE id = '1'`, [req.body.otp]);
		req.flash("success_msg", "Master Otp Updated");
		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/rateClient", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT `id`, `name`, `surge_charge` FROM `users` WHERE confirmed = ? AND flag = ?;SELECT `v_type`, `type_name` FROM `vehicle_type` WHERE 1;SELECT id,city FROM cities ORDER BY city ASC;SELECT `id`, `state` FROM `state_list`",
			[2, 0]
		);
		return res.render("admin/rateClient", {
			client: data[0],
			vehicle: data[1],
			city: data[2],
			state: data[3],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/matrix", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT `start`, `end`, `price`, `driverAmount` FROM `rate_matrix` WHERE `vehicle_id` = ? AND `client_id` = ?",
			[req.body.vehicle, req.body.client]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { start, end, vehicle, client, rate, rateDriver } = req.body;
		const data = await pool.query(
			"SELECT `price`,`id`,driverAmount FROM `rate_matrix` WHERE `start` = ? AND `end` = ? AND `client_id` = ? AND `vehicle_id` = ?",
			[start, end, client, vehicle]
		);
		if (data.length > 0) {
			await pool.query(
				"DELETE FROM `rate_matrix` WHERE vehicle_id = ? AND client_id = ? AND start = ? AND end = ?",
				[vehicle, client, start, end]
			);

			await pool.query(
				"INSERT INTO `rate_matrix`(`vehicle_id`, `client_id`, `driverAmount`, `start`, `end`, `price`) VALUES (?,?,?,?,?,?)",
				[vehicle, client, rateDriver, start, end, rate]
			);
		} else {
			await pool.query(
				"INSERT INTO `rate_matrix`(`vehicle_id`, `client_id`, `driverAmount`, `start`, `end`, `price`) VALUES (?,?,?,?,?,?)",
				[vehicle, client, rateDriver, start, end, rate]
			);
		}
		return res.send({
			code: 1,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/getStaticRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { start, end, vehicle, client } = req.body;
		const data = await pool.query(
			"SELECT * FROM `rate_matrix` WHERE vehicle_id = ? AND client_id = ? AND start = ? AND end = ? ORDER BY id DESC LIMIT 1",
			[vehicle, client, start, end]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.get("/dynamicRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const vehicle = await pool.query(
			"SELECT `v_type`, `type_name` FROM `vehicle_type`;SELECT * FROM `users`;SELECT * FROM `state_list`"
		);
		return res.render("admin/dynamicRate", {
			vehicle: vehicle[0],
			client: vehicle[1],
			state: vehicle[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/autoFillRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `dynamic_matrix` WHERE id = ?", [req.body.id]);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/getRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT dynamic_matrix.*,vehicle_type.type_name,cities.city FROM `dynamic_matrix` INNER JOIN vehicle_type ON vehicle_type.v_type = vehicle_id INNER JOIN cities ON cities.id = dynamic_matrix.city WHERE dynamic_matrix.vehicle_id = ? AND dynamic_matrix.city = ?",
			[req.body.vehicleId, req.body.city]
		);
		return res.send({ code: 1, rate: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateDynamic", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const {
			idModal,
			rateModal,
			baseFareModal,
			waitChargeModal,
			waitTimeModal,
			startModal,
			endModal,
		} = req.body;
		if (parseFloat(startModal) >= parseFloat(endModal)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"UPDATE `dynamic_matrix` SET `rate`= ?,`baseFare`= ?,`start`= ?,`end`= ?,`waitCharge`= ?,`waitTime`= ? WHERE id = ?",
			[
				rateModal,
				baseFareModal,
				startModal,
				endModal,
				waitChargeModal,
				waitTimeModal,
				idModal,
			]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/dynamicRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const v_type = await pool.query("SELECT v_type FROM vehicle_type WHERE type_name = ?", [
			req.body.vType,
		]);
		const vType = v_type[0].v_type;
		console.log(req.body, vType);

		const data = await pool.query(
			"SELECT * FROM `dynamic_matrix_client` WHERE vehicle_id = ? AND clientId = ? AND city = ? AND ? BETWEEN start AND end;SELECT * FROM `dynamic_matrix_driver` WHERE vehicle_id = ? AND clientId = ? AND city = ? AND ? BETWEEN start AND end",
			[
				vType,
				req.body.client,
				req.body.city,
				req.body.distance,
				vType,
				req.body.client,
				req.body.city,
				req.body.distance,
			]
		);
		return res.send({ code: 1, client: data[0], driver: data[1] });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/dynamic", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { vehicle, rate, baseFare, waitCharge, waitTime, start, end, cityB2C } = req.body;
		if (parseInt(start) >= parseInt(end)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"INSERT INTO `dynamic_matrix` (`vehicle_id`,`rate`,`baseFare`,`waitCharge`,`waitTime`,`start`,`end`, `city`) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `vehicle_id`=VALUES(`vehicle_id`),`city`=VALUES(`city`), `rate`=VALUES(`rate`), `baseFare`=VALUES(`baseFare`), `waitCharge`=VALUES(`waitCharge`), `waitTime`=VALUES(`waitTime`),`start`=VALUES(`start`),`end`=VALUES(`end`)",
			[vehicle, rate, baseFare, waitCharge, waitTime, start, end, cityB2C]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/getRateClient", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `dynamic_matrix_client` WHERE id = ?", [
			req.body.id,
		]);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/getClientRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT dynamic_matrix_client.*,vehicle_type.type_name,cities.city FROM `dynamic_matrix_client` INNER JOIN vehicle_type ON vehicle_type.v_type = vehicle_id INNER JOIN cities ON cities.id = dynamic_matrix_client.city WHERE clientId = ? AND dynamic_matrix_client.city = ?",
			[req.body.client, req.body.city]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/dynamicClient", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const {
			vehicleSelect,
			rateClient,
			baseFareClient,
			waitChargeClient,
			waitTimeClient,
			startClient,
			endClient,
			clientId,
			citySelect,
		} = req.body;
		if (parseInt(startClient) >= parseInt(endClient)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"INSERT INTO `dynamic_matrix_client` (`vehicle_id`,`rate`,`baseFare`,`waitCharge`,`waitTime`,`start`, `end`, `clientId`, `city`) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `vehicle_id`=VALUES(`vehicle_id`),`city`=VALUES(`city`), `rate`=VALUES(`rate`), `baseFare`=VALUES(`baseFare`), `waitCharge`=VALUES(`waitCharge`), `waitTime`=VALUES(`waitTime`),`start`=VALUES(`start`),`end`=VALUES(`end`),`clientId`=VALUES(`clientId`)",
			[
				vehicleSelect,
				rateClient,
				baseFareClient,
				waitChargeClient,
				waitTimeClient,
				startClient,
				endClient,
				clientId,
				citySelect,
			]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/dynamicClientUpdate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const {
			clientIdModal,
			rateClientModal,
			baseFareClientModal,
			waitChargeClientModal,
			waitTimeClientModal,
			startClientModal,
			endClientModal,
		} = req.body;
		if (parseFloat(startClientModal) >= parseFloat(endClientModal)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"UPDATE `dynamic_matrix_client` SET `rate`= ?,`baseFare`= ?,`start`= ?,`end`= ?,`waitCharge`= ?,`waitTime`= ? WHERE id = ?",
			[
				rateClientModal,
				baseFareClientModal,
				startClientModal,
				endClientModal,
				waitChargeClientModal,
				waitTimeClientModal,
				clientIdModal,
			]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/getRateDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `dynamic_matrix_driver` WHERE id = ?", [
			req.body.id,
		]);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/dynamicDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const {
			vehicleDriver,
			rateDriver,
			baseFareDriver,
			waitChargeDriver,
			waitTimeDriver,
			startDriver,
			endDriver,
			idClientDriver,
			cityDriver,
		} = req.body;
		if (parseInt(startDriver) >= parseInt(endDriver)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"INSERT INTO `dynamic_matrix_driver` (`vehicle_id`,`rate`,`baseFare`,`waitCharge`,`waitTime`,`start`, `end`, `clientId`, `city`) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `vehicle_id`=VALUES(`vehicle_id`),`city`=VALUES(`city`), `rate`=VALUES(`rate`), `baseFare`=VALUES(`baseFare`), `waitCharge`=VALUES(`waitCharge`), `waitTime`=VALUES(`waitTime`),`start`=VALUES(`start`),`end`=VALUES(`end`),`clientId`=VALUES(`clientId`)",
			[
				vehicleDriver,
				rateDriver,
				baseFareDriver,
				waitChargeDriver,
				waitTimeDriver,
				startDriver,
				endDriver,
				idClientDriver,
				cityDriver,
			]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/dynamicDriverUpdate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const {
			driverIdModal,
			rateDriverModal,
			baseFareDriverModal,
			waitChargeDriverModal,
			waitTimeDriverModal,
			startDriverModal,
			endDriverModal,
		} = req.body;
		if (parseFloat(startDriverModal) >= parseFloat(endDriverModal)) {
			return res.send({ code: 2 });
		}
		await pool.query(
			"UPDATE `dynamic_matrix_driver` SET `rate`= ?,`baseFare`= ?,`start`= ?,`end`= ?,`waitCharge`= ?,`waitTime`= ? WHERE id = ?",
			[
				rateDriverModal,
				baseFareDriverModal,
				startDriverModal,
				endDriverModal,
				waitChargeDriverModal,
				waitTimeDriverModal,
				driverIdModal,
			]
		);
		return res.send({ code: 1 });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.post("/getDriverRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT dynamic_matrix_driver.*,vehicle_type.type_name,cities.city FROM `dynamic_matrix_driver` INNER JOIN vehicle_type ON vehicle_type.v_type = vehicle_id INNER JOIN cities on cities.id = dynamic_matrix_driver.city WHERE clientId = ? AND dynamic_matrix_driver.city = ?",
			[req.body.client, req.body.city]
		);
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/rateVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT `v_type`, `type_name` FROM `vehicle_type` WHERE 1;SELECT id,city FROM cities WHERE 1"
		);
		return res.render("admin/rateVehicle", {
			vehicle: data[0],
			city: data[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/matrixVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT `start`, `end`, `price` FROM `rate_matrix_vehicle` WHERE `vehicle_id` = ?",
			[req.body.vehicle]
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateRateVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const rate = await pool.query(
			"SELECT `price`,`id` FROM `rate_matrix_vehicle` WHERE `start` = ? AND `end` = ? AND `vehicle_id` = ?",
			[req.body.start, req.body.end, req.body.vehicle]
		);
		if (rate.length) {
			await pool.query("UPDATE `rate_matrix_vehicle` SET `price` = ? WHERE id = ?", [
				req.body.rate,
				rate[0].id,
			]);
			return res.send({
				code: 1,
			});
		} else {
			await pool.query(
				"INSERT INTO `rate_matrix_vehicle`(`vehicle_id`, `start`, `end`, `price`) VALUES (?,?,?,?)",
				[req.body.vehicle, req.body.start, req.body.end, req.body.rate]
			);
			return res.send({
				code: 1,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/amount", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const v_type = await pool.query("SELECT v_type FROM vehicle_type WHERE type_name = ?", [
			req.body.vType,
		]);
		const vType = v_type[0].v_type;
		const price = await pool.query(
			"SELECT `price`,`driverAmount` FROM `rate_matrix` WHERE `start` = ? AND `end` = ? AND `client_id` = ? AND `vehicle_id` = ?",
			[req.body.sCity, req.body.dCity, req.body.client, vType]
		);
		if (price.length) {
			res.send({
				result: price,
				code: 1,
			});
		} else {
			res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/autoDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM driver_tab WHERE Did = ?", [req.body.Did]);
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

router.post("/updateDriver", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const driverDetails = await pool.query("SELECT Did FROM driver_tab WHERE phn = ?", [
					fields.uphn,
				]);
				if (driverDetails.length) {
					if (driverDetails[0].Did != fields.driver) {
						req.flash("error_msg", "Driver With This Phone Number is already added");
						return res.redirect("/admin/addDriver");
					} else {
						if (files.uprof_pic.size > 0) {
							let oldpath = files.uprof_pic.path;
							let newpath = `./public/images/profile/${fields.uphn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let prof = `${fields.uphn}.jpg`;
							await pool.query(
								"UPDATE `driver_tab` SET `prof_pic`= ? WHERE Did = ?",
								[prof, fields.driver]
							);
						}
						if (files.udl_pic_back.size > 0) {
							let oldpath = files.udl_pic_back.path;
							let newpath = `./public/images/dl_pic_back/${fields.uphn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let dlb = `${fields.uphn}.jpg`;
							await pool.query(
								"UPDATE `driver_tab` SET `dl_pic_back`= ? WHERE Did = ?",
								[dlb, fields.driver]
							);
						}
						if (files.udl_pic_front.size > 0) {
							let oldpath = files.udl_pic_front.path;
							let newpath = `./public/images/dl_pic_front/${fields.uphn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let dlf = `${fields.uphn}.jpg`;
							await pool.query(
								"UPDATE `driver_tab` SET `dl_pic_front`= ? WHERE Did = ?",
								[dlf, fields.driver]
							);
						}
						if (files.uaadhar_front_pic.size > 0) {
							let oldpath = files.uaadhar_front_pic.path;
							let newpath = `./public/images/aadhar_front_pic/${fields.uphn}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let afp = `${fields.uphn}.jpg`;
							await pool.query(
								"UPDATE `driver_tab` SET `aadhar_front_pic`= ? WHERE Did = ?",
								[afp, fields.driver]
							);
						}
						await pool.query(
							"UPDATE `driver_tab` SET `d_name`= ?,`phn`= ?,`city`= ?,`state`= ?,`birthday`= ?,`tid`= ?,`bankAccd`= ?,`lice_exp`= ? WHERE Did = ?",
							[
								fields.uname,
								fields.uphn,
								fields.ucity,
								fields.ustate,
								fields.ubirthday,
								fields.utrans,
								fields.ubankAcc,
								fields.ulice_exp,
								fields.driver,
							]
						);
						req.flash("success_msg", "Driver Updated");
						return res.redirect("/admin/addDriver");
					}
				} else {
					if (files.uprof_pic.size > 0) {
						let oldpath = files.uprof_pic.path;
						let newpath = `./public/images/profile/${fields.uphn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					if (files.udl_pic_back.size > 0) {
						let oldpath = files.udl_pic_back.path;
						let newpath = `./public/images/dl_pic_back/${fields.uphn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					if (files.udl_pic_front.size > 0) {
						let oldpath = files.udl_pic_front.path;
						let newpath = `./public/images/dl_pic_front/${fields.uphn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					if (files.uaadhar_front_pic.size > 0) {
						let oldpath = files.uaadhar_front_pic.path;
						let newpath = `./public/images/aadhar_front_pic/${fields.uphn}.jpg`;
						fs.rename(oldpath, newpath, error => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
					const details = await pool.query("SELECT phn FROM driver_tab WHERE Did = ?", [
						fields.driver,
					]);
					const oldPhn = details[0].phn;
					let oldpatha = `./public/images/aadhar_front_pic/${oldPhn}.jpg`;
					let newpatha = `./public/images/aadhar_front_pic/${fields.uphn}.jpg`;
					fs.rename(oldpatha, newpatha, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					let oldpathdf = `./public/images/dl_pic_front/${oldPhn}.jpg`;
					let newpathdf = `./public/images/dl_pic_front/${fields.uphn}.jpg`;
					fs.rename(oldpathdf, newpathdf, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					let oldpathdb = `./public/images/dl_pic_back/${oldPhn}.jpg`;
					let newpathdb = `./public/images/dl_pic_back/${fields.uphn}.jpg`;
					fs.rename(oldpathdb, newpathdb, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					let oldpathp = `./public/images/profile/${oldPhn}.jpg`;
					let newpathp = `./public/images/profile/${fields.uphn}.jpg`;
					fs.rename(oldpathp, newpathp, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					const driver = {
						afp: `${fields.uphn}.jpg`,
					};
					await pool.query(
						"UPDATE `driver_tab` SET `d_name`= ?,`phn`= ?,`city`= ?,`state`= ?,`birthday`= ?,`tid`= ?,`bankAccd`= ?,`lice_exp`= ?,`aadhar_front_pic`= ?,`dl_pic_front`= ?,`dl_pic_back`= ?,`prof_pic`= ? WHERE Did = ?",
						[
							fields.uname,
							fields.uphn,
							fields.ucity,
							fields.ustate,
							fields.ubirthday,
							fields.utrans,
							fields.ubankAcc,
							fields.ulice_exp,
							driver.afp,
							driver.afp,
							driver.afp,
							driver.afp,
							fields.driver,
						]
					);
					req.flash("success_msg", "Driver Updated");
					return res.redirect("/admin/addDriver");
				}
			}
		});
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

router.get("/loadType", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const load = await pool.query("SELECT * FROM load_type");
		return res.render("admin/loadType", {
			load: load,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/search1", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const rows = await pool.query(
			'SELECT city from cities where city like "%' + req.query.key + '%"'
		);
		let data = [];
		for (let i = 0; i < rows.length; i++) {
			data.push(rows[i].city);
		}
		return res.send(JSON.stringify(data));
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/search2", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const load = await pool.query(
			'SELECT load_type FROM load_type WHERE load_type LIKE "%' + req.query.key + '%"'
		);
		let data = [];
		for (let i = 0; i < load.length; i++) {
			data.push(load[i].load_type);
		}
		res.send(JSON.stringify(data));
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addLoadType", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		await pool.query("INSERT INTO `load_type`(`load_type`) VALUES (?)", [req.body.loadType]);
		req.flash("success_msg", "Load Type Added");
		return res.redirect("/admin/loadType");
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

router.post("/driverList", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.Did,driver_tab.d_name,driver_tab.phn,driver_tab.state,trans_tab.name,trans_tab.mob,vehicle_table.v_type,cities.city AS sahar FROM driver_tab INNER JOIN cities ON driver_tab.city = cities.id INNER JOIN trans_tab ON driver_tab.tid = trans_tab.id INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON main_map.vehicle_id = vehicle_table.v_id INNER JOIN load_post ON load_post.vehicle_type = vehicle_table.v_type WHERE driver_tab.city = ? AND driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND main_map.d_av = 0 AND main_map.t_av = 0 AND load_post.load_id = ?",
			[req.body.city, req.body.load]
		);
		res.send({
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/noInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("YYYY-MM-DD");
		const result = await pool.query(
			`SELECT COUNT(*) AS noClient FROM users WHERE 1;SELECT COUNT(*) AS noTrip FROM trip WHERE trip.status = 2;SELECT SUM(trip.distance) AS noKm FROM trip;SELECT COUNT(*) AS noVeh FROM vehicle_table;SELECT COUNT(driver_tab.Did) AS noDriverOn FROM driver_tab INNER JOIN main_map ON main_map.Did = driver_tab.Did AND main_map.d_av = 0 AND main_map.t_av = 0;SELECT COUNT(DISTINCT(driver_tab.Did)) AS noDriverOff FROM driver_tab INNER JOIN main_map ON main_map.Did = driver_tab.Did WHERE main_map.d_av = 1 OR main_map.t_av = 1 AND driver_tab.u_flag = 1 AND driver_tab.verif_flag = 1;SELECT COUNT(load_post.load_id) AS noLoad FROM load_post;SELECT SUM((load_post.amount)*10/100) AS profit FROM load_post;SELECT COUNT(*) AS noTrans FROM trans_tab WHERE 1;SELECT SUM((load_post.amount)) AS income FROM load_post;SELECT COUNT(*) AS late FROM trip WHERE late_time>0;SELECT COUNT(*) AS noClientAdd FROM users WHERE created LIKE '${date}%';SELECT SUM(trip.distance) AS noKmAdd FROM trip WHERE created LIKE "${date}%";SELECT COUNT(*) AS noVehAdd FROM vehicle_table WHERE add_date LIKE "${date}%";SELECT COUNT(*) AS noTransAdd FROM trans_tab WHERE doj LIKE "${date}%";SELECT COUNT(*) AS lateAdd FROM trip WHERE created LIKE "${date}%" AND late_time > 0`
		);
		return res.send({
			code: 1,
			noClient: result[0],
			noTrip: result[1],
			noKm: result[2],
			noVeh: result[3],
			noDriverOn: result[4],
			noDriverOff: result[5],
			noLoad: result[6],
			profit: result[7],
			noTrans: result[8],
			income: result[9],
			late: result[10],
			noClientAdd: result[11],
			noKmAdd: result[12],
			noVehAdd: result[13],
			noTransAdd: result[14],
			lateAdd: result[15],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/kmWise", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { date } = req.body;
		const result = await pool.query(
			`SELECT trip.distance,load_post.vehicle_type,users.name,c1.city AS 'source',load_post.load_id,c2.city AS 'destination' FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN users ON users.id = trip.client_id LEFT JOIN cities c1 ON c1.id = load_post.city LEFT JOIN cities c2 ON c2.id = load_post.dest_city WHERE trip.status = 2 AND trip.created LIKE "${date}%" ORDER BY trip.created`
		);
		return res.send({
			code: 1,
			data: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/driverInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.*,trans_tab.*,main_map.*,vehicle_table.*,cities.city AS sahar FROM driver_tab INNER JOIN cities ON driver_tab.city = cities.id INNER JOIN trans_tab ON driver_tab.tid = trans_tab.id INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON main_map.vehicle_id = vehicle_table.v_id WHERE driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND main_map.d_av = 0 AND main_map.t_av = 0"
		);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/tripDens", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT COUNT(trip.trip_id) AS count,cities.city AS city FROM trip INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id INNER JOIN cities ON cities.id = load_post.city GROUP BY load_post.city"
		);
		if (result.length > 0) {
			return res.send({
				code: 1,
				result,
			});
		} else {
			return res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/markerInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.d_name,driver_tab.phn,trans_tab.name,trans_tab.mob,trans_tab.state,vehicle_table.v_type,cities.city AS city FROM driver_tab INNER JOIN trans_tab ON trans_tab.id = driver_tab.tid INNER JOIN cities ON cities.id = trans_tab.city INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.Did = ?",
			[req.body.Did]
		);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/InOut", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT COUNT(trip.trip_id) AS count FROM trip INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE load_post.city = (SELECT cities.id FROM cities WHERE cities.city = ?);SELECT COUNT(trip.trip_id) AS count FROM trip INNER JOIN load_post ON load_post.load_id = (SELECT confirmed_load.load_id FROM confirmed_load WHERE confirmed_load.c_load_id = trip.c_load_id) WHERE load_post.dest_city = (SELECT cities.id FROM cities WHERE cities.city = ?)",
			[req.body.city, req.body.city]
		);
		return res.send({
			code: 1,
			in: result[0],
			out: result[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/month", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const year = moment().format("YYYY");
		const result = await pool.query(
			`SELECT tot,SUBSTR(date,1,2) AS day FROM total_load WHERE date LIKE '__/${req.body.month}/${year}'`
		);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/year", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT SUM(tot) AS tot,SUBSTR(date,4,2) AS month FROM total_load WHERE date LIKE '__/__/${req.body.year}' GROUP BY month`
		);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/vehicleReq", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT no_vehicle AS noVehicle FROM `load_post` WHERE load_id = ?",
			[req.body.load_id]
		);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/cityChart", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT COUNT(load_post.load_id) AS pending FROM `load_post` WHERE load_post.city = ? AND load_post.status = 0;SELECT COUNT(load_post.load_id) AS ongoing FROM `load_post` WHERE load_post.city = ? AND load_post.status = 1;SELECT COUNT(load_post.load_id) AS completed FROM `load_post` WHERE load_post.city = ? AND load_post.status = 2",
			[req.body.city, req.body.city, req.body.city]
		);
		res.send({
			pending: result[0],
			ongoing: result[1],
			completed: result[2],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/lateList", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT trip.*,load_post.city,load_post.dest_city,driver_tab.d_name,vehicle_table.v_num,users.name,cities.city AS `source` FROM `trip` INNER JOIN users ON users.id = trip.client_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id LEFT JOIN cities ON cities.id = load_post.city INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.late_time>0 AND trip.status = 2 ORDER BY trip.trip_id DESC"
		);
		return res.send(result);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/client", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT users.*,cities.city AS sahar FROM `users` INNER JOIN cities ON cities.id = users.city WHERE flag = 0;SELECT state FROM state_list"
		);
		res.render("admin/client", {
			users: result[0],
			state: result[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/autoClient", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM users WHERE id = ?", [req.body.user]);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateClient", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const user = {
					id: fields.user,
					name: fields.uname,
					city: fields.ucity,
					state: fields.ustate,
					address: fields.uadd,
					mob: fields.umob,
					email: fields.uemail,
					password: fields.upassword,
					flag: 0,
					designation: fields.udesignation,
					employee_id: fields.uemployee_id,
					surge_charge: fields.usurge_charge,
					confirmed: 2,
					gst: fields.ugst,
					profilePic: `${fields.uemail}.jpg`,
					managerFlag: fields.manager,
					rateType: fields.rateMatrix,
					waitFlag: fields.waitFlag,
				};
				const initDetails = await pool.query("SELECT * FROM `users` WHERE id = ?", [
					fields.user,
				]);
				const checkDetails = await pool.query("SELECT * FROM `users` WHERE email = ?", [
					fields.uemail,
				]);
				if (!checkDetails.length || initDetails[0].email === fields.uemail) {
					const clientDetail = await pool.query(
						"SELECT id,mob,email,managerFlag,sub FROM `users` WHERE mob = ? OR email = ?",
						[fields.umob, fields.uemail]
					);
					if (clientDetail[0].managerFlag != fields.manager) {
						const check = await pool.query(
							"SELECT id,name,email,managerFlag,sub FROM `users` WHERE managerFlag = 1"
						);
						for (let i = 0; i < check.length; i++) {
							if (check[i].sub) {
								let subBranch = check[i].sub.split("~+~");
								if (subBranch.length > 0 && subBranch[0]) {
									if (subBranch.indexOf(fields.user) > -1) {
										req.flash(
											"error_msg",
											"Client already exists as a sub Branch of a client"
										);
										return res.redirect("/admin/client");
									}
								}
							}
						}
					}
					if (files.uprofilePic) {
						if (files.uprofilePic.size > 0) {
							let oldpath = files.uprofilePic.path;
							let newpath = `./public/images/userProf/${fields.uemail}.jpg`;
							fs.rename(oldpath, newpath, err => {
								if (err) {
									console.log(err);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					}

					if (fields.upassword === "") {
						await pool.query(
							"UPDATE `users` SET `name`= ?,`city`= ?,`state`= ?,`address`= ?,`mob`= ?,`email`= ?,`designation`= ?,`employee_id`= ?,`surge_charge`= ?,`gst`= ?,`profile` = ?,`managerFlag` = ?,`rateType` = ?,`waitFlag` = ? WHERE id = ?",
							[
								user.name,
								user.city,
								user.state,
								user.address,
								user.mob,
								user.email,
								user.designation,
								user.employee_id,
								user.surge_charge,
								user.gst,
								user.profilePic,
								user.managerFlag,
								user.rateType,
								user.waitFlag,
								user.id,
							]
						);
					} else {
						const salt = await bcrypt.genSalt(10);
						const password = await bcrypt.hash(fields.upassword, salt);

						await pool.query(
							"UPDATE `users` SET `name`= ?,`city`= ?,`state`= ?,`address`= ?,`mob`= ?,`email`= ?,`designation`= ?,`employee_id`= ?,`surge_charge`= ?,`password`= ?,`gst`= ?,`profile` = ?,`managerFlag` = ?,`rateType` = ?,`waitFlag` = ? WHERE id = ?",
							[
								user.name,
								user.city,
								user.state,
								user.address,
								user.mob,
								user.email,
								user.designation,
								user.employee_id,
								user.surge_charge,
								password,
								user.gst,
								user.profilePic,
								user.managerFlag,
								user.rateType,
								user.waitFlag,
								user.id,
							]
						);
					}
					req.flash("success_msg", "Client Updated");
					return res.redirect("/admin/client");
				} else {
					req.flash("error_msg", "Anothor client already exists with this email");
					return res.redirect("/admin/client");
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/DidInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.d_name,driver_tab.phn,vehicle_table.v_num FROM `driver_tab` INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id WHERE driver_tab.Did = ?",
			[req.body.Did]
		);
		if (result.length > 0) {
			res.send({
				result,
				code: 1,
			});
		} else {
			res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/fetchMapped", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT main_map.Did, main_map.gps_val,driver_tab.d_name,driver_tab.phn FROM `main_map` INNER JOIN driver_tab ON driver_tab.Did = main_map.Did"
		);
		if (result.length > 0) {
			return res.send({
				code: 1,
				result,
			});
		} else {
			return res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/fav", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT `id`, `name`, `state`, `mob`, `email`, `employee_id` FROM `users`"
		);
		res.render("admin/fav", {
			user: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/favlist/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT fav.*,vehicle_table.v_num,vehicle_table.pic_rc_front,vehicle_table.pic_rc_back,vehicle_table.pic_v,vehicle_table.permit_pic,vehicle_table.permit_type FROM fav INNER JOIN vehicle_table ON vehicle_table.v_id  = fav.v_id WHERE fav.c_id = ?",
			[req.params.id]
		);
		req.session.c_id = req.params.id;
		res.render("admin/favlist", {
			list: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addFavs", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const vehicle = await pool.query("SELECT `v_id` FROM `vehicle_table` WHERE `v_num` = ?", [
			req.body.v_num,
		]);
		const v_id = vehicle[0].v_id;
		const fav = await pool.query("SELECT * FROM fav WHERE v_id = ?", [v_id]);
		if (fav.length > 0) {
			req.flash("error_msg", "This vehicle is already added as favourite by a Client.");
		} else {
			await pool.query("INSERT INTO `fav`(`v_id`, `c_id`) VALUES (?,?)", [
				v_id,
				req.session.c_id,
			]);
			req.flash("success_msg", "Added As Favourite");
		}
		return res.redirect(`/admin/favlist/${req.session.c_id}`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/searchV_num", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const rows = await pool.query(
			'SELECT v_num FROM vehicle_table WHERE v_num LIKE "%' + req.query.key + '%"'
		);
		let data = [];
		for (let i = 0; i < rows.length; i++) {
			data.push(rows[i].v_num);
		}
		res.send(JSON.stringify(data));
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addCityRate", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const ciites = await pool.query("SELECT city FROM cities WHERE city = ?", [req.body.city]);
		if (ciites.length) {
			req.flash("error_msg", "City already registered");
		} else {
			const city = {
				city: req.body.city,
				state: req.body.state,
			};
			await pool.query("INSERT INTO cities (state,city) VALUES (?,?)", [
				city.state,
				city.city,
			]);
			req.flash("success_msg", "City Added");
		}
		return res.redirect(`/admin/rateClient`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/autoTrans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM `trans_tab` WHERE id = ?", [req.body.tid]);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateTrans", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const transDetails = await pool.query("SELECT id FROM `trans_tab` WHERE mob = ?", [
					fields.umob,
				]);
				if (transDetails.length) {
					if (transDetails[0].id !== fields.trans) {
						req.flash(
							"error_msg",
							"Transporter with this Phone Number is already added"
						);
						return res.redirect("/admin/addTrans");
					} else {
						if (files.uaadhar_trans_pic.size > 0) {
							let oldpath = files.uaadhar_trans_pic.path;
							let newpath = `./public/images/aadhar_trans/${fields.umob}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let aadhar = `${fields.umob}.jpg`;
							await pool.query(
								"UPDATE `trans_tab` SET `aadhar_trans_pic`= ? WHERE id = ?",
								[aadhar, fields.trans]
							);
						}
						if (files.uaadhar_trans_back.size > 0) {
							let oldpath = files.uaadhar_trans_back.path;
							let newpath = `./public/images/aadhar_trans/${fields.umob}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							let aadhar = `${fields.umob}.jpg`;
							await pool.query(
								"UPDATE `trans_tab` SET `aadhar_trans_back`= ? WHERE id = ?",
								[aadhar, fields.trans]
							);
						}
						if (files.uprof_trans_pic.size > 0) {
							let oldpath = files.uprof_trans_pic.path;
							let newpath = `./public/images/prof_trans/${fields.umob}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
							const prof = `${fields.umob}.jpg`;
							await pool.query(
								"UPDATE `trans_tab` SET `prof_trans_pic`= ? WHERE id = ?",
								[prof, fields.trans]
							);
						}
						await pool.query(
							"UPDATE `trans_tab` SET `name`= ?,`city`= ?,`mob`= ?,`state`= ?,`fleet_size`= ?,`bankAcc`= ?,`email`= ?,`acc_name`= ?,`ifsc`= ? WHERE id = ?",
							[
								fields.uusername,
								fields.ucity,
								fields.umob,
								fields.ustate,
								fields.ufleet,
								fields.ubankAcc,
								fields.uemail,
								fields.uacc_name,
								fields.uifsc,
								fields.trans,
							]
						);
						req.flash("success_msg", "Transporter Updated");
						return res.redirect("/admin/addTrans");
					}
				} else {
					if (files.uaadhar_trans_pic)
						if (files.uaadhar_trans_pic.size > 0) {
							let oldpath = files.uaadhar_trans_pic.path;
							let newpath = `./public/images/aadhar_trans/${fields.umob}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					if (files.uprof_trans_pic)
						if (files.uprof_trans_pic.size > 0) {
							let oldpath = files.prof_trans_pic.path;
							let newpath = `./public/images/prof_trans/${fields.umob}.jpg`;
							fs.rename(oldpath, newpath, error => {
								if (error) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					const mob = await pool.query("SELECT mob FROM `trans_tab` WHERE id = ?", [
						fields.trans,
					]);
					const oldPhn = mob[0].mob;
					let oldpatha = `./public/images/aadhar_trans/${oldPhn}.jpg`;
					let newpatha = `./public/images/aadhar_trans/${fields.umob}.jpg`;
					fs.rename(oldpatha, newpatha, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					let oldpathdf = `./public/images/prof_trans/${oldPhn}.jpg`;
					let newpathdf = `./public/images/prof_trans/${fields.umob}.jpg`;
					fs.rename(oldpathdf, newpathdf, error => {
						if (error) {
							console.error(error);
							dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
							return res.redirect("/400");
						}
						console.log("Success");
					});
					const trans = {
						afp: `${fields.umob}.jpg`,
					};
					await pool.query(
						"UPDATE `trans_tab` SET `name`= ?,`city`= ?,`mob`= ?,`state`= ?,`fleet_size`= ?,`bankAcc`= ?,`email`= ?,`acc_name`= ?,`ifsc`= ?,`aadhar_trans_pic`= ?,`prof_trans_pic`= ? WHERE id = ?",
						[
							fields.uusername,
							fields.ucity,
							fields.umob,
							fields.ustate,
							fields.ufleet,
							fields.ubankAcc,
							fields.uemail,
							fields.uacc_name,
							fields.uifsc,
							trans.afp,
							trans.afp,
							fields.trans,
						]
					);
					req.flash("success_msg", "Driver Updated");
					return res.redirect("/admin/addDriver");
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/placementLink", ensureAuthenticatedAdmin(), async (req, res) => {
	dbFire
		.ref(`/loads_test/${req.body.id}`)
		.remove()
		.then(function () {
			console.log("Remove succeeded.");
			return res.send({
				code: 1,
			});
		})
		.catch(function (error) {
			console.log("Remove failed: " + error.message);
			return res.send({
				code: 0,
			});
		});
});

router.get("/getVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT vehicle_table.*,driver_tab.d_name,driver_tab.phn,trans_tab.name,trans_tab.mob FROM `vehicle_table` LEFT JOIN main_map ON main_map.vehicle_id = vehicle_table.v_id LEFT JOIN driver_tab ON driver_tab.Did = main_map.Did INNER JOIN trans_tab ON trans_tab.id = vehicle_table.t_id"
		);
		return res.render("admin/showVehicle", {
			vehicle: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/tripInfo", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			'SELECT trip.*,driver_tab.d_name,driver_tab.phn,vehicle_table.v_type,vehicle_table.v_num,users.name AS "user",trans_tab.name,trans_tab.mob FROM `trip` INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN users ON users.id = trip.client_id INNER JOIN trans_tab ON trip.t_id = trans_tab.id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE status = 2'
		);
		if (result.length > 0) {
			res.send({
				result,
				code: 1,
			});
		} else {
			res.send({
				code: 0,
			});
		}
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/allTrip", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT load_post.*,users.name,pending_load.count,cities.city AS sahar FROM load_post INNER JOIN users on load_post.fromc = users.id INNER JOIN cities ON load_post.city = cities.id LEFT JOIN pending_load ON load_post.load_id = pending_load.load_id ORDER BY STR_TO_DATE(load_post.timef,'%d/%m/%Y') DESC`
		);
		res.render("admin/allTrip", {
			load: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/cancelLoad", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		await pool.query(
			"UPDATE `load_post` SET `cancelFlag`= 1,`cancelReason`= ? WHERE load_id = ?",
			[req.body.reason, req.body.load]
		);
		dbFire
			.ref(`/loads_test/${req.body.load}`)
			.remove()
			.then(function () {
				console.log("Remove succeeded.");
				return res.send({
					code: 1,
				});
			})
			.catch(function (error) {
				console.log("Remove failed: " + error.message);
				return res.send({
					code: 0,
				});
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/autoVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM `vehicle_table` WHERE v_id = ?", [
			req.body.vId,
		]);
		return res.send({
			code: 1,
			result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/invoice", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT load_post.*,trip.trip_id,driver_tab.d_name,driver_tab.Did,vehicle_table.v_num,users.name FROM load_post INNER JOIN confirmed_load ON confirmed_load.load_id = load_post.load_id INNER JOIN trip ON trip.c_load_id = confirmed_load.c_load_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN users ON users.id = load_post.fromc WHERE trip.invoiceStatus = 1 ORDER BY load_post.created DESC"
		);
		res.render("admin/invoiceList", {
			invoice: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/invoiceEdit/:loadId/:tripId", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { loadId, tripId } = req.params;

		const result = await pool.query(
			"SELECT users.name,users.address,users.email,users.gst,users.mob,trip.trip_id,vehicle_table.v_num FROM trip INNER JOIN users ON users.id = trip.client_id INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id WHERE trip.trip_id = ?;SELECT * FROM `load_post` WHERE load_id = ?",
			[tripId, loadId]
		);
		res.render("admin/invoiceEdit", {
			client: result[0],
			load: result[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/createInvoice", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		let invoice = {
			...req.body,
		};
		const date_ver = new Date();
		const date = moment.utc(date_ver).utcOffset("+05:30").format("DDMMYYYY");
		invoice.invoiceDate = date;
		ejs.renderFile(
			path.join(__dirname, "../views/invoice", "invoice.ejs"),
			{ invoice: invoice },
			(error, data) => {
				if (error) {
					console.error(error);
					dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
					res.send(error);
				} else {
					let options = {
						height: "20.75in",
						width: "20.5in",
						base: "file:///var/exp_road/roadexp_new/public/img/",
					};
					pdf.create(data, options).toFile(
						path.join(__dirname, "../public/invoice", `${invoice.loadId}.pdf`),
						async (error, data) => {
							if (error) {
								console.error(error);
								dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
								res.send(error);
							} else {
								await pool.query(
									"UPDATE `trip` SET `invoiceStatus`= 2,`invoice`= ? WHERE trip_id = ?",
									[`${invoice.loadId}.pdf`, invoice.tripId]
								);
								req.flash("success_msg", "Invoice Created");
								res.redirect("/admin/invoice");
							}
						}
					);
				}
			}
		);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/addSub/:userId", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { userId } = req.params;
		const result = await pool.query(
			"SELECT id,state from state_list;SELECT * FROM `users` WHERE id = ?",
			[userId]
		);
		res.render("admin/addSub", {
			state: result[0],
			client: result[1],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addSub", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				const userDetails = await pool.query("SELECT email FROM users WHERE email = ?", [
					fields.email,
				]);
				if (userDetails.length) {
					req.flash("error_msg", "Client is already registered!!");
					res.redirect("/admin/client");
				} else {
					const rcId = await pool.query("SELECT COUNT(id)+1 AS noUser FROM users");
					let oldpath, newpath;
					if (files.profilePic) {
						if (files.profilePic.size > 0) {
							oldpath = files.profilePic.path;
							newpath = `./public/images/userProf/${fields.email}.jpg`;
							fs.rename(oldpath, newpath, err => {
								if (err) {
									console.error(error);
									dashLogger.error(
										`Error : ${error},Request : ${req.originalUrl}`
									);
									return res.redirect("/400");
								}
								console.log("Success");
							});
						}
					}
					const user = {
						id: `rc_${rcId[0].noUser}`,
						name: fields.name,
						city: fields.city,
						state: fields.state,
						address: fields.address,
						mob: fields.mob,
						email: fields.email,
						password: fields.password,
						flag: 0,
						designation: fields.desig,
						employee_id: fields.emp_id,
						surge_charge: fields.surge_charge,
						confirmed: 2,
						gst: fields.gst,
						profilePic: `${fields.email}.jpg`,
						clientId: fields.clientId,
					};

					const salt = await bcrypt.genSalt(10);
					const password = await bcrypt.hash(fields.password, salt);
					await pool.query(
						"INSERT INTO `users`(`id`, `name`, `city`, `state`, `address`, `mob`, `email`, `password`, `flag`,`designation`,`employee_id`,`confirmed`,`surge_charge`,`gst`, `profile`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
						[
							user.id,
							user.name,
							user.city,
							user.state,
							user.address,
							user.mob,
							user.email,
							password,
							user.flag,
							user.designation,
							user.employee_id,
							user.confirmed,
							user.surge_charge,
							user.gst,
							user.profilePic,
						]
					);
					const details = await pool.query("SELECT * FROM `users` WHERE id = ?", [
						user.clientId,
					]);

					let sub;

					if (details[0].sub) {
						sub = `${details[0].sub}~+~${user.id}`;
					} else {
						sub = `${user.id}`;
					}
					await pool.query("UPDATE `users` SET `sub`= ? WHERE id = ?", [
						sub,
						user.clientId,
					]);
					req.flash("success_msg", "Client Added!!");
					res.redirect("/admin/client");
				}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/offline", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driverOffline.*,driver_tab.d_name,driver_tab.phn FROM `driverOffline` INNER JOIN driver_tab ON driver_tab.Did = driverOffline.driver WHERE marked = 'No'"
		);
		return res.send({ code: 1, data: result });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/dummy", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT * FROM `load_post` WHERE cancelFlag = 3;SELECT driver_tab.Did,driver_tab.d_name,driver_tab.phn,driver_tab.state,trans_tab.name,trans_tab.mob,vehicle_table.v_type AS sahar FROM driver_tab INNER JOIN trans_tab ON driver_tab.tid = trans_tab.id INNER JOIN main_map ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON main_map.vehicle_id = vehicle_table.v_id WHERE driver_tab.Did NOT IN (SELECT Did FROM trip WHERE status = 1) AND main_map.d_av = 0 AND main_map.t_av = 0"
		);
		res.render("admin/dummy", {
			driver: result[1],
			load: result[0],
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/updateVehicle", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				if (files.upic_v)
					if (files.upic_v.size > 0) {
						let oldpath = files.upic_v.path;
						let newpath = `./public/images/vehicle/${fields.v_num}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				if (files.upic_rc_front)
					if (files.upic_rc_front.size > 0) {
						let oldpath = files.upic_rc_front.path;
						let newpath = `./public/images/rc_front/${fields.v_num}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				if (files.upic_rc_back)
					if (files.upic_rc_back.size > 0) {
						let oldpath = files.upic_rc_back.path;
						let newpath = `./public/images/rc_back/${fields.v_num}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				if (files.uinsurance_pic)
					if (files.uinsurance_pic.size > 0) {
						let oldpath = files.uinsurance_pic.path;
						let newpath = `./public/images/insurance_pic/${fields.v_num}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				if (files.upermit_pic)
					if (files.upermit_pic.size > 0) {
						let oldpath = files.upermit_pic.path;
						let newpath = `./public/images/permit_pic/${fields.v_num}.jpg`;
						fs.rename(oldpath, newpath, err => {
							if (err) {
								console.log(err);
								return res.redirect("/400");
							}
							console.log("Success");
						});
					}
				const vehicle = {
					afp: `${fields.v_num}.jpg`,
				};
				await pool.query(
					"UPDATE `vehicle_table` SET `v_type`= ?,`pic_rc_front`= ?,`pic_rc_back`= ?,`pic_v`= ?,`insurance_num`= ?,`permit_type`= ?,`rc_exp`= ?,`insurance_pic`= ?,`permit_pic`= ? WHERE v_num = ? AND v_id = ?",
					[
						fields.utype,
						vehicle.afp,
						vehicle.afp,
						vehicle.afp,
						fields.uinsurance_num,
						fields.upermit,
						fields.urc_exp,
						vehicle.afp,
						vehicle.afp,
						fields.v_num,
						fields.vehicle,
					]
				);
				req.flash("success_msg", "Vehicle Updated");
				res.redirect("/admin/vehicles");
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/vehicleIn", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		return res.render("admin/vehicleIn");
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/vehicleIn", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const form = new formidable.IncomingForm();
		form.keepExtensions = true;
		form.multiples = true;
		form.parse(req, async (error, fields, files) => {
			if (error) {
				console.error(error);
				dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
				return res.redirect("/400");
			} else {
				if (files.csv)
					if (files.csv.size > 0) {
						let oldpath = files.csv.path;
						let stream = fs.createReadStream(`${oldpath}`);
						let csvData = [];
						let csvStream = fastcsv
							.parse()
							.on("data", async data => {
								csvData.push(data);
							})
							.on("end", async () => {
								return res.render("admin/vehicleList", {
									csv: csvData,
								});
							});
						stream.pipe(csvStream);
					}
			}
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/vehicleIn/:vId", async (req, res) => {
	try {
		axios
			.get(`http://shrouded-falls-48764.herokuapp.com/vehicle-info/${req.params.vId}`, {
				headers: {
					"Content-Type": "application/json",
					"API-KEY": "e7f2eb4b1d5a41be97d5b1ebe1125cad",
				},
			})
			.then(async response => {
				// your action after success
				return res.send({ data: response.data });
			})
			.catch(function (error) {
				// your action on error success
				console.log(error);
				return res.send({ data: response.data });
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/subscription", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { client } = req.query;

		const data = await pool.query(
			"SELECT subscription.*,users.name AS 'user',vehicle_table.v_num,trans_tab.name FROM `subscription` INNER JOIN users ON users.id = subscription.clientId INNER JOIN vehicle_table ON vehicle_table.v_id = subscription.vehicleId INNER JOIN trans_tab ON trans_tab.id = subscription.tId ORDER BY subscription.created DESC;SELECT * FROM `users` ORDER BY name"
		);
		return res.render("admin/subscription", {
			subscriptions: data[0],
			client: data[1],
			select: client,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/vehicleList", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		// const rows = await pool.query('SELECT v_num FROM vehicle_table WHERE v_num LIKE "%' + req.query.key + '%" AND v_id NOT IN (SELECT vehicle_id FROM trip WHERE status != 2)');

		let data = [];

		const total = await pool.query(
			"SELECT COUNT(v_num) FROM vehicle_table WHERE v_id NOT IN (SELECT vehicle_id FROM trip WHERE status != 2) AND verif_flag = 1"
		);

		const { page, search } = req.body;

		if (search) {
			data = await pool.query(
				"SELECT v_id AS 'id',v_num AS 'text' FROM vehicle_table WHERE v_num LIKE ? AND v_id NOT IN (SELECT vehicle_id FROM trip WHERE status != 2) AND verif_flag = 1 ORDER BY v_num LIMIT 10 OFFSET ?",
				[`%${search}%`, page === "1" ? 0 : page * 10]
			);
		} else {
			data = await pool.query(
				"SELECT v_id AS 'id',v_num AS 'text' FROM vehicle_table WHERE v_id NOT IN (SELECT vehicle_id FROM trip WHERE status != 2) AND verif_flag = 1 ORDER BY v_num LIMIT 10 OFFSET ?",
				[page === "1" ? 0 : page * 10]
			);
		}

		console.log(req.body);

		return res.send({ code: 1, data: data, total: total[0].total });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
	}
});

router.post("/subscription", ensureAuthenticatedAdmin(), async (req, res) => {
	const { client, vehicle, date, km, amount, rate } = req.body;
	try {
		if (typeof vehicle === "string") {
			const [vehicleInfo] = await pool.query("SELECT * FROM vehicle_table WHERE v_id = ?", [
				vehicle,
			]);
			await pool.query(
				"INSERT INTO `subscription`(`clientId`, `tId`, `vehicleId`, `fromDate`, `toDate`, `km`, `amount`, `rate`) VALUES (?,?,?,?,?,?,?,?)",
				[
					client,
					vehicleInfo.t_id,
					vehicleInfo.v_id,
					date.split(" ")[0],
					date.split(" ")[2],
					km,
					amount,
					rate,
				]
			);
		} else {
			for (let i = 0; i < vehicle.length; i++) {
				const [vehicleInfo] = await pool.query(
					"SELECT * FROM vehicle_table WHERE v_id = ?",
					[vehicle[i]]
				);
				await pool.query(
					"INSERT INTO `subscription`(`clientId`, `tId`, `vehicleId`, `fromDate`, `toDate`, `km`, `amount`, `rate`) VALUES (?,?,?,?,?,?,?,?)",
					[
						client,
						vehicleInfo.t_id,
						vehicleInfo.v_id,
						date.split(" ")[0],
						date.split(" ")[2],
						km,
						amount,
						rate,
					]
				);
			}
		}

		req.flash("success_msg", "Subscription added!");
		return res.redirect(`/admin/subscription/?client=${client}`);
	} catch (error) {
		if (error.code === "ER_DUP_ENTRY") {
			req.flash(
				"error",
				"Subscription already added for the given period for the client and vehicle"
			);
			return res.redirect(`/admin/subscription/?client=${client}`);
		} else {
			console.error(error);
			dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
			return res.render("/400");
		}
	}
});

router.post("/subDetails", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { id } = req.body;
		const sub = await pool.query("SELECT * FROM `subscription` WHERE id = ?", [id]);
		return res.send({ code: 1, data: sub });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("/400");
	}
});

router.post("/updateSub", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { updateDate, updateKm, updateRate, updateAmount, id, clientId } = req.body;

		await pool.query(
			"UPDATE `subscription` SET `fromDate`= ?,`toDate`= ?,`km`= ?,`rate`= ?,`amount`= ? WHERE id = ?",
			[
				updateDate.split(" ")[0],
				updateDate.split(" ")[2],
				updateKm,
				updateRate,
				updateAmount,
				id,
			]
		);
		req.flash("success_msg", "Updated");
		return res.redirect(`/admin/subscription?client=${clientId}#view`);
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.render("/400");
	}
});

router.get("/driverInfo/:Did", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT driver_tab.*,cities.city AS sahar FROM `driver_tab` INNER JOIN cities ON cities.id = driver_tab.city WHERE Did = ?",
			[req.params.Did]
		);
		res.render("admin/driverInfo", {
			driver: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/gps", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `gps`");
		res.render("admin/gps", {
			gps: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/addGps", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { serviceId, name } = req.body;
		await pool.query(
			"INSERT INTO gps (serviceId,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name = VALUES(name)",
			[serviceId, name]
		);
		const data = {
			name: name,
			uniqueId: serviceId,
			disabled: false,
		};
		axios
			.post(`https://tracer.roadexpress.in/api/devices`, data, {
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Basic ${base64Id}`,
				},
			})
			.then(async response => {
				// your action after success
				console.log(response.data);

				await pool.query("UPDATE gps SET deviceId = ? WHERE serviceId = ?", [
					response.data.id,
					serviceId,
				]);

				req.flash("success", "Successfully added");
				return res.redirect("/admin/gps");
			})
			.catch(function (error) {
				// your action on error success
				console.log(error);
				req.flash("error", "Error");
				return res.redirect("/admin/gps");
			});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/monthly", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query("SELECT * FROM `gps`");
		res.render("admin/monthly/monthly", {
			gps: data,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/monthly/:id", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const data = await pool.query(
			"SELECT * FROM `gps` INNER JOIN main_map ON main_map.gpsId = gps.serviceId INNER JOIN driver_tab ON driver_tab.Did = main_map.Did WHERE gps.id = ?",
			[req.params.id]
		);

		let temp = [];

		if (data.length) {
			temp = data;
		} else {
			temp = await pool.query("SELECT * FROM `gps` WHERE id = ?", [req.params.id]);
		}

		const gps = await pool.query("SELECT * FROM `gps`");

		return res.render("admin/monthly/view", {
			gps: temp,
			base64Id: base64Id,
			gpsData: gps,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/mis", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT users.*,cities.city AS sahar FROM `users` INNER JOIN cities ON cities.id = users.city WHERE flag = 0"
		);
		res.render("admin/mis/client", {
			users: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/mis/:clientId", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { clientId } = req.params;
		res.render("admin/mis/view", {
			clientId: clientId,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.post("/mis", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const { clientId, timef, timet } = req.body;
		const data = await pool.query(
			"SELECT trip.*,pay_cli.*,cli_rem.*,cli_advn.*,accounts.*,load_post.pickup_location,load_post.last_point,load_post.amount,load_post.clientAmount,vehicle_table.v_type,vehicle_table.v_num,users.name AS 'client',trans_tab.name AS 'trans',driver_tab.d_name AS 'driver',trip.trip_id AS 'tripId',trip.start_time AS date FROM `trip` LEFT JOIN pay_cli ON pay_cli.trip_id = trip.trip_id LEFT JOIN cli_rem ON cli_rem.client_id = trip.client_id LEFT JOIN cli_advn ON cli_advn.client_id = trip.client_id INNER JOIN confirmed_load ON confirmed_load.c_load_id = trip.c_load_id INNER JOIN load_post ON load_post.load_id = confirmed_load.load_id LEFT JOIN cities ON cities.id = load_post.city INNER JOIN vehicle_table ON vehicle_table.v_id = trip.vehicle_id INNER JOIN accounts ON accounts.trip_id = trip.trip_id INNER JOIN users ON users.id = trip.client_id INNER JOIN trans_tab ON trans_tab.id = trip.t_id INNER JOIN driver_tab ON driver_tab.Did = trip.Did WHERE trip.client_id = ? AND trip.status = 2 AND trip.created BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y') ORDER BY trip.trip_id DESC",
			[clientId, timef, timet]
		);
		for (let i = 0; i < data.length; i++) {
			const pod = await pool.query(
				"SELECT * FROM `pod_pic` WHERE trip_id = ? AND confirm = 1",
				[data[i].tripId]
			);
			if (pod.length) {
				data[i]["pod"] = "Received";
			} else {
				data[i]["pod"] = "Pending";
			}
		}
		return res.send({ code: 1, data: data });
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.send({ code: 0 });
	}
});

router.get("/:vId", ensureAuthenticatedAdmin(), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT vehicle_table.*,trans_tab.name,trans_tab.mob FROM `vehicle_table` INNER JOIN trans_tab ON trans_tab.id = vehicle_table.t_id WHERE v_id = ?",
			[req.params.vId]
		);
		res.render("admin", {
			vehicle: result,
		});
	} catch (error) {
		console.error(error);
		dashLogger.error(`Error : ${error},Request : ${req.originalUrl}`);
		return res.redirect("/400");
	}
});

router.get("/logout", ensureAuthenticatedAdmin(), async (req, res) => {
	req.logout();
	req.flash("success_msg", "You are loged out");
	req.session.destroy();
	res.redirect("/");
});

module.exports = router;
