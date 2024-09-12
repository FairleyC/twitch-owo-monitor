var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");
const { getRedemptions } = require('./service');

router.get('/:uuid', checkAuthentication, async function (req, res) {
    const uuid = req.params.uuid
    const redemption = getRedemptions().idMap[uuid]
    if (!redemption) {
        return res.status(404).send('Redemption not found');
    }
    res.send(redemption);
});

router.get('/', checkAuthentication, async function (req, res) {
    res.send(getRedemptions());
});

module.exports = router;