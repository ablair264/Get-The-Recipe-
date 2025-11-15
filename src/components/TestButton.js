import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TestButton = () => {
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.text}>TEST</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE5B4',
    borderWidth: 3,
    borderColor: '#87CEEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
    fontWeight: 'bold',
  },
});

export default TestButton;
