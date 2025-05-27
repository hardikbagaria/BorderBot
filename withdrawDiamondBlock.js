// withdrawDiamondBlock.js

const { GoalNear } = require('mineflayer-pathfinder').goals;
const { Movements, pathfinder } = require('mineflayer-pathfinder');

let lastKillTime = 0;

async function withdrawDiamondBlock(bot, mcData) {
  bot.loadPlugin(pathfinder);

  const movements = new Movements(bot, mcData);
  movements.allow1by1towers = false;
  movements.canDig = false;
  movements.canPlace = false;
  movements.allowParkour = true;
  movements.allowSprinting = true;
  bot.pathfinder.setMovements(movements);

  const enderChestId = mcData.blocksByName.ender_chest.id;
  const airId = mcData.blocksByName.air.id;
  const diamondBlockName = 'diamond_block';

  while (true) {
    const chests = bot.findBlocks({
      matching: enderChestId,
      maxDistance: 32,
      count: 10,
    });

    let reachableChest = null;

    for (const pos of chests) {
      const blockAbove = bot.blockAt(pos.offset(0, 1, 0));
      if (!blockAbove || blockAbove.type !== airId) continue;

      const goal = new GoalNear(pos.x, pos.y, pos.z, 3);
      const path = bot.pathfinder.getPathTo(movements, goal);
      console.log(`Path status to ${pos}:`, path.status);

      if (path && path.status === 'success') {
        reachableChest = bot.blockAt(pos);
        break;
      }
    }

    if (!reachableChest) {
      const now = Date.now();
      if (now - lastKillTime >= 60000) {
        console.log("No reachable chest found. Executing /kill...");
        bot.chat("/kill");
        lastKillTime = now;

        await once(bot, 'respawn');
        await wait(2000); // wait for a couple seconds before retrying
        continue;
      } else {
        const waitTime = 60000 - (now - lastKillTime);
        console.log(`Waiting ${Math.ceil(waitTime / 1000)}s before trying /kill again...`);
        await wait(waitTime);
        continue;
      }
    }

    const pos = reachableChest.position;
    console.log(`Moving to usable Ender Chest at ${pos}`);
    bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 3));
    await once(bot, 'goal_reached');

    try {
      const chestWindow = await bot.openChest(reachableChest);
      const item = chestWindow.containerItems().find(i => i.name === diamondBlockName);

      if (!item) {
        console.log("No diamond block in your Ender Chest.");
        chestWindow.close();
        return;
      }

      await chestWindow.withdraw(item.type, null, 1);
      console.log("Withdrew 1x Diamond Block!");
      chestWindow.close();
      return;
    } catch (err) {
      console.log("Failed to withdraw: " + err.message);
      return;
    }
  }
}

// Utility: wait for an event once
function once(bot, eventName) {
  return new Promise(resolve => bot.once(eventName, resolve));
}

// Utility: pause for ms milliseconds
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = withdrawDiamondBlock;
