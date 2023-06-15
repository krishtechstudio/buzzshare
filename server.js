const express = require('express');
const path = require("path");
const numCPUs = require("os").cpus().length;
const cluster = require("cluster");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const app = express();
app.use(express.static(path.join(__dirname+"/public")));

if(cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    const server = require("http").createServer(app);
    setupMaster(server, {
        loadBalancingMethod: "least-connection",
    });
    setupPrimary();
    cluster.setupMaster({
        serialization: "advanced",
    });
    server.listen(process.env.PORT || 80)
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
}else{
    console.log(`Worker ${process.pid} started`);

    const server = require("http").createServer(app);
    const io = require("socket.io")(server);

    io.adapter(createAdapter());
    setupWorker(io);

    io.on('connection', function(socket) {
        socket.on('sender-join', function(data) {
            socket.join(data.uid);
            console.log(data.uid)
        })
        socket.on('receiver-join', function(data) {
            socket.join(data.uid);
            socket.in(data.server_uid).emit("init", data.uid);
        })
        socket.on("file-meta", function(data) {
            socket.in(data.uid).emit("fs-meta", data.metadata);
        })
        socket.on("fs-start", function(data) {
            socket.in(data.uid).emit("fs-share", {});
        })
        socket.on("file-raw", function(data) {
            socket.in(data.uid).emit("fs-share", data.buffer);
        })
    })
}