import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  Animated,
  Modal,
  Dimensions,
  RefreshControl,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import colors from '../theme/colors';
import FilterBar from './FilterBar';
import IPadRecipeCard from './IPadRecipeCard';
import { tidyIngredient, tidyInstruction } from '../utils/textCleaners';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// Enhanced color palette
const UI = {
  primary: '#ff8243',
  primaryDark: '#e66a2b',
  secondary: '#feca57',
  success: '#52c41a',
  background: '#fff9e6',
  backgroundLight: '#fffdf7',
  white: '#ffffff',
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  text: colors.charcoal[500],
  textLight: colors.charcoal[400],
  textDark: colors.charcoal[600],
  shadow: {
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// Enhanced card colors with gradients
const CARD_GRADIENTS = [
  ['#5f99c3', '#4a7aa0'],
  ['#96ceb4', '#7ab39c'],
  ['#ceaf96', '#b39580'],
  ['#ce96bd', '#b37ca3'],
];

const getCardGradient = (index) => {
  const gradients = CARD_GRADIENTS[Math.abs(index || 0) % CARD_GRADIENTS.length];
  return gradients;
};

// Category color palette with enhanced vibrancy
const getCategoryColor = (categoryName, storedColor = null) => {
  if (storedColor) return storedColor;
  
  const colorPalette = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
    '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24',
  ];
  
  if (!categoryName || categoryName === 'All') return colorPalette[0];
  
  const key = String(categoryName).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalette[Math.abs(hash) % colorPalette.length];
};

// Enhanced image URL getter with fallbacks
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

// Enhanced difficulty calculator
const calculateDifficulty = (recipe) => {
  let difficultyScore = 0;
  
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (ingredientCount > 15) difficultyScore += 3;
  else if (ingredientCount > 10) difficultyScore += 2;
  else if (ingredientCount > 5) difficultyScore += 1;

  const prepMinutes = recipe.prep_time ? parseInt(String(recipe.prep_time).replace(/\D/g, '')) || 0 : 0;
  const cookMinutes = recipe.cook_time ? parseInt(String(recipe.cook_time).replace(/\D/g, '')) || 0 : 0;
  const totalMinutes = prepMinutes + cookMinutes;

  if (totalMinutes > 120) difficultyScore += 3;
  else if (totalMinutes > 60) difficultyScore += 2;
  else if (totalMinutes > 30) difficultyScore += 1;

  const instructionCount = Array.isArray(recipe.instructions) ? recipe.instructions.length : 0;
  if (instructionCount > 10) difficultyScore += 2;
  else if (instructionCount > 6) difficultyScore += 1;

  const instructions = recipe.instructions ? recipe.instructions.join(' ').toLowerCase() : '';
  const complexTechniques = ['whisk', 'fold', 'caramelize', 'braise', 'sauté', 'flambé', 'tempering', 'proof', 'knead'];
  difficultyScore += complexTechniques.filter((t) => instructions.includes(t)).length;

  if (difficultyScore >= 6) return { level: 'Difficult', color: '#ff8243', icon: 'chef-hat' };
  if (difficultyScore >= 3) return { level: 'Moderate', color: '#feca57', icon: 'pot-steam' };
  return { level: 'Easy', color: '#52c41a', icon: 'pot' };
};

// Enhanced time parser
const parseTimeToMinutes = (value) => {
  if (value == null) return 0;
  const str = String(value).trim();
  if (!str) return 0;

  const iso = /PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(str);
  if (iso) {
    const h = iso[1] ? parseInt(iso[1], 10) : 0;
    const m = iso[2] ? parseInt(iso[2], 10) : 0;
    return h * 60 + m;
  }

  let minutes = 0;
  const re = /(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/gi;
  let match;
  while ((match = re.exec(str)) !== null) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h')) minutes += num * 60;
    else minutes += num;
  }
  
  if (minutes > 0) return minutes;
  const bare = str.match(/\d+/);
  return bare ? parseInt(bare[0], 10) : 0;
};

// Format time for display
const formatTime = (minutes) => {
  if (!minutes) return 'Time not specified';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const IPadBookPortraitEnhanced = ({
  recipes = [],
  categories = [],
  selectedRecipe,
  onRecipeSelect,
  searchQuery,
  onSearchChange,
  onToggleConversion,
  conversionEnabled = false,
  navigation,
  deleteRecipe,
  loadRecipeFromSaved,
  submitCardRating,
  ratingsByUrl = {},
  userRatingsByUrl = {},
  categoryColorMap = {},
  onLogout,
  useUKMeasurements,
  ingredientsToUK,
  supabaseClient,
  user,
}) => {
  // State management
  const [filters, setFilters] = useState({
    category: 'All',
    difficulty: 'All',
    totalTime: 'All',
    sortBy: 'recent',
  });
  
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [activeTab, setActiveTab] = useState('ingredients');
  const [checked, setChecked] = useState(new Set());
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showIngredientPrices, setShowIngredientPrices] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const detailPanelSlideAnim = useRef(new Animated.Value(width)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;
  
  // Scroll tracking for parallax
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });
  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: [1.2, 1, 0.95],
    extrapolate: 'clamp',
  });
  
  // Entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Detail panel animations
  useEffect(() => {
    if (selectedRecipe) {
      setShowDetailPanel(true);
      setActiveTab('ingredients');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      Animated.parallel([
        Animated.spring(detailPanelSlideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(detailPanelSlideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowDetailPanel(false));
    }
  }, [selectedRecipe]);
  
  // Tab indicator animation
  useEffect(() => {
    const tabCount = hasUsefulComments(selectedRecipe?.commentsSummary) ? 3 : 2;
    const tabWidth = width / 2 / tabCount; // Detail panel is half width
    let toValue = 0;
    
    switch (activeTab) {
      case 'ingredients': toValue = 0; break;
      case 'instructions': toValue = tabWidth; break;
      case 'comments': toValue = tabWidth * 2; break;
    }
    
    Animated.spring(tabIndicatorPosition, {
      toValue,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [activeTab, selectedRecipe]);
  
  // Helper functions
  const hasUsefulComments = (commentsSummary) => {
    return commentsSummary && 
           commentsSummary.trim() !== '' && 
           !commentsSummary.toLowerCase().includes('no helpful comments found');
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Simulate refresh - replace with actual data fetch
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };
  
  // Reset checked items when recipe or units change
  useEffect(() => {
    setChecked(new Set());
    setExpandedGroups(new Set());
  }, [selectedRecipe, conversionEnabled]);
  
  // Filter and sort recipes
  const finalFilteredRecipes = useMemo(() => {
    let filtered = recipes.filter(recipe => {
      if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filters.category !== 'All' && recipe.categories?.name !== filters.category) {
        return false;
      }
      
      if (filters.difficulty !== 'All') {
        const difficulty = calculateDifficulty(recipe);
        if (difficulty.level !== filters.difficulty) {
          return false;
        }
      }
      
      if (filters.totalTime !== 'All') {
        const prepMinutes = parseTimeToMinutes(recipe.prep_time);
        const cookMinutes = parseTimeToMinutes(recipe.cook_time);
        const totalMinutes = prepMinutes + cookMinutes;
        
        switch (filters.totalTime) {
          case '30':
            if (totalMinutes >= 30) return false;
            break;
          case '60':
            if (totalMinutes < 30 || totalMinutes >= 60) return false;
            break;
          case '120':
            if (totalMinutes < 60 || totalMinutes >= 120) return false;
            break;
          case '120+':
            if (totalMinutes < 120) return false;
            break;
        }
      }
      
      return true;
    });

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'rating':
          const aRating = ratingsByUrl[a?.source_url || a?.sourceUrl]?.average || 0;
          const bRating = ratingsByUrl[b?.source_url || b?.sourceUrl]?.average || 0;
          return bRating - aRating;
        case 'prepTime':
          return parseTimeToMinutes(a.prep_time) - parseTimeToMinutes(b.prep_time);
        case 'cookTime':
          return parseTimeToMinutes(a.cook_time) - parseTimeToMinutes(b.cook_time);
        case 'nameAsc':
          return a.title.localeCompare(b.title);
        case 'nameDesc':
          return b.title.localeCompare(a.title);
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    return filtered;
  }, [recipes, searchQuery, filters, ratingsByUrl]);
  
  // Handlers
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    Haptics.selectionAsync();
  };
  
  const toggleChecked = (index) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return next;
    });
  };
  
  const clearChecked = () => {
    setChecked(new Set());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  
  const toggleGroupExpansion = (groupIndex) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  };
  
  const copyIngredients = async () => {
    if (!selectedRecipe?.ingredients) return;
    try {
      const ingredients = Array.isArray(selectedRecipe.ingredients) 
        ? selectedRecipe.ingredients 
        : JSON.parse(selectedRecipe.ingredients || '[]');
      const text = ingredients.map(i => tidyIngredient(i)).join('\n');
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert('Ingredients copied to clipboard');
    } catch (_) {}
  };
  
  const shareRecipe = () => {
    setShowShareMenu(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  
  // Enhanced ingredient text renderer
  const renderIngredientText = (text, isChecked) => {
    const t = tidyIngredient(text || '');
    const fracChars = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
    const qtyRegex = new RegExp(
      '^\\s*' +
      '(' +
        '(?:\\d+\\s+\\d+\/\\d+)' +
        '|' +
        '(?:\\d+\/\\d+)' +
        '|' +
        '(?:\\d+\\s*[' + fracChars + '])' +
        '|' +
        '(?:[' + fracChars + '])' +
        '|' +
        '(?:\\d+(?:\\.\\d+)?)' +
      ')' +
      '\\s*' +
      '([A-Za-zµ]+)?' +
      '\\s*(.*)$'
    );
    
    const m = t.match(qtyRegex);
    const renderWithNotes = (str) => {
      const parts = str.split(/(\([^)]*\))/g).filter(Boolean);
      return parts.map((part, idx) => (
        <Text key={idx} style={[
          part.startsWith('(') ? styles.ingNote : null,
          isChecked && styles.textStrikethrough
        ]}>
          {part}
        </Text>
      ));
    };
    
    if (m) {
      const qty = m[1];
      const unit = m[2] ? ` ${m[2]}` : '';
      const rest = m[3] || '';
      return (
        <Text style={[styles.ingText, isChecked && styles.ingTextChecked]}>
          <Text style={[styles.ingQty, isChecked && styles.textStrikethrough]}>
            {qty}{unit}
          </Text>
          {rest ? <Text> </Text> : null}
          {renderWithNotes(rest)}
        </Text>
      );
    }
    
    return (
      <Text style={[styles.ingText, isChecked && styles.ingTextChecked]}>
        {renderWithNotes(t)}
      </Text>
    );
  };
  
  // Render grouped ingredients
  const renderIngredientGroups = () => {
    if (!selectedRecipe?.ingredients) return null;
    
    const ingredients = conversionEnabled && ingredientsToUK 
      ? ingredientsToUK(selectedRecipe.ingredients)
      : selectedRecipe.ingredients;
    
    // Simple grouping logic - can be enhanced based on your data structure
    const groups = [{ label: null, items: ingredients }];
    
    return groups.map((group, groupIndex) => {
      const isExpanded = expandedGroups.has(groupIndex) || !group.label;
      
      return (
        <View key={groupIndex} style={styles.ingredientGroup}>
          {group.label && (
            <TouchableOpacity 
              onPress={() => toggleGroupExpansion(groupIndex)}
              style={styles.groupHeader}
            >
              <Text style={styles.groupHeaderText}>{group.label}</Text>
              <Animated.View style={{
                transform: [{
                  rotate: isExpanded ? '90deg' : '0deg'
                }]
              }}>
                <Ionicons name="chevron-forward" size={20} color={UI.text} />
              </Animated.View>
            </TouchableOpacity>
          )}
          
          {isExpanded && group.items.map((ingredient, index) => {
            const globalIndex = `${groupIndex}-${index}`;
            const isChecked = checked.has(globalIndex);
            
            return (
              <Animated.View 
                key={index} 
                style={[
                  styles.ingredientRow,
                  {
                    opacity: isChecked ? 0.6 : 1,
                    transform: [{
                      translateX: isChecked ? 10 : 0
                    }]
                  }
                ]}
              >
                <TouchableOpacity 
                  onPress={() => toggleChecked(globalIndex)}
                  style={styles.checkContainer}
                >
                  <View style={[
                    styles.checkCircle,
                    isChecked && styles.checkCircleChecked
                  ]}>
                    {isChecked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
                
                <View style={styles.ingredientContent}>
                  {renderIngredientText(ingredient, isChecked)}
                  {showIngredientPrices && (
                    <Text style={styles.priceText}>~£2.50</Text>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      );
    });
  };
  
  // Render recipe card using the dedicated IPadRecipeCard component
  const renderRecipeCard = ({ item, index }) => {
    return (
      <View style={viewMode === 'grid' ? styles.gridCardContainer : styles.listCardContainer}>
        <IPadRecipeCard
          recipe={item}
          index={index}
          variant={viewMode === 'grid' ? 'portrait' : 'landscape'}
          onPress={() => navigation && navigation.navigate('Recipe', { recipe: loadRecipeFromSaved(item) })}
          navigation={navigation}
          deleteRecipe={deleteRecipe}
          loadRecipeFromSaved={loadRecipeFromSaved}
          submitCardRating={submitCardRating}
          ratingsByUrl={ratingsByUrl}
          userRatingsByUrl={userRatingsByUrl}
          categoryColorMap={categoryColorMap}
        />
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Animated Header with Logo */}
      <Animated.View style={[
        {
          opacity: headerOpacity,
          transform: [{ scale: headerScale }]
        }
      ]}>
        <LinearGradient
          colors={[UI.primary, UI.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Logo positioned on right edge, rotated */}
          <View style={styles.logoPosition}>
            <Image source={require('../../assets/images/Logo.png')} style={styles.headerLogo} resizeMode="contain" />
          </View>
          
          <Animated.View style={{
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }}>
            <Text style={styles.headerTitle}>My Recipe Collection</Text>
            <Text style={styles.headerSubtitle}>
              {finalFilteredRecipes.length} {finalFilteredRecipes.length === 1 ? 'recipe' : 'recipes'} 
              {searchQuery ? ` matching "${searchQuery}"` : ''}
            </Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      
      {/* In-flow Search Bar (removes absolute positioning) */}
      <View style={styles.searchBarContainer}>
        <LinearGradient
          colors={['rgba(255,130,67,0.95)', 'rgba(230,106,43,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.searchBarWrapper, UI.shadow.large]}
        >
          <Ionicons name="search" size={22} color="#fff" style={styles.searchIcon} />
          <TextInput
            placeholder="Search recipes..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={onSearchChange}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity 
              onPress={() => {
                onSearchChange('');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={styles.clearSearchButton}
            >
              <Ionicons name="close-circle" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      </View>
      
      {/* Main Content Area */}
      <SafeAreaView style={styles.safeContent}>
        {/* Filter Bar */}
        <View style={styles.filtersContainer}>
          <FilterBar
            categories={categories}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </View>
        
        {/* View Toggle Controls */}
        <View style={styles.viewControls}>
          <View style={styles.viewToggle}>
            <TouchableOpacity 
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons name="grid" size={20} color={viewMode === 'grid' ? '#fff' : UI.textLight} />
              <Text style={[styles.viewToggleText, viewMode === 'grid' && styles.viewToggleTextActive]}>Grid</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : UI.textLight} />
              <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipe Grid/List */}
        <FlatList
          data={finalFilteredRecipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when view mode changes
          contentContainerStyle={styles.recipeListContent}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : null}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chef-hat" size={80} color={UI.textLight} />
              <Text style={styles.emptyStateTitle}>No Recipes Found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery 
                  ? `No recipes match "${searchQuery}"`
                  : 'Start adding recipes to your collection'}
              </Text>
            </View>
          )}
        />

        {false && (
        <View style={styles.contentArea}>
          {/* Recipe List */}
          <View style={showDetailPanel ? styles.recipeListColumn : styles.recipeListColumnFull}>
            <FlatList
              data={finalFilteredRecipes}
              renderItem={renderRecipeCard}
              keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.recipeListContent}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
              )}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={UI.primary}
                  colors={[UI.primary]}
                />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="chef-hat" size={80} color={UI.textLight} />
                  <Text style={styles.emptyStateTitle}>No Recipes Found</Text>
                  <Text style={styles.emptyStateText}>
                    {searchQuery 
                      ? `No recipes match "${searchQuery}"`
                      : 'Start adding recipes to your collection'}
                  </Text>
                </View>
              )}
            />
          </View>
          
          {/* Detail Panel */}
          {showDetailPanel && selectedRecipe && (
            <Animated.View style={[
              styles.detailPanel,
              UI.shadow.large,
              {
                transform: [{ translateX: detailPanelSlideAnim }]
              }
            ]}>
              <BlurView intensity={98} style={styles.detailBlurHeader}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleContainer}>
                    <Text style={styles.detailTitle} numberOfLines={2}>
                      {selectedRecipe.title}
                    </Text>
                    
                    <View style={styles.detailMeta}>
                      <View style={[
                        styles.difficultyBadge,
                        { backgroundColor: calculateDifficulty(selectedRecipe).color }
                      ]}>
                        <MaterialCommunityIcons 
                          name={calculateDifficulty(selectedRecipe).icon} 
                          size={14} 
                          color="#fff" 
                        />
                        <Text style={styles.difficultyText}>
                          {calculateDifficulty(selectedRecipe).level}
                        </Text>
                      </View>
                      
                      <Text style={styles.detailMetaText}>
                        {formatTime(parseTimeToMinutes(selectedRecipe.prep_time) + parseTimeToMinutes(selectedRecipe.cook_time))}
                      </Text>
                      
                      <Text style={styles.detailMetaText}>
                        {Array.isArray(selectedRecipe.ingredients) ? selectedRecipe.ingredients.length : 0} ingredients
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    onPress={() => {
                      onRecipeSelect(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={28} color={UI.text} />
                  </TouchableOpacity>
                </View>
              </BlurView>
              
              {/* Animated Tab Bar */}
              <View style={styles.tabBar}>
                <Animated.View 
                  style={[
                    styles.tabIndicator,
                    {
                      transform: [{ translateX: tabIndicatorPosition }],
                      width: hasUsefulComments(selectedRecipe?.commentsSummary) 
                        ? (width / 2 - 40) / 3 
                        : (width / 2 - 40) / 2
                    }
                  ]} 
                />
                
                <TouchableOpacity 
                  style={styles.tab} 
                  onPress={() => {
                    setActiveTab('ingredients');
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons 
                    name="restaurant-menu" 
                    size={20} 
                    color={activeTab === 'ingredients' ? UI.primary : UI.textLight} 
                  />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'ingredients' && styles.activeTabText
                  ]}>
                    Ingredients
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.tab} 
                  onPress={() => {
                    setActiveTab('instructions');
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialCommunityIcons 
                    name="chef-hat" 
                    size={20} 
                    color={activeTab === 'instructions' ? UI.primary : UI.textLight} 
                  />
                  <Text style={[
                    styles.tabText,
                    activeTab === 'instructions' && styles.activeTabText
                  ]}>
                    Instructions
                  </Text>
                </TouchableOpacity>
                
                {hasUsefulComments(selectedRecipe?.commentsSummary) && (
                  <TouchableOpacity 
                    style={styles.tab} 
                    onPress={() => {
                      setActiveTab('comments');
                      Haptics.selectionAsync();
                    }}
                  >
                    <MaterialIcons 
                      name="comment" 
                      size={20} 
                      color={activeTab === 'comments' ? UI.primary : UI.textLight} 
                    />
                    <Text style={[
                      styles.tabText,
                      activeTab === 'comments' && styles.activeTabText
                    ]}>
                      Tips
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Tab Content */}
              <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                <View style={styles.tabContentInner}>
                  {activeTab === 'ingredients' && (
                    <>
                      <View style={styles.ingredientsControls}>
                        <TouchableOpacity 
                          style={styles.conversionToggle}
                          onPress={onToggleConversion}
                        >
                          <MaterialCommunityIcons 
                            name={conversionEnabled ? 'toggle-switch' : 'toggle-switch-off'} 
                            size={32} 
                            color={conversionEnabled ? UI.primary : UI.textLight} 
                          />
                          <Text style={styles.conversionText}>
                            {conversionEnabled ? 'UK Units' : 'US Units'}
                          </Text>
                        </TouchableOpacity>
                        
                        <View style={styles.controlButtons}>
                          <TouchableOpacity 
                            style={[styles.controlButton, UI.shadow.light]}
                            onPress={() => setShowIngredientPrices(!showIngredientPrices)}
                          >
                            <MaterialIcons 
                              name="attach-money" 
                              size={18} 
                              color={showIngredientPrices ? UI.primary : UI.textLight} 
                            />
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={[styles.controlButton, UI.shadow.light]}
                            onPress={clearChecked}
                          >
                            <MaterialIcons name="refresh" size={18} color={UI.primary} />
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={[styles.copyButton, UI.shadow.light]}
                            onPress={copyIngredients}
                          >
                            <Ionicons name="copy-outline" size={18} color={UI.primary} />
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {renderIngredientGroups()}
                      
                      {showIngredientPrices && (
                        <View style={styles.totalPriceContainer}>
                          <Text style={styles.totalPriceLabel}>Estimated Total:</Text>
                          <Text style={styles.totalPriceAmount}>£24.50</Text>
                        </View>
                      )}
                    </>
                  )}
                  
                  {activeTab === 'instructions' && selectedRecipe?.instructions && (
                    <View>
                      {selectedRecipe.instructions.map((instruction, index) => (
                        <View key={index} style={styles.stepRow}>
                          <View style={styles.stepNum}>
                            <Text style={styles.stepNumText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>
                            {tidyInstruction(instruction)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {activeTab === 'comments' && hasUsefulComments(selectedRecipe?.commentsSummary) && (
                    <View style={styles.commentsContainer}>
                      <View style={styles.commentsHeader}>
                        <MaterialIcons name="lightbulb" size={24} color={UI.primary} />
                        <Text style={styles.commentsTitle}>Community Tips</Text>
                      </View>
                      <Text style={styles.commentsText}>
                        {selectedRecipe.commentsSummary}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </Animated.View>
          )}
        </View>) }
      </SafeAreaView>
      
      {/* Bottom Navigation (same options as BookScreen) */}
      <LinearGradient
        colors={[UI.primary, UI.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bottomNavBar, UI.shadow.large]}
      >
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation && navigation.navigate('Parser')}>
          <Ionicons name="home" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation && navigation.navigate('Pantry')}>
          <Ionicons name="basket" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Pantry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation && navigation.navigate('Book')}>
          <Ionicons name="book" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation && navigation.navigate('Settings')}>
          <Ionicons name="settings" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={onLogout}>
          <Ionicons name="log-out" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Logout</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    height: 200,
  },
  logoPosition: {
    position: 'absolute',
    top: 20,
    right: -30,
    width: 150,
    height: 150,
    transform: [{ rotate: '-15deg' }],
    zIndex: 2,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    marginTop: 30,
    letterSpacing: -0.5,
    maxWidth: '70%',
    zIndex: 3,
  },
  headerSubtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    maxWidth: '70%',
    zIndex: 3,
  },
  overlappingSearchContainer: {
    position: 'absolute',
    top: 140,
    left: 24,
    right: 24,
    zIndex: 10,
  },
  overlappingSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    height: 56,
  },
  // New in-flow search bar styles
  searchBarContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    height: 56,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  clearSearchButton: {
    padding: 4,
  },
  safeContent: {
    flex: 1,
    backgroundColor: UI.background,
    paddingTop: 12,
  },
  filtersContainer: {
    backgroundColor: UI.white,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    marginBottom: 8,
  },
  contentArea: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  // New horizontal list container
  horizontalListContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: UI.white,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  horizontalListContent: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  // Merged actions row below
  actionButtonsRowMerged: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  primaryActionButton: { 
    backgroundColor: UI.success,
    borderRadius: 12,
  },
  secondaryActionButton: { 
    backgroundColor: UI.primary,
    borderRadius: 12,
  },
  dangerActionButton: { 
    backgroundColor: '#e11d48',
    borderRadius: 12,
  },
  // Details two-column layout below
  detailsContainerBelow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  sectionContainerBelow: {
    flex: 1,
    backgroundColor: UI.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: UI.borderLight,
    minHeight: 400,
  },
  sectionHeaderBelow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleBelow: {
    fontSize: 24,
    fontWeight: '800',
    color: UI.text,
    letterSpacing: -0.5,
  },
  recipeListColumn: {
    flex: 1,
    maxWidth: 400,
  },
  recipeListColumnFull: {
    flex: 1,
  },
  recipeListContent: {
    paddingBottom: 24,
    paddingTop: 8, // Add top padding for first row of cards
  },
  
  
  // Enhanced Detail Panel Styles
  detailPanel: {
    flex: 1,
    backgroundColor: UI.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  detailBlurHeader: {
    paddingTop: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    gap: 12,
  },
  detailTitleContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: UI.text,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailMetaText: {
    fontSize: 14,
    color: UI.textLight,
    fontWeight: '600',
  },
  closeButton: {
    padding: 6,
    backgroundColor: UI.backgroundLight,
    borderRadius: 12,
  },
  
  // Enhanced Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: UI.backgroundLight,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: UI.primary,
    borderRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    minHeight: 60,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.textLight,
    textAlign: 'center',
  },
  activeTabText: {
    color: UI.primary,
    fontWeight: '700',
  },
  
  // Tab Content
  tabContent: {
    flex: 1,
    backgroundColor: UI.white,
  },
  tabContentInner: {
    padding: 20,
  },
  
  // Ingredients Controls
  ingredientsControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  conversionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conversionText: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.primary,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: UI.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.backgroundLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.primary,
  },
  
  // Ingredient Groups
  ingredientGroup: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: UI.borderLight,
  },
  groupHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.text,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
    paddingVertical: 4,
  },
  checkContainer: {
    paddingTop: 2,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: UI.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkCircleChecked: {
    backgroundColor: UI.primary,
  },
  ingredientContent: {
    flex: 1,
  },
  ingText: {
    color: UI.text,
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
  },
  ingTextChecked: {
    color: UI.textLight,
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
  },
  ingQty: {
    fontWeight: '800',
    color: UI.textDark,
  },
  ingNote: {
    color: UI.textLight,
    fontStyle: 'italic',
  },
  priceText: {
    fontSize: 13,
    color: UI.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  totalPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: UI.borderLight,
  },
  totalPriceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.text,
  },
  totalPriceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: UI.primary,
  },
  
  // Instructions
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  stepText: {
    color: UI.text,
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
  },
  
  // Comments
  commentsContainer: {
    backgroundColor: 'rgba(255,130,67,0.08)',
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: UI.primary,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.text,
  },
  commentsText: {
    fontSize: 16,
    lineHeight: 26,
    color: UI.text,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 50,
    minHeight: 400,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: UI.text,
  },
  emptyStateText: {
    fontSize: 18,
    color: UI.textLight,
    textAlign: 'center',
    lineHeight: 26,
  },
  
  // Bottom Navigation
  bottomNavBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomNavButton: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bottomNavText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  
  // View Toggle Controls
  viewControls: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    alignSelf: 'flex-start',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: '#069494',
    shadowColor: '#069494',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#fff',
  },
  
  // Grid/List Card Containers
  gridCardContainer: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 16,
    marginTop: 16, // Add top margin for pop-out badges
  },
  listCardContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 16, // Add top margin for pop-out badges
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  quickActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default IPadBookPortraitEnhanced;
