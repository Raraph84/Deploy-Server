const { existsSync, promises: fs } = require("fs");
const { runCommand } = require("./utils");
const Server = require("./Server");
const os = require("os");
const path = require("path");

module.exports = class ReactJsServer extends Server {

    /**
     * @param {string} name 
     * @param {string} buildDockerImage 
     * @param {object} deployment 
     */
    constructor(name, buildDockerImage, deployment) {

        super(name);

        this.type = "reactjs";
        this.buildDockerImage = buildDockerImage;
        this.deployment = deployment;
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        console.log("Deploying " + this.name + "...");

        const serverDir = path.join(os.homedir(), "servers", this.name);
        const tempDir = serverDir + "-temp";

        const rmrf = async (dir) => { if (existsSync(dir)) await fs.rm(dir, { recursive: true }); };

        const onError = async (error) => {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
        };

        await rmrf(tempDir);
        if (existsSync(serverDir + "-old"))
            throw new Error("Old directory already exists !");

        try {
            await runCommand(`git clone https://${this.deployment.githubAuth || "none"}@github.com/${this.deployment.githubRepo} -b ${this.deployment.githubBranch} ${tempDir}`);
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
                    await runCommand(`cp -r ${path.join(serverDir, "node_modules")} ${tempDir}`);
                else
                    await runCommand(`docker run --rm -i --name ${this.name}-Deploy -v ${tempDir}:/home/server ${this.buildDockerImage} npm install${!this.deployment.installDev ? " --omit=dev" : ""}`);
            } catch (error) {
                await onError(error);
                return;
            }
        }

        for (const ignoredFile of (this.deployment.ignoredFiles || [])) {
            if (existsSync(path.join(serverDir, ignoredFile))) {
                await rmrf(path.join(tempDir, ignoredFile));
                try {
                    await runCommand(`cp -r ${path.join(serverDir, ignoredFile)} ${tempDir}`);
                } catch (error) {
                    await onError(error);
                    return;
                }
            }
        }

        await rmrf(path.join(tempDir, "build"));

        try {
            await runCommand(`docker run --rm -i --name ${this.name}-Deploy -v ${tempDir}:/home/server ${this.buildDockerImage} npm run build`);
        } catch (error) {
            await onError(error);
            return;
        }

        await rmrf(path.join(tempDir, "www"));
        await fs.rename(path.join(tempDir, "build"), path.join(tempDir, "www"));

        if (existsSync(serverDir)) await fs.rename(serverDir, serverDir + "-old");
        await fs.rename(tempDir, serverDir);
        await rmrf(serverDir + "-old");

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}
