const { createLogger } = require("bunyan");
const { FtpSrv, ftpErrors } = require("ftp-srv");
const { getConfig } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

/** @type {import("ftp-srv").FtpSrv} */
let ftpServer;

module.exports.start = async () => {

    let passiveUrl;
    while (!passiveUrl) {
        try {
            const res = await fetch("https://ipv4.lafibre.info/ip.php");
            passiveUrl = await res.text();
        } catch (err) {
        }
    }

    console.log("Lancement du serveur FTP...");
    ftpServer = new FtpSrv({
        log: createLogger({
            name: "ftp-srv", stream: {
                write: (data) => {
                    data = JSON.parse(data);
                    if (data.msg === "Listening")
                        console.log("Serveur FTP lancé sur le port " + data.port);
                }
            }
        }),
        url: "ftp://[::]:" + Config.ftpPort,
        pasv_url: passiveUrl,
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

module.exports.stop = async () => {
    ftpServer.close();
}
