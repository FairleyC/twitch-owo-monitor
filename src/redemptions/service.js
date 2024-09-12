const fs = require('fs');
const { randomUUID } = require('crypto');

let redemptions = {};

const parseRedemptions = () => {
    if (fs.existsSync(getPathToRedemptionsFile())) {
        parseRedemptionsFromFile();
    } else {
        parseRedemptionsFromStaticCode();
    }
}

const writeRedemptionsToFile = () => {
    const filename = getPathToRedemptionsFile();
    fs.writeFileSync(filename, JSON.stringify(redemptions.list));
}

const parseRedemptionsFromFile = () => {
    const filename = getPathToRedemptionsFile();
    const data = fs.readFileSync(filename, 'utf8');
    // TODO: validate data before creating maps.
    redemptions = createRedemptionMaps(JSON.parse(data));
}

const getPathToRedemptionsFile = () => {
    return process.env.REDEMPTIONS_FILE || './redemptions.json';
}

const parseRedemptionsFromStaticCode = () => {
    staticRedemptions = [
        { uuid: randomUUID(), description: "10 Description", cost: 10, prefix: "cheer", sensation: "10 Description" },
        { uuid: randomUUID(), description: "20 Description", cost: 20, prefix: "cheer", sensation: "20 Description" },
        { uuid: randomUUID(), description: "30 Description", cost: 30, prefix: "cheer", sensation: "30 Description" },
    ]

    redemptions = createRedemptionMaps(staticRedemptions);
    writeRedemptionsToFile();
}

const createRedemptionMaps = (list) => {
    const cheermoteMap = list.reduce((acc, redemption, index) => {
        acc[redemption.prefix + redemption.cost] = Object.assign({ index }, redemption);
        return acc;
    }, {});

    const idMap = list.reduce((acc, redemption, index) => {
        acc[redemption.uuid] = Object.assign({ index }, redemption);
        return acc;
    }, {});

    const oldMetadata = redemptions.metadataMap || {};
    const newMetadata = {};
    list.forEach(redemption => {
        let redemptionMetadata = {};
        if (Object.hasOwn(oldMetadata, redemption.uuid)) {
            redemptionMetadata = oldMetadata[redemption.uuid];
        } else {
            // generate new metadata
            // codes are assumed valid until proven otherwise by OwO parsing errors.
            // codes are unusable until the OwoApp is restarted.
            redemptionMetadata = { valid: true, usable: false };
        }
        newMetadata[redemption.uuid] = redemptionMetadata;
    });

    const validMessagePatterns = list.map(redemption => function (message, metadata) {
        const regex = new RegExp(String.raw`\b${redemption.prefix}${redemption.cost}\b`)
        return regex.test(message) && metadata[redemption.uuid].usable && metadata[redemption.uuid].valid;
    });

    return {
        cheermoteMap,
        idMap,
        list,
        metadataMap: newMetadata,
        patterns: validMessagePatterns
    }
}

const removeRedemption = (uuid) => {
    const redemptionIndex = redemptions.idMap[uuid].index
    const newList = redemptions.list.toSpliced(redemptionIndex, 1)
    redemptions = createRedemptionMaps(newList)
    writeRedemptionsToFile();
}

const addRedemption = (newRedemption) => {
    const newList = [...redemptions.list, newRedemption]
    redemptions = createRedemptionMaps(newList)
    writeRedemptionsToFile();
}

const initializeRedemptions = () => {
    parseRedemptions();
}

function cheermoteMatchesRedemptionPattern(cheermote) {
    const found = redemptions.patterns.some(pattern => pattern(cheermote, redemptions.metadataMap));
    return found;
}

const getRedemptions = () => redemptions;

const markRedemptionsAsUsable = () => {
    Object.values(redemptions.metadataMap).forEach((metadata) => {
        metadata.usable = metadata.valid;
    });
}

const invalidateRedemption = (uuid) => {
    redemptions.metadataMap[uuid].valid = false;
}

const getRedemptionByKeyword = (keyword) => {
    return redemptions.cheermoteMap[keyword];
}

const shouldKeywordTriggerRedemption = (keyword) => {
    const found = redemptions.patterns.some(pattern => pattern(keyword, redemptions.metadataMap));
    return found;
}

module.exports = { initializeRedemptions, cheermoteMatchesRedemptionPattern, markRedemptionsAsUsable, invalidateRedemption, getRedemptions, getPathToRedemptionsFile, addRedemption, removeRedemption, getRedemptionByKeyword, shouldKeywordTriggerRedemption };