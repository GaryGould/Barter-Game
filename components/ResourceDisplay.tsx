import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ResourceType } from '../App';

const resourceIcons: Record<ResourceType, any> = {
  salt: require('../assets/Icons/Salt.png'),
  apples: require('../assets/Icons/apple.png'),
  tools: require('../assets/Icons/Tools.png'),
  pottery: require('../assets/Icons/pottery.png'),
  shells: require('../assets/Icons/shell.png'),
  cow: require('../assets/Icons/cow.png')
};

type ResourceDisplayProps = {
  name: ResourceType;
  amount: number;
  showAmount?: boolean;
};

export const ResourceDisplay = ({ name, amount, showAmount = true }: ResourceDisplayProps) => {
  const icon = resourceIcons[name];

  return (
    <View style={styles.itemWrapper}>
      <View style={styles.iconContainer}>
        {showAmount && (
          <View style={styles.amountBadge}>
            <Text style={styles.amountText}>{amount}</Text>
          </View>
        )}
        <Image
          source={icon}
          style={styles.icon}
          contentFit="contain"
          transition={0}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  itemWrapper: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  iconContainer: {
    width: 60,
    height: 60,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountBadge: {
    position: 'absolute',
    top: 4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowRadius: 1,
  },
  amountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'black',
  },
  icon: {
    width: 72,
    height: 72,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: 'black',
    textAlign: 'center',
  },
});