async function startBot() {
    const serverIp = document.getElementById("server-ip").value;
    const username = document.getElementById("username").value;

    localStorage.setItem("server-ip", serverIp);
    localStorage.setItem("username", username);

    if (serverIp && username) {
        try {
            const res = await fetch("/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ host: serverIp, username })
            });
            if (!res.ok) throw new Error("Start failed");
            document.getElementById("statusLog").textContent = "";

            // status will be updated by polling
        } catch {
            document.getElementById("statusLog").textContent = "Start failed";
        }
    }
}

async function stopBot() {
    try {
        const res = await fetch("/stop", { method: "POST" });
        if (!res.ok) throw new Error("Stop failed");
        document.getElementById("statusLog").textContent = "";

        // status will be updated by polling
    } catch {
        document.getElementById("statusLog").textContent = "Stop failed";
    }
}

async function fetchLogs() {
    try {
        const res = await fetch("/logs");
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();
        const logDiv = document.getElementById("log");
        if (logDiv) {
            logDiv.textContent = data.logs.join("\n");
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    } catch (e) {
        console.error(e);
    }
}
async function sendCommand() {
    const commandInput = document.getElementById("bot-command");
    const command = commandInput.value.trim();
    if (!command) return alert("Enter a command");

    try {
        const res = await fetch("/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command })
        });
        const data = await res.json();
        if (res.ok) {
            commandInput.value = "";
        } else {
            alert("Error: " + data.msg);
        }
    } catch (e) {
        alert("Request failed: " + e.message);
    }
}
function clearLogs() {
    fetch("/clear-logs", { method: "POST" })
        .then(res => res.json())
        .then(data => alert(data.msg))
        .catch(err => alert("Error clearing logs"));
}
async function updateStatusFromServer() {
    try {
        const res = await fetch("/status");
        if (!res.ok) throw new Error("Failed to get status");
        const data = await res.json();

        document.getElementById("status").textContent =
            data.status.charAt(0).toUpperCase() + data.status.slice(1);
        getStatus();
    } catch {
        document.getElementById("status").textContent = "Offline";
    }
}
document.getElementById("bot-command").addEventListener("keydown", e => {
    if (e.key == "Enter") {
        sendCommand();
    }
});

setInterval(fetchLogs, 1000);
fetchLogs();

setInterval(updateStatusFromServer, 2000);
updateStatusFromServer();

document.getElementById("server-ip").value =
    localStorage.getItem("server-ip") || "example.com:11111";
document.getElementById("username").value =
    localStorage.getItem("username") || "NoName";
async function getStatus() {
    fetch("/status")
        .then(res => res.json())
        .then(data => {
            if (data.status === "offline") {
                document.getElementById("status").style.background = "red";
                document.getElementById("startBotBtn").style.display = "block";
                document.getElementById("stopBotBtn").style.display = "none";
            } else {
                document.getElementById("status").style.background = "lime";
                document.getElementById("startBotBtn").style.display = "none";
                document.getElementById("stopBotBtn").style.display = "block";
            }
        })
        .catch(err => console.error(err));
}
