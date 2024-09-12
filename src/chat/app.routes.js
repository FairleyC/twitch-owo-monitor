var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");
const { chatStreamTemplate } = require('./handlebars');
const { getMessages } = require('./service');

router.get('/', checkAuthentication, async function (req, res) {
    const userId = req.session.passport.user.data[0].id
    res.send(chatStreamTemplate({ messages: getMessages(), userId }))
});

module.exports = router;