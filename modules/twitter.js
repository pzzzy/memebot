const winston = require("winston");
const moment = require("moment");
const { apiKey, apiSecretKey, accessToken, accessTokenSecret } = require("../secrets").twitter;
const Twitter = require('twitter-lite');

const URL = require("url");
const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i;

const client = new Twitter({
  consumer_key: apiKey,
  consumer_secret: apiSecretKey,
  access_token_key: accessToken,
  access_token_secret: accessTokenSecret
});

function parseTweet(bot, channel, tweet) {
  const created_at = moment(tweet.created_at, 'ddd MMM D HH:mm:ss ZZ YYYY');
  let text = tweet.full_text || tweet.text;
  let media_text = ""

  //const metrics = ` 💬 ${rpt}, ↻ ${retweet_count}, ♥ ${favorite_count}`
  const metrics = ` ↻ ${tweet.retweet_count}, ♥ ${tweet.favorite_count}`
  const verified = tweet.user.verified ? " ✔" : "";
  if (tweet.entities.hasOwnProperty('media')) {
    tweet.entities.media.map((media) => {
      switch (media.type) {
        case 'photo':
          if (media_text.length > 0) {
            media_text += ' ';
          }
          if (media.expanded_url.match(/\/photo\//)) {
            if (media.sizes.hasOwnProperty('large')) {
              media_text += `Photo: ${media.media_url_https}:large`;
            } else if (media.sizes.hasOwnProperty('medium')) {
              media_text += `Photo: ${media.media_url_https}:medium`;
            } else if (media.sizes.hasOwnProperty('small')) {
              media_text += `Photo: ${media.media_url_https}:small`;
            } else if (media.sizes.hasOwnProperty('thumb')) {
              media_text += `Photo: ${media.media_url_https}:thumb`;
            } else {
              media_text += `Photo: ${media.expanded_url}`;
            }
          } else {
            media_text += `Video: ${media.expanded_url}`;
          }
          
          break;
        default:
          console.log(media);
          winston.error('Unhandled media type ' + media.type);
          break;
      }
    });
  }

  if (media_text.length > 0) {
    text += ` (${media_text})`;
  }
  const botResponse = `TWEET: ${text} — ${tweet.user.name} (@${tweet.user.screen_name}${verified}${metrics}) ${created_at.fromNow()}`;
  winston.debug(`Tweet Response: ${botResponse}`);
  bot.say(channel, `${botResponse.replace(/(\r\n|\n|\r)/g, " ")}`);
}

function parseURL(bot, user, channel, url) {
  if (channel[0] != "#") {
    return;
  }

  const parsed = URL.parse(url, true);
  if (!parsed.host.match(/twitter\.com$/)) {
    return;
  }
  const matched = parsed.path.match(/(?:#!\/)?\w+\/status(?:es)?\/(\d+)/);
  if (matched === null || matched.length !== 2) {
    return;
  }
  const tweet_id = matched[1];

  winston.debug(`Fetching tweet ${url}, id: ${tweet_id}`);
  client
    .get("statuses/show", {
      id: tweet_id,
      include_entities: true,
      tweet_mode: 'extended'
    })
    .then(results => {
      parseTweet(bot, channel, results);
    })
    .catch(console.error);  
}

function parseMessage(bot, from, to, text) {
  if (text.match(/\b(NOBOT|linkcheck)\b/i)) {
    return;
  }
  const matches = text.match(URL_RE);
  if (matches) {
    parseURL(bot, from, to, matches[0]);
  }
}

function setup(bot, commands) {
  bot.addListener("message", (from, to, text) => {
    parseMessage(bot, from, to, text);
  });
}

module.exports = {
  setup: setup,
  parseMessage: parseMessage
};
