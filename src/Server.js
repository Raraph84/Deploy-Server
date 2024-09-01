const { homedir } = require("os");
const { join } = require("path");
const { existsSync, promises: fs } = require("fs");
const { spawn } = require("child_process");
const { getConfig, DockerLogsListener } = require("raraph84-lib");
const Docker = require("dockerode");
const config = getConfig(__dirname + "/..");

const run = (command, onLine) => new Promise((resolve, reject) => {
    const proc = spawn(command.split(" ")[0], command.split(" ").slice(1));
    let data = "";
    let tempData = "";
    const onData = (chunk) => {
        data += chunk;
        if (!onLine) return;
        tempData += chunk;
        while (tempData.includes("\n")) {
            const split = tempData.split("\n");
            onLine(split.shift());
            tempData = split.join("\n");
        }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("close", (code) => code === 0 ? resolve(data) : reject(data));
    proc.on("error", (error) => reject(error));
});

class Server {

    /** @type {Server[]} */
    static servers = [];

    /**
     * @param {string} name 
     */
    constructor(name) {

        this.id = Server.servers.length;
        this.name = name;
        this.type = "unknown";
        this.deploying = false;

        Server.servers.push(this);
    }

    /**
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     */
    static async init(gateway) {

        const docker = new Docker();
        const containers = await docker.listContainers({ all: true });

        for (const serverInfos of config.servers.sort((a, b) => a.name.localeCompare(b.name))) {

            if (serverInfos.type === "nodejs") {

                const container = containers.find((container) => container.Names[0] === "/" + serverInfos.name);

                if (container) {

                    const server = new NodeJsServer(serverInfos.name, docker.getContainer(container.Id), gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.setState("started");
                    } else {
                        server.deploy();
                    }

                } else {

                    if (!existsSync(join(homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(join(homedir(), "servers", serverInfos.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: serverInfos.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/home/server",
                                    Source: join(homedir(), "servers", serverInfos.name),
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
                        Env: Object.entries(serverInfos.environmentVariables || {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1]),
                        Image: serverInfos.dockerImage,
                        Cmd: ["node", serverInfos.mainFile || "index.js"]
                    });

                    const server = new NodeJsServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);
                    server.deploy();
                }

            } else if (serverInfos.type === "python") {

                const container = containers.find((container) => container.Names[0] === "/" + serverInfos.name);

                if (container) {

                    const server = new PythonServer(serverInfos.name, docker.getContainer(container.Id), gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.setState("started");
                    } else {
                        server.deploy();
                    }

                } else {

                    if (!existsSync(join(homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(join(homedir(), "servers", serverInfos.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: serverInfos.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/home/server",
                                    Source: join(homedir(), "servers", serverInfos.name),
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
                        Env: Object.entries(serverInfos.environmentVariables || {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1]),
                        Image: serverInfos.dockerImage,
                        Cmd: "if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && python " + (serverInfos.mainFile || "main.py")
                    });

                    const server = new PythonServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);
                    server.deploy();
                }

            } else if (serverInfos.type === "website") {

                const server = new WebsiteServer(serverInfos.name, serverInfos.deployment ?? null);
                if (!existsSync(join(homedir(), "servers", serverInfos.name)))
                    server.deploy();

            } else if (serverInfos.type === "reactjs") {

                const server = new ReactJsServer(serverInfos.name, serverInfos.buildDockerImage, serverInfos.deployment ?? null);
                if (!existsSync(join(homedir(), "servers", serverInfos.name)))
                    server.deploy();
            } else if (serverInfos.type === "nextjs") {

                const container = containers.find((container) => container.Names[0] === "/" + serverInfos.name);

                if (container) {

                    const server = new NextJsServer(serverInfos.name, docker.getContainer(container.Id), gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.setState("started");
                    } else {
                        server.deploy();
                    }

                } else {

                    if (!existsSync(join(homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(join(homedir(), "servers", serverInfos.name));

                    const container = await docker.createContainer({
                        name: serverInfos.name,
                        ExposedPorts: { "80/tcp": {} },
                        Tty: true,
                        OpenStdin: true,
                        Cmd: ["npm", "start"],
                        Image: serverInfos.dockerImage,
                        HostConfig: {
                            PortBindings: { "80/tcp": [{ HostIp: "127.0.0.1", HostPort: serverInfos.port.toString() }] },
                            Binds: [join(homedir(), "servers", serverInfos.name) + ":/home/server"],
                            LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
                        },
                        Env: Object.entries(serverInfos.environmentVariables || {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1])
                    });

                    const server = new NextJsServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);
                    server.deploy();
                }
            }
        }
    }
}

class WebsiteServer extends Server {

    /**
     * @param {string} name 
     * @param {object} deployment 
     */
    constructor(name, deployment) {

        super(name);

        this.type = "website";
        this.deployment = deployment;
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        const command = `${__dirname}/../deployWebsite.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;

        console.log("Deploying " + this.name + " with command " + command);

        try {
            await run(command, (line) => this.log(line));
        } catch (error) {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
            this.log("[AutoDeploy] Error while deploying !");
            return;
        }

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}

class DockerServer extends Server {

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

    log(line, date) {
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

class NodeJsServer extends DockerServer {

    /**
     * @param {string} name 
     * @param {import("dockerode").Container} container 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     * @param {string} dockerImage 
     * @param {object} deployment 
     */
    constructor(name, container, gateway, dockerImage, deployment) {

        super(name, container, gateway, dockerImage);

        this.type = "nodejs";
        this.deployment = deployment;
    }

    async deploy() {

        if (this.deploying) return;
        this.deploying = true;

        this.setState("deploying");
        this.log("[AutoDeploy] Deploying...");

        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }

        if (this.deployment) {

            const command = `${__dirname}/../deployNodeJs.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${this.dockerImage} ${(this.deployment.ignoredFiles || []).join(":")}`;

            console.log("Deploying " + this.name + " with command " + command);

            try {
                await run(command, (line) => this.log(line));
            } catch (error) {
                this.deploying = false;
                console.log("Error deploying " + this.name + " :", error);
                this.log("[AutoDeploy] Error while deploying !");
                return;
            }

            this.lastLogs = [];
            await this.container.start();

            console.log("Deployed " + this.name);

        } else {

            this.lastLogs = [];
            await this.container.start();
        }

        this.deploying = false;
    }
}

class PythonServer extends DockerServer {

    /**
     * @param {string} name 
     * @param {import("dockerode").Container} container 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     * @param {string} dockerImage 
     * @param {object} deployment 
     */
    constructor(name, container, gateway, dockerImage, deployment) {

        super(name, container, dockerImage, gateway);

        this.type = "python";
        this.deployment = deployment;
    }

    async deploy() {

        if (this.deploying) return;
        this.deploying = true;

        this.setState("deploying");
        this.log("[AutoDeploy] Deploying...");

        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }

        if (this.deployment) {

            const command = `${__dirname}/../deployPython.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;

            console.log("Deploying " + this.name + " with command " + command);

            try {
                await run(command, (line) => this.log(line));
            } catch (error) {
                this.deploying = false;
                console.log("Error deploying " + this.name + " :", error);
                this.log("[AutoDeploy] Error while deploying !");
                return;
            }

            this.lastLogs = [];
            await this.container.start();

            console.log("Deployed " + this.name);

        } else {

            this.lastLogs = [];
            await this.container.start();
        }

        this.deploying = false;
    }
}

class ReactJsServer extends Server {

    /**
     * @param {string} name 
     * @param {string} buildDockerImage 
     * @param {object} deployment 
     */
    constructor(name, buildDockerImage, deployment) {

        super(name);

        this.type = "reactjs";
        this.buildDockerImage = buildDockerImage;
        this.deployment = deployment;
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        const command = `${__dirname}/../deployReactJs.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${this.buildDockerImage} ${(this.deployment.ignoredFiles || []).join(":")}`;

        console.log("Deploying " + this.name + " with command " + command);

        try {
            await run(command, (line) => this.log(line));
        } catch (error) {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
            this.log("[AutoDeploy] Error while deploying !");
            return;
        }

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}

class NextJsServer extends DockerServer {

    /**
     * @param {string} name 
     * @param {import("dockerode").Container} container 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     * @param {string} dockerImage 
     * @param {object} deployment 
     */
    constructor(name, container, gateway, dockerImage, deployment) {

        super(name, container, gateway, dockerImage);

        this.type = "nextjs";
        this.deployment = deployment;
    }

    async deploy() {

        if (this.deploying) return;
        this.deploying = true;

        this.setState("deploying");
        this.log("[AutoDeploy] Deploying...");

        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }

        if (this.deployment) {

            const command = `${__dirname}/../deployNextJs.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${this.dockerImage} ${(this.deployment.ignoredFiles || []).join(":")}`;

            console.log("Deploying " + this.name + " with command " + command);

            try {
                await run(command, (line) => this.log(line));
            } catch (error) {
                this.deploying = false;
                console.log("Error deploying " + this.name + " :", error);
                this.log("[AutoDeploy] Error while deploying !");
                return;
            }

            this.lastLogs = [];
            await this.container.start();

            console.log("Deployed " + this.name);

        } else {

            this.lastLogs = [];
            await this.container.start();
        }

        this.deploying = false;
    }
}

module.exports = {
    Server,
    DockerServer,
    WebsiteServer,
    NodeJsServer,
    PythonServer,
    ReactJsServer
}
