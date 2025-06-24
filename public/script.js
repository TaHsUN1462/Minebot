    async function startBot() {
      const serverIp = document.getElementById('server-ip').value;
      const username = document.getElementById('username').value;

      const response = await fetch('/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: serverIp, username: username })
      });

      const data = await response.json();
      document.getElementById('status').textContent = 'Online';
    }

    async function stopBot() {
      const response = await fetch('/stop', { method: 'POST' });
      const data = await response.json();
      document.getElementById('status').textContent = 'Offline';
    }