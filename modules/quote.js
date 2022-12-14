const yahooFinance = require('yahoo-finance2').default
const util = require("util");

let _bot = null;

function quote(bot, _words, from, to) {
  const sendTo = to == _bot.nick ? from : to;

  yahooFinance.search(_words[1])
    .then(function(res) {
      let curr = res;
      yahooFinance.quote(curr.quotes[0].symbol).then(function(res) {
        currentPrice = Math.round(res.regularMarketPrice * 100) / 100;
        percentage = Math.round(res.regularMarketChangePercent * 100) / 100;
        change = Math.round(res.regularMarketChange * 100) / 100;

        bot.say(
          sendTo,
          `${res.longName}: \$${
            currentPrice
          }; Change since open: \$${change} (${percentage}%). 52-week range: \$${Math.round(res.fiftyTwoWeekRange.low * 100) / 100}-\$${Math.round(res.fiftyTwoWeekRange.high * 100) / 100}`
        );
      });
    })
    .catch(function(err) {
      bot.say(sendTo, "quote error " + err);
    });
}

function setup(bot, commands) {
  _bot = bot;
  commands.set("quote", quote);
}

module.exports = {
  setup: setup
};
