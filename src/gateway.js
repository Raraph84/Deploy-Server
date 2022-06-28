const Docker = require("dockerode");
const Fs = require("fs");
const { WebSocketServer, getConfig, DockerEventListener, DockerLogsListener } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

module.exports.start = () => {

    /** @type {Server[]} */
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

    const docker = new Docker();

    const eventListener = new DockerEventListener(docker);
    eventListener.on("rawEvent", (event) => {

        if (event.Type !== "container") return;

        const container = docker.getContainer(event.id);
        const name = event.Actor.Attributes.name.replace(/[^A-Za-z0-9]/g, "-");

        if (event.Action === "start") {

            const server = servers.find((server) => server.name === name) || new Server(container, name);

            server.log("[raraph.fr] Starting...", Math.floor(event.timeNano / 1000000));
            server.listenLogs();
            server.state === "running";

        } else if (event.Action === "die") {

            const server = servers.find((server) => server.name === name);

            server.logsListener.close();

            if (server.state === "running") {
                server.log("[raraph.fr] Process exited with code " + event.Actor.Attributes.exitCode + ". Restarting in 3 seconds...", Math.floor(event.timeNano / 1000000));
                server.state === "restarting";
                setTimeout(() => container.start().catch(() => { }), 3000);
            }
        }
    });

    eventListener.listen();

    docker.listContainers().then((containers) => containers.forEach((container) => {

        const name = container.Names[0].slice(1).replace(/[^A-Za-z0-9]/g, "-");

        new Server(docker.getContainer(container.Id), name).listenLogs();
    }));

    class Server {

        /**
         * @param {import("dockerode").Container} container 
         * @param {string} name 
         */
        constructor(container, name) {

            this.id = servers.length;
            this.name = name;
            this.lastLogs = [];
            this.state = "running";
            this.container = container;
            this.logsListener = null;

            servers.push(this);

            gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER", { name: this.name, id: this.id }));
        }

        log(line, date) {
            const log = { line, date };
            this.lastLogs.push(log);
            gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("LOG", { serverId: this.id, logs: [log] }));
        }

        listenLogs() {

            this.logsListener = new DockerLogsListener(this.container);
            this.logsListener.on("output", (output, date) => {
                this.log(output.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, ""), date.getTime());
            });
            this.logsListener.listen();
        }
    }
}
