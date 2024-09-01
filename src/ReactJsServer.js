const { homedir } = require("os");
const { existsSync, promises: fs } = require("fs");
const { spawn } = require("child_process");
const Server = require("./Server");
const path = require("path");

const run = (command, onLine) => new Promise((resolve, reject) => {
    const proc = spawn(command.split(" ")[0], command.split(" ").slice(1));
    let data = "";
    let tempData = "";
    const onData = (chunk) => {
        data += chunk;
        if (!onLine) return;
        tempData += chunk;
        while (tempData.includes("\n")) {
            const split = tempData.split("\n");
            onLine(split.shift());
            tempData = split.join("\n");
        }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("close", (code) => code === 0 ? resolve(data) : reject(data));
    proc.on("error", (error) => reject(error));
});

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

        const tempDir = await fs.mkdtemp("/tmp/deploy-");
        const serverDir = path.join(homedir(), "servers", this.name);

        const rmrf = async (dir) => { if (existsSync(dir)) await fs.rm(dir, { recursive: true }); };

        const onError = async (error) => {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
        };

        try {
            await run(`git clone https://${this.deployment.githubAuth || "none"}@github.com/${this.deployment.githubRepo} -b ${this.deployment.githubBranch} ${tempDir}`);
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
                    await run(`cp -r ${path.join(serverDir, "node_modules")} ${tempDir}`);
                else
                    await run(`docker run --rm -i --name ${this.name}-Deploy -v ${tempDir}:/home/server ${this.buildDockerImage} npm install --omit=dev`);
            } catch (error) {
                await onError(error);
                return;
            }
        }

        for (const ignoredFile of (this.deployment.ignoredFiles || [])) {
            if (existsSync(path.join(serverDir, ignoredFile))) {
                await rmrf(path.join(tempDir, ignoredFile));
                try {
                    await run(`cp -r ${path.join(serverDir, ignoredFile)} ${tempDir}`);
                } catch (error) {
                    await onError(error);
                    return;
                }
            }
        }

        await rmrf(path.join(tempDir, "build"));

        try {
            await run(`docker run --rm -i --name ${this.name}-Deploy -v ${tempDir}:/home/server ${this.buildDockerImage} npm run build`);
        } catch (error) {
            await onError(error);
            return;
        }

        await rmrf(path.join(tempDir, "www"));
        await fs.rename(path.join(tempDir, "build"), path.join(tempDir, "www"));

        await rmrf(serverDir + "-old");
        await fs.rename(serverDir, serverDir + "-old");
        await fs.rename(tempDir, serverDir);
        await rmrf(serverDir + "-old");

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}
