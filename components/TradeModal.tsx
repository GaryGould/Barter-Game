import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { TradeScale } from './TradeScale';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../normalize';
import { ResourceType } from '../App';
import { ResourceDisplay } from './ResourceDisplay';

type Trade = {
    give: ResourceType;
    giveAmount: number;
    want: ResourceType;
    wantAmount: number;
};

type Props = {
    trade: Trade;
    playerOffer: Partial<Record<ResourceType, number>>;
    unitValues: Record<ResourceType, number>;
    onAccept: () => void;
    onDecline: () => void;
    onRemoveItem: (resource: ResourceType) => void;
    likes: ResourceType[];
    dislikes: ResourceType[];
    onLeftPanMeasured?: (pos: { x: number; y: number }) => void;
    onRightPanMeasured?: (pos: { x: number; y: number }) => void;
    introAnimatedRef: React.RefObject<boolean>;

};

export const TradeModal = ({
  trade,
  playerOffer,
  unitValues,
  onAccept,
  onDecline,
  onRemoveItem,
  likes,
  dislikes,
  onLeftPanMeasured,
  onRightPanMeasured,
    introAnimatedRef,

}: Props) => {
    // Animation for labels ("Likes:" and "Dislikes:")
    const labelAnim = React.useRef(new Animated.Value(1)).current;
    // Animation for preference icons (resource images)
    const iconAnim = React.useRef(new Animated.Value(1)).current;


    React.useEffect(() => {
        const isFirstTime = !introAnimatedRef.current;
        introAnimatedRef.current = true;

        // First-time values are more exaggerated
        const labelScale = isFirstTime ? 1.7 : 1.5;
        const iconScale = isFirstTime ? 1.7 : 1.5;
        const startDelay = isFirstTime ? 500 : 50;

        // Label grow/shrink
        const labelSequence = Animated.sequence([
            Animated.timing(labelAnim, {
                toValue: labelScale,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(labelAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]);

        // Icon grow/shrink (starts after 125ms)
        const iconSequence = Animated.sequence([
            Animated.delay(125),
            Animated.timing(iconAnim, {
                toValue: iconScale,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(iconAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]);

        // Run both sequences in parallel, after a short initial delay
        Animated.sequence([
            Animated.delay(startDelay), // delay before starting
            Animated.parallel([labelSequence, iconSequence]),
        ]).start();
    }, []);
    
      
      
    const npcValue = (unitValues[trade.give] || 0) * trade.giveAmount;
    const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
        return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
    }, 0);
    const hasEnough = playerTotal >= npcValue;

    // Debug display of trade point values (off to the left side)
    const DebugTradeValues = () => (
        <View style={{
            position: 'absolute',
            top: 20,
            left: -300, // outside virtual width
            zIndex: 1000,
        }}>
            <Text style={{ color: 'white', fontSize: 14 }}>
                (Debug) Trader's Offer: {npcValue.toFixed(2)} pts
            </Text>
            <Text style={{ color: 'white', fontSize: 14 }}>
                (Debug) Your Offer: {playerTotal.toFixed(2)} pts
            </Text>
        </View>
    );
    

    return (
        <View style={styles.container} pointerEvents="auto">
            {/* Likes and Dislikes */}
            <View style={styles.preferencesRow}>
                <View style={styles.preferenceRowItem}>
                    <Animated.Text style={[styles.preferenceLabel, { transform: [{ scale: labelAnim }] }]}>
                        Likes:
                    </Animated.Text>
                        {likes.map((res) => (
                        <Animated.View
                            key={`like-${res}`}
                                style={{ transform: [{ scale: iconAnim }] }}
                            >
                            <View style={styles.smallIconWrapper}>
                                <ResourceDisplay name={res} amount={0} showAmount={false} />
                            </View>
                        </Animated.View>
                    ))}
  
                </View>

                <View style={styles.preferenceRowItem}>
                    <Animated.Text style={[styles.preferenceLabel, { transform: [{ scale: labelAnim }] }]}>
                        Dislikes:
                    </Animated.Text>
                        {dislikes.map((res) => (
                        <Animated.View
                            key={`dislike-${res}`}
                                style={{ transform: [{ scale: iconAnim }] }}
                            >
                            <View style={styles.smallIconWrapper}>
                                <ResourceDisplay name={res} amount={0} showAmount={false} />
                            </View>
                        </Animated.View>
                    ))}
  
                </View>
            </View>

            {/* Accept / Decline Buttons with checkmark */}
            <View style={[styles.buttonRow, { zIndex: 999 }]}>
                <TouchableOpacity
                    style={[styles.fullButtonWrapper, !hasEnough && styles.disabledButton]}
                    onPress={onAccept}
                    disabled={!hasEnough}
                >
                    <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <View pointerEvents="none">
                    <Image
                        source={require('../assets/Icons/checkmark.png')}
                        style={[
                            styles.checkmarkIcon,
                            { opacity: hasEnough ? 1 : 0 },
                        ]}
                    />
                </View>



                <TouchableOpacity
                    style={styles.fullButtonWrapper}
                    onPress={onDecline}
                >
                    <Text style={styles.buttonText}>Decline</Text>
                </TouchableOpacity>
            </View>

            {/* Scale */}
            <TradeScale
                playerOffer={playerOffer}
                npcOffer={{ resource: trade.give, amount: trade.giveAmount }}
                unitValues={unitValues}
                onRemoveItem={onRemoveItem}
                onLeftPanMeasured={onLeftPanMeasured}
                onRightPanMeasured={onRightPanMeasured}
            />

            {/* Debug Values */}
            {trade && (
                <View
                    style={{
                        position: 'absolute',
                        left: -300,
                        top: 0,
                        zIndex: 1000,
                        padding: 10,
                    }}
                    pointerEvents="none"
                >
                    <Text style={{ color: 'white', fontSize: 16 }}>
                        (Debug) Trader's Offer: {(trade.giveAmount * (unitValues[trade.give] || 0)).toFixed(2)} pts
                    </Text>
                    <Text style={{ color: 'white', fontSize: 16 }}>
                        (Debug) Your Offer:{' '}
                        {Object.entries(playerOffer).reduce((total, [key, amount]) => {
                            return total + (unitValues[key as ResourceType] || 0) * (amount || 0);
                        }, 0).toFixed(2)} pts
                    </Text>
                </View>
            )}
        </View>
    );
      
};      

const styles = StyleSheet.create({
    container: {
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT * 0.6,
        backgroundColor: 'white',
        borderRadius: 20,
        paddingTop: 0,
        paddingBottom: 80,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    preferencesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 16,
    },
    preferenceColumn: {
        flex: 1,
        alignItems: 'center',
    },
    preferenceLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    iconRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginHorizontal: 8,
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    smallIconWrapper: {
        transform: [{ scale: 0.5 }],
        marginHorizontal: -4,
    },
    preferenceRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    fullButtonWrapper: {
        backgroundColor: '#eee',
        borderWidth: 2,
        borderColor: '#000',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginHorizontal: 15,
    },
    checkmarkIcon: {
        width: 36,
        height: 28,
        alignSelf: 'center',
        marginHorizontal: 3,
      },
});
