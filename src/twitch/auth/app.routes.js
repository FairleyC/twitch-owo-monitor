var express = require('express'), router = express.Router();

const { checkAuthentication } = require("./service");
const { authTemplate } = require("./handlebars");

router.get('/', checkAuthentication, async function (req, res) {
  res.send(authTemplate(req.session.passport.user));
});

module.exports = router;