// File: spamBot.js

let bot;

function generateAntiSpam() {
    return `[${Math.random().toString(36).substring(2, 7)}]`;
}
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const advertisementMessages = [
    "Looking for an adventure? Head over to the world border /tpa kingdom_warrior",
    "Discover what lies beyond the horizon. Type /tpa kingdom_warrior and see the world border up close!",
    "Ever wondered what's at the edge of the map? Experience it at the world border with /tpa kingdom_warrior.",
    "Use /tpa kingdom_warrior to reach the world border!",
    "Teleport to the world border now by using /tpa kingdom_warrior.",
    "Want a teleport far out? just /tpa kingdom_warrior for world border"
];

function sendAdvertisement() {
    const randomIndex = Math.floor(Math.random() * advertisementMessages.length);
    const message = `${advertisementMessages[randomIndex]} ${generateAntiSpam()}`;
    bot.chat(message);
}

async function initialize(newBot) {
    bot = newBot;
    await wait(3000);
    // Send the first message immediately.
    sendAdvertisement();

    // Schedule the advertisement to repeat every 5 minutes.
    setInterval(sendAdvertisement, 30 * 60 * 1000);
}

module.exports = { initialize };
