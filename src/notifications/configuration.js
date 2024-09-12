const { markVestAsConnected } = require("../owo/service");
const { invalidateRedemption, markRedemptionsAsUsable } = require("../redemptions/service");
const { processTriggerResponse, processTriggerError } = require("../queue/trigger/service");
const { createSocketIoServer } = require("./service");

const configureSocketIo = (app) => {
    const onConnection = (socket) => {
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
      }
    
      return createSocketIoServer(app, onConnection)
};

module.exports = { configureSocketIo };