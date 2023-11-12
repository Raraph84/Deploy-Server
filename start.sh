cd ~/deployServer

while true; do
    echo "[$(date +"%d/%m/%Y %H:%M")] Démarrage du bot..." | tee -a ~/deployServer/logs.txt
    node index.js 2>&1 | tee -a ~/deployServer/logs.txt
    sleep 3
done
