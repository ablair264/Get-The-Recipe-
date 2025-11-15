import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  StatusBar,
  Animated,
  Alert,
  Vibration,
  AppState
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { tidyInstruction } from '../utils/textCleaners';

const { width, height } = Dimensions.get('window');

// Configure notifications to show even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function CookingModeScreen({ route, navigation }) {
  const { recipe } = route.params;
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  
  // Timer state
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [timerText, setTimerText] = useState('');
  const [notificationId, setNotificationId] = useState(null);
  const [timerEndAt, setTimerEndAt] = useState(null); // epoch ms when timer should finish

  const instructions = recipe.instructions || [];
  const totalSteps = instructions.length;

  // Setup notifications
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Request notification permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Notification permissions denied');
        }
      } catch (error) {
        console.warn('Notification setup failed:', error);
      }
    };

    setupNotifications();
  }, []);

  // Timer effects: drive countdown off absolute end time so it continues while backgrounded
  useEffect(() => {
    if (timerActive && timerEndAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.round((timerEndAt - Date.now()) / 1000));
        setTimerSeconds(remaining);
        if (remaining <= 0) {
          setTimerActive(false);
          setTimerEndAt(null);
          handleTimerComplete();
        }
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [timerActive, timerEndAt]);

  // Recompute remaining when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && timerActive && timerEndAt) {
        const remaining = Math.max(0, Math.round((timerEndAt - Date.now()) / 1000));
        setTimerSeconds(remaining);
        if (remaining <= 0) {
          setTimerActive(false);
          setTimerEndAt(null);
          // Show completion feedback on return (notification may already have fired)
          handleTimerComplete();
        }
      }
    });
    return () => sub?.remove();
  }, [timerActive, timerEndAt]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, []);

  // Detect time mentions in instruction text
  const detectTimer = (text) => {
    const timePatterns = [
      /(\d+(?:-\d+)?)\s*(?:to\s+\d+\s*)?(?:minutes?|mins?)/gi,
      /(\d+(?:-\d+)?)\s*(?:to\s+\d+\s*)?(?:hours?|hrs?)/gi,
      /(\d+(?:-\d+)?)\s*(?:to\s+\d+\s*)?(?:seconds?|secs?)/gi
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0]; // Return the first time match found
      }
    }
    return null;
  };

  // Extract numeric time for timer setting
  const extractTimeInSeconds = (timeText) => {
    const minuteMatch = timeText.match(/(\d+)(?:-(\d+))?\s*(?:minutes?|mins?)/i);
    const hourMatch = timeText.match(/(\d+)(?:-(\d+))?\s*(?:hours?|hrs?)/i);
    const secondMatch = timeText.match(/(\d+)(?:-(\d+))?\s*(?:seconds?|secs?)/i);

    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      return minutes * 60;
    }
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      return hours * 3600;
    }
    if (secondMatch) {
      const seconds = parseInt(secondMatch[1]);
      return seconds;
    }
    return 0;
  };

  // Handle timer completion with notification and sound
  const handleTimerComplete = async () => {
    try {
      // Best-effort: cancel any scheduled notification to avoid duplicates
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
        } catch {}
        setNotificationId(null);
      }
      
      // Vibration
      Vibration.vibrate([500, 200, 500, 200, 500]);
      
      // Play system notification sound (handled by notification system)
      
      // Show notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Cooking Timer Complete!',
            body: `Your ${timerText} timer has finished!`,
            sound: true,
          },
          trigger: null, // Show immediately
        });
      } catch (notifError) {
        console.warn('Failed to show notification:', notifError);
      }

      // Show alert
      Alert.alert(
        '⏰ Timer Finished!',
        `Your ${timerText} timer has finished!`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.warn('Timer completion notification failed:', error);
      // Fallback to just vibration and alert
      Vibration.vibrate([500, 200, 500, 200, 500]);
      Alert.alert(
        '⏰ Timer Finished!',
        `Your ${timerText} timer has finished!`,
        [{ text: 'OK' }]
      );
    }
  };

  // Start built-in timer
  const startTimer = async (timeText) => {
    const seconds = extractTimeInSeconds(timeText);
    if (seconds > 0) {
      setTimerSeconds(seconds);
      setTimerText(timeText);
      setTimerActive(true);
      setTimerEndAt(Date.now() + seconds * 1000);
      
      // Schedule a background notification as backup
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Cooking Timer Complete!',
            body: `Your ${timeText} timer has finished!`,
            sound: true,
          },
          trigger: {
            seconds: seconds,
          },
        });
        setNotificationId(id);
      } catch (error) {
        console.warn('Failed to schedule background notification:', error);
      }
    }
  };

  // Stop timer
  const stopTimer = async () => {
    setTimerActive(false);
    setTimerSeconds(0);
    setTimerText('');
    setTimerEndAt(null);
    
    // Clear interval
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    
    // Cancel scheduled notification
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        setNotificationId(null);
      } catch (error) {
        console.warn('Failed to cancel notification:', error);
      }
    }
    
  };

  // Format seconds to display time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const exitCookingMode = () => {
    Alert.alert(
      'Exit Cooking Mode',
      'Are you sure you want to exit cooking mode?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Exit',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  // Handle swipe gestures
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === 5) { // GESTURE_STATE_END
      const { translationX, velocityX } = event.nativeEvent;
      
      if (translationX > 100 || velocityX > 500) {
        // Swipe right - previous step
        prevStep();
      } else if (translationX < -100 || velocityX < -500) {
        // Swipe left - next step
        nextStep();
      }
      
      // Reset animation
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  if (isCompleted) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#ffde59" barStyle="dark-content" />
        <View style={styles.completedContainer}>
          <Ionicons name="checkmark-circle" size={120} color="#4CAF50" />
          <Text style={styles.completedTitle}>Recipe Complete!</Text>
          <Text style={styles.completedSubtitle}>
            Enjoy your {recipe.title}
          </Text>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.finishButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentInstruction = instructions[currentStep];
  const timeInInstruction = detectTimer(currentInstruction);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar backgroundColor="#ffde59" barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={exitCookingMode} style={styles.exitButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.stepCounter}>
            {currentStep + 1} of {totalSteps}
          </Text>
          {timerActive ? (
            <TouchableOpacity onPress={stopTimer} style={styles.timerDisplay}>
              <Ionicons name="timer" size={16} color="#fff" />
              <Text style={styles.timerText}>{formatTime(timerSeconds)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentStep + 1) / totalSteps) * 100}%` }
              ]} 
            />
          </View>
        </View>

        {/* Main Content */}
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={[styles.instructionContainer, { transform: [{ translateX }] }]}>
            <Text style={styles.stepNumber}>Step {currentStep + 1}</Text>
            <Text style={styles.instructionText}>
              {tidyInstruction(currentInstruction)}
            </Text>
            
            {/* Timer Button */}
            {timeInInstruction && !timerActive && (
              <TouchableOpacity
                style={styles.timerButton}
                onPress={() => startTimer(timeInInstruction)}
              >
                <Ionicons name="timer-outline" size={24} color="#fff" />
                <Text style={styles.timerButtonText}>
                  Start Timer: {timeInInstruction}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Stop Timer Button (only when timer is active) */}
            {timerActive && (
              <TouchableOpacity
                style={styles.stopTimerButton}
                onPress={stopTimer}
              >
                <Ionicons name="stop" size={20} color="#fff" />
                <Text style={styles.stopTimerText}>Stop Timer</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </PanGestureHandler>

        {/* Navigation */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
            onPress={prevStep}
            disabled={currentStep === 0}
          >
            <Ionicons 
              name="chevron-back" 
              size={32} 
              color={currentStep === 0 ? '#ccc' : '#333'} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={nextStep}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === totalSteps - 1 ? 'Complete' : 'Next Step'}
            </Text>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Swipe Hint */}
        <Text style={styles.swipeHint}>
          Swipe left/right or tap buttons to navigate
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffde59',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff8243',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  progressBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff8243',
    borderRadius: 4,
  },
  instructionContainer: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ff8243',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff8243',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 12,
    marginTop: 20,
  },
  timerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  stopTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    marginTop: 20,
  },
  stopTimerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  navButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff8243',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    paddingBottom: 20,
    fontStyle: 'italic',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completedTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#333',
    marginTop: 30,
    marginBottom: 10,
    textAlign: 'center',
  },
  completedSubtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  finishButton: {
    backgroundColor: '#ff8243',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
