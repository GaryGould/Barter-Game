import { Dimensions } from 'react-native';

// Design baseline: iPhone 13/14/15
export const VIRTUAL_WIDTH = 390;
export const VIRTUAL_HEIGHT = 844;

// Largest phone + safety margin (e.g. iPhone 15 Pro Max = 430)
export const MAX_PHONE_WIDTH = 460;

// Get physical screen size
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Clamp width if screen is extremely wide (desktop/tablet)
export const CLAMPED_WIDTH = Math.min(SCREEN_WIDTH, MAX_PHONE_WIDTH);

// Scene scale based on clamped width
export const SCENE_SCALE = CLAMPED_WIDTH / VIRTUAL_WIDTH;

// How wide the scene will actually be
export const TOTAL_SCENE_WIDTH = VIRTUAL_WIDTH * SCENE_SCALE;

// Horizontal offset to center scene (when screen is wider)
export const HORIZONTAL_PADDING = Math.max((SCREEN_WIDTH - TOTAL_SCENE_WIDTH) / 2, 0);

// This ensures the *bottom* of the scaled scene touches the bottom of the screen
export const BOTTOM_OFFSET = VIRTUAL_HEIGHT * (1 - SCENE_SCALE);
