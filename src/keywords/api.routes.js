var express = require('express'), router = express.Router();

const { isOwoApplicationRunning, isOwoVestConnected } = require('../owo/service');
const { getRedemptionByUuid, isRedemptionUsable } = require('../redemptions/service');
const { checkAuthentication } = require("../twitch/auth/service");
const { processMessageForKeywords, generateTestMessageForRedemption } = require('./service');

router.get('/', checkAuthentication, async function (req, res) {
    res.send(keywords);
});

router.post('/', checkAuthentication, async function (req, res) {
    const redemptionUuid = req.body.redemption
    if (!redemptionUuid) {
        return res.status(400).send('Must specify redemption');
    }

    const redemption = getRedemptionByUuid(redemptionUuid);
    if (!redemption) {
        return res.status(400).send('Redemption not found');
    }

    if (!isOwoApplicationRunning() || !isOwoVestConnected()) {
        return res.status(502).send('OwO is not currently connected, redemptions cannot be tested until OwO is available');
    }

    if (!isRedemptionUsable(redemptionUuid)) {
        return res.status(400).send('Redemption is not usable or valid');
    }

    // should all probably go to the service.
    const message = generateTestMessageForRedemption(redemption);

    processMessageForKeywords(message)

    res.send('Keyword Manually Triggered');
});

module.exports = router;