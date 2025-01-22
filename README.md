# Deploy Server

## Installation

- Choose a user where you want to install the deploy server and log into it
- Clone the repository and configure the server 
```bash
git clone https://github.com/Raraph84/Deploy-Server ~/deploy-server
mkdir ~/servers
cp ~/deploy-server/config.example.json ~/deploy-server/config.json
nano ~/deploy-server/config.json
```
- Install npm packages
```bash
docker run -it --rm \
--volume ~/deploy-server:/home/$(whoami)/deploy-server \
--workdir /home/$(whoami)/deploy-server \
--env TZ=Europe/Paris \
node npm install --omit=dev
```
- Build the Docker NodeJS image for servers
```bash
docker build -t cnode:22 -f Dockerfile-cnode-22 .
```
- Start the server into Docker
```bash
docker pull node && \
docker rm -f deploy-server; \
docker run -itd \
--name deploy-server \
--volume ~/deploy-server:/home/$(whoami)/deploy-server \
--volume ~/servers:/home/$(whoami)/servers \
--volume /var/run/docker.sock:/var/run/docker.sock \
--volume /usr/bin/docker:/usr/bin/docker \
--publish 127.0.0.1:8001:8001 \
--publish 127.0.0.1:8002:8002 \
--publish 2121:2121 \
--publish 21000-21010:21000-21010 \
--workdir /home/$(whoami)/deploy-server \
--env TZ=Europe/Paris \
--restart unless-stopped \
node bash -c "userdel node; groupadd docker -g $(getent group docker | cut -d: -f3); useradd $(whoami) -G docker; su $(whoami) -c 'node index.js'"
```
- Your server is ready !

## Roadmap
- Docker image
- Run npm install and npm run build with native Docker implementation instead of running docker command
- Use dotenv
- Remove ReactJS server type and add build system to website type
