const { homedir } = require("os");
const { join } = require("path");
const { mkdirSync, existsSync } = require("fs");
const { exec } = require("child_process");
const { getConfig, DockerLogsListener } = require("raraph84-lib");
const Docker = require("dockerode");
const Config = getConfig(__dirname + "/..");

class Server {

    /** @type {Server[]} */
    static servers = [];

    /**
     * @param {String} name 
     */
    constructor(name) {

        this.id = Server.servers.length;
        this.name = name;

        Server.servers.push(this);
    }

    static async init() {

        const docker = new Docker();
        const containers = await docker.listContainers({ all: true });

        for (const repo of Config.repos) {

            if (repo.type === "nodejs") {

                const container = containers.find((container) => container.Names[0] === "/" + repo.name);

                if (container) {

                    const server = new NodeJsServer(repo.name, docker.getContainer(container.Id), repo.deployment || null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.state = "started";
                    } else {
                        server.deploy();
                    }

                } else {

                    if (!existsSync(join(homedir(), "nodeServers", repo.name)))
                        mkdirSync(join(homedir(), "nodeServers", repo.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: repo.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/server",
                                    Source: join(homedir(), "nodeServers", repo.name),
                                    Type: "bind"
                                }
                            ],
                            NetworkMode: "host",
                            LogConfig: {
                                Type: "json-file",
                                Config: {
                                    "max-size": "5m",
                                    "max-file": "2"
                                }
                            }
                        },
                        Env: Object.entries(repo.environmentVariables || {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1]),
                        Image: repo.dockerImage,
                        Cmd: (repo.mainFile || "index.js")
                    });

                    const server = new NodeJsServer(repo.name, container, repo.deployment || null);
                    server.deploy();
                }

            } else if (repo.type === "python") {

                const container = containers.find((container) => container.Names[0] === "/" + repo.name);

                if (container) {

                    const server = new PythonServer(repo.name, docker.getContainer(container.Id), repo.deployment || null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.state = "started";
                    } else {
                        server.deploy();
                    }

                } else {

                    if (!existsSync(join(homedir(), "pythonServers", repo.name)))
                        mkdirSync(join(homedir(), "pythonServers", repo.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: repo.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/server",
                                    Source: join(homedir(), "pythonServers", repo.name),
                                    Type: "bind"
                                }
                            ],
                            LogConfig: {
                                Type: "json-file",
                                Config: {
                                    "max-size": "5m",
                                    "max-file": "2"
                                }
                            }
                        },
                        Env: Object.entries(repo.environmentVariables || {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1]),
                        Image: repo.dockerImage,
                        Cmd: "if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && python " + (repo.mainFile || "main.py")
                    });

                    const server = new PythonServer(repo.name, container, repo.deployment || null);
                    server.deploy();
                }

            } else if (repo.type === "website") {

                const server = new WebsiteServer(repo.name, repo.deployment || null);
                if (!existsSync(join(homedir(), "websites", repo.name)))
                    server.deploy();
            }
        }
    }
}

class WebsiteServer extends Server {

    /**
     * @param {String} name 
     * @param {Object} deployment 
     */
    constructor(name, deployment) {

        super(name);

        this.deployment = deployment;
    }

    async deploy() {
        if (this.deployment) {
            const command = `${__dirname}/../deployWebsite.sh ${this.name} ${this.deployment.githubRepo} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;
            exec(command).on("close", () => console.log("Deployed " + this.name + " with command " + command));
        } else {
            console.log("Deployed " + this.name);
        }
    }
}

class DockerServer extends Server {

    /**
     * @param {String} name 
     * @param {import("dockerode").Container} container 
     */
    constructor(name, container) {

        super(name);

        this.container = container;

        /** @type {Object[]} */
        this.lastLogs = [];
        /** @type {import("raraph84-lib/src/DockerLogsListener")} */
        this.logsListener = null;
        /** @type {"stopped"|"stopping"|"starting"|"started"|"restarting"|"deploying"} */
        this.state = "stopped";

        require("./gateway").gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("SERVER", { name: this.name, id: this.id }));
    }

    log(line, date) {
        const log = { line, date };
        this.lastLogs.push(log);
        if (this.lastLogs.length > 500) this.lastLogs.shift();
        require("./gateway").gateway.clients.filter((client) => client.infos.logged).forEach((client) => client.emitEvent("LOG", { serverId: this.id, logs: [log] }));
    }

    listenLogs() {
        this.logsListener = new DockerLogsListener(this.container);
        this.logsListener.on("output", (output, date) => {
            this.log(output.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, ""), date.getTime());
        });
        this.container.inspect().then((infos) => {
            const startDate = new Date(infos.State.StartedAt).getTime();
            this.log("[raraph.fr] Starting...", startDate);
            this.logsListener.listen(startDate);
        });
    }

    async start() {

        if (this.state !== "stopped")
            throw "Server is not stopped";

        this.state = "starting";
        await this.container.start();
    }

    async stop() {

        if (this.state !== "started")
            throw "Server is not started";

        this.state = "stopping";
        await this.container.stop({ t: 3 });
    }

    async kill() {

        if (this.state !== "started" && this.state !== "stopping")
            throw "Server is not started";

        this.state = "stopping";
        await this.container.kill();
    }

    async restart() {

        if (this.state !== "started")
            throw "Server is not started";

        this.state = "restarting";
        await this.container.stop({ t: 3 });
    }
}

class NodeJsServer extends DockerServer {

    /**
     * @param {String} name 
     * @param {import("dockerode").Container} container 
     * @param {Object} deployment 
     */
    constructor(name, container, deployment) {

        super(name, container);

        this.deployment = deployment;
    }

    async deploy() {
        this.state = "deploying";
        this.log("[raraph.fr] Deploying...");
        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }
        if (this.deployment) {
            const command = `${__dirname}/../deployNodeJs.sh ${this.name} ${this.deployment.githubRepo} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;
            exec(command).on("close", async () => {
                this.lastLogs = [];
                await this.container.start();
                console.log("Deployed " + this.name + " with command " + command);
            });
        } else {
            this.lastLogs = [];
            await this.container.start();
            console.log("Deployed " + this.name);
        }
    }
}

class PythonServer extends DockerServer {

    /**
     * @param {String} name 
     * @param {import("dockerode").Container} container 
     * @param {Object} deployment 
     */
    constructor(name, container, deployment) {

        super(name, container);

        this.deployment = deployment;
    }

    async deploy() {
        this.state = "deploying";
        this.log("[raraph.fr] Deploying...");
        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }
        if (this.deployment) {
            const command = `${__dirname}/../deployPython.sh ${this.name} ${this.deployment.githubRepo} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;
            exec(command).on("close", async () => {
                this.lastLogs = [];
                await this.container.start();
                console.log("Deployed " + this.name + " with command " + command);
            });
        } else {
            this.lastLogs = [];
            await this.container.start();
            console.log("Deployed " + this.name);
        }
    }
}

module.exports = {
    Server,
    WebsiteServer,
    DockerServer,
    NodeJsServer,
    PythonServer
}
