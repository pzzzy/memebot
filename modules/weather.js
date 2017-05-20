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
  let url = `http://www.datasciencetoolkit.org/maps/api/geocode/json?address=${escape(query)}`;
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
    url = `http://www.datasciencetoolkit.org/coordinates2politics/${escape(lat)},${escape(long)}`;
    winston.info(url);
    request(url, (err, response) => {
      if (err) {
        winston.error(err);
        return;
      }
      const political = JSON.parse(response.body)[0];
      const lookup = {};
      political.politics.forEach(e => lookup[e.friendly_type] = e);
      winston.log(util.inspect(lookup));

      let niceLocation = "(unknown)";
      if (lookup.city && lookup.state && lookup.country) {
        if (lookup.country.code == "usa") {
          niceLocation = `${lookup.city.name}, ${lookup.state.name}`;
        } else {
          niceLocation = `${lookup.city.name}, ${lookup.state.name} ${lookup.country.name}`;
        }
      } else if (lookup.city) {
        niceLocation = `${lookup.city.name}`;
      } else if (lookup.state && lookup.country) {
        niceLocation = `${lookup.state.name} ${lookup.country.name}`;
      } else if (lookup.country) {
        niceLocation = `${lookup.country.name}`;
      }

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
        bot.say(to, `${from}: ${emoji}${emoji ? " " : ""}${summary} in ${niceLocation} (${temp}F, wind ${bearingToString(bearing)} @ ${windSpeed}MPH)`)
      });
    })
  })
}

module.exports = {
  exec: weather
}
