const express = require("express");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
let bot = null;
let botStatus = "offline";
let manualStop = false;
let reconnectTimeout = null;

let savedHost = null;
let savedPort = null;
let savedUsername = null;

app.use(express.static("public"));
app.use(express.json());

function log(m) {
    console.log(m);
}

function createBot() {
    manualStop = false;

    bot = mineflayer.createBot({
        host: savedHost,
        port: parseInt(savedPort),
        username: savedUsername,
        version: "1.21.6"
    });

    bot.once("spawn", () => {
        if (!bot.player || !bot.player.entity) {
            log("Fake spawn detected — not in real world. Quitting.");
            bot.quit();
            botStatus = "offline";
            return;
        }

        botStatus = "online";
        log("Bot spawned and online");
        log("Bot position: " + bot.entity.position);
    });

    bot.on("end", onBotEnd);
    bot.on("error", onBotError);
}

function onBotEnd() {
    log("Bot 'end' event");
    if (manualStop) {
        log("Manual stop — no reconnect");
        return;
    }
    botStatus = "offline";
    scheduleReconnect();
}

function onBotError(err) {
    log("Bot 'error' event: " + err.message);
    if (manualStop) {
        log("Manual stop — no reconnect");
        return;
    }
    botStatus = "offline";
    scheduleReconnect();
}

function scheduleReconnect() {
    if (manualStop) return;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);

    log("Reconnect in 5 seconds...");
    reconnectTimeout = setTimeout(() => {
        if (botStatus === "offline" && !manualStop) {
            log("Reconnecting now...");
            createBot();
        }
    }, 5000);
}

app.post("/start", (req, res) => {
    if (botStatus === "online")
        return res.status(400).json({ msg: "Bot already online" });

    const { host, username } = req.body;
    if (!host || !username)
        return res.status(400).json({ msg: "Host and username required" });

    [savedHost, savedPort] = host.split(":");
    savedUsername = username;

    createBot();
    res.json({ msg: "Bot starting" });
});

app.post("/stop", (req, res) => {
    if (botStatus === "offline")
        return res.status(400).json({ msg: "Bot already offline" });

    manualStop = true;

    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (bot) {
        bot.removeAllListeners("end");
        bot.removeAllListeners("error");
        try {
            bot.quit();
        } catch (e) {
            log("Error quitting bot: " + e.message);
        }
        bot = null;
    }

    botStatus = "offline";
    log("Bot stopped manually. Reconnect blocked.");
    res.json({ msg: "Bot stopped" });
});

app.get("/status", (req, res) => res.json({ status: botStatus }));

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public/index.html"))
);

app.listen(2000, () => log("Server running on port 2000"));
