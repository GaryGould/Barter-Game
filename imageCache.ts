// imageCache.ts
import { Image } from 'react-native';

// All your images
export const IMAGE_SOURCES = {
    // Icons
    salt: require('./assets/Icons/Salt.png'),
    apple: require('./assets/Icons/apple.png'),
    tools: require('./assets/Icons/Tools.png'),
    pottery: require('./assets/Icons/pottery.png'),
    shells: require('./assets/Icons/shell.png'),
    cow: require('./assets/Icons/cow.png'),
    brokenpottery: require('./assets/Icons/brokenpottery.png'),
    checkmark: require('./assets/Icons/checkmark.png'),

    // NPCs
    npc_salt: require('./assets/npc_salt.png'),
    npc_apples: require('./assets/npc_apples.png'),
    npc_tools: require('./assets/npc_tools.png'),
    npc_pottery: require('./assets/npc_pottery.png'),
    npc_shells: require('./assets/npc_shells.png'),
    npc_special: require('./assets/npc_special.png'),
    npc1: require('./assets/npc1.png'),

    // Scale
    scaleBeam: require('./assets/Scale/scaleBeam.png'),
    scalePan: require('./assets/Scale/scalePan.png'),

    // UI
    adaptive_icon: require('./assets/adaptive-icon.png'),
    favicon: require('./assets/favicon.png'),
    icon: require('./assets/icon.png'),
    splash_icon: require('./assets/splash-icon.png'),
};

// Keep references to prevent garbage collection
const imageCache = new Map();

export const preloadAllImages = async () => {
    console.log('Starting aggressive image preload...');

    const promises = Object.entries(IMAGE_SOURCES).map(async ([key, source]) => {
        const asset = Image.resolveAssetSource(source);

        // Force load the image
        await Image.prefetch(asset.uri);

        // Store in cache to prevent garbage collection
        imageCache.set(key, {
            source,
            uri: asset.uri,
            loaded: true
        });

        console.log(`Loaded: ${key}`);
    });

    await Promise.all(promises);
    console.log('All images loaded and cached!');

    // Return the cache so you can verify it's loaded
    return imageCache;
};

// Never let images get garbage collected
export const getImage = (key: string) => {
    return IMAGE_SOURCES[key as keyof typeof IMAGE_SOURCES];
};