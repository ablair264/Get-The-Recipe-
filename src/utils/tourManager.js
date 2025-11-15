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
