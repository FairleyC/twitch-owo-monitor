var express = require('express'), router = express.Router();

const { getSocketIoServer } = require('../../../notifications/service');
const { checkAuthentication } = require("../../../twitch/auth/service");
const { isDevMode } = require('../service');

router.post('/', checkAuthentication, async function (req, res) {
    if (!isDevMode()) {
        return res.status(400).send('Test is only available in development mode');
    }
    getSocketIoServer().emit('test', 'Test Triggered');
    res.send('Test Triggered');
});

module.exports = router;