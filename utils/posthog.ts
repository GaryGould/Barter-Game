import { Platform } from 'react-native';

let posthog: any = null;
let initialized = false;

// Lazy initialization function for PostHog
function initializePostHog() {
  if (initialized) return posthog;
  
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web platform - use posthog-js
      const posthogJS = require('posthog-js').default;
      posthog = posthogJS.init('phc_KvxX7mU1WMHNh1lQsLUyryTaRBzTS3nUiP2b0tqQU6U', {
        api_host: 'https://us.i.posthog.com',
        autocapture: false, // Disable automatic event capture
        capture_pageview: true, // Enable to start sessions automatically
        capture_pageleave: true, // Enable to track when users leave
        session_recording: {
          enabled: true,
          maskAllInputs: false,
          maskTextContent: false,
        }
      });
      initialized = true;
    } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // For mobile platforms, we'll use a no-op implementation
      // The proper way would be to use PostHogProvider at the app root level
      // But for now, we'll just provide a safe no-op to prevent crashes
      console.log('PostHog: Mobile tracking disabled - requires PostHogProvider setup');
      posthog = {
        capture: () => {},
        identify: () => {},
        reset: () => {},
        screen: () => {},
      };
      initialized = true;
    }
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
    // Provide a safe no-op implementation on error
    posthog = {
      capture: () => {},
      identify: () => {},
      reset: () => {},
      screen: () => {},
    };
    initialized = true;
  }
  
  return posthog;
}

// Initialize on first access for web only
if (Platform.OS === 'web') {
  initializePostHog();
}

export { posthog, initializePostHog };