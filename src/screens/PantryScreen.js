import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { AppContext } from '../context/AppContext';
import CustomHeader from '../components/CustomHeader';
import CurvedBottomBar from '../components/CurvedBottomBar';
import { 
  getUserPantry, 
  addToPantry, 
  removeFromPantry, 
  updatePantryItem,
  getRecipeSuggestions 
} from '../utils/pantryService';

export default function PantryScreen({ navigation }) {
  const { user, supabaseClient, API_BASE_URL } = useContext(AppContext);
  
  const [pantryItems, setPantryItems] = useState([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('pantry'); // 'pantry' or 'suggestions'
  
  // Add item form state
  const [newIngredient, setNewIngredient] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  // Autocomplete state (canonical ingredients)
  const [acQuery, setAcQuery] = useState('');
  const [acOptions, setAcOptions] = useState([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acSelected, setAcSelected] = useState(null); // { ingredient_id, name }

  // Debounced search for canonical ingredients
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!supabaseClient) return;
        const q = acQuery.trim();
        if (!q || q.length < 2) { setAcOptions([]); return; }
        setAcLoading(true);
        const { data, error } = await supabaseClient.rpc('ingredient_autocomplete', { q, max_results: 8 });
        if (!error) setAcOptions(data || []);
      } catch (e) {
        // non-fatal
      } finally {
        setAcLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [acQuery, supabaseClient]);

  useEffect(() => {
    if (user && supabaseClient) {
      loadPantryData();
    }
  }, [user, supabaseClient]);

  useEffect(() => {
    if (activeTab === 'suggestions' && user && supabaseClient) {
      loadRecipeSuggestions();
    }
  }, [activeTab, user, supabaseClient]);

  // Prefetch suggestions when pantry or auth changes (so they are ready without opening the tab)
  useEffect(() => {
    if (user && supabaseClient) {
      loadRecipeSuggestions();
    }
  }, [user, supabaseClient, pantryItems]);

  const loadPantryData = async () => {
    try {
      setLoading(true);
      const pantry = await getUserPantry(user.id, supabaseClient);
      setPantryItems(pantry);
    } catch (error) {
      console.error('Error loading pantry:', error);
      Alert.alert('Error', 'Failed to load pantry items');
    } finally {
      setLoading(false);
    }
  };

  const loadRecipeSuggestions = async () => {
    try {
      // Skip per-user suggestion view to avoid recommending saved recipes
      const initial = [];

      // Helper normalize
      const { cleanIngredientForSearch } = require('../utils/ingredientPriceService');
      const normalize = s => (cleanIngredientForSearch(s || '') || '').toLowerCase();
      const pantrySet = new Set((pantryItems || []).map(p => normalize(p.cleaned_name || p.ingredient_name)));

      // Exclude already saved recipes (by source_url)
      const { data: saved } = await supabaseClient
        .from('recipes')
        .select('source_url')
        .eq('user_id', user.id);
      const savedUrlSet = new Set((saved || []).map(r => r.source_url).filter(Boolean));

      // Global suggestions from top-rated + recipe_assets
      const { data: top } = await supabaseClient
        .from('top_rated_recipes')
        .select('recipe_url, recipe_title, average_rating, total_ratings')
        .order('average_rating', { ascending: false })
        .limit(50);
      const urls = Array.from(new Set((top || []).map(t => t.recipe_url))).filter(Boolean);
      let globalItems = [];
      if (urls.length) {
        const { data: assets } = await supabaseClient
          .from('recipe_assets')
          .select('recipe_url, recipe_title, image_url, ingredients, prep_time, cook_time')
          .in('recipe_url', urls);
        const assetsByUrl = new Map((assets || []).map(a => [a.recipe_url, a]));
        globalItems = urls
          .filter(u => !savedUrlSet.has(u)) // exclude user's own saved recipes
          .map(u => {
            const a = assetsByUrl.get(u);
            const ings = Array.isArray(a?.ingredients) ? a.ingredients : [];
            const total = ings.length;
            let hits = 0;
            ings.forEach(txt => {
              const c = normalize(txt);
              if (!c) return;
              if (pantrySet.has(c)) { hits += 1; return; }
              for (const p of pantrySet) {
                if (c.includes(p) || p.includes(c)) { hits += 1; break; }
              }
            });
            const pct = total > 0 ? Math.round((hits / total) * 1000) / 10 : 0;
            return {
              id: u,
              title: a?.recipe_title || top?.find(t => t.recipe_url === u)?.recipe_title || 'Recipe',
              image_url: a?.image_url || null,
              servings: null,
              prep_time: a?.prep_time || null,
              cook_time: a?.cook_time || null,
              source_url: u,
              total_ingredients: total,
              pantry_matches: hits,
              match_percentage: pct,
            };
          })
          .filter(s => s.total_ingredients > 0)
          .sort((a, b) => b.match_percentage - a.match_percentage)
          .slice(0, 25);
      }

      // Merge (currently only global) suggestions, prioritize higher match and de-dupe by source_url/id
      const byKey = new Map();
      const push = (arr) => {
        (arr || []).forEach(s => {
          const key = s.source_url || s.id;
          if (!key) return;
          const prev = byKey.get(key);
          if (!prev || (s.match_percentage || 0) > (prev.match_percentage || 0)) {
            byKey.set(key, s);
          }
        });
      };
      push(initial);
      push(globalItems);
      const merged = Array.from(byKey.values()).sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));
      setRecipeSuggestions(merged);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      Alert.alert('Error', 'Failed to load recipe suggestions');
    }
  };

  const handleAddItem = async () => {
    if (!acSelected?.ingredient_id) {
      Alert.alert('Pick Ingredient', 'Please search and select a known ingredient');
      return;
    }

    try {
      setAdding(true);
      // Save by canonical ingredient_id via RPC
      const { error } = await supabaseClient.rpc('upsert_pantry_item_by_id', {
        p_ingredient_id: acSelected.ingredient_id,
        qty: newQuantity || null,
        unit: null,
        notes: newNotes || null,
      });
      if (error) throw error;
      
      // Reset form
      setNewIngredient('');
      setAcQuery('');
      setAcOptions([]);
      setAcSelected(null);
      setNewQuantity('');
      setNewNotes('');
      setShowAddModal(false);
      
      // Reload pantry
      await loadPantryData();
      
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveItem = async (item) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.ingredient_name}" from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromPantry(item.id, supabaseClient);
              await loadPantryData();
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Failed to remove item');
            }
          }
        }
      ]
    );
  };

  const handleRecipeTap = async (recipe) => {
    try {
      const url = recipe.source_url;
      let full = { ingredients: [], instructions: [] };
      // Try recipe_assets first
      try {
        const { data: asset } = await supabaseClient
          .from('recipe_assets')
          .select('recipe_title, image_url, ingredients, instructions, prep_time, cook_time')
          .eq('recipe_url', url)
          .single();
        if (asset) {
          full = {
            title: asset.recipe_title || recipe.title,
            image: asset.image_url || recipe.image_url,
            ingredients: Array.isArray(asset.ingredients) ? asset.ingredients : [],
            instructions: Array.isArray(asset.instructions) ? asset.instructions : [],
            prepTime: asset.prep_time || recipe.prep_time,
            cookTime: asset.cook_time || recipe.cook_time,
          };
        }
      } catch (_) {}
      // Fallback: parse live if missing
      if ((!full.ingredients || full.ingredients.length === 0) && API_BASE_URL) {
        try {
          const res = await fetch(`${API_BASE_URL}/.netlify/functions/parse-recipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          const data = await res.json();
          if (res.ok && data) {
            full = {
              ...full,
              title: full.title || data.title || recipe.title,
              ingredients: Array.isArray(data.ingredients) ? data.ingredients : full.ingredients,
              instructions: Array.isArray(data.instructions) ? data.instructions : full.instructions,
              prepTime: full.prepTime || data.prepTime || recipe.prep_time,
              cookTime: full.cookTime || data.cookTime || recipe.cook_time,
            };
          }
        } catch (_) {}
      }
      // Navigate with enriched recipe
      navigation.navigate('Recipe', { recipe: {
        title: full.title || recipe.title,
        sourceUrl: url,
        image: full.image || recipe.image_url,
        servings: recipe.servings,
        prepTime: full.prepTime || recipe.prep_time,
        cookTime: full.cookTime || recipe.cook_time,
        ingredients: full.ingredients || [],
        instructions: full.instructions || [],
        matchPercentage: recipe.match_percentage,
        totalIngredients: recipe.total_ingredients,
        pantryMatches: recipe.pantry_matches
      }});
    } catch (e) {
      Alert.alert('Error', 'Could not open recipe. Please try again.');
    }
  };

  const renderPantryItem = ({ item }) => (
    <View style={styles.pantryItem}>
      <View style={styles.pantryItemContent}>
        <Text style={styles.pantryItemName}>{item.ingredient_name}</Text>
        {item.quantity && (
          <Text style={styles.pantryItemQuantity}>{item.quantity}</Text>
        )}
        {item.notes && (
          <Text style={styles.pantryItemNotes}>{item.notes}</Text>
        )}
        {(() => {
          const formatDate = (v) => {
            if (!v) return null;
            const d = new Date(v);
            return isNaN(d) ? null : d.toLocaleDateString();
          };
          const added =
            formatDate(item.created_at) ||
            formatDate(item.updated_at) ||
            null;
          return (
            <Text style={styles.pantryItemDate}>
              {added ? `Added ${added}` : 'Added just now'}
            </Text>
          );
        })()}
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#dc3545" />
      </TouchableOpacity>
    </View>
  );

  const renderRecipeSuggestion = ({ item }) => (
    <TouchableOpacity 
      style={styles.suggestionItem}
      onPress={() => handleRecipeTap(item)}
    >
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionTitle}>{item.title}</Text>
        <View style={styles.suggestionMeta}>
          <View style={styles.matchInfo}>
            <View style={[styles.matchBadge, { backgroundColor: getMatchColor(item.match_percentage) }]}>
              <Text style={styles.matchPercentage}>{Math.round(item.match_percentage)}%</Text>
            </View>
            <Text style={styles.matchText}>
              {item.pantry_matches} of {item.total_ingredients} ingredients
            </Text>
          </View>
          {item.prep_time && (
            <Text style={styles.suggestionTime}>⏱ {item.prep_time}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.orange_pantone[500]} />
    </TouchableOpacity>
  );

  const getMatchColor = (percentage) => {
    if (percentage >= 80) return '#4CAF50';
    if (percentage >= 60) return '#FF9800';
    if (percentage >= 40) return '#FFC107';
    return '#FF5722';
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar backgroundColor="#ff8243" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.orange_pantone[500]} />
          <Text style={styles.loadingText}>Loading your pantry...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ff8243" barStyle="light-content" />

      {/* CustomHeader */}
      <CustomHeader
        title="My Pantry"
        subtitle={`${pantryItems.length} ${pantryItems.length === 1 ? 'item' : 'items'} in pantry`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={28} color="#fff" />
          </TouchableOpacity>
        }
      />

      {/* Tab Container */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pantry' && styles.activeTab]}
          onPress={() => setActiveTab('pantry')}
        >
          <Text style={[styles.tabText, activeTab === 'pantry' && styles.activeTabText]}>
            Pantry ({pantryItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Recipes ({recipeSuggestions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'pantry' ? (
          pantryItems.length > 0 ? (
            <FlatList
              data={pantryItems}
              renderItem={renderPantryItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>Your pantry is empty</Text>
              <Text style={styles.emptyText}>
                Add ingredients you have at home to get personalized recipe suggestions
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.emptyButtonText}>Add First Item</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          recipeSuggestions.length > 0 ? (
            <FlatList
              data={recipeSuggestions}
              renderItem={renderRecipeSuggestion}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>No recipe suggestions</Text>
              <Text style={styles.emptyText}>
                Add more ingredients to your pantry to get recipe suggestions
              </Text>
            </View>
          )
        )}
      </View>

      {/* Add Item Modal */}
      <Modal 
        visible={showAddModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          {/* Tap outside to dismiss keyboard */}
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add to Pantry</Text>
              
              {/* Ingredient Autocomplete */}
              <View style={styles.acContainer}>
                <TextInput
                style={styles.input}
                placeholder="Search ingredient *"
                value={acSelected?.name || acQuery}
                onChangeText={(txt) => { setAcSelected(null); setAcQuery(txt); setNewIngredient(txt); }}
                autoFocus
              />
              {/* Suggestions */}
              {(acOptions.length > 0 && !acSelected) && (
                <ScrollView 
                  style={styles.acDropdown}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {acOptions.map((opt, idx) => (
                    <TouchableOpacity key={opt.ingredient_id + ':' + idx} style={styles.acRow}
                      onPress={() => { setAcSelected({ ingredient_id: opt.ingredient_id, name: opt.name }); setAcOptions([]); }}>
                      <Text style={styles.acRowText}>{opt.name}</Text>
                      {opt.matched && <Text style={styles.acAlias}>aka {opt.matched}</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Quantity (optional)"
                value={newQuantity}
                onChangeText={setNewQuantity}
              />
              
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                value={newNotes}
                onChangeText={setNewNotes}
                multiline
                numberOfLines={3}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowAddModal(false)}
                  disabled={adding}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.addItemButton, (!acSelected || adding) && { opacity: 0.6 }]}
                  onPress={handleAddItem}
                  disabled={adding || !acSelected}
                >
                  {adding ? (
                    <ActivityIndicator size={20} color="#fff" />
                  ) : (
                    <Text style={styles.addItemButtonText}>Add Item</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* Curved Bottom Navigation Bar */}
      <CurvedBottomBar
        navigation={navigation}
        activeRoute="Pantry"
        dynamicButtonMode="add-ingredient"
        dynamicButtonShowGlow={false}
        dynamicButtonOnPress={() => setShowAddModal(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.charcoal[400],
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: colors.orange_pantone[50],
    borderBottomWidth: 3,
    borderBottomColor: colors.orange_pantone[500],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.charcoal[400],
  },
  activeTabText: {
    color: colors.orange_pantone[500],
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  pantryItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pantryItemContent: {
    flex: 1,
  },
  pantryItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pantryItemQuantity: {
    fontSize: 14,
    color: colors.orange_pantone[500],
    fontWeight: '500',
    marginBottom: 4,
  },
  pantryItemNotes: {
    fontSize: 12,
    color: colors.charcoal[400],
    fontStyle: 'italic',
    marginBottom: 4,
  },
  pantryItemDate: {
    fontSize: 11,
    color: colors.charcoal[300],
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  suggestionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  suggestionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchPercentage: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  matchText: {
    fontSize: 12,
    color: colors.charcoal[400],
  },
  suggestionTime: {
    fontSize: 12,
    color: colors.charcoal[400],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.charcoal[400],
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  emptyButton: {
    backgroundColor: colors.orange_pantone[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.charcoal[500],
  },
  addItemButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.orange_pantone[500],
    alignItems: 'center',
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Container for the first input + dropdown; ensures dropdown stacks above others
  acContainer: {
    position: 'relative',
    zIndex: 100,
    // Android stacking
    elevation: 100,
  },
  acDropdown: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    maxHeight: 220,
    overflow: 'hidden',
    zIndex: 1000,
    // Android stacking
    elevation: 1000,
  },
  acRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
    backgroundColor: '#fff',
  },
  acRowText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  acAlias: {
    fontSize: 12,
    color: colors.charcoal[400],
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
    gap: 2,
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
});
