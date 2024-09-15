// connects to twitch and maintains state.

const { processMessage, resetMessages } = require("../../chat/service");
const { connectToTwitch } = require("../auth/service");
const { loadEmotes, loadCheermotes, loadBadges } = require("../service");
const { resetKeywords } = require("../../keywords/service");

let channel = {};

const connectToTwitchChannel = async (channelName, user) => {
    // run this code if we are refreshing the current channel
    const isRefreshCurrentChannel = channel.name === channelName
    if (isRefreshCurrentChannel) {
      return;
    }
  
    // run this code if we are changing channels
    const isAlreadyConnectedToChannel = channel.name
    const isNotTheSameAsCurrentChannel = channel.name !== channelName
    if (isAlreadyConnectedToChannel && isNotTheSameAsCurrentChannel) {
      channel = {};
      resetMessages();
      resetKeywords();
    }

    // connect to twitch with the auth token of the user
    const { api, listener } = await connectToTwitch(user.accessToken);

    // get the broadcaster of the channel.
    let broadcaster = null;
    try {
        broadcaster = await api.users.getUserByName(channelName);
    } catch (e) {
        // return 404, the channel was not found
        return res.status(404).send(`Channel ${channelName} not found`);
    }


    channel = { name: channelName, broadcaster: broadcaster };

    // load static resources for the channel and global.
    await loadEmotes(broadcaster.id);
    await loadCheermotes();
    await loadBadges(broadcaster.id);

    // start a listener
    listener.start();

    // configure the listener to process messages.
    listener.onChannelChatMessage(broadcaster.id, user.data[0].id, processMessage);
}

const getChannel = () => channel;
const isChannelConnected = () => !!channel.name;

module.exports = { connectToTwitchChannel, getChannel, isChannelConnected }