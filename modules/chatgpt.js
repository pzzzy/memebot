const ChatGPTAPIBrowser = require('chatgpt').ChatGPTAPIBrowser;
const secrets = require('./secrets');

let api = null;

async function chatgpt(bot, words, from, to) {
  // Extract the message from the command
  const message = words.join(' ');

  // Send the message to ChatGPT and get the reply
  try {
    const result = await api.sendMessage(message);
    const reply = result.response;

    // Send the reply to the chat channel
    bot.say(to, reply);
  } catch (error) {
    // Print the error to the console
    console.error(`Error getting reply from ChatGPT: ${error}`);
  }
}

async function setup(bot, commands) {
  // Initialize ChatGPT
  api = new ChatGPTAPIBrowser({
    email: secrets.OPENAI_EMAIL,
    password: secrets.OPENAI_PASSWORD
  });
  await api.initSession();

  commands.set('chatgpt', chatgpt);
}

module.exports = {
  setup: setup
};
