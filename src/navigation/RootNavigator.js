import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import colors from '../theme/colors';

import ParserScreen from '../screens/ParserScreen';
import BookScreen from '../screens/BookScreen';
import RecipeScreen from '../screens/RecipeScreen';
import CookingModeScreen from '../screens/CookingModeScreen';
import PriceComparisonScreen from '../screens/PriceComparisonScreen';
import PantryScreen from '../screens/PantryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator({ navigationRef }) {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Parser"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Parser" component={ParserScreen} />
        <Stack.Screen name="Pantry" component={PantryScreen} />
        <Stack.Screen name="Book" component={BookScreen} />
        <Stack.Screen name="Recipe" component={RecipeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="CookingMode"
          component={CookingModeScreen}
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PriceComparison"
          component={PriceComparisonScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
