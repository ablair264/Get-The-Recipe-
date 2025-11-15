import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// Card background color palette (same as iPhone)
const CARD_COLORS = ['#5f99c3', '#96ceb4', '#ceaf96', '#ce96bd'];
const getRandomCardColor = (index = 0) => CARD_COLORS[Math.abs(index || 0) % CARD_COLORS.length];

const getCategoryColor = (categoryName, storedColor = null) => {
  if (storedColor) return storedColor;
  const palette = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'];
  if (!categoryName || categoryName === 'All') return palette[0];
  const key = String(categoryName).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

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
  if (difficultyScore >= 6) return { level: 'Difficult', color: '#ff8243' };
  if (difficultyScore >= 3) return { level: 'Moderate', color: '#feca57' };
  return { level: 'Easy', color: '#f9e79f' };
};

const IPadRecipeCard = ({
  recipe,
  index = 0,
  variant = 'portrait', // 'portrait' | 'landscape'
  selected = false,
  onPress,
  navigation,
  deleteRecipe,
  loadRecipeFromSaved,
  submitCardRating,
  ratingsByUrl = {},
  userRatingsByUrl = {},
  categoryColorMap = {},
}) => {
  const difficulty = useMemo(() => calculateDifficulty(recipe), [recipe]);
  const prepMinutes = parseTimeToMinutes(recipe.prep_time);
  const cookMinutes = parseTimeToMinutes(recipe.cook_time);
  const totalMinutes = prepMinutes + cookMinutes;
  const recipeUrl = recipe?.source_url || recipe?.sourceUrl;
  const ratingInfo = ratingsByUrl[recipeUrl] || {};
  const avgRating = ratingInfo.average || 0;
  const ratingsCount = ratingInfo.count || 0;
  const imageUrl = getRecipeImageUrl(recipe);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        variant === 'portrait' ? styles.sizePortrait : styles.sizeLandscape,
        { backgroundColor: getRandomCardColor(index) },
        selected && styles.selectedCard,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Pop-out badges */}
      <View style={styles.popBadgesContainer}>
        <View style={[styles.popBadge, { backgroundColor: getCategoryColor(recipe?.categories?.name, recipe?.categories?.color ?? categoryColorMap[recipe?.categories?.name]) }]}>
          <Text style={styles.popBadgeText} numberOfLines={1}>
            {recipe?.categories?.name || 'Recipe'}
          </Text>
        </View>
        <View style={[styles.popBadge, styles.popBadgeSecondary, { backgroundColor: difficulty.color }]}>
          <Text style={styles.popBadgeText} numberOfLines={1}>{difficulty.level}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>

      {/* Rating */}
      <View style={styles.ratingRow}>
        <View style={styles.starsContainer}>
          {[1,2,3,4,5].map((star) => {
            const myRate = userRatingsByUrl[recipeUrl] || 0;
            const interactive = myRate > 0;
            const iconName = interactive ? (star <= myRate ? 'star' : 'star-outline') : (avgRating >= star - 0.5 ? 'star' : 'star-outline');
            const iconColor = interactive ? (star <= myRate ? '#ffd700' : 'rgba(255,255,255,0.4)') : (avgRating >= star - 0.5 ? '#ffd700' : 'rgba(255,255,255,0.4)');
            return (
              <TouchableOpacity key={star} onPress={() => submitCardRating && submitCardRating(recipeUrl, star)}>
                <Ionicons name={iconName} size={16} color={iconColor} />
              </TouchableOpacity>
            );
          })}
        </View>
        {ratingsCount > 0 && <Text style={styles.ratingCount}>({ratingsCount})</Text>}
      </View>

      {/* Meta */}
      <Text style={styles.metaText}>{totalMinutes > 0 ? `${totalMinutes} Minutes` : 'Time not specified'}</Text>
      <Text style={styles.metaText}>{Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0} Ingredients</Text>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={() => navigation && navigation.navigate('Recipe', { recipe: loadRecipeFromSaved && loadRecipeFromSaved(recipe) })}>
          <Text style={styles.actionText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { try { deleteRecipe && deleteRecipe(recipe.id); } catch (_) {} }}>
          <Text style={[styles.actionText, styles.actionDelete]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {imageUrl && (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'visible',
    padding: 16,
    position: 'relative',
    minHeight: 180,
  },
  sizePortrait: { width: 320, height: 200 },
  sizeLandscape: { height: 180 },
  selectedCard: { borderWidth: 3, borderColor: '#ff8243' },
  popBadgesContainer: { position: 'absolute', top: -14, left: 16, flexDirection: 'row', gap: 8, zIndex: 10 },
  popBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  popBadgeSecondary: { marginLeft: 8 },
  popBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 10, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  starsContainer: { flexDirection: 'row', gap: 2 },
  ratingCount: { color: '#fff', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, marginLeft: 6 },
  metaText: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  actionsRow: { position: 'absolute', bottom: 12, left: 16, flexDirection: 'row', gap: 16 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  actionDelete: { opacity: 0.9 },
  image: { position: 'absolute', bottom: 8, right: 8, width: 100, height: 100, borderRadius: 12, opacity: 0.95 },
});

export default IPadRecipeCard;

