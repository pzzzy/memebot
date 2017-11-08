const request = require("request");
const cheerio = require("cheerio");
const winston = require("winston");

let _bot = null;

function wotd(bot, _words, from, to) {
  request("https://www.merriam-webster.com/word-of-the-day", function(
    error,
    response,
    body
  ) {
    const sendTo = to == _bot.nick ? from : to;

    if (!body) {
      bot.say(sendTo, "wotd error: " + error);
      return;
    }

    let $ = cheerio.load(body);
    let word = $(".word-and-pronunciation H1")
      .text()
      .trim();

    let definitions = [];
    let definition_start = $(".wod-definition-container H2");
    while ((definition_start = definition_start.next())) {
      if (definition_start.get(0).tagName != "p") break;

      definitions.push(
        definition_start
          .eq(0)
          .text()
          .trim()
      );
    }

    let definition_string = definitions.join("  ");
    winston.info(`"Sending wotd to ${sendTo}`);

    bot.say(sendTo, `${word}: ${definition_string}`);
  });
}

function setup(bot, commands) {
  _bot = bot;
  commands.set("wotd", wotd);
}

module.exports = {
  setup: setup
};
