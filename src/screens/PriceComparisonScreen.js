import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, Linking, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function PriceComparisonScreen({ navigation, route }) {
  const { ingredient, priceData } = route.params;

  const getSearchURL = (price, cleanedIngredient) => {
    const searchTerm = encodeURIComponent(cleanedIngredient);
    
    switch (price.shop.toLowerCase()) {
      case 'tesco':
        return `https://www.tesco.com/groceries/en-GB/search?query=${searchTerm}`;
      case 'asda':
        return `https://groceries.asda.com/search/${searchTerm}`;
      case 'sainsburys':
        return `https://www.sainsburys.co.uk/gol-ui/SearchResults/${searchTerm}`;
      case 'waitrose':
        return `https://www.waitrose.com/ecom/shop/search?&searchTerm=${searchTerm}`;
      case 'morrisons':
        return `https://groceries.morrisons.com/search?entry=${searchTerm}`;
      case 'iceland':
        return `https://www.iceland.co.uk/search?q=${searchTerm}`;
      case 'aldi':
        return `https://www.aldi.co.uk/search?text=${searchTerm}`;
      case 'lidl':
        return `https://www.lidl.co.uk/search?q=${searchTerm}`;
      default:
        return `https://${price.url}`;
    }
  };

  const handleOpenStore = async (price) => {
    try {
      const searchURL = getSearchURL(price, priceData.cleanedName);
      const supported = await Linking.canOpenURL(searchURL);
      
      if (supported) {
        await Linking.openURL(searchURL);
      } else {
        Alert.alert(
          'Cannot Open Store',
          `Unable to open ${price.shop} website. You can visit ${price.url} manually.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.warn('Error opening store URL:', error);
      Alert.alert(
        'Error',
        `Failed to open ${price.shop} website.`,
        [{ text: 'OK' }]
      );
    }
  };

  const formatPrice = (priceString) => {
    return priceString.replace('£', '');
  };

  const getPriceColor = (index) => {
    if (index === 0) return '#4CAF50'; // Best price - green
    if (index === 1) return '#FF9800'; // Second best - orange
    return '#666'; // Others - gray
  };

  const getSavingsText = (currentPrice, bestPrice) => {
    const current = parseFloat(currentPrice.replace('£', ''));
    const best = parseFloat(bestPrice.replace('£', ''));
    const savings = current - best;
    
    if (savings > 0) {
      return `+£${savings.toFixed(2)} vs best`;
    }
    return 'Best price';
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="#ff8243" barStyle="light-content" />
      
      {/* Header - matching ParserScreen style */}
      <View style={styles.header}>
        {/* Logo positioned on right edge, rotated */}
        <View style={styles.logoPosition}>
          <Image source={require('../../assets/images/Logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Price Comparison</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Compare prices across different stores
          </Text>
        </View>
      </View>
      
      <SafeAreaView style={styles.safeContent}>
        {/* Ingredient Info */}
        <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{ingredient}</Text>
        <Text style={styles.cleanedName}>Searching for: "{priceData.cleanedName}"</Text>
        {priceData.prices && priceData.prices.length > 0 && (
          <Text style={styles.priceCount}>
            {priceData.prices.length} price{priceData.prices.length > 1 ? 's' : ''} found • Tap to search stores
          </Text>
        )}
      </View>

      {/* Price List */}
      <ScrollView style={styles.priceList} showsVerticalScrollIndicator={false}>
        {priceData.prices && priceData.prices.length > 0 ? (
          priceData.prices.map((price, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.priceCard, index === 0 && styles.bestPriceCard]}
              onPress={() => handleOpenStore(price)}
              activeOpacity={0.7}
            >
              <View style={styles.priceCardContent}>
                <View style={styles.priceHeader}>
                  <Text style={[styles.shopName, { color: getPriceColor(index) }]}>
                    {price.shop}
                  </Text>
                  {index === 0 && (
                    <View style={styles.bestPriceBadge}>
                      <Ionicons name="star" size={12} color="#fff" />
                      <Text style={styles.bestPriceText}>Best Price</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.priceDetails}>
                  <Text style={styles.priceAmount}>{price.price}</Text>
                  <Text style={styles.priceUnit}>per {price.per}</Text>
                </View>
                
                <View style={styles.priceFooter}>
                  <Text style={styles.savingsText}>
                    {getSavingsText(price.price, priceData.prices[0].price)}
                  </Text>
                  <View style={styles.visitStore}>
                    <Text style={styles.visitStoreText}>Search in store</Text>
                    <Ionicons name="search" size={14} color={colors.orange_pantone[500]} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.noResultsTitle}>No Prices Found</Text>
            <Text style={styles.noResultsText}>
              We couldn't find pricing information for "{priceData.cleanedName}".
            </Text>
            <Text style={styles.noResultsHint}>
              But you can still search these stores directly:
            </Text>
            
            {/* Manual search options */}
            <View style={styles.manualSearchContainer}>
              {['Tesco', 'ASDA', 'Sainsburys', 'Waitrose'].map((storeName, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.manualSearchButton}
                  onPress={() => handleOpenStore({ shop: storeName, url: `${storeName.toLowerCase()}.com` })}
                >
                  <Text style={styles.manualSearchText}>Search {storeName}</Text>
                  <Ionicons name="search" size={14} color={colors.orange_pantone[500]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

        {/* Total Savings Footer */}
      {priceData.prices && priceData.prices.length > 1 && (
        <View style={styles.savingsFooter}>
          <Text style={styles.savingsFooterText}>
            Save up to £{(parseFloat(priceData.prices[priceData.prices.length - 1].price.replace('£', '')) - parseFloat(priceData.prices[0].price.replace('£', ''))).toFixed(2)} by shopping at {priceData.prices[0].shop}
          </Text>
        </View>
      )}
      </SafeAreaView>

      {/* Bottom Navigation Bar (match other screens) */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Parser')}>
          <Ionicons name="home" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Book')}>
          <Ionicons name="book" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Recipes</Text>
        </TouchableOpacity>
        {/* Logo in center circle */}
        <View style={styles.bottomNavLogoContainer}>
          <View style={styles.bottomNavLogoCircle}>
            <View style={styles.bottomNavLogoInner}>
              {/* Teal Heart with Grid Pattern */}
              <View style={styles.bottomNavLogoHeart}>
                <View style={styles.bottomNavLogoGrid}>
                  {/* Grid lines */}
                  <View style={styles.bottomNavLogoGridLine} />
                  <View style={[styles.bottomNavLogoGridLine, styles.bottomNavLogoGridLineVertical]} />
                </View>
                {/* GET THE RECIPE Button */}
                <View style={styles.bottomNavLogoButton}>
                  <Text style={styles.bottomNavLogoButtonText}>GET THE</Text>
                  <Text style={[styles.bottomNavLogoButtonText, styles.bottomNavLogoButtonTextSmall]}>RECIPE</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Pantry')}>
          <Ionicons name="basket" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Pantry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings" size={24} color="#fff" />
          <Text style={styles.bottomNavText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#fff9e6',
  },
  safeContent: {
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    fontWeight: '400',
    lineHeight: 18,
    maxWidth: 220,
  },
  ingredientInfo: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  cleanedName: {
    fontSize: 14,
    color: colors.charcoal[400],
    fontStyle: 'italic',
    marginBottom: 8,
  },
  priceCount: {
    fontSize: 12,
    color: colors.orange_pantone[500],
    fontWeight: '600',
  },
  priceList: {
    flex: 1,
    padding: 20,
  },
  priceCard: {
    backgroundColor: '#fff',
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
  bestPriceCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  priceCardContent: {
    padding: 16,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
  },
  bestPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  bestPriceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  priceDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    gap: 8,
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
  },
  priceUnit: {
    fontSize: 14,
    color: colors.charcoal[400],
  },
  priceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsText: {
    fontSize: 12,
    color: colors.charcoal[400],
    fontWeight: '600',
  },
  visitStore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visitStoreText: {
    color: colors.orange_pantone[500],
    fontSize: 14,
    fontWeight: '600',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  noResultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 16,
    color: colors.charcoal[400],
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsHint: {
    fontSize: 14,
    color: colors.charcoal[300],
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  manualSearchContainer: {
    width: '100%',
    gap: 12,
  },
  manualSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  manualSearchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  savingsFooter: {
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },
  savingsFooterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomNavBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#ff8243',
    paddingTop: 12,
    paddingBottom: 20,
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
  bottomNavLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#87CEEB', // Light blue outline
    backgroundColor: '#FFE5B4', // Light yellow background
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    padding: 8,
  },
  bottomNavLogoInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavLogoHeart: {
    width: 40,
    height: 36,
    backgroundColor: '#42A5A5', // Teal color
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bottomNavLogoGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  bottomNavLogoGridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    width: '100%',
    height: 1,
    top: '33%',
  },
  bottomNavLogoGridLineVertical: {
    width: 1,
    height: '100%',
    left: '50%',
    top: 0,
  },
  bottomNavLogoButton: {
    backgroundColor: '#F07840', // Orange button
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bottomNavLogoButtonText: {
    color: '#fff',
    fontSize: 6,
    fontWeight: '700',
    lineHeight: 7,
    textAlign: 'center',
  },
  bottomNavLogoButtonTextSmall: {
    fontSize: 5,
    lineHeight: 6,
  },
});
