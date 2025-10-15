const { existsSync, promises: fs } = require("fs");
const { runCommand } = require("./utils");
const DockerServer = require("./DockerServer");
const path = require("path");

module.exports = class NodeJsServer extends DockerServer {

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

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        console.log("Deploying " + this.name + "...");

        const oldState = this.state;
        this.setState("deploying");
        this.log("[AutoDeploy] Deploying...");

        const serverDir = path.join("/servers", this.name);
        const tempDir = serverDir + "-temp";
        const hostTempDir = path.join(process.env.HOST_SERVERS_DIR_PATH, this.name + "-temp");

        const rmrf = async (dir) => { if (existsSync(dir)) await fs.rm(dir, { recursive: true }); };

        const onError = async (error) => {

            this.deploying = false;

            console.log("Error deploying " + this.name + " :", error);
            this.log("[AutoDeploy] Error while deploying !");
            this.setState(oldState);
        };

        await rmrf(tempDir);
        if (existsSync(serverDir + "-old"))
            throw new Error("Old directory already exists !");

        try {
            await runCommand(`git clone https://${this.deployment.githubAuth || "none"}@github.com/${this.deployment.githubRepo} -b ${this.deployment.githubBranch} ${tempDir}`, (line) => this.log(line));
        } catch (error) {
            await onError(error);
            return;
        }

        await rmrf(path.join(tempDir, ".git"));

        if (existsSync(path.join(tempDir, "package.json"))) {

            await rmrf(path.join(tempDir, "node_modules"));

            try {
                if (existsSync(path.join(serverDir, "package.json")) && existsSync(path.join(serverDir, "node_modules"))
                    && await fs.readFile(path.join(tempDir, "package.json"), "utf8") === await fs.readFile(path.join(serverDir, "package.json"), "utf8"))
                    await runCommand(`cp -r ${path.join(serverDir, "node_modules")} ${tempDir}`, (line) => this.log(line));
                else
                    await runCommand(`docker run --rm -i --name ${this.name}-Deploy -u ${process.getuid()}:${process.getgid()} -v ${hostTempDir}:/server -e HOME=/tmp -w /server ${this.dockerImage} npm install${!this.deployment.installDev ? " --omit=dev" : ""}`, (line) => this.log(line));
            } catch (error) {
                await onError(error);
                return;
            }
        }

        for (const ignoredFile of (this.deployment.ignoredFiles || [])) {
            if (existsSync(path.join(serverDir, ignoredFile))) {
                await rmrf(path.join(tempDir, ignoredFile));
                try {
                    await runCommand(`cp -r ${path.join(serverDir, ignoredFile)} ${tempDir}`, (line) => this.log(line));
                } catch (error) {
                    await onError(error);
                    return;
                }
            }
        }

        if (this.deployment.buildCommand) {
            try {
                await runCommand(`docker run --rm -i --name ${this.name}-Deploy -u ${process.getuid()}:${process.getgid()} -v ${hostTempDir}:/server -w /server ${this.dockerImage} ${this.deployment.buildCommand}`, (line) => this.log(line));
            } catch (error) {
                await onError(error);
                return;
            }
        }

        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }

        if (existsSync(serverDir)) await fs.rename(serverDir, serverDir + "-old");
        await fs.rename(tempDir, serverDir);

        this.lastLogs = [];
        await this.container.start();

        await rmrf(serverDir + "-old");

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}
