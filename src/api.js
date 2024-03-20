const { getConfig, HttpServer } = require("raraph84-lib");
const { Server } = require("./Server");
const Config = getConfig(__dirname + "/..");

/** @param {import("raraph84-lib/src/HttpServer")} */
let api;

module.exports.start = async () => {

    api = new HttpServer();

    api.on("request", (/** @type {import("raraph84-lib/src/Request")} */ request) => {

        let message;
        try {
            message = JSON.parse(request.body);
        } catch (error) {
            request.end(400, "Invalid JSON");
            return;
        }

        if (typeof message.ref !== "string" || typeof message.repository !== "object" || typeof message.repository.full_name !== "string") {
            request.end(400, "Invalid JSON");
            return;
        }

        const server = Server.servers.find((server) => server.deployment && server.deployment.githubRepo === message.repository.full_name && server.deployment.githubBranch === message.ref.split("/").pop());
        if (!server) {
            request.end(401, "Repository or branch not authorized");
            return;
        }

        server.deploy();
        request.end(204);
    });

    console.log("Lancement du serveur HTTP...");
    await api.listen(Config.apiPort);
    console.log("Serveur HTTP lancé sur le port " + Config.apiPort + " !");
}

module.exports.stop = async () => {
    await api.close();
}
