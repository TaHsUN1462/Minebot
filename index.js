const express = require("express");
const mineflayer = require("mineflayer");
const path = require("path");
const fs = require("fs");

const app = express();

let bot = null;
let botStatus = "offline";
let manualStop = false;
let reconnectTimeout = null;
let clickInterval = null;

let savedHost = null;
let savedPort = null;
let savedUsername = null;

const LOG_FILE = "logs.txt";
let logs = [];

if (fs.existsSync(LOG_FILE)) {
    try {
        logs = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
    } catch {
        logs = [];
    }
}

app.use(express.static("public"));
app.use(express.json());

function log(m) {
    try {
        const time = new Date().toISOString().slice(11, 19);
        const entry = `[${time}] ${m}`;
        logs.push(entry);
        if (logs.length > 300) logs.shift();
        console.log(entry);
        fs.appendFile(LOG_FILE, entry + "\n", () => {});
    } catch {}
}

function createBot() {
    manualStop = false;
    log(`Creating bot with username: ${savedUsername} on ${savedHost}:${savedPort}`);

    try {
        bot = mineflayer.createBot({
            host: savedHost,
            port: parseInt(savedPort),
            username: savedUsername,
            version: "1.20.6"
        });
    } catch (e) {
        log("Bot creation failed: " + e.message);
        botStatus = "offline";
        return;
    }

    bot.on("login", () => log("Bot logged in"));

    bot.once("spawn", () => {
        if (!bot?.entity || !bot?.entity?.position) {
            log("Invalid spawn — bot quitting.");
            try { bot.quit(); } catch {}
            botStatus = "offline";
            return;
        }

        botStatus = "online";
        log("Bot spawned at " + bot.entity.position);

        bot.on("chat", (username, message) => {
            if (username === bot.username) return;
            log(`<${username}> ${message}`);
        });

        if (clickInterval) clearInterval(clickInterval);
        clickInterval = setInterval(() => {
            if (!bot?.entity) return;
            try {
                bot.activateItem();
                setTimeout(() => bot.deactivateItem(), 100);
            } catch {}
        }, 1000);
    });

    bot.on("kicked", reason => {
        try {
            const readable = JSON.stringify(reason);
            log("Kicked from server. Reason: " + readable);
            if (readable.toLowerCase().includes("ban")) manualStop = true;
        } catch {}
    });

    bot.on("end", () => {
        log("Bot 'end' event");
        if (clickInterval) {
            clearInterval(clickInterval);
            clickInterval = null;
        }
        if (manualStop) {
            log("Manual stop — no reconnect");
            return;
        }
        botStatus = "offline";
        scheduleReconnect();
    });

    bot.on("error", err => {
        log("Bot 'error' event: " + err.message);
        if (clickInterval) {
            clearInterval(clickInterval);
            clickInterval = null;
        }
        if (manualStop) {
            log("Manual stop — no reconnect");
            return;
        }
        botStatus = "offline";
        scheduleReconnect();
    });

    bot.on("death", () => log("Bot died"));
    bot.on("respawn", () => log("Bot respawned"));

    log("Bot setup complete");
}

function scheduleReconnect() {
    if (manualStop) return;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    log("Reconnect in 10 seconds...");
    reconnectTimeout = setTimeout(() => {
        if (botStatus === "offline" && !manualStop) {
            log("Reconnecting now...");
            createBot();
        }
    }, 10000);
}

app.post("/start", (req, res) => {
    if (botStatus === "online") return res.status(400).json({ msg: "Bot already online" });

    const { host, username } = req.body;
    if (!host || !username) return res.status(400).json({ msg: "Host and username required" });

    [savedHost, savedPort] = host.split(":");
    savedPort = savedPort || "25565";
    savedUsername = username;

    try {
        createBot();
        res.json({ msg: "Bot starting" });
    } catch (e) {
        log("Start route error: " + e.message);
        res.status(500).json({ msg: "Start failed", error: e.message });
    }
});

app.post("/stop", (req, res) => {
    if (botStatus === "offline") return res.status(400).json({ msg: "Bot already offline" });

    manualStop = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = null;

    if (clickInterval) {
        clearInterval(clickInterval);
        clickInterval = null;
    }

    try {
        if (bot) {
            bot.removeAllListeners();
            bot.quit();
            bot = null;
        }
    } catch (e) {
        log("Error quitting bot: " + e.message);
    }

    botStatus = "offline";
    log("Bot stopped manually. Reconnect blocked.");
    res.json({ msg: "Bot stopped" });
});

app.post("/command", (req, res) => {
    if (botStatus !== "online") return res.status(400).json({ msg: "Bot offline" });

    const { command } = req.body;
    if (!command || typeof command !== "string") return res.status(400).json({ msg: "Command is required" });

    try {
        bot.chat(command);
        log(`<${bot.username}> ${command}`);
        res.json({ msg: "Chatted: " + command });
    } catch (e) {
        log("Command error: " + e.message);
        res.status(500).json({ msg: "Command failed", error: e.message });
    }
});

app.get("/status", (req, res) => {
    res.json({ status: botStatus });
});

app.get("/logs", (req, res) => {
    try {
        const fileLogs = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
        res.json({ logs: fileLogs });
    } catch (e) {
        log("Failed to read logs.txt: " + e.message);
        res.status(500).json({ msg: "Error reading logs", error: e.message });
    }
});

app.post("/clear-logs", (req, res) => {
    try {
        fs.writeFileSync(LOG_FILE, "");
        logs = [];
        log("Logs cleared by user");
        res.json({ msg: "Logs cleared" });
    } catch (e) {
        log("Failed to clear logs: " + e.message);
        res.status(500).json({ msg: "Failed to clear logs", error: e.message });
    }
});

app.get("/", (req, res) => {
    try {
        res.sendFile(path.join(__dirname, "public/index.html"));
    } catch (e) {
        log("Index error: " + e.message);
        res.status(500).send("UI failed to load");
    }
});

app.use((err, req, res, next) => {
    log("Express error: " + err.message);
    res.status(500).send("Server error");
});

process.on("uncaughtException", err => {
    if (err?.message?.includes("passengers")) {
        log("Ignored buggy passenger error");
        return;
    }
    log("Uncaught Exception: " + err.message);
});
process.on("unhandledRejection", err => log("Unhandled Rejection: " + (err?.message || err)));

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
    console.log(`Server Running ${PORT}`);
});