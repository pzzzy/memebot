const { Pool } = require('pg');
const winston = require('winston');
const config = require("../config");

const pool = new Pool(config.pg);

module.exports.query = function (text, values, callback) {
  winston.debug(`db.query: '${text}', '${values}'`);
  return pool.query(text, values, callback);
};

// the pool also supports checking out a client for
// multiple operations, such as a transaction
module.exports.connect = function (callback) {
  return pool.connect(callback);
};
