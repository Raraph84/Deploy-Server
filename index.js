const { TaskManager } = require("raraph84-lib");
const { Server, DockerServer } = require("./src/Server");

const tasks = new TaskManager();

/** @param {import("raraph84-lib/src/WebSocketServer")} */
let gateway;

tasks.addTask((resolve) => require("./src/api").start().then(resolve), (resolve) => require("./src/api").stop().then(resolve));
tasks.addTask((resolve) => require("./src/gateway").start().then((g) => { gateway = g; resolve(); }), (resolve) => require("./src/gateway").stop().then(resolve));
tasks.addTask((resolve) => require("./src/ftpServer").start().then(resolve), (resolve) => require("./src/ftpServer").stop().then(resolve));
tasks.addTask((resolve) => require("./src/logsListener").start().then(resolve), (resolve) => require("./src/logsListener").stop().then(resolve));
tasks.addTask((resolve) => Server.init(gateway).then(resolve), (resolve) => {
    for (const server of Server.servers) {
        if (!(server instanceof DockerServer) || server.state !== "started") continue;
        server.logsListener.close();
    }
    resolve();
});

tasks.run();
