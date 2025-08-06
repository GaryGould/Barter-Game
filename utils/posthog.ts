import posthogJS from 'posthog-js';

// Initialize PostHog for web (Vercel) - works with Expo web
let posthog: any = null;

if (typeof window !== 'undefined') {
  posthog = posthogJS.init('phc_KvxX7mU1WMHNh1lQsLUyryTaRBzTS3nUiP2b0tqQU6U', {
    api_host: 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
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