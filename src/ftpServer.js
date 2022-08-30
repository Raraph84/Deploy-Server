const { createLogger } = require("bunyan");
const { FtpSrv, ftpErrors } = require("ftp-srv");
const { getConfig } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

module.exports.start = () => {

    class Logger {
        write(data) {
            data = JSON.parse(data);

            if (data.msg === "Listening")
                console.log("Serveur FTP lancé sur le port " + data.port);
        }
    }

    console.log("Lancement du serveur FTP...");
    const ftpServer = new FtpSrv({
        log: createLogger({ name: "ftp-srv", stream: new Logger() }),
        url: "ftp://[::]:" + Config.ftpPort,
        pasv_url: Config.ftpPassiveUrl,
        pasv_min: Config.ftpPassiveMinPort,
        pasv_max: Config.ftpPassiveMaxPort
    });

    ftpServer.on("login", (data, resolve, reject) => {

        const user = Config.ftpCredentials[data.username];

        if (!user || user.password !== data.password)
            return reject(new ftpErrors.GeneralError("Invalid username or password", 401));

        return resolve({ root: user.root });
    });

    ftpServer.listen();
}
