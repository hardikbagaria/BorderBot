const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const spamBot = require('./spamBot'); // adjust path if needed
const withdrawDiamondBlock = require('./withdrawDiamondBlock');
const dbFile = path.join(__dirname, 'cooldowns.sqlite');
const db = new sqlite3.Database(dbFile);
const mcDataLoader = require('minecraft-data');

// Ensure table exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS cooldowns (
      username TEXT PRIMARY KEY,
      expiresAt INTEGER
    )
  `);
});

const skipCooldownUsers = ['Damix2131', 'Hardikmc', 'Abottomlesspit', 'Bermani', 'EchoVortex_', 'slay_dev','TheKingHastur'];


function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms)); 
}

function generateAntiSpam() {
  return `[${Math.random().toString(36).substring(2, 7)}]`;
}

function setCooldown(user, minutes = 15) {
  if (skipCooldownUsers.includes(user)) {
    console.log(`${user} is in skipCooldown list. Skipping cooldown.`);
    return;
  }

  const expiresAt = Date.now() + minutes * 60 * 1000;
  db.run(`
    INSERT OR REPLACE INTO cooldowns (username, expiresAt)
    VALUES (?, ?)
  `, [user, expiresAt]);
}

function isOnCooldown(user) {
  return new Promise(resolve => {
    if (skipCooldownUsers.includes(user)) return resolve(false);
    db.get(`SELECT expiresAt FROM cooldowns WHERE username = ?`, [user], (err, row) => {
      if (err) {
        console.error(err);
        return resolve(false);
      }
      if (!row) return resolve(false);
      resolve(Date.now() < row.expiresAt);
    });
  });
}

function chatHandler(bot) {
  spamBot.initialize(bot);
  const recentMessages = [];
  const teleportStates = {
    active: false,
    currentUser: null,
    timeout: null,
  };
  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString();
    if (recentMessages.length > 6) recentMessages.shift();
    recentMessages.push(msg);
  });

  function waitForMessageMatch(expected, tries = 5) {
    return new Promise(async (resolve) => {
      for (let i = 0; i < tries; i++) {
        await wait(1000);
        if (recentMessages.some(msg => msg.includes(expected))) return resolve(true);
      }
      resolve(false);
    });
  }

  async function handleTeleportRequest(user) {
    const onCooldown = await isOnCooldown(user);
    if (onCooldown) {
      console.log(`${user} is on cooldown. Ignoring teleport request.`);
      bot.chat(`/tpn ${user}`);
      return;
    }

    if (teleportStates.active) {
      console.log(`Currently handling ${teleportStates.currentUser}, ignoring ${user}`);
      bot.chat(`/tpn ${user}`);
      return;
    }
    teleportStates.active = true;
    teleportStates.currentUser = user;

    console.log(`New teleport request from ${user}`);
    bot.chat(`/w ${user} hey please reply with a border 0+,0-,+0,-0,++,+-,-+ for e.g. /r ++ ${generateAntiSpam()}`);

    teleportStates.timeout = setTimeout(() => {
      console.log(`Teleport timeout for ${user}`);
      setCooldown(user);
      teleportStates.active = false;
      teleportStates.currentUser = null;
    }, 120000);
  }

  bot.on('whisper', async (username, message) => {
    if (username !== teleportStates.currentUser) return;
    const borderOptions = ['0+', '0-', '+0', '-0', '++', '+-', '-+'];
    if (!borderOptions.includes(message.trim())) return;

    clearTimeout(teleportStates.timeout);
    const border = message.trim();
    console.log(`Received valid border "${border}" from ${username}`);
    const mcData = mcDataLoader(bot.version);
    await withdrawDiamondBlock(bot, mcData);
    bot.chat(`/home ${border}`);
    const homeConfirmed = await waitForMessageMatch(`Teleporting to ${border} in 15 seconds.`);
    if (!homeConfirmed) bot.chat(`/home ${border}`);

    await wait(3000);
    const tryTpy = async () => {
      bot.chat(`/tpy ${username}`);
      console.log(`Trying to accept TP from ${username}`);
      const accepted = await waitForMessageMatch(`Request from ${username} accepted!`);
      if (!accepted) {
        const noRequest = recentMessages.some(msg => msg.includes(`There is no request to accept from ${username}!`));
        if (noRequest) {
          console.warn(`BUG: No teleport request to accept from ${username}`);
          return;
        }
        await tryTpy();
      }
    };

    await tryTpy();

    const listener = async (jsonMsg) => {
      const msg = jsonMsg.toString();
      if (msg.includes(`${username} teleported to you!`)) {
        bot.removeListener('message', listener);
        console.log(`${username} has successfully teleported.`);
        setCooldown(username);
        teleportStates.active = false;
        teleportStates.currentUser = null;
      } else if (msg.includes('Teleport failed!')) {
        bot.removeListener('message', listener);
        console.warn(`Teleport failed for ${username}, handling as timeout.`);
        setCooldown(username);
        teleportStates.active = false;
        teleportStates.currentUser = null;
      }
    };
    bot.on('message', listener);
  });

  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString();
    const match = msg.match(/(\w+) wants to teleport to you\./);
    if (match) {
      const username = match[1];
      console.log(`Detected teleport request from ${username}`);
      await handleTeleportRequest(username);
    } else if (teleportStates.active && teleportStates.currentUser) {
      if (msg.includes(`Your teleport request from ${teleportStates.currentUser} timed out.`)) {
        console.log(`Teleport request from ${teleportStates.currentUser} timed out by server.`);
        setCooldown(teleportStates.currentUser);
        teleportStates.active = false;
        teleportStates.currentUser = null;
      }
    }
  });
}

module.exports = { initialize: chatHandler };
