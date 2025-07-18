import React from 'react';
import { View, Image, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { CLAMPED_WIDTH } from '../normalize';
import { ResourceType } from '../App';

const beamImage = require('../assets/Scale/scaleBeam.png');
const panImage = require('../assets/Scale/scalePan.png');

const BEAM_WIDTH = CLAMPED_WIDTH * 0.9;
const BEAM_ASPECT = 4;
const BEAM_HEIGHT = BEAM_WIDTH / BEAM_ASPECT;
const BEAM_TOP = 0;

const PAN_WIDTH = BEAM_WIDTH * 0.42;
const PAN_ASPECT = 2;
const PAN_HEIGHT = PAN_WIDTH / PAN_ASPECT;

// Pan spacing from beam pivot
const PAN_HANGING_SPAN = BEAM_WIDTH * 0.8;

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
  onRemoveItem?: (res: ResourceType) => void;

};

export const TradeScale = ({ playerOffer, npcOffer, unitValues, onRemoveItem }: TradeScaleProps) => {
  const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
    return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
  }, 0);

  const npcTotal = (unitValues[npcOffer.resource] || 0) * npcOffer.amount;
  const imbalance = Math.max(-1, Math.min(1, (npcTotal - playerTotal) / npcTotal));
  const rotation = imbalance * 15;

  // Beam pivot (middle Y of beam image)
  const pivotY = BEAM_TOP + BEAM_HEIGHT / 2;
  const angleRad = (rotation * Math.PI) / 180;
  const offsetX = (PAN_HANGING_SPAN / 2) * Math.cos(angleRad);
  const offsetY = (PAN_HANGING_SPAN / 2) * Math.sin(angleRad);

  const leftTip = {
    x: -offsetX,
    y: pivotY - offsetY,
  };

  const rightTip = {
    x: offsetX,
    y: pivotY + offsetY,
  };

  const renderItems = (
    items: Partial<Record<ResourceType, number>>,
    onRemoveItem?: (res: ResourceType) => void
  ) => {
    const flatItems: [ResourceType, number][] = Object.entries(items)
      .filter(([_, count]) => (count || 0) > 0)
      .map(([res, count]) => [res as ResourceType, count as number]);

    const bottomRow = flatItems.slice(0, 3);
    const topRow = flatItems.slice(3, 5);

    return (
      <View style={styles.stackWrapper} pointerEvents="box-none">
        {topRow.length > 0 && (
          <View style={[styles.itemRow, styles.topRow]}>
            {topRow.map(([res, count], index) => (
              <TouchableOpacity
                key={`top-${res}-${index}`}
                onPress={() => onRemoveItem?.(res)}
                style={styles.itemWithCount}
              >
                <Image source={resourceIcons[res]} style={styles.itemIcon} />
                <View style={styles.countCircle}>
                  <Text style={styles.countCircleText}>{count}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={[styles.itemRow, styles.bottomRow]}>
          {bottomRow.map(([res, count], index) => (
            <TouchableOpacity
              key={`bottom-${res}-${index}`}
              onPress={() => onRemoveItem?.(res)}
              style={styles.itemWithCount}
            >
              <Image source={resourceIcons[res]} style={styles.itemIcon} />
              <View style={styles.countCircle}>
                <Text style={styles.countCircleText}>{count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  
  
  
  

  return (
    <View style={styles.root}>
      {/* Beam */}
      <Animated.Image
        source={beamImage}
        style={[styles.beam, { transform: [{ rotate: `${rotation}deg` }] }]}
        resizeMode="contain"
      />

      {/* Left Pan */}
      <Animated.Image
        source={panImage}
        style={[
          styles.pan,
          {
            transform: [
              { translateX: leftTip.x },
              { translateY: leftTip.y },
            ],
          },
        ]}
        resizeMode="contain"
      />
      <Animated.View
        style={{
          position: 'absolute',
          transform: [
            { translateX: leftTip.x },
            { translateY: leftTip.y + PAN_HEIGHT * 0.15 },
          ],
          alignItems: 'center',
        }}
      >
        {renderItems(playerOffer, onRemoveItem)}
      </Animated.View>

      {/* Right Pan */}
      <Animated.Image
        source={panImage}
        style={[
          styles.pan,
          {
            transform: [
              { translateX: rightTip.x },
              { translateY: rightTip.y },
            ],
          },
        ]}
        resizeMode="contain"
      />
      <Animated.View
        style={{
          position: 'absolute',
          transform: [
            { translateX: rightTip.x },
            { translateY: rightTip.y + PAN_HEIGHT * 0.15 },
          ],
          alignItems: 'center',
        }}
      >
        {renderItems({ [npcOffer.resource]: npcOffer.amount })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    width: BEAM_WIDTH,
    height: BEAM_WIDTH * 0.5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    marginTop: -100,
  },
  beam: {
    width: BEAM_WIDTH,
    aspectRatio: BEAM_ASPECT,
    position: 'absolute',
    top: BEAM_TOP,
  },
  pan: {
    width: PAN_WIDTH,
    aspectRatio: PAN_ASPECT,
    position: 'absolute',
  },
  itemWithCount: {
    position: 'relative',
    margin: 4,
  },
  itemIcon: {
    width: 60,
    height: 60,
    margin: 1,
  },

  countCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  

  countCircleText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
stackWrapper: {
  flexDirection: 'column-reverse', // this makes bottom row stay fixed
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 6, // space between rows (responsive)
},


  itemRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },

  bottomRow: {
    bottom: 0,
  },

  topRow: {
    bottom: 70, // adjust as needed to stack above bottom row cleanly
  },
  
});
