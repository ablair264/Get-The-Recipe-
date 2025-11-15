import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import colors from '../theme/colors';

const difficultyOptions = [
  { label: 'All Levels', value: 'All' },
  { label: 'Easy', value: 'Easy' },
  { label: 'Moderate', value: 'Moderate' },
  { label: 'Difficult', value: 'Difficult' },
];

const timeOptions = [
  { label: 'Any Time', value: 'All' },
  { label: 'Under 30 min', value: '30' },
  { label: '30-60 min', value: '60' },
  { label: '1-2 hours', value: '120' },
  { label: 'Over 2 hours', value: '120+' },
];

const sortOptions = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Rating', value: 'rating' },
  { label: 'Prep Time', value: 'prepTime' },
  { label: 'Cook Time', value: 'cookTime' },
  { label: 'Name A-Z', value: 'nameAsc' },
  { label: 'Name Z-A', value: 'nameDesc' },
];

const FilterBar = ({
  filters,
  onFilterChange,
  categories = [],
  isVertical = false,
}) => {
  const [active, setActive] = React.useState(null); // 'category' | 'difficulty' | 'totalTime' | 'sortBy' | null

  const containerStyle = isVertical ? styles.verticalContainer : styles.horizontalContainer;
  const filterStyle = isVertical ? styles.verticalFilter : styles.horizontalFilter;

  const categoryOptions = React.useMemo(() => {
    const unique = Array.from(new Set(categories)).filter(c => c !== 'All');
    return [{ label: 'All Categories', value: 'All' }, ...unique.map(c => ({ label: c, value: c }))];
  }, [categories]);

  const labelFor = (type) => {
    switch (type) {
      case 'category': return 'Category';
      case 'difficulty': return 'Difficulty';
      case 'totalTime': return 'Total Time';
      case 'sortBy': return 'Sort By';
      default: return '';
    }
  };

  const valueLabelFor = (type, value) => {
    const list = type === 'category' ? categoryOptions
      : type === 'difficulty' ? difficultyOptions
      : type === 'totalTime' ? timeOptions
      : sortOptions;
    return (list.find(o => o.value === (value ?? '')) || {}).label || (type === 'category' ? 'All Categories' : '');
  };

  const optionsFor = (type) => (
    type === 'category' ? categoryOptions
      : type === 'difficulty' ? difficultyOptions
      : type === 'totalTime' ? timeOptions
      : sortOptions
  );

  const renderPickerModal = () => {
    if (!active) return null;
    const opts = optionsFor(active);
    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => setActive(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{labelFor(active)}</Text>
            <ScrollView style={styles.modalList}>
              {opts.map(({ label, value }) => (
                <TouchableOpacity
                  key={`${active}-${value}`}
                  style={styles.modalOption}
                  onPress={() => {
                    onFilterChange(active, value);
                    setActive(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>{label}</Text>
                  {filters[active] === value && <Text style={styles.modalTick}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setActive(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const FilterControl = ({ type }) => (
    <View style={filterStyle}>
      <Text style={styles.filterLabel}>{labelFor(type)}</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setActive(type)}>
        <Text style={styles.selectorText} numberOfLines={1}>
          {valueLabelFor(type, filters[type])}
        </Text>
        <Text style={styles.selectorChevron}>▾</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={containerStyle}>
      <FilterControl type="category" />
      <FilterControl type="difficulty" />
      <FilterControl type="totalTime" />
      <FilterControl type="sortBy" />
      {renderPickerModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  verticalContainer: {
    paddingVertical: 8,
    backgroundColor: '#fff',
    gap: 12,
  },
  horizontalFilter: {
    flex: 1,
    minWidth: 160,
  },
  verticalFilter: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.charcoal[400],
    marginBottom: 6,
    textAlign: 'center',
  },
  selector: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: colors.charcoal[500],
    paddingRight: 8,
  },
  selectorChevron: {
    fontSize: 14,
    color: colors.charcoal[400],
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal[500],
    marginBottom: 12,
    textAlign: 'center',
  },
  modalList: { maxHeight: 320 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: { fontSize: 14, color: colors.charcoal[500] },
  modalTick: { fontSize: 16, color: '#069494', fontWeight: '700' },
  modalCancel: { marginTop: 10, alignSelf: 'center' },
  modalCancelText: { color: '#069494', fontSize: 14, fontWeight: '700' },
});

export default FilterBar;
