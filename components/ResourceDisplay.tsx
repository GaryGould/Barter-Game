  import React from 'react';
  import { View, Text, Image, StyleSheet } from 'react-native';
  import { ResourceType } from '../App';

  const resourceIcons: Record<ResourceType, any> = {
    salt: require('../assets/Icons/Salt.png'),
    apples: require('../assets/Icons/apple.png'),
    tools: require('../assets/Icons/Tools.png'),
    pottery: require('../assets/Icons/pottery.png'),
    shells: require('../assets/Icons/shell.png'),
  };

  type ResourceDisplayProps = {
    name: ResourceType;
    amount: number;
    showAmount?: boolean;
  };

  // Visual display of one resource: icon, count badge, and label
export const ResourceDisplay = ({ name, amount, showAmount = true }: ResourceDisplayProps) => {
  const icon = resourceIcons[name];

  return (
    <View style={styles.itemWrapper}>
      {/* Icon with optional count badge */}
      <View style={styles.iconContainer}>
        {showAmount && (
          <View style={styles.amountBadge}>
            <Text style={styles.amountText}>{amount}</Text>
          </View>
        )}
        <Image source={icon} style={styles.icon} resizeMode="contain" />
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
