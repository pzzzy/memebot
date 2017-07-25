const db = require('./db');
const winston = require('winston');
const config = require("../config");
const moment = require('moment');

const URL = require('url');
const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i

function normalizeUrl(url) {
  delete url.hash;
  if (url.host.match(/\.youtube\.com$/) && url.query.v) {
    url.host = "www.youtube.com";
    url.query = {v: url.query.v};
    delete url.search;
  }

  return URL.format(url);
}

function parseURL(bot, user, channel, url) {
  if (channel[0] != "#") {
    return;
  }

  const parsed = URL.parse(url, true);
  var normalized = normalizeUrl(parsed);

  // We don't care about Twitch reposts
  if (parsed.host.match(/\.?(twitch\.tv)$/)) {
    return;
  }

  db.query("select * from links where href = $1::text and channel = $2::text", [normalized, channel], (err, res) => {
    if ( err ) {
      winston.error(err);
      return;
    }

    if (res.rows.length > 0) {
      var r = res.rows[0];
      if ( user != r.owner) {
        db.query("UPDATE links SET times_seen = times_seen + 1, last_seen = $2::timestamp WHERE id = $1", [r.id, new Date()]);
        let extraTime = "";
        if (r.times_seen > 1) {
          extraTime = `, last seen ${moment(r.last_seen).fromNow()}`;
        }
        bot.say(channel, `Too slow! First posted by ${r.owner} ${moment(r.first_seen).fromNow()}! (Posted ${r.times_seen} time${r.times_seen != 1 ? "s" : ""}${extraTime})`);
      }
    } else {
      winston.info("URL not found, crediting to", channel, normalized);
      db.query("INSERT INTO links (href, owner, channel, times_seen) VALUES ($1, $2, $3, $4)", [normalized, user, channel, 1], (err, res) => {
        if ( err ) {
          winston.error(err);
          return;
        }
        winston.debug(res);
      });
    }
  });
}

function parseMessage(bot, from, to, message) {
  let msg = message.args[1];
  const matches = msg.match(URL_RE);
  if (matches) {
    parseURL(bot, from, to, matches[0]);
  }
}

function migrateSchema() {
  const query = `
    CREATE TABLE IF NOT EXISTS links (
      id BIGSERIAL PRIMARY KEY,
      channel VARCHAR(256) NOT NULL,
      href VARCHAR(4096) NOT NULL,
      owner VARCHAR (256) NOT NULL,
      first_seen TIMESTAMP DEFAULT current_timestamp,
      last_seen TIMESTAMP DEFAULT current_timestamp,
      times_seen INTEGER DEFAULT 0,
      CONSTRAINT unique_href UNIQUE(href)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS hrefs_index ON links (href);
    `;
  db.query(query, [], (err, res) => {
    if (err) {
      winston.error(err);
      return;
    }
  })
}
function setup(bot) {
  migrateSchema();

  bot.addListener("message", (from, to, text, message) => {
    parseMessage(bot, from, to, message);
  })
}

module.exports = {
  setup: setup
}
