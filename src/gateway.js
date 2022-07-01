const { getConfig, WebSocketServer } = require("raraph84-lib");
const { Server, NodeJsServer } = require("./Server");
const Config = getConfig(__dirname + "/..");

module.exports.gateway = new WebSocketServer();

module.exports.start = () => {

    this.gateway.on("connection", (/** @type {import("raraph84-lib/src/WebSocketClient")} */ client) => {
        setTimeout(() => {
            if (!client.infos.logged)
                client.close("Please login");
        }, 10 * 1000);
    });
    this.gateway.on("command", (command, /** @type {import("raraph84-lib/src/WebSocketClient")} */ client, message) => {

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

            Server.servers.filter((server) => server instanceof NodeJsServer).forEach((server) => {
                client.emitEvent("SERVER", { name: server.name, id: server.id });
                client.emitEvent("LOG", { serverId: server.id, logs: server.lastLogs });
            });

        } else
            client.close("Command not found");
    });

    console.log("Lancement du serveur WebSocket...");
    this.gateway.listen(Config.gatewayPort).then(() => console.log("Serveur WebSocket lancé sur le port " + Config.gatewayPort + " !"));
}
