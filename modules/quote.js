const YahooStocks = require('yahoo-stocks');
const util = require('util');

let _bot = null;

function quote(bot, _words, from, to) {
	const sendTo = to == _bot.nick ? from : to;

	YahooStocks.lookup(_words[1]).then(function(res){
		let curr = res;
		YahooStocks.history(_words[1]).then(function(res){
			let old = res.previousClose;
			let change =  curr.currentPrice - old;
			let percentage = ( change / curr.currentPrice ) * 100;
				percentage = Math.round(percentage * 100) / 100;
				change = Math.round(change*100)/100;

			bot.say(sendTo, `${curr.name}: \$${curr.currentPrice}; Change since yesterday: \$${change} (${percentage}%)`);
		});
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

