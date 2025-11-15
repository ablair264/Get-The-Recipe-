import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Button,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView, 
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import RootNavigator from './src/navigation/RootNavigator';
import { AppContext } from './src/context/AppContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as AppleAuthentication from 'expo-apple-authentication';

// Complete the authentication session
WebBrowser.maybeCompleteAuthSession();

import supabase from './src/services/supabase';
import { convertIngredientsToUK, hasUSMeasurements } from './src/utils/measurementConverter';
import { hasCompletedTour, markTourCompleted, tourSteps } from './src/utils/tourManager';
import TourOverlay from './src/components/TourOverlay';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const { width, height } = Dimensions.get('window');


// Color theme
const colors = {
  charcoal: {
    DEFAULT: '#2f4858',
    100: '#090e11',
    200: '#131c22',
    300: '#1c2b34',
    400: '#253945',
    500: '#2f4858',
    600: '#496f87',
    700: '#6c96b0',
    800: '#9db9ca',
    900: '#cedce5'
  },
  lapis_lazuli: {
    DEFAULT: '#33658a',
    100: '#0a141c',
    200: '#142837',
    300: '#1f3c53',
    400: '#29506e',
    500: '#33658a',
    600: '#4486b9',
    700: '#72a5cb',
    800: '#a1c3dc',
    900: '#d0e1ee'
  },
  carolina_blue: {
    DEFAULT: '#86bbd8',
    100: '#112935',
    200: '#22516a',
    300: '#347a9f',
    400: '#529ec7',
    500: '#86bbd8',
    600: '#a0c9e0',
    700: '#b7d7e8',
    800: '#cfe4f0',
    900: '#e7f2f7'
  },
  hunyadi_yellow: {
    DEFAULT: '#f6ae2d',
    100: '#382502',
    200: '#704a05',
    300: '#a76f07',
    400: '#df9409',
    500: '#f6ae2d',
    600: '#f8bf57',
    700: '#facf81',
    800: '#fbdfab',
    900: '#fdefd5'
  },
  orange_pantone: {
    DEFAULT: '#f26419',
    100: '#321303',
    200: '#642706',
    300: '#963a09',
    400: '#c84e0c',
    500: '#f26419',
    600: '#f48346',
    700: '#f7a274',
    800: '#fac1a2',
    900: '#fce0d1'
  }
};

const AnimatedGradient = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const animatedColors = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      colors.lapis_lazuli[500],
      colors.carolina_blue[400],
      colors.charcoal[600]
    ],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: animatedColors,
        },
      ]}
    >
      <LinearGradient
        colors={[
          colors.charcoal[600],
          colors.lapis_lazuli[500],
          colors.carolina_blue[400],
          colors.lapis_lazuli[600]
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
};

// URL Preview Card Component
const UrlPreviewCard = ({ preview, loading, onFetch, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (preview || loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [preview, loading]);

  if (!preview && !loading) return null;

  return (
    <Animated.View style={[styles.urlPreviewCard, { opacity: fadeAnim }]}>
      {loading ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator size="small" color={colors.lapis_lazuli[500]} />
          <Text style={styles.previewLoadingText}>Getting preview...</Text>
        </View>
      ) : preview ? (
        <>
          <View style={styles.previewHeader}>
            <View style={styles.previewContent}>
              {preview.image && (
                <Image source={{ uri: preview.image }} style={styles.previewImage} />
              )}
              <View style={styles.previewText}>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {preview.title}
                </Text>
                {preview.siteName && (
                  <Text style={styles.previewSite}>{preview.siteName}</Text>
                )}
                {preview.description && (
                  <Text style={styles.previewDescription} numberOfLines={2}>
                    {preview.description}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.previewDismiss}>
              <Ionicons name="close" size={16} color={colors.charcoal[400]} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.fetchRecipeBtn} onPress={onFetch}>
              <Ionicons name="restaurant-outline" size={16} color="#fff" style={styles.fetchBtnIcon} />
              <Text style={styles.fetchRecipeBtnText}>Fetch Recipe</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
};

// Progress Overlay Component
const ProgressOverlay = ({ visible, stage, progress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.progressOverlay, { opacity: fadeAnim }]}>
      <View style={styles.progressModal}>
        <View style={styles.progressIconContainer}>
          <LinearGradient
            colors={[colors.orange_pantone[400], colors.hunyadi_yellow[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressIconGradient}
          >
            <Ionicons name="restaurant" size={32} color="#fff" />
          </LinearGradient>
        </View>
        
        <Text style={styles.progressTitle}>Fetching Recipe</Text>
        <Text style={styles.progressStage}>{stage}</Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  })
                }
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
        </View>
        
        <View style={styles.progressDots}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressDot, progress > 25 && styles.progressDotActive]} />
          <View style={[styles.progressDot, progress > 50 && styles.progressDotActive]} />
          <View style={[styles.progressDot, progress > 75 && styles.progressDotActive]} />
        </View>
      </View>
    </Animated.View>
  );
};

// Source name helper
const getSourceName = (url) => {
  if (!url) return '';
  
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Common recipe site mappings
    const siteMap = {
      'allrecipes.com': 'AllRecipes',
      'www.allrecipes.com': 'AllRecipes',
      'foodnetwork.com': 'Food Network',
      'www.foodnetwork.com': 'Food Network',
      'food.com': 'Food.com',
      'www.food.com': 'Food.com',
      'epicurious.com': 'Epicurious',
      'www.epicurious.com': 'Epicurious',
      'delish.com': 'Delish',
      'www.delish.com': 'Delish',
      'tasteofhome.com': 'Taste of Home',
      'www.tasteofhome.com': 'Taste of Home',
      'simplyrecipes.com': 'Simply Recipes',
      'www.simplyrecipes.com': 'Simply Recipes',
      'bonappetit.com': 'Bon Appétit',
      'www.bonappetit.com': 'Bon Appétit',
      'cooking.nytimes.com': 'NYT Cooking',
      'recipes.timesofindia.com': 'Times of India',
      'bbc.co.uk': 'BBC',
      'www.bbc.co.uk': 'BBC',
      'jamieoliver.com': 'Jamie Oliver',
      'www.jamieoliver.com': 'Jamie Oliver'
    };
    
    // Check if we have a mapped name
    if (siteMap[domain]) {
      return siteMap[domain];
    }
    
    // Otherwise, clean up the domain name
    let cleanName = domain.replace('www.', '');
    
    // Remove common TLDs and make title case
    cleanName = cleanName.replace(/\.(com|co\.uk|org|net)$/, '');
    
    // Convert to title case and handle special cases
    return cleanName.split('.')[0]
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
  } catch (e) {
    return 'Unknown Source';
  }
};

// Category color helper
const getCategoryColor = (categoryName) => {
  if (!categoryName) return colors.charcoal[400];
  
  // Generate consistent color based on category name
  const categoryColors = [
    colors.orange_pantone[500],   // Orange
    colors.lapis_lazuli[500],     // Blue
    '#E74C3C',                    // Red
    '#27AE60',                    // Green
    '#9B59B6',                    // Purple
    '#F39C12',                    // Yellow-Orange
    '#1ABC9C',                    // Teal
    '#E67E22',                    // Dark Orange
    '#34495E',                    // Dark Blue-Gray
    '#16A085'                     // Dark Teal
  ];
  
  // Simple hash function to get consistent color for same category
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return categoryColors[Math.abs(hash) % categoryColors.length];
};

// Enhanced Recipe Card Component
const RecipeCard = ({ recipe, onView, onDelete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.recipeCard,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {/* Category Accent Bar */}
      <View style={[
        styles.categoryAccentBar,
        { backgroundColor: getCategoryColor(recipe.categories?.name) }
      ]}>
        <View style={styles.accentBarContent}>
          <Text style={styles.categoryAccentText}>
            {recipe.categories?.name || 'Recipe'}
          </Text>
          {recipe.prep_time && (
            <View style={styles.timeAccent}>
              <Ionicons name="time-outline" size={12} color="#FFFFFF" style={styles.timeAccentIcon} />
              <Text style={styles.timeAccentText}>{recipe.prep_time}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Recipe Content */}
      <View style={styles.recipeContent}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          
          {/* Recipe Source */}
          {recipe.sourceUrl && (
            <Text style={styles.recipeSource}>
              from {getSourceName(recipe.sourceUrl)}
            </Text>
          )}
          
          {/* Quick Stats */}
          <View style={styles.recipeStats}>
            <View style={[styles.recipeStat, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="people-outline" size={16} color={colors.lapis_lazuli[600]} style={styles.recipeStatIcon} />
              <Text style={styles.recipeStatNumber}>
                {recipe.servings ? recipe.servings.replace(/\D/g, '') || '4' : '4'}
              </Text>
              <Text style={styles.recipeStatLabel}>
                Servings
              </Text>
            </View>
            
            <View style={[styles.recipeStat, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="list-outline" size={16} color={colors.orange_pantone[600]} style={styles.recipeStatIcon} />
              <Text style={styles.recipeStatNumber}>
                {recipe.ingredients?.length || 0}
              </Text>
              <Text style={styles.recipeStatLabel}>
                Ingredients
              </Text>
            </View>
            
            <View style={[styles.recipeStat, { backgroundColor: '#E8F5E8' }]}>
              <MaterialIcons name="format-list-numbered" size={16} color="#2E7D32" style={styles.recipeStatIcon} />
              <Text style={styles.recipeStatNumber}>
                {recipe.instructions?.length || 0}
              </Text>
              <Text style={styles.recipeStatLabel}>
                Steps
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.recipeActions}>
          <TouchableOpacity 
            style={styles.viewRecipeBtn}
            onPress={() => onView(recipe)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewRecipeBtnText}>View Recipe</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={styles.viewRecipeBtnIcon} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deleteRecipeBtn}
            onPress={() => onDelete(recipe.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={colors.charcoal[500]} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [url, setUrl] = useState('');
  // Deep-link handoff to ParserScreen
  const [importedUrl, setImportedUrl] = useState(null);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [fetchingLoading, setFetchingLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [fetchedRecipes, setFetchedRecipes] = useState([]);
  const [activeView, setActiveView] = useState('parser');
  const [error, setError] = useState('');
  const [useUKMeasurements, setUseUKMeasurements] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState('');
  const [showClipboardPrompt, setShowClipboardPrompt] = useState(false);
  const lastClipboardCheck = useRef(false);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('All');
  const [userCategories, setUserCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [urlPreview, setUrlPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showRecipeScreen, setShowRecipeScreen] = useState(false);
  // Grocery matching
  const [basketStore, setBasketStore] = useState('tesco');
  const [basketMatches, setBasketMatches] = useState(null);
  const [matching, setMatching] = useState(false);
  const [showBasketModal, setShowBasketModal] = useState(false);

  // Tour state
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const navigationRef = useRef(null);

  // Check if Apple Sign In is available (iOS 13+)
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (mounted) setAppleAuthAvailable(available);
      } catch (e) {
        if (mounted) setAppleAuthAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Ensure animated splash is visible for a minimum duration
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Initialize unit preference from user metadata when session changes
  useEffect(() => {
    try {
      const pref = user?.user_metadata?.default_units;
      if (pref === 'uk') setUseUKMeasurements(true);
      else if (pref === 'us') setUseUKMeasurements(false);
    } catch (_) {}
  }, [user]);

  // Check tour status when user logs in
  useEffect(() => {
    const checkTourStatus = async () => {
      if (user && minSplashElapsed) {
        const completed = await hasCompletedTour();
        if (!completed) {
          // Wait a bit after splash screen finishes
          setTimeout(() => {
            setShowTour(true);
            setTourStep(0);
          }, 500);
        }
      }
    };

    checkTourStatus();
  }, [user, minSplashElapsed]);

  // Session check and URL handling
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        // Clear any auth errors when successfully signed in
        setAuthError('');
      }
    });

    // Handle deep links for OAuth returns and recipe imports
    const handleDeepLink = (event) => {
      const incomingUrl = typeof event === 'string' ? event : event?.url;
      if (!incomingUrl) return;
      console.log('Deep link received:', incomingUrl);
      
      // Check if this is a recipe import deep link (be flexible with path)
      if (/\/\/[^/]+\/\/import|:\/\/[^/]+\/import|:\/\/import/i.test(incomingUrl) || incomingUrl.includes('://import')) {
        try {
          const urlObj = new URL(incomingUrl);
          // Accept multiple param keys commonly used by extensions
          const urlParam = urlObj.searchParams.get('url') 
            || urlObj.searchParams.get('u') 
            || urlObj.searchParams.get('href') 
            || urlObj.searchParams.get('link') 
            || urlObj.searchParams.get('recipeUrl') 
            || urlObj.searchParams.get('page');
          const dataParam = urlObj.searchParams.get('data') || urlObj.searchParams.get('payload');
          
          if (urlParam) {
            // Simple URL-only import (new safer method)
            console.log('Recipe URL received from Safari:', urlParam);
            const recipeUrl = decodeURIComponent(urlParam);
            
            // Handoff to Parser screen via context (ParserScreen will consume it)
            try { setImportedUrl && setImportedUrl(recipeUrl); } catch {}
            
            // Show success message
            Alert.alert(
              'Recipe URL Imported!',
              'The recipe URL has been imported from Safari. Tap "Parse Recipe" to extract the recipe.',
              [{ text: 'OK' }]
            );
          }
          else if (dataParam) {
            // Legacy data import (fallback for complex data)
            if (dataParam.length > 5000) {
              throw new Error('Recipe data too large for URL import');
            }
            
            let decoded = dataParam;
            try { decoded = decodeURIComponent(dataParam); } catch {}
            // Some extensions may send base64 JSON
            try {
              if (!decoded.trim().startsWith('{') && !decoded.trim().startsWith('[')) {
                decoded = atob(decoded);
              }
            } catch {}
            const importData = JSON.parse(decoded);
            console.log('Recipe import data received:', importData);
            
            if (importData.recipe) {
              // Convert the extension recipe format to app format
              const validated = {
                title: importData.recipe.name || 'Imported Recipe',
                servings: importData.recipe.servings || '',
                prepTime: importData.recipe.prepTime || '',
                cookTime: importData.recipe.cookTime || '',
                ingredients: Array.isArray(importData.recipe.ingredients) ? importData.recipe.ingredients : [],
                instructions: Array.isArray(importData.recipe.instructions) ? 
                  importData.recipe.instructions.map(inst => 
                    typeof inst === 'string' ? inst : inst.text || inst.instruction || inst
                  ) : [],
                sourceUrl: importData.recipe.url || importData.url,
                commentsSummary: importData.recipe.description || ''
              };
              
              // Set the recipe and show the recipe screen
              setCurrentRecipe(validated);
              setShowRecipeScreen(true);
              setUrl(importData.recipe.url || '');
              
              // Show success alert
              Alert.alert(
                'Recipe Imported!',
                `"${validated.title}" has been imported from Safari.`,
                [{ text: 'OK' }]
              );
            }
          }
        } catch (error) {
          console.error('Error processing recipe import:', error);
          Alert.alert(
            'Import Error',
            'There was an issue importing the recipe. You can try copying the URL and pasting it manually.',
            [{ text: 'OK' }]
          );
        }
      }
      // OAuth handling is done in the handleGoogleSignIn function
    };

    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
    // Handle cold start deep links
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) handleDeepLink(initial);
      } catch {}
    })();

    return () => {
      subscription.unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  // Ensure an authenticated session without user interaction (anonymous sign-in)
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && typeof supabase.auth.signInAnonymously === 'function') {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.warn('Anonymous sign-in failed:', error);
            return;
          }
          if (data?.user) {
            setUser(data.user);
          }
        }
      } catch (e) {
        console.warn('Error ensuring anonymous session:', e);
      }
    })();
  }, []);

  // Load recipes and categories on auth
  useEffect(() => {
    if (user) {
      loadRecipes();
      loadCategories();
      loadFetchedRecipes();
    } else {
      setSavedRecipes([]);
      setUserCategories([]);
      setFetchedRecipes([]);
      setCurrentRecipe(null);
    }
  }, [user]);

  // Clipboard detection
  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };
  
  const handleAppleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      // Use native Apple flow and sign in to Supabase with the identity token.
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential?.identityToken) {
        throw new Error('Apple did not return an identity token');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        // nonce: optional — only needed if you pass a nonce to signInAsync
      });
      if (error) throw error;

      // Optional: update user metadata with name on first sign-in
      if (credential?.fullName && data?.user) {
        const fullName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');
        try { await supabase.auth.updateUser({ data: { full_name: fullName } }); } catch {}
      }

      setAuthLoading(false);
      setAuthError('');
    } catch (e) {
      console.error('Apple sign-in error:', e);
      setAuthError(e?.message || 'Failed to sign in with Apple');
      setAuthLoading(false);
    }
  };

  // Removed web OAuth fallback for Apple to avoid audience mismatches

  const handleApplePress = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) throw new Error('Apple Sign-In is not available on this device');
      await handleAppleSignIn();
    } catch (e) {
      console.error('Apple sign-in press error:', e);
      setAuthError(e?.message || 'Apple sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const checkClipboard = async () => {
    try {
      // Query existence only; do not read contents to avoid iOS paste prompt
      const has = await Clipboard.hasStringAsync();
      if (has && activeView === 'parser' && lastClipboardCheck.current === false) {
        setClipboardUrl('');
        setShowClipboardPrompt(true);
        lastClipboardCheck.current = true;
      }
      if (!has) {
        lastClipboardCheck.current = false;
      }
    } catch (error) {
      console.log('Clipboard check error:', error);
    }
  };

  // Listen for app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // Small delay to ensure app is fully active
        setTimeout(checkClipboard, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Check clipboard on initial load
    checkClipboard();

    return () => subscription?.remove();
  }, [user, activeView]);

  const useClipboardUrl = async () => {
    try {
      const content = await Clipboard.getStringAsync();
      if (isValidUrl(content)) {
        setUrl(content);
      } else {
        Alert.alert('Clipboard is not a URL');
      }
    } catch (e) {
      console.log('Error getting clipboard string', e);
    } finally {
      setShowClipboardPrompt(false);
    }
  };

  const dismissClipboardPrompt = () => {
    setShowClipboardPrompt(false);
  };

  // Resolve a representative image URL from a recipe page (OG image -> twitter -> link rel=image_src -> favicon)
  const resolveRecipeImageUrl = async (pageUrl) => {
    if (!pageUrl) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(pageUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const html = await res.text();

      const pick = (...regexes) => {
        for (const re of regexes) {
          const m = html.match(re);
          if (m && m[1]) return m[1];
        }
        return null;
      };

      let img = pick(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*name=["']og:image["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
        /<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i
      );
      const u = new URL(pageUrl);
      if (img) {
        if (img.startsWith('//')) return `${u.protocol}${img}`;
        if (img.startsWith('/')) return `${u.protocol}//${u.host}${img}`;
        if (!img.startsWith('http')) return `${u.protocol}//${u.host}/${img.replace(/^\//, '')}`;
        return img;
      }
      return `${u.protocol}//${u.host}/favicon.ico`;
    } catch (e) {
      try {
        const u = new URL(pageUrl);
        return `${u.protocol}//${u.host}/favicon.ico`;
      } catch (_) {
        return null;
      }
    }
  };

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, categories(name, color)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedRecipes(data || []);
    } catch (e) {
      console.warn('Error loading recipes', e);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      setUserCategories(data || []);
    } catch (e) {
      console.warn('Error loading categories', e);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Category Name Required', 'Please enter a category name.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: user.id,
          name: newCategoryName.trim()
        }])
        .select()
        .single();

      if (error) throw error;

      setUserCategories(prev => [...prev, data]);
      setNewCategoryName('');
      setShowAddCategory(false);
      setSelectedCategory(data.id);
    } catch (e) {
      console.error('Error creating category:', e);
      Alert.alert('Error', 'Failed to create category. It may already exist.');
    }
  };

  const saveFetchedRecipe = async (recipeData, sourceUrl, imageUrl) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fetched_recipes')
        .upsert({
          user_id: user.id,
          recipe_data: recipeData,
          source_url: sourceUrl,
          image_url: imageUrl,
          fetched_at: new Date().toISOString(),
          declined_save: false
        }, {
          onConflict: 'user_id,source_url',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh fetched recipes list
      await loadFetchedRecipes();
    } catch (error) {
      console.error('Error saving fetched recipe:', error);
    }
  };

  const loadFetchedRecipes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fetched_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('fetched_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setFetchedRecipes(data || []);
    } catch (error) {
      console.error('Error loading fetched recipes:', error);
      setFetchedRecipes([]);
    }
  };

  const markRecipeDeclined = async (sourceUrl) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('fetched_recipes')
        .update({ declined_save: true })
        .eq('user_id', user.id)
        .eq('source_url', sourceUrl);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking recipe as declined:', error);
    }
  };

  const handleSignUp = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data?.user?.identities?.length === 0) {
        setAuthError('Email is already registered. Please log in.');
      } else {
        Alert.alert('Check your email for the confirmation link.');
        setAuthView('login');
      }
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSavedRecipes([]);
    setCurrentRecipe(null);
  };


  // Fetch URL preview
  const fetchUrlPreview = async (inputUrl) => {
    if (!inputUrl.trim() || !isValidUrl(inputUrl)) {
      setUrlPreview(null);
      setShowPreview(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/get-url-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl })
      });
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Not JSON response, likely API endpoint doesn't exist
        console.warn('Preview API endpoint not available, skipping preview');
        setUrlPreview(null);
        setShowPreview(false);
        return;
      }
      
      const data = await res.json();
      
      if (res.ok && data) {
        setUrlPreview({
          title: data.title || 'Recipe Page',
          description: data.description || '',
          image: data.image || null,
          siteName: data.siteName || '',
          url: inputUrl
        });
        setShowPreview(true);
      } else {
        setUrlPreview(null);
        setShowPreview(false);
      }
    } catch (e) {
      console.warn('Preview fetch error:', e);
      setUrlPreview(null);
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Debounced URL input effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (url && !currentRecipe && !fetchingLoading) {
        fetchUrlPreview(url);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [url, currentRecipe, fetchingLoading]);

  const fetchRecipe = async () => {
    if (!url.trim()) {
      setError('Please enter a recipe URL');
      return;
    }
    if (!API_BASE_URL) {
      setError('Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL in .env');
      return;
    }

    setFetchingLoading(true);
    setError('');
    setCurrentRecipe(null);
    setUrlPreview(null);
    setShowPreview(false);
    
    // Progress simulation
    const progressStages = [
      { stage: 'Analyzing recipe page...', value: 20 },
      { stage: 'Extracting ingredients...', value: 40 },
      { stage: 'Finding instructions...', value: 60 },
      { stage: 'Processing nutritional info...', value: 80 },
      { stage: 'Finalizing recipe...', value: 95 }
    ];

    // Simulate progress
    for (let i = 0; i < progressStages.length; i++) {
      setProgressStage(progressStages[i].stage);
      setProgressValue(progressStages[i].value);
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    try {
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/parse-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch recipe');
      }
      const validated = {
        title: data.title || 'Untitled Recipe',
        servings: data.servings || '',
        prepTime: data.prepTime || '',
        cookTime: data.cookTime || '',
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        instructions: Array.isArray(data.instructions) ? data.instructions : [],
        sourceUrl: data.sourceUrl || url,
        commentsSummary: data.commentsSummary || ''
      };
      
      console.log('Fetched recipe data:', {
        title: validated.title,
        commentsSummary: validated.commentsSummary,
        hasComments: !!validated.commentsSummary
      });
      setProgressStage('Complete!');
      setProgressValue(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentRecipe(validated);
      setShowRecipeScreen(true);
    } catch (e) {
      console.warn('fetch error', e);
      setError('Failed to fetch recipe. Check the URL has a recipe.');
    } finally {
      setFetchingLoading(false);
      setProgressStage('');
      setProgressValue(0);
    }
  };

  const saveRecipe = async () => {
    if (!currentRecipe) return;
    setShowCategoryModal(true);
  };

  const saveRecipeWithCategory = async () => {
    if (!selectedCategory) {
      Alert.alert('Category Required', 'Please select a category for this recipe.');
      return;
    }

    try {
      console.log('Saving recipe:', {
        title: currentRecipe.title,
        user_id: user.id,
        category: selectedCategory,
        hasComments: !!currentRecipe.commentsSummary
      });
      
      const recipeData = {
        user_id: user.id,
        title: currentRecipe.title,
        category_id: selectedCategory,
        servings: currentRecipe.servings || null,
        prep_time: currentRecipe.prepTime || null,
        cook_time: currentRecipe.cookTime || null,
        ingredients: currentRecipe.ingredients || [],
        instructions: currentRecipe.instructions || [],
        source_url: currentRecipe.sourceUrl || null
      };
      
      const { data, error } = await supabase
        .from('recipes')
        .insert([recipeData])
        .select();
        
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Recipe saved successfully:', data);
      await loadRecipes();
      setShowCategoryModal(false);
      setSelectedCategory('');
      setActiveView('book');
    } catch (e) {
      console.error('Save recipe error:', e);
      Alert.alert('Save failed', `Failed to save recipe: ${e.message}`);
    }
  };

  const deleteRecipe = async (id) => {
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
      setSavedRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      Alert.alert('Delete failed', 'Could not delete recipe');
    }
  };

  const loadRecipe = (recipe) => {
    setCurrentRecipe({
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      sourceUrl: recipe.source_url,
      commentsSummary: recipe.comments_summary || ''
    });
    setShowRecipeScreen(true);
  };

  const ingredientsToDisplay = useMemo(() => {
    if (!currentRecipe) return [];
    return useUKMeasurements
      ? convertIngredientsToUK(currentRecipe.ingredients)
      : currentRecipe.ingredients;
  }, [currentRecipe, useUKMeasurements]);

  const findGroceryMatches = async () => {
    if (!currentRecipe) return;
    setMatching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/grocery-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: ingredientsToDisplay, store: basketStore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to match');
      setBasketMatches(data);
      setShowBasketModal(true);
    } catch (e) {
      Alert.alert('Grocery match failed', e.message);
    } finally {
      setMatching(false);
    }
  };


  const showAnimatedSplash = loading || !minSplashElapsed;
  if (showAnimatedSplash) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <LottieView
          source={require('./SPLASH.json')}
          autoPlay
          loop={false}
          style={styles.splashAnimation}
        />
      </SafeAreaView>
    );
  }

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);

    try {
      // Build a redirect URI that returns to the app
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'com.alastairblair.recipeparser',
        path: 'auth', // Add a specific path for auth callbacks
        useProxy: false, // Don't use proxy for OAuth redirects
      });
      
      console.log('Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;

      if (!data?.url) throw new Error('Failed to start Google OAuth');

      // Launch the flow and wait for return via deep link
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      console.log('AuthSession result', result?.type, result?.params);
      console.log('Full result:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        // Check if we have a URL to extract params from
        if (result.url && !result.params) {
          console.log('Extracting params from URL:', result.url);
          const url = new URL(result.url);
          const params = {};
          for (const [key, value] of url.searchParams.entries()) {
            params[key] = value;
          }
          // Also check hash params (common for OAuth)
          if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            for (const [key, value] of hashParams.entries()) {
              params[key] = value;
            }
          }
          result.params = params;
          console.log('Extracted params:', params);
        }
        // PKCE code flow (newer supabase-js)
        if (result.params?.code && typeof supabase.auth.exchangeCodeForSession === 'function') {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.params.code);
          if (exchangeError) throw exchangeError;
          if (!exchangeData?.session) throw new Error('No session after code exchange');
        } else if (result.params?.access_token && result.params?.refresh_token) {
          // Fallback for implicit return params
          const { data: setData, error: setError } = await supabase.auth.setSession({
            access_token: result.params.access_token,
            refresh_token: result.params.refresh_token,
          });
          if (setError) throw setError;
        } else if (result.params?.code) {
          // Older supabase-js without exchangeCodeForSession: force implicit flow next time
          throw new Error('App received authorization code but client cannot exchange it. Update @supabase/supabase-js to >= 2.55 or switch to implicit flow.');
        } else {
          console.log('No auth params found. Available params:', Object.keys(result.params || {}));
          throw new Error('Authentication completed but no access tokens received. Check Supabase OAuth configuration.');
        }
      } else if (result.type === 'cancel') {
        throw new Error('Authentication was cancelled');
      } else {
        throw new Error(`Authentication failed with type: ${result.type}`);
      }

      setAuthLoading(false);
      setAuthError('');
    } catch (e) {
      console.error('Google sign-in error:', e);
      setAuthError(e.message || 'Failed to sign in with Google');
      setAuthLoading(false);
    }
  };
  
  const startSessionPolling = () => {
    console.log('Starting session polling...');
    const pollInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Session detected! Google sign-in successful');
          clearInterval(pollInterval);
          setAuthLoading(false);
          setAuthError('');
          // Session will be handled by the auth state listener
        } else if (error) {
          console.error('Session polling error:', error);
          clearInterval(pollInterval);
          setAuthLoading(false);
          setAuthError('Authentication failed. Please try again.');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000); // Check every 2 seconds
    
    // Stop polling after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (authLoading) {
        setAuthLoading(false);
        setAuthError('Authentication timed out. Please try again.');
      }
    }, 300000); // 5 minutes
  };

  // Removed login/signup gate to allow core functionality without user interaction

  // Tour navigation handlers
  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      // Last step - complete tour
      handleTourComplete();
    } else {
      const nextStep = tourStep + 1;
      const nextStepData = tourSteps[nextStep];

      // Navigate to required screen
      if (navigationRef.current) {
        if (nextStepData.screen === 'Recipe') {
          // Navigate to RecipeScreen with sample data
          navigationRef.current.navigate('Recipe', {
            recipe: {
              title: 'Sample Recipe',
              ingredients: ['Sample ingredient'],
              instructions: ['Sample instruction'],
            }
          });
        } else if (nextStepData.screen === 'Book') {
          navigationRef.current.navigate('Book');
        } else if (nextStepData.screen === 'Pantry') {
          navigationRef.current.navigate('Pantry');
        }
      }

      setTourStep(nextStep);
    }
  };

  const handleTourBack = () => {
    if (tourStep > 0) {
      const prevStep = tourStep - 1;
      const prevStepData = tourSteps[prevStep];

      // Navigate back if needed
      if (navigationRef.current && prevStepData.screen === 'Parser') {
        navigationRef.current.navigate('Parser');
      }

      setTourStep(prevStep);
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
    if (navigationRef.current) {
      navigationRef.current.navigate('Parser');
    }
  };

  // Render main app via navigator + context (recipes open in their own screen)
  const contextValue = {
    API_BASE_URL,
    user,
    supabaseClient: supabase,
    savedRecipes,
    categories: ['All', ...userCategories.map(cat => cat.name)],
    deleteRecipe: async (id) => {
      try {
        const { error } = await supabase.from('recipes').delete().eq('id', id);
        if (error) throw error;
        setSavedRecipes((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        Alert.alert('Delete failed', 'Could not delete recipe');
      }
    },
    saveRecipe: async (recipe, categoryName) => {
      if (!user || !recipe) return;
      
      // Debug log to check recipe structure
      console.log('Saving recipe:', {
        title: recipe.title,
        sourceUrl: recipe.sourceUrl,
        source_url: recipe.source_url,
        allKeys: Object.keys(recipe)
      });
      
      // Validate required fields
      const sourceUrl = recipe.sourceUrl || recipe.source_url;
      if (!sourceUrl) {
        throw new Error('Recipe source URL is required');
      }
      
      // Check if recipe is already saved
      const existingRecipe = savedRecipes.find(saved => saved.source_url === sourceUrl);
      if (existingRecipe) {
        throw new Error('This recipe is already in your collection!');
      }
      
      try {
        // Find or create category
        let categoryId = null;
        if (categoryName && categoryName !== 'All') {
          const existingCategory = userCategories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category with duplicate handling
            try {
              // Generate color for the category
              const getCategoryColorForSave = (categoryName) => {
                const colors = [
                  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
                  '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24',
                ];
                let hash = 0;
                for (let i = 0; i < categoryName.length; i++) {
                  hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
                }
                const index = Math.abs(hash) % colors.length;
                return colors[index];
              };
              
              const { data: newCat, error: catError } = await supabase
                .from('categories')
                .insert([{ user_id: user.id, name: categoryName, color: getCategoryColorForSave(categoryName) }])
                .select()
                .single();
              
              if (catError) {
                if (catError.code === '23505') {
                  // Category already exists, fetch it
                  const { data: existingData } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('name', categoryName)
                    .single();
                  categoryId = existingData?.id || null;
                  if (existingData) {
                    setUserCategories(prev => {
                      const exists = prev.find(cat => cat.id === existingData.id);
                      return exists ? prev : [...prev, existingData];
                    });
                  }
                } else {
                  throw catError;
                }
              } else {
                categoryId = newCat.id;
                setUserCategories(prev => [...prev, newCat]);
              }
            } catch (e) {
              console.error('Error handling category:', e);
              // Continue without category if there's an error
            }
          }
        }
        
        // Resolve recipe image URL (best-effort; non-blocking if it fails)
        let imageUrl = null;
        try {
          imageUrl = await resolveRecipeImageUrl(sourceUrl);
        } catch (_) {}

        // Upsert shared assets record for this URL (image + basic meta)
        try {
          await supabase
            .from('recipe_assets')
            .upsert({
              recipe_url: sourceUrl,
              recipe_title: recipe.title,
              image_url: imageUrl,
              prep_time: recipe.prepTime || null,
              cook_time: recipe.cookTime || null,
              ingredients: recipe.ingredients || [],
              instructions: recipe.instructions || [],
              updated_at: new Date().toISOString(),
            }, { onConflict: 'recipe_url' });
        } catch (e) {
          console.warn('Upsert to recipe_assets failed (non-fatal):', e?.message || e);
        }

        // Save recipe with duplicate check
        const { data, error } = await supabase
          .from('recipes')
          .insert([{
            user_id: user.id,
            title: recipe.title,
            servings: recipe.servings,
            prep_time: recipe.prepTime,
            cook_time: recipe.cookTime,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            source_url: sourceUrl,
            image_url: imageUrl,
            category_id: categoryId
          }])
          .select('*, categories(name)')
          .single();
        
        if (error) {
          // Handle duplicate URL constraint if it exists
          if (error.code === '23505' && error.message.includes('source_url')) {
            throw new Error('This recipe is already in your collection!');
          }
          throw error;
        }
        
        setSavedRecipes(prev => [data, ...prev]);
        return data;
      } catch (e) {
        console.error('Error saving recipe:', e);
        throw e;
      }
    },
    addCategory: async (categoryName) => {
      if (!user || !categoryName.trim()) return;
      
      const trimmedName = categoryName.trim();
      
      // Check if category already exists locally first
      const existingCategory = userCategories.find(cat => cat.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingCategory) {
        console.log('Category already exists locally:', trimmedName);
        return existingCategory;
      }
      
      // Generate color for the category
      const getCategoryColor = (categoryName) => {
        const colors = [
          '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
          '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24',
        ];
        let hash = 0;
        for (let i = 0; i < categoryName.length; i++) {
          hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
      };
      
      const categoryColor = getCategoryColor(trimmedName);
      
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert([{ user_id: user.id, name: trimmedName, color: categoryColor }])
          .select()
          .single();
        
        if (error) {
          // Handle duplicate key error specifically
          if (error.code === '23505') {
            console.log('Category already exists in database:', trimmedName);
            // Fetch the existing category
            const { data: existingData, error: fetchError } = await supabase
              .from('categories')
              .select('*')
              .eq('user_id', user.id)
              .eq('name', trimmedName)
              .single();
            
            if (!fetchError && existingData) {
              // Add to local state if not already there
              setUserCategories(prev => {
                const exists = prev.find(cat => cat.id === existingData.id);
                return exists ? prev : [...prev, existingData];
              });
              return existingData;
            }
          }
          throw error;
        }
        
        setUserCategories(prev => [...prev, data]);
        return data;
      } catch (e) {
        console.error('Error adding category:', e);
        throw e;
      }
    },
    updateRecipeCategory: async (recipeId, categoryName) => {
      if (!user || !recipeId) return;
      try {
        let categoryId = null;
        if (categoryName && categoryName !== 'All') {
          const category = userCategories.find(cat => cat.name === categoryName);
          categoryId = category?.id || null;
        }
        
        const { error } = await supabase
          .from('recipes')
          .update({ category_id: categoryId })
          .eq('id', recipeId);
        
        if (error) throw error;
        
        // Reload recipes to reflect changes
        loadRecipes();
      } catch (e) {
        console.error('Error updating recipe category:', e);
        throw e;
      }
    },
    loadRecipeFromSaved: (recipe) => ({
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      sourceUrl: recipe.source_url,
      commentsSummary: recipe.comments_summary || ''
    }),
    updateDisplayName: async (name) => {
      try {
        const trimmed = (name || '').trim();
        const { data, error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
        if (error) throw error;
        try {
          const { data: u } = await supabase.auth.getUser();
          if (u?.user) setUser(u.user);
        } catch (_) {}
        return data?.user || null;
      } catch (e) {
        console.warn('updateDisplayName failed', e);
        throw e;
      }
    },
    useUKMeasurements,
    setUseUKMeasurements,
    ingredientsToUK: convertIngredientsToUK,
    hasUSMeasurements,
    importedUrl,
    setImportedUrl,
    fetchedRecipes,
    saveFetchedRecipe,
    loadFetchedRecipes,
    markRecipeDeclined,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <RootNavigator navigationRef={navigationRef} />

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
}
const styles = StyleSheet.create({
  // Splash styles
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffde59',
  },
  splashAnimation: {
    width: 280,
    height: 280,
  },
  // Authentication styles
  authContainer: { flex: 1, backgroundColor: '#ffde59' },
  authSafeArea: { flex: 1 },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  authBox: {
    backgroundColor: '#ffde59',
    borderRadius: 24,
    padding: 24,
    maxWidth: 380,
    alignSelf: 'center',
    width: '100%',
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    backdropFilter: 'blur(10px)',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.charcoal[500],
    marginBottom: 6,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 14,
    color: colors.charcoal[400],
    textAlign: 'center',
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: colors.carolina_blue[800],
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  authTabActive: {
    backgroundColor: colors.hunyadi_yellow[500],
    shadowColor: colors.hunyadi_yellow[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  authTabInactive: {
    backgroundColor: 'transparent',
  },
  authTabText: {
    color: colors.charcoal[400],
    fontWeight: '600',
  },
  authTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  authForm: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  authLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.charcoal[500],
  },
  authInput: {
    borderWidth: 2,
    borderColor: colors.carolina_blue[700],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontSize: 15,
    color: colors.charcoal[500],
  },
  authPrimaryBtn: {
    backgroundColor: colors.orange_pantone[500],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.orange_pantone[400],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  authPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  authDisabledBtn: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.carolina_blue[600],
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.charcoal[400],
    fontSize: 14,
    fontWeight: '500',
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.lapis_lazuli[400],
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lapis_lazuli[300],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleBtnText: {
    color: colors.charcoal[500],
    fontSize: 15,
    fontWeight: '600',
  },
  authErrorText: {
    color: colors.orange_pantone[600],
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: colors.orange_pantone[900],
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  
  // Main app styles
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffde59',
  },
  mainSafeArea: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 20,
  },
  mainHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 24,
    borderRadius: 20,
    marginBottom: 28,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainLogo: {
    width: 64,
    height: 64,
    marginRight: 20,
  },
  headerText: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.charcoal[500],
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 16,
    color: colors.charcoal[400],
    lineHeight: 22,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userEmail: {
    fontSize: 15,
    color: colors.charcoal[400],
    flex: 1,
    marginRight: 12,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.orange_pantone[100],
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 15,
    color: colors.orange_pantone[600],
    fontWeight: '600',
  },
  mainTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  mainTabActive: {
    backgroundColor: colors.orange_pantone[500],
    shadowColor: colors.orange_pantone[400],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  mainTabInactive: {
    backgroundColor: 'transparent',
  },
  mainTabText: {
    color: colors.charcoal[500],
    fontWeight: '600',
    fontSize: 14,
  },
  mainTabTextActive: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 13,
    color: colors.orange_pantone[600],
    fontWeight: '500',
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    fontSize: 16,
  },
  recipeDetails: {
    fontSize: 14,
    color: colors.charcoal[400],
    marginBottom: 16,
    fontWeight: '500',
  },
  viewRecipeBtn: {
    backgroundColor: colors.orange_pantone[500],
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewRecipeBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  recipeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
    backdropFilter: 'blur(10px)',
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 20,
  },
  servingsBadge: {
    backgroundColor: colors.carolina_blue[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.carolina_blue[300],
  },
  servingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.carolina_blue[700],
  },
  timeBadge: {
    backgroundColor: colors.hunyadi_yellow[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hunyadi_yellow[400],
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.hunyadi_yellow[700],
  },
  
  // Main app styles
  container: { flex: 1, backgroundColor: colors.carolina_blue[900] },
  centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.carolina_blue[900] },
  centeredScroll: { padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: colors.charcoal[500], textAlign: 'left', marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.charcoal[400], marginBottom: 12 },
  smallText: { fontSize: 12, color: colors.charcoal[400] },
  label: { fontSize: 14, fontWeight: '600', color: colors.charcoal[500], marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.carolina_blue[600], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: colors.charcoal[500], shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, marginBottom: 12 },
  primaryBtn: { backgroundColor: colors.orange_pantone[500], paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  disabledBtn: { opacity: 0.6 },
  successBtn: { backgroundColor: colors.lapis_lazuli[500], paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  successBtnText: { color: '#fff', fontWeight: '600' },
  outlineBtn: { borderWidth: 1, borderColor: colors.orange_pantone[500], paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: colors.orange_pantone[500], fontWeight: '600' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.orange_pantone[500] },
  tabBtnInactive: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.carolina_blue[600] },
  tabText: { color: colors.charcoal[500], fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  link: { color: colors.orange_pantone[500], marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal[500], marginBottom: 12, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: colors.hunyadi_yellow[600] },
  listItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  disclaimerBox: {
    backgroundColor: colors.orange_pantone[900],
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.orange_pantone[500],
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.orange_pantone[600],
    fontWeight: '500',
    lineHeight: 16,
  },
  bullet: { color: colors.orange_pantone[500], fontSize: 16, marginTop: 2 },
  bodyText: { color: colors.charcoal[500], fontSize: 14, flexShrink: 1 },
  itemTitle: { fontSize: 18, fontWeight: '700', color: colors.charcoal[700], flex: 1, paddingRight: 12, lineHeight: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orange_pantone[500], alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#fff', fontWeight: '700' },
  errorCard: {
    backgroundColor: colors.orange_pantone[900],
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.orange_pantone[500],
  },
  errorText: { color: colors.orange_pantone[600], marginTop: 8 },
  highlight: { color: colors.orange_pantone[500] },
  commentsSummaryBox: {
    backgroundColor: colors.lapis_lazuli[900],
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.lapis_lazuli[500],
  },
  commentsSummaryText: {
    fontSize: 14,
    color: colors.lapis_lazuli[600],
    lineHeight: 18,
  },

  // Grocery matching styles
  storeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  storeChips: { flexDirection: 'row', gap: 8 },
  storeChip: {
    borderWidth: 1,
    borderColor: colors.carolina_blue[600],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  storeChipActive: { backgroundColor: colors.hunyadi_yellow[500], borderColor: colors.hunyadi_yellow[400] },
  storeChipText: { color: colors.charcoal[500], fontWeight: '600', fontSize: 12 },
  storeChipTextActive: { color: '#fff' },
  storeFindBtn: { backgroundColor: colors.lapis_lazuli[500], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  storeFindBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center', padding:16 },
  matchModal: { backgroundColor:'#fff', borderRadius:16, padding:16 },
  matchHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  matchTitle: { fontSize:16, fontWeight:'700', color: colors.charcoal[500] },
  matchRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#eee' },
  matchIngredient: { fontSize:14, color: colors.charcoal[500], fontWeight:'600' },
  matchQuery: { fontSize:12, color: colors.charcoal[400] },
  matchOpenBtn: { backgroundColor: colors.orange_pantone[500], paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  matchOpenBtnText: { color:'#fff', fontWeight:'600', fontSize:12 },
  matchSaveBtn: { backgroundColor: colors.lapis_lazuli[500], paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  matchSaveBtnText: { color:'#fff', fontWeight:'600', fontSize:12 },
  matchNote: { fontSize:12, color: colors.charcoal[400], marginTop:8 },
  
  // Clipboard prompt styles
  clipboardPrompt: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.hunyadi_yellow[500],
  },
  clipboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clipboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal[500],
    flex: 1,
  },
  clipboardClose: {
    padding: 4,
  },
  clipboardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clipboardIcon: {
    marginRight: 8,
  },
  clipboardUrl: {
    fontSize: 14,
    color: colors.charcoal[700],
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontFamily: 'monospace',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clipboardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clipboardUseBtn: {
    flex: 1,
    backgroundColor: colors.hunyadi_yellow[500],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clipboardUseBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  clipboardDismissBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.charcoal[300],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clipboardDismissBtnText: {
    color: colors.charcoal[500],
    fontWeight: '600',
    fontSize: 14,
  },

  // New layout styles
  urlInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urlInput: {
    flex: 1,
    fontSize: 16,
    color: colors.charcoal[500],
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  searchBtn: {
    backgroundColor: colors.lapis_lazuli[500],
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  featureIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lapis_lazuli[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.lapis_lazuli[300],
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.charcoal[500],
    textAlign: 'center',
    marginBottom: 12,
  },
  featureDescription: {
    fontSize: 16,
    color: colors.charcoal[400],
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Simplified header styles
  simpleHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: 48,
    height: 48,
    marginRight: 16,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.charcoal[500],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.charcoal[400],
    lineHeight: 18,
  },
  headerLogoutBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.orange_pantone[100],
    borderRadius: 8,
  },
  headerLogoutText: {
    fontSize: 13,
    color: colors.orange_pantone[600],
    fontWeight: '600',
  },

  // Logo header styles
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 20,
    position: 'relative',
  },
  logoContainer: {
    borderRadius: 20,
    padding: 16,
  },
  centeredLogo: {
    width: 80,
    height: 80,
  },
  logoHeaderLogoutBtn: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },

  // New recipe detail styles
  recipeHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  recipeHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recipeHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.charcoal[500],
    marginBottom: 8,
  },
  sourceLink: {
    fontSize: 14,
    color: colors.lapis_lazuli[500],
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.lapis_lazuli[500],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  clearButtonText: {
    color: colors.charcoal[500],
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  metaText: {
    fontSize: 14,
    color: colors.charcoal[500],
    fontWeight: '500',
  },
  
  // Tab styles
  tabContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.lapis_lazuli[500],
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoal[400],
  },
  activeTabText: {
    color: colors.lapis_lazuli[500],
  },
  tabContent: {
    padding: 20,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabContentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.charcoal[500],
  },
  measurementToggleContainer: {
    alignItems: 'center',
  },
  measurementLabel: {
    fontSize: 12,
    color: colors.charcoal[500],
    fontWeight: '600',
    marginBottom: 6,
  },
  flagToggle: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 2,
  },
  flagButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 1,
    backgroundColor: '#f5f5f5',
  },
  activeFlagButton: {
    backgroundColor: '#fff',
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  flagText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.charcoal[600],
  },
  
  // Ingredients styles
  ingredientsList: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ingredientBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lapis_lazuli[500],
    marginTop: 6,
    marginRight: 12,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: colors.charcoal[500],
    lineHeight: 20,
  },
  
  // Instructions styles
  instructionsList: {
    gap: 16,
    marginTop: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lapis_lazuli[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: colors.charcoal[500],
    lineHeight: 22,
  },
  
  // Reviews styles
  reviewsText: {
    fontSize: 15,
    color: colors.charcoal[500],
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 16,
  },

  // Category modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    ...StyleSheet.absoluteFillObject,
  },
  categoryModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.charcoal[500],
    textAlign: 'center',
    marginBottom: 16,
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryOption: {
    backgroundColor: colors.lapis_lazuli[500],
    borderColor: colors.lapis_lazuli[600],
  },
  categoryOptionText: {
    fontSize: 16,
    color: colors.charcoal[600],
    fontWeight: '500',
  },
  selectedCategoryOptionText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  modalCancelText: {
    color: colors.charcoal[700],
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.lapis_lazuli[500],
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },

  // Category filter styles
  categoryFilterContainer: {
    marginBottom: 16,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterIcon: {
    marginRight: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.charcoal[500],
    flex: 1,
  },
  categoryFilterScroll: {
    flexDirection: 'row',
  },
  categoryFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 8,
  },
  activeCategoryFilterBtn: {
    backgroundColor: colors.lapis_lazuli[500],
  },
  categoryFilterText: {
    fontSize: 14,
    color: colors.charcoal[500],
    fontWeight: '500',
  },
  activeCategoryFilterText: {
    color: '#fff',
    fontWeight: '700',
  },

  // Category badge styles
  recipeCardHeader: {
    flex: 1,
    paddingRight: 10,
  },
  categoryBadge: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 12,
    color: '#2f4858',
    fontWeight: '600',
  },

  // Add category styles
  addNewCategoryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#e8f4f8',
    borderWidth: 2,
    borderColor: colors.lapis_lazuli[400],
    borderStyle: 'dashed',
  },
  addNewCategoryText: {
    fontSize: 16,
    color: colors.lapis_lazuli[600],
    fontWeight: '600',
    textAlign: 'center',
  },
  addCategoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  newCategoryInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    fontSize: 16,
    color: colors.charcoal[600],
  },
  addCategoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.lapis_lazuli[500],
    borderRadius: 8,
    justifyContent: 'center',
  },
  addCategoryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Enhanced Recipe Card Styles
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },

  // Category Accent Bar
  categoryAccentBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  accentBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryAccentText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeAccent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeAccentIcon: {
    marginRight: 4,
  },
  timeAccentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },


  // Recipe Content
  recipeContent: {
    padding: 16,
    paddingTop: 12,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal[600],
    marginBottom: 8,
    lineHeight: 24,
  },
  recipeSource: {
    fontSize: 13,
    color: colors.charcoal[400],
    fontStyle: 'italic',
    marginBottom: 16,
  },

  // Recipe Stats
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  recipeStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  recipeStatIcon: {
    marginBottom: 4,
  },
  recipeStatNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal[700],
    marginBottom: 2,
  },
  recipeStatLabel: {
    fontSize: 9,
    color: colors.charcoal[500],
    fontWeight: '600',
    textAlign: 'center',
  },

  // Recipe Actions
  recipeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewRecipeBtn: {
    flex: 1,
    backgroundColor: colors.orange_pantone[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  viewRecipeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  viewRecipeBtnIcon: {
    marginLeft: 4,
  },
  deleteRecipeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  // Recipe List
  recipesList: {
    paddingBottom: 32,
  },

  // Progress Overlay Styles
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    width: width * 0.8,
    maxWidth: 320,
  },
  progressIconContainer: {
    marginBottom: 20,
  },
  progressIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.orange_pantone[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.charcoal[600],
    marginBottom: 8,
    textAlign: 'center',
  },
  progressStage: {
    fontSize: 14,
    color: colors.charcoal[400],
    marginBottom: 24,
    textAlign: 'center',
    minHeight: 20,
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.orange_pantone[500],
    borderRadius: 3,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.charcoal[500],
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: colors.lapis_lazuli[500],
  },

  // URL Preview Card Styles
  urlPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  previewLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  previewLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.charcoal[500],
    fontWeight: '500',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 8,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  previewText: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.charcoal[600],
    marginBottom: 4,
    lineHeight: 20,
  },
  previewSite: {
    fontSize: 12,
    color: colors.lapis_lazuli[600],
    fontWeight: '500',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 13,
    color: colors.charcoal[400],
    lineHeight: 18,
  },
  previewDismiss: {
    padding: 4,
  },
  previewActions: {
    alignItems: 'center',
  },
  fetchRecipeBtn: {
    backgroundColor: colors.orange_pantone[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 140,
  },
  fetchBtnIcon: {
    marginRight: 6,
  },
  fetchRecipeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Bottom Navigation styles
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.charcoal[200],
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8, // Account for iOS home indicator
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  bottomNavItemActive: {
    // Optional: add background color for active state
  },
  bottomNavText: {
    fontSize: 12,
    color: colors.charcoal[400],
    marginTop: 4,
    fontWeight: '500',
  },
  bottomNavTextActive: {
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  bottomNavBadge: {
    position: 'absolute',
    top: 2,
    right: '25%',
    backgroundColor: colors.orange_pantone[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bottomNavBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Main container and header styles
  mainContainer: {
    flex: 1,
    backgroundColor: colors.charcoal[50],
  },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  simpleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal[200],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.charcoal[900],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.charcoal[600],
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  userEmail: {
    fontSize: 14,
    color: colors.charcoal[600],
    marginBottom: 4,
  },
  headerLogoutBtn: {
    backgroundColor: colors.orange_pantone[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerLogoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
