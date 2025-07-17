import React from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';

import { ResourceType } from '../App'; // adjust path if needed
import { VIRTUAL_WIDTH } from '../normalize';
const beamImage = require('../assets/scale/scaleBeam.png');
const panImage = require('../assets/scale/scalePan.png');


const resourceIcons: Record<ResourceType, any> = {
  salt: require('../assets/Icons/Salt.png'),
  apples: require('../assets/Icons/apple.png'),
  tools: require('../assets/Icons/Tools.png'),
  pottery: require('../assets/Icons/pottery.png'),
  shells: require('../assets/Icons/shell.png'),
};

type TradeScaleProps = {
  playerOffer: Partial<Record<ResourceType, number>>;
  npcOffer: { resource: ResourceType; amount: number };
  unitValues: Record<ResourceType, number>;
};

export const TradeScale = ({ playerOffer, npcOffer, unitValues }: TradeScaleProps) => {
  const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
    return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
  }, 0);

  const npcTotal = (unitValues[npcOffer.resource] || 0) * npcOffer.amount;

  // How far off balance are we?
const imbalance = Math.max(-1, Math.min(1, (npcTotal - playerTotal) / npcTotal));
  const rotation = imbalance * 15; // -15° to 15° tilt

  const renderItems = (items: Partial<Record<ResourceType, number>>) => {
    const entries = Object.entries(items).filter(([_, count]) => count && count > 0);

    const bottomRow = entries.slice(0, 3);
    const topRow = entries.slice(3, 5);

    const renderRow = (rowEntries: [string, number][], rowKey: string) => (
      <View key={rowKey} style={styles.itemRow}>
        {rowEntries.map(([res, count], index) => (
          <View key={`${rowKey}-${res}-${index}`} style={styles.itemWithCount}>
            <Image source={resourceIcons[res as ResourceType]} style={styles.itemIcon} />
            {count > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>×{count}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );

    // Reverse order: bottom row renders first (at bottom), then top row renders above it
    return (
      <View style={styles.stackWrapper}>
        {renderRow(bottomRow, 'bottom')}
        {topRow.length > 0 && renderRow(topRow, 'top')}
      </View>
    );
  };
  
  

  const beamLength = 160; // in pixels, match your beam sprite width
  const angleRad = (rotation * Math.PI) / 180;

  const leftTip = {
    x: -Math.cos(angleRad) * beamLength / 2,
    y: -Math.sin(angleRad) * beamLength / 2,
  };

  const rightTip = {
    x: Math.cos(angleRad) * beamLength / 2,
    y: Math.sin(angleRad) * beamLength / 2,
  };
  
  return (
    <View style={styles.container}>
      {/* Beam */}
      <Animated.Image
        source={beamImage}
        style={[
          styles.beam,
          {
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
        resizeMode="contain"
      />

      {/* Left Pan */}
      <Animated.View
        style={[
          styles.panWrapper,
          {
            transform: [
              { translateX: leftTip.x },
              { translateY: leftTip.y },
            ],
          },
        ]}
      >
        <Image source={panImage} style={styles.pan} />
        {renderItems(playerOffer)}
</Animated.View>

      {/* Right Pan */}
      <Animated.View
        style={[
          styles.panWrapper,
          {
            transform: [
              { translateX: rightTip.x },
              { translateY: rightTip.y },
            ],
          },
        ]}
      >
        <Image source={panImage} style={styles.pan} />
          {renderItems({ [npcOffer.resource]: npcOffer.amount })}
      </Animated.View>
    </View>
  );

};

const styles = StyleSheet.create({
  container: {
    width: VIRTUAL_WIDTH, // match your scene width
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'visible',
    position: 'relative',
  },

  beam: {
    width: 260,
    height: 60,
    position: 'absolute',
    top: 40,
  },

  panWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },

  pan: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginTop: -10, // optional visual tweak to align better
  },

  itemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: -10, // raises items into the pan
  },

  itemIcon: {
    width: 24,
    height: 24,
    margin: 2,
  },

  itemWithCount: {
    position: 'relative',
    margin: 4,
  },

  countBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stackWrapper: {
    position: 'absolute',
    top: '30%', // raised slightly now that rows reverse
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column-reverse', // <--- fix stack direction
    pointerEvents: 'none',
  },
  
});

