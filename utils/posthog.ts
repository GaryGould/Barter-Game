import { Platform } from 'react-native';

let posthog: any = null;
let initialized = false;

//  initialization function for PostHog
function initializePostHog() {
  if (initialized) return posthog;
  
  try {
    // Only try to load posthog-js on web platform
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Dynamically import posthog-js only for web
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
      console.log('PostHog initialized for web');
    } else {
      // For mobile platforms or when window is not available, use a no-op implementation
      console.log('PostHog: Using no-op implementation for non-web platform');
      posthog = {
        capture: (eventName: string, properties?: any) => {
          console.log(`PostHog (no-op): capture ${eventName}`, properties);
        },
        identify: (distinctId: string, properties?: any) => {
          console.log(`PostHog (no-op): identify ${distinctId}`, properties);
        },
        reset: () => {
          console.log('PostHog (no-op): reset');
        },
        screen: (screenName: string, properties?: any) => {
          console.log(`PostHog (no-op): screen ${screenName}`, properties);
        },
        get_session_id: () => 'mock-session-id',
        sessionRecording: {
          isRecordingEnabled: () => false,
          startRecording: () => {},
        }
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
      get_session_id: () => 'error-session-id',
      sessionRecording: {
        isRecordingEnabled: () => false,
        startRecording: () => {},
      }
    };
    initialized = true;
  }
  
  return posthog;
}

// Initialize on module load for web platform only
if (Platform.OS === 'web') {
  initializePostHog();
}

export { posthog, initializePostHog };