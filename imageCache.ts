// imageCache.ts
import { Image } from 'expo-image';

export const IMAGE_SOURCES = {
    salt: require('./assets/Icons/Salt.png'),
    apple: require('./assets/Icons/apple.png'),
    tools: require('./assets/Icons/Tools.png'),
    pottery: require('./assets/Icons/pottery.png'),
    shells: require('./assets/Icons/shell.png'),
    cow: require('./assets/Icons/cow.png'),
    brokenpottery: require('./assets/Icons/brokenpottery.png'),
    npc_salt: require('./assets/npc_salt.png'),
    npc_apples: require('./assets/npc_apples.png'),
    npc_tools: require('./assets/npc_tools.png'),
    npc_pottery: require('./assets/npc_pottery.png'),
    npc_shells: require('./assets/npc_shells.png'),
    npc_special: require('./assets/npc_special.png'),
    scaleBeam: require('./assets/Scale/scaleBeam.png'),
    scalePan: require('./assets/Scale/scalePan.png'),
};

export const preloadAllImages = async () => {
    const imageUris = Object.values(IMAGE_SOURCES);
    await Image.prefetch(imageUris);
    return true;
};