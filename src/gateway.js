const { getConfig, WebSocketServer } = require("raraph84-lib");
const { Server, DockerServer } = require("./Server");
const Config = getConfig(__dirname + "/..");

/** @param {import("raraph84-lib/src/WebSocketServer")} */
let gateway;
let heartbeatInterval;

module.exports.start = async () => {

    gateway = new WebSocketServer();

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

            Server.servers.filter((server) => server instanceof DockerServer).forEach((server) => {
                client.emitEvent("SERVER", { name: server.name, id: server.id });
                client.emitEvent("LOG", { serverId: server.id, logs: server.lastLogs });
            });

        } else if (command === "HEARTBEAT") {

            if (!client.infos.logged) {
                client.close("You are not logged in");
                return;
            }

            if (!client.infos.waitingHeartbeat) {
                client.close("Useless heartbeat");
                return;
            }

            client.infos.waitingHeartbeat = false;

        } else
            client.close("Command not found");
    });

    console.log("Lancement du serveur WebSocket...");

    await gateway.listen(Config.gatewayPort);

    heartbeatInterval = setInterval(() => {

        gateway.clients.filter((client) => client.infos.logged).forEach((client) => {
            client.infos.waitingHeartbeat = true;
            client.emitEvent("HEARTBEAT");
        });

        setTimeout(() => {
            gateway.clients.filter((client) => client.infos.waitingHeartbeat).forEach((client) => {
                client.close("Please respond to heartbeat");
            });
        }, 10 * 1000);

    }, 30 * 1000);

    console.log("Serveur WebSocket lancé sur le port " + Config.gatewayPort + " !");

    return gateway;
}

module.exports.stop = async () => {
    clearInterval(heartbeatInterval);
    await gateway.close();
}
