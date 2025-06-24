const express = require('express');
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { Movements, goals } = require('mineflayer-pathfinder');
const path = require("path");

const app = express();
let bot;
let botStatus = 'offline';
let targetPlayer = null;

app.use(express.static("public"));
app.use(express.json());

app.post('/start', (req, res) => {
  const { host, username } = req.body;

  if (botStatus === 'online') {
    return res.status(400).json({ message: 'Bot is already online' });
  }

  bot = mineflayer.createBot({
    host: host.split(":")[0], 
    port: host.split(":")[1], 
    username: username 
  });

  bot.loadPlugin(pathfinder); // Enable pathfinding

  bot.once('spawn', () => {
    botStatus = 'online';
    res.json({ message: 'Bot started successfully' });

    // Make the bot jump continuously
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);
    }, 500);

    // Listen to chat for setting the target player
    bot.on('chat', (username, message) => {
      if (message.startsWith("hunt ")) {
        targetPlayer = message.split(" ")[1];
        bot.chat(`Target set to: ${targetPlayer}. Hunting... 😈`);
        startHunting();
      }
    });
  });

  bot.on('end', () => { botStatus = 'offline'; });
  bot.on('error', () => { botStatus = 'offline'; });
});

function startHunting() {
  if (!targetPlayer) return;
  
  const targetEntity = bot.players[targetPlayer]?.entity;
  if (!targetEntity) {
    bot.chat(`Cannot find player: ${targetPlayer}`);
    return;
  }

  const mcData = require('minecraft-data')(bot.version);
  const movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
  
  const goal = new goals.GoalFollow(targetEntity, 1);
  bot.pathfinder.setGoal(goal);

  setInterval(() => {
    if (targetEntity && bot.entity.position.distanceTo(targetEntity.position) < 3) {
      bot.attack(targetEntity);
    }
  }, 1000);
}

app.post('/stop', (req, res) => {
  if (botStatus === 'offline') {
    return res.status(400).json({ message: 'Bot is already offline' });
  }

  bot.quit();
  botStatus = 'offline';
  res.json({ message: 'Bot stopped successfully' });
});

app.get('/status', (req, res) => {
  res.json({ status: botStatus });
});

app.get("/", (req, res)=>{
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const port = 3000;
app.listen(port, () => {
  console.log(`Bot server running on port ${port}`);
});