const request = require('request');
const winston = require('winston');
const { ClientCredentials } = require("simple-oauth2");

const { blizzard } = require('../secrets')
const CREDENTIALS = {
  client: blizzard,
  auth: {
    tokenHost: "https://us.battle.net"
  }
};

let _bot = null;

function wowtoken(bot, _words, from, to) {
  const sendTo = to == _bot.nick ? from : to

  const oauthClient = new ClientCredentials(CREDENTIALS);

  oauthClient.getToken()
    .then(oauthToken => {
      const apiUrl = `https://us.api.blizzard.com/data/wow/token/index?namespace=dynamic-us&locale=en_US&access_token=${oauthToken.token.access_token}`
      request.get(apiUrl, (error, response, body) => {
      if (error) {
        winston.error('Error fetching WoWToken price', error);
      } else {
        const price = JSON.parse(body).price / 10000
        const formattedPrice = new Intl.NumberFormat().format(price) + "g"
        bot.say(sendTo, `Current US WoWToken price: ${formattedPrice}`)
      }
    })
    })
    .catch(err => {
      winston.error('Error getting oauthToken', err);
    });
}

function setup(bot, commands) {
  _bot = bot
  commands.set('wowtoken', wowtoken)
}

module.exports = {
  setup: setup,
  wowtoken: wowtoken
}
