const { getConnection } = require("./connection");

let emotes = {};
let globalEmotesAreLoaded = false;
let badges = {};
let cheermotes = {};

const loadEmotes = async (channelId) => {
    const api = getConnection().api;
    if (!globalEmotesAreLoaded) {
        let globalEmotes = [];
        try {
            globalEmotes = await api.chat.getGlobalEmotes();
        } catch (e) {
            console.error(`Failed to get emotes: ${e}`);
        }
        storeEmotes(globalEmotes);
        globalEmotesAreLoaded = true;
    }

    if (hasEmote(channelId)) {
        return;
    }
    
    let channelEmotes = [];
    try {
        channelEmotes = await api.chat.getChannelEmotes(channelId);
    } catch (e) {
        console.error(`Failed to get emotes: ${e}`);
    }
    storeEmotes(channelEmotes);
}

const storeEmotes = (newEmotes) => {
    newEmotes.forEach(emote => emotes[emote.id] = emote);
}

const getEmotes = () => emotes;
const hasEmote = (id) => Object.hasOwn(emotes, id);

const generateEmoteHtml = (emote, alternativeText) => {
    if (Object.hasOwn(emotes, emote.id)) {
        const cachedEmote = emotes[emote.id]
        const format = cachedEmote.formats.slice(-1)[0]
        const scale = cachedEmote.scales[0]
        const theme = cachedEmote.themeModes.slice(-1)[0]
        let src = cachedEmote.getFormattedImageUrl(scale, format, theme)
        return `<img src="${src}" alt="${alternativeText}" width="28" class="square"></image>`
    } else {
        return `<span>${alternativeText}</span>`
    }
}

const loadCheermotes = async () => {
    const api = getConnection().api;
    let globalCheermoteList = {};
    try {
        globalCheermoteList = await api.bits.getCheermotes();
    } catch (e) {
        console.error(`Failed to get cheermotes: ${e}`);
    }
    cheermotes = globalCheermoteList;
}

const getCheermotes = () => cheermotes

const generateCheermoteHtml = (cheermote) => {
    const displayProps = cheermotes.getCheermoteDisplayInfo(cheermote.prefix, cheermote.bits, { background: 'dark', scale: 1, state: 'animated' })
    if (displayProps) {
        return `<img src="${displayProps.url}" alt="${cheermote.prefix}" class="square"></image><span style="color:${displayProps.color}">${cheermote.bits}</span>`
    } else {
        return `<span>${cheermote.prefix}${cheermote.bits}</span>`
    }
}

const loadBadges = async (broadcasterId) => {
    const api = getConnection().api;
    let globalBadges = [];
    let channelBadges = [];

    try {
        globalBadges = await api.chat.getGlobalBadges();
        channelBadges = await api.chat.getChannelBadges(broadcasterId);
    } catch (e) {
        console.error(`Failed to get badges: ${e}`);
    }

    globalBadges.forEach(badge => {
        badges[badge.id] = badge.versions.reduce((acc, version) => {
            acc[version.id] = version;
            return acc
        }, {});
    });

    channelBadges.forEach(badge => {
        badges[badge.id] = badge.versions.reduce((acc, version) => {
            acc[version.id] = version;
            return acc
        }, {});
    });
}

const getBadges = () => badges;

const generateBadgeHtml = (chatterBadges) => {
    return Object.entries(chatterBadges)
        .filter(([id, version]) => Object.hasOwn(badges, id) && Object.hasOwn(badges[id], version))
        .map(([id, version]) => `<img src="${badges[id][version].getImageUrl(1)}" alt="${badges[id][version].title}" class="square"></image> `)
        .join('');
}

const generateMentionHtml = (mention, currentUserId, mentionedName) => {
    let classValue = 'surface-variant square'
    if (mention.user_id === currentUserId) {
        classValue = 'inverse-surface square'
    }
    return `<span class="${classValue}" style="padding: 4px">${mentionedName}</span>`
}

const reduceMessageHighlight = () => {
    messages.filter(m => m.new > 0).map(m => m.new--);
}


module.exports = { loadEmotes, getEmotes, generateEmoteHtml, loadCheermotes, getCheermotes, generateCheermoteHtml, loadBadges, getBadges, generateBadgeHtml, generateMentionHtml, reduceMessageHighlight };