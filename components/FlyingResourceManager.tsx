// components/FlyingResourceManager.tsx
import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Animated, Image, View, StyleSheet } from 'react-native';
import { ResourceType } from '../App';

const resourceIcons: Record<ResourceType, any> = {
    salt: require('../assets/Icons/Salt.png'),
    apples: require('../assets/Icons/apple.png'),
    tools: require('../assets/Icons/Tools.png'),
    pottery: require('../assets/Icons/pottery.png'),
    shells: require('../assets/Icons/shell.png'),
};

type FlyingResource = {
    id: number;
    name: ResourceType;
    anim: Animated.ValueXY;
    target: { x: number; y: number };
};

export type FlyingResourceManagerHandle = {
    fly: (name: ResourceType, start: { x: number; y: number }, end: { x: number; y: number }) => void;
};

export const FlyingResourceManager = forwardRef<FlyingResourceManagerHandle>((_, ref) => {
    const [flying, setFlying] = useState<FlyingResource[]>([]);
    const idRef = useRef(0);

    useImperativeHandle(ref, () => ({
        fly(name, start, end) {
            const id = idRef.current++;
            const anim = new Animated.ValueXY({ x: start.x, y: start.y });
            const target = { x: end.x, y: end.y };
            const newFlying = { id, name, anim, target };
            setFlying(prev => [...prev, newFlying]);

            Animated.timing(anim, {
                toValue: target,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                setFlying(prev => prev.filter(f => f.id !== id));
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
            {flying.map(({ id, name, anim }) => (
                <Animated.Image
                    key={id}
                    source={resourceIcons[name]}
                    style={[
                        {
                            position: 'absolute',
                            width: 60,
                            height: 60,
                            transform: anim.getTranslateTransform(),
                        },
                    ]}
                    resizeMode="contain"
                />
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
});
