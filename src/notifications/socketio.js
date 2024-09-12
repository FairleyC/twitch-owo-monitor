const { createServer } = require('http');
const { Server } = require('socket.io');

const { markRedemptionsAsUsable, invalidateRedemption } = require("../redemptions/service");
const { processTriggerResponse, processTriggerError } = require("../utility/queue/trigger/service");
const { markVestAsConnected } = require('../owo/status.service');
const { setIo } = require('./service');

const configureSocketIo = (app) => {
    var server = createServer(app);
    SocketIOClient = new Server(server);

    SocketIOClient.on("connection", (socket) => {
        console.log(`[Socket] Client Connected: ${socket.id}`)
        socket.on('disconnect', () => {
          console.log(`[Socket] Client Disconnected: ${socket.id}`)
        })
      
        socket.on('owoConnected', () => {
          markVestAsConnected();
          markRedemptionsAsUsable();
        })
      
        socket.on('sensationParsingError', invalidateRedemption);
        socket.on('triggerResponse', processTriggerResponse);
        socket.on('triggerError', processTriggerError)
      })
    
    setIo(SocketIOClient);
    return server;
}

module.exports = { configureSocketIo };