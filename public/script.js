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
            document.getElementById("status").textContent = "Online";
        } catch {
            document.getElementById("statusLog").textContent = "Start failed";
        }
    }
}

async function stopBot() {
    try {
        const res = await fetch("/stop", { method: "POST" });
        document.getElementById("status").textContent = "Offline";
    } catch {
        document.getElementById("statusLog").textContent = "Stop failed";
    }
}

document.getElementById("server-ip").value =
    localStorage.getItem("server-ip") || "example.com:11111";
document.getElementById("username").value =
    localStorage.getItem("username") || "NoName";
