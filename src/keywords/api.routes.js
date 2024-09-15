var express = require('express'), router = express.Router();

const { isOwoApplicationRunning, isOwoVestConnected } = require('../owo/service');
const { generateTrigger } = require('../queue/trigger/service');
const { getRedemptionByUuid, isRedemptionUsable } = require('../redemptions/service');
const { checkAuthentication } = require("../twitch/auth/service");
const { randomUUID } = require('crypto');
const { addKeyword } = require('./service');

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
    const text = "This keyword was manually triggered by the Twitch Monitor."
    const message = {
        user: "Me",
        color: '#888888',
        badges: [],
        messageParts: [{type: 'text', text}],
        text,
        when: Date.now(),
    }

    const instance = { id: randomUUID(), prefix: redemption.prefix, number: redemption.cost, triggered: false, errored: false, description: redemption.description }

    addKeyword(message, [instance]);
    generateTrigger(instance);

    res.send('Keyword ManuallyTriggered');
});

module.exports = router;