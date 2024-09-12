var express = require('express'), router = express.Router();

const { checkAuthentication } = require("../auth/service");
const { channelTemplate, channelTemplateOptions } = require("./handlebars");
const { getChannel, connectToTwitchChannel } = require('./service');

router.get('/:channel', checkAuthentication, async function (req, res) {
    const channel = req.params.channel;
    const userId = req.session.passport.user.data[0].id

    if (!channel) {
        // return 400, no channel specified
        return res.status(400).send('No channel specified');
    }

    try {
        await connectToTwitchChannel(channel, req.session.passport.user);
    } catch (e) {
        console.error(e);
        return res.status(404).send(`Channel ${channel} not found`);
    }

    return res.send(channelTemplate(channelTemplateOptions(getChannel().name, userId)));
});

module.exports = router;