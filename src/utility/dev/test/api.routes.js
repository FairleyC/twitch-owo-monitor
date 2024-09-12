var express = require('express'), router = express.Router();

const { io } = require('../../../notifications/service');
const { checkAuthentication } = require("../../../twitch/auth/service");

router.post('/api/test', checkAuthentication, async function (req, res) {
    if (!DEV_MODE) {
        return res.status(400).send('Test is only available in development mode');
    }
    io.emit('test', 'Test Triggered');
    res.send('Test Triggered');
});

module.exports = router;