import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import DynamicNavButton from './DynamicNavButton';

const CurvedBottomBar = ({ navigation, activeRoute, dynamicButtonMode = 'default', dynamicButtonShowGlow = false, dynamicButtonOnPress = null }) => {
  const isActive = (routeName) => activeRoute === routeName;

  return (
    <View style={styles.container}>
      {/* SVG Curved Background */}
      <Svg
        width="100%"
        height="90"
        viewBox="0 0 375 90"
        preserveAspectRatio="none"
        style={styles.svgBackground}
      >
        <Path
          d="M 0 20 Q 0 0 20 0 L 140 0 Q 150 0 155 10 Q 162.5 25 187.5 25 Q 212.5 25 220 10 Q 225 0 235 0 L 355 0 Q 375 0 375 20 L 375 90 L 0 90 Z"
          fill="#ff8243"
        />
      </Svg>

      {/* Navigation Items */}
      <View style={styles.navContent}>
        {/* Home */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Parser')}
        >
          <Ionicons
            name="home"
            size={24}
            color={isActive('Parser') ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <Text style={[styles.navText, isActive('Parser') && styles.navTextActive]}>
            Home
          </Text>
        </TouchableOpacity>

        {/* Recipes */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Book')}
        >
          <Ionicons
            name="book"
            size={24}
            color={isActive('Book') ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <Text style={[styles.navText, isActive('Book') && styles.navTextActive]}>
            Recipes
          </Text>
        </TouchableOpacity>

        {/* Center Dynamic Button - Placeholder for spacing */}
        <View style={styles.centerPlaceholder} />

        {/* Pantry */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Pantry')}
        >
          <Ionicons
            name="basket"
            size={24}
            color={isActive('Pantry') ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <Text style={[styles.navText, isActive('Pantry') && styles.navTextActive]}>
            Pantry
          </Text>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons
            name="settings"
            size={24}
            color={isActive('Settings') ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <Text style={[styles.navText, isActive('Settings') && styles.navTextActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Center Button */}
      <View style={styles.centerButtonContainer}>
        <DynamicNavButton
          mode={dynamicButtonMode}
          showGlow={dynamicButtonShowGlow}
          onPress={dynamicButtonOnPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: 90,
    backgroundColor: 'transparent',
  },
  svgBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  navContent: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  navTextActive: {
    color: '#fff',
  },
  centerPlaceholder: {
    flex: 1,
  },
  centerButtonContainer: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});

export default CurvedBottomBar;
