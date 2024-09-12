var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");

router.get('/api/keywords', checkAuthentication, async function (req, res) {
    res.send(keywords);
});

module.exports = router;