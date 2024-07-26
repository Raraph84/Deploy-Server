const Docker = require("dockerode");
const { DockerEventListener } = require("raraph84-lib");
const { Server, DockerServer } = require("./Server");

/** @type {import("raraph84-lib/src/DockerEventListener")} */
let eventListener;

module.exports.start = async () => {

    const docker = new Docker();

    eventListener = new DockerEventListener(docker);
    eventListener.on("rawEvent", (event) => {

        if (event.Type !== "container" || !event.Actor.Attributes.name) return;

        const server = Server.servers.find((server) => server.name === event.Actor.Attributes.name);
        if (!server || !(server instanceof DockerServer)) return;

        if (event.Action === "start") {

            server.listenLogs();
            server.setState("started");

        } else if (event.Action === "die") {

            server.logsListener.close();

            if (server.state === "started" || server.state === "restarting") {
                server.log("[AutoDeploy] Process exited with code " + event.Actor.Attributes.exitCode + ". Restarting in 3 seconds...", Math.floor(event.timeNano / 1000000));
                server.setState("restarting");
                setTimeout(() => { if (server.state === "restarting") server.container.start().catch(() => { }); }, 3000);
            } else if (server.state !== "deploying") {
                server.log("[AutoDeploy] Process exited with code " + event.Actor.Attributes.exitCode + ".");
                server.setState("stopped");
            }
        }
    });

    eventListener.listen();
}

module.exports.stop = async () => {
    eventListener.close();
}
