const { existsSync, promises: fs } = require("fs");
const { getConfig } = require("raraph84-lib");
const Docker = require("dockerode");
const os = require("os");
const path = require("path");
const config = getConfig(__dirname + "/..");

module.exports = class Server {

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
                        server.deploy();
                    }

                } else {

                    if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(path.join(os.homedir(), "servers", serverInfos.name));

                    const exposedPorts = {};
                    const portBindings = {};
                    for (const [hostPort, port] of Object.entries(serverInfos.ports ?? {})) {
                        exposedPorts[port + "/tcp"] = {};
                        portBindings[port + "/tcp"] = [{ HostIp: "127.0.0.1", HostPort: hostPort.toString() }];
                    }

                    const startCommand = serverInfos.startCommand ?? (serverInfos.type === "nodejs"
                        ? ("node " + (serverInfos.mainFile ?? "index.js"))
                        : ("python " + (serverInfos.mainFile ?? "main.py")));

                    const container = await docker.createContainer({
                        name: serverInfos.name,
                        ...(serverInfos.ports ? { ExposedPorts: exposedPorts } : {}),
                        Tty: true,
                        OpenStdin: true,
                        HostConfig: {
                            Binds: [path.join(os.homedir(), "servers", serverInfos.name) + ":/home/server"],
                            ...(serverInfos.ports ? { PortBindings: portBindings } : { NetworkMode: "host" }),
                            LogConfig: { Type: "json-file", Config: { "max-size": "5m", "max-file": "2" } }
                        },
                        WorkingDir: "/home/server",
                        Env: Object.entries(serverInfos.environmentVariables ?? {}).map((environmentVariable) => environmentVariable[0] + "=" + environmentVariable[1]),
                        Image: serverInfos.dockerImage,
                        Cmd: (serverInfos.type === "python" ? "if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && " : "") + startCommand
                    });

                    const server = serverInfos.type === "nodejs"
                        ? new NodeJsServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null)
                        : new PythonServer(serverInfos.name, container, gateway, serverInfos.dockerImage, serverInfos.deployment ?? null);
                    server.deploy();
                }

            } else if (serverInfos.type === "website" || serverInfos.type === "reactjs") {

                const server = serverInfos.type === "website"
                    ? new WebsiteServer(serverInfos.name, serverInfos.deployment ?? null)
                    : new ReactJsServer(serverInfos.name, serverInfos.deployment ?? null);

                if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                    server.deploy();

            } else
                throw new Error("Unknown server type: " + serverInfos.type);
        }
    }
}
