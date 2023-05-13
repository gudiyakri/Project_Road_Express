const Joi = require("joi");

const login = Joi.object({
  type: Joi.string().min(3).max(15).required(),
  password: Joi.string().min(3).max(15).required(),
  phone: Joi.string()

    .max(9999999999)
    .required(),
});

const registration = Joi.object({
  name: Joi.string().min(3).max(15).required(),
  email: Joi.string().email().min(3).max(50).required(),
  password: Joi.string().min(3).max(15).required(),
  mobileNumber: Joi.string()

    .max(9999999999)
    .required(),
  gst: Joi.string().min(15).max(15).required(),
  city: Joi.number().integer().min(1).max(1000).required(),
  state: Joi.string().min(3).max(15).required(),
  type: Joi.string().min(3).max(15).required(),
});
const sendOtp = Joi.object({
  phone: Joi.string()

    .max(9999999999)
    .required(),
  flag: Joi.optional(),
});
const resetPassword = Joi.object({
  password: Joi.string().min(3).max(15).required(),
  phone: Joi.string().required(),
});
const verifyOtp = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().min(1).max(1000).required(),
  flag: Joi.optional(),
});
const driver = Joi.object({
  lat: Joi.string().required(),
  lang: Joi.string().required(),
});

const rateTrip = Joi.object({
  rate: Joi.number().integer().min(1).max(5).required(),
  review: Joi.string().required(),
  trip_id: Joi.number().integer().min(1).max(1000).required(),
});

const bookingDetails = Joi.object({
  loadId: Joi.number().integer().min(1).max(1000).required(),
});

const lseBookingDetails = Joi.object({
  clientId: Joi.string().min(1).max(20).required(),
  tab: Joi.string().required(),
});

const makeFavourite = Joi.object({
  locId: Joi.number().integer().min(1).max(1000).required(),
});

const podStatus = Joi.object({
  tripId: Joi.number().integer().min(1).max(1000).required(),
});
const getProfile = Joi.object({
  id: Joi.number().integer().min(1).max(1000).required(),
});
const addSubBanch = Joi.object({
  name: Joi.string().min(3).max(15).required(),
  email: Joi.string().email().min(3).max(50).required(),
  password: Joi.string().min(3).max(15).required(),
  mobileNumber: Joi.string()

    .max(9999999999)
    .required(),
  gst: Joi.string().min(3).max(15).required(),
  city: Joi.number().integer().min(1).max(1000).required(),
  state: Joi.string().min(3).max(15).required(),
  type: Joi.string().min(3).max(15).required(),
});

// const updateProfile = Joi.object({
//   name: Joi.string().min(3).max(15).required(),
//   email: Joi.string().email().min(3).max(50).required(),
//   password: Joi.string().min(3).max(15).optional(),
//   phone: Joi.string()

//     .max(9999999999)
//     .required(),

//   city: Joi.number().integer().min(1).max(100).required(),
// });
const driverDetail = Joi.object({
  loadId: Joi.number().integer().min(1).max(1000).required(),
});
const notification = Joi.object({
  clientId: Joi.string().min(1).max(15).required(),
});

const fcm = Joi.object({
  fcmkey: Joi.string().min(1).max(200).required(),
  id: Joi.number().integer().min(1).max(1000).required(),
});
const history = Joi.object({
  clientId: Joi.string().min(1).max(15).required(),
  time: Joi.string().min(1).max(150).required(),
});

const tripDetails = Joi.object({
  tripId: Joi.number().integer().min(1).max(1000).required(),
  loadId: Joi.number().integer().min(1).max(1000).required(),
});
module.exports = {
  "/client/login/login": login,
  "/client/registration/registration": registration,
  "/client/registration/sendOTP": sendOtp,
  "/client/registration/verifyOTP": verifyOtp,
  "/client/homeScreen/makeFavourite": makeFavourite,
  "/client/homeScreen/rateTrip": rateTrip,
  "/client/booking/bookingDetails": bookingDetails,
  "/client/booking/lse-booking-details": lseBookingDetails,
  "/client/homeScreen/podStatus": podStatus,
  "/client/homeScreen/getProfile": getProfile,
  // "/client/homeScreen/updateProfile": updateProfile,
  "/client/homeScreen/addSubBanch": addSubBanch,
  "/client/homeScreen/viewDriverDetails": driverDetail,
  "/client/notification/getNotification": notification,
  "/client/notification/update-fcm-token": fcm,
  "/client/login/reset": resetPassword,
  "/client/history/getHistory": history,
  "/client/history/tripDetails": tripDetails,
};
