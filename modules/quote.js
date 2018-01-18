const YahooStocks = require('yahoo-stocks');

let _bot = null;

function quote(bot, _words, from, to) {
	const sendTo = to == _bot.nick ? from : to;

	YahooStocks.lookup(_words[1]).then(function(res){
		bot.say(sendTo, `${res.name}: \$${res.currentPrice}`);
	}).catch(function(err) {
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

