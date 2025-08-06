import { Platform } from 'react-native';

let posthog: any = null;

if (Platform.OS === 'web') {
  // Web setup
  if (typeof window !== 'undefined') {
    const posthogJS = require('posthog-js').default;
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
} else {
  // React Native setup
  const PostHog = require('posthog-react-native').default;
  posthog = new PostHog(
    'phc_KvxX7mU1WMHNh1lQsLUyryTaRBzTS3nUiP2b0tqQU6U',
    {
      host: 'https://us.i.posthog.com',
      captureNativeAppLifecycleEvents: true,
      captureApplicationLifecycleEvents: true,
      autocapture: true,
      sessionRecording: true,
      sessionRecordingConfig: {
        maskAllTextInputs: false,
        maskAllImages: false,
        screenshot: true,
      }
    }
  );
}

export { posthog };