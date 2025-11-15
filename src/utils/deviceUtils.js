import { Dimensions, Platform } from 'react-native';
import { useState, useEffect } from 'react';

// Device type detection
export const getDeviceType = (dims) => {
  const { width, height } = dims || Dimensions.get('window');
  const aspectRatio = width / height;
  
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // iPad detection for iOS
    if (Platform.OS === 'ios' && (width >= 768 || height >= 768)) {
      return 'tablet';
    }
    // Android tablet detection
    if (Platform.OS === 'android' && (width >= 768 || height >= 768)) {
      return 'tablet';
    }
    return 'phone';
  }
  
  return 'web';
};

// Orientation detection
export const getOrientation = (dims) => {
  const { width, height } = dims || Dimensions.get('window');
  return width > height ? 'landscape' : 'portrait';
};

// Custom hook for responsive design
export const useResponsiveLayout = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [deviceType, setDeviceType] = useState(getDeviceType());
  const [orientation, setOrientation] = useState(getOrientation());

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setDeviceType(getDeviceType(window));
      setOrientation(getOrientation(window));
    });

    return () => subscription?.remove();
  }, []);

  const isTablet = deviceType === 'tablet';
  const isPhone = deviceType === 'phone';
  const isLandscape = orientation === 'landscape';
  const isPortrait = orientation === 'portrait';

  return {
    dimensions,
    deviceType,
    orientation,
    isTablet,
    isPhone,
    isLandscape,
    isPortrait,
    isTabletLandscape: isTablet && isLandscape,
    isTabletPortrait: isTablet && isPortrait,
  };
};

// Layout constants for different screen sizes
export const LAYOUT_BREAKPOINTS = {
  phone: {
    maxWidth: 767,
  },
  tablet: {
    minWidth: 768,
    portrait: {
      minWidth: 768,
      maxWidth: 1024,
    },
    landscape: {
      minWidth: 1024,
    },
  },
};

// iPad specific layout constants
export const IPAD_LAYOUT = {
  portrait: {
    filterHeight: 60,
    recipeCardHeight: 200,
    contentPadding: 20,
    columnGap: 16,
  },
  landscape: {
    leftColumnWidth: '20%',
    middleColumnWidth: '40%',
    rightColumnWidth: '40%',
    contentPadding: 24,
    columnGap: 20,
    recipeCardHeight: 180,
  },
};

// Color scheme
export const COLORS = {
  primary: '#ffa404',
  primaryLight: '#ffb84d',
  primaryDark: '#cc8300',
  background: '#f5f5f5',
  white: '#ffffff',
  text: '#333333',
  textLight: '#666666',
  border: '#e0e0e0',
  shadow: 'rgba(0, 0, 0, 0.1)',
};
