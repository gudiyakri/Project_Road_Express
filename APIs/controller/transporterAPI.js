const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { SECRET } = require("../utils/Constant");
const { camelize } = require("../helper/helper");

exports.uploadDoc = async (req, res, next) => {
	try {
		const docs = await pool.query(
			"UPDATE `trans_tab` SET `aadhar_trans_pic`= ?,`aadhar_trans_back`= ?,`prof_trans_pic`= ?,`pancard_image`= ?,`cheque_image`= ?,`gst_image`= ?,`tds_declaration_image`= ?  WHERE id = ?",
			[
				body.date,
				body.unloading,
				body.detention,
				body.returnFare,
				body.diesel,
				body.clientAdv,
				body.roadAdv,

				body.tripId,
			]
		);

		if (docs) {
			return res.send({
				status: "Success",
				data: "Document Uploaded!!!!",
			});
		} else {
			return res.status(500).send({ status: "Failure" });
		}
	} catch (error) {
		console.log(error);
		next(error);
	}
};
