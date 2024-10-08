var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");
const { startOwoApplication, restartOwoApplication, isOwoApplicationRunning } = require('./service');

router.post('/', checkAuthentication, async function (req, res) {
    if (isOwoApplicationRunning()) {
        restartOwoApplication();
    } else {
        startOwoApplication();
    }
    res.status(200).send('OwO Launched');
  });

module.exports = router;