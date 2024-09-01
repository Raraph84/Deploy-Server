const { spawn } = require("child_process");
const DockerServer = require("./DockerServer");

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

module.exports = class PythonServer extends DockerServer {

    /**
     * @param {string} name 
     * @param {import("dockerode").Container} container 
     * @param {import("raraph84-lib/src/WebSocketServer")} gateway 
     * @param {string} dockerImage 
     * @param {object} deployment 
     */
    constructor(name, container, gateway, dockerImage, deployment) {

        super(name, container, dockerImage, gateway);

        this.type = "python";
        this.deployment = deployment;
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        this.setState("deploying");
        this.log("[AutoDeploy] Deploying...");

        try {
            await this.container.stop({ t: 3 });
        } catch (error) {
        }

        const command = `${__dirname}/../deployPython.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;

        console.log("Deploying " + this.name + " with command " + command);

        try {
            await run(command, (line) => this.log(line));
        } catch (error) {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
            this.log("[AutoDeploy] Error while deploying !");
            return;
        }

        this.lastLogs = [];
        await this.container.start();

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}
