const jwt = require("jsonwebtoken");
const { SECRET } = require("../utils/Constant");

const authorization = (req, res, next) => {
  const token = req.headers.token,
    user = {};

  if (!token) {
    user.isAuth = false;
    return next();
  }

  jwt.verify(token, SECRET, function (error, decoded) {
    if (error) {
      user.isAuth = false;
      return next();
    } else {
      console.log(decoded);
      user.isAuth = true;
      user.id = decoded.data[0].ID;
      user.clientId = decoded.data[0].clientId;
      user.role = decoded.data[0].role;

      req.user = user;

      next();
    }
  });
};

module.exports = authorization;
