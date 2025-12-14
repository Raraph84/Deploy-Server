const { existsSync, promises: fs } = require("fs");
const { runCommand } = require("./utils");
const Server = require("./Server");
const path = require("path");

module.exports = class WebsiteServer extends Server {

    /**
     * @param {string} name 
     * @param {object} deployment 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     */
    constructor(name, deployment, gateway) {

        super(name, gateway);

        this.type = "website";
        this.deployment = deployment;

        this._gateway.clients.filter((client) => client.metadata.logged).forEach((client) => client.emitEvent("SERVER", { id: this.id, name: this.name, type: this.type }));
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        console.log("Deploying " + this.name + "...");
        this.log("[AutoDeploy] Deploying...");

        const serverDir = path.join("/servers", this.name);
        const tempDir = serverDir + "-temp";

        const rmrf = async (dir) => { if (existsSync(dir)) await fs.rm(dir, { recursive: true }); };
        await rmrf(tempDir);
        if (existsSync(serverDir + "-old"))
            throw new Error("Old directory already exists !");

        try {
            await runCommand(`git clone https://${this.deployment.githubAuth || "none"}@github.com/${this.deployment.githubRepo} -b ${this.deployment.githubBranch} ${tempDir}`, (line) => this.log(line));
        } catch (error) {
            return this.onDeployError(error);
        }

        await rmrf(path.join(tempDir, ".git"));

        for (const ignoredFile of (this.deployment.ignoredFiles || [])) {
            if (existsSync(path.join(serverDir, ignoredFile))) {
                await rmrf(path.join(tempDir, ignoredFile));
                try {
                    await runCommand(`cp -r ${path.join(serverDir, ignoredFile)} ${tempDir}`, (line) => this.log(line));
                } catch (error) {
                    return this.onDeployError(error);
                }
            }
        }

        if (existsSync(serverDir)) await fs.rename(serverDir, serverDir + "-old");
        await fs.rename(tempDir, serverDir);
        await rmrf(serverDir + "-old");

        this.lastLogs = [];
        this.deploying = false;
        this.log("Deployed " + this.name);
        console.log("Deployed " + this.name);
    }
}
