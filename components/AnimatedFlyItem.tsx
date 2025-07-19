import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

type Props = {
    from: { x: number; y: number };
    to: { x: number; y: number };
    icon: any;
    onDone: () => void;
};

export const AnimatedFlyItem = ({ from, to, icon, onDone }: Props) => {
    const animX = useRef(new Animated.Value(from.x)).current;
    const animY = useRef(new Animated.Value(from.y)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(animX, {
                toValue: to.x,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(animY, {
                toValue: to.y,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(onDone);
    }, []);

    return (
        <Animated.Image
            source={icon}
            style={[
                styles.icon,
                {
                    transform: [
                        { translateX: animX },
                        { translateY: animY },
                    ],
                },
            ]}
            resizeMode="contain"
        />
    );
};

const styles = StyleSheet.create({
    icon: {
        width: 40,
        height: 40,
        position: 'absolute',
    },
});
