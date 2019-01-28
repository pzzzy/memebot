const forecast = require("forecast");
const request = require("request");
const { escape } = require("querystring");
const { darkSkyAPIKey } = require("../secrets");
const winston = require("winston");
const util = require("util");
const db = require("../lib/db");

const emojiMap = {
  "clear-day": "☀️",
  "clear-night": "🌙",
  rain: "🌦️",
  snow: "❄️",
  wind: "💨",
  fog: "🌫️",
  cloudy: "☁️",
  "partly-cloudy-day": "⛅",
  "partly-cloudy-night": "⛅"
};

const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

let _bot = null;

function bearingToString(windBearing) {
  const index = Math.floor((windBearing - 22.5) / 360 * 8);
  return BEARINGS[index % 8];
}

function getWeatherLocation(words, channel, nick, cb) {
  let location = words.slice(1, words.length).join(" ");

  let inserter = () => {
    db.query(
      "SELECT id FROM weather WHERE channel = $1::text AND nick = $2::text",
      [channel, nick],
      (err, res) => {
        if (err) {
          winston.error("Error querying weather", err);
          return cb(location);
        }
        let entries = res.rows.length;
        let query = null;
        let args = null;
        if (entries === 0) {
          query =
            "INSERT INTO weather (channel, nick, location) VALUES ($1, $2, $3)";
          args = [channel, nick, location];
        } else {
          query =
            "UPDATE weather SET location = $1 WHERE channel = $2::text AND nick = $3::text";
          args = [location, channel, nick];
        }
        db.query(query, args, (err, res) => {
          if (err) {
            winston.error("Error querying weather", err);
          }
          return cb(location);
        });
      }
    );
  };

  if (location.trim() === "") {
    winston.info("querying");
    db.query(
      "SELECT location FROM weather WHERE nick = $1::text AND channel = $2::text",
      [nick, channel],
      (err, res) => {
        winston.info(err, res);
        if (err) {
          winston.error("Error querying weather", err);
          return;
        }
        if (res.rows.length > 0) {
          cb(res.rows[0].location);
        } else {
          inserter();
        }
      }
    );
  } else {
    inserter();
  }
}

function weather(bot, words, from, to) {
  getWeatherLocation(words, to, from, query => {
    let url = `https://nominatim.openstreetmap.org/search?q=${escape(query)}&format=json`
    winston.info(url);
    const sendTo = to == _bot.nick ? from : to;

    const options = {
      headers: {
        "User-Agent": "IRC weather bot (https://github.com/cheald/memebot)"
      }
    };

    request(url, options, (err, response) => {
      if (err) {
        winston.error(err);
        return;
      }
      const resp = JSON.parse(response.body);
      const loc = resp[0];
      if (!loc) {
        bot.say(sendTo, `${from}: Sorry, I couldn't find that location`);
        return;
      }
      const lat = loc.lat;
      const long = loc.lon;
      const niceLocation = loc.display_name;

      winston.info(`Resolved ${query} => ${lat},${long} (${niceLocation})`)

      url = `https://api.darksky.net/forecast/${darkSkyAPIKey}/${lat},${long}`;
      winston.info(url);
      request(url, (err, response) => {
        if (err) {
          winston.error(err);
          return;
        }
        const weather = JSON.parse(response.body);
        const summary = weather.currently.summary;
        const emoji = emojiMap[weather.currently.icon];
        const temp = Math.floor(weather.currently.temperature);
        const windSpeed = weather.currently.windSpeed;
        const bearing = weather.currently.windBearing;
        bot.say(
          sendTo,
          `${from}: ${emoji}${emoji
            ? " "
            : ""}${summary} in ${niceLocation} (${temp}F, wind ${bearingToString(
            bearing
          )} @ ${windSpeed}MPH, humidity ${Math.floor(
            weather.currently.humidity * 100
          )}%)`
        );
      });
    });
  });
}

function migrateSchema() {
  const query = `
    CREATE TABLE IF NOT EXISTS weather (
      id BIGSERIAL PRIMARY KEY,
      channel VARCHAR(256) NOT NULL,
      nick VARCHAR (256) NOT NULL,
      location VARCHAR(256) NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS channel_nick ON weather (channel, nick);
    `;
  db.query(query, [], (err, res) => {
    if (err) {
      winston.error(err);
      return;
    }
  });
}

function setup(bot, commands) {
  _bot = bot;
  commands.set("weather", weather);
  migrateSchema();
}

module.exports = {
  setup: setup
};
