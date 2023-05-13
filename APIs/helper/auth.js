const { ErrorHandler } = require("./error");




module.exports = {
	ensureAuthenticatedAdmin: function () {
		return function (req, res, next) {
			if (req.isAuthenticated() && req.user.flag === 0) {
				return next();
			} else if (req.isAuthenticated() && req.user.flag === 1) {
				if (/(accounts)/.test(req.originalUrl)) {
					return next();
				} else {
					req.flash("error_msg", "Not Authorized");
					res.redirect("/accounts/clientWise");
				}
			} else if (req.isAuthenticated() && req.user.flag === 2) {
				if (/(survellance)/.test(req.originalUrl)) {
					return next();
				} else {
					req.flash("error_msg", "Not Authorized");
					res.redirect("/survellance/history");
				}
			} else if (req.isAuthenticated() && req.user.flag === 3) {
				if (
					/(display)/.test(req.originalUrl) ||
					req.originalUrl == "/admin/autoTrans" ||
					/(addFavs)/.test(req.originalUrl) ||
					/(searchV_num)/.test(req.originalUrl) ||
					/(addCityRate)/.test(req.originalUrl) ||
					/(fav)/.test(req.originalUrl) ||
					/(trip)/.test(req.originalUrl) ||
					/(mapD)/.test(req.originalUrl) ||
					/(search)/.test(req.originalUrl) ||
					req.originalUrl == "/admin/time" ||
					/(update)/.test(req.originalUrl) ||
					/(sos)/.test(req.originalUrl) ||
					/(updateV)/.test(req.originalUrl) ||
					req.originalUrl == "/admin/" ||
					req.originalUrl == "/admin/autoDriver" ||
					req.originalUrl == "/admin/addTrip" ||
					req.originalUrl == "/admin/removeMapping" ||
					req.originalUrl == "/admin/addUser" ||
					req.originalUrl == "/admin/createMaster" ||
					req.originalUrl == "/admin/masterOtp" ||
					req.originalUrl == "/admin/addLoadType" ||
					req.originalUrl == "/admin/placement" ||
					req.originalUrl == "/admin/driverList" ||
					req.originalUrl == "/admin/amount" ||
					req.originalUrl == "/admin/autofill" ||
					req.originalUrl == "/admin/vehicleReq" ||
					req.originalUrl == "/admin/loadedDriver" ||
					req.originalUrl == "/admin/send_not_trans" ||
					req.originalUrl == "/admin/send_not" ||
					req.originalUrl == "/admin/book" ||
					req.originalUrl == "/admin/vtypes" ||
					req.originalUrl == "/admin/findDriver" ||
					req.originalUrl == "/admin/UpdateSos" ||
					req.originalUrl == "/admin/addSelf" ||
					req.originalUrl == "/admin/findCompany" ||
					req.originalUrl == "/admin/autoFleet" ||
					req.originalUrl == "/admin/addCity" ||
					req.originalUrl == "/admin/addVehicle" ||
					req.originalUrl == "/admin/updateClient" ||
					req.originalUrl == "/admin/autoClient" ||
					req.originalUrl == "/admin/addTrans" ||
					req.originalUrl == "/admin/self" ||
					req.originalUrl == "/admin/updateDriver" ||
					req.originalUrl == "/admin/loadType" ||
					req.originalUrl == "/admin/addDriver" ||
					req.originalUrl == "/admin/client" ||
					req.originalUrl == "/admin/check" ||
					/(vehicles)/.test(req.originalUrl) ||
					/(incomming)/.test(req.originalUrl) ||
					req.originalUrl == "/admin/check" ||
					/(outgoing)/.test(req.originalUrl) ||
					req.originalUrl == "/admin/time" ||
					req.originalUrl == "/admin/trips" ||
					req.originalUrl == "/admin/history" ||
					req.originalUrl == "/admin/invoice" ||
					req.originalUrl == "/admin/createInvoice" ||
					req.originalUrl == "/admin/tripEnd" ||
					req.originalUrl == "/admin/kmWise" ||
					req.originalUrl == "/admin/dummy" ||
					req.originalUrl == "/admin/noInfo" ||
					req.originalUrl == "/admin/DidInfo" ||
					req.originalUrl == "/admin/markerInfo" ||
					req.originalUrl == "/admin/getVehicle" ||
					req.originalUrl == "/admin/allTrip" ||
					req.originalUrl == "/admin/tripDens" ||
					req.originalUrl == "/admin/InOut" ||
					req.originalUrl == "/admin/month" ||
					req.originalUrl == "/admin/year" ||
					req.originalUrl == "/admin/search" ||
					req.originalUrl == "/admin/cityChart" ||
					req.originalUrl == "/admin/lateList" ||
					req.originalUrl == "/admin/tripInfo" ||
					req.originalUrl == "/admin/kmWise" ||
					req.originalUrl == "/admin/fetchMapped" ||
					req.originalUrl == "/admin/rateVehicle" ||
					req.originalUrl == "/admin/rateClient" ||
					req.originalUrl == "/admin/addCityRate" ||
					req.originalUrl == "/admin/matrix" ||
					req.originalUrl == "/admin/updateRate" ||
					req.originalUrl == "/admin/offline" ||
					/(addSub)/.test(req.originalUrl) ||
					/(invoiceEdit)/.test(req.originalUrl)
				) {
					return next();
				} else {
					req.flash("error_msg", "Not Authorized");
					res.redirect("/admin/client");
				}
			} else {
				req.logout();
				req.flash("error_msg", "Not Authorized");
				res.redirect("/");
			}
		};
	},
	checkUserType: function (types, token = true) {
		return function (req, res, next) {
          
			if (token) {

				const user = req.user;
				if (types.length) {
					if (!user || user.isAuth !== true)
						throw new ErrorHandler(401, "Not Authorized");

				
				}
			}
			next();
		};
	},
};
