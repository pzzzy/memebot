const pg = require("pg");
const winston = require("winston");
const config = require("../config");

const pool = new pg.Pool(config.pg);

pool.on("error", function(err, client) {
  winston.error("idle client error", err.message, err.stack);
});

module.exports = {
  pool: pool,
  query: (text, values, callback) => {
    winston.debug("query:", text, values);
    return pool.query(text, values, callback);
  },
  connect: pool.connect
};
