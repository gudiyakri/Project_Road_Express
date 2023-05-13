const mysql = require("mysql2");

const util = require("util");

const { host, user, password, database, PORT } = require("../utils/Constant");

const pool = mysql.createPool({
  multipleStatements: true,
  connectionLimit: 100,
  host: host,
  user: user,
  password: password,
  database: database,
  port: "3306",
});

pool.getConnection((err, db) => {
  if (err) {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.error("Database connection was closed.");
    }
    if (err.code === "ER_CON_COUNT_ERROR") {
      console.error("Database has too many connections.");
    }
    if (err.code === "ECONNREFUSED") {
      console.log(err);
      console.error("Database connection was refused.");
    } else {
      console.log(err);
    }
  }

  if (db) db.release();

  return;
});

// Promisify for Node.js async/await.
pool.query = util.promisify(pool.query);

module.exports = pool;
