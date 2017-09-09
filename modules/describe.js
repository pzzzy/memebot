const request = require("request");

let _bot = null;

function exec(bot, words, from, to) {
  let query = words.slice(1, words.length).join(" ");
  let url = `http://api.duckduckgo.com/?q=${escape(
    query
  )}&format=json&pretty=1&no_html=1&t=rememe&skip_disambig=1`;
  const sendTo = to == _bot.nick ? from : to;

  request(url, (err, response) => {
    const resp = JSON.parse(response.body);
    if (resp["AbstractText"] != "" && resp["AbstractURL"] != "") {
      let text = resp["AbstractText"]
        .replace(/\n/g, " ")
        .slice(0, 400 - resp["AbstractURL"].length);
      bot.say(sendTo, `${text} (${resp["AbstractURL"]})`);
    } else if (resp["AbstractURL"] != "") {
      bot.say(sendTo, `${resp["AbstractURL"]}`);
    } else {
      bot.say(sendTo, `Sorry, I couldn't find a description for "${query}"`);
    }
  });
}

function setup(bot, commands) {
  _bot = bot;
  commands.set("describe", exec);
  commands.set("ddg", exec);
}

module.exports = {
  setup: setup,
  exec: exec
};
