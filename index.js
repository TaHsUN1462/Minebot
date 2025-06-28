const express = require("express");
const mineflayer = require("mineflayer");
const path = require("path");
const fs = require("fs");

const app = express();

let bot = null;
let botStatus = "offline";
let manualStop = false;
let reconnectTimeout = null;
let movementInterval = null;
let chatTimeout = null;

let savedHost = null;
let savedPort = null;
let savedUsername = null;

const LOG_FILE = "logs.txt";
let logs = [];

if (fs.existsSync(LOG_FILE)) {
    logs = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
}

app.use(express.static("public"));
app.use(express.json());

function log(m) {
    const time = new Date().toISOString().slice(11, 19);
    const entry = `[${time}] ${m}`;
    logs.push(entry);
    if (logs.length > 300) logs.shift();
    console.log(entry);
    fs.appendFileSync(LOG_FILE, entry + "\n");
}

app.get("/logs", (req, res) => {
    res.json({ logs });
});

function cleanup() {
    clearInterval(movementInterval);
    clearTimeout(chatTimeout);
    movementInterval = null;
    chatTimeout = null;
}

function createBot() {
    manualStop = false;
    log(
        `Creating bot with username: ${savedUsername} on ${savedHost}:${savedPort}`
    );

    bot = mineflayer.createBot({
        host: savedHost,
        port: parseInt(savedPort),
        username: savedUsername,
        version: "1.21.6"
    });

    bot._client.removeAllListeners("entity_passengers");

    bot.on("login", () => log("Bot logged in"));
    bot.once("spawn", () => {
        if (!bot.player || !bot.player.entity) {
            log("Fake spawn detected — quitting.");
            bot.quit();
            botStatus = "offline";
            return;
        }

        botStatus = "online";
        log("Bot spawned and online at " + bot.entity.position);

        bot.setControlState("forward", true);
        bot.setControlState("sprint", true);

        movementInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            const yaw = Math.random() * Math.PI * 2;
            const pitch = (Math.random() - 0.5) * 0.4;
            bot.look(yaw, pitch, true);
            if (Math.random() < 0.15) {
                bot.setControlState("jump", true);
                setTimeout(() => {
                    if (bot) bot.setControlState("jump", false);
                }, 200);
            }
            if (Math.random() < 0.1) {
                bot.setControlState("sneak", true);
                setTimeout(
                    () => {
                        if (bot) bot.setControlState("sneak", false);
                    },
                    500 + Math.random() * 1000
                );
            }
        }, 2000);

        const messages = [
            "hey",
            "yo",
            "bruh lag",
            "gg",
            "anyone alive?",
            "sup"
        ];
        const delay = () => (60 + Math.random() * 10) * 1000;
        const chatLoop = () => {
            if (bot) {
                const msg =
                    messages[Math.floor(Math.random() * messages.length)];
                log("Chatting: " + msg);
                bot.chat(msg);
            }
            chatTimeout = setTimeout(chatLoop, delay());
        };
        chatTimeout = setTimeout(chatLoop, delay());
    });

    bot.on("kicked", reason => {
        log(`Kicked from server. Reason: ${reason?.toString() || "unknown"}`);
        if (reason && reason.toString().toLowerCase().includes("ban"))
            manualStop = true;
    });

    bot.on("end", () => {
        log("Bot 'end' event");
        cleanup();
        if (manualStop) {
            log("Manual stop — no reconnect");
            return;
        }
        botStatus = "offline";
        scheduleReconnect();
    });

    bot.on("error", err => {
        log("Bot 'error' event: " + err.message);
        cleanup();
        if (manualStop) {
            log("Manual stop — no reconnect");
            return;
        }
        botStatus = "offline";
        scheduleReconnect();
    });

    bot.on("death", () => log("Bot died"));
    bot.on("respawn", () => log("Bot respawned"));

    bot.on("chat", (username, message) => {
        if (username === savedUsername) return;
        log(`Chat message from ${username}: ${message}`);
    });

    bot.on("playerCollect", (collector, itemDrop) => {
        if (collector.username === savedUsername) {
            log(`Bot collected ${itemDrop.name || itemDrop.displayName}`);
        }
    });

    log("Bot setup complete");
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
    if (botStatus === "online" || botStatus === "connecting")
        return res.status(400).json({ msg: "Bot already online" });

    const { host, username } = req.body;
    if (!host || !username)
        return res.status(400).json({ msg: "Host and username required" });

    [savedHost, savedPort] = host.split(":");
    savedPort = savedPort || "25565";
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

    cleanup();

    if (bot) {
        bot.removeAllListeners();
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

app.post("/command", (req, res) => {
    if (botStatus !== "online")
        return res.status(400).json({ msg: "Bot offline" });

    const { command } = req.body;
    if (!command || typeof command !== "string")
        return res.status(400).json({ msg: "Command is required" });

    try {
        bot.chat(`${command}`);
        log(`Chatted: ${command}`);
        res.json({ msg: `Chatted: ${command}` });
    } catch (e) {
        res.status(500).json({
            msg: "Failed to execute command",
            error: e.message
        });
    }
});

app.get("/status", (req, res) => {
    res.json({ status: botStatus });
});

app.get("/logs", (req, res) => {
    res.json({ logs });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
    console.log(`Server Running ${PORT}`);
});
