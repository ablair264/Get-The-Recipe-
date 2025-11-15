import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback,
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
import * as WebBrowser from 'expo-web-browser';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced UI theme
const UI = {
  primary: '#ff8243',
  primaryDark: '#e66a2b',
  primaryLight: 'rgba(255,130,67,0.1)',
  secondary: '#feca57',
  success: '#52c41a',
  danger: '#ff4757',
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
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.20,
      shadowRadius: 24,
      elevation: 12,
    },
  },
};

// Enhanced card gradient system
const CARD_GRADIENTS = [
  ['#5f99c3', '#4a7aa0'],
  ['#96ceb4', '#7ab39c'],
  ['#ceaf96', '#b39580'],
  ['#ce96bd', '#b37ca3'],
  ['#a29bfe', '#6c5ce7'],
  ['#fd79a8', '#e84393'],
];

const getCardGradient = (index) => CARD_GRADIENTS[Math.abs(index || 0) % CARD_GRADIENTS.length];

// Category color system
const getCategoryColor = (categoryName, storedColor = null) => {
  if (storedColor) return storedColor;
  const palette = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
    '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'
  ];
  if (!categoryName || categoryName === 'All') return palette[0];
  const key = String(categoryName).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

// Get recipe image with smart fallbacks
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

// Calculate recipe difficulty with enhanced scoring
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
  const complexTechniques = ['whisk', 'fold', 'caramelize', 'braise', 'sauté', 'flambé', 'tempering', 'proof', 'knead', 'julienne', 'blanch', 'deglaze'];
  difficultyScore += complexTechniques.filter((t) => instructions.includes(t)).length;

  if (difficultyScore >= 6) return { level: 'Difficult', color: '#ff8243', icon: 'chef-hat', score: difficultyScore };
  if (difficultyScore >= 3) return { level: 'Moderate', color: '#feca57', icon: 'pot-steam', score: difficultyScore };
  return { level: 'Easy', color: '#52c41a', icon: 'pot', score: difficultyScore };
};

// Parse time with enhanced formats
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


const IPadBookLandscapeEnhanced = ({
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
  ingredientsToUK,
  supabaseClient,
  user,
}) => {
  // State
  const [filters, setFilters] = useState({
    category: 'All',
    difficulty: 'All',
    totalTime: 'All',
    sortBy: 'recent',
  });
  
  const [activeTab, setActiveTab] = useState('ingredients');
  const [checked, setChecked] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const detailSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Pulse animation for interactive elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  // Detail panel animation
  useEffect(() => {
    if (selectedRecipe) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(detailSlideAnim, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(detailSlideAnim, {
        toValue: screenWidth * 0.4,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedRecipe]);
  
  // Helper functions
  const hasUsefulComments = (commentsSummary) => {
    return commentsSummary && 
           commentsSummary.trim() !== '' && 
           !commentsSummary.toLowerCase().includes('no helpful comments found');
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };
  
  // Reset states on recipe/conversion change
  useEffect(() => {
    setChecked(new Set());
    setExpandedGroups(new Set());
  }, [selectedRecipe, conversionEnabled]);
  
  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    let filtered = recipes.filter(recipe => {
      if (searchQuery && !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filters.category !== 'All' && recipe?.categories?.name !== filters.category) return false;
      if (filters.difficulty !== 'All') {
        const dif = calculateDifficulty(recipe);
        if (dif.level !== filters.difficulty) return false;
      }
      if (filters.totalTime !== 'All') {
        const prep = parseTimeToMinutes(recipe.prep_time);
        const cook = parseTimeToMinutes(recipe.cook_time);
        const total = prep + cook;
        switch (filters.totalTime) {
          case '30': if (total >= 30) return false; break;
          case '60': if (total < 30 || total >= 60) return false; break;
          case '120': if (total < 60 || total >= 120) return false; break;
          case '120+': if (total < 120) return false; break;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'rating': {
          const aUrl = a?.source_url || a?.sourceUrl;
          const bUrl = b?.source_url || b?.sourceUrl;
          const aR = ratingsByUrl[aUrl]?.average || 0;
          const bR = ratingsByUrl[bUrl]?.average || 0;
          return bR - aR;
        }
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
  
  const copyIngredients = async () => {
    if (!selectedRecipe?.ingredients) return;
    try {
      const ingredients = conversionEnabled && ingredientsToUK 
        ? ingredientsToUK(selectedRecipe.ingredients)
        : selectedRecipe.ingredients;
      const text = ingredients.map(i => tidyIngredient(i)).join('\n');
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert('Ingredients copied');
    } catch (_) {}
  };
  
  const copyInstructions = async () => {
    if (!selectedRecipe?.instructions) return;
    try {
      const text = selectedRecipe.instructions.map((i, idx) => `${idx + 1}. ${tidyInstruction(i)}`).join('\n\n');
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert('Instructions copied');
    } catch (_) {}
  };
  
  const openSourceUrl = async () => {
    const url = selectedRecipe?.source_url || selectedRecipe?.sourceUrl;
    if (url) {
      await WebBrowser.openBrowserAsync(url);
    }
  };
  
  // Enhanced ingredient renderer
  const renderIngredientText = (text, isChecked) => {
    const t = tidyIngredient(text || '');
    const fracChars = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
    const qtyRegex = new RegExp(
      '^\\s*(' +
        '(?:\\d+\\s+\\d+\/\\d+)|' +
        '(?:\\d+\/\\d+)|' +
        '(?:\\d+\\s*[' + fracChars + '])|' +
        '(?:[' + fracChars + '])|' +
        '(?:\\d+(?:\\.\\d+)?)' +
      ')\\s*([A-Za-zµ]+)?\\s*(.*)$'
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
        <View style={styles.ingTextContainer}>
          <Text style={[styles.ingText, isChecked && styles.ingTextChecked]}>
            <Text style={[styles.ingQty, isChecked && styles.textStrikethrough]}>
              {qty}{unit}
            </Text>
            {rest ? <Text> </Text> : null}
            {renderWithNotes(rest)}
          </Text>
          {showPrices && (
            <Text style={styles.ingPrice}>£{(Math.random() * 3 + 0.5).toFixed(2)}</Text>
          )}
        </View>
      );
    }
    
    return (
      <View style={styles.ingTextContainer}>
        <Text style={[styles.ingText, isChecked && styles.ingTextChecked]}>
          {renderWithNotes(t)}
        </Text>
        {showPrices && (
          <Text style={styles.ingPrice}>£{(Math.random() * 3 + 0.5).toFixed(2)}</Text>
        )}
      </View>
    );
  };
  
  // Render ingredients with grouping support
  const renderIngredients = () => {
    if (!selectedRecipe?.ingredients) return null;
    
    const ingredients = conversionEnabled && ingredientsToUK 
      ? ingredientsToUK(selectedRecipe.ingredients)
      : selectedRecipe.ingredients;
    
    return ingredients.map((ingredient, index) => {
      const isChecked = checked.has(index);
      
      return (
        <Animated.View 
          key={index} 
          style={[
            styles.ingredientRow,
            {
              opacity: isChecked ? 0.5 : 1,
              transform: [{ translateX: isChecked ? 8 : 0 }]
            }
          ]}
        >
          <TouchableOpacity onPress={() => toggleChecked(index)}>
            <View style={[styles.checkCircle, isChecked && styles.checkCircleChecked]}>
              {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          {renderIngredientText(ingredient, isChecked)}
        </Animated.View>
      );
    });
  };
  
  return (
    <View style={styles.container}>
      {/* Sidebar Navigation */}
      <LinearGradient
        colors={[UI.primary, UI.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sidebar}
      >
        <Animated.View style={[
          styles.sidebarContent,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }
        ]}>
          {/* Logo/Title */}
          <View style={styles.sidebarHeader}>
            <Image source={require('../../assets/images/Logo.png')} style={styles.sidebarLogo} resizeMode="contain" />
            <Text style={styles.sidebarTitle}>Recipes</Text>
          </View>
          
          {/* Category Pills */}
          <ScrollView 
            style={styles.categoryList} 
            showsVerticalScrollIndicator={false}
          >
            {['All', ...categories.filter(c => c !== 'All')].map((category) => {
              const isSelected = filters.category === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryPill,
                    isSelected && styles.categoryPillActive
                  ]}
                  onPress={() => {
                    handleFilterChange('category', category);
                    Haptics.selectionAsync();
                  }}
                >
                  <View style={[
                    styles.categoryDot,
                    { backgroundColor: getCategoryColor(category, categoryColorMap[category]) }
                  ]} />
                  <Text style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextActive
                  ]}>
                    {category}
                  </Text>
                  {category !== 'All' && (
                    <Text style={[
                      styles.categoryCount,
                      isSelected && styles.categoryCountActive
                    ]}>
                      {recipes.filter(r => r.categories?.name === category).length}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {/* View Mode Toggle */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons name="grid" size={20} color={viewMode === 'grid' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            </TouchableOpacity>
          </View>
          
          {/* Bottom Actions */}
          <View style={styles.sidebarActions}>
            <TouchableOpacity 
              style={styles.sidebarAction}
              onPress={() => navigation?.navigate('Parser')}
            >
              <Ionicons name="home" size={22} color="#fff" />
              <Text style={styles.sidebarActionText}>Home</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sidebarAction}
              onPress={() => navigation?.navigate('Pantry')}
            >
              <Ionicons name="basket" size={22} color="#fff" />
              <Text style={styles.sidebarActionText}>Pantry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sidebarAction}
              onPress={() => navigation?.navigate('Book')}
            >
              <Ionicons name="book" size={22} color="#fff" />
              <Text style={styles.sidebarActionText}>Recipes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sidebarAction}
              onPress={() => navigation?.navigate('Settings')}
            >
              <Ionicons name="settings" size={22} color="#fff" />
              <Text style={styles.sidebarActionText}>Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sidebarAction}
              onPress={onLogout}
            >
              <Ionicons name="log-out" size={22} color="#fff" />
              <Text style={styles.sidebarActionText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>
      
      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Header with Search */}
        <View style={styles.header}>
          <Animated.View style={[
            styles.headerContent,
            { transform: [{ scale: scaleAnim }] }
          ]}>
            <View style={styles.headerTitleSection}>
              <Text style={styles.headerTitle}>
                {filters.category === 'All' ? 'All Recipes' : filters.category}
              </Text>
              <Text style={styles.headerSubtitle}>
                {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
              </Text>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={UI.textLight} />
              <TextInput
                placeholder="Search recipes..."
                placeholderTextColor={UI.textLight}
                value={searchQuery}
                onChangeText={onSearchChange}
                style={styles.searchInput}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => onSearchChange('')}>
                  <Ionicons name="close-circle" size={20} color={UI.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>
            
            {/* Sort & Filter Options */}
            <View style={styles.headerFilters}>
              <TouchableOpacity style={styles.filterChip}>
                <MaterialIcons name="sort" size={16} color={UI.primary} />
                <Text style={styles.filterChipText}>
                  {filters.sortBy === 'recent' ? 'Recent' : 
                   filters.sortBy === 'rating' ? 'Top Rated' :
                   filters.sortBy === 'nameAsc' ? 'A-Z' : 'Custom'}
                </Text>
              </TouchableOpacity>
              
              {filters.difficulty !== 'All' && (
                <TouchableOpacity 
                  style={styles.filterChip}
                  onPress={() => handleFilterChange('difficulty', 'All')}
                >
                  <Text style={styles.filterChipText}>{filters.difficulty}</Text>
                  <Ionicons name="close" size={14} color={UI.primary} />
                </TouchableOpacity>
              )}
              
              {filters.totalTime !== 'All' && (
                <TouchableOpacity 
                  style={styles.filterChip}
                  onPress={() => handleFilterChange('totalTime', 'All')}
                >
                  <Ionicons name="time-outline" size={14} color={UI.primary} />
                  <Text style={styles.filterChipText}>
                    {filters.totalTime === '30' ? '<30m' :
                     filters.totalTime === '60' ? '30-60m' :
                     filters.totalTime === '120' ? '1-2h' : '2h+'}
                  </Text>
                  <Ionicons name="close" size={14} color={UI.primary} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
        
        <View style={styles.contentWrapper}>
          {/* Recipe Grid/List */}
          <View style={selectedRecipe ? styles.recipeListWithDetail : styles.recipeListFull}>
            <FlatList
              data={filteredRecipes}
              numColumns={viewMode === 'grid' ? (selectedRecipe ? 2 : 3) : 1}
              key={`${viewMode}-${selectedRecipe ? '2' : '3'}`}
              renderItem={({ item, index }) => (
                <View style={styles.cardWrapper}>
                  <IPadRecipeCard
                    recipe={item}
                    index={index}
                    variant="landscape"
                    selected={selectedRecipe?.id === item.id}
                    onPress={() => onRecipeSelect(item)}
                    navigation={navigation}
                    deleteRecipe={deleteRecipe}
                    loadRecipeFromSaved={loadRecipeFromSaved}
                    submitCardRating={submitCardRating}
                    ratingsByUrl={ratingsByUrl}
                    userRatingsByUrl={userRatingsByUrl}
                    categoryColorMap={categoryColorMap}
                  />
                </View>
              )}
              keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.recipeGridContent}
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
                />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="chef-hat" size={64} color={UI.textLight} />
                  <Text style={styles.emptyTitle}>No Recipes Found</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery ? `No matches for "${searchQuery}"` : 'Add your first recipe to get started'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => navigation?.navigate('Parser')}
                  >
                    <Text style={styles.emptyButtonText}>Add Recipe</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
          
          {/* Detail Panel */}
          {selectedRecipe && (
            <Animated.View style={[
              styles.detailPanel,
              UI.shadow.xl,
              { transform: [{ translateX: detailSlideAnim }] }
            ]}>
              {/* Detail Header */}
              <LinearGradient
                colors={['#fff', UI.backgroundLight]}
                style={styles.detailHeader}
              >
                <View style={styles.detailTitleSection}>
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
                        size={12} 
                        color="#fff" 
                      />
                      <Text style={styles.difficultyText}>
                        {calculateDifficulty(selectedRecipe).level}
                      </Text>
                    </View>
                    
                    <View style={styles.timeInfo}>
                      <Ionicons name="time-outline" size={14} color={UI.textLight} />
                      <Text style={styles.timeText}>
                        {formatTime(parseTimeToMinutes(selectedRecipe.prep_time) + parseTimeToMinutes(selectedRecipe.cook_time))}
                      </Text>
                    </View>
                    
                    <View style={styles.servingsInfo}>
                      <MaterialIcons name="people" size={14} color={UI.textLight} />
                      <Text style={styles.servingsText}>
                        {selectedRecipe.servings || 4} servings
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.detailActions}>
                  <TouchableOpacity 
                    style={styles.detailActionBtn}
                    onPress={openSourceUrl}
                  >
                    <Ionicons name="link" size={18} color={UI.primary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.detailActionBtn}
                    onPress={() => navigation?.navigate('Recipe', { recipe: selectedRecipe })}
                  >
                    <Ionicons name="expand" size={18} color={UI.primary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.detailActionBtn}
                    onPress={() => onRecipeSelect(null)}
                  >
                    <Ionicons name="close" size={20} color={UI.text} />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
              
              {/* Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
                  onPress={() => setActiveTab('ingredients')}
                >
                  <MaterialIcons 
                    name="restaurant-menu" 
                    size={16} 
                    color={activeTab === 'ingredients' ? UI.primary : UI.textLight} 
                  />
                  <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
                    Ingredients
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
                  onPress={() => setActiveTab('instructions')}
                >
                  <MaterialCommunityIcons 
                    name="chef-hat" 
                    size={16} 
                    color={activeTab === 'instructions' ? UI.primary : UI.textLight} 
                  />
                  <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
                    Instructions
                  </Text>
                </TouchableOpacity>
                
                {hasUsefulComments(selectedRecipe?.commentsSummary) && (
                  <TouchableOpacity 
                    style={[styles.tab, activeTab === 'comments' && styles.activeTab]}
                    onPress={() => setActiveTab('comments')}
                  >
                    <MaterialIcons 
                      name="tips-and-updates" 
                      size={16} 
                      color={activeTab === 'comments' ? UI.primary : UI.textLight} 
                    />
                    <Text style={[styles.tabText, activeTab === 'comments' && styles.activeTabText]}>
                      Tips
                    </Text>
                  </TouchableOpacity>
                )}
                
                {selectedRecipe?.nutrition && (
                  <TouchableOpacity 
                    style={[styles.tab, activeTab === 'nutrition' && styles.activeTab]}
                    onPress={() => setActiveTab('nutrition')}
                  >
                    <MaterialIcons 
                      name="local-fire-department" 
                      size={16} 
                      color={activeTab === 'nutrition' ? UI.primary : UI.textLight} 
                    />
                    <Text style={[styles.tabText, activeTab === 'nutrition' && styles.activeTabText]}>
                      Nutrition
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Tab Content */}
              <ScrollView 
                style={styles.tabContent}
                showsVerticalScrollIndicator={false}
              >
                {activeTab === 'ingredients' && (
                  <View style={styles.ingredientsContent}>
                    {/* Controls */}
                    <View style={styles.ingredientControls}>
                      <TouchableOpacity 
                        style={styles.unitToggle}
                        onPress={onToggleConversion}
                      >
                        <Text style={styles.unitToggleText}>
                          {conversionEnabled ? 'UK' : 'US'} Units
                        </Text>
                        <MaterialCommunityIcons 
                          name={conversionEnabled ? 'toggle-switch' : 'toggle-switch-off'} 
                          size={24} 
                          color={conversionEnabled ? UI.primary : UI.textLight} 
                        />
                      </TouchableOpacity>
                      
                      <View style={styles.ingredientActions}>
                        <TouchableOpacity 
                          style={styles.ingredientActionBtn}
                          onPress={() => setShowPrices(!showPrices)}
                        >
                          <Text style={styles.ingredientActionIcon}>£</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.ingredientActionBtn}
                          onPress={clearChecked}
                        >
                          <MaterialIcons name="refresh" size={16} color={UI.primary} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.ingredientActionBtn}
                          onPress={copyIngredients}
                        >
                          <Ionicons name="copy" size={16} color={UI.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Ingredients List */}
                    {renderIngredients()}
                    
                    {/* Total Price */}
                    {showPrices && (
                      <View style={styles.totalPriceRow}>
                        <Text style={styles.totalPriceLabel}>Estimated Total:</Text>
                        <Text style={styles.totalPriceAmount}>
                          £{(selectedRecipe?.ingredients?.length * 2.5 || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                {activeTab === 'instructions' && (
                  <View style={styles.instructionsContent}>
                    <TouchableOpacity 
                      style={styles.copyInstructionsBtn}
                      onPress={copyInstructions}
                    >
                      <Ionicons name="copy-outline" size={16} color={UI.primary} />
                      <Text style={styles.copyInstructionsText}>Copy All</Text>
                    </TouchableOpacity>
                    
                    {selectedRecipe?.instructions?.map((instruction, index) => (
                      <View key={index} style={styles.stepRow}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>
                          {tidyInstruction(instruction)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {activeTab === 'comments' && hasUsefulComments(selectedRecipe?.commentsSummary) && (
                  <View style={styles.commentsContent}>
                    <View style={styles.commentsHeader}>
                      <MaterialIcons name="lightbulb" size={20} color={UI.primary} />
                      <Text style={styles.commentsTitle}>Community Tips & Tricks</Text>
                    </View>
                    <Text style={styles.commentsText}>
                      {selectedRecipe.commentsSummary}
                    </Text>
                  </View>
                )}
                
                {activeTab === 'nutrition' && selectedRecipe?.nutrition && (
                  <View style={styles.nutritionContent}>
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {selectedRecipe.nutrition.calories || '---'}
                        </Text>
                        <Text style={styles.nutritionLabel}>Calories</Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {selectedRecipe.nutrition.protein || '---'}g
                        </Text>
                        <Text style={styles.nutritionLabel}>Protein</Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {selectedRecipe.nutrition.carbs || '---'}g
                        </Text>
                        <Text style={styles.nutritionLabel}>Carbs</Text>
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {selectedRecipe.nutrition.fat || '---'}g
                        </Text>
                        <Text style={styles.nutritionLabel}>Fat</Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: UI.background,
  },
  
  // Sidebar
  sidebar: {
    width: 240,
    paddingTop: 20,
  },
  sidebarContent: {
    flex: 1,
    padding: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 30,
  },
  sidebarLogo: {
    width: 32,
    height: 32,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  categoryList: {
    flex: 1,
    marginBottom: 20,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  categoryPillText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  categoryCountActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  viewModeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewModeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sidebarActions: {
    gap: 12,
  },
  sidebarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sidebarActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: UI.backgroundLight,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    ...UI.shadow.light,
  },
  headerContent: {
    gap: 16,
  },
  headerTitleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: UI.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: UI.textLight,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: UI.text,
  },
  headerFilters: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.primary,
  },
  
  // Content Wrapper
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  recipeListFull: {
    flex: 1,
    padding: 16,
  },
  recipeListWithDetail: {
    flex: 1,
    padding: 16,
    maxWidth: '60%',
  },
  recipeGridContent: {
    paddingBottom: 20,
    paddingTop: 8, // Add top padding for first row of cards
  },
  
  // Card Wrapper
  cardWrapper: {
    marginTop: 16, // Add top margin for pop-out badges
  },
  
  // Compact Card
  compactCard: {
    borderRadius: 16,
    margin: 8,
    padding: 16,
    minHeight: 180,
    position: 'relative',
    overflow: 'visible',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  compactBadges: {
    position: 'absolute',
    top: -10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    ...UI.shadow.light,
  },
  compactBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 8,
  },
  compactRatingCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginLeft: 4,
  },
  compactMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  compactMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactMetaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  compactImage: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 60,
    height: 60,
    borderRadius: 10,
    opacity: 0.9,
  },
  compactDeleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
  },
  
  // Detail Panel
  detailPanel: {
    width: '40%',
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: UI.border,
  },
  detailHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  detailTitleSection: {
    flex: 1,
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: UI.text,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  detailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: UI.textLight,
    fontWeight: '600',
  },
  servingsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  servingsText: {
    fontSize: 13,
    color: UI.textLight,
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    top: 20,
    right: 20,
  },
  detailActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.backgroundLight,
    borderRadius: 8,
  },
  
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: UI.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: UI.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.textLight,
  },
  activeTabText: {
    color: UI.primary,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  
  // Ingredients
  ingredientsContent: {
    padding: 20,
  },
  ingredientControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.text,
  },
  ingredientActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ingredientActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.backgroundLight,
    borderRadius: 8,
  },
  ingredientActionIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.primary,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    paddingVertical: 2,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: UI.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkCircleChecked: {
    backgroundColor: UI.primary,
  },
  ingTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ingText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: UI.text,
  },
  ingTextChecked: {
    color: UI.textLight,
  },
  textStrikethrough: {
    textDecorationLine: 'line-through',
  },
  ingQty: {
    fontWeight: '700',
    color: UI.textDark,
  },
  ingNote: {
    color: UI.textLight,
    fontStyle: 'italic',
  },
  ingPrice: {
    fontSize: 13,
    color: UI.primary,
    fontWeight: '600',
    marginLeft: 12,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: UI.borderLight,
  },
  totalPriceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.text,
  },
  totalPriceAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: UI.primary,
  },
  
  // Instructions
  instructionsContent: {
    padding: 20,
  },
  copyInstructionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: UI.primaryLight,
    borderRadius: 8,
    marginBottom: 16,
  },
  copyInstructionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.primary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI.borderLight,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: UI.text,
  },
  
  // Comments
  commentsContent: {
    padding: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI.text,
  },
  commentsText: {
    fontSize: 15,
    lineHeight: 24,
    color: UI.text,
    backgroundColor: UI.primaryLight,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: UI.primary,
  },
  
  // Nutrition
  nutritionContent: {
    padding: 20,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: UI.backgroundLight,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: '800',
    color: UI.primary,
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 13,
    color: UI.textLight,
    fontWeight: '600',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: UI.textLight,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: UI.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default IPadBookLandscapeEnhanced;
