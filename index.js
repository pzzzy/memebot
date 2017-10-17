"use strict";
const config = require("./config");
const IRC = require("irc");
const winston = require("winston");
const util = require("util");

var d = require("domain").create();
var bot;

d.on("error", e => winston.error(util.inspect(e)));

const commands = new Map();
let BOT_TRIGGER_RE = null;

function handleCommand(from, to, text, message) {
  let isMatch = false;
  let rest = null;

  if (to.trim() === bot.nick.trim()) {
    isMatch = true;
    rest = message.args[1];
  } else {
    const matches = message.args[1].match(BOT_TRIGGER_RE);
    if (matches) {
      isMatch = true;
      rest = matches[1];
    }
  }

  if (isMatch) {
    const parts = rest.trim().split(/\s+/);
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
    retryDelay: 10000,
    debug: true
  });

  setInterval(() => {
    if (bot.nick.trim() !== config.botName.trim()) {
      winston.info("renaming:", bot.nick, "!=", config.botName);
      bot.send("NICK", config.botName);
    }
  }, 10000);

  bot.addListener("message", (from, to, text, message) => {
    d.run(() => {
      if (handleCommand(from, to, text, message)) {
        return;
      }
    });
  });

  bot.addListener("error", message => winston.error(message));

  bot.addListener("registered", () => {
    BOT_TRIGGER_RE = new RegExp(`^${bot.nick}[: ]+(.*)`);

    if (config.password) {
      bot.say("NickServ", "IDENTIFY " + config.password);
    }
  });

  var normalizedPath = require("path").join(__dirname, "modules");
  require("fs")
    .readdirSync(normalizedPath)
    .forEach(function(file) {
      if (file.match(/\.js$/)) {
        console.log( "Loading module " + file );
        let module = require("./modules/" + file);
        if (module.setup) {
          module.setup(bot, commands);
        }
      }
    });
}

start();
