const request = require("request");
const cheerio = require("cheerio");
const URL = require("url");
const winston = require("winston");
const config = require("../config");
const Entities = require("html-entities").AllHtmlEntities;
const entities = new Entities();
const numeral = require("numeral");

const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=\(\),]*)/i;
const handlers = new Map();

const silence = () => (lastSilence = new Date().getTime());
const unsilence = () => (lastSilence = 0);
const isSilenced = () => {
  const now = new Date().getTime();
  return now - lastSilence < 3600 * 1000;
};

let _bot = null;

function padStr(str) {
  var pad = "00";
  return pad.substring(0, pad.length - str.length) + str;
}

function mungeURL(url) {
  let u = URL.parse(url);
  if (u.host == "mobile.twitter.com") {
    u.host = "twitter.com";
    u = URL.parse(URL.format(u));
  }
  return u;
}

handlers.set("twitter.com", $ => {
  const handle =
    ($("meta[property='og:url']").attr("content") || "").split("/")[3] ||
    "unknown";
  const author = ($("meta[property='og:title']").attr("content") || "")
    .replace(" on Twitter", "");
  const tweetContainer = $("div.tweet.permalink-tweet");
  let tweet = ($("meta[property='og:description']").attr("content") || "")
    .replace(/\n/g, " ")
    .replace(/^“|”$/g, "");
  if (tweet.length == 0) {
    return "";
  }
  let date = "";
  let verified = "";
  let image = "";
  let images = $("meta[property='og:image:user_generated']").length;
  let videos = $("meta[property='og:video:url']").length;

  let replies = tweetContainer.find(".ProfileTweet-action--reply .ProfileTweet-actionCount").data("tweet-stat-count");
  let retweets = tweetContainer.find(".ProfileTweet-action--retweet .ProfileTweet-actionCount").data("tweet-stat-count");
  let likes = tweetContainer.find(".ProfileTweet-action--favorite .ProfileTweet-actionCount").data("tweet-stat-count");

  let metrics = ""
  if (replies && likes && retweets) {
    const rpt = numeral(replies).format('0a')
    const rtt = numeral(retweets).format('0a')
    const lkt = numeral(likes).format('0a')
    metrics = ` 💬 ${rpt}, ↻ ${rtt}, ♥ ${lkt}`
  }

  if (tweetContainer.length > 0) {
    date = tweetContainer
      .find("a.tweet-timestamp span.u-hiddenVisually, span._timestamp")
      .last()
      .text();
    verified =
      tweetContainer.find(".permalink-header span.Icon--verified").length > 0
        ? " ✔"
        : "";
    const image = tweetContainer
      .find("div.AdaptiveMedia-photoContainer.js-adaptive-photo ")
      .attr("data-image-url");
    if (videos > 0) {
      let video = $("meta[property='og:video:url']").attr("content");
      tweet += ` (Video: ${video})`;
    } else if (images > 0) {
      let image = $("meta[property='og:image']").attr("content");
      tweet += ` (Image (1/${images}): ${image})`;
    }
  }
  return `TWEET: ${tweet} — ${author} (@${handle}${verified}${metrics}) ${date}`;
});
handlers.set("www.twitter.com", handlers.get("twitter.com"));

/*handlers.set("www.instagram.com", $ => {
  let desc = ($("meta[property='og:description']").attr("content") || "")
    .trim();
  if (desc.length > 0) {
    let bits = desc.split(" - ", 2);
    desc = bits[1];
    bits = desc
      .replace(" on Instagram:", ":")
      .replace(/[“”]/g, "")
      .split(":", 2);
    if (bits.length > 1) {
      return `${bits[1].trim()} — ${bits[0].trim()}`;
    } else {
      return bits[0];
    }
  }
}); */

handlers.set("www.youtube.com", $ => {
  let title = ($("meta[property='og:title']").attr("content") || "").trim();
  if (title.length == 0) {
    title = $("title")
      .text()
      .trim();
  }
  let duration = $("meta[itemprop=duration]").attr("content");
  if (duration) {
    let bits = duration.split(/(PT|M|S)/);
    let niceDuration = `${padStr(bits[2])}:${padStr(bits[4])}`;
    return `${title} (${niceDuration})`;
  } else {
    return title;
  }
});

handlers.set("default", $ => {
  let title = ($("meta[property='og:title']").attr("content") || "").trim();
  let desc = ($("meta[property='og:description']").attr("content") || "")
    .trim();
  if (title.length == 0) {
    title = ($("title").text() || "").trim();
  }
  if (desc.length > 0) {
    if (desc.length < 50 || true) {
      return `${title} - ${desc}`;
    } else {
      return desc;
    }
  } else if (title.length > 20) {
    return title;
  } else {
    winston.info("No good desc or title");
    winston.info("title", title);
    winston.info("desc", desc);
    return "";
  }
});

function handleBody(url, response) {
  const $ = cheerio.load(response.body);
  if (handlers.has(url.host)) {
    return handlers.get(url.host)($);
  } else {
    return handlers.get("default")($);
  }
}

function isBlacklisted(url) {
  return config.summaryBlacklist.some(regex => url.host.match(regex));
}

function parseURL(bot, channel, url) {
  const parsed = mungeURL(url);
  if (isBlacklisted(parsed)) {
    winston.info("Site is blacklisted, skipping");
    return;
  }

  winston.info("Fetch URL:", parsed.href);
  request(parsed.href, { method: "HEAD" }, (err, response) => {
    if (err) {
      winston.error(err);
      return;
    }
    const typeOK = (response.headers["content-type"] || "").match("text/html");
    const lengthOK =
      parseInt(response.headers["content-length"] || 0, 10) < 1048576;

    if (typeOK && lengthOK) {
      winston.info("length & info OK");
      request(parsed.href, (err, response) => {
        if (err) {
          winston.error(err);
          return;
        }

        let botResponse = entities.decode(handleBody(parsed, response));
        const shouldYield =
          isSilenced() &&
          config.urlSummarizer.yieldDomains.filter(d => d == parsed.host)
            .length > 0;
        if (shouldYield) {
          winston.info("Suppressing message, bot is yielding to another user");
          winston.info(botResponse);
        } else if (botResponse && botResponse.length > 0 && !shouldYield) {
          botResponse = botResponse.replace(/\n/g, " ").slice(0, 400);
          bot.say(channel, `${botResponse.replace(/\n/g, " ")}`);
        } else {
          winston.info("Got nothing to say!", botResponse);
        }
      });
    } else {
      winston.info(
        "Bad length or type",
        "type",
        response.headers["content-type"],
        "length",
        response.headers["content-length"]
      );
    }
  });
}

function parseMessage(bot, from, to, message) {
  let msg = message.args[1];
  const matches = msg.match(URL_RE);
  if (matches) {
    const sendTo = to == _bot.nick ? from : to;
    url = matches[0];
    url = url.replace(/[,\(\)]$/, "");
    parseURL(bot, sendTo, matches[0]);
  }
}

let lastSilence = 0;
function updateSilence(bot, user) {
  let now = new Date().getTime();
  if (config.urlSummarizer.yieldToOtherBots && config.urlSummarizer.otherBots) {
    config.urlSummarizer.otherBots.forEach(otherBot => {
      if (user == otherBot) {
        lastSilence = now;
        winston.info("Silencing the bot for an hour!");
        return;
      }
    });
  }
}

function setup(bot, commands) {
  _bot = bot;
  bot.addListener("message", (from, to, text, message) => {
    updateSilence(bot, from);
    parseMessage(bot, from, to, message);
  });

  bot.addListener("names", (channel, nicks) => {
    Object.keys(nicks).forEach(k => updateSilence(bot, k));
  });

  bot.addListener("join", (channel, nick, message) => {
    updateSilence(bot, nick);
  });

  bot.addListener("part", (channel, nick, message) => {
    updateSilence(bot, nick);
  });
}

module.exports = {
  setup: setup
};
