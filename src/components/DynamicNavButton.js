import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Image } from 'react-native';

const DynamicNavButton = ({
  mode = 'default', // 'default', 'paste', 'save'
  onPress = null,
  showGlow = false,
}) => {
  const glowAnim = useRef(new Animated.Value(0.85)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showGlow) {
      // Pulsing glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.85,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      glowAnim.setValue(1);
    }
  }, [showGlow]);

  const renderContent = () => {
    if (mode === 'paste') {
      return (
        <View style={styles.textContainer}>
          <Text style={styles.modeText}>Paste</Text>
        </View>
      );
    }

    if (mode === 'save') {
      return (
        <View style={styles.textContainer}>
          <Text style={styles.modeText}>Save</Text>
        </View>
      );
    }

    if (mode === 'get-recipe') {
      return (
        <View style={styles.textContainer}>
          <Text style={styles.modeTextSmall}>Get Recipe</Text>
        </View>
      );
    }

    if (mode === 'add-ingredient') {
      return (
        <View style={styles.textContainer}>
          <Text style={styles.modeTextSmall}>Add</Text>
        </View>
      );
    }

    if (mode === 'help') {
      return (
        <View style={styles.textContainer}>
          <Text style={styles.modeTextSmall}>Help</Text>
        </View>
      );
    }

    // Default logo view - use actual app logo
    return (
      <View style={styles.logoInner}>
        <Image
          source={require('../../assets/images/logo-alt.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
    );
  };

  const containerSize = showGlow ? 68 : 64;

  const WrapperComponent = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? {
    onPress,
    activeOpacity: 0.8,
    onPressIn: () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    },
    onPressOut: () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }).start();
    },
  } : {};

  return (
    <View style={styles.container}>
      {/* Glow layer */}
      {showGlow && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              width: containerSize + 12,
              height: containerSize + 12,
              borderRadius: (containerSize + 12) / 2,
              opacity: glowAnim.interpolate({
                inputRange: [0.85, 1],
                outputRange: [0.3, 0.6],
              }),
            },
          ]}
        />
      )}

      {/* Main button */}
      <WrapperComponent {...wrapperProps}>
        <Animated.View
          style={[
            styles.circle,
            {
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {renderContent()}
        </Animated.View>
      </WrapperComponent>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
    backgroundColor: '#074f4f',
    shadowColor: '#074f4f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
  },
  circle: {
    borderWidth: 2,
    borderColor: '#009595',
    backgroundColor: '#009595',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  innerShadowOverlay: {
    // Removed - was causing rendering issues
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modeTextSmall: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  logoInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    zIndex: 2,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
});

export default DynamicNavButton;
