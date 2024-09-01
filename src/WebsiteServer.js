const { spawn } = require("child_process");
const Server = require("./Server");

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

module.exports = class WebsiteServer extends Server {

    /**
     * @param {string} name 
     * @param {object} deployment 
     */
    constructor(name, deployment) {

        super(name);

        this.type = "website";
        this.deployment = deployment;
    }

    async deploy() {

        if (!this.deployment || this.deploying) return;
        this.deploying = true;

        const command = `${__dirname}/../deployWebsite.sh ${this.name} ${this.deployment.githubRepo}/${this.deployment.githubBranch} ${this.deployment.githubAuth || "none"} ${(this.deployment.ignoredFiles || []).join(":")}`;

        console.log("Deploying " + this.name + " with command " + command);

        try {
            await run(command);
        } catch (error) {
            this.deploying = false;
            console.log("Error deploying " + this.name + " :", error);
            return;
        }

        this.deploying = false;
        console.log("Deployed " + this.name);
    }
}
