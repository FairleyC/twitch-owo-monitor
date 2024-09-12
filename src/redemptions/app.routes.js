var express = require('express'), router = express.Router();

const { randomUUID } = require('crypto');

const { checkAuthentication } = require("../twitch/auth/service");
const { redemptionsTableTemplate } = require("./handlebars");
const { addRedemption, removeRedemption, getRedemptions } = require("./service");

router.get('/', checkAuthentication, async function (req, res) {
    res.send(redemptionsTableTemplate({ redemptions: getRedemptions() }))
});

router.delete('/:uuid', checkAuthentication, async function (req, res) {
    const uuid = req.params.uuid
    if (!Object.hasOwn(getRedemptions().idMap, uuid)) {
        return res.status(404).send('Redemption not found');
    }
    removeRedemption(uuid)
    res.status(200).send(redemptionsTableTemplate({ redemptions: getRedemptions() }))
});

router.post('/', checkAuthentication, async function (req, res) {
    const { prefix, cost, description, sensation } = req.body
    // need to validate fields.
    //   prefix needs to be a valid cheermote prefix
    //   cost needs to be a number
    //   description needs to be a string
    //   sensation needs to be a valid sensation *cry*

    const newRedemption = {
        uuid: randomUUID(),
        prefix,
        cost,
        description,
        sensation
    }

    addRedemption(newRedemption);
    res.status(200).send(redemptionsTableTemplate({ redemptions: getRedemptions() }))
});

module.exports = router;