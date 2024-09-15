var express = require('express'), router = express.Router();

const { getSocketIoServer } = require('../../../notifications/service');
const { isOwoApplicationRunning, isOwoVestConnected } = require('../../../owo/service');
const { generateTrigger } = require('../../../queue/trigger/service');
const { getRedemptionByUuid, isRedemptionUsable } = require('../../../redemptions/service');
const { checkAuthentication } = require("../../../twitch/auth/service");
const { isDevMode } = require('../service');
const { randomUUID } = require('crypto');

router.post('/', checkAuthentication, async function (req, res) {
    if (!isDevMode()) {
        return res.status(400).send('Test is only available in development mode');
    }
    getSocketIoServer().emit('test', 'Test Triggered');
    res.send('Test Triggered');
});

router.post('/redemptions/:uuid', checkAuthentication, async function (req, res) {
    const uuid = req.params.uuid
    if (!isDevMode()) {
        return res.status(400).send('Test is only available in development mode');
    }

    const redemption = getRedemptionByUuid(uuid);
    if (!redemption) {
        return res.status(404).send('Redemption not found');
    }

    if (!isOwoApplicationRunning() || !isOwoVestConnected()) {
        return res.status(502).send('OwO is not currently connected, redemptions cannot be tested until OwO is available');
    }

    if (!isRedemptionUsable(uuid)) {
        return res.status(400).send('Redemption is not usable or valid');
    }

    generateTrigger({ id: randomUUID(), prefix: redemption.prefix, number: redemption.cost, triggered: false, errored: false, description: redemption.description });
    res.send('Test Triggered');
});

module.exports = router;