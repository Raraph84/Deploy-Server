const { existsSync, promises: fs } = require("fs");
const { getConfig } = require("raraph84-lib");
const Docker = require("dockerode");
const path = require("path");
const { runCommand } = require("./utils");
const config = getConfig(__dirname + "/..");

module.exports = class Server {

    /** @type {Server[]} */
    static servers = [];

    /**
     * @param {string} name 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     */
    constructor(name, gateway) {

        this.id = Server.servers.length;
        this.name = name;
        this.type = "unknown";
        this.deploying = false;
        /** @type {{ line: string, date: number }[]} */
        this.lastLogs = [];
        this._gateway = gateway;

        Server.servers.push(this);
    }

    /**
     * Adds a log line to the server's logs and emits it to clients if possible
     * @param {string} line
     * @param {number} [date]
     */
    log(line, date = Date.now()) {
        const log = { line, date };
        this.lastLogs.push(log);
        if (this.lastLogs.length > 500) this.lastLogs.shift();
        this._gateway.clients.filter((client) => client.metadata.logged).forEach((client) => client.emitEvent("LOG", { serverId: this.id, logs: [log] }));
    }

    /**
     * Handles deployment errors
     * @param {string|Error} error
     */
    onDeployError(error) {
        this.deploying = false;
        console.log("Error deploying " + this.name + " :", error);
        this.log("[AutoDeploy] Error while deploying !");
    }

    /**
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     */
    static async init(gateway) {

        const groups = (await runCommand("id -G")).trim().split(" ");

        // Importing here to avoid circular dependencies
        const NodeJsServer = require("./NodeJsServer");
        const PythonServer = require("./PythonServer");
        const WebsiteServer = require("./WebsiteServer");
        const ReactJsServer = require("./ReactJsServer");

        const docker = new Docker();
        const containers = await docker.listContainers({ all: true });

        for (const serverInfos of config.servers.sort((a, b) => a.name.localeCompare(b.name))) {

            // Retrocompatibility
            if (serverInfos.type === "nextjs") {
                console.warn("The 'nextjs' server type has been deprecated, it will be removed in future versions. Please use 'nodejs' instead.");
                serverInfos.type = "nodejs";
                if (!serverInfos.startCommand)
                    serverInfos.startCommand = "npm run start";
                if (serverInfos.deployment && !serverInfos.deployment.buildCommand)
                    serverInfos.deployment.buildCommand = "npm run build";
                if (!serverInfos.ports)
                    serverInfos.ports = { [serverInfos.port]: [serverInfos.destPort ?? 80] };
                delete serverInfos.port;
                delete serverInfos.destPort;
            }
            if (serverInfos.type === "reactjs") {
                if (serverInfos.buildDockerImage && serverInfos.deployment && !serverInfos.deployment.dockerImage) {
                    console.warn("The 'buildDockerImage' field has been deprecated, it will be removed in future versions. Please use 'deployment.dockerImage' instead.");
                    serverInfos.deployment.dockerImage = serverInfos.buildDockerImage;
                }
            }

            if (serverInfos.type === "nodejs" || serverInfos.type === "python") {

                const container = containers.find((container) => container.Names[0] === "/" + serverInfos.name);

                if (container) {

                    const server = serverInfos.type === "nodejs"
                        ? new NodeJsServer(serverInfos.name, docker.getContainer(container.Id), gateway, serverInfos.dockerImage, serverInfos.deployment ?? null)
                        : new PythonServer(serverInfos.name, docker.getContainer(container.Id), gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);

                    if (container.State === "running") {
                        server.listenLogs();
                        server.setState("started");
                    } else {
                        server.start();
                    }

                } else {

                    if (!existsSync(path.join("/servers", serverInfos.name)))
                        await fs.mkdir(path.join("/servers", serverInfos.name));

                    const exposedPorts = {};
                    const portBindings = {};
                    for (const [hostPort, port] of Object.entries(serverInfos.ports ?? {})) {
                        const host = hostPort.split(":").reverse()[1] ?? "127.0.0.1";
                        const srcPort = hostPort.split(":").pop();
                        const dstPort = port.toString().split("/")[0];
                        const proto = port.toString().split("/")[1] ?? "tcp";
                        exposedPorts[dstPort + "/" + proto] = {};
                        portBindings[dstPort + "/" + proto] = [{ HostIp: host, HostPort: srcPort }];
                    }

                    const startCommand = serverInfos.startCommand ?? (serverInfos.type === "nodejs"
                        ? ("node " + (serverInfos.mainFile ?? "index.js"))
                        : ("python " + (serverInfos.mainFile ?? "main.py")));

                    const volumes = [];
                    for (const [hostPath, containerPath] of Object.entries(serverInfos.volumes ?? {}))
                        volumes.push(path.resolve(hostPath) + ":" + containerPath);

                    const container = await docker.createContainer({
                        name: serverInfos.name,
                        ...(serverInfos.ports ? { ExposedPorts: exposedPorts } : {}),
                        Tty: true,
                        OpenStdin: true,
                        HostConfig: {
                            GroupAdd: groups,
                            Binds: [path.join(process.env.HOST_SERVERS_DIR_PATH, serverInfos.name) + ":/home/server", ...volumes],
                            ...(serverInfos.ports ? { PortBindings: portBindings } : { NetworkMode: "host" }),
                            LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
                        },
                        User: process.getuid() + ":" + process.getgid(),
                        WorkingDir: "/home/server",
                        Env: [
                            "TZ=Europe/Paris",
                            "HOME=/home/server",
                            ...Object.entries(serverInfos.environmentVariables ?? {})
                                .map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1])
                        ],
                        Image: serverInfos.dockerImage,
                        Cmd: serverInfos.type === "nodejs"
                            ? startCommand.split(" ")
                            : ["bash", "-c", "if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && " + startCommand]
                    });

                    const server = serverInfos.type === "nodejs"
                        ? new NodeJsServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null)
                        : new PythonServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);
                    server.deploy();
                }

            } else if (serverInfos.type === "website" || serverInfos.type === "reactjs") {

                const server = serverInfos.type === "website"
                    ? new WebsiteServer(serverInfos.name, serverInfos.deployment ?? null, gateway)
                    : new ReactJsServer(serverInfos.name, serverInfos.deployment ?? null, gateway);

                if (!existsSync(path.join("/servers", serverInfos.name)))
                    server.deploy();

            } else
                throw new Error("Unknown server type: " + serverInfos.type);
        }
    }
}
