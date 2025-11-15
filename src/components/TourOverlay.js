import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import colors from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TourOverlay = ({
  visible,
  currentStep,
  totalSteps,
  tooltipText,
  tooltipPosition = 'center',
  highlightArea = null, // { x, y, width, height }
  onNext,
  onBack,
  onSkip,
  isLastStep = false
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dark backdrop */}
        <View style={styles.backdrop} />

        {/* Highlight area (clear spot) */}
        {highlightArea && (
          <View
            style={[
              styles.highlightCircle,
              {
                left: highlightArea.x,
                top: highlightArea.y,
                width: highlightArea.width,
                height: highlightArea.height,
                borderRadius: highlightArea.borderRadius || highlightArea.width / 2,
              }
            ]}
          />
        )}

        {/* Tooltip */}
        <View style={[
          styles.tooltip,
          tooltipPosition === 'top' && styles.tooltipTop,
          tooltipPosition === 'bottom' && styles.tooltipBottom,
          tooltipPosition === 'center' && styles.tooltipCenter,
        ]}>
          <Text style={styles.tooltipText}>{tooltipText}</Text>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentStep && styles.dotActive
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.nextButton} onPress={onNext}>
              <Text style={styles.nextButtonText}>
                {isLastStep ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip Tour</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  highlightCircle: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: colors.orange_pantone[500],
    shadowColor: colors.orange_pantone[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipTop: {
    top: 100,
    left: 24,
    right: 24,
  },
  tooltipBottom: {
    bottom: 100,
    left: 24,
    right: 24,
  },
  tooltipCenter: {
    top: SCREEN_HEIGHT / 2 - 100,
    left: 24,
    right: 24,
  },
  tooltipText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.charcoal[800],
    marginBottom: 20,
    textAlign: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.charcoal[300],
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.orange_pantone[500],
    width: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.charcoal[600],
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: colors.orange_pantone[500],
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default TourOverlay;
