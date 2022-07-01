const Fs = require("fs");
const { exec } = require("child_process");
const { HttpServer, getConfig } = require("raraph84-lib");
const { Server, NodeJsServer, WebsiteServer } = require("./Server");
const Config = getConfig(__dirname + "/..");

module.exports.start = () => {

    const api = new HttpServer();
    api.on("request", (/** @type {import("raraph84-lib/src/Request")} */ request) => {

        let message;
        try {
            message = JSON.parse(request.data);
        } catch (error) {
            request.end(400, "Invalid JSON");
            return;
        }

        if (!message.repository || !message.repository.full_name) {
            request.end(400, "Invalid content");
            return;
        }

        const server = Server.servers.find((server) => (server instanceof NodeJsServer || server instanceof WebsiteServer)
            && server.githubRepo === message.repository.full_name);
        if (!server) {
            request.end(401, "Repository not authorized");
            return;
        }

        server.deploy();
        request.end(204);
    });

    console.log("Lancement du serveur HTTP...");
    api.listen(Config.apiPort).then(() => console.log("Serveur HTTP lancé sur le port " + Config.apiPort + " !"));
}
