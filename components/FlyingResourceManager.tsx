// components/FlyingResourceManager.tsx
import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { IMAGE_SOURCES } from '../imageCache';
import { Animated, View, StyleSheet, Text, TouchableOpacity, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';

import { ResourceType } from '../App';

const resourceIcons: Record<ResourceType, any> = {
    salt: IMAGE_SOURCES.salt,
    apples: IMAGE_SOURCES.apple,
    tools: IMAGE_SOURCES.tools,
    pottery: IMAGE_SOURCES.pottery,
    shells: IMAGE_SOURCES.shells,
    cow: IMAGE_SOURCES.cow
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


type CatchableDrop = {
    id: number;
    name: ResourceType;                 // 'pottery'
    x: Animated.Value;                  // animated X position
    y: Animated.Value;                  // animated Y position
    opacity: Animated.Value;
    onCaught?: () => void;
    onMiss?: () => void;
    stop?: () => void;                  // cancels animation
};

export type FlyingResourceManagerHandle = {
    fly: (
        name: ResourceType,
        start: { x: number; y: number },
        end: { x: number; y: number }
    ) => void;

    riseAndFade: (
        name: ResourceType,
        start: { x: number; y: number },
        risePx?: number,
        durationMs?: number
    ) => void;
    fallAndFade: (
        name: ResourceType,
        start: { x: number; y: number },
        fallPx?: number,
        durationMs?: number
    ) => void;

    riseLabel: (
        text: string,
        start: { x: number; y: number },
        riseHeight?: number,
        durationMs?: number,
        lingerMs?: number,
        onComplete?: () => void
    ) => void;

    dropCatchablePottery: (
        start: { x: number; y: number },
        opts?: { onCaught?: () => void; onMiss?: () => void }
    ) => void;
};

  



export const FlyingResourceManager = forwardRef<FlyingResourceManagerHandle>((_, ref) => {
    const [flying, setFlying] = useState<FlyingResource[]>([]);   // <-- add this
    const [labels, setLabels] = useState<FloatingLabel[]>([]);
    const idRef = useRef(0);
    const [catchables, setCatchables] = useState<CatchableDrop[]>([]);
    const screenH = Dimensions.get('window').height;
    // Cleanup animations on unmount
    React.useEffect(() => {
        return () => {
            flying.forEach(f => {
                f.anim.stopAnimation();
                f.opacity.stopAnimation();
            });
            labels.forEach(l => {
                l.anim.stopAnimation();
                l.opacity.stopAnimation();
            });
            catchables.forEach(c => {
                c.stop?.();
            });
        };
    }, []);
    // helper: rising + fading label
    const spawnRisingLabel = (
        text: string,
        start: { x: number; y: number },
        risePx = 80,
        durationMs = 1400,
        fadeDelayMs = 600
    ) => {
        const id = idRef.current++;
        const anim = new Animated.ValueXY({ x: start.x, y: start.y });
        const target = { x: start.x, y: start.y - risePx };
        const opacity = new Animated.Value(1);
        const label: FloatingLabel = { id, text, anim, opacity };
        setLabels(prev => [...prev, label]);

        Animated.parallel([
            Animated.timing(anim, { toValue: target, duration: durationMs, useNativeDriver: true }),
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
    };

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

        // rain items down
        fallAndFade(name: ResourceType, start: { x: number; y: number }, fallPx = 60, durationMs = 600) {
            const id = idRef.current++;
            const anim = new Animated.ValueXY({ x: start.x, y: start.y });
            const target = { x: start.x, y: start.y + fallPx }; // ↓ mirror movement
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

        // items rise up and fade out
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
        riseLabel(text, start, risePx = 80, durationMs = 1400, fadeDelayMs = 600, onComplete?: () => void) {
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
            ]).start(({ finished }) => {
                setLabels(prev => prev.filter(l => l.id !== id));
                if (finished && onComplete) onComplete();
            });
        },
        dropCatchablePottery(start, opts) {
            const id = idRef.current++;
            const x = new Animated.Value(start.x);
            const y = new Animated.Value(start.y);
            const opacity = new Animated.Value(1);

            // show prompt at spawn — horizontally centered on screen
            const { width: screenW } = Dimensions.get('window');
            spawnRisingLabel('Catch!', { x: screenW / 2, y: start.y }, 70, 900, 350);
            
            // Horizontal displacement: ALWAYS LEFT; random speed (≈140–260 px/s over 1.6s)
            const MIN_SPEED = 140; // px/s
            const MAX_SPEED = 220; // px/s
            const dx = -(MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)) * 1.6; // total px over 1.6s

            // How high it arcs upward before falling
            const arcHeight = 120 + Math.random() * 40;
              const fallEnd = screenH + 60;

            const progress = new Animated.Value(0);
            let stopped = false;

            const listenerId = progress.addListener(({ value: t }) => {
                // Parabolic arc up: -arcHeight * 4t(1-t); Gravity: ease to bottom by t^2
                // Base y: start.y + gravityPull(t)
                const arcY = -arcHeight * (4 * t * (1 - t));           // up, then down to 0
                const gravityY = (fallEnd - start.y) * (t * t);        // accelerates down
                const posY = start.y + arcY + gravityY;

                const posX = start.x + dx * t;
                x.setValue(posX);
                y.setValue(posY);

                // Ground hit
                if (!stopped && posY >= screenH - 20) {
                    stopped = true;
                    progress.stopAnimation();
                    opacity.setValue(0);
                    setCatchables(prev => prev.filter(c => c.id !== id));
                    opts?.onMiss?.();
                }
            });

            const stop = () => {
                if (stopped) return;
                stopped = true;
                progress.stopAnimation();
                progress.removeListener(listenerId);
                opacity.setValue(0);
                setCatchables(prev => prev.filter(c => c.id !== id));
            };

            setCatchables(prev => [
                ...prev,
                { id, name: 'pottery', x, y, opacity, onCaught: opts?.onCaught, onMiss: opts?.onMiss, stop }
            ]);

            Animated.timing(progress, {
                toValue: 1,
                duration: 1600,
                easing: Easing.linear,
                useNativeDriver: false,  // JS driver to compute parabola
            }).start(({ finished }) => {
                progress.removeListener(listenerId);
                if (!finished) return; // already handled by ground hit or catch
                // If it simply completed (rare), treat as miss for safety
                if (!stopped) {
                    stopped = true;
                    opacity.setValue(0);
                    setCatchables(prev => prev.filter(c => c.id !== id));
                    opts?.onMiss?.();
                }
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
                            // Bigger bubble for "Catch!"
                            paddingHorizontal: text === 'Catch!' ? 16 : 10,
                            paddingVertical: text === 'Catch!' ? 10 : 6,
                            backgroundColor: 'white',
                            borderRadius: 14,
                        },
                        styles.bubbleShadow,
                    ]}
                    pointerEvents="none"
                >
                    <Text
                        style={[
                            { color: 'black', fontWeight: 'bold' },
                            // Bigger text for "Catch!"
                            text === 'Catch!' && { fontSize: 24 }
                        ]}
                    >
                        {text}
                    </Text>
                </Animated.View>
            ))}
            {catchables.map(({ id, name, x, y, opacity, onCaught, stop }) => (
                <Animated.View
                    key={`catch-${id}`}
                    style={[
                        {
                            position: 'absolute',
                            transform: [{ translateX: x }, { translateY: y }],
                            opacity,
                        },
                    ]}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={(e) => {
                            // caught!
                            stop?.();
                            // tiny feedback: pop up a label from catch point
                            const cx = (x as any).__getValue?.() ?? 0;
                            const cy = (y as any).__getValue?.() ?? 0;
                            // (non-blocking visual)
                            // absolute touch point in REAL SCREEN SPACE
                            const tapX = e.nativeEvent.pageX;
                            const tapY = e.nativeEvent.pageY;
                            // feedback exactly at the touch point
                            spawnRisingLabel('caught it!', { x: tapX, y: tapY }, 70, 900, 300);
                            onCaught?.();
                        }}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >

                

                        <Image
                            source={resourceIcons[name]}
                            style={{ width: 58, height: 58 }}
                            contentFit="contain"
                            transition={0}
                        />
                    </TouchableOpacity>
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
