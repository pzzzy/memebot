"use strict";
const config = require('./config');
const IRC = require('irc');
const winston = require('winston');
const util = require('util');

var d = require('domain').create();
var bot;

d.on('error', (e) => winston.error(util.inspect(e)));

const commands = new Map();
const BOT_TRIGGER_RE = new RegExp(`^${config.botName}[:\s]+(.*)`);

const URLSummarizer = require('./modules/urlSummary');
const Weather = require('./modules/weather');
const LinkLog = require('./modules/linkLog');
commands.set( 'weather', Weather.exec );

function handleCommand(from, to, text, message) {
  const matches = message.args[1].match(BOT_TRIGGER_RE);

  if (matches) {
    const parts = matches[1].trim().split(/\s+/);
    const key = parts[0].toLowerCase();
    if (commands.has(key)) {
      commands.get(key)(bot, parts, from, to);
      return true;
    }
  }
  return false;
}

function start() {
  bot = new IRC.Client(config.server, config.botName, {
    channels: config.channels,
    debug: true
  });

  bot.addListener("message", (from, to, text, message) => {
    d.run(() => {
      if (handleCommand(from, to, text, message)) {
        return;
      }
    });
  });

  bot.addListener("error", (message) => winston.error(message))

  bot.addListener("registered", () => {
    if(config.password) {
      bot.say("NickServ", "IDENTIFY " + config.password);
    }
  })

  URLSummarizer.setup(bot);
  LinkLog.setup(bot);
}

start();
