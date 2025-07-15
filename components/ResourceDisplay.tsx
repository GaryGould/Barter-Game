import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

type ResourceDisplayProps = {
  name: string;
  amount: number;
};

// Local registry to map resource names to their images
const resourceIcons: Record<string, any> = {
  salt: require('../assets/Icons/Salt.png'),
  apples: require('../assets/Icons/apple.png'),
  tools: require('../assets/Icons/Tools.png'),
  pottery: require('../assets/Icons/pottery.png'),
  shells: require('../assets/Icons/shell.png'),
};

export const ResourceDisplay = ({ name, amount }: ResourceDisplayProps) => {
  const icon = resourceIcons[name.toLowerCase()];

  return (
    <View style={styles.container}>
      {icon && (
        <Image
          source={icon}
          style={styles.icon}
          resizeMode="contain"
        />
      )}
      <View style={styles.amountBox}>
        <Text style={styles.amountText}>{amount}</Text>
      </View>
      <Text style={styles.label}>{name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    margin: 8,
  },
  icon: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  amountBox: {
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountText: {
    fontWeight: 'bold',
  },
  label: {
    marginTop: 4,
    color: 'white',
  },
});
