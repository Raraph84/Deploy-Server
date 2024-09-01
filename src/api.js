const { getConfig, HttpServer } = require("raraph84-lib");
const Server = require("./Server");
const config = getConfig(__dirname + "/..");

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

        const servers = Server.servers.filter((server) => server.deployment && server.deployment.githubRepo === message.repository.full_name && server.deployment.githubBranch === message.ref.split("/").pop());
        if (!servers[0]) {
            request.end(401, "Repository or branch not authorized");
            return;
        }

        for (const server of servers)
            server.deploy();

        request.end(204);
    });

    console.log("Lancement du serveur HTTP...");
    await api.listen(config.apiPort);
    console.log("Serveur HTTP lancé sur le port " + config.apiPort + " !");
}

module.exports.stop = async () => {
    await api.close();
}
