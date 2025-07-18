import { ResourceType } from './App';
import { ImageSourcePropType } from 'react-native';

export const resourceIcons: Record<ResourceType, ImageSourcePropType> = {
    salt: require('./assets/Icons/Salt.png'),
    apples: require('./assets/Icons/apple.png'),
    tools: require('./assets/Icons/Tools.png'),
    pottery: require('./assets/Icons/pottery.png'),
    shells: require('./assets/Icons/shell.png'),
};
