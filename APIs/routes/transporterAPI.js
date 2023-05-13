const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { checkUserType } = require("../helper/auth");

const { uploadDoc } = require("../controller/transporterAPI");

const fileStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		// console.log(req.body);
		// console.log(file);
		let dir = `./public/images/docs/${req.body.id}`;
		//this will create the folder if not exists
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		cb(null, new Date().getTime() + "-" + file.originalname.toString().replace(/\s/g, "-"));
	},
});

// Multer filter
const filter = (req, file, cb) => {
	if (
		file.mimetype === "image/jpg" ||
		file.mimetype === "image/png" ||
		file.mimetype === "image/jpeg"
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
	if (file.mimetype.split("/")[1] === "pdf") {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

// Multer config

const upload = multer({
	storage: fileStorage,
	fileFilter: filter,
}).single("image");

const fileStorage1 = multer.diskStorage({
	destination: (req, file, cb) => {
		// console.log(req.body);
		// console.log(file);
		let dir = `./public/images/client/${req.body.email}`;
		//this will create the folder if not exists
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		cb(null, new Date().getTime() + "-" + file.originalname.toString().replace(/\s/g, "-"));
	},
});

// Multer filter
const filter1 = (req, file, cb) => {
	if (
		file.mimetype === "image/jpg" ||
		file.mimetype === "image/png" ||
		file.mimetype === "image/jpeg"
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
	if (file.mimetype.split("/")[1] === "pdf") {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

// Multer config

const upload1 = multer({
	storage: fileStorage1,
	fileFilter: filter1,
}).single("image");

router.post("/uploadDoc", upload, uploadDoc);

// router.post("/updateProfile", checkUserType([client]), upload1, updateProfile);

// router.post("/uploadPod", checkUserType([client]), upload, uploadPod);

module.exports = router;
