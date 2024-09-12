var express = require('express'), router = express.Router();

const { includeRedirectInState, redirectAfterAuthentication } = require("./service");

// Set route to start OAuth link, this is where you define scopes to request
router.get('/', includeRedirectInState);

// Set route for OAuth redirect
router.get('/callback', redirectAfterAuthentication);

module.exports = router;