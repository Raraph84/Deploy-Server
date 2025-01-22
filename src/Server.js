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
        const NextJsServer = require("./NextJsServer");

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

                    if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(path.join(os.homedir(), "servers", serverInfos.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: serverInfos.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/home/server",
                                    Source: path.join(os.homedir(), "servers", serverInfos.name),
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

                    if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(path.join(os.homedir(), "servers", serverInfos.name));

                    const container = await docker.createContainer({
                        Tty: true,
                        OpenStdin: true,
                        name: serverInfos.name,
                        HostConfig: {
                            Mounts: [
                                {
                                    Target: "/home/server",
                                    Source: path.join(os.homedir(), "servers", serverInfos.name),
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
                if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                    server.deploy();

            } else if (serverInfos.type === "reactjs") {

                const server = new ReactJsServer(serverInfos.name, serverInfos.buildDockerImage, serverInfos.deployment ?? null);
                if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
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

                    if (!existsSync(path.join(os.homedir(), "servers", serverInfos.name)))
                        await fs.mkdir(path.join(os.homedir(), "servers", serverInfos.name));

                    const destPort = (serverInfos.destPort ?? 80) + "/tcp";

                    const container = await docker.createContainer({
                        name: serverInfos.name,
                        ExposedPorts: { [destPort]: {} },
                        Tty: true,
                        OpenStdin: true,
                        Cmd: ["npm", "start"],
                        Image: serverInfos.dockerImage,
                        HostConfig: {
                            PortBindings: { [destPort]: [{ HostIp: "127.0.0.1", HostPort: serverInfos.port.toString() }] },
                            Binds: [path.join(os.homedir(), "servers", serverInfos.name) + ":/home/server"],
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
