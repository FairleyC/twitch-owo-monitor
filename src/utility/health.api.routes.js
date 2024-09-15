var express = require('express'), router = express.Router();

const { isOwoVestConnected, isOwoApplicationRunning } = require('../owo/service');
const { getQueueStatus } = require('../queue/trigger/service');
const { isAuthenticated, isConnectedToTwitch } = require('../twitch/auth/service');
const { isChannelConnected } = require('../twitch/channel/service');
const { isDevMode } = require('./dev/service');

router.get('/', async function (req, res) {
    const up = getQueueStatus() && isOwoApplicationRunning() && isOwoVestConnected() && isAuthenticated(req) && isConnectedToTwitch() && isChannelConnected();
    res.send({ health: up, parts: { queue: getQueueStatus(), owo: { app: isOwoApplicationRunning(), vest: isOwoVestConnected() }, dev: isDevMode(), twitch: { auth: isAuthenticated(req), connected: isConnectedToTwitch(), channel: isChannelConnected() } } });
});

module.exports = router;