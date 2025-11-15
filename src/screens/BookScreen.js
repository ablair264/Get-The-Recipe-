import React, { useContext, useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, Modal, TextInput, ScrollView, Image, Animated, StatusBar, useWindowDimensions, Platform, KeyboardAvoidingView, Keyboard, Pressable, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppContext } from '../context/AppContext';
import colors from '../theme/colors';
import CustomHeader from '../components/CustomHeader';
import CurvedBottomBar from '../components/CurvedBottomBar';
// Using window dimensions directly for robust orientation gating on iPad
import IPadBookPortrait from '../components/iPadBookPortrait';
import IPadBookLandscape from '../components/iPadBookLandscape';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Function to get different colors for category badges
// Function to get color for category - use stored color from database or generate consistent fallback
const getCategoryColor = (categoryName, storedColor = null) => {
  // If we have a stored color from the database, use it
  if (storedColor) {
    return storedColor;
  }
  
  const colors = [
    '#ff6b6b', // Red
    '#4ecdc4', // Teal
    '#45b7d1', // Blue
    '#96ceb4', // Green
    '#feca57', // Yellow
    '#ff9ff3', // Pink
    '#54a0ff', // Light Blue
    '#5f27cd', // Purple
    '#00d2d3', // Cyan
    '#ff9f43', // Orange
    '#10ac84', // Emerald
    '#ee5a24', // Orange Red
  ];
  
  if (!categoryName || categoryName === 'All') {
    return colors[0]; // Default color
  }
  
  // Create a simple hash from category name to get consistent color
  const key = String(categoryName).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Card background color palette (non-accent area)
const CARD_COLORS = ['#5f99c3', '#96ceb4', '#ceaf96', '#ce96bd'];

// Deterministic color picker for recipe cards based on index
const getRandomCardColor = (index) => {
  if (typeof index !== 'number' || Number.isNaN(index)) {
    return CARD_COLORS[0];
  }
  return CARD_COLORS[Math.abs(index) % CARD_COLORS.length];
};

// Try to get a representative image URL for a recipe
const getRecipeImageUrl = (recipe) => {
  const candidates = [
    recipe?.image,
    recipe?.image_url,
    recipe?.imageUrl,
    recipe?.imageURL,
    recipe?.photo,
    Array.isArray(recipe?.images) ? recipe.images[0] : null,
  ].filter(Boolean);
  if (candidates.length > 0) return candidates[0];
  const url = recipe?.source_url || recipe?.sourceUrl;
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/favicon.ico`;
  } catch (_) {
    return null;
  }
};

// Optional: previous vertical label helper (unused with rotated wrapper)
// Kept for reference if needed later
// const getVerticalLabel = (name) => {
//   const text = (name || 'RECIPE').toString().toUpperCase().replace(/\s+/g, '');
//   return text.split('').join('\n');
// };

// Star icon name based on average rating
const starIconFor = (starIndex, average) => {
  const diff = average - (starIndex - 1);
  if (diff >= 1) return 'star';
  if (diff >= 0.5) return 'star-half';
  return 'star-outline';
};

// Robust time parser: supports ISO8601 (PT#H#M), "1h 20m", "1 hr 20 min", "90 min", etc.
const parseTimeToMinutes = (value) => {
  if (value == null) return 0;
  const str = String(value).trim();
  if (!str) return 0;

  // ISO 8601 format like PT1H30M
  const iso = /PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(str);
  if (iso) {
    const h = iso[1] ? parseInt(iso[1], 10) : 0;
    const m = iso[2] ? parseInt(iso[2], 10) : 0;
    return h * 60 + m;
  }

  // Generic tokens like 1h, 20m, 1 hr, 20 min, etc.
  let minutes = 0;
  const re = /(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/gi;
  let match;
  // Accumulate minutes from all tokens found, e.g., "1h20m"
  while ((match = re.exec(str)) !== null) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h')) minutes += num * 60;
    else minutes += num;
  }
  if (minutes > 0) return minutes;

  // Fallback: if there's a bare number, assume it's minutes
  const bare = str.match(/\d+/);
  return bare ? parseInt(bare[0], 10) : 0;
};

// Calculate difficulty outside the component to avoid re-creation on each render
const calculateDifficulty = (recipe) => {
  let difficultyScore = 0;

  // 1. Ingredient count scoring
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (ingredientCount > 15) difficultyScore += 3;
  else if (ingredientCount > 10) difficultyScore += 2;
  else if (ingredientCount > 5) difficultyScore += 1;

  // 2. Total time scoring
  const prepMinutes = recipe.prep_time ? parseInt(recipe.prep_time.replace(/\D/g, '')) || 0 : 0;
  const cookMinutes = recipe.cook_time ? parseInt(recipe.cook_time.replace(/\D/g, '')) || 0 : 0;
  const totalMinutes = prepMinutes + cookMinutes;

  if (totalMinutes > 120) difficultyScore += 3;
  else if (totalMinutes > 60) difficultyScore += 2;
  else if (totalMinutes > 30) difficultyScore += 1;

  // 3. Instruction complexity
  const instructionCount = Array.isArray(recipe.instructions) ? recipe.instructions.length : 0;
  if (instructionCount > 10) difficultyScore += 2;
  else if (instructionCount > 6) difficultyScore += 1;

  // 4. Complex cooking techniques detection
  const instructions = recipe.instructions ? recipe.instructions.join(' ').toLowerCase() : '';
  const complexTechniques = ['whisk', 'fold', 'caramelize', 'braise', 'sauté', 'flambé', 'tempering', 'proof', 'knead'];
  const foundTechniques = complexTechniques.filter((technique) => instructions.includes(technique));
  difficultyScore += foundTechniques.length;

  // Return difficulty with color
  if (difficultyScore >= 6) return { level: 'Difficult', color: '#ee5a24' }; // Orange
  if (difficultyScore >= 3) return { level: 'Moderate', color: '#ff9f43' }; // Yellow
  return { level: 'Easy', color: '#96ceb4' }; // Pale Yellow
};

export default function BookScreen({ navigation }) {
  const context = useContext(AppContext);
  const { width: winW, height: winH } = useWindowDimensions();
  // Detect tablets conservatively: iPad on iOS or min dimension >= 768
  const smallestDim = Math.min(winW, winH);
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || smallestDim >= 768;
  const isTabletLandscape = isTablet && winW > winH;
  const isTabletPortrait = isTablet && winH >= winW;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [recipeToAssign, setRecipeToAssign] = useState(null);
  const [pendingRecipeAfterCategory, setPendingRecipeAfterCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [conversionEnabled, setConversionEnabled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);
  const swipeableRefs = useRef({});
  const swipeInProgressRefs = useRef({});
  
  // Animation values for search expansion
  const searchOpacityAnim = useRef(new Animated.Value(0)).current;
  const filtersOpacityAnim = useRef(new Animated.Value(1)).current;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const titleScaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleFadeAnim = useRef(new Animated.Value(0)).current;

  // Animation handler for search expansion
  const toggleSearch = () => {
    // Configure LayoutAnimation for smooth layout changes
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });

    if (isSearchExpanded) {
      // Collapse search
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(searchOpacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(filtersOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsSearchExpanded(false);
        setSearchQuery('');
      });
    } else {
      // Expand search
      setIsSearchExpanded(true);
      // Start animations after state update
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(searchOpacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(filtersOpacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Focus the input after animation completes
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }, 100);
        });
      });
    }
  };
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(titleScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(titleFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);
  }, []);
  
  if (!context) {
    console.error('BookScreen: AppContext is null/undefined');
    return <View><Text>Loading...</Text></View>;
  }
  
  const { savedRecipes, loadRecipeFromSaved, deleteRecipe, categories = ['All'], addCategory, updateRecipeCategory, supabaseClient, user } = context;

  // Ratings cache per recipe_url
  const [ratingsByUrl, setRatingsByUrl] = useState({});
  const [userRatingsByUrl, setUserRatingsByUrl] = useState({});

  useEffect(() => {
    const loadListRatings = async () => {
      try {
        if (!supabaseClient || !savedRecipes?.length) return;
        const urls = Array.from(new Set(
          savedRecipes
            .map(r => r?.source_url || r?.sourceUrl)
            .filter(Boolean)
        ));
        if (urls.length === 0) return;
        const { data, error } = await supabaseClient
          .from('recipe_ratings')
          .select('recipe_url, rating, user_id')
          .in('recipe_url', urls);
        if (error) {
          console.warn('Failed to load ratings for list:', error.message);
          return;
        }
        const buckets = {};
        const myRatings = {};
        for (const row of data || []) {
          const url = row.recipe_url;
          if (!buckets[url]) buckets[url] = { sum: 0, count: 0 };
          buckets[url].sum += row.rating;
          buckets[url].count += 1;
          if (user && row.user_id === user.id) {
            myRatings[url] = row.rating;
          }
        }
        const map = {};
        Object.entries(buckets).forEach(([url, { sum, count }]) => {
          map[url] = { average: Math.round((sum / count) * 10) / 10, count };
        });
        setRatingsByUrl(map);
        setUserRatingsByUrl(myRatings);
      } catch (e) {
        console.warn('Error loading list ratings', e);
      }
    };
    loadListRatings();
  }, [supabaseClient, savedRecipes]);

  // Submit a rating from the book card and refresh aggregates
  const submitCardRating = async (recipeUrl, rating) => {
    try {
      if (!supabaseClient || !user || !recipeUrl) return;
      await supabaseClient
        .from('recipe_ratings')
        .upsert({
          user_id: user.id,
          recipe_url: recipeUrl,
          rating,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,recipe_url' });
      // refresh just this recipe's aggregates
      const { data } = await supabaseClient
        .from('recipe_ratings')
        .select('rating, user_id')
        .eq('recipe_url', recipeUrl);
      if (data) {
        const sum = data.reduce((s, r) => s + r.rating, 0);
        const count = data.length;
        setRatingsByUrl(prev => ({ ...prev, [recipeUrl]: { average: Math.round((sum / count) * 10) / 10, count } }));
        const my = data.find(r => r.user_id === user.id)?.rating || 0;
        setUserRatingsByUrl(prev => ({ ...prev, [recipeUrl]: my }));
      }
    } catch (e) {
      console.warn('Failed to submit rating', e);
    }
  };
  
  // Build a map of category name -> stored color (from saved recipes)
  const categoryColorMap = React.useMemo(() => {
    const map = {};
    (savedRecipes || []).forEach(r => {
      const name = r?.categories?.name;
      const color = r?.categories?.color;
      if (name && color && !map[name]) {
        map[name] = color;
      }
    });
    return map;
  }, [savedRecipes]);

  // Derive category counts from current recipes (used to build filter chips)
  const categoryCounts = React.useMemo(() => {
    const counts = {};
    (savedRecipes || []).forEach(r => {
      const name = r?.categories?.name;
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [savedRecipes]);

  // Categories to render in the filter row (hide empty, always include All)
  const filterCategories = React.useMemo(() => {
    const names = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
    return ['All', ...names];
  }, [categoryCounts]);

  // If current selection becomes empty (e.g., after deletion), fall back to All
  React.useEffect(() => {
    if (selectedCategory !== 'All' && !categoryCounts[selectedCategory]) {
      setSelectedCategory('All');
    }
  }, [selectedCategory, categoryCounts]);

  // Filter recipes by selected category and search query
  const filteredRecipes = savedRecipes.filter(recipe => {
    // Check category match - recipe.categories.name contains the category name
    const recipeCategoryName = recipe.categories?.name || null;
    const matchesCategory = selectedCategory === 'All' || recipeCategoryName === selectedCategory;
    
    const matchesSearch = searchQuery === '' || 
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (recipe.ingredients && recipe.ingredients.some(ingredient => 
        ingredient.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    return matchesCategory && matchesSearch;
  });
  
  const handleAddCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      const newCategory = newCategoryName.trim();
      addCategory && addCategory(newCategory);
      setNewCategoryName('');
      setShowCategoryModal(false);
      
      // If there was a pending recipe, auto-assign the new category to it
      if (pendingRecipeAfterCategory) {
        // Small delay to ensure the category is added to the context
        setTimeout(() => {
          updateRecipeCategory && updateRecipeCategory(pendingRecipeAfterCategory.id, newCategory);
          setPendingRecipeAfterCategory(null);
          setRecipeToAssign(null);
        }, 150);
      }
    }
  };
  
  const handleAssignCategory = (recipe, category) => {
    updateRecipeCategory && updateRecipeCategory(recipe.id, category);
    setRecipeToAssign(null);
  };

  const handleLogout = async () => {
    try {
      if (context.supabaseClient) {
        await context.supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleRecipeSelect = (recipe) => {
    setSelectedRecipe(recipe);
  };

  const handleToggleConversion = () => {
    setConversionEnabled(prev => !prev);
  };

  // Return iPad layouts for tablets
  if (isTabletPortrait) {
    return (
      <IPadBookPortrait
        recipes={filteredRecipes}
        categories={categories.filter(cat => cat !== 'All')}
        selectedRecipe={selectedRecipe}
        onRecipeSelect={handleRecipeSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleConversion={handleToggleConversion}
        conversionEnabled={conversionEnabled}
        navigation={navigation}
        deleteRecipe={deleteRecipe}
        loadRecipeFromSaved={loadRecipeFromSaved}
        submitCardRating={submitCardRating}
        ratingsByUrl={ratingsByUrl}
        userRatingsByUrl={userRatingsByUrl}
        categoryColorMap={categoryColorMap}
        onLogout={handleLogout}
      />
    );
  }

  if (isTabletLandscape) {
    return (
      <IPadBookLandscape
        recipes={filteredRecipes}
        categories={categories.filter(cat => cat !== 'All')}
        selectedRecipe={selectedRecipe}
        onRecipeSelect={handleRecipeSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleConversion={handleToggleConversion}
        conversionEnabled={conversionEnabled}
        navigation={navigation}
        deleteRecipe={deleteRecipe}
        loadRecipeFromSaved={loadRecipeFromSaved}
        submitCardRating={submitCardRating}
        ratingsByUrl={ratingsByUrl}
        userRatingsByUrl={userRatingsByUrl}
        categoryColorMap={categoryColorMap}
        onLogout={handleLogout}
      />
    );
  }

  // Continue with existing phone layout
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ff8243" barStyle="light-content" />
      {/* CustomHeader */}
      <CustomHeader
        title="Recipes"
        subtitle={`${savedRecipes?.length || 0} saved recipes`}
        showBackButton={true}
        onBackPress={() => navigation.navigate('Parser')}
      />
      
      <SafeAreaView style={styles.safeContent}>
        {/* Search Menu Container */}
        <View style={styles.searchMenuContainer}>
          <View style={styles.searchMenuWrapper}>
            {/* Search Input - Expands from button */}
            {isSearchExpanded && (
              <Animated.View 
                style={[
                  styles.searchInputContainer,
                  {
                    opacity: searchOpacityAnim,
                    flex: 1,
                  }
                ]}
              >
                <View style={styles.expandedSearchInput}>
                  <TextInput
                    ref={searchInputRef}
                    style={styles.expandedSearchInputText}
                    placeholder="Search.."
                    placeholderTextColor="#fff"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={toggleSearch} style={styles.closeSearchButton}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Collapsed Content: Search Button + Category Filters */}
            {!isSearchExpanded && (
              <Animated.View 
                style={[
                  styles.collapsedContent,
                  {
                    opacity: filtersOpacityAnim,
                    flex: 1,
                  }
                ]}
              >
              <TouchableOpacity 
                onPress={toggleSearch}
                style={styles.searchButton}
                activeOpacity={0.7}
              >
                <Text style={styles.searchButtonText}>Search..</Text>
              </TouchableOpacity>
              <View style={styles.categoryFiltersWrapper}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.categoryFiltersContent}
                  style={styles.categoryFiltersScrollView}
                >
                  {filterCategories.map((cat) => {
                    const isAll = cat === 'All';
                    const count = isAll ? (savedRecipes?.length || 0) : (categoryCounts[cat] || 0);
                    const active = selectedCategory === cat;
                    const categoryColor = getCategoryColor(cat, categoryColorMap[cat]);
                    
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(active ? 'All' : cat)}
                        style={[
                          styles.categoryFilterChip,
                          active ? [
                            styles.categoryFilterChipActive, 
                            { 
                              backgroundColor: categoryColor,
                            }
                          ] : styles.categoryFilterChipInactive,
                        ]}
                      >
                        <Text 
                          style={[
                            styles.categoryFilterChipText, 
                            active ? styles.categoryFilterChipTextActive : styles.categoryFilterChipTextInactive
                          ]}
                        >
                          {cat.toUpperCase()} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              </Animated.View>
            )}
          </View>
        </View>
        {/* Category Dropdown */}
        {showCategoryDropdown && (
          <View style={styles.dropdownContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedCategory(category);
                  setShowCategoryDropdown(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{category}</Text>
                {selectedCategory === category && (
                  <Ionicons name="checkmark" size={16} color="#ff8243" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={styles.container} 
            showsVerticalScrollIndicator={false}
            style={styles.contentScrollView}
          >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          
      {filteredRecipes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name={searchQuery ? "search-outline" : "book-outline"} 
              size={64} 
              color={colors.charcoal[300]} 
            />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No recipes found' : 
             savedRecipes.length === 0 ? 'No recipes yet' : 'No recipes in this category'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search term or clear your search' :
             savedRecipes.length === 0 
              ? 'Start by getting a recipe from the Home tab'
              : 'Try selecting a different category or add recipes to this one'
            }
          </Text>
          {searchQuery && (
            <TouchableOpacity 
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchBtnText}>Clear Search</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.recipesGrid}>
          {filteredRecipes.map((item, index) => {
            const difficulty = calculateDifficulty(item);
            const prepMinutes = parseTimeToMinutes(item.prep_time || item.prepTime);
            const cookMinutes = parseTimeToMinutes(item.cook_time || item.cookTime);
            const totalMinutes = prepMinutes + cookMinutes;
            const recipeUrl = item?.source_url || item?.sourceUrl;
            const ratingInfo = ratingsByUrl[recipeUrl] || {};
            const avgRating = ratingInfo.average || 0;
            const ratingsCount = ratingInfo.count || 0;
            // prepare key for any per-card derived values (not used now after design change)
            const cardKey = item.id || index;
            const imageUrl = getRecipeImageUrl(item);
            
            // iOS-like swipe: small icon appears as you swipe slightly
            // Swipe RIGHT (finger right) → card moves right → shows renderLeftActions = Category
            // Swipe LEFT (finger left) → card moves left → shows renderRightActions = Delete
            const renderLeftActions = (progress, dragX) => {
              // Category action (swipe right to reveal)
              const scale = progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.9, 1],
                extrapolate: 'clamp',
              });
              
              const opacity = progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              });
              
              return (
                <View style={styles.swipeActionIconContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      swipeableRefs.current[item.id]?.close();
                      setTimeout(() => {
                        setRecipeToAssign(item);
                      }, 150);
                    }}
                    activeOpacity={0.8}
                    style={styles.swipeActionIconTouchable}
                  >
                    <Animated.View
                      style={[
                        styles.swipeActionIconCircle,
                        {
                          backgroundColor: '#ff8243',
                          transform: [{ scale }],
                          opacity,
                        },
                      ]}
                    >
                      <Ionicons name="pricetag" size={24} color="#fff" />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              );
            };

            const renderRightActions = (progress, dragX) => {
              // Delete action (swipe left to reveal)
              const scale = progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.9, 1],
                extrapolate: 'clamp',
              });
              
              const opacity = progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              });
              
              return (
                <View style={styles.swipeActionIconContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      swipeableRefs.current[item.id]?.close();
                      setTimeout(() => {
                        try {
                          deleteRecipe && deleteRecipe(item.id);
                        } catch (_) {}
                      }, 150);
                    }}
                    activeOpacity={0.8}
                    style={styles.swipeActionIconTouchable}
                  >
                    <Animated.View
                      style={[
                        styles.swipeActionIconCircle,
                        {
                          backgroundColor: '#dc3545',
                          transform: [{ scale }],
                          opacity,
                        },
                      ]}
                    >
                      <Ionicons name="trash" size={24} color="#fff" />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              );
            };
            
            return (
              <View key={item.id || index} style={{ marginTop: 20, marginBottom: 2 }}>
                <Swipeable
                  ref={(ref) => {
                    if (ref) swipeableRefs.current[item.id] = ref;
                  }}
                  renderRightActions={renderRightActions}
                  renderLeftActions={renderLeftActions}
                  friction={2.5}
                  overshootRight={false}
                  overshootLeft={false}
                  rightThreshold={65}
                  leftThreshold={65}
                  containerStyle={styles.swipeableContainer}
                  onSwipeableOpenStartDrag={(direction) => {
                    swipeInProgressRefs.current[item.id] = true;
                    // Close other open swipeables
                    Object.keys(swipeableRefs.current).forEach((key) => {
                      if (key !== item.id && swipeableRefs.current[key]) {
                        swipeableRefs.current[key].close();
                      }
                    });
                  }}
                  onSwipeableCloseStartDrag={() => {
                    swipeInProgressRefs.current[item.id] = false;
                  }}
                  onSwipeableWillClose={() => {
                    swipeInProgressRefs.current[item.id] = false;
                  }}
                >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    // Prevent navigation if swipe is in progress
                    if (!swipeInProgressRefs.current[item.id]) {
                      navigation.navigate('Recipe', { recipe: loadRecipeFromSaved(item) });
                    }
                  }}
                  style={[
                    styles.newRecipeCard,
                    { backgroundColor: getRandomCardColor(index) }
                  ]}
                >
                  {/* Pop-out badges */}
                  <View style={styles.popBadgesContainer}>
                    <View style={[styles.popBadge, { backgroundColor: getCategoryColor(item.categories?.name, item.categories?.color ?? categoryColorMap[item.categories?.name]) }]}>
                      <Text style={styles.popBadgeText} numberOfLines={1}>
                        {item.categories?.name || 'Recipe'}
                      </Text>
                    </View>
                    <View style={[styles.popBadge, styles.popBadgeSecondary, { backgroundColor: difficulty.color }]}>
                      <Text style={styles.popBadgeText} numberOfLines={1}>
                        {difficulty.level}
                      </Text>
                    </View>
                  </View>
                  {/* Recipe Title */}
                  <Text style={styles.newRecipeTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  
                  {/* Rating Section */}
                  <View style={styles.ratingSection}>
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const myRate = userRatingsByUrl[recipeUrl] || 0;
                        const interactive = myRate > 0;
                        const iconName = interactive ? (star <= myRate ? 'star' : 'star-outline') : starIconFor(star, avgRating);
                        const iconColor = interactive ? (star <= myRate ? '#ffd700' : 'rgba(255,255,255,0.4)') : (avgRating >= star - 0.5 ? '#ffd700' : 'rgba(255,255,255,0.4)');
                        return (
                          <TouchableOpacity 
                            key={star} 
                            onPress={(e) => {
                              e.stopPropagation();
                              submitCardRating(recipeUrl, star);
                            }}
                          >
                            <Ionicons name={iconName} size={16} color={iconColor} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {ratingsCount > 0 && (
                      <Text style={styles.ratingCount}>({ratingsCount})</Text>
                    )}
                  </View>
                  
                  {/* Time Info */}
                  {totalMinutes > 0 && (
                    <Text style={styles.timeInfo}>
                      {`${totalMinutes} Minutes`}
                    </Text>
                  )}
                  
                  {/* Ingredients Count */}
                  <Text style={styles.ingredientsInfo}>
                    {Array.isArray(item.ingredients) ? item.ingredients.length : 0} Ingredients
                  </Text>

                  {/* Bottom-right image */}
                  {imageUrl && (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.recipeCardImage}
                      resizeMode="cover"
                    />
                  )}
                  
                  {/* Right-side accent removed as per new design */}
                </TouchableOpacity>
                </Swipeable>
              </View>
            );
          })}
        </View>
      )}
        </Animated.View>
          </ScrollView>
        </GestureHandlerRootView>
      </SafeAreaView>
      
      {/* Add Category Modal */}
      <Modal 
        visible={showCategoryModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Category</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Category name..."
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setPendingRecipeAfterCategory(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalAddBtn}
                onPress={handleAddCategory}
              >
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      
      {/* Assign Category Modal */}
      <Modal 
        visible={!!recipeToAssign} 
        transparent 
        animationType="slide"
        onRequestClose={() => setRecipeToAssign(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Category</Text>
            <Text style={styles.modalSubtitle}>{recipeToAssign?.title}</Text>
            <ScrollView style={styles.categoryList} keyboardShouldPersistTaps="handled">
              {categories.filter(cat => cat !== 'All').map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => handleAssignCategory(recipeToAssign, category)}
                >
                  <Text style={styles.categoryOptionText}>{category}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.charcoal[400]} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addCategoryOption}
                onPress={() => {
                  // Store the recipe to assign after category is created
                  setPendingRecipeAfterCategory(recipeToAssign);
                  setRecipeToAssign(null);
                  setNewCategoryName('');
                  setShowCategoryModal(true);
                }}
              >
                <View style={styles.addCategoryContent}>
                  <Ionicons name="add-circle-outline" size={20} color="#f7ae2d" />
                  <Text style={styles.addCategoryText}>Add New Category</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.charcoal[400]} />
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCancelBtn}
              onPress={() => setRecipeToAssign(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      
      {/* Curved Bottom Navigation Bar */}
      <CurvedBottomBar
        navigation={navigation}
        activeRoute="Book"
        dynamicButtonMode="default"
        dynamicButtonShowGlow={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#fff9e6',
  },
  header: {
    backgroundColor: '#ff8243',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    height: 250,
    paddingHorizontal: 20,
    paddingTop: 90,
    paddingBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: colors.charcoal[500], 
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 16,
    color: colors.charcoal[400],
    fontWeight: '500',
  },
  addCategoryBtn: {
    backgroundColor: '#f7ae2d',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.charcoal[500],
    marginLeft: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.charcoal[50] || '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.charcoal[400],
    textAlign: 'center',
    lineHeight: 24,
  },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: { 
    fontSize: 18,
    fontWeight: '700', 
    color: colors.charcoal[500], 
    lineHeight: 24,
    marginBottom: 16,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal[600],
    textAlign: 'center',
    lineHeight: 18,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.charcoal[400],
    textAlign: 'center',
  },
  cardActions: { 
    flexDirection: 'row', 
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
  },
  viewRecipeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  viewRecipeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteBtn: { 
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.charcoal[400],
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#f7ae2d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f7ae2d10',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modalAddBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f7ae2d',
    alignItems: 'center',
  },
  modalAddText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoryList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.charcoal[600],
  },
  addCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fef3c7',
  },
  addCategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f7ae2d',
  },
  
  // New styles for orange header design
  logoPosition: {
    position: 'absolute',
    bottom: -32,
    right: -25,
    width: 168,
    height: 168,
    transform: [{ rotate: '-15deg' }],
    zIndex: 2,
    opacity: 0.9,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'flex-start',
    zIndex: 3,
    maxWidth: '70%',
    paddingRight: 12,
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
    lineHeight: 36,
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.95,
    fontWeight: '400',
    lineHeight: 20,
    maxWidth: 320,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#ff6b35',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  closeSearchButton: {
    padding: 4,
    marginLeft: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  safeContent: {
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 200,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.charcoal[500],
    fontWeight: '500',
  },
  container: { 
    flexGrow: 1,
    paddingHorizontal: 20, 
    paddingTop: 8,
    paddingBottom: 100,
  },
  content: {
    flex: 1,
    overflow: 'visible',
  },
  recipesGrid: {
    gap: 0,
    paddingTop: 0,
    overflow: 'visible',
  },
  
  // New Comprehensive Recipe Card Styles
  newRecipeCard: {
    borderRadius: 16,
    marginBottom: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'visible',
    padding: 16,
    position: 'relative',
    minHeight: 160,
  },
  popBadgesContainer: {
    position: 'absolute',
    top: -14,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  popBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  popBadgeSecondary: {
    marginLeft: 8,
  },
  popBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  
  // Recipe Title
  newRecipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Rating Section
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginLeft: 6,
  },
  
  // Time and Ingredients Info
  timeInfo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ingredientsInfo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Difficulty Badge
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  difficultyText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Swipeable Container
  swipeableContainer: {
    overflow: 'visible',
  },
  // Swipe Action Icon Container (iOS-style - small icon, not full overlay)
  swipeActionIconContainer: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionIconTouchable: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recipeCardImage: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 110,
    height: 110,
    borderRadius: 12,
    opacity: 0.95,
  },
  
  // Category Accent removed per new design
  
  // Bottom Navigation Bar
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#ff8243',
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomNavButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  bottomNavText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomNavLogoContainer: {
    position: 'absolute',
    top: -32,
    left: '50%',
    marginLeft: -40,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    zIndex: 100,
  },
  clearSearchBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  clearSearchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Search Menu Container
  searchMenuContainer: {
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    zIndex: 10,
  },
  searchMenuWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 4,
    minHeight: 52,
    overflow: 'hidden',
  },
  // Collapsed Content (Search Button + Filters)
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    gap: 10,
    flexShrink: 0,
  },
  searchButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Category Filters Wrapper
  categoryFiltersWrapper: {
    flex: 1,
    minWidth: 0,
    height: 40,
  },
  // Category Filters Container (collapsed state)
  categoryFiltersScrollView: {
    flex: 1,
  },
  categoryFiltersContent: {
    paddingRight: 0,
    gap: 10,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '800',
  },
  categoryFilterChip: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  categoryFilterChipInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  categoryFilterChipActive: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryFilterChipText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryFilterChipTextInactive: {
    color: '#fff',
    opacity: 0.8,
  },
  categoryFilterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Search Input Container (expanded state)
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    overflow: 'hidden',
    flexShrink: 0,
  },
  expandedSearchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b35',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  expandedSearchInputText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  closeSearchButton: {
    padding: 4,
    color: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
