/**
 * Development Mode Configuration
 * 
 * This utility provides a centralized way to control development-only features.
 * Set ENABLE_DEV_FEATURES to false when taking store screenshots or for production builds.
 */

/**
 * Master switch for all development features
 * Set to false to hide all dev features (useful for store screenshots)
 */
export const ENABLE_DEV_FEATURES = false;

/**
 * Check if development features should be shown
 * This combines the manual override with React Native's __DEV__ flag
 */
export const isDevModeEnabled = (): boolean => {
  return ENABLE_DEV_FEATURES && __DEV__;
};

/**
 * Use this instead of __DEV__ directly when you want the ability
 * to turn off dev features even in development builds
 */
export const showDevFeatures = isDevModeEnabled();