const Fs = require("fs");
const { WebSocketServer } = require("ws");

module.exports.start = () => {

    const servers = [];

    console.log("Lancement du serveur WebSocket...");
    const server = new WebSocketServer({ port: 8002 });
    server.on("listening", () => console.log("Serveur WebSocket lancé sur le port 8002 !"));

    server.on("connection", (socket) => {

        socket.infos = { connected: false };

        setTimeout(() => {
            if (!socket.infos.connected)
                socket.close(1000, "Please login");
        }, 10000);

        socket.on("message", (data) => {

            let message;
            try {
                message = JSON.parse(data);
            } catch (error) {
                socket.close(1000, "Invalid JSON");
                return;
            }

            if (!message.command) {
                socket.close(1000, "Missing command");
                return;
            }

            if (message.command.toUpperCase() === "LOGIN") {

                if (!message.token) {
                    socket.close(1000, "Missing token");
                    return;
                }

                if (message.token !== "59Ykw7UwHDSlcEUSwgnezTgvuii0QMQUDe3HGG5A") {
                    socket.close(1000, "Invalid token");
                    return;
                }

                socket.infos.connected = true;
                socket.send(JSON.stringify({ event: "CONNECTED" }));

                servers.forEach((server) => {
                    socket.send(JSON.stringify({ event: "SERVER", name: server.name, id: server.id }));
                    socket.send(JSON.stringify({ event: "LOG", serverId: server.id, logs: server.lastLogs }));
                });
            }
        });
    });

    setInterval(() => {

        Fs.readdirSync(`${__dirname}/../logs/`).forEach((serverName) => {

            const serverInfos = servers.find((server) => server.name === serverName);

            if (!serverInfos) {
                const id = servers.length;
                servers.push({ name: serverName, id: id, lastLogs: [] });
                server.clients.forEach((socket) => socket.infos.connected ? socket.send(JSON.stringify({ event: "SERVER", name: serverName, id: id })) : null);
                return;
            }

            const lastLogs = serverInfos.lastLogs;
            const newLogs = Fs.readFileSync(`${__dirname}/../logs/${serverName}`, { encoding: "utf8" })
                .split(/\n/);
            newLogs.pop();

            if (lastLogs.length > newLogs.length)
                lastLogs.splice(0, lastLogs.length);

            while (lastLogs.length < newLogs.length) {
                const newLine = newLogs[newLogs.length - (newLogs.length - lastLogs.length)];
                lastLogs.push(newLine);
                server.clients.forEach((socket) => socket.infos.connected ? socket.send(JSON.stringify({ event: "LOG", serverId: serverInfos.id, line: newLine })) : null);
            }
        });

    }, 500);
}