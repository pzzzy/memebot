const db = require("../lib/db");
const winston = require("winston");
const moment = require("moment");

const URL = require("url");
const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i;

function normalizeUrl(url) {
  if (url.hash && !url.hash.match(/^#!/)) {
    delete url.hash;
  }
  if (url.host.match(/\.youtube\.com$/) && url.query.v) {
    url.host = "www.youtube.com";
    url.query = { v: url.query.v };
    delete url.search;
  }

  return URL.format(url);
}

function parseURL(bot, user, channel, url) {
  if (channel[0] != "#") {
    return;
  }

  const parsed = URL.parse(url, true);
  const normalized = normalizeUrl(parsed);

  // We don't care about Twitch reposts
  if (parsed.host.match(/\.?(twitch\.tv)$/)) {
    return;
  }

  return logLink(bot, normalized, channel, user);
}

function adjustScore(channel, nick, delta) {
  db.query(
    `INSERT INTO links_score (channel, nick, score) VALUES ($1, $2, $3)
      ON CONFLICT (channel, nick)
      DO UPDATE SET score = links_score.score + $3::int`,
    [channel, nick, delta]
  );
}

function reportLinkViolation(
  bot,
  channel,
  times_seen,
  first_seen,
  last_seen,
  owner
) {
  let extraTime = "";
  if (times_seen > 1) {
    extraTime = `, last seen ${moment(last_seen).fromNow()}`;
  }
  bot.say(
    channel,
    `Too slow! First posted by ${owner} ${moment(
      first_seen
    ).fromNow()}! (Posted ${times_seen} time${times_seen != 1
      ? "s"
      : ""}${extraTime})`
  );
}

function logLink(bot, channel, normalized, user) {
  return db
    .query(
      `INSERT INTO links (href, owner, channel, times_seen) VALUES ($1, $2, $3, $4)
        ON CONFLICT (channel, href)
        DO UPDATE SET times_seen = links.times_seen + 1, last_seen = $5::timestamp WHERE links.owner != $2::text
        RETURNING *
      `,
      [normalized, user, channel, 1, new Date()]
    )
    .catch(err => {
      console.log(err);
      winston.error(err);
    });
}

function parseMessage(bot, from, to, message) {
  let msg = message.args[1];
  if (msg.match(/\b(NOBOT|linkcheck)\b/i)) {
    return;
  }

  const matches = msg.match(URL_RE);
  if (matches) {
    return parseURL(bot, from, to, matches[0]).then(res => {
      const r = res.rows[0];
      if (from != r.owner) {
        adjustScore(to, r.owner, 1);
        adjustScore(to, from, -1);
        reportLinkViolation(
          bot,
          to,
          r.times_seen,
          r.first_seen,
          r.last_seen,
          r.owner
        );
      }
      return r;
    });
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
    CREATE UNIQUE INDEX IF NOT EXISTS hrefs_index ON links (channel,href);

		CREATE TABLE IF NOT EXISTS links_score (
			id BIGSERIAL PRIMARY KEY,
			channel TEXT NOT NULL,
			nick TEXT NOT NULL,
			score INTEGER
		);
		CREATE UNIQUE INDEX IF NOT EXISTS channel_nick_index ON links_score (channel,nick);
  `;
  return db.query(query, []).catch(err => winston.error(err));
}

function setup(bot, commands) {
  migrateSchema();

  bot.addListener("message", (from, to, text, message) => {
    parseMessage(bot, from, to, message);
  });
}

module.exports = {
  setup: setup,
  parseMessage: parseMessage,
  migrateSchema: migrateSchema
};
