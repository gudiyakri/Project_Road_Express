const Sequelize = require("sequelize");
const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const Op = Sequelize.Op;
const gcm = require("node-gcm");
const https = require("https");
const moment = require("moment");
const { BASEURL } = require("../utils/Constant");
const sequelize = require("../config/database");
const NodeGeocoder = require("node-geocoder");
const sender = new gcm.Sender("###########");

const { getDate, addDate, dateDiff, updateFormat, dayNo } = require("../helper/time");
const { ErrorHandler } = require("../helper/error");
const { user } = require("../utils/userType");

module.exports = {
	getDriver: async function (
		main_map,
		vehicle_type,
		vehicle_table,
		rate_matrix_vehicle,
		lat,
		vType,
		lang
	) {
		try {
			if (vType == null) {
				const distance = await sequelize.query(
					`SELECT main_map.id as mapId, cities.city as dCity,main_map.Did as mapDid,driver_tab.d_name as dName,driver_tab.phn as dPhone,gps_val, ( 6371 * acos(cos(radians(${lat})) * cos(radians(gps_val)) * cos(radians(${lang}) - radians(gps_val)) + sin(radians(${lat})) * sin(radians(gps_val)))) AS distance FROM main_map INNER JOIN driver_tab ON main_map.Did = driver_tab.Did INNER JOIN cities ON driver_tab.city = cities.id where d_av = '1' `,
					{
						type: QueryTypes.SELECT,
					}
				);

				city = [];
				for (i = 0; i < distance.length; i++) {
					var lat_lang = distance[i].gps_val;

					var fields = lat_lang.split(",");
					var lat = fields[0];
					var long = fields[1];

					vals = {
						id: distance[i].mapId,
						Did: distance[i].mapDid,
						name: distance[i].dName,
						phone: distance[i].dPhone,
						city: distance[i].dCity,
						latitude: lat,
						longitude: long,
						distance: distance[i].distance.toFixed(2),
					};
					city.push(vals);
				}

				return city;
			} else {
				const distance = await sequelize.query(
					`SELECT main_map.id as mapId,vehicle_type.v_type_img as vTypeImg,vehicle_table.v_num as vName,main_map.Did as mapDid,driver_tab.d_name as dName,driver_tab.phn as dPhone,gps_val, ( 6371 * acos(cos(radians(${lat})) * cos(radians(gps_val)) * cos(radians(${lang}) - radians(gps_val)) + sin(radians(${lat})) * sin(radians(gps_val)))) AS distance FROM main_map INNER JOIN driver_tab ON main_map.Did = driver_tab.Did INNER JOIN vehicle_table ON vehicle_table.v_id = main_map.vehicle_id INNER JOIN vehicle_type ON vehicle_type.type_name = vehicle_table.v_type where d_av = '1'`,
					{
						type: QueryTypes.SELECT,
					}
				);

				city = [];
				for (i = 0; i < distance.length; i++) {
					var lat_lang = distance[i].gps_val;

					var fields = lat_lang.split(",");
					var lat = fields[0];
					var long = fields[1];

					vals = {
						id: distance[i].mapId,
						Did: distance[i].mapDid,
						name: distance[i].dName,
						phone: distance[i].dPhone,
						city: distance[i].dCity,
						vTypeImg: distance[i].vTypeImg,
						vName: distance[i].vName,
						latitude: lat,
						longitude: long,
						distance: distance[i].distance.toFixed(2),
					};
					city.push(vals);
				}

				return city;
			}
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	getVehicleType: async function (vehicle_type) {
		try {
			let vehicle = await sequelize.query("SELECT * from vehicle_type", {
				type: QueryTypes.SELECT,
			});

			vehicleType = [];
			for (i = 0; i < vehicle.length; i++) {
				let cap = vehicle[i].capacity / 1000;
				vals = {
					vTypeId: vehicle[i].v_type,
					typeName: vehicle[i].type_name,
					vTypeImage: vehicle[i].v_type_img,
					basePrice: vehicle[i].base_price,
					capacity: cap,
				};
				vehicleType.push(vals);
			}

			return vehicleType;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	vehicleList: async function (vehicle_type, vehicle_table, body) {
		try {
			let vehicle = await sequelize.query(
				"SELECT vehicle_table.v_num as vNum,vehicle_table.pic_v as picV,vehicle_table.pic_rc_front as picFront,vehicle_table.pic_rc_back as picBack,vehicle_type.type_name as typeName,vehicle_type.base_price as basePrice from vehicle_table INNER JOIN vehicle_type ON vehicle_type.type_name = vehicle_table.v_type where vehicle_table.v_type=?",
				{
					type: sequelize.QueryTypes.SELECT,
					replacements: [body.vType],
				}
			);

			vehicleType = [];
			for (i = 0; i < vehicle.length; i++) {
				vals = {
					vNum: vehicle[i].vNum,
					picV: vehicle[i].picV,
					picFront: vehicle[i].picFront,
					picBack: vehicle[i].picBack,
					basePrice: vehicle[i].basePrice,
				};
				vehicleType.push(vals);
			}

			return vehicleType;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},
	getMaterial: async function (load_type) {
		try {
			let loadType = await sequelize.query("SELECT * from load_type", {
				type: QueryTypes.SELECT,
			});

			load = [];
			for (i = 0; i < loadType.length; i++) {
				vals = {
					id: loadType[i].id,
					loadType: loadType[i].load_type,
				};
				load.push(vals);
			}

			return load;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	getLocation: async function (favourite) {
		try {
			let loc = await sequelize.query(
				"SELECT * from favourite where status = 0 OR status = 2",
				{
					type: QueryTypes.SELECT,
				}
			);

			fav = [];
			for (i = 0; i < loc.length; i++) {
				vals = {
					locationId: loc[i].id,

					clientId: loc[i].clientId,
					location: loc[i].place,
					lat: loc[i].latitude,
					long: loc[i].longitude,
					status: loc[i].status == 0 ? "active" : "Favourite",
				};
				fav.push(vals);
			}

			return fav;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	getProfile: async function (users, body) {
		try {
			let profile = await sequelize.query("SELECT * from users where uId = ?", {
				type: sequelize.QueryTypes.SELECT,
				replacements: [body.id],
			});

			prof = [];
			for (i = 0; i < profile.length; i++) {
				vals = {
					id: profile[i].uId,

					name: profile[i].name,
					email: profile[i].email,
					password: profile[i].password,
					phone: profile[i].mob,
					profileImage: profile[i].profile,
				};
				prof.push(vals);
			}

			return prof;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	updateProfile: async function (users, body, image) {
		try {
			console.log(body);

			let hashedpassword = await bcrypt.hash(body.password, 8);
			let profile = await sequelize.query(
				"UPDATE users SET name = ?,email=?,password=?,mob=?,city=?,profile=? where uId = ?",
				{
					type: sequelize.QueryTypes.UPDATE,
					replacements: [
						body.id,
						body.name,
						body.email,
						hashedpassword,
						body.phone,
						body.city,
						`${BASEURL}/images/client/${body.email}/${image.filename}`,
					],
				}
			);

			return true;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	makeFavourite: async function (favourite, locId, role) {
		try {
			await favourite.update(
				{
					status: 2,
					supervisor: role,
				},
				{
					where: {
						id: locId,
					},
				}
			);

			return true;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	rateTrip: async function (rating, trip_id, rate, review, role) {
		try {
			const data = await sequelize.query(
				"INSERT INTO rating (trip_id, final_rate, descrip,supervisor) VALUES (?, ?, ?,?)",
				{
					type: sequelize.QueryTypes.INSERT,
					replacements: [trip_id, rate, review, role],
				}
			);

			return true;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	addLoad: async function (load_post, users, body, role) {
		try {
			const currentTime = getDate("YYYY-MM-DD HH:mm:ss");
			let tme = body.timef;
			let timet = addDate(tme, "DD-MM-YYYY", "DD-MM-YYYY", 1, "days");

			let lat_long = body.inter_lat_long;
			let inter_lats = lat_long.join("^");

			let loc = body.intermidiate_loc;
			let inter_locs = loc.join("^");
			let stop = loc.length + 2;

			let mob = body.inter_mob;
			let inter_mobs = mob.join(",");

			for (let i = 0; i < body.no_vehicle; i++) {
				let data = await load_post.create({
					fromc: body.fromc,
					status: body.status,
					supervisor: role,
					type: body.type,
					amount: body.amount,
					clientAmount: body.clientAmount,
					vehicle_type: body.vehicle_type,
					pickup_location: body.pickup_location,
					lat_long: body.lat_long,
					inter_lat_long: inter_lats,
					last_lat_long: body.last_lat_long,
					city: body.city,
					dest_city: body.dest_city,
					intermediate_loc: inter_locs,
					last_point: body.last_point,
					timef: body.timef,
					timet: timet,
					weight: body.weight,
					start_mob: body.start_mob,
					inter_mob: inter_mobs,
					last_mob: body.last_mob,
					total_stops: stop,
					no_vehicle: 1,
					remaining: 1,
					remark: body.remark,
					business_type: body.bus_type,
					payment_method: body.payment_method,
					created: currentTime,
				});

				console.log(data.load_id);
				if (data.fromc) {
					let loadDetail = await sequelize.query("SELECT * FROM users  where  id = ?", {
						type: sequelize.QueryTypes.SELECT,
						replacements: [body.fromc],
					});

					const message = new gcm.Message({
						data: {
							key1: "msg1",
							type: "load",
							title: "New Load Found",
							icon: "ic_launcher",
							body: "This is a notification that will be displayed if your app is in the background.",
						},
					});
					let regTokens = [`${loadDetail[0].fcmtoken}`];
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
				}
				return true;
			}
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	sameCity: async function (body) {
		try {
			let inter = body.inter_lat_long;
			let start = body.lat_long;
			let start_lat = start.split("#");

			let last = body.last_lat_long;
			let last_lat = last.split("#");
			// console.log(last_lat[0], last_lat[1]);

			const options = {
				provider: "google",

				httpAdapter: "https",
				apiKey: "AIzaSyBxlbOwRf5pRoPG49JO0srxBu5Bys1l0Wg", // for Mapquest, OpenCage, Google Premier
				formatter: "json", // 'gpx', 'string', ...
			};
			if (inter.length == 0) {
				const geocoder = NodeGeocoder(options);

				let strt = await geocoder.reverse(
					{ lat: start_lat[0], lon: start_lat[1] },
					function (err, pickup) {
						// console.log(pickup[0].administrativeLevels.level1long);
					}
				);

				let lst = await geocoder.reverse(
					{ lat: last_lat[0], lon: last_lat[1] },
					function (err, res) {
						// console.log(res[0].administrativeLevels.level1long);
					}
				);

				if (
					strt[0].administrativeLevels.level1long ==
					lst[0].administrativeLevels.level1long
				) {
					return true;
				} else {
					return "States are Not equal";
				}
			} else {
				const geocoder = NodeGeocoder(options);

				let strt = await geocoder.reverse(
					{ lat: start_lat[0], lon: start_lat[1] },
					function (err, pickup) {
						// console.log(pickup[0].administrativeLevels.level1long);
					}
				);

				let lst = await geocoder.reverse(
					{ lat: last_lat[0], lon: last_lat[1] },
					function (err, res) {
						// console.log(res[0].administrativeLevels.level1long);
					}
				);

				let inter = body.inter_lat_long;
				let intersd = [];
				let bet = [];
				for (let i = 0; i < inter.length; i++) {
					inters = inter[i].split("#");
					intersd.push(inters);

					await geocoder.reverse(
						{ lat: intersd[i][0], lon: intersd[i][1] },
						function (err, mediate) {
							bet.push(mediate[0].administrativeLevels.level1long);
							// console.log(mediate[0].administrativeLevels.level1long);
						}
					);
				}

				function matchList(list) {
					var listItem = list[0];

					for (index in list) {
						if (list[index] != listItem) {
							console.log("false");
							return false;
						}
					}
					console.log("true");
					return listItem;
				}

				if (
					strt[0].administrativeLevels.level1long == matchList(bet) &&
					lst[0].administrativeLevels.level1long == matchList(bet) &&
					strt[0].administrativeLevels.level1long ==
						lst[0].administrativeLevels.level1long
				) {
					return true;
				} else {
					return "States are Not equal";
				}
			}
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	bookingDetails: async function (saved_load, confirmed_load, driver_tab, body) {
		try {
			const loadDetail = await sequelize.query(
				"SELECT saved_load.end_mob as endMob, saved_load.inter_mob as interMob, saved_load.start_mob as startMob,saved_load.no_vehicle as noVehicle,saved_load.timef as timef,saved_load.timet as timet,saved_load.amount as amount,saved_load.time as time,saved_load.status as status,driver_tab.d_name as dName, cities.city as lCity FROM saved_load INNER JOIN cities ON saved_load.city = cities.id INNER JOIN confirmed_load ON confirmed_load.load_id = saved_load.load_id INNER JOIN driver_tab ON confirmed_load.Did = driver_tab.Did where saved_load.status = '0' AND saved_load.load_id = ?",
				{
					type: sequelize.QueryTypes.SELECT,
					replacements: [body.loadId],
				}
			);
			booking = [];
			for (i = 0; i < loadDetail.length; i++) {
				vals = {
					city: loadDetail[i].lCity,
					time: loadDetail[i].time,
					amount: loadDetail[i].amount,
					timeTo: loadDetail[i].timet,
					timeFrom: loadDetail[i].timef,
					driver: loadDetail[i].dName,
					status: loadDetail[i].status == 0 ? "active" : "inActive",
				};
				booking.push(vals);
			}

			return booking;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	viewDriverDetails: async function (load_post, confirmed_load, trip, driver_tab, body) {
		try {
			const currentTime = getDate("YYYY-MM-DD HH:mm:ss");
			const driverDetail = await sequelize.query(
				"SELECT STR_TO_DATE(trip.start_time, '%d/%m/%Y %h:%i %p') as startTime, STR_TO_DATE(trip.final_endtime, '%d/%m/%Y %h:%i %p') as endTime,driver_tab.d_name as dName,driver_tab.phn as phone FROM load_post INNER JOIN confirmed_load ON confirmed_load.load_id = load_post.load_id INNER JOIN trip ON trip.c_load_id = confirmed_load.c_load_id INNER JOIN driver_tab ON trip.Did = driver_tab.Did where load_post.load_id = ?",
				{
					type: sequelize.QueryTypes.SELECT,
					replacements: [body.loadId],
				}
			);
			const sTime = driverDetail[0].startTime;

			let sec = dateDiff(updateFormat(sTime), currentTime);
			let min = sec / 60;
			console.log(min);
			if (min < 30) {
				booking = [];
				for (i = 0; i < driverDetail.length; i++) {
					vals = {
						driver: driverDetail[i].dName,
						phone: driverDetail[i].phone,

						startTime: updateFormat(
							moment(driverDetail[i].startTime),
							"YYYY-MM-DD HH:mm"
						),
						endTime: updateFormat(moment(driverDetail[i].endTime), "YYYY-MM-DD HH:mm"),
					};
					booking.push(vals);
				}

				return booking;
			} else {
				return "time is greate than 30 minutes";
			}
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},

	podStatus: async function (pod_pic, body) {
		try {
			let podPic = await sequelize.query(
				"SELECT * from pod_pic where status = '1' AND confirm = '1' AND trip_id = ?",
				{
					type: sequelize.QueryTypes.SELECT,
					replacements: [body.tripId],
				}
			);

			pod = [];
			for (i = 0; i < podPic.length; i++) {
				vals = {
					podId: podPic[i].pod_id,
					podPic: podPic[i].pic_pathee,
					signature: podPic[i].signature,
					createdDate: podPic[i].created,
					status: podPic[i].status == 1 ? "Active" : "Inactive",
				};
				pod.push(vals);
			}

			return pod;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},
	uploadPod: async function (pod_pic, body, image, role) {
		try {
			const currentTime = getDate("YYYY-MM-DD HH:mm:ss");
			const data = await sequelize.query(
				"INSERT INTO pod_pic (pic_pathee, signature,supervisor, trip_id,confirm,created,status) VALUES (?, ?,?, ?,?,?,?)",
				{
					type: sequelize.QueryTypes.INSERT,
					replacements: [
						`${BASEURL}/images/client/${body.tripId}/${image.filename}`,
						`${BASEURL}/images/client/${body.tripId}/${image.filename}`,
						role,
						body.tripId,
						0,
						currentTime,
						0,
					],
				}
			);

			return true;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},
	addSubBanch: async function (users, supervisor, ids, body, role) {
		try {
			console.log(ids);
			if (role == "0") {
				let hashedpassword = await bcrypt.hash(body.password, 8);
				const currentTime = getDate("YYYY-MM-DD HH:mm:ss");
				const emailCheck = await users.findAll({
					attributes: ["mob", "email"],
					where: {
						email: body.email,
					},
				});

				const mobileCheck = await users.findAll({
					attributes: ["mob", "email"],
					where: {
						mob: body.mobileNumber,
					},
				});
				let lastId = await users.findOne({
					attributes: ["uId"],
					order: [["uId", "DESC"]],
				});
				let lId = lastId.uId + 1;
				if (!emailCheck.length && !mobileCheck.length) {
					const uId = await users.create({
						id: `rc_${lId}`,
						name: body.name,
						email: body.email,
						mob: body.mobileNumber,
						password: hashedpassword,
						gst: body.gst,
						city: body.city,
						state: body.state,
						type: body.type,
						flag: 0,
						confirmed: 2,
						role: "user",
						branchOwnerId: ids,
						managerFlag: 1,
						created: currentTime,
					});

					let sub = await sequelize.query(
						"SELECT id from users where managerFlag = ? AND branchOwnerId = ?",
						{
							type: sequelize.QueryTypes.SELECT,
							replacements: [1, ids],
						}
					);

					let branch = [];
					sub.forEach((number, index, arr) => {
						// branch += number.id + `~+~`;
						br = number.id;
						branch.push(br);
					});
					let values = branch.join("~+~");
					console.log(values);

					let updateBranch = await sequelize.query(
						"UPDATE users SET sub = ? where uId = ?",
						{
							type: sequelize.QueryTypes.UPDATE,
							replacements: [values, ids],
						}
					);

					return true;
				} else {
					return "User already exists";
				}
			}

			if (role == "1") {
				let hashedpassword = await bcrypt.hash(body.password, 8);
				const currentTime = getDate("YYYY-MM-DD HH:mm:ss");
				const emailCheck = await users.findAll({
					attributes: ["mob", "email"],
					where: {
						email: body.email,
					},
				});

				const mobileCheck = await users.findAll({
					attributes: ["mob", "email"],
					where: {
						mob: body.mobileNumber,
					},
				});
				let lastId = await users.findOne({
					attributes: ["uId"],
					order: [["uId", "DESC"]],
				});
				let lId = lastId.uId + 1;
				if (!emailCheck.length && !mobileCheck.length) {
					const uId = await users.create({
						id: `rc_${lId}`,
						name: body.name,
						email: body.email,
						mob: body.mobileNumber,
						password: hashedpassword,
						gst: body.gst,
						city: body.city,
						state: body.state,
						type: body.type,
						flag: 0,
						confirmed: 2,
						role: "supervisor",
						branchOwnerId: ids,
						managerFlag: 1,
						created: currentTime,
					});

					let sub = await sequelize.query(
						"SELECT id from users where managerFlag = ? AND branchOwnerId = ?",
						{
							type: sequelize.QueryTypes.SELECT,
							replacements: [1, ids],
						}
					);

					let branch = [];
					sub.forEach((number, index, arr) => {
						// branch += number.id + `~+~`;
						br = number.id;
						branch.push(br);
					});
					let values = branch.join("~+~");
					console.log(values);

					let updateBranch = await sequelize.query(
						"UPDATE users SET sub = ? where uId = ?",
						{
							type: sequelize.QueryTypes.UPDATE,
							replacements: [values, ids],
						}
					);

					return true;
				} else {
					return "User already exists";
				}
			}
		} catch (error) {
			throw new ErrorHandler(500, error);
		}
	},

	viewBranch: async function (users, ids, role) {
		try {
			let branch = await sequelize.query(
				"SELECT * from users where branchOwnerId = ? AND supervisor = ?",
				{
					type: sequelize.QueryTypes.SELECT,
					replacements: [ids, role],
				}
			);

			br = [];
			for (i = 0; i < branch.length; i++) {
				vals = {
					id: branch[i].uId,
					name: branch[i].name,
					email: branch[i].email,

					phone: branch[i].mob,
					profileImage: branch[i].profile,
				};
				br.push(vals);
			}

			return br;
		} catch (error) {
			console.log(error);
			throw new ErrorHandler(500, error);
		}
	},
};
