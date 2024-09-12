var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");

router.get('/', checkAuthentication, async function (req, res) {
    const userId = req.session.passport.user.data[0].id
    res.send(chatStreamTemplate({ messages, userId }))
});

module.exports = router;