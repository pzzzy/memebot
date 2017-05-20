"use strict";
const config = require('./config');
const IRC = require('irc');
const fs = require('fs');
const request = require('request');
const commands = {channel: new Map(), pm: new Map(), raw: new Map()}
const cheerio = require("cheerio");
const URL = require('url');

var bot;

const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i

function handleBody(from, url, response) {
  const $ = cheerio.load(response.body);
  let str = "";
  if (url.host.match("twitter.com")) {
    const handle = ($("meta[property='og:url']").attr("content") || "").split("/")[3] || "unknown";
    const tweet = $("meta[property='og:description']").attr("content").replace(/\n/, " ").replace(/^“|”$/g, "");
    const author = ($("meta[property='og:title']").attr("content") || "").replace(" on Twitter", "");
    const tweetContainer = $("div.tweet.permalink-tweet");
    let date = "";
    let verified = "";
    if (tweetContainer.length > 0) {
      date = tweetContainer.find("a.tweet-timestamp span.u-hiddenVisually").text();
      verified = tweetContainer.find("span.Icon--verified").length > 0 ? " ✔" : "";
    }
    str = `TWEET: ${tweet} -- ${author} (@${handle}${verified}) ${date}`;
  } else {
    str = $("head title").text();
  }
  if (str && str != "") {
    bot.say(from, str);
  }
}

function parseURL(from, url) {
  const parsed = URL.parse(url);
  request(parsed.href, (err, response) => {
    if(err) {
      return console.log(err);
    }
    handleBody(from, parsed, response);
  });
}

function start() {
  bot = new IRC.Client(config.server, config.botName, {
    channels: config.channels,
    debug: true
  });

  bot.addListener("message", function(from, to, text, message) {
    let msg = message.args[1];
    const matches = msg.match(URL_RE);
    if (matches) {
      parseURL(to, matches[0]);
    }
  });

  bot.addListener("error", function(message) {
    console.log(message)
  })

  bot.addListener("registered", function() {
    if(config.password) {
      bot.say("NickServ", "IDENTIFY " + config.password);
    }
  })
}

start();
