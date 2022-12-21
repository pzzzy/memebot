const request = require("request");
const { escape } = require("querystring");
const { weatherAPIKey } = require("../secrets");
const sqlite3 = require("sqlite3").verbose();
const winston = require("winston");

const db = new sqlite3.Database("weather.db");

let _bot = null;

function getWeatherLocation(words, channel, nick, cb) {
  let location = words.slice(1, words.length).join(" ");

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
          cb(null);
        }
      }
    );
  } else {
    db.run(
      "INSERT OR REPLACE INTO weather (channel, nick, location) VALUES (?, ?, ?)",
      [channel, nick, location],
      err => {
        if (err) {
          winston.error("Error querying weather", err);
        }
        cb(location);
      }
    );
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

      winston.info(`Resolved ${query} => ${lat},${long}`);

      const weatherURL = `http://api.weatherapi.com/v1/forecast.json?key=${weatherAPIKey}&q=${lat},${long}&days=1&aqi=no&alerts=no`;

      request(weatherURL, options, (err, response) => {
        if (err) {
          winston.error(err);
          return;
        }
        const weatherData = JSON.parse(response.body);

        // extract the current weather conditions
        const currentWeather = weatherData.current;
        const currentTempF = currentWeather.temp_f;
        const currentConditionText = currentWeather.condition.text;
        const currentWindMph = currentWeather.wind_mph;
        const currentWindDir = currentWeather.wind_dir;
        const currentHumidity = currentWeather.humidity;

        // extract the forecast conditions
        const forecastWeather = weatherData.forecast.forecastday[0].day;
        const forecastConditionText = forecastWeather.condition.text;
        const forecastMinTempF = forecastWeather.mintemp_f;
        const forecastMaxTempF = forecastWeather.maxtemp_f;
        const forecastPrecipMm = forecastWeather.totalprecip_mm;
        const forecastPrecipIn = forecastWeather.totalprecip_in;

        // format the weather summary
        const weatherSummary = `Weather for ${niceLocation}: ${currentTempF}°F (${currentConditionText}), wind ${currentWindMph} mph ${currentWindDir}, humidity ${currentHumidity}%. Forecast for tomorrow: ${forecastMinTempF}-${forecastMaxTempF}°F (${forecastConditionText}), precip ${forecastPrecipMm} mm/${forecastPrecipIn} in.`;

        // print the weather summary to the channel
        bot.say(sendTo, weatherSummary);
      });
    });
  });
}

module.exports = function(bot) {
  _bot = bot;
  return { weather };
};
