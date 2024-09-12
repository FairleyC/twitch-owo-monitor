const resetConnection = () => {
    if (connection && connection.listener) {
        connection.listener.stop();
    }
    connection = {
        channel: null,
        listener: null,
        api: null,
        auth: null,
        broadcaster: null
    }
}

let connection;
resetConnection();

const getConnection = () => connection;

const setConnection = (channelName, listener, api, auth, broadcaster) => {
    connection = {
        channel: channelName,
        listener,
        api,
        auth,
        broadcaster
    }
}

module.exports = { resetConnection, getConnection, setConnection };