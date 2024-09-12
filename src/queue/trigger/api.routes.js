var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../../twitch/auth/service");
const { getTriggers } = require('./service');

router.get('/', checkAuthentication, async function (req, res) {
    res.send(getTriggers());
});

module.exports = router;