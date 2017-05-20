const forecast = require('forecast');
const request = require('request');
const { escape } = require('querystring');
const { darkSkyAPIKey } = require('../secrets');
const winston = require('winston');
const util = require('util')

const emojiMap = {
  "clear-day": "☀️",
  "clear-night": "🌙",
  "rain": "🌦️",
  "snow": "❄️",
  "wind": "💨",
  "fog": "🌫️",
  "cloudy": "☁️",
  "partly-cloudy-day": "⛅",
  "partly-cloudy-night": "⛅",
}

const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function bearingToString(windBearing) {
  const index = Math.floor(((windBearing - 22.5) / 360) * 8);
  return BEARINGS[index % 8];
}

function weather(bot, words, from, to) {
  let query = words.slice(1, words.length).join(" ");
  let url = `http://maps.googleapis.com/maps/api/geocode/json?address=${escape(query)}`;
  winston.info(url);
  request(url, (err, response) => {
    if (err) {
      winston.error(err);
      return;
    }
    const resp = JSON.parse(response.body);
    if (!resp.results[0]) {
      bot.say(to, `${from}: Sorry, I couldn't find that location`)
      return;
    }
    const location = resp.results[0].geometry.location;
    const lat = location.lat;
    const long = location.lng;
    const niceLocation = resp.results[0].formatted_address;

    url = `https://api.darksky.net/forecast/${darkSkyAPIKey}/${lat},${long}`
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
      bot.say(to, `${from}: ${emoji}${emoji ? " " : ""}${summary} in ${niceLocation} (${temp}F, wind ${bearingToString(bearing)} @ ${windSpeed}MPH, humidity ${Math.floor(weather.currently.humidity * 100)}%)`)
    });
  })
}

module.exports = {
  exec: weather
}
