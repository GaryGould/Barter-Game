import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
}: Props) => {
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
                    <Text style={styles.preferenceLabel}>Likes:</Text>
                    {likes.map((res) => (
                        <View key={res} style={styles.smallIconWrapper}>
                            <ResourceDisplay name={res} amount={0} showAmount={false} />
                        </View>
                    ))}
                </View>

                <View style={styles.preferenceRowItem}>
                    <Text style={styles.preferenceLabel}>Dislikes:</Text>
                    {dislikes.map((res) => (
                        <View key={res} style={styles.smallIconWrapper}>
                            <ResourceDisplay name={res} amount={0} showAmount={false} />
                        </View>
                    ))}
                </View>
            </View>

            {/* Accept / Decline Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, !hasEnough && styles.disabledButton]}
                    onPress={onAccept}
                    disabled={!hasEnough}
                >
                    <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={onDecline}>
                    <Text style={styles.buttonText}>Decline</Text>
                </TouchableOpacity>
            </View>

            {/* Scale */}
            <TradeScale
                playerOffer={playerOffer}
                npcOffer={{ resource: trade.give, amount: trade.giveAmount }}
                unitValues={unitValues}
                onRemoveItem={onRemoveItem}
            />
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
});
