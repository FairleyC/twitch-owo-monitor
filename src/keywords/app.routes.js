var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../twitch/auth/service");
const { keywordsStreamTemplate } = require("./handlebars");
const { getKeywords } = require('./service');

router.get('/', checkAuthentication, async function (req, res) {
    const userId = req.session.passport.user.data[0].id
    res.send(keywordsStreamTemplate({ keywords: getKeywords(), userId }))
});

router.post('/:uuid', checkAuthentication, async function (req, res) {
    const uuid = req.params.uuid
    const userId = req.session.passport.user.data[0].id

    let instance = findKeywordInstanceByTrigger(uuid)
    if (!instance) {
        return res.status(404).send('Keyword Instance not found');
    }

    if (req.body.cancel && req.body.replay) {
        return res.status(400).send('Cannot cancel and replay at the same time');
    }

    if (!req.body.cancel && !req.body.replay) {
        return res.status(400).send('Must specify either replay or cancel');
    }

    if (req.body.replay) {
        generateTrigger(instance)
        instance.triggered = false;
    }

    if (req.body.cancel) {
        triggers = triggers.filter(trigger => trigger.triggeringId !== uuid)
        instance.triggered = true;
    }

    res.send(keywordsStreamTemplate({ keywords: getKeywords(), userId }))
});

module.exports = router;