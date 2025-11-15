import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal, Image, Animated, Dimensions, SafeAreaView, StatusBar, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import colors from '../theme/colors';
import { AppContext } from '../context/AppContext';
import { isProbablyRecipeUrl } from '../utils/urlHelpers';
import DynamicNavButton from '../components/DynamicNavButton';
import CurvedBottomBar from '../components/CurvedBottomBar';

const { width, height } = Dimensions.get('window');

export default function ParserScreen({ navigation }) {
  const { API_BASE_URL, user, supabaseClient, savedRecipes, importedUrl, setImportedUrl, saveFetchedRecipe, fetchedRecipes, loadFetchedRecipes } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [progressStage, setProgressStage] = useState('');
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [recentlyFetched, setRecentlyFetched] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loadingTopRated, setLoadingTopRated] = useState(false);
  const [clipboardSuggestion, setClipboardSuggestion] = useState(null);
  const [showClipboardSuggestion, setShowClipboardSuggestion] = useState(false);
  const lastDismissedClipboardRef = useRef(null);
  
  const [imageByUrl, setImageByUrl] = useState({});
  const [metaByUrl, setMetaByUrl] = useState({});
  const [difficultyByUrl, setDifficultyByUrl] = useState({});
  
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const titleScaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleFadeAnim = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

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
    
    // Animate title with delay
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

  // Consume deep-linked imported URL from context
  useEffect(() => {
    if (importedUrl && typeof importedUrl === 'string' && importedUrl.startsWith('http')) {
      setUrl(importedUrl);
      // Best UX: show preview so user can confirm, not auto-parse
      onPreview(importedUrl);
      try { setImportedUrl && setImportedUrl(null); } catch {}
    }
  }, [importedUrl]);

  const checkClipboardForRecipe = useCallback(async () => {
    try {
      if (Clipboard.hasStringAsync) {
        const hasContent = await Clipboard.hasStringAsync();
        if (!hasContent) {
          setShowClipboardSuggestion(false);
          setClipboardSuggestion(null);
          return;
        }
      }

      const text = await Clipboard.getStringAsync();
      const trimmed = (text || '').trim();
      if (!trimmed) {
        setShowClipboardSuggestion(false);
        setClipboardSuggestion(null);
        return;
      }

      if (lastDismissedClipboardRef.current && trimmed === lastDismissedClipboardRef.current) {
        return;
      }

      if (!isProbablyRecipeUrl(trimmed) || trimmed === url.trim() || trimmed === previewData?.url) {
        setShowClipboardSuggestion(false);
        setClipboardSuggestion(null);
        return;
      }

      setClipboardSuggestion(trimmed);
      setShowClipboardSuggestion(true);
    } catch (error) {
      console.warn('Clipboard check failed', error);
    }
  }, [previewData?.url, url]);

  useEffect(() => {
    checkClipboardForRecipe();
  }, [checkClipboardForRecipe]);

  useEffect(() => {
    const handleAppStateChange = (nextState) => {
      if (appState.current === nextState) return;
      appState.current = nextState;
      if (nextState === 'active') {
        checkClipboardForRecipe();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkClipboardForRecipe]);

  useEffect(() => {
    if (!clipboardSuggestion) return;
    if (url.trim() === clipboardSuggestion) {
      setShowClipboardSuggestion(false);
    }
  }, [clipboardSuggestion, url]);

  const handleUseClipboardSuggestion = () => {
    if (!clipboardSuggestion) return;
    lastDismissedClipboardRef.current = null;
    setUrl(clipboardSuggestion);
    setError('');
    setShowClipboardSuggestion(false);
    onPreview(clipboardSuggestion);
    setClipboardSuggestion(null);
  };

  const handleDismissClipboardSuggestion = () => {
    if (clipboardSuggestion) {
      lastDismissedClipboardRef.current = clipboardSuggestion;
    }
    setShowClipboardSuggestion(false);
    setClipboardSuggestion(null);
  };

  // Load top-rated recipes (from SQL view)
  useEffect(() => {
    const loadTopRated = async () => {
      if (!supabaseClient) return;
      setLoadingTopRated(true);
      try {
        const { data, error } = await supabaseClient
          .from('top_rated_recipes')
          .select('*')
          .order('average_rating', { ascending: false })
          .order('total_ratings', { ascending: false })
          .limit(10);
        if (error) throw error;
        setTopRated(data || []);
      } catch (e) {
        console.warn('Failed to load top rated recipes:', e.message);
      } finally {
        setLoadingTopRated(false);
      }
    };
    loadTopRated();
  }, [supabaseClient]);

  const starIconFor = (starIndex, average) => {
    const diff = average - (starIndex - 1);
    if (diff >= 1) return 'star';
    if (diff >= 0.5) return 'star-half';
    return 'star-outline';
  };

  // Helper function to calculate time ago
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const fetchedAt = new Date(timestamp);
    const diffMs = now - fetchedAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Book-style card helpers
  const CARD_COLORS = ['#5f99c3', '#96ceb4', '#ceaf96', '#ce96bd'];
  const getCardColor = (index) => CARD_COLORS[Math.abs(index) % CARD_COLORS.length];
  const faviconFromUrl = (u) => { try { const x = new URL(u); return `${x.protocol}//${x.host}/favicon.ico`; } catch { return null; } };

  

  // Calculate difficulty (same logic as BookScreen)
  const calculateDifficulty = (recipe) => {
    if (!recipe) return { level: 'Moderate', color: '#feca57' };
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
    const instructions = Array.isArray(recipe.instructions) ? recipe.instructions.join(' ').toLowerCase() : '';
    const complexTechniques = ['whisk', 'fold', 'caramelize', 'braise', 'sauté', 'flambé', 'tempering', 'proof', 'knead'];
    const foundTechniques = complexTechniques.filter((t) => instructions.includes(t));
    difficultyScore += foundTechniques.length;
    if (difficultyScore >= 6) return { level: 'Difficult', color: '#ff8243' };
    if (difficultyScore >= 3) return { level: 'Moderate', color: '#feca57' };
    return { level: 'Easy', color: '#f9e79f' };
  };

  // Fetch image_url and meta for top-rated URLs from shared assets table (best-effort)
  useEffect(() => {
    const fetchImagesAndMeta = async () => {
      try {
        if (!supabaseClient || !(topRated?.length)) return;
        const urls = Array.from(new Set(topRated.map((r) => r.recipe_url))).filter(Boolean);
        if (!urls.length) return;
        const { data, error } = await supabaseClient
          .from('recipe_assets')
          .select('recipe_url, image_url, prep_time, cook_time, ingredients, instructions, recipe_title')
          .in('recipe_url', urls);
        if (error) {
          console.warn('Top-rated image/meta fetch failed:', error.message);
          return;
        }
        const imgMap = {};
        const metaMap = {};
        const diffMap = {};
        (data || []).forEach((row) => {
          if (!row?.recipe_url) return;
          if (row.image_url) imgMap[row.recipe_url] = row.image_url;
          metaMap[row.recipe_url] = row;
          diffMap[row.recipe_url] = calculateDifficulty(row);
        });
        setImageByUrl((prev) => ({ ...prev, ...imgMap }));
        setMetaByUrl((prev) => ({ ...prev, ...metaMap }));
        setDifficultyByUrl((prev) => ({ ...prev, ...diffMap }));
      } catch (e) {
        console.warn('Top-rated image/meta fetch errored', e);
      }
    };
    fetchImagesAndMeta();
  }, [supabaseClient, topRated]);
  

  const onPaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setUrl(clipboardContent);
        setError('');
        // Auto-preview if it looks like a URL
        if (clipboardContent.match(/^https?:\/\//)) {
          onPreview(clipboardContent);
        }
      }
    } catch (e) {
      setError('Failed to paste from clipboard');
    }
  };

  const onPasteAndFetch = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setUrl(clipboardContent);
        setError('');
        // Auto-preview if it looks like a URL (do not auto-fetch)
        if (clipboardContent.match(/^https?:\/\//)) {
          await onPreview(clipboardContent);
        } else {
          setError('Clipboard content is not a valid URL');
        }
      } else {
        setError('No URL found in clipboard');
      }
    } catch (e) {
      setError('Failed to paste from clipboard');
    }
  };

  const onClearInput = () => {
    setUrl('');
    setPreviewData(null);
    setError('');
    setProgress(0);
    setProgressStage('');
  };

  const onPreview = async (urlToPreview = url) => {
    if (!urlToPreview.trim()) {
      setError('Please enter a recipe URL');
      return;
    }
    
    setLoadingPreview(true);
    setError('');
    setPreviewData(null);
    
    try {
      // First try to fetch page metadata
      const response = await fetch(urlToPreview.trim());
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name=['"](description|og:description)['"][^>]*content=['"]([^'"]+)['"]/i);
      const description = descMatch ? descMatch[2] : '';
      
      // Extract favicon/logo - try multiple sources
      let logo = null;
      
      // Try og:image first
      const ogImageMatch = html.match(/<meta[^>]*property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/i);
      if (ogImageMatch) {
        logo = ogImageMatch[1];
      } else {
        // Try favicon
        const faviconMatch = html.match(/<link[^>]*rel=['"](?:icon|shortcut icon|apple-touch-icon)['"][^>]*href=['"]([^'"]+)['"]/i);
        if (faviconMatch) {
          const faviconUrl = faviconMatch[1];
          // Make absolute URL if relative
          logo = faviconUrl.startsWith('http') ? faviconUrl : new URL(faviconUrl, urlToPreview.trim()).href;
        } else {
          // Fallback to default favicon
          const urlObj = new URL(urlToPreview.trim());
          logo = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        }
      }
      
      // Extract site name
      const urlObj = new URL(urlToPreview.trim());
      const siteName = urlObj.hostname.replace('www.', '');
      
      setPreviewData({
        title: title || 'Recipe Page',
        description: description || `Recipe from ${siteName}`,
        image: logo,
        siteName: siteName,
        url: urlToPreview.trim()
      });
      
    } catch (e) {
      // Fallback to basic preview if fetching fails
      try {
        const urlObj = new URL(urlToPreview.trim());
        const siteName = urlObj.hostname.replace('www.', '');
        
        setPreviewData({
          title: 'Recipe Page',
          description: `Recipe from ${siteName}`,
          image: `${urlObj.protocol}//${urlObj.host}/favicon.ico`,
          siteName: siteName,
          url: urlToPreview.trim()
        });
      } catch (urlError) {
        setError('Please enter a valid URL');
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const clearPreview = () => {
    setPreviewData(null);
    setUrl('');
    setError('');
  };

  const extractCommentsFromPage = async (pageUrl) => {
    try {
      const response = await fetch(pageUrl);
      const html = await response.text();
      
      // Extract comments using common patterns
      const comments = [];
      
      // Look for common comment patterns
      const commentPatterns = [
        // WordPress style comments
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        // Disqus comments
        /<div[^>]*id="disqus_thread"[^>]*>[\s\S]*?<\/div>/gi,
        // Generic comment sections
        /<section[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
        // Article comments
        /<article[^>]*class="[^"]*comment[^"]*"[^>]*>[\s\S]*?<\/article>/gi,
      ];
      
      // Search for review/rating text patterns
      const reviewPatterns = [
        /(\d+(?:\.\d+)?\s*stars?|\d+\/5|\d+\s*out\s*of\s*5)[^.!?]*[.!?]/gi,
        /(amazing|incredible|delicious|perfect|best|worst|terrible|awful|love|loved|hate|hated)[^.!?]*[.!?]/gi,
        /(made\s+this|tried\s+this|recipe\s+is|turned\s+out)[^.!?]*[.!?]/gi,
      ];
      
      // Extract text content and look for review-like sentences
      const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                             .replace(/<style[\s\S]*?<\/style>/gi, '')
                             .replace(/<[^>]*>/g, ' ')
                             .replace(/\s+/g, ' ');
      
      const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const reviewSentences = [];
      
      reviewPatterns.forEach(pattern => {
        sentences.forEach(sentence => {
          if (pattern.test(sentence) && !reviewSentences.includes(sentence.trim())) {
            reviewSentences.push(sentence.trim());
          }
        });
      });
      
      // Look for specific comment indicators
      const commentIndicators = [
        'this recipe', 'these brownies', 'so good', 'turned out', 'made this',
        'delicious', 'perfect', 'amazing', 'love this', 'best ever', 'so easy'
      ];
      
      const relevantComments = reviewSentences.filter(sentence => 
        commentIndicators.some(indicator => 
          sentence.toLowerCase().includes(indicator)
        )
      ).slice(0, 5); // Limit to 5 most relevant comments
      
      if (relevantComments.length > 0) {
        return `Reader reviews: ${relevantComments.join(' • ')}`;
      }
      
      return '';
    } catch (error) {
      console.error('Error extracting comments:', error);
      return '';
    }
  };

  const onParse = async (inputUrl = url) => {
    setError('');
    const safeUrl = typeof inputUrl === 'string' ? inputUrl : String(inputUrl || '');
    if (!safeUrl.trim()) { setError('Please enter a recipe URL'); return; }
    try {
      setLoading(true);
      
      // Smooth progress animation
      const stages = [
        { label: 'Starting...', value: 10 },
        { label: 'Analyzing page...', value: 25 },
        { label: 'Extracting ingredients...', value: 50 },
        { label: 'Finding instructions...', value: 75 },
        { label: 'Finalizing recipe...', value: 95 },
      ];
      
      let currentStage = 0;
      let currentProgress = 0;
      setProgress(0);
      setProgressStage(stages[0].label);
      progressAnim.setValue(0); // Reset animated value
      
      // Smooth progress animation function
      const animateProgress = () => {
        const targetProgress = stages[currentStage]?.value || 95;
        const progressStep = (targetProgress - currentProgress) / 20; // Smooth increment
        
        // Use Animated.timing for smooth progress
        Animated.timing(progressAnim, {
          toValue: targetProgress,
          duration: 800, // 800ms smooth animation to target
          useNativeDriver: false, // width changes require layout animation
        }).start(() => {
          setProgress(targetProgress);
          currentProgress = targetProgress;
          currentStage++;
          if (currentStage < stages.length) {
            setProgressStage(stages[currentStage].label);
            setTimeout(animateProgress, 150); // Pause between stages
          }
        });
      };
      
      animateProgress();
      
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/parse-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: safeUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      // If no comments summary from backend, try to extract client-side
      let commentsSummary = data.commentsSummary || '';
      if (!commentsSummary) {
        try {
          commentsSummary = await extractCommentsFromPage(safeUrl.trim());
        } catch (e) {
          console.warn('Failed to extract comments:', e);
        }
      }
      
      const recipe = {
        title: data.title || 'Untitled Recipe',
        servings: data.servings || '',
        prepTime: data.prepTime || '',
        cookTime: data.cookTime || '',
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        instructions: Array.isArray(data.instructions) ? data.instructions : [],
        sourceUrl: data.sourceUrl || safeUrl.trim(),
        commentsSummary: commentsSummary
      };

      // Save to fetched_recipes
      try {
        await saveFetchedRecipe(
          {
            title: recipe.title,
            servings: recipe.servings,
            prep_time: recipe.prepTime,
            cook_time: recipe.cookTime,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            commentsSummary: recipe.commentsSummary
          },
          recipe.sourceUrl, // source_url
          data.image || previewData?.image // image_url
        );
      } catch (error) {
        console.error('Failed to save to fetched_recipes:', error);
        // Don't block user flow - they can still view the recipe
      }

      setProgress(100); setProgressStage('Complete!');
      setTimeout(() => {
        navigation.navigate('Recipe', { recipe });
        // Clear preview card and URL after successful fetch
        setTimeout(() => {
          setPreviewData(null);
          setUrl('');
          setProgress(0);
          setProgressStage('');
        }, 500);
      }, 250);
    } catch (e) {
      setError(e.message || 'Failed to parse recipe');
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  // Simple alias used by preview and clipboard flows
  const onFetch = async (inputUrl) => {
    try {
      await onParse(inputUrl || url);
    } catch (e) {
      // Error is already handled inside onParse
    }
  };

  // Removed logout handler — no longer used

  

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ffa404" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        {/* Logo positioned on right edge, rotated */}
        <View style={styles.logoPosition}>
          <Image source={require('../../assets/images/Logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        
        <View style={styles.headerContent}>
          <Animated.Text 
            style={[
              styles.greeting,
              {
                opacity: titleFadeAnim,
                transform: [{ scale: titleScaleAnim }]
              }
            ]}
          >
            Get The Recipe!
          </Animated.Text>
          <Text style={styles.subGreeting}>
            {((savedRecipes?.length || 0) === 0)
              ? 'Enter the recipe link below to extract the Ingredients and Instructions'
              : `You have fetched ${savedRecipes?.length || 0} recipes and saved hours reading boring stories`
            }
          </Text>
        </View>
      </View>
      
      <SafeAreaView style={styles.safeContent}>
        {/* Overlapping URL Input Box / Preview Card */}
        <View style={styles.overlappingInputContainer}>
          {!previewData ? (
            // URL Input Box
            <View style={styles.overlappingInputWrapper}>
              <TextInput
                style={styles.overlappingInput}
                value={url}
                onChangeText={(text) => {
                  setUrl(text);
                  setPreviewData(null);
                  setError('');
                  if (text.trim() && text.match(/^https?:\/\//)) {
                    onPreview(text.trim());
                  }
                }}
                placeholder="Enter Recipe Link.."
                placeholderTextColor="#fff"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={styles.pasteAndFetchButton}
                onPress={url.trim() ? onClearInput : onPasteAndFetch}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={url.trim() ? "close-circle" : "clipboard"} 
                  size={16} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
          ) : (
            // Preview Card
            <View style={styles.previewCard}>
              <TouchableOpacity
                onPress={() => setPreviewData(null)}
                style={styles.previewCardClose}
                accessibilityLabel="Dismiss preview"
              >
                <Ionicons name="close" size={16} color={colors.charcoal[500]} />
              </TouchableOpacity>
              <View style={styles.previewCardContent}>
                {/* Website Logo/Favicon */}
                <View style={styles.logoContainer}>
                  {previewData.image ? (
                    <Image 
                      source={{ uri: previewData.image }} 
                      style={styles.websiteLogo}
                      onError={() => {
                        // Fallback to default if image fails
                        const urlObj = new URL(previewData.url);
                        setPreviewData(prev => ({
                          ...prev,
                          image: `${urlObj.protocol}//${urlObj.host}/favicon.ico`
                        }));
                      }}
                    />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Text style={styles.logoPlaceholderText}>
                        {previewData.siteName ? previewData.siteName.charAt(0).toUpperCase() : 'R'}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Recipe Info */}
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {previewData.title}
                  </Text>
                  <Text style={styles.recipeUrl} numberOfLines={1}>
                    {previewData.siteName || previewData.url}
                  </Text>
                </View>
                
                {/* Get Recipe Button */}
                <TouchableOpacity 
                  style={styles.getRecipeButton}
                  onPress={() => onParse(previewData?.url || url)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.getRecipeButtonText}>Get this Recipe!</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showClipboardSuggestion && clipboardSuggestion && !previewData && (
            <View style={styles.clipboardBanner}>
              <TouchableOpacity style={styles.clipboardBannerContent} activeOpacity={0.85} onPress={handleUseClipboardSuggestion}>
                <View style={styles.clipboardBannerTextWrap}>
                  <Ionicons name="sparkles" size={16} color="#fff" style={styles.clipboardBannerIcon} />
                  <View style={styles.clipboardBannerTextBlock}>
                    <Text style={styles.clipboardBannerTitle}>Recipe link ready to paste</Text>
                    <Text style={styles.clipboardBannerUrl} numberOfLines={1}>{clipboardSuggestion}</Text>
                  </View>
                </View>
                <View style={styles.clipboardBannerActions}>
                  <Text style={styles.clipboardBannerPaste}>Paste</Text>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clipboardBannerDismiss} onPress={handleDismissClipboardSuggestion} accessibilityLabel="Dismiss clipboard suggestion">
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {loadingPreview && !previewData && (
            <View style={styles.overlappingLoadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.overlappingLoadingText}>Loading Preview...</Text>
            </View>
          )}
        </View>
        
        <ScrollView contentContainerStyle={[styles.container, previewData && styles.containerWithPreview]} showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          
          {/* Recently Fetched Section with Title */}
          <View style={styles.recentlyFetchedSection}>
            <Text style={styles.sectionTitle}>Recently Fetched</Text>
            
            {!!error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.orange_pantone[600]} />
                <Text style={styles.error}>{error}</Text>
              </View>
            )}
            
            {fetchedRecipes && fetchedRecipes.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScrollContent}
                style={styles.recentScroll}
                snapToInterval={width * 0.9 + 16} // Card width + margin
                decelerationRate="fast"
                snapToAlignment="start"
              >
                {fetchedRecipes.slice(0, 10).map((fetchedRecipe, index) => {
                  const recipe = fetchedRecipe.recipe_data;
                  const isSaved = savedRecipes.some(r => r.source_url === fetchedRecipe.source_url);

                  return (
                    <TouchableOpacity
                      key={fetchedRecipe.id || index}
                      style={[styles.recentItem, styles.recentItemScrollable]}
                      onPress={() => navigation.navigate('Recipe', {
                        recipe: {
                          ...recipe,
                          sourceUrl: fetchedRecipe.source_url,
                          image_url: fetchedRecipe.image_url
                        }
                      })}
                    >
                      <View style={styles.recentItemContent}>
                        <Text style={styles.recentItemTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                        {fetchedRecipe.source_url && (
                          <Text style={styles.recentItemUrl} numberOfLines={1}>
                            from {(() => {
                              try {
                                return new URL(fetchedRecipe.source_url).hostname.replace(/^www\./, '');
                              } catch {
                                return fetchedRecipe.source_url;
                              }
                            })()}
                          </Text>
                        )}
                        <Text style={styles.recentItemTime}>
                          {getTimeAgo(fetchedRecipe.fetched_at)}
                        </Text>
                      </View>

                      <View style={styles.recentItemRight}>
                        {fetchedRecipe.image_url && (
                          <Image
                            source={{ uri: fetchedRecipe.image_url }}
                            style={styles.recentItemImage}
                            resizeMode="cover"
                          />
                        )}
                        <Ionicons name="chevron-forward" size={16} color="#fff" />
                      </View>

                      {isSaved && (
                        <View style={styles.savedBadge}>
                          <Text style={styles.savedBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyRecent}>
                <Text style={styles.emptyRecentText}>No recent recipes yet</Text>
                <Text style={styles.emptyRecentSubtext}>Start by fetching your first recipe above!</Text>
              </View>
            )}
          </View>
          
          {/* Today's Hottest Recipes (Book-style cards with inline Save) */}
          <View style={styles.recentlyFetchedSection}>
            <Text style={styles.sectionTitleSmall}>Today's Hottest Recipes</Text>
            {loadingTopRated ? (
              <View style={styles.topRatedLoading}> 
                <ActivityIndicator color={colors.charcoal[400]} />
                <Text style={styles.topRatedLoadingText}>Loading top recipes…</Text>
              </View>
            ) : (
              (() => {
                const savedUrls = new Set((savedRecipes || []).map(r => r.source_url));
                const items = (topRated || []).filter(r => !savedUrls.has(r.recipe_url));
                if (!items.length) {
                  return (
                    <View style={styles.emptyRecent}>
                      <Text style={styles.emptyRecentText}>No top recipes to show</Text>
                      <Text style={styles.emptyRecentSubtext}>You may already have all the current top recipes</Text>
                    </View>
                  );
                }
                return (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.topRatedScrollContent}
                    style={styles.topRatedScroll}
                    snapToInterval={width * 0.85 + 16} // Card width + margin
                    decelerationRate="fast"
                    snapToAlignment="start"
                  >
                    {items.map((r, idx) => {
                      const img = imageByUrl[r.recipe_url] || faviconFromUrl(r.recipe_url);
                      const diff = difficultyByUrl[r.recipe_url] || { level: 'Moderate', color: '#feca57' };
                      const site = (() => { try { const u = new URL(r.recipe_url); return u.hostname.replace(/^www\./,''); } catch { return ''; } })();
                      return (
                        <View key={r.recipe_url || idx} style={[styles.bookCard, styles.bookCardScrollable, img && styles.bookCardWithLeftImage, { backgroundColor: getCardColor(idx) }]}>
                          {/* Pop-out difficulty badge */}
                          <View style={styles.popBadgesContainer}>
                            <View style={[styles.popBadge, { backgroundColor: diff.color }]}>
                              <Text style={[styles.popBadgeText, diff.level === 'Easy' && styles.popBadgeTextDark]} numberOfLines={1}>{diff.level}</Text>
                            </View>
                          </View>
                          <Text style={styles.bookCardTitle} numberOfLines={2}>{r.recipe_title}</Text>
                          <View style={styles.bookCardRatingRow}>
                            {[1,2,3,4,5].map(star => (
                              <Ionicons key={star} name={starIconFor(star, r.average_rating || 0)} size={16} color={(r.average_rating || 0) >= star - 0.5 ? '#ffd700' : 'rgba(255,255,255,0.4)'} />
                            ))}
                            <Text style={styles.bookCardRatingText}>{(r.average_rating || 0).toFixed(1)} ({r.total_ratings})</Text>
                          </View>
                          {!!site && (
                            <Text style={styles.bookCardSiteText}>{site}</Text>
                          )}
                          <View style={styles.bookCardActions}>
                            <TouchableOpacity onPress={() => onParse(r.recipe_url)}>
                              <Text style={styles.actionTextButton}>View Recipe</Text>
                            </TouchableOpacity>
                          </View>
                          {img && (
                            <Image source={{ uri: img }} resizeMode="cover" style={styles.bookCardImageLeft} />
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                );
              })()
            )}
          </View>

          {/* Safari Extension CTA removed */}

        </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="restaurant" color="#f7ae2d" size={32} />
            </View>
            <Text style={styles.modalTitle}>Getting Recipe</Text>
            <Text style={styles.modalStage}>{progressStage}</Text>
            <View style={styles.progressBarWrap}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp'
                    })
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{Math.min(100, Math.max(0, Math.round(progress)))}%</Text>
          </View>
        </View>
      </Modal>

      {/* Safari Extension modal removed */}

      {/* (Removed) Inline Save modals to keep Top Rated lean */}

      {/* Curved Bottom Navigation Bar */}
      <CurvedBottomBar
        navigation={navigation}
        activeRoute="Parser"
        dynamicButtonMode={clipboardSuggestion && isProbablyRecipeUrl(clipboardSuggestion) ? 'get-recipe' : 'default'}
        dynamicButtonShowGlow={!!(clipboardSuggestion && isProbablyRecipeUrl(clipboardSuggestion))}
        dynamicButtonOnPress={clipboardSuggestion && isProbablyRecipeUrl(clipboardSuggestion) ? handleUseClipboardSuggestion : null}
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
    paddingBottom: 32, // tighter spacing above URL box
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
    height: 200, // compact header height
  },
  safeContent: {
    flex: 1,
    backgroundColor: '#fff9e6',
  },
  logoPosition: {
    position: 'absolute',
    bottom: -32, // Pop out of bottom corner
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
    maxWidth: '70%', // Leave space for logo and keep nice line length
    paddingRight: 12,
  },
  headerLogoCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
    zIndex: 3,
  },
  centeredLogo: {
    width: 80,
    height: 80,
  },
  greeting: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  subGreeting: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.95,
    fontWeight: '400',
    lineHeight: 20,
    maxWidth: 320,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e07a5f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerInputContainer: {
    marginTop: 10,
    zIndex: 3,
  },
  headerInputWrapper: {
    backgroundColor: '#ff9b6b',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'center',
  },
  headerInput: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    backgroundColor: 'transparent',
  },
  headerLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  headerLoadingText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    zIndex: 3,
  },
  navButton: {
    backgroundColor: '#e07a5f',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  overlappingInputContainer: {
    position: 'absolute',
    top: -14,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  overlappingInputWrapper: {
    backgroundColor: '#ff9b6b',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlappingInput: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    backgroundColor: 'transparent',
  },
  pasteAndFetchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewButton: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  previewButtonDisabled: {
    opacity: 0.5,
  },
  previewButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  topRatedLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  topRatedLoadingText: {
    color: colors.charcoal[400],
    fontSize: 12,
    fontWeight: '600',
  },
  topRatedList: {
    gap: 12,
    marginTop: 8,
  },
  topRatedScroll: {
    marginTop: 8,
  },
  topRatedScrollContent: {
    paddingLeft: 0,
    paddingRight: 60, // Extra padding to show peek of next card
  },
  // Book-style card styles for Top Rated
  bookCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'visible',
    position: 'relative',
  },
  bookCardWithLeftImage: {
    paddingLeft: 112,
  },
  bookCardScrollable: {
    width: width * 0.85, // 85% of screen width
    marginRight: 16, // Space between cards
    marginTop: 20, // Space for pop-out badges at top
  },
  bookCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  bookCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  bookCardRatingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  bookCardActions: {
    position: 'absolute',
    right: 16,
    bottom: 10,
    flexDirection: 'row',
    gap: 16,
    zIndex: 2,
  },
  bookCardImage: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 90,
    height: 90,
    borderRadius: 12,
    opacity: 0.95,
  },
  bookCardImageLeft: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 90,
    height: 90,
    borderRadius: 12,
    opacity: 0.95,
    zIndex: 1,
  },
  bookCardSiteText: {
    color: '#fff',
    opacity: 0.9,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  // Pop badges (difficulty) similar to BookScreen
  popBadgesContainer: {
    position: 'absolute',
    top: -14,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
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
  popBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  popBadgeTextDark: {
    color: '#333',
  },
  sectionTitleSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 12,
  },
  actionTextButton: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  overlappingLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  overlappingLoadingText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  container: { 
    flexGrow: 1,
    padding: 20, 
    paddingTop: 50,
  },
  content: {
    flex: 1,
  },
  logoWrap: { 
    alignItems: 'center', 
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: { 
    width: 80, 
    height: 80,
  },
  title: { 
    fontSize: 36, 
    fontWeight: '800', 
    color: colors.charcoal[500], 
    marginBottom: 40,
    textAlign: 'center',
  },
  inputCard: { 
    padding: 20,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffde59',
    borderRadius: 18,
    paddingLeft: 18,
    paddingRight: 10,
    marginBottom: 16,
    // Neumorphic raised effect - multiple shadows for depth
    shadowColor: '#ffde59',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
    // Add subtle borders for definition
    borderWidth: 1,
    borderColor: '#fff3b3',
    borderTopWidth: 1.5,
    borderTopColor: '#fffadb',
    borderLeftWidth: 1.5,
    borderLeftColor: '#fffadb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: { 
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.charcoal[500],
    backgroundColor: 'transparent',
    fontWeight: '500',
  },
  pasteBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f7ae2d',
    marginLeft: 8,
    // Add shadow to button
    shadowColor: '#c98d1f',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f7ae2d',
    gap: 6,
  },
  previewBtnDisabled: {
    opacity: 0.5,
  },
  previewBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  parseBtn: { 
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#f7ae2d',
  },
  parseBtnDisabled: {
    opacity: 0.5,
  },
  btnGradient: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#f7ae2d',
  },
  parseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orange_pantone[50] || '#fef2f2',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange_pantone[500],
    marginTop: 8,
  },
  error: { 
    color: colors.orange_pantone[600], 
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: -4,
    backgroundColor: '#ffa07a',
    borderRadius: 18,
    overflow: 'hidden',
    // Enhanced neumorphic shadow for preview
    shadowColor: '#ffffff',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ffa07a',
    borderTopWidth: 1.5,
    borderTopColor: '#ffa07a',
    borderLeftWidth: 1.5,
    borderLeftColor: '#ffa07a',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#ffa07a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(230, 199, 58, 0.3)',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal[500],
  },
  clearBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewContent: {
    flexDirection: 'row',
    padding: 18,
    gap: 14,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.charcoal[100],
    // Add subtle shadow to image
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewRecipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 4,
    lineHeight: 20,
  },
  previewSiteName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lapis_lazuli[500],
    marginBottom: 4,
  },
  previewUrl: {
    fontSize: 11,
    color: colors.charcoal[300],
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  previewDescription: {
    fontSize: 14,
    color: colors.charcoal[400],
    lineHeight: 18,
  },

  // Progress modal
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20,
  },
  modalCard: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 32, 
    width: '90%', 
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
  },
  modalIconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#fff2ea',
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 16,
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
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
  modalStage: { 
    color: colors.charcoal[400], 
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
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
  
  progressBarWrap: { 
    width: '100%', 
    height: 8, 
    backgroundColor: colors.charcoal[100], 
    borderRadius: 4, 
    overflow: 'hidden', 
    marginBottom: 16,
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#f7ae2d',
    borderRadius: 4,
  },
  progressText: { 
    color: colors.charcoal[500], 
    fontWeight: '700',
    fontSize: 18,
  },
  
  // Recently Fetched Section
  recentlyFetchedSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 16,
  },
  recentList: {
    gap: 14,
  },
  recentScroll: {
    marginTop: 8,
  },
  recentScrollContent: {
    paddingLeft: 0,
    paddingRight: 60, // Extra padding to show peek of next card
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#50b4b4',
    borderRadius: 16,
    padding: 0,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  recentItemScrollable: {
    width: width * 0.9, // 90% of screen width for more space
    marginRight: 16, // Space between cards
  },
  recentItemContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  recentItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
  },
  recentItemUrl: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.85,
    fontWeight: '600',
    marginBottom: 4,
  },
  recentItemTime: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
    fontWeight: '500',
  },
  recentItemRight: {
    width: 100,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentItemImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  savedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  savedBadgeText: {
    color: colors.orange_pantone[500],
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyRecent: {
    backgroundColor: '#ffde59',
    borderRadius: 18,
    padding: 40,
    alignItems: 'center',
    // Neumorphic effect
    shadowColor: '#d4b83e',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#fff3b3',
    borderTopWidth: 1.5,
    borderTopColor: '#fffadb',
    borderLeftWidth: 1.5,
    borderLeftColor: '#fffadb',
  },
  emptyRecentText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.charcoal[500],
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyRecentSubtext: {
    fontSize: 14,
    color: colors.charcoal[400],
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.charcoal[400],
    fontWeight: '500',
  },
  previewActions: {
    padding: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230, 199, 58, 0.3)',
    backgroundColor: 'rgba(245, 216, 66, 0.15)',
  },
  previewGetBtn: {
    borderRadius: 14,
    backgroundColor: '#f7ae2d',
    overflow: 'hidden',
    // Enhanced shadow for button
    shadowColor: '#c98d1f',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  
  // New preview card styles to match Figma
  previewCard: {
    width: 354,
    height: 112,
    backgroundColor: '#E07A5F',
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    position: 'relative',
  },
  previewCardClose: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  previewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  websiteLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  logoPlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  recipeInfo: {
    flex: 1,
    paddingRight: 8,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 20,
    flexShrink: 1,
  },
  recipeUrl: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    fontWeight: '500',
  },
  getRecipeButton: {
    backgroundColor: '#f7ae2d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  getRecipeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Add padding when preview is shown
  containerWithPreview: {
    paddingTop: 100, // Extra space for preview card
  },
  
  // Bottom Navigation Bar
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#ff8243',
    paddingTop: 12,
    paddingBottom: 20, // Added bottom padding
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
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  clipboardPrompt: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clipboardDismissBtnText: {
    color: colors.charcoal[500],
    fontWeight: '600',
    fontSize: 14,
  },
  clipboardBanner: {
    marginTop: 12,
    backgroundColor: colors.orange_pantone[500],
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  clipboardBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clipboardBannerTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  clipboardBannerIcon: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
  },
  clipboardBannerTextBlock: {
    flex: 1,
  },
  clipboardBannerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  clipboardBannerUrl: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  clipboardBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clipboardBannerPaste: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  clipboardBannerDismiss: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
  },
  
});
