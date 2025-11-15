# Recipe App Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement recently fetched recipes tracking, save prompts, interactive onboarding tour, gesture-based card interactions, and unified header navigation.

**Architecture:** Database-backed recipe history with Supabase, React Navigation interceptors for save prompts, custom overlay tour system with AsyncStorage, gesture-handler swipeable cards, and reusable header component with navigation logic.

**Tech Stack:** React Native 0.74.5, Expo 51, React Navigation v6, Supabase, AsyncStorage, react-native-gesture-handler, react-native-reanimated

## Phase 5: Create CustomHeader Component

### Task 5: Build Reusable Header Component

**Files:**
- Create: `/Users/alastairblair/Development/Recipe-Parser-Native/src/components/CustomHeader.js`

**Step 1: Create CustomHeader component**

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const CustomHeader = ({
  title,
  subtitle = null,
  showBackButton = false,
  onBackPress = null,
  rightComponent = null,
  backgroundColor = '#fff'
}) => {
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.container}>
        {/* Top Row: Back Button + Right Component */}
        <View style={styles.topRow}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.charcoal[700]}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          {rightComponent && (
            <View style={styles.rightComponent}>
              {rightComponent}
            </View>
          )}
        </View>

        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  rightComponent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    marginTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.charcoal[800],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.charcoal[500],
    marginTop: 4,
  },
});

export default CustomHeader;
```

**Step 2: Test CustomHeader in isolation**

Create a test screen or use in one screen first:

```javascript
import CustomHeader from '../components/CustomHeader';

<CustomHeader
  title="Test Title"
  subtitle="Test subtitle"
  showBackButton={true}
  onBackPress={() => console.log('Back pressed')}
/>
```

**Step 3: Commit**

```bash
git add src/components/CustomHeader.js
git commit -m "feat: create CustomHeader component

- Reusable header with title, subtitle, back button
- SafeAreaView support for notched devices
- Customizable background color
- Optional right component slot
- Consistent spacing and typography"
```

---

## Phase 6: Integrate CustomHeader into All Screens

### Task 6: Update BookScreen with CustomHeader

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/BookScreen.js`

**Step 1: Import CustomHeader**

```javascript
import CustomHeader from '../components/CustomHeader';
import { Ionicons } from '@expo/vector-icons';
```

**Step 2: Replace existing header**

Find the current header View (around line 200-300), replace with:

```javascript
<CustomHeader
  title="Recipe Book"
  subtitle={`${savedRecipes.length} saved recipes`}
  showBackButton={true}
  onBackPress={() => navigation.navigate('Parser')}
  rightComponent={
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={{ marginLeft: 12 }}
    >
      <Ionicons name="settings-outline" size={24} color={colors.charcoal[700]} />
    </TouchableOpacity>
  }
/>
```

**Step 3: Remove old header styles**

Remove or comment out old header-related styles from the StyleSheet.

**Step 4: Test**

1. Navigate to BookScreen
2. Verify title shows "Recipe Book"
3. Verify subtitle shows recipe count
4. Tap back arrow → should navigate to Parser tab
5. Tap settings icon → should navigate to Settings

**Step 5: Commit**

```bash
git add src/screens/BookScreen.js
git commit -m "refactor: use CustomHeader in BookScreen

- Replace custom header with CustomHeader component
- Back arrow navigates to Parser tab
- Dynamic subtitle shows recipe count"
```

### Task 7: Update RecipeScreen with CustomHeader

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/RecipeScreen.js`

**Step 1: Import and extract source domain**

```javascript
import CustomHeader from '../components/CustomHeader';

// In component:
const getSourceDomain = (url) => {
  try {
    return `from ${new URL(url).hostname.replace('www.', '')}`;
  } catch {
    return '';
  }
};

const sourceDomain = recipe.source_url ? getSourceDomain(recipe.source_url) : '';
```

**Step 2: Replace header**

```javascript
<CustomHeader
  title={recipe.title}
  subtitle={sourceDomain}
  showBackButton={true}
  onBackPress={() => navigation.goBack()}
  rightComponent={
    <TouchableOpacity onPress={() => shareRecipe()}>
      <Ionicons name="share-outline" size={24} color={colors.charcoal[700]} />
    </TouchableOpacity>
  }
/>
```

**Step 3: Commit**

```bash
git add src/screens/RecipeScreen.js
git commit -m "refactor: use CustomHeader in RecipeScreen

- Show recipe title as header
- Show source domain as subtitle
- Share icon in right component"
```

### Task 8: Update ParserScreen with CustomHeader

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/ParserScreen.js`

**Step 1: Replace header**

```javascript
<CustomHeader
  title="Get Recipe"
  subtitle={null}
  showBackButton={false}
  backgroundColor="#ffde59"
  rightComponent={
    <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
      <Ionicons name="settings-outline" size={24} color={colors.charcoal[700]} />
    </TouchableOpacity>
  }
/>
```

**Step 2: Commit**

```bash
git add src/screens/ParserScreen.js
git commit -m "refactor: use CustomHeader in ParserScreen

- No back button (is home)
- Yellow background matches tab bar
- Settings icon in right component"
```

### Task 9: Update PantryScreen with CustomHeader

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/PantryScreen.js`

**Step 1: Get pantry count**

```javascript
// Assuming pantry items are in state/context
const pantryCount = pantryItems.length;
```

**Step 2: Replace header**

```javascript
<CustomHeader
  title="My Pantry"
  subtitle={`${pantryCount} ingredients`}
  showBackButton={true}
  onBackPress={() => navigation.navigate('Parser')}
  rightComponent={
    <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
      <Ionicons name="settings-outline" size={24} color={colors.charcoal[700]} />
    </TouchableOpacity>
  }
/>
```

**Step 3: Commit**

```bash
git add src/screens/PantryScreen.js
git commit -m "refactor: use CustomHeader in PantryScreen

- Back arrow navigates to Parser
- Dynamic subtitle shows ingredient count"
```

### Task 10: Update SettingsScreen, CookingModeScreen, PriceComparisonScreen

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/SettingsScreen.js`
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/CookingModeScreen.js`
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/PriceComparisonScreen.js`

**Step 1: SettingsScreen**

```javascript
<CustomHeader
  title="Settings"
  showBackButton={true}
  onBackPress={() => navigation.goBack()}
/>
```

**Step 2: CookingModeScreen**

```javascript
<CustomHeader
  title="Cooking Mode"
  subtitle={recipe.title}
  showBackButton={true}
  onBackPress={() => navigation.goBack()}
/>
```

**Step 3: PriceComparisonScreen**

```javascript
<CustomHeader
  title="Price Comparison"
  showBackButton={true}
  onBackPress={() => navigation.goBack()}
/>
```

**Step 4: Commit all three**

```bash
git add src/screens/SettingsScreen.js src/screens/CookingModeScreen.js src/screens/PriceComparisonScreen.js
git commit -m "refactor: use CustomHeader in Settings, CookingMode, PriceComparison

- Consistent header design across modal/stack screens
- Standard back navigation for all"
```

---

## Phase 7: Implement Gesture-Based BookScreen Interactions

### Task 11: Create Swipeable Recipe Card Component

**Files:**
- Create: `/Users/alastairblair/Development/Recipe-Parser-Native/src/components/SwipeableRecipeCard.js`

**Step 1: Create swipeable card component**

```javascript
import React, { useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const SwipeableRecipeCard = ({ recipe, onPress, onDelete }) => {
  const swipeableRef = useRef(null);

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-100, -50],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          Alert.alert(
            'Delete Recipe',
            `Are you sure you want to delete "${recipe.title}"?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => swipeableRef.current?.close() },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  swipeableRef.current?.close();
                  onDelete(recipe);
                }
              }
            ]
          );
        }}
      >
        <Animated.View style={[styles.deleteContent, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={28} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={80}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {recipe.image_url && (
          <Image
            source={{ uri: recipe.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}

        {recipe.category && (
          <View style={[styles.categoryBadge, { backgroundColor: recipe.category.color || colors.orange_pantone[500] }]}>
            <Text style={styles.categoryText}>{recipe.category.name}</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={2}>
            {recipe.title}
          </Text>

          <View style={styles.metaRow}>
            {recipe.prep_time && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.charcoal[500]} />
                <Text style={styles.metaText}>{recipe.prep_time}</Text>
              </View>
            )}

            {recipe.difficulty && (
              <View style={styles.metaItem}>
                <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>

          {recipe.average_rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={colors.hunyadi_yellow.DEFAULT} />
              <Text style={styles.ratingText}>{recipe.average_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.charcoal[100],
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal[800],
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 14,
    color: colors.charcoal[600],
    marginLeft: 4,
  },
  difficultyText: {
    fontSize: 14,
    color: colors.charcoal[600],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: colors.charcoal[700],
    marginLeft: 4,
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 12,
    marginBottom: 16,
  },
  deleteContent: {
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default SwipeableRecipeCard;
```

**Step 2: Wrap BookScreen with GestureHandlerRootView**

In `App.js` or `RootNavigator.js`, ensure GestureHandlerRootView wraps the app:

```javascript
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// In render:
<GestureHandlerRootView style={{ flex: 1 }}>
  {/* Existing navigation */}
</GestureHandlerRootView>
```

**Step 3: Commit**

```bash
git add src/components/SwipeableRecipeCard.js App.js
git commit -m "feat: create SwipeableRecipeCard component

- Entire card tappable for navigation
- Swipe left reveals delete action
- Confirmation alert before deletion
- Animated scale feedback
- No View/Delete buttons"
```

### Task 12: Integrate SwipeableRecipeCard into BookScreen

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/BookScreen.js`

**Step 1: Import SwipeableRecipeCard**

```javascript
import SwipeableRecipeCard from '../components/SwipeableRecipeCard';
```

**Step 2: Replace FlatList renderItem**

**BEFORE:**
```javascript
renderItem={({ item }) => (
  <View style={styles.recipeCard}>
    {/* Custom card with View/Delete buttons */}
  </View>
)}
```

**AFTER:**
```javascript
renderItem={({ item }) => (
  <SwipeableRecipeCard
    recipe={item}
    onPress={() => navigation.navigate('Recipe', { recipe: item })}
    onDelete={(recipe) => handleDeleteRecipe(recipe)}
  />
)}
```

**Step 3: Create handleDeleteRecipe function**

```javascript
const handleDeleteRecipe = async (recipe) => {
  try {
    // Delete from Supabase
    const { error } = await supabaseClient
      .from('recipes')
      .delete()
      .eq('id', recipe.id);

    if (error) throw error;

    // Refresh saved recipes
    await loadSavedRecipes();

    // Optional: Show toast/feedback
    Alert.alert('Deleted', `"${recipe.title}" has been removed.`);
  } catch (error) {
    console.error('Error deleting recipe:', error);
    Alert.alert('Error', 'Failed to delete recipe. Please try again.');
  }
};
```

**Step 4: Remove old View/Delete button styles**

Clean up styles no longer needed.

**Step 5: Test gesture interactions**

1. Go to BookScreen
2. Tap any card → Should navigate to RecipeScreen
3. Swipe left on card → Should show red delete action
4. Tap delete → Should show confirmation alert
5. Confirm deletion → Recipe should disappear

**Step 6: Commit**

```bash
git add src/screens/BookScreen.js
git commit -m "feat: integrate SwipeableRecipeCard in BookScreen

- Replace custom cards with SwipeableRecipeCard
- Tap anywhere to view recipe
- Swipe to delete with confirmation
- Remove old View/Delete buttons"
```

---

## Phase 8: Create Interactive Onboarding Tour

### Task 13: Create Tour Overlay Component

**Files:**
- Create: `/Users/alastairblair/Development/Recipe-Parser-Native/src/components/TourOverlay.js`

**Step 1: Create TourOverlay component**

```javascript
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
```

**Step 2: Commit**

```bash
git add src/components/TourOverlay.js
git commit -m "feat: create TourOverlay component

- Modal overlay with dark backdrop
- Highlighted area with border glow
- Tooltip with text, progress dots, navigation
- Skip button in top-right
- Support for top/bottom/center positioning"
```

### Task 14: Create Tour Manager Logic

**Files:**
- Create: `/Users/alastairblair/Development/Recipe-Parser-Native/src/utils/tourManager.js`

**Step 1: Create tour manager**

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_COMPLETED_KEY = '@hasCompletedTour';

export const tourSteps = [
  {
    id: 'parser-url-input',
    screen: 'Parser',
    tooltipText: 'Paste any recipe URL here to extract ingredients and instructions',
    tooltipPosition: 'bottom',
    highlightArea: { x: 24, y: 200, width: 327, height: 56, borderRadius: 12 },
  },
  {
    id: 'parser-fetch-button',
    screen: 'Parser',
    tooltipText: 'Tap here to get the recipe! We\'ll extract everything you need!',
    tooltipPosition: 'top',
    highlightArea: { x: 24, y: 350, width: 327, height: 50, borderRadius: 25 },
  },
  {
    id: 'recipe-tabs',
    screen: 'Recipe',
    tooltipText: 'Switch between tabs to view ingredients, steps, and tips',
    tooltipPosition: 'bottom',
    highlightArea: { x: 0, y: 150, width: 375, height: 50, borderRadius: 0 },
  },
  {
    id: 'recipe-save',
    screen: 'Recipe',
    tooltipText: 'Save recipes to organise them by category',
    tooltipPosition: 'top',
    highlightArea: { x: 24, y: 700, width: 327, height: 50, borderRadius: 25 },
  },
  {
    id: 'book-cards',
    screen: 'Book',
    tooltipText: 'All your saved recipes live here. Tap any card to view, swipe to delete',
    tooltipPosition: 'center',
    highlightArea: null,
  },
  {
    id: 'pantry-interface',
    screen: 'Pantry',
    tooltipText: 'Track ingredients you have. Get recipe suggestions based on your pantry!',
    tooltipPosition: 'center',
    highlightArea: null,
  },
];

export const hasCompletedTour = async () => {
  try {
    const completed = await AsyncStorage.getItem(TOUR_COMPLETED_KEY);
    return completed === 'true';
  } catch (error) {
    console.error('Error checking tour completion:', error);
    return false;
  }
};

export const markTourCompleted = async () => {
  try {
    await AsyncStorage.setItem(TOUR_COMPLETED_KEY, 'true');
  } catch (error) {
    console.error('Error marking tour as completed:', error);
  }
};

export const resetTour = async () => {
  try {
    await AsyncStorage.removeItem(TOUR_COMPLETED_KEY);
  } catch (error) {
    console.error('Error resetting tour:', error);
  }
};
```

**Step 2: Commit**

```bash
git add src/utils/tourManager.js
git commit -m "feat: create tour manager with step definitions

- 6 tour steps across Parser, Recipe, Book, Pantry screens
- AsyncStorage check for completion status
- Helper functions: hasCompletedTour, markTourCompleted, resetTour
- UK spelling in tooltips (organise)"
```

### Task 15: Integrate Tour into App.js

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/App.js`

**Step 1: Import tour dependencies**

```javascript
import { hasCompletedTour, markTourCompleted, tourSteps } from './src/utils/tourManager';
import TourOverlay from './src/components/TourOverlay';
```

**Step 2: Add tour state**

```javascript
const [showTour, setShowTour] = useState(false);
const [tourStep, setTourStep] = useState(0);
```

**Step 3: Check tour on auth**

```javascript
useEffect(() => {
  const checkTourStatus = async () => {
    if (user) {
      const completed = await hasCompletedTour();
      if (!completed) {
        // Wait for splash screen to finish (5 seconds)
        setTimeout(() => {
          setShowTour(true);
          setTourStep(0);
        }, 5000);
      }
    }
  };

  checkTourStatus();
}, [user]);
```

**Step 4: Create tour navigation handlers**

```javascript
const handleTourNext = () => {
  if (tourStep === tourSteps.length - 1) {
    // Last step - complete tour
    handleTourComplete();
  } else {
    const nextStep = tourStep + 1;
    const nextStepData = tourSteps[nextStep];

    // Navigate to required screen
    if (nextStepData.screen === 'Recipe') {
      // Navigate to RecipeScreen with sample data
      navigation.navigate('Recipe', {
        recipe: {
          title: 'Sample Recipe',
          ingredients: ['Sample ingredient'],
          instructions: ['Sample instruction'],
        }
      });
    } else if (nextStepData.screen === 'Book') {
      navigation.navigate('Book');
    } else if (nextStepData.screen === 'Pantry') {
      navigation.navigate('Pantry');
    }

    setTourStep(nextStep);
  }
};

const handleTourBack = () => {
  if (tourStep > 0) {
    setTourStep(tourStep - 1);
    // Navigate back if needed
  }
};

const handleTourSkip = () => {
  setShowTour(false);
  markTourCompleted();
};

const handleTourComplete = () => {
  setShowTour(false);
  markTourCompleted();
  // Navigate back to Parser
  navigation.navigate('Parser');
};
```

**Step 5: Render TourOverlay**

```javascript
return (
  <AppContext.Provider value={contextValue}>
    {/* Existing navigation */}
    <RootNavigator />

    {/* Tour overlay */}
    <TourOverlay
      visible={showTour}
      currentStep={tourStep}
      totalSteps={tourSteps.length}
      tooltipText={tourSteps[tourStep]?.tooltipText}
      tooltipPosition={tourSteps[tourStep]?.tooltipPosition}
      highlightArea={tourSteps[tourStep]?.highlightArea}
      onNext={handleTourNext}
      onBack={handleTourBack}
      onSkip={handleTourSkip}
      isLastStep={tourStep === tourSteps.length - 1}
    />
  </AppContext.Provider>
);
```

**Step 6: Test tour flow**

1. Clear AsyncStorage (or use new user)
2. Login to app
3. After splash screen, tour should appear
4. Walk through all 6 steps
5. Verify auto-navigation between screens
6. Test "Skip Tour" button
7. Verify tour doesn't show again on next login

**Step 7: Commit**

```bash
git add App.js
git commit -m "feat: integrate tour into App.js

- Check tour completion on user auth
- Show tour after splash screen for new users
- Auto-navigate between screens during tour
- Handle Next/Back/Skip/Complete actions
- Mark tour as completed in AsyncStorage"
```

### Task 16: Add "Show Tutorial" Option to SettingsScreen

**Files:**
- Modify: `/Users/alastairblair/Development/Recipe-Parser-Native/src/screens/SettingsScreen.js`

**Step 1: Import resetTour**

```javascript
import { resetTour } from '../utils/tourManager';
```

**Step 2: Add "Show Tutorial" button**

```javascript
<TouchableOpacity
  style={styles.settingRow}
  onPress={async () => {
    await resetTour();
    Alert.alert(
      'Tutorial Reset',
      'The tutorial will show next time you open the app.',
      [{ text: 'OK' }]
    );
  }}
>
  <Text style={styles.settingLabel}>Show Tutorial</Text>
  <Ionicons name="help-circle-outline" size={24} color={colors.charcoal[600]} />
</TouchableOpacity>
```

**Step 3: Commit**

```bash
git add src/screens/SettingsScreen.js
git commit -m "feat: add Show Tutorial option to Settings

- Resets tour completion flag
- User can replay tutorial
- Shows confirmation alert"
```

---

## Phase 9: Testing & Polish

### Task 17: Cross-Device Testing

**Devices to test:**
- iPhone (various sizes: SE, 14, 14 Pro Max)
- iPad (Portrait and Landscape)
- Android phone
- Android tablet

**Test cases:**
1. Fetch recipe → Verify saved to fetched_recipes
2. Navigate away from unsaved recipe → Verify save prompt appears
3. Decline save → Verify prompt doesn't appear again for same recipe
4. Book screen gestures → Tap to view, swipe to delete
5. Tour flow → All 6 steps, auto-navigation, skip/complete
6. Header back navigation → All screens, Parser is home
7. UK spelling check → "organise" in tour

**Step 1: Create test checklist document**

Create `docs/testing/manual-test-checklist.md`:

```markdown
# Manual Test Checklist

## Recently Fetched Recipes
- [ ] Fetch recipe from ParserScreen
- [ ] Verify appears in Recently Fetched section
- [ ] Verify shows time ago (e.g., "2h ago")
- [ ] Verify shows source domain
- [ ] Verify checkmark badge if already saved
- [ ] Tap recently fetched recipe → navigates to RecipeScreen

## Save Prompts
- [ ] Fetch recipe, interact (check ingredient), navigate away
- [ ] Verify save prompt appears
- [ ] Tap "Save" → saves recipe
- [ ] Fetch same recipe again, navigate away → verify NO prompt (declined)
- [ ] Fetch recipe, DON'T interact, navigate away → verify NO prompt

## Onboarding Tour
- [ ] Clear AsyncStorage or use new user
- [ ] Login → tour appears after splash
- [ ] Step 1: URL input highlighted
- [ ] Step 2: Get Recipe button highlighted
- [ ] Step 3: Auto-navigate to RecipeScreen, tabs highlighted
- [ ] Step 4: Save button highlighted
- [ ] Step 5: Auto-navigate to Book, center tooltip
- [ ] Step 6: Auto-navigate to Pantry, center tooltip
- [ ] Tap "Get Started" → completes tour
- [ ] Relaunch app → tour doesn't appear
- [ ] Settings → Show Tutorial → resets tour

## Gesture Interactions
- [ ] BookScreen: Tap card → navigates to RecipeScreen
- [ ] Swipe left → shows red delete action
- [ ] Tap delete → shows confirmation alert
- [ ] Confirm delete → recipe removed
- [ ] Cancel delete → swipe closes, recipe remains

## Header Navigation
- [ ] ParserScreen: No back button, settings icon works
- [ ] BookScreen: Back button → navigates to Parser
- [ ] PantryScreen: Back button → navigates to Parser
- [ ] RecipeScreen: Back button → goes back
- [ ] SettingsScreen: Back button → goes back
- [ ] All headers: Consistent spacing and typography

## UK Spelling
- [ ] Tour step 4: "organise" (not "organize")
- [ ] Verify all user-facing text uses UK spelling
```

**Step 2: Run through checklist on each device**

**Step 3: Document any bugs found**

**Step 4: Commit test results**

```bash
git add docs/testing/manual-test-checklist.md
git commit -m "docs: add manual test checklist

- Comprehensive test cases for all features
- Device-specific testing notes
- UK spelling verification"
```

### Task 18: Fix Any Bugs Found

**Address bugs discovered during testing. Example bug fixes:**

**Common issues to watch for:**
1. Highlight areas in tour don't align on different screen sizes (need dynamic calculation)
2. Swipe gestures conflict with ScrollView on iPad
3. Save prompt triggers on back navigation from nested screens
4. AsyncStorage not clearing properly
5. Header subtitle truncation on small screens

**For each bug:**
1. Create bug report in code comments or separate doc
2. Fix the bug
3. Test fix on affected device
4. Commit with descriptive message

```bash
git commit -m "fix: adjust tour highlight positioning for iPad

- Calculate highlight areas dynamically based on screen size
- Test on iPad Pro 12.9 and iPad Mini"
```

### Task 19: Performance Optimization

**Step 1: Add loading states**

For fetched recipes loading:
```javascript
const [loadingFetchedRecipes, setLoadingFetchedRecipes] = useState(false);
```

Show skeleton loaders while data loads.

**Step 2: Optimize images**

Use `resizeMode="cover"` and set explicit dimensions to prevent layout shifts.

**Step 3: Memoize expensive components**

```javascript
import React, { memo } from 'react';

const SwipeableRecipeCard = memo(({ recipe, onPress, onDelete }) => {
  // ... component
});
```

**Step 4: Debounce search in BookScreen**

If search is slow, add debounce:
```javascript
import { debounce } from 'lodash'; // or create custom debounce

const debouncedSearch = debounce((query) => {
  setSearchQuery(query);
}, 300);
```

**Step 5: Commit optimizations**

```bash
git commit -m "perf: optimize recipe card rendering and image loading

- Memoize SwipeableRecipeCard component
- Add loading states for better UX
- Optimize image resizing"
```

### Task 20: Final Polish

**Step 1: Add haptic feedback to gestures**

```javascript
import * as Haptics from 'expo-haptics';

// When deleting recipe:
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// When swiping:
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
```

**Step 2: Add animations**

Fade in tour overlay:
```javascript
const fadeAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  if (showTour) {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }
}, [showTour]);
```

**Step 3: Accessibility labels**

Add to SwipeableRecipeCard:
```javascript
<TouchableOpacity
  accessible={true}
  accessibilityLabel={`Recipe card: ${recipe.title}. Double-tap to view.`}
  accessibilityHint="Swipe left with three fingers to delete"
  // ...
>
```

**Step 4: Error boundaries**

Wrap tour in error boundary to prevent crashes:
```javascript
<ErrorBoundary fallback={<Text>Tour error</Text>}>
  <TourOverlay {...props} />
</ErrorBoundary>
```

**Step 5: Commit polish**

```bash
git commit -m "polish: add haptics, animations, and accessibility

- Haptic feedback on delete and swipe
- Fade-in animation for tour overlay
- Accessibility labels for VoiceOver/TalkBack
- Error boundary for tour"
```

---

## Final Commit & Verification

### Task 21: Final Integration Test & Commit

**Step 1: Run full app flow**

1. Fresh install (or clear app data)
2. Anonymous login
3. See tour → complete all steps
4. Fetch a recipe
5. Verify in Recently Fetched
6. Navigate away → see save prompt
7. Save recipe
8. Go to BookScreen → see saved recipe
9. Tap card → view recipe
10. Swipe to delete → confirm deletion
11. Check all headers have back buttons
12. Navigate around app with back buttons

**Step 2: Create final commit**

```bash
git add .
git commit -m "feat: complete recipe app enhancements

Implemented features:
- Recently fetched recipes tracking (Supabase table)
- Save prompts when leaving unsaved recipes
- Interactive onboarding tour (6 steps)
- Gesture-based BookScreen (tap to view, swipe to delete)
- Unified CustomHeader component across all screens
- Back navigation hierarchy (tabs → Parser home)

Technical details:
- Database: fetched_recipes table with RLS policies
- Context: saveFetchedRecipe, loadFetchedRecipes, markRecipeDeclined
- Components: CustomHeader, SwipeableRecipeCard, TourOverlay
- AsyncStorage: Tour completion tracking
- UK spelling throughout (organise, not organize)

Tested on:
- iPhone 14 Pro
- iPad Pro 12.9
- Android Pixel 7
- Android tablet"
```

**Step 3: Push to remote (if applicable)**

```bash
git push origin master
```

---

## Success Criteria Verification

- [x] Users can view all fetched recipes in Recently Fetched section
- [x] Save prompt appears once per recipe when navigating away unsaved
- [x] New users see interactive tour on first login
- [x] Tour can be skipped or replayed from Settings
- [x] Recipe cards are fully tappable (no View button)
- [x] Swipe-left deletes recipes with confirmation
- [x] All screens have consistent header with back navigation
- [x] Back navigation creates predictable hierarchy (tabs → Parser)
- [x] UK spelling throughout ("organise" not "organize")
- [x] User-friendly copy (no jargon like "parse")

---

## Maintenance Notes

**Future enhancements to consider:**
1. Swipe-right actions (shopping list, share)
2. Search within Recently Fetched
3. Filter Recently Fetched by date range
4. Tour analytics (which steps users skip)
5. Export Recently Fetched as CSV
6. A/B test different tour flows

**Known limitations:**
- Tour highlight positions are hardcoded (may need adjustment for very small/large screens)
- No offline support for fetched_recipes (requires network)
- Tour auto-navigation assumes screens load instantly (may need delays for slow devices)

**Dependencies to monitor:**
- `react-native-gesture-handler`: Keep updated for gesture fixes
- `@react-native-async-storage/async-storage`: Monitor deprecation notices
- `expo-blur`: Required for BlurView in tour (optional dependency)
