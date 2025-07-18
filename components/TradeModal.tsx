import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TradeScale } from './TradeScale';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../normalize';
import { ResourceType } from '../App';

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
    onRemoveItem: (res: ResourceType) => void;
};

export const TradeModal = ({
    trade,
    playerOffer,
    unitValues,
    onAccept,
    onDecline,
    onRemoveItem,
}: Props) => {
    const npcValue = (unitValues[trade.give] || 0) * trade.giveAmount;
    const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
        return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
    }, 0);
    const hasEnough = playerTotal >= npcValue;

    return (
        <View style={styles.container} pointerEvents="auto">
            {/* Accept / Decline Buttons at top */}
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

            {/* Optional debug info in middle */}
            {/*
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.debugBlock}>
            <Text style={styles.debugText}>
              (Debug) Trader's Offer: {npcValue.toFixed(2)} pts
            </Text>
            <Text style={styles.debugText}>
              (Debug) Your Offer: {playerTotal.toFixed(2)} pts
            </Text>
          </View>
        </View>
        */}

            {/* Scale aligned to bottom */}
            <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
                <TradeScale
                    playerOffer={playerOffer}
                    npcOffer={{ resource: trade.give, amount: trade.giveAmount }}
                    unitValues={unitValues}
                    onRemoveItem={onRemoveItem}
                />
            </View>
        </View>
      
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT * 0.6,
        backgroundColor: 'white',
        borderRadius: 20,
        paddingTop: 100,
        paddingBottom: 120,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#ffffff',
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
    debugBlock: {
        marginTop: 20,
    },
    debugText: {
        fontSize: 16,
        color: '#444',
    },
});
