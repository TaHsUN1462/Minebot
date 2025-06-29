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
function clearLogs() {
    confirm("Are you sure you want to clear all logs?", function () {
        fetch("/clear-logs", { method: "POST" })
            .then(res => res.json())
            .then(data => alert(data.msg))
            .catch(err => alert("Error clearing logs"));
    });
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
                document.getElementById("status").style.background = "#f62451";
                document.getElementById("startBotBtn").style.display = "block";
                document.getElementById("stopBotBtn").style.display = "none";
            } else {
                document.getElementById("status").style.background = "#1fd78d";
                document.getElementById("startBotBtn").style.display = "none";
                document.getElementById("stopBotBtn").style.display = "block";
            }
        })
        .catch(err => console.error(err));
}
document.querySelectorAll(".controlInput").forEach(item => {
    item.addEventListener("change", () => {
        const serverIp = document.getElementById("server-ip").value;
        const username = document.getElementById("username").value;

        localStorage.setItem("server-ip", serverIp);
        localStorage.setItem("username", username);
    });
});
function disableScroll() {
    document.body.addEventListener("touchmove", preventScroll, {
        passive: false
    });
}

function preventScroll(e) {
    e.preventDefault();
}

function enableScroll() {
    document.body.removeEventListener("touchmove", preventScroll, {
        passive: false
    });
}
const overlay = document.getElementById("overlay");
const dialog = document.getElementById("dialogBox");
const dialogMsg = document.getElementById("dialogMsg");
const promptInput = document.getElementById("promptInput");
const cancelBtn = document.getElementById("cancelBtnD");
const okBtn = document.getElementById("okBtn");

let currentType = "alert";
let okCallback = null;
let cancelCallback = null;
function openDialog(type, msg, okFn, cancelFn) {
    currentType = type;
    okCallback = okFn || (() => {});
    cancelCallback = cancelFn || closeDialog;

    dialogMsg.textContent = msg;
    promptInput.style.display = type === "prompt" ? "block" : "none";
    promptInput.value = "";

    cancelBtn.style.display = type === "alert" ? "none" : "inline-block";

    overlay.classList.add("shown");
    dialog.classList.add("shown");
    disableScroll();

    if (type === "prompt") setTimeout(() => promptInput.focus(), 100);
}

function closeDialog() {
    overlay.classList.remove("shown");
    dialog.classList.remove("shown");
    enableScroll();
}

cancelBtn.onclick = () => {
    closeDialog();
    if (currentType !== "alert") cancelCallback();
};

okBtn.onclick = () => {
    closeDialog();
    if (currentType === "prompt") okCallback(promptInput.value);
    else okCallback();
};

overlay.onclick = () => {
    if (currentType !== "alert") {
        closeDialog();
        cancelCallback();
    }
};
window.alert = (msg, ok) => openDialog("alert", msg, ok);
window.confirm = (msg, ok, cancel) => openDialog("confirm", msg, ok, cancel);
window.prompt = (msg, ok, cancel) => openDialog("prompt", msg, ok, cancel);
