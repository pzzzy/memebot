const sqlite3 = require("sqlite3");
const fs = require('fs');
const path = require('path');
const request = require("request");
const util = require("util");
const { escape } = require("sqlite3");
const { pirateWeatherAPIKey } = require("../secrets");
const winston = require("winston");
const dbPath = path.join(__dirname, 'weather.db');

const dbExists = fs.existsSync(dbPath);
let db = new sqlite3.Database(dbPath);

if (!dbExists) {
  db.run(`
    CREATE TABLE weather (
      id INTEGER PRIMARY KEY,
      channel TEXT NOT NULL,
      nick TEXT NOT NULL,
      location TEXT NOT NULL
    );
  `, (err) => {
    if (err) {
      winston.error(`Error creating weather table: ${err}`);
    } else {
      winston.debug(`Successfully created weather table`);
    }
  });
}

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
  // Escape the location input to prevent SQL injection
  location = db.escape(location);

  let inserter = () => {
    db.get(
      "SELECT id FROM weather WHERE channel = ? AND nick = ?",
      [channel, nick],
      (err, row) => {
        if (err) {
          winston.error("Error querying weather", err);
          return cb(location);
        }
        if (row === undefined) {
          db.run(
            "INSERT INTO weather (channel, nick, location) VALUES (?, ?, ?)",
[channel, nick, location],
(err) => {
if (err) {
winston.error("Error querying weather", err);
}
return cb(location);
}
);
} else {
db.run(
"UPDATE weather SET location = ? WHERE channel = ? AND nick = ?",
[location, channel, nick],
(err) => {
if (err) {
winston.error("Error querying weather", err);
}
return cb(location);
}
);
}
}
);
};

if (location.trim() === "") {
db.get(
"SELECT location FROM weather WHERE nick = ? AND channel = ?",
[nick, channel],
(err, row) => {
if (err) {
winston.error("Error querying weather", err);
return;
}
if (row) {
cb(row.location);
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
let url = https://nominatim.openstreetmap.org/search?q=${escape(query)}&format=json
winston.debug(url);
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

  winston.debug(`Resolved ${query} => ${lat},${long} (${niceLocation})`)

  url = `https://api.pirateweather.net/v2/forecast/${lat},${long}?units=si`;
  request(url, options, (err, response) => {
    if (err) {
      winston.error(err);
      return;
    }
    let forecast = JSON.parse(response.body);
    let summary = forecast.currently.summary;
    let temperature = forecast.currently.temperature;
    let humidity = forecast.currently.humidity * 100;
    let windSpeed = forecast.currently.windSpeed;
    let windBearing = forecast.currently.windBearing;
    let icon = emojiMap[forecast.currently.icon];
    if (!icon) {
      icon = "❓";
}
let message = ${from}: The weather in ${niceLocation} is currently ${icon} ${summary}, with a temperature of ${temperature}℃, humidity of ${humidity}%, wind speed of ${windSpeed} m/s, and wind bearing of ${bearingToString(windBearing)}.;
bot.say(sendTo, message);
});
});
});
}

module.exports = {
register: (bot) => {
_bot = bot;
bot.addCommand("weather", weather);
}
};

