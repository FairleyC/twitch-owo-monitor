const { createServer } = require('http');
const { Server } = require('socket.io');

let socketIoServer = undefined;

const createSocketIoServer = (app, onConnection) => {
    var server = createServer(app);
    socketIoServer = new Server(server);

    socketIoServer.on("connection", onConnection);

    return server;
}

const getSocketIoServer = () => socketIoServer;

module.exports = { createSocketIoServer, getSocketIoServer };