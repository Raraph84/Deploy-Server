const { DockerLogsListener } = require("raraph84-lib");
const Server = require("./Server");

module.exports = class DockerServer extends Server {

    #gateway;

    /**
     * @param {string} name 
     * @param {import("dockerode").Container} container 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     * @param {string} dockerImage 
     */
    constructor(name, container, gateway, dockerImage) {

        super(name);

        this.container = container;
        this.dockerImage = dockerImage;
        /** @type {object[]} */
        this.lastLogs = [];
        /** @type {import("raraph84-lib/src/DockerLogsListener")} */
        this.logsListener = null;
        /** @type {"stopped"|"stopping"|"starting"|"started"|"restarting"|"deploying"} */
        this.state = "stopped";

        this.#gateway = gateway;

        this.#gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER", { id: this.id, name: this.name, type: this.type, state: this.state }));
    }

    log(line, date = Date.now()) {
        const log = { line, date };
        this.lastLogs.push(log);
        if (this.lastLogs.length > 500) this.lastLogs.shift();
        this.#gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("LOG", { serverId: this.id, logs: [log] }));
    }

    listenLogs() {
        this.logsListener = new DockerLogsListener(this.container);
        this.logsListener.on("output", (output, date) => {
            this.log(output.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, ""), date.getTime());
        });
        this.logsListener.on("error", (error) => console.log("Error while listening logs for " + this.name + " :", error));
        this.container.inspect().then((infos) => {
            const startDate = new Date(infos.State.StartedAt).getTime();
            this.log("[AutoDeploy] Starting...", startDate);
            this.logsListener.listen(startDate);
        });
    }

    setState(state) {
        this.state = state;
        this.#gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER_STATE", { serverId: this.id, state: this.state }));
    }

    async start() {

        if (this.state !== "stopped")
            throw "Server is not stopped";

        this.setState("starting");
        await this.container.start();
    }

    async stop() {

        if (this.state !== "started")
            throw "Server is not started";

        this.setState("stopping");
        await this.container.stop({ t: 3 });
    }

    async kill() {

        if (this.state !== "started" && this.state !== "stopping")
            throw "Server is not started";

        this.setState("stopping");
        await this.container.kill();
    }

    async restart() {

        if (this.state !== "started")
            throw "Server is not started";

        this.setState("restarting");
        await this.container.stop({ t: 3 });
    }
}
