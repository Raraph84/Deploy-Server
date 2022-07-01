const { Server } = require("./src/Server");

Server.init().then(() => {

    require("./src/api").start();
    require("./src/gateway").start();
    require("./src/ftpServer").start();
    require("./src/logsListener").start();
});
