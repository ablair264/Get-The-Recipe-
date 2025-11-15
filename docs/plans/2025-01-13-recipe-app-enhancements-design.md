# Recipe App Enhancements Design
**Date:** 2025-01-13
**Status:** Approved

## Overview
This design covers four major enhancements to improve user experience: recipe history tracking, save prompts, interactive onboarding, gesture-based interactions, and unified header navigation.

---

## Feature 1: Recently Fetched Recipes & Save Prompts

### Objective
Track all recipes users fetch (not just saved ones) and prompt users to save recipes they've engaged with before navigating away.

### Database Schema

**New Table: `fetched_recipes`**
```sql
CREATE TABLE fetched_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_data JSONB NOT NULL,
  source_url TEXT,
  image_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  declined_save BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, source_url)
);

CREATE INDEX idx_fetched_recipes_user_id ON fetched_recipes(user_id);
CREATE INDEX idx_fetched_recipes_fetched_at ON fetched_recipes(fetched_at DESC);
```

**Purpose:**
- `recipe_data`: Full parsed recipe (title, ingredients, instructions, etc.)
- `source_url`: Original recipe URL (for deduplication)
- `declined_save`: Prevents repeat save prompts for same recipe
- Unique constraint ensures one entry per user per URL

### ParserScreen Changes

**Recently Fetched Section:**
- Query `fetched_recipes` table instead of `recipes` (saved only)
- Display last 10 fetched recipes, ordered by `fetched_at DESC`
- Show recipe thumbnail, title, source domain, timestamp (e.g., "2 hours ago")
- Visual indicator (checkmark badge) if recipe is already saved
- Tap any item to navigate to RecipeScreen with stored `recipe_data`

**Data Flow:**
1. User fetches recipe → Save to `fetched_recipes` table
2. If `source_url` already exists for user → Update `fetched_at` timestamp
3. Recently fetched list refreshes automatically

### RecipeScreen Save Prompt

**Trigger:** User navigates away from RecipeScreen (back button, tab change, gesture)

**Logic:**
1. Use React Navigation's `beforeRemove` listener to intercept navigation
2. Check if recipe is already saved (`recipes` table)
3. Check if user previously declined (`fetched_recipes.declined_save = true`)
4. If neither condition is true → Show modal prompt

**Modal UI:**
- Title: "Save this recipe before leaving?"
- Three buttons:
  - **"Save"** → Opens category selector, saves recipe, allows navigation
  - **"Don't Save"** → Sets `declined_save = true` in `fetched_recipes`, allows navigation
  - **"Cancel"** → Dismisses modal, stays on RecipeScreen

**Edge Cases:**
- If recipe was fetched from external share (no entry in `fetched_recipes`): Always prompt
- If user manually deletes recipe after fetching: Reset `declined_save` to allow re-prompting

---

## Feature 2: Interactive Onboarding Tour

### Objective
Guide new users through core features on first login with contextual overlay tooltips.

### Tour Infrastructure

**Storage:** AsyncStorage key `@hasCompletedTour` (boolean)
- Checked after authentication completes
- If `false` or doesn't exist → Launch tour
- Set to `true` when tour completes or user skips

**Implementation Approach:**
- Custom overlay system with semi-transparent backdrop (rgba(0,0,0,0.7))
- Highlighted "spotlight" area (clear circle/rectangle around focused element)
- Tooltip bubble with arrow pointing to feature
- Navigation controls: "Next" / "Skip Tour" / "Back" buttons
- Progress indicator: Dots (● ○ ○ ○ ○) showing current step

**Alternative:** Could use `react-native-walkthrough-tooltip` library if available

### Tour Steps (5 Screens)

#### Step 1: ParserScreen - URL Input
- **Highlight:** URL input field
- **Tooltip:** "Paste any recipe URL here to extract ingredients and instructions"
- **Position:** Above input field
- **Actions:** "Next" / "Skip Tour"

#### Step 2: ParserScreen - Fetch Button
- **Highlight:** "Get Recipe" button
- **Tooltip:** "Tap here to get the recipe! We'll extract everything you need!"
- **Position:** Below button
- **Actions:** "Back" / "Next" / "Skip Tour"

#### Step 3: RecipeScreen - Tabs & Save
- **Auto-navigation:** Navigate to RecipeScreen with sample recipe data
- **Highlight (Part A):** Three tabs (Ingredients/Instructions/Comments)
- **Tooltip:** "Switch between tabs to view ingredients, steps, and tips"
- **Highlight (Part B):** Save button
- **Tooltip:** "Save recipes to organise them by category"
- **Position:** Context-aware (above/below highlighted elements)
- **Actions:** "Back" / "Next" / "Skip Tour"

#### Step 4: BookScreen - Recipe Cards
- **Auto-navigation:** Navigate to Book tab
- **Highlight:** Recipe card list area
- **Tooltip:** "All your saved recipes live here. Tap any card to view, swipe to delete"
- **Position:** Center overlay
- **Actions:** "Back" / "Next" / "Skip Tour"

#### Step 5: PantryScreen - Pantry Interface
- **Auto-navigation:** Navigate to Pantry tab
- **Highlight:** Pantry interface
- **Tooltip:** "Track ingredients you have. Get recipe suggestions based on your pantry!"
- **Position:** Center overlay
- **Actions:** "Back" / "Get Started" (final step) / "Skip Tour"

### User Controls
- **Skip Tour:** Button visible in top-right corner on every step
- **Progress:** Display current step (e.g., "1/5", "2/5") at bottom
- **Back Navigation:** Available on steps 2-5
- **Sample Data:** Use placeholder recipe for tour demo (won't save to database)

### Re-triggering Tour
- Add "Show Tutorial" option in SettingsScreen
- Resets `@hasCompletedTour` to `false` and relaunches tour

---

## Feature 3: BookScreen Gesture Interactions

### Objective
Modern gesture-based recipe card interactions: tap anywhere to view, swipe to delete.

### Technical Implementation

**Library:** `react-native-gesture-handler` (already in dependencies)
- Use `Swipeable` component for swipe actions
- Use `TouchableOpacity` for tap gestures

### Interaction Behaviors

#### Tap Anywhere on Card
- Entire card surface is tappable (wrap in TouchableOpacity)
- Navigates to RecipeScreen with recipe data
- Includes ripple/press animation for visual feedback
- No separate "View" button needed

#### Swipe Left to Delete
- **Swipe Reveal:** Red background with white trash icon appears
- **Swipe Threshold:** 80px minimum swipe distance to trigger
- **Partial Swipe:** Shows preview of delete action (red background visible)
- **Full Swipe or Tap Delete Area:** Shows confirmation alert
  - Title: "Delete '[Recipe Name]'?"
  - Buttons: "Cancel" / "Delete"
- **After Deletion:**
  - Card animates out (fade + slide)
  - Removes from `savedRecipes` context
  - Deletes from Supabase `recipes` table
  - Updates recipe count in header subtitle

#### Swipe Right (Future Enhancement)
- Reserved for quick actions like:
  - "Add to Shopping List"
  - "Share Recipe"
  - "Duplicate Recipe"
- Not implemented initially, but gesture handler supports it
- Leaves room for future features without UI redesign

### Visual Changes

**Remove from Cards:**
- "View" button (entire card is tappable now)
- "Delete" button (swipe gesture replaces it)

**Keep on Cards:**
- Recipe image (full-width at top)
- Recipe title (bold, 18px)
- Category badge (colored pill, top-left overlay on image)
- Difficulty indicator (icon + text, e.g., "Easy")
- Prep/cook time (icons + text)
- Average rating (stars, if available)

### Device-Specific Adjustments

**Phone (iPhone/Android):**
- Standard swipeable cards in FlatList
- Swipe threshold: 80px

**iPad Portrait/Landscape:**
- Swipe still works but may need adjusted thresholds for larger cards (e.g., 120px)
- Tap gesture remains consistent
- Existing dual-pane layouts (`IPadBookPortrait`, `iPadBookLandscape`) integrate swipe actions

### Accessibility
- VoiceOver/TalkBack support: Add accessibility labels
- Card: "Recipe card: [title]. Double-tap to view. Swipe left with three fingers to delete."
- Ensure swipe actions have accessible alternatives (voice commands)

---

## Feature 4: Unified Header Component

### Objective
Create consistent header design across all screens with back navigation and flexible layout.

### New Component: `CustomHeader.js`

**Location:** `/src/components/CustomHeader.js`

**Props:**
```typescript
{
  title: string,              // Main header text (required)
  subtitle?: string,          // Optional subtext below title
  showBackButton: boolean,    // Whether to show back arrow
  onBackPress?: () => void,   // Custom back handler (optional, defaults to navigation.goBack())
  rightComponent?: ReactNode, // Optional right-side element (e.g., settings icon)
  backgroundColor?: string    // Optional background color (defaults to white)
}
```

### Layout Structure

```
┌─────────────────────────────────────┐
│  ←                          ⚙️      │  ← Top row (56px height)
│                                     │
│  Recipe Book                        │  ← Title (28px font, bold)
│  23 saved recipes                   │  ← Subtitle (14px font, light)
└─────────────────────────────────────┘
```

**Spacing:**
- Back arrow: 16px from left edge, vertically centered in top row
- Right component: 16px from right edge, vertically centered in top row
- Top row height: 56px (includes SafeArea top padding)
- Title: 16px below top row
- Subtitle: 4px below title
- Bottom padding: 12px

**Styling:**
- Back arrow: Chevron-left icon, 24x24px, `colors.charcoal[700]`
- Title: 28px font, bold (weight: 700), `colors.charcoal[800]`
- Subtitle: 14px font, regular (weight: 400), `colors.charcoal[500]`
- Background: Defaults to white, customizable via prop

### Back Button Behavior

#### Main Tabs (Parser, Book, Pantry)
- **Book Tab:** Back arrow navigates to Parser tab (the "home")
- **Pantry Tab:** Back arrow navigates to Parser tab
- **Parser Tab:** `showBackButton = false` (Parser IS the home)

**Implementation:**
```javascript
onBackPress={() => navigation.navigate('Parser')}
```

#### Stack Screens (Recipe, Settings, CookingMode, PriceComparison)
- Back arrow uses standard `navigation.goBack()`
- Returns to previous screen in navigation stack

**Implementation:**
```javascript
// Default behavior if onBackPress not provided
onBackPress={() => navigation.goBack()}
```

#### Modal Screens (CookingMode with fullScreenModal presentation)
- Back arrow dismisses modal
- Can use custom dismiss handler if needed

### Screen-Specific Header Configurations

| Screen | Title | Subtitle | showBackButton | rightComponent |
|--------|-------|----------|----------------|----------------|
| ParserScreen | "Get Recipe" | null | false | Settings Icon |
| BookScreen | "Recipe Book" | "{count} saved recipes" | true | Settings Icon |
| PantryScreen | "My Pantry" | "{count} ingredients" | true | Settings Icon |
| RecipeScreen | `{recipe.title}` | `{source domain}` | true | Share Icon |
| SettingsScreen | "Settings" | null | true | null |
| CookingModeScreen | "Cooking Mode" | `{recipe.title}` | true | null |
| PriceComparisonScreen | "Price Comparison" | null | true | null |

**Dynamic Subtitles:**
- BookScreen: Count from `savedRecipes.length`
- PantryScreen: Count from pantry items
- RecipeScreen: Extract domain from `source_url` (e.g., "from allrecipes.com")

### Implementation in Screens

**Before (Custom Header in Each Screen):**
```javascript
<View style={styles.header}>
  <Text style={styles.title}>Recipe Book</Text>
  {/* Custom settings button, etc. */}
</View>
```

**After (Unified Component):**
```javascript
import CustomHeader from '../components/CustomHeader';

<CustomHeader
  title="Recipe Book"
  subtitle={`${savedRecipes.length} saved recipes`}
  showBackButton={true}
  onBackPress={() => navigation.navigate('Parser')}
  rightComponent={<SettingsButton />}
/>
```

### Theme Consistency
- Use existing `colors.js` theme for all styling
- Match current header heights and padding
- Maintain StatusBar styling per screen (dark-content for light backgrounds)
- Responsive to SafeArea on all devices (iPhone notch, iPad, Android cutouts)
- Support both iOS and Android navigation patterns

---

## Implementation Phases

### Phase 1: Database & Data Layer
1. Create `fetched_recipes` table migration
2. Add Supabase query functions in AppContext
3. Update ParserScreen fetch logic to save to `fetched_recipes`

### Phase 2: Recently Fetched & Save Prompts
1. Update ParserScreen "Recently Fetched" to query new table
2. Implement RecipeScreen save prompt with `beforeRemove` listener
3. Test save/decline flows

### Phase 3: Unified Header Component
1. Create `CustomHeader.js` component
2. Update all 7 screens to use CustomHeader
3. Test navigation flows and back button behavior

### Phase 4: BookScreen Gestures
1. Implement swipeable recipe cards
2. Add delete confirmation logic
3. Remove old View/Delete buttons
4. Test on phone and iPad layouts

### Phase 5: Onboarding Tour
1. Create tour overlay UI system
2. Implement 5-step walkthrough logic
3. Add AsyncStorage check on app launch
4. Add "Show Tutorial" option in Settings

### Phase 6: Testing & Polish
1. Cross-device testing (iPhone, iPad, Android)
2. Accessibility testing (VoiceOver, TalkBack)
3. Edge case handling (offline, slow network)
4. UI polish and animations

---

## Success Criteria

- Users can view all fetched recipes (saved or not) in Recently Fetched section
- Save prompt appears once per recipe when navigating away unsaved
- New users see interactive tour on first login
- Tour can be skipped or replayed from Settings
- Recipe cards are fully tappable (no View button needed)
- Swipe-left deletes recipes with confirmation
- All screens have consistent header with back navigation
- Back navigation creates predictable hierarchy (tabs → Parser home)
- UK spelling throughout ("organise" not "organize")
- User-friendly copy (no jargon like "parse")

---

## Technical Notes

- Use React Navigation v6 `beforeRemove` listener for save prompts
- AsyncStorage for tour completion state
- Supabase RLS policies must allow `fetched_recipes` CRUD for authenticated users
- Gesture handler animations should feel native (60fps)
- Header component must work with both stack and tab navigation
- Sample data for tour should not persist to database

---

## Future Enhancements

- Swipe-right actions (shopping list, share)
- Search within Recently Fetched
- Filter Recently Fetched by date range
- Export Recently Fetched as CSV
- Tour analytics (which steps users skip)
- A/B test different tour flows
