var express = require('express'), router = express.Router();

const { checkAuthentication } = require("./auth/service");
const { getEmotes, getCheermotes, getBadges } = require("./service");

router.get('/emotes', checkAuthentication, async function (req, res) {
    res.send(JSON.stringify(getEmotes()));
});

router.get('/cheermotes', checkAuthentication, async function (req, res) {
    cheermotes = getCheermotes();
    if (cheermotes.getPossibleNames !== undefined) {
        res.send({ possibleNames: cheermotes.getPossibleNames()});
    } else {
        res.send({ possibleNames: []})
    }
});

router.get('/badges', checkAuthentication, async function (req, res) {
    res.send(JSON.stringify(getBadges()));
});

router.get('/channel', checkAuthentication, async function (req, res) {
    res.send(current);
});

module.exports = router;