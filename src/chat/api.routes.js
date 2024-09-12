var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");

router.get('/', checkAuthentication, async function (req, res) {
  res.send(messages);
});

module.exports = router;