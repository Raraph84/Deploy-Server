const Fs = require("fs");
const { WebSocketServer, getConfig, DockerAllLogsListener } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

module.exports.start = () => {

    const servers = [];

    const gateway = new WebSocketServer();
    gateway.on("connection", (/** @type {import("raraph84-lib/src/WebSocketClient")} */ client) => {
        setTimeout(() => {
            if (!client.infos.logged)
                client.close("Please login");
        }, 10 * 1000);
    });
    gateway.on("command", (command, /** @type {import("raraph84-lib/src/WebSocketClient")} */ client, message) => {

        if (command === "LOGIN") {

            if (client.infos.logged) {
                client.close("You are already logged in");
                return;
            }

            if (typeof message.token === "undefined") {
                client.close("Missing token");
                return;
            }

            if (typeof message.token !== "string") {
                client.close("Token must be a string");
                return;
            }

            if (message.token !== Config.token) {
                client.close("Invalid token");
                return;
            }

            client.infos.logged = true;
            client.emitEvent("LOGGED");

            servers.forEach((server) => {
                client.emitEvent("SERVER", { name: server.name, id: server.id });
                client.emitEvent("LOG", { serverId: server.id, logs: server.lastLogs });
            });

        } else
            client.close("Command not found");
    });

    console.log("Lancement du serveur WebSocket...");
    gateway.listen(Config.gatewayPort).then(() => console.log("Serveur WebSocket lancé sur le port " + Config.gatewayPort + " !"));

    setInterval(() => {

        Fs.readdirSync(`${__dirname}/../logs/`).forEach((serverName) => {

            const serverInfos = servers.find((server) => server.name === serverName);

            if (!serverInfos) {
                const id = servers.length;
                servers.push({ name: serverName, id: id, lastLogs: [] });
                gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER", { name: serverName, id: id }));
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
                const log = { line: newLine, date: Date.now() };
                lastLogs.push(log);
                gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("LOG", { serverId: serverInfos.id, logs: [log] }));
            }
        });

    }, 500);

    const dockerContainersCache = [];

    const logsListener = new DockerAllLogsListener();
    logsListener.on("output", async (/** @type {import("dockerode").Container} */ container, output, date) => {

        if (!dockerContainersCache.some((cachedContainer) => cachedContainer.id === container.id)) {
            const serverName = (await container.inspect()).Name.slice(1);
            if (!dockerContainersCache.some((cachedContainer) => cachedContainer.id === container.id))
                dockerContainersCache.push({ id: container.id, name: serverName });
        }

        const serverName = dockerContainersCache.find((cachedContainer) => cachedContainer.id === container.id).name;

        if (!servers.some((server) => server.name === serverName)) {
            const id = servers.length;
            servers.push({ name: serverName, id: id, lastLogs: [] });
            gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER", { name: serverName, id: id }));
        }

        const server = servers.find((server) => server.name === serverName);
        const log = { line: output.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, ""), date: date.getTime() };

        server.lastLogs.push(log);
        gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("LOG", { serverId: server.id, logs: [log] }));
    });

    logsListener.listen();
}
