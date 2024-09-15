var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");
const { getMessages } = require('./service');

router.get('/', checkAuthentication, async function (req, res) {
  res.send(getMessages());
});

module.exports = router;