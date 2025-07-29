// components/FlyingResourceManager.tsx
import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Animated, Image, View, StyleSheet, Text } from 'react-native';
import { ResourceType } from '../App';

const resourceIcons: Record<ResourceType, any> = {
    salt: require('../assets/Icons/Salt.png'),
    apples: require('../assets/Icons/apple.png'),
    tools: require('../assets/Icons/Tools.png'),
    pottery: require('../assets/Icons/pottery.png'),
    shells: require('../assets/Icons/shell.png'),
    cow: require('../assets/Icons/cow.png')

};

type FlyingResource = {
    id: number;
    name: ResourceType;
    anim: Animated.ValueXY;
    target: { x: number; y: number };
    opacity: Animated.Value;
};
// Floating text bubble that can rise and fade
type FloatingLabel = {
    id: number;
    text: string;
    anim: Animated.ValueXY;
    opacity: Animated.Value;
};

export type FlyingResourceManagerHandle = {
    fly: (name: ResourceType, start: { x: number; y: number }, end: { x: number; y: number }) => void;
    riseAndFade: (
        name: ResourceType,
        start: { x: number; y: number },
        risePx?: number,
        durationMs?: number
    ) => void;
    // New: show a white text bubble that rises and then fades
    riseLabel: (
        text: string,
        start: { x: number; y: number },
        risePx?: number,
        durationMs?: number,
        fadeDelayMs?: number
    ) => void;
};



export const FlyingResourceManager = forwardRef<FlyingResourceManagerHandle>((_, ref) => {
    const [flying, setFlying] = useState<FlyingResource[]>([]);   // <-- add this
    const [labels, setLabels] = useState<FloatingLabel[]>([]);
    const idRef = useRef(0);

    useImperativeHandle(ref, () => ({
        fly(name, start, end) {
            const id = idRef.current++;
            const anim = new Animated.ValueXY({ x: start.x, y: start.y });
            const target = { x: end.x, y: end.y };
            const opacity = new Animated.Value(1);
            const newFlying = { id, name, anim, target, opacity };
            setFlying(prev => [...prev, newFlying]);

            Animated.timing(anim, {
                toValue: target,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                setFlying(prev => prev.filter(f => f.id !== id));
            });
        },

        // New helper used by apple spoilage visuals
        riseAndFade(name, start, risePx = 60, durationMs = 600) {
            const id = idRef.current++;
            const anim = new Animated.ValueXY({ x: start.x, y: start.y });
            const target = { x: start.x, y: start.y - risePx };
            const opacity = new Animated.Value(1);
            const newFlying = { id, name, anim, target, opacity };
            setFlying(prev => [...prev, newFlying]);

            Animated.parallel([
                Animated.timing(anim, {
                    toValue: target,
                    duration: durationMs,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: durationMs,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setFlying(prev => prev.filter(f => f.id !== id));
            });
        },
        riseLabel(text, start, risePx = 80, durationMs = 1400, fadeDelayMs = 600) {
            const id = idRef.current++;
            const anim = new Animated.ValueXY({ x: start.x, y: start.y });
            const target = { x: start.x, y: start.y - risePx };
            const opacity = new Animated.Value(1);
            const label: FloatingLabel = { id, text, anim, opacity };
            setLabels(prev => [...prev, label]);

            Animated.parallel([
                Animated.timing(anim, {
                    toValue: target,
                    duration: durationMs,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.delay(fadeDelayMs),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: Math.max(300, durationMs - fadeDelayMs),
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                setLabels(prev => prev.filter(l => l.id !== id));
            });
        },
    }));
    
    

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999, // force render on top
            }}
        >
            {flying.map(({ id, name, anim, opacity }) => (
                <Animated.Image
                    key={id}
                    source={resourceIcons[name]}
                    style={[
                        {
                            position: 'absolute',
                            width: 60,
                            height: 60,
                            transform: anim.getTranslateTransform(),
                            opacity, // <- fade support
                        },
                    ]}
                    resizeMode="contain"
                />
            ))}
            {labels.map(({ id, text, anim, opacity }) => (
                <Animated.View
                    key={`label-${id}`}
                    style={[
                        {
                            position: 'absolute',
                            transform: anim.getTranslateTransform(),
                            opacity,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: 'white',
                            borderRadius: 12,
                        },
                        styles.bubbleShadow,
                    ]}
                    pointerEvents="none"
                >
                    <Text style={{ color: 'black', fontWeight: 'bold' }}>{text}</Text>
                </Animated.View>
            ))}

        </View>
    );
      
});

const styles = StyleSheet.create({
    flyingIcon: {
        position: 'absolute',
        width: 60,
        height: 60,
    },
    bubbleShadow: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
});
