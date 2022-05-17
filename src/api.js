const Fs = require("fs");
const { exec } = require("child_process");
const { HttpServer } = require("raraph84-lib");

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

        let repos;
        try {
            repos = JSON.parse(Fs.readFileSync(`${__dirname}/../config.json`)).repos;
        } catch (error) {
            request.end(500, "Internal server error");
            return;
        }

        const repo = repos.find((repo) => repo.fullname === message.repository.full_name);
        if (!repo) {
            request.end(401, "Repository not authorized");
            return;
        }

        let command;
        if (repo.type === "nodeServer")
            command = `${__dirname}/../deployNodeServer.sh ${repo.fullname} ${repo.githubLogin}`;
        else if (repo.type === "dockerNodeServer")
            command = `${__dirname}/../deployDockerNodeServer.sh ${repo.fullname} ${repo.githubLogin}`;
        else if (repo.type === "website")
            command = `${__dirname}/../deployWebsite.sh ${repo.fullname} ${repo.githubLogin}`;
        else return;

        console.log("Deploying " + repo.fullname + " with " + command + "...");
        exec(command);
        request.end(204);
    });

    console.log("Lancement du serveur HTTP...");
    api.listen(8001).then(() => console.log("Serveur HTTP lancé sur le port 8001 !"));
}
