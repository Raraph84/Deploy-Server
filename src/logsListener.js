const Docker = require("dockerode");
const { DockerEventListener } = require("raraph84-lib");
const { Server } = require("./Server");

module.exports.start = () => {

    const docker = new Docker();

    const eventListener = new DockerEventListener(docker);
    eventListener.on("rawEvent", (event) => {

        if (event.Type !== "container") return;

        const name = event.Actor.Attributes.name.replace(/[^A-Za-z0-9]/g, "-");
        const server = Server.servers.find((server) => server.name === name);
        if (!server) return;

        if (event.Action === "start") {

            server.log("[raraph.fr] Starting...", Math.floor(event.timeNano / 1000000));
            server.listenLogs();
            server.state = "running";

        } else if (event.Action === "die") {

            server.logsListener.close();

            if (server.state === "running") {
                server.log("[raraph.fr] Process exited with code " + event.Actor.Attributes.exitCode + ". Restarting in 3 seconds...", Math.floor(event.timeNano / 1000000));
                server.state = "restarting";
                setTimeout(() => server.container.start().catch(() => { }), 3000);
            }
        }
    });

    eventListener.listen();
}
