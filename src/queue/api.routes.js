var express = require('express'), router = express.Router();

const { isOwoVestConnected } = require('../owo/service');
const { checkAuthentication } = require('../twitch/auth/service');
const { enableQueue, disableQueue, getQueueStatus } = require('./processor');

router.get('/', checkAuthentication, async function (req, res) {
    res.send({ queue: getQueueStatus() });
});

router.post('/', checkAuthentication, async function (req, res) {
    const status = req.body.queue
    if (!status) {
        return res.status(400).send('Must specify queue status');
    }
    if (!isOwoVestConnected()) {
        return res.status(502).send('OwO is not currently connected, queue cannot be started until OwO is available');
    }
    if (status === 'on') {
        enableQueue();
    } else if (status === 'off') {
        disableQueue();
    } else {
        return res.status(400).send('Invalid queue status, must be either "on" or "off"');
    }

    res.send('Queue Status Updated: ' + status);
});

module.exports = router;