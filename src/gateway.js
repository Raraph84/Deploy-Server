const { getConfig, WebSocketServer } = require("raraph84-lib");
const Server = require("./Server");
const DockerServer = require("./DockerServer");
const config = getConfig(__dirname + "/..");

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

        if (!["LOGIN", "HEARTBEAT", "START_SERVER", "STOP_SERVER", "RESTART_SERVER", "DEPLOY_SERVER"].includes(command)) {
            client.close("Command not found");
            return;
        }

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

            if (message.token !== config.token) {
                client.close("Invalid token");
                return;
            }

            client.infos.logged = true;
            client.emitEvent("LOGGED");

            Server.servers.filter((server) => server instanceof DockerServer).forEach((server) => {
                client.emitEvent("SERVER", { id: server.id, name: server.name, type: server.type, state: server.state });
                client.emitEvent("LOG", { serverId: server.id, logs: server.lastLogs });
            });
            return;
        }

        if (!client.infos.logged) {
            client.close("You are not logged in");
            return;
        }

        if (command === "HEARTBEAT") {

            if (!client.infos.waitingHeartbeat) {
                client.close("Useless heartbeat");
                return;
            }

            client.infos.waitingHeartbeat = false;
            return;
        }

        if (typeof message.serverId === "undefined") {
            client.close("Missing server id");
            return;
        }

        if (typeof message.serverId !== "number") {
            client.close("Server id must be a number");
            return;
        }

        const server = Server.servers.find((server) => server.id === message.serverId);
        if (!server) {
            client.close("This server does not exist");
            return;
        }

        if (!(server instanceof DockerServer)) {
            client.close("This server is not a Docker server");
            return;
        }

        try {
            if (command === "START_SERVER")
                server.start();
            else if (command === "STOP_SERVER")
                server.stop();
            else if (command === "RESTART_SERVER")
                server.restart();
            else if (command === "DEPLOY_SERVER")
                server.deploy();
        } catch (error) {
            client.close(error);
        }
    });

    console.log("Lancement du serveur WebSocket...");

    await gateway.listen(config.gatewayPort);

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

    console.log("Serveur WebSocket lancé sur le port " + config.gatewayPort + " !");

    return gateway;
}

module.exports.stop = async () => {
    clearInterval(heartbeatInterval);
    await gateway.close();
}
