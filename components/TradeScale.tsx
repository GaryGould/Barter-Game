
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { IMAGE_SOURCES } from '../imageCache';
import posthog from '../utils/posthog';

import { nextFrame, startFrameLoop } from '../utils/safeTimers';
  import { CLAMPED_WIDTH } from '../normalize';
  import { ResourceType } from '../App';
  import { resourceIcons } from '../resourceRegistry';

 
// Create animated version of expo-image
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
  // The size and layout of the scale and pans
const beamImage = IMAGE_SOURCES.scaleBeam;
const panImage = IMAGE_SOURCES.scalePan;


  const BEAM_WIDTH = CLAMPED_WIDTH * 0.9;
  const BEAM_ASPECT = 4;
  const BEAM_HEIGHT = BEAM_WIDTH / BEAM_ASPECT;
  const BEAM_TOP = 0;

  const PAN_WIDTH = BEAM_WIDTH * 0.42;
  const PAN_ASPECT = 2;
  const PAN_HEIGHT = PAN_WIDTH / PAN_ASPECT;


//components that check for outdated press/holds
const heldRemoveResourceRef = { current: null as ResourceType | null };
const removeHoldIntervalRef = { current: null as null | (() => void) }; 
  //hold acceleration
  const REMOVE_BASE_MS = 150;
  const removeDelayRef = { current: REMOVE_BASE_MS };
  const removeCountRef = { current: 0 };

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
  onRightPanMeasured?: (pos: { x: number; y: number }) => void;
  hideNumbers?: boolean;
    };

  //
  // --- MAIN COMPONENT ---
  //

export const TradeScale = ({
  playerOffer,
  npcOffer,
  unitValues,
  onRemoveItem,
  onLeftPanMeasured,
  onRightPanMeasured,
  hideNumbers = false,
}: TradeScaleProps) => {
    //
    // ---- TRADE BALANCE LOGIC ----
    //

    const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
      return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
    }, 0);

    const npcTotal = (unitValues[npcOffer.resource] || 0) * npcOffer.amount;

    
    
    // Convert imbalance into a -1 to 1 ratio
    const imbalance = Math.max(-1, Math.min(1, (npcTotal - playerTotal) / npcTotal));

    // How far the beam tilts (degrees)
    const rotation = imbalance * 15;
    
    // Track balance changes
    React.useEffect(() => {
      if (playerTotal > 0 || npcTotal > 0) {
        posthog.capture('trade_scale_balance_changed', {
          player_total: playerTotal,
          npc_total: npcTotal,
          imbalance: imbalance,
          rotation: rotation,
          is_balanced: Math.abs(imbalance) < 0.1
        });
      }
    }, [playerTotal, npcTotal]);
    
    // smooth, interruptible animation of the beam tilt
    const animatedRotation = useRef(new Animated.Value(rotation)).current;
  useEffect(() => {
    // Only animate if value actually changed
    const currentValue = (animatedRotation as any)._value;
    if (Math.abs(currentValue - rotation) > 0.01) {
      animatedRotation.stopAnimation();
      Animated.timing(animatedRotation, {
        toValue: rotation,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [rotation]);
    //
    // ---- PAN POSITIONING ----
    //

    const leftPanRef = React.useRef<View>(null);
    const rightPanRef = React.useRef<View>(null);
    // After render, measure the left pan's screen position
    React.useEffect(() => {
      nextFrame(() => {
        if (leftPanRef.current && onLeftPanMeasured) {
          leftPanRef.current.measureInWindow((x, y, width, height) => {
            onLeftPanMeasured({
              x: x + width / 2,
              y: y + height / 2,
            });
          });
        }

        if (rightPanRef.current && onRightPanMeasured) {
          rightPanRef.current.measureInWindow((x, y, width, height) => {
            onRightPanMeasured({
              x: x + width / 2,
              y: y + height / 2,
            });
          });
        }
      });
      // No cleanup here — allow hold-to-remove to continue across re-renders/rotation changes.
    }, [rotation, onLeftPanMeasured, onRightPanMeasured]);
    
    
    //  safeguard: stop stuck intervals if component is re-rendered but not unmounted
    // Ensure no stale timer on mount; guarantee cleanup on unmount
    React.useEffect(() => {
      // mount: clear any leftover interval
      if (removeHoldIntervalRef.current) {
        removeHoldIntervalRef.current();
        removeHoldIntervalRef.current = null;
      }
      heldRemoveResourceRef.current = null;

      // unmount: clear active hold if user is still pressing
      return () => {
        heldRemoveResourceRef.current = null;
        if (removeHoldIntervalRef.current) {
          removeHoldIntervalRef.current();
          removeHoldIntervalRef.current = null;
        }
      };
    }, []);
    
    

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
    // animate pan positions so the pans tilt smoothly with the beam
    const animatedLeftPanX = useRef(new Animated.Value(leftTip.x)).current;
    const animatedLeftPanY = useRef(new Animated.Value(leftTip.y)).current;
    const animatedRightPanX = useRef(new Animated.Value(rightTip.x)).current;
    const animatedRightPanY = useRef(new Animated.Value(rightTip.y)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(animatedLeftPanX, {
          toValue: leftTip.x,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animatedLeftPanY, {
          toValue: leftTip.y,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animatedRightPanX, {
          toValue: rightTip.x,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(animatedRightPanY, {
          toValue: rightTip.y,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, [leftTip.x, leftTip.y, rightTip.x, rightTip.y]);
    
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

      const bottomRow = flatItems.slice(0, 3);
      const topRow = flatItems.slice(3, 5);

      const renderStack = (row: [ResourceType, number][], rowKey: string) =>
        row.map(([res, count], index) => {
          const Wrapper = onRemoveItem ? TouchableOpacity : View;
          const wrapperProps = onRemoveItem
            ? {
              activeOpacity: 0.7,
              delayPressIn: 0,
              delayLongPress: 0,

              onPressIn: () => {
                // Mark which resource is being removed during this hold.
                heldRemoveResourceRef.current = res;

                const doRemove = () => {
                  if (heldRemoveResourceRef.current === res) {
                    onRemoveItem(res);
                  }
                };

                // First removal happens instantly on press-in.
                doRemove();
                removeCountRef.current = 1;
                removeDelayRef.current = REMOVE_BASE_MS;
                
                // Track item removal
                posthog.capture('trade_scale_item_removed', {
                  resource: res,
                  action: 'initial_press'
                });

                // If a previous timer is around, clear it (defensive).
                if (removeHoldIntervalRef.current) {
                  removeHoldIntervalRef.current();
                  removeHoldIntervalRef.current = null;
                }

                // Like the add side: shrink delay by 10% after the 3rd item, floor at 35% of base.
                const tick = () => {
                  if (heldRemoveResourceRef.current !== res) return;

                  doRemove();
                  removeCountRef.current += 1;
                  
                  // Track held removals
                  if (removeCountRef.current % 5 === 0) {
                    posthog.capture('trade_scale_item_removed', {
                      resource: res,
                      action: 'held_removal',
                      count: removeCountRef.current
                    });
                  }

                  if (removeCountRef.current >= 3) {
                    const minDelay = REMOVE_BASE_MS * 0.35;
                    const next = Math.max(minDelay, removeDelayRef.current * 0.90);
                    if (next !== removeDelayRef.current) {
                      removeDelayRef.current = next;
                      // (frame loop continues; dynamic interval is read each tick)
                    }
                  }
                };

                // Pass a getter so the loop reads the latest removeDelayRef.current
                removeHoldIntervalRef.current = startFrameLoop(() => removeDelayRef.current, () => {
                  if (heldRemoveResourceRef.current !== res) return false;
                  tick();
                  return true;
                });
              },

              onPressOut: () => {
                // Stop the touch interaction + timer and reset adaptive counters.
                heldRemoveResourceRef.current = null;
                if (removeHoldIntervalRef.current) {
                  removeHoldIntervalRef.current();
                  removeHoldIntervalRef.current = null;
                }

                removeCountRef.current = 0;
                removeDelayRef.current = REMOVE_BASE_MS;
              },
            }
            : {};
        

          return (
            <Wrapper
              key={`${rowKey}-${res}-${index}`}
              style={styles.itemWithCount}
              {...wrapperProps}
            >
              <Image source={resourceIcons[res]} style={styles.itemIcon} contentFit="contain" transition={0} />
              {!hideNumbers && (
                <View style={styles.countCircle}>
                  <Text style={styles.countCircleText}>{count}</Text>
                </View>
              )}
            </Wrapper>
          );
        });

      return (
        <View style={styles.stackWrapper}>
          {topRow.length > 0 && <View style={styles.topRow}>{renderStack(topRow, 'top')}</View>}
          <View style={styles.bottomRow}>{renderStack(bottomRow, 'bottom')}</View>
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
          style={[
            styles.beam,
            {
              transform: [{
                rotate: animatedRotation.interpolate({
                  inputRange: [-15, 15],
                  outputRange: ['-15deg', '15deg'],
                }),
              }],
            },
          ]}
          resizeMode="contain"
        />

        {/* Left pan image */}
        <Animated.Image
          source={panImage}
          style={[
            styles.pan,
            {
              transform: [
                { translateX: animatedLeftPanX },
                { translateY: animatedLeftPanY },
              ],
            },
          ]}
          resizeMode="contain"
        />

        {/* Player's offered items rendered inside left pan */}
        <Animated.View
          ref={leftPanRef}
          collapsable={false}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            width: PAN_WIDTH,
            alignItems: 'center',
            transform: [
              { translateX: animatedLeftPanX },
              { translateY: Animated.add(animatedLeftPanY, PAN_HEIGHT * 0.15) },
            ],
          }}
        >
          {renderItems(playerOffer, onRemoveItem)}
        </Animated.View>


        {/* Right pan image */}
        <Animated.Image
          source={panImage}
          style={[
            styles.pan,
            {
              transform: [
                { translateX: animatedRightPanX },
                { translateY: animatedRightPanY },
              ],
            },
          ]}
          resizeMode="contain"
        />

        {/* NPC's offered item in right pan */}
        <Animated.View
          ref={rightPanRef}
          collapsable={false}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            width: PAN_WIDTH,
            alignItems: 'center',
            transform: [
              { translateX: animatedRightPanX },
              { translateY: Animated.add(animatedRightPanY, PAN_HEIGHT * 0.15) },
            ],
          }}
        >
          {renderItems({ [npcOffer.resource]: npcOffer.amount })}
        </Animated.View>





      </View>
    );
  };
export const cancelAllScaleRemovals = () => {
  heldRemoveResourceRef.current = null;
  if (removeHoldIntervalRef.current) {
    removeHoldIntervalRef.current(); // cancel frame loop
    removeHoldIntervalRef.current = null;
  }
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
