const { default: FtpServer } = require("ftp-srv");
const { GeneralError } = require("ftp-srv/src/errors");
const { getConfig } = require("raraph84-lib");
const Config = getConfig(__dirname + "/..");

module.exports.start = () => {

    const ftpServer = new FtpServer({
        url: "ftp://0.0.0.0:" + Config.ftpPort,
        pasv_url: Config.ftpPassiveUrl,
        pasv_min: Config.ftpPassiveMinPort,
        pasv_max: Config.ftpPassiveMaxPort
    });

    ftpServer.on("login", (data, resolve, reject) => {

        const user = Config.ftpCredentials[data.username];

        if (!user || user.password !== data.password)
            return reject(new GeneralError("Invalid username or password", 401));

        return resolve({ root: user.root });
    });

    ftpServer.listen();
}
