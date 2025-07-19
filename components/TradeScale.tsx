import React, { useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { CLAMPED_WIDTH } from '../normalize';
import { ResourceType } from '../App';
import { resourceIcons } from '../resourceRegistry';


// The size and layout of the scale and pans
const beamImage = require('../assets/Scale/scaleBeam.png');
const panImage = require('../assets/Scale/scalePan.png');

const BEAM_WIDTH = CLAMPED_WIDTH * 0.9;
const BEAM_ASPECT = 4;
const BEAM_HEIGHT = BEAM_WIDTH / BEAM_ASPECT;
const BEAM_TOP = 0;

const PAN_WIDTH = BEAM_WIDTH * 0.42;
const PAN_ASPECT = 2;
const PAN_HEIGHT = PAN_WIDTH / PAN_ASPECT;

// How far the pans hang from the pivot point
const PAN_HANGING_SPAN = BEAM_WIDTH * 0.8;

//
// --- PROPS TYPE ---
//

type TradeScaleProps = {
  playerOffer: Partial<Record<ResourceType, number>>;
  npcOffer: { resource: ResourceType; amount: number };
  unitValues: Record<ResourceType, number>;
  onRemoveItem?: (res: ResourceType) => void;
  onLeftPanMeasured?: (pos: { x: number; y: number }) => void;
};

//
// --- MAIN COMPONENT ---
//

export const TradeScale = ({
  playerOffer,
  npcOffer,
  unitValues,
  onRemoveItem,
  onLeftPanMeasured
}: TradeScaleProps) => {

  //
  // ---- TRADE BALANCE LOGIC ----
  //

  const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
    return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
  }, 0);

  const npcTotal = (unitValues[npcOffer.resource] || 0) * npcOffer.amount;


  // press vs press and hold
  const removeHoldIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heldRemoveResourceRef = useRef<ResourceType | null>(null);
  
  
  // Convert imbalance into a -1 to 1 ratio
  const imbalance = Math.max(-1, Math.min(1, (npcTotal - playerTotal) / npcTotal));

  // How far the beam tilts (degrees)
  const rotation = imbalance * 15;

  //
  // ---- PAN POSITIONING ----
  //

  const leftPanRef = React.useRef<View>(null);

  // After render, measure the left pan's screen position
  React.useEffect(() => {
    if (!leftPanRef.current || !onLeftPanMeasured) return;

    leftPanRef.current.measureInWindow((x, y, width, height) => {
      onLeftPanMeasured({
        x: x + width / 2,
        y: y + height / 2,
      });
    });
    
  }, [playerOffer, onLeftPanMeasured]);

  // The beam rotates around this pivot Y
  const pivotY = BEAM_TOP + BEAM_HEIGHT / 2;

  // Convert rotation into pan hanging positions
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

  //
  // ---- ITEM STACK RENDERING ----
  // This displays the icons in two rows inside a pan
  //

  const renderItems = (
    items: Partial<Record<ResourceType, number>>,
    onRemoveItem?: (res: ResourceType) => void
  ) => {
    const flatItems: [ResourceType, number][] = Object.entries(items)
      .filter(([_, count]) => (count || 0) > 0)
      .map(([res, count]) => [res as ResourceType, count as number]);

    const bottomRow = flatItems.slice(0, 3); // first 3
    const topRow = flatItems.slice(3, 5);    // next 2 (if any)

    return (
      <View style={styles.stackWrapper}>
        {topRow.length > 0 && (
          <View style={styles.topRow}>
            {topRow.map(([res, count], index) => (
              <TouchableOpacity
                key={`top-${res}-${index}`} // or `bottom-${res}-${index}`
                onPressIn={() => {
                  heldRemoveResourceRef.current = res;

                  const remove = () => {
                    onRemoveItem?.(res);
                  };

                  remove(); // Remove one immediately
                  removeHoldIntervalRef.current = setInterval(remove, 150);
                }}
                onPressOut={() => {
                  heldRemoveResourceRef.current = null;
                  if (removeHoldIntervalRef.current) {
                    clearInterval(removeHoldIntervalRef.current);
                    removeHoldIntervalRef.current = null;
                  }
                }}
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

        <View style={styles.bottomRow}>
          {bottomRow.map(([res, count], index) => (
            <TouchableOpacity
              key={`bottom-${res}-${index}`}
              onPressIn={() => {
                heldRemoveResourceRef.current = res;

                const remove = () => {
                  onRemoveItem?.(res);
                };

                remove(); // Remove one immediately
                removeHoldIntervalRef.current = setInterval(remove, 150);
              }}
              onPressOut={() => {
                heldRemoveResourceRef.current = null;
                if (removeHoldIntervalRef.current) {
                  clearInterval(removeHoldIntervalRef.current);
                  removeHoldIntervalRef.current = null;
                }
              }}
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

  //
  // ---- RENDER FINAL SCALE ----
  //

  return (
    <View style={styles.root}>

      {/* The beam image tilts based on value difference */}
      <Animated.Image
        source={beamImage}
        style={[styles.beam, { transform: [{ rotate: `${rotation}deg` }] }]}
        resizeMode="contain"
      />

      {/* Left pan image */}
      <Animated.Image
        source={panImage}
        style={[styles.pan, { transform: [{ translateX: leftTip.x }, { translateY: leftTip.y }] }]}
        resizeMode="contain"
      />

      {/* Player's offered items rendered inside left pan */}
      <View
        ref={leftPanRef}
        collapsable={false}
        style={{
          position: 'absolute',
          transform: [
            { translateX: leftTip.x },
            { translateY: leftTip.y + PAN_HEIGHT * 0.15 },
          ],
          width: PAN_WIDTH,
          alignItems: 'center',
        }}
      >
        <Animated.View pointerEvents="box-none">
          {renderItems(playerOffer, onRemoveItem)}
        </Animated.View>
      </View>

      {/* Right pan image */}
      <Animated.Image
        source={panImage}
        style={[styles.pan, { transform: [{ translateX: rightTip.x }, { translateY: rightTip.y }] }]}
        resizeMode="contain"
      />

      {/* NPC's offered item in right pan */}
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

//
// --- STYLES ---
//

const styles = StyleSheet.create({
  root: {
    width: BEAM_WIDTH,
    height: BEAM_WIDTH * 0.5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
    marginTop: -20,
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
    margin: -10,
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
    position: 'relative',
    width: '100%',
    height: 140, // enough to hold both rows
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 40, // sits above bottom row without overlap
    width: '100%',
  },
});
