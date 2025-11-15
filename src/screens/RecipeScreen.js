import React, { useContext, useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, SafeAreaView, Dimensions, StatusBar, Image, Modal, TextInput, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { tidyIngredient, tidyInstruction } from '../utils/textCleaners';
import { AppContext } from '../context/AppContext';
import { getIngredientPrices } from '../utils/ingredientPriceService';
import * as WebBrowser from 'expo-web-browser';
import CustomHeader from '../components/CustomHeader';
import CurvedBottomBar from '../components/CurvedBottomBar';

const { width } = Dimensions.get('window');

export default function RecipeScreen({ navigation, route }) {
  const { recipe } = route.params || {};
  const context = useContext(AppContext);

  if (!context) {
    console.error('RecipeScreen: AppContext is null/undefined');
    return <View><Text>Loading...</Text></View>;
  }

  const { useUKMeasurements, setUseUKMeasurements, ingredientsToUK, hasUSMeasurements, API_BASE_URL, user, supabaseClient, savedRecipes, saveRecipe, categories = ['All'], addCategory, updateRecipeCategory, fetchedRecipes, markRecipeDeclined } = context;

  // Check if current recipe is already saved
  const currentRecipeUrl = recipe?.sourceUrl || recipe?.source_url;
  const isRecipeAlreadySaved = savedRecipes?.some(savedRecipe => 
    savedRecipe.source_url === currentRecipeUrl
  );

  const [basketStore, setBasketStore] = useState('tesco');
  const [basketMatches, setBasketMatches] = useState(null);
  const [matching, setMatching] = useState(false);
  const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients', 'instructions', or 'comments'

  // State to track if user has interacted with the recipe
  const [hasInteracted, setHasInteracted] = useState(false);

  // State to track pending navigation action
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);

  // Helper function to check if comments are meaningful
  const hasUsefulComments = (commentsSummary) => {
    return commentsSummary && 
           commentsSummary.trim() !== '' && 
           !commentsSummary.toLowerCase().includes('no helpful comments found');
  };
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [checked, setChecked] = useState(new Set());
  const [ingredientPrices, setIngredientPrices] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  // Grouped ingredients support
  const [dbIngredientRows, setDbIngredientRows] = useState(null); // rows from recipe_ingredients (saved recipes)

  // Fetch grouped ingredients from DB for saved recipes
  useEffect(() => {
    const fetchDbIngredients = async () => {
      if (!supabaseClient || !recipe?.id) { setDbIngredientRows(null); return; }
      try {
        const { data, error } = await supabaseClient
          .from('recipe_ingredients')
          .select('ingredient_text, group_label, position')
          .eq('recipe_id', recipe.id)
          .order('position');
        if (error) throw error;
        setDbIngredientRows(data || []);
      } catch (e) {
        console.warn('Failed to load recipe_ingredients:', e?.message || e);
        setDbIngredientRows(null);
      }
    };
    fetchDbIngredients();
  }, [supabaseClient, recipe?.id]);

  // Build groups from DB rows
  const groupsFromDb = useMemo(() => {
    if (!dbIngredientRows || dbIngredientRows.length === 0) return null;
    const groupsMap = new Map();
    const order = [];
    for (const row of dbIngredientRows) {
      const label = (row.group_label && String(row.group_label).trim()) || null;
      const key = label || '__default__';
      if (!groupsMap.has(key)) { groupsMap.set(key, { label, items: [] }); order.push(key); }
      groupsMap.get(key).items.push(row.ingredient_text);
    }
    return order.map(k => groupsMap.get(k));
  }, [dbIngredientRows]);

  // Build groups from raw ingredients (unsaved recipe): section headers end with ':'
  const groupsFromArray = useMemo(() => {
    if (!recipe || !Array.isArray(recipe.ingredients)) return null;
    const src = useUKMeasurements ? ingredientsToUK(recipe.ingredients) : recipe.ingredients;
    const out = [];
    let current = { label: null, items: [] };
    const headerRe = /:\s*$/;
    for (const line of src) {
      const txt = typeof line === 'string' ? line.trim() : String(line || '').trim();
      if (!txt) continue;
      if (headerRe.test(txt)) {
        // push previous group if it has items
        if (current.items.length) out.push(current);
        const label = txt.replace(headerRe, '').trim();
        current = { label, items: [] };
        continue;
      }
      current.items.push(txt);
    }
    if (current.items.length) out.push(current);
    if (out.length === 0) return null;
    return out;
  }, [recipe, useUKMeasurements, ingredientsToUK]);

  // Final groups to render
  const ingredientGroups = groupsFromDb || groupsFromArray || null;

  // Flat list for counts, copy, prices
  const flatIngredients = useMemo(() => {
    if (ingredientGroups && ingredientGroups.length) {
      return ingredientGroups.flatMap(g => g.items);
    }
    const src = recipe?.ingredients || [];
    return useUKMeasurements ? ingredientsToUK(src) : src;
  }, [ingredientGroups, recipe?.ingredients, useUKMeasurements, ingredientsToUK]);

  // Reset checked items when recipe or units change
  useEffect(() => {
    setChecked(new Set());
  }, [recipe, useUKMeasurements]);

  // Reset to ingredients tab if on comments tab but no useful comments
  useEffect(() => {
    if (activeTab === 'comments' && !hasUsefulComments(recipe?.commentsSummary)) {
      setActiveTab('ingredients');
    }
  }, [recipe?.commentsSummary, activeTab]);

  // Add beforeRemove listener to intercept navigation and show save prompt
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Don't prevent if already saved
      if (isRecipeAlreadySaved) return;

      // Don't prevent if user hasn't interacted
      if (!hasInteracted) return;

      // Check if user previously declined to save this recipe
      const recipeUrl = recipe?.sourceUrl || recipe?.source_url;
      if (recipeUrl && fetchedRecipes && fetchedRecipes.length > 0) {
        const fetchedRecipe = fetchedRecipes.find(r => r.source_url === recipeUrl);
        if (fetchedRecipe?.declined_save) return;
      }

      // Prevent navigation and show prompt
      e.preventDefault();

      // Show save prompt
      Alert.alert(
        'Save this recipe before leaving?',
        `Would you like to save "${recipe?.title}" to your Recipe Book?`,
        [
          {
            text: "Don't Save",
            style: 'destructive',
            onPress: async () => {
              // Mark as declined
              const recipeUrl = recipe?.sourceUrl || recipe?.source_url;
              if (recipeUrl) {
                try {
                  await markRecipeDeclined(recipeUrl);
                } catch (error) {
                  console.warn('Failed to mark recipe as declined:', error);
                  // Still allow navigation - don't block user
                }
              }
              // Allow navigation
              navigation.dispatch(e.data.action);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {} // Do nothing, stay on screen
          },
          {
            text: 'Save',
            onPress: () => {
              // Store the navigation action to execute after save completes
              setPendingNavigationAction(e.data.action);
              // Show category selector
              setShowSaveModal(true);
            }
          }
        ],
        { cancelable: false }
      );
    });

    return unsubscribe;
  }, [navigation, isRecipeAlreadySaved, hasInteracted, recipe, fetchedRecipes, markRecipeDeclined]);

  // Helper function to handle tab changes with interaction tracking
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setHasInteracted(true); // Mark as interacted when changing tabs
  };

  const toggleChecked = (index) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
    setHasInteracted(true); // Mark as interacted when checking ingredients
  };

  const clearChecked = () => setChecked(new Set());

  const copyIngredients = async () => {
    try {
      const text = flatIngredients.map(i => tidyIngredient(i)).join('\n');
      await Clipboard.setStringAsync(text);
      alert('Ingredients copied');
    } catch (_) {}
  };

  const loadIngredientPrices = async () => {
    if (!flatIngredients.length) return;
    
    setLoadingPrices(true);
    try {
      const prices = await getIngredientPrices(flatIngredients);
      setIngredientPrices(prices);
    } catch (error) {
      console.warn('Error loading ingredient prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const togglePrices = () => {
    if (!showPrices && ingredientPrices.length === 0) {
      loadIngredientPrices();
    }
    setShowPrices(!showPrices);
  };

  const renderIngredientText = (text) => {
    const t = tidyIngredient(text || '');
    // Bold-ish quantity + unit at the start if present, including unicode fractions
    const fracChars = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
    const qtyRegex = new RegExp(
      '^\\s*' +
      '(' +
        '(?:\\d+\\s+\\d+\/\\d+)' +         // mixed number with ascii fraction (e.g., 1 1/2)
        '|' +
        '(?:\\d+\/\\d+)' +                    // ascii fraction (e.g., 3/4)
        '|' +
        '(?:\\d+\\s*[' + fracChars + '])' +    // mixed number with unicode fraction (e.g., 1½ or 1 ½)
        '|' +
        '(?:[' + fracChars + '])' +               // unicode fraction alone (e.g., ½)
        '|' +
        '(?:\\d+(?:\\.\\d+)?)' +             // decimal or integer
      ')' +
      '\\s*' +
      '([A-Za-zµ]+)?' +                           // optional unit
      '\\s*(.*)$'                                // rest of line
    );
    const m = t.match(qtyRegex);
    const renderWithNotes = (str) => {
      const parts = str.split(/(\([^)]*\))/g).filter(Boolean);
      return parts.map((part, idx) => (
        <Text key={idx} style={part.startsWith('(') ? styles.ingNote : null}>{part}</Text>
      ));
    };
    if (m) {
      const qty = m[1];
      const unit = m[2] ? ` ${m[2]}` : '';
      const rest = m[3] || '';
      return (
        <Text>
          <Text style={styles.ingQty}>{qty}{unit}</Text>
          {rest ? <Text> </Text> : null}
          {renderWithNotes(rest)}
        </Text>
      );
    }
    return <Text>{renderWithNotes(t)}</Text>;
  };

  // Helper function to remove PT prefix from time strings
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.replace(/^PT/, '');
  };

  // Save recipe functions
  const handleSaveRecipe = () => {
    setShowSaveModal(true);
  };

  const handleSaveToCategory = async (category) => {
    try {
      await saveRecipe(recipe, category);
      setShowSaveModal(false);
      alert('Recipe saved successfully!');

      // If there's a pending navigation action, execute it after a brief delay
      // so user can see the success message
      if (pendingNavigationAction) {
        setTimeout(() => {
          navigation.dispatch(pendingNavigationAction);
          setPendingNavigationAction(null);
        }, 300);
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert(`Failed to save recipe: ${error.message}`);
      // Clear pending navigation on error
      setPendingNavigationAction(null);
    }
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      try {
        const newCategory = await addCategory(newCategoryName.trim());
        setNewCategoryName('');
        setShowCategoryModal(false);
        // Auto-save to the new category
        if (newCategory) {
          await handleSaveToCategory(newCategoryName.trim());
        }
      } catch (error) {
        console.error('Error adding category:', error);
        if (error.code === '23505') {
          alert('This category already exists!');
        } else {
          alert('Failed to create category');
        }
      }
    }
  };

  // Load existing ratings when component mounts
  useEffect(() => {
    const recipeUrl = recipe?.sourceUrl || recipe?.source_url;
    if (recipeUrl && supabaseClient && user) {
      loadRatings();
    }
  }, [recipe?.sourceUrl, recipe?.source_url, supabaseClient, user]);

  const loadRatings = async () => {
    try {
      // Get the recipe URL - handle both camelCase and snake_case
      const recipeUrl = recipe?.sourceUrl || recipe?.source_url;
      if (!recipeUrl) {
        console.warn('No recipe URL found for ratings');
        return;
      }

      // Get user's rating for this recipe
      const { data: userRatingData } = await supabaseClient
        .from('recipe_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('recipe_url', recipeUrl)
        .single();

      if (userRatingData) {
        setUserRating(userRatingData.rating);
      }

      // Get average rating and total count
      const { data: avgData } = await supabaseClient
        .from('recipe_ratings')
        .select('rating')
        .eq('recipe_url', recipeUrl);

      if (avgData && avgData.length > 0) {
        const avg = avgData.reduce((sum, item) => sum + item.rating, 0) / avgData.length;
        setAverageRating(Math.round(avg * 10) / 10); // Round to 1 decimal
        setTotalRatings(avgData.length);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
    }
  };

  const submitRating = async (rating) => {
    const recipeUrl = recipe?.sourceUrl || recipe?.source_url;
    if (!supabaseClient || !user || !recipeUrl || savingRating) return;
    
    setSavingRating(true);
    try {
      // Upsert rating (insert or update if exists)
      const { error } = await supabaseClient
        .from('recipe_ratings')
        .upsert({
          user_id: user.id,
          recipe_url: recipeUrl,
          recipe_title: recipe.title,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,recipe_url'
        });

      if (error) throw error;

      setUserRating(rating);
      
      // Reload ratings to get updated average
      await loadRatings();
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to save rating');
    } finally {
      setSavingRating(false);
    }
  };

  const findGroceryMatches = async () => {
    setMatching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/grocery-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, store: basketStore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      // overlay saved mappings
      if (user && data?.items?.length && supabaseClient) {
        const queries = data.items.map(it => it.query);
        const { data: saved } = await supabaseClient
          .from('product_mappings')
          .select('normalized_name, product_url, product_label')
          .eq('store', basketStore)
          .in('normalized_name', queries);
        const map = new Map((saved || []).map(r => [r.normalized_name, r]));
        data.items = data.items.map(it => {
          const s = map.get(it.query);
          return s ? { ...it, mappedUrl: s.product_url, mappedLabel: s.product_label } : it;
        });
      }
      setBasketMatches(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setMatching(false);
    }
  };

  if (!recipe) return null;

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ff8243" barStyle="light-content" />

      {/* CustomHeader */}
      <CustomHeader
        title={recipe?.title || 'Recipe'}
        subtitle={`${recipe.prepTime ? `Prep: ${formatTime(recipe.prepTime)}` : ''}${recipe.cookTime ? ` • Cook: ${formatTime(recipe.cookTime)}` : ''}${recipe.category ? ` • ${recipe.category}` : ''}`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      
      <SafeAreaView style={styles.safeContent}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Streamlined Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryActionButton, styles.fullWidthButton]}
          onPress={() => navigation.navigate('CookingMode', { recipe })}
        >
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Start Cooking</Text>
        </TouchableOpacity>

        {/* Enhanced Tab Container */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
            onPress={() => handleTabChange('instructions')}
          >
            <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
              Instructions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
            onPress={() => handleTabChange('ingredients')}
          >
            <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
              Ingredients
            </Text>
          </TouchableOpacity>
          {hasUsefulComments(recipe.commentsSummary) && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'comments' && styles.activeTab]}
              onPress={() => handleTabChange('comments')}
            >
              <Text style={[styles.tabText, activeTab === 'comments' && styles.activeTabText]}>
                Comments
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content based on active tab */}
        {activeTab === 'ingredients' ? (
          <View style={styles.contentCard}>
            {/* Clean Ingredients Header */}
            <View style={styles.ingredientsHeader}>
              <View style={styles.headerRow}>
                <View style={styles.headerRight}>
                  {/* Price comparison temporarily disabled - using mock data */}
                  {/* <TouchableOpacity 
                    style={[styles.pricesButton, showPrices && styles.activePricesButton]}
                    onPress={togglePrices}
                    disabled={loadingPrices}
                  >
                    {loadingPrices ? (
                      <ActivityIndicator size={16} color={showPrices ? "#fff" : colors.orange_pantone[500]} />
                    ) : (
                      <Ionicons 
                        name={showPrices ? "pricetag" : "pricetag-outline"} 
                        size={16} 
                        color={showPrices ? "#fff" : colors.orange_pantone[500]} 
                      />
                    )}
                    <Text style={[styles.pricesButtonText, showPrices && styles.activePricesButtonText]}>
                      Compare Prices
                    </Text>
                  </TouchableOpacity> */}
                  {/* Star Rating */}
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = userRating ? star <= userRating : star <= Math.round(averageRating || 0);
                      return (
                        <TouchableOpacity key={star} onPress={() => submitRating(star)}>
                          <Ionicons
                            name={filled ? 'star' : 'star-outline'}
                            size={20}
                            color={filled ? '#ffd700' : '#ccc'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                    {totalRatings > 0 && (
                      <Text style={styles.ratingText}>
                        {averageRating.toFixed(1)} ({totalRatings})
                      </Text>
                    )}
                  </View>

                  {/* Compact US/UK units toggle */}
                  {(useUKMeasurements || (recipe?.ingredients || []).some(hasUSMeasurements)) && (
                    <View style={styles.unitsToggle}>
                      <TouchableOpacity
                        style={[styles.unitToggleButton, !useUKMeasurements && styles.activeUnitToggleButton]}
                        onPress={() => setUseUKMeasurements(false)}
                      >
                        <Text style={[styles.unitToggleText, !useUKMeasurements && styles.activeUnitToggleText]}>US</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitToggleButton, useUKMeasurements && styles.activeUnitToggleButton]}
                        onPress={() => setUseUKMeasurements(true)}
                      >
                        <Text style={[styles.unitToggleText, useUKMeasurements && styles.activeUnitToggleText]}>UK</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

            </View>

            {/* Ingredients List with optional section headers */}
            <View style={styles.ingredientsList}>
              {(() => {
                let idx = 0;
                const blocks = [];
                const groups = ingredientGroups || [{ label: null, items: flatIngredients }];
                for (const group of groups) {
                  if (group.label) {
                    blocks.push(
                      <View key={`hdr-${group.label}-${idx}`} style={styles.groupHeaderRow}>
                        <Text style={styles.groupHeaderText}>{group.label}</Text>
                      </View>
                    );
                  }
                  for (const ing of group.items) {
                    blocks.push(
                      <View key={`ing-${idx}`} style={styles.ingredientRow}>
                        <Text style={styles.bulletPoint}>•</Text>
                        <View style={styles.ingredientContent}>
                          <Text style={styles.ingText}>
                            {renderIngredientText(ing)}
                          </Text>
                        </View>
                      </View>
                    );
                    idx += 1;
                  }
                }
                return blocks;
              })()}
            </View>
            
            {/* Copy All Button at Bottom */}
            <TouchableOpacity onPress={copyIngredients} style={styles.copyAllButton}>
              <Ionicons name="copy-outline" size={18} color={colors.orange_pantone[500]} />
              <Text style={styles.copyAllButtonText}>Copy All Ingredients</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'instructions' ? (
          <View style={styles.contentCard}>
            <View style={styles.instructionsList}>
              {recipe.instructions?.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i+1}</Text>
                  </View>
                  <Text style={styles.stepText}>{tidyInstruction(step)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : activeTab === 'comments' ? (
          <View style={styles.contentCard}>
            <View style={styles.commentsContent}>
              <View style={styles.commentsHeader}>
                <Ionicons name="chatbubbles" size={24} color="#ff8243" />
                <Text style={styles.commentsTitle}>User Comments & Tips</Text>
              </View>
              <Text style={styles.commentsText}>{recipe.commentsSummary}</Text>
            </View>
          </View>
        ) : null}

      </ScrollView>
      </SafeAreaView>
      
      {/* Save Recipe Modal */}
      <Modal visible={showSaveModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowSaveModal(false);
                // Clear pending navigation if user cancels the save
                setPendingNavigationAction(null);
              }}
            >
              <Ionicons name="close" size={22} color="#ff8243" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Save Recipe</Text>
            <Text style={styles.modalSubtitle}>Choose a category for this recipe</Text>
            
            <ScrollView style={styles.categoryList}>
              {categories.filter(cat => cat !== 'All').map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => handleSaveToCategory(category)}
                >
                  <Text style={styles.categoryOptionText}>{category}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.newModalButtonContainer}>
              <TouchableOpacity
                style={styles.newCreateButton}
                onPress={() => {
                  setShowSaveModal(false);
                  setShowCategoryModal(true);
                }}
              >
                <Text style={styles.newCreateButtonText}>Create New Category</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.newCloseButton}
                onPress={() => {
                  setShowSaveModal(false);
                  // Clear pending navigation if user closes the modal
                  setPendingNavigationAction(null);
                }}
              >
                <Text style={styles.newCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowCategoryModal(false);
                setNewCategoryName('');
              }}
            >
              <Ionicons name="close" size={22} color="#ff8243" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Category name..."
              autoFocus
            />
            
            <View style={styles.newModalButtonContainer}>
              <TouchableOpacity 
                style={styles.newCloseButton}
                onPress={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text style={styles.newCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.newCreateButton}
                onPress={handleAddCategory}
              >
                <Text style={styles.newCreateButtonText}>Save Here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Curved Bottom Navigation Bar */}
      <CurvedBottomBar
        navigation={navigation}
        activeRoute="Recipe"
        dynamicButtonMode={!isRecipeAlreadySaved ? 'save' : 'default'}
        dynamicButtonShowGlow={!isRecipeAlreadySaved}
        dynamicButtonOnPress={!isRecipeAlreadySaved ? handleSaveRecipe : null}
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 60,
    backgroundColor: '#ff8243',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    height: 200,
  },
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
    alignItems: 'flex-start',
    marginBottom: 12,
    zIndex: 3,
    maxWidth: '70%',
    paddingRight: 12,
  },
  pageTitle: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 32,
    maxWidth: 260,
    letterSpacing: 0.2,
  },
  headerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRatingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    opacity: 0.9,
  },
  headerMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  headerMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerMetaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
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
  // Overlapping Recipe Card
  overlappingRecipeCard: {
    position: 'absolute',
    top: -25,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#e07a5f',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  recipeCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  websiteLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  websiteLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  websiteLogoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  recipeCardInfo: {
    flex: 1,
  },
  recipeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
  ratingInfo: {
    alignSelf: 'flex-start',
  },
  averageRating: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
    fontWeight: '500',
  },
  
  // Add padding when card is shown
  scrollContentWithCard: {
    paddingTop: 100, // Extra space for overlapping recipe card
  },
  
  // Action Button (full width)
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8243',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  fullWidthButton: {
    width: '100%',
  },
  primaryActionButton: {
    backgroundColor: '#4CAF50',
  },
  activePriceButton: {
    backgroundColor: colors.orange_pantone[600],
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Enhanced Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9dbcd',
    borderRadius: 8,
    marginBottom: 0,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientsTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  inlineUnitsSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  unitButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeUnitButton: {
    backgroundColor: colors.orange_pantone[500],
  },
  unitEmoji: {
    fontSize: 12,
  },
  activeTab: {
    backgroundColor: '#ff9b6b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  
  // Content Card
  contentCard: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Ingredients Header Styles
  ingredientsHeader: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: colors.charcoal[400],
    fontWeight: '500',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeHeaderButton: {
    backgroundColor: colors.orange_pantone[500],
  },
  headerButtonText: {
    fontSize: 12,
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  activeHeaderButtonText: {
    color: '#fff',
  },
  pricesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 130, 67, 0.1)',
    borderWidth: 1,
    borderColor: colors.orange_pantone[300],
  },
  activePricesButton: {
    backgroundColor: colors.orange_pantone[500],
    borderColor: colors.orange_pantone[500],
  },
  pricesButtonText: {
    fontSize: 13,
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  activePricesButtonText: {
    color: '#fff',
  },
  unitsToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  ratingText: {
    fontSize: 12,
    color: colors.charcoal[600],
    marginLeft: 6,
    fontWeight: '600',
  },
  unitsToggle: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 0,
    width: 'auto',
  },
  unitToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: 14,
  },
  activeUnitToggleButton: {
    backgroundColor: colors.orange_pantone[500],
    borderColor: colors.orange_pantone[500],
  },
  unitToggleEmoji: {
    fontSize: 12,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  activeUnitToggleText: {
    color: '#fff',
  },
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 130, 67, 0.1)',
    borderWidth: 1,
    borderColor: colors.orange_pantone[300],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  copyAllButtonText: {
    fontSize: 14,
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBottomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  progressCount: {
    color: colors.charcoal[500],
    fontSize: 15,
    fontWeight: '700',
  },
  unitsSelector: {
    alignItems: 'center',
  },
  unitsLabel: {
    color: colors.charcoal[400],
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  flagContainer: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 18,
    padding: 2,
  },
  flagButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFlagButton: {
    backgroundColor: '#ff8243',
    shadowColor: '#ff8243',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  flagEmoji: {
    fontSize: 16,
  },
  actionBtn: {
    backgroundColor: colors.orange_pantone[500],
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  resetBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.orange_pantone[400],
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  
  // Comments Content
  commentsContent: {
    padding: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  commentsText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  
  
  // Comments Section
  commentsSection: {
    backgroundColor: '#ff8243',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  commentsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  commentsSummaryText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    opacity: 0.9,
  },
  noCommentsText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  safeContent: {
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  container: { 
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: colors.charcoal[500], 
    marginBottom: 12,
    lineHeight: 36,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  link: { 
    color: colors.lapis_lazuli[500],
    fontWeight: '600',
    fontSize: 16,
  },
  metaContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: 16, 
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: { 
    color: colors.charcoal[500],
    fontWeight: '600',
    fontSize: 14,
  },
  section: { 
    marginBottom: 24,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: colors.charcoal[500],
  },
  toggleRow: { 
    flexDirection: 'row', 
    backgroundColor: colors.carolina_blue[50] || '#f0f9ff',
    borderRadius: 8,
    padding: 2,
  },
  toggle: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6,
  },
  toggleActive: { 
    backgroundColor: colors.hunyadi_yellow[500], 
  },
  toggleText: { 
    color: colors.charcoal[500], 
    fontWeight: '600', 
    fontSize: 14,
  },
  toggleTextActive: { 
    color: '#fff',
  },
  storeContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  storeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.charcoal[500],
    marginBottom: 12,
  },
  storeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  storeChips: { 
    flexDirection: 'row', 
    gap: 8,
    flex: 1,
  },
  storeChip: { 
    borderWidth: 2, 
    borderColor: colors.carolina_blue[200] || '#bfdbfe', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#fff',
  },
  storeChipActive: { 
    backgroundColor: colors.hunyadi_yellow[500], 
    borderColor: colors.hunyadi_yellow[400],
  },
  storeChipText: { 
    color: colors.charcoal[500], 
    fontWeight: '600', 
    fontSize: 12,
  },
  storeChipTextActive: { 
    color: '#fff',
  },
  storeBtn: { 
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 12,
  },
  storeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  storeBtnText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14,
  },
  matchesBox: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    borderWidth: 1, 
    borderColor: colors.lapis_lazuli[100] || '#dbeafe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  matchesHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 12,
  },
  matchesTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchesTitle: { 
    fontWeight: '700', 
    color: colors.charcoal[500],
    fontSize: 16,
  },
  openAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.charcoal[50] || '#f8fafc',
  },
  matchContent: {
    flex: 1,
  },
  matchIng: { 
    fontWeight: '600', 
    color: colors.charcoal[500],
    fontSize: 14,
    marginBottom: 2,
  },
  matchQuery: { 
    color: colors.charcoal[400], 
    fontSize: 12,
  },
  matchOpen: { 
    backgroundColor: colors.orange_pantone[500], 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchOpenText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 12,
  },
  ingredientsList: {
    marginTop: 0,
  },
  groupHeaderRow: {
    paddingVertical: 6,
    marginTop: 12,
  },
  groupHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.charcoal[500],
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingVertical: 4,
  },
  ingredientContent: {
    flex: 1,
  },
  bulletPoint: {
    fontSize: 20,
    color: colors.orange_pantone[500],
    fontWeight: '700',
    marginTop: 2,
    width: 12,
  },
  ingText: {
    color: '#333',
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  ingQty: {
    fontWeight: '800',
    color: colors.charcoal[500],
  },
  ingNote: {
    color: colors.charcoal[400],
  },
  priceContainer: {
    marginTop: 4,
  },
  priceText: {
    fontSize: 12,
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  priceCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceCompareText: {
    fontSize: 10,
    color: colors.charcoal[400],
    fontStyle: 'italic',
  },
  instructionsList: {
    marginTop: 0,
  },
  stepRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 16, 
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepNum: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#ff8243', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  stepText: { 
    color: '#333', 
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
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
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#ff8243',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(255,130,67,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  modalAddBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ff8243',
    alignItems: 'center',
  },
  modalAddText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
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
    color: '#333',
  },
  addCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
  },
  addCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff8243',
  },
  newModalButtonContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
  },
  newCreateButton: {
    width: '100%',
    backgroundColor: '#ff8243',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  newCreateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  newCloseButton: {
    width: '100%',
    backgroundColor: '#f1f1f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  newCloseButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
});
