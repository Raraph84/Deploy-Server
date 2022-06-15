const { exec } = require("child_process");
const { getConfig } = require("raraph84-lib");

if (process.argv.length === 3 && process.argv[2].toLowerCase() === "deployall") {

    console.log("Déploiement de tous les serveurs...");
    getConfig(__dirname).repos.forEach((repo) => {
        let command;
        if (repo.type === "nodeServer")
            command = `${__dirname}/deployNodeServer.sh ${repo.fullname} ${repo.githubLogin}`;
        else if (repo.type === "dockerNodeServer")
            command = `${__dirname}/deployDockerNodeServer.sh ${repo.fullname} ${repo.githubLogin}`;
        else if (repo.type === "website")
            command = `${__dirname}/deployWebsite.sh ${repo.fullname} ${repo.githubLogin}`;
        else
            return;
        exec(command).on("close", () => console.log("Deployed " + repo.fullname));
    });

} else {
    require("./src/api").start();
    require("./src/gateway").start();
    require("./src/ftpServer").start();
}
