//NPCSlot.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Image,
  useWindowDimensions,
  View,
} from 'react-native';
import { VIRTUAL_WIDTH } from '../normalize';

type Direction = 'left' | 'right';

export function NPCSlot({
  npc,
  onPress,
}: {
  npc: {
    id: number;
    key: string;
    sprite: any;
    visible: boolean;
    direction: Direction;
    speed: number;
  };
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const [domPosition, setDomPosition] = useState(0);

  useEffect(() => {
    const offset = npc.direction === 'left' ? -VIRTUAL_WIDTH : VIRTUAL_WIDTH;
    const distance = Math.abs(offset);

    if (!npc.visible) {
      Animated.timing(translateX, {
        toValue: offset,
        duration: (distance / npc.speed) * 1000,
        useNativeDriver: true,
      }).start();
    } else {
      translateX.setValue(offset);
      Animated.timing(translateX, {
        toValue: 0,
        duration: (distance / npc.speed) * 1000,
        useNativeDriver: true,
      }).start();
    }
    
    // Update DOM position periodically for Posthog session replay
    const listener = translateX.addListener(({ value }) => {
      setDomPosition(value);
    });
    
    return () => {
      translateX.removeListener(listener);
    };
  }, [npc.visible, npc.key, npc.direction, npc.speed]);

  return (
    <Pressable onPress={onPress} disabled={!npc.visible}>
      <Animated.View style={styles.slot}>
        <Animated.View
          style={{
            transform: [{ translateX }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={npc.sprite} style={styles.sprite} resizeMode="contain" />
        </Animated.View>
        {/* Shadow element for Posthog capture */}
        <View
          style={{
            position: 'absolute',
            opacity: 0,
            transform: [{ translateX: domPosition }],
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
  sprite: {
    width: 100,
    height: 133, // roughly 4:3 aspect
  },
});
