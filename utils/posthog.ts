import posthogJS from 'posthog-js';
import { Platform } from 'react-native';

// Initialize PostHog for web (Vercel) - works with Expo web
let posthog: any = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
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
}

// Note: For future native app deployment, you'll need to conditionally 
// load posthog-react-native instead, but for now this works for Vercel

export { posthog };