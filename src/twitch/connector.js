// connects to twitch and maintains state.

const { processMessage, resetMessages } = require("../chat/service");
const { connectToTwitch } = require("./auth/service");
const { loadEmotes, loadCheermotes, loadBadges, reduceMessageHighlight } = require("./service");
const { resetKeywords } = require("../keywords/service");
const { resetConnection, getConnection, setConnection } = require("./connection");

const connectToTwitchChannel = async (channelName, user) => {
    const connection = getConnection();
    const isRefreshCurrentChannel = connection.channel === channelName
    if (isRefreshCurrentChannel) {
      reduceMessageHighlight();
      reduceKeywordHighlight();
      return;
    }
  
    const isAlreadyConnectedToChannel = connection.listener
    const isNotTheSameAsCurrentChannel = connection.channel !== channelName
    if (isAlreadyConnectedToChannel && isNotTheSameAsCurrentChannel) {
      resetConnection();
      resetMessages();
      resetKeywords();
    }

    const { auth, api, listener } = await connectToTwitch(user.accessToken);

    let broadcaster = null;
    try {
        broadcaster = await api.users.getUserByName(channelName);
    } catch (e) {
        // return 404, the channel was not found
        return res.status(404).send(`Channel ${channelName} not found`);
    }

    setConnection(channelName, listener, api, auth, broadcaster);

    await loadEmotes(broadcaster.id);
    await loadCheermotes();
    await loadBadges(broadcaster.id);

    listener.start();
    listener.onChannelChatMessage(broadcaster.id, user.data[0].id, processMessage);
}

module.exports = { connectToTwitchChannel }