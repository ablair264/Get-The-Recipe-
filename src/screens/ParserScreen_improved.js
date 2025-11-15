import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal, Image, Animated, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import colors from '../theme/colors';
import { AppContext } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

export default function ParserScreen({ navigation }) {
  const { API_BASE_URL, user, supabaseClient, savedRecipes } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [progressStage, setProgressStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [recentlyFetched, setRecentlyFetched] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const titleScaleAnim = useRef(new Animated.Value(0.8)).current;
  const titleFadeAnim = useRef(new Animated.Value(0)).current;

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

  const onParse = async () => {
    setError('');
    if (!url.trim()) { setError('Please enter a recipe URL'); return; }
    try {
      setLoading(true);
      // faux stage updates to match prior loader UX
      const stages = [
        { label: 'Analyzing page...', value: 25 },
        { label: 'Extracting ingredients...', value: 50 },
        { label: 'Finding instructions...', value: 75 },
        { label: 'Finalizing recipe...', value: 95 },
      ];
      let i = 0;
      setProgress(10); setProgressStage('Starting...');
      const t = setInterval(() => {
        if (i < stages.length) {
          setProgress(stages[i].value);
          setProgressStage(stages[i].label);
          i += 1;
        }
      }, 400);
      const res = await fetch(`${API_BASE_URL}/.netlify/functions/parse-recipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      const recipe = {
        title: data.title || 'Untitled Recipe',
        servings: data.servings || '',
        prepTime: data.prepTime || '',
        cookTime: data.cookTime || '',
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        instructions: Array.isArray(data.instructions) ? data.instructions : [],
        sourceUrl: data.sourceUrl || url.trim(),
        commentsSummary: data.commentsSummary || ''
      };
      setProgress(100); setProgressStage('Complete!');
      setTimeout(() => navigation.navigate('Recipe', { recipe }), 250);
    } catch (e) {
      setError(e.message || 'Failed to parse recipe');
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ffa404" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerLogoContainer}>
              <Image source={require('../../assets/images/Logo.png')} style={styles.headerLogo} resizeMode="contain" />
            </View>
            <View style={styles.headerBrand}>
              <Text style={styles.greeting}>
                {(() => {
                  const name = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').toString().trim();
                  const fallback = user?.email?.split('@')[0] || 'User';
                  return `Hello, ${name || fallback}`;
                })()}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <SafeAreaView style={styles.safeContent}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          
          {/* URL Input at Top */}
          <View style={styles.inputCard}>
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="link" size={20} color={colors.charcoal[400]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={(text) => {
                    setUrl(text);
                    setPreviewData(null);
                    setError('');
                    // Auto-preview if it looks like a URL
                    if (text.trim() && text.match(/^https?:\/\//)) {
                      onPreview(text.trim());
                    }
                  }}
                  placeholder="Paste recipe URL here..."
                  placeholderTextColor={colors.charcoal[300]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity 
                  style={styles.pasteBtn} 
                  onPress={onPaste}
                  activeOpacity={0.7}
                >
                  <Ionicons name="clipboard-outline" color="#fff" size={18} />
                </TouchableOpacity>
              </View>
              
              {loadingPreview && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.charcoal[400]} size="small" />
                  <Text style={styles.loadingText}>Loading Preview...</Text>
                </View>
              )}
            </View>
            
            {!!error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.orange_pantone[600]} />
                <Text style={styles.error}>{error}</Text>
              </View>
            )}
            
          </View>
          
          {/* Preview Box */}
          {previewData && (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Recipe Preview</Text>
                <TouchableOpacity onPress={clearPreview} style={styles.clearBtn}>
                  <Ionicons name="close" size={20} color={colors.charcoal[400]} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.previewContent}>
                {previewData.image && (
                  <Image 
                    source={{ uri: previewData.image }} 
                    style={styles.previewImage}
                    onError={() => {
                      // If image fails to load, try favicon
                      const urlObj = new URL(previewData.url);
                      setPreviewData(prev => ({
                        ...prev,
                        image: `${urlObj.protocol}//${urlObj.host}/favicon.ico`
                      }));
                    }}
                  />
                )}
                <View style={styles.previewTextContainer}>
                  <Text style={styles.previewRecipeTitle} numberOfLines={2}>
                    {previewData.title}
                  </Text>
                  {previewData.siteName && (
                    <Text style={styles.previewSiteName}>{previewData.siteName}</Text>
                  )}
                  <Text style={styles.previewUrl} numberOfLines={1}>
                    {previewData.url}
                  </Text>
                  {previewData.description && (
                    <Text style={styles.previewDescription} numberOfLines={2}>
                      {previewData.description}
                    </Text>
                  )}
                </View>
              </View>
              
              {/* Get Recipe Button in Preview */}
              <View style={styles.previewActions}>
                <TouchableOpacity 
                  style={[styles.previewGetBtn, loading && styles.parseBtnDisabled]} 
                  onPress={onParse} 
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <View style={styles.btnGradient}>
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="arrow-forward" color="#fff" size={18} />
                        <Text style={styles.parseBtnText}>Get Recipe</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Recently Fetched Section */}
          <View style={styles.recentlyFetchedSection}>
            {savedRecipes && savedRecipes.length > 0 ? (
              <View style={styles.recentList}>
                {savedRecipes.slice(0, 5).map((recipe, index) => (
                  <TouchableOpacity 
                    key={recipe.id || index}
                    style={styles.recentItem}
                    onPress={() => navigation.navigate('Recipe', { recipe })}
                  >
                    <View style={styles.recentItemContent}>
                      <Text style={styles.recentItemTitle} numberOfLines={1}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.recentItemMeta}>
                        {recipe.servings ? `${recipe.servings} servings` : 'Recipe'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.charcoal[400]} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRecent}>
                <Text style={styles.emptyRecentText}>No recent recipes yet</Text>
                <Text style={styles.emptyRecentSubtext}>Start by fetching your first recipe above!</Text>
              </View>
            )}
          </View>

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
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.min(100, Math.max(0, Math.round(progress)))}%</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#ffa404',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 60,
    backgroundColor: '#ffa404',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  safeContent: {
    flex: 1,
    backgroundColor: '#ffde59',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '70%',
    paddingRight: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerBrand: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  greeting: {
    fontSize: 14,
    color: '#ffffff80',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  container: { 
    flexGrow: 1,
    padding: 20, 
    paddingTop: 20,
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
    shadowColor: '#d4b83e',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
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
    backgroundColor: '#ffde59',
    borderRadius: 18,
    overflow: 'hidden',
    // Enhanced neumorphic shadow for preview
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
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: 'rgba(245, 216, 66, 0.3)',
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
  modalStage: { 
    color: colors.charcoal[400], 
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
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
    backgroundColor: '#ffde59',
    borderRadius: 18,
    overflow: 'hidden',
    // Neumorphic effect for recent list
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
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 184, 62, 0.15)',
  },
  recentItemContent: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.charcoal[500],
    marginBottom: 4,
  },
  recentItemMeta: {
    fontSize: 14,
    color: colors.charcoal[400],
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
});
