// Tutorial.tsx - Fixed version

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    useWindowDimensions,
} from 'react-native';
import { styles } from '../styles/styles';
import {
    TOTAL_SCENE_WIDTH,
    MAX_PHONE_WIDTH,
} from '../normalize';
import { ResourceDisplay } from './ResourceDisplay';
import { TradeModal } from './TradeModal';
import { FlyingResourceManagerHandle } from './FlyingResourceManager';

// Import ResourceType from your App file
export type ResourceType = 'salt' | 'apples' | 'tools' | 'pottery' | 'shells' | 'cow';

type Trade = {
    give: ResourceType;
    giveAmount: number;
    want: ResourceType;
    wantAmount: number;
};

type TutorialProps = {
    onComplete: () => void;
    flyingRef: React.RefObject<FlyingResourceManagerHandle | null>;
    inventoryRefs: React.RefObject<Record<ResourceType, View | null>>;
};

export const Tutorial: React.FC<TutorialProps> = ({ onComplete, flyingRef, inventoryRefs }) => {
    const { width } = useWindowDimensions();
    const [tutorialScreen, setTutorialScreen] = useState(0);
    const [tutorialResources, setTutorialResources] = useState<Record<ResourceType, number>>({
        salt: 1,
        apples: 1,
        tools: 0,
        pottery: 1,
        shells: 1,
        cow: 0,
    });
    const [tutorialPlayerOffer, setTutorialPlayerOffer] = useState<Partial<Record<ResourceType, number>>>({});

    const [leftPanPosition, setLeftPanPosition] = useState<{ x: number; y: number } | null>(null);
    const [rightPanPosition, setRightPanPosition] = useState<{ x: number; y: number } | null>(null);
    const leftPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const rightPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const tradeIntroAnimatedRef = useRef(false);

    // Tutorial trade configurations
    const tutorialTrade1: Trade = {
        give: 'tools',
        giveAmount: 1,
        want: 'salt',
        wantAmount: 3,
    };

    const tutorialTrade2: Trade = {
        give: 'pottery',
        giveAmount: 1,
        want: 'apples',
        wantAmount: 2,
    };

    // Neutral values for first tutorial trade
    const tutorialNeutralValues: Record<ResourceType, number> = {
        salt: 10,
        apples: 10,
        tools: 30,
        pottery: 10,
        shells: 10,
        cow: 120,
    };

    // Values with preferences for second tutorial trade
    const tutorialPreferenceValues: Record<ResourceType, number> = {
        salt: 5,    // disliked
        apples: 20, // liked
        tools: 30,
        pottery: 15,
        shells: 8,  // disliked
        cow: 120,
    };

    const handleTutorialAddItem = (res: ResourceType) => {
        if (tutorialResources[res] <= 0) return;

        setTutorialResources(prev => ({
            ...prev,
            [res]: prev[res] - 1,
        }));

        setTutorialPlayerOffer(prev => ({
            ...prev,
            [res]: (prev[res] || 0) + 1,
        }));

        // Animate the item flying to the left pan
        if (inventoryRefs.current[res] && leftPanPosition) {
            inventoryRefs.current[res]?.measureInWindow((x: number, y: number, width: number, height: number) => {
                const start = { x: x + width / 2, y: y + height / 2 };
                const destination = { x: leftPanPosition.x - 20, y: leftPanPosition.y + 20 };
                flyingRef.current?.fly(res, start, destination);
            });
        }
    };

    const handleTutorialRemoveItem = (res: ResourceType) => {
        setTutorialPlayerOffer(prevOffer => {
            const currentCount = prevOffer[res] || 0;
            if (currentCount <= 0) return prevOffer;

            const newOffer = { ...prevOffer };
            newOffer[res] = currentCount - 1;
            if (newOffer[res] === 0) delete newOffer[res];

            // Return the resource
            setTutorialResources(prevResources => ({
                ...prevResources,
                [res]: (prevResources[res] || 0) + 1,
            }));

            // Animate return
            if (leftPanPosition && inventoryRefs.current[res]) {
                inventoryRefs.current[res]?.measureInWindow((x: number, y: number, width: number, height: number) => {
                    const start = { x: leftPanPosition.x, y: leftPanPosition.y };
                    const end = { x: x + width / 2, y: y + height / 2 };
                    flyingRef.current?.fly(res, start, end);
                });
            }

            return newOffer;
        });
    };

    const isTutorialTradePassable = () => {
        const currentTrade = tutorialScreen === 2 ? tutorialTrade1 : tutorialTrade2;
        const currentValues = tutorialScreen === 2 ? tutorialNeutralValues : tutorialPreferenceValues;

        const playerTotal = Object.entries(tutorialPlayerOffer).reduce((sum, [res, qty]) => {
            return sum + (currentValues[res as ResourceType] || 0) * (qty || 0);
        }, 0);

        const npcTotal = currentValues[currentTrade.give] * currentTrade.giveAmount;

        return playerTotal >= npcTotal;
    };

    const handleTutorialAccept = () => {
        if (!isTutorialTradePassable()) return;

        const currentTrade = tutorialScreen === 2 ? tutorialTrade1 : tutorialTrade2;

        // Add the received item to tutorial resources
        setTutorialResources(prev => ({
            ...prev,
            [currentTrade.give]: prev[currentTrade.give] + currentTrade.giveAmount,
        }));

        // Animate item flying to inventory
        if (rightPanPosition && inventoryRefs.current[currentTrade.give]) {
            inventoryRefs.current[currentTrade.give]?.measureInWindow((x: number, y: number, width: number, height: number) => {
                const target = { x: x + width / 2 - 32, y: y + height / 2 - 27 };
                flyingRef.current?.fly(currentTrade.give, rightPanPosition, target);
            });
        }

        // Progress tutorial
        setTimeout(() => {
            if (tutorialScreen === 2) {
                // Reset for second trade
                setTutorialPlayerOffer({});
                setTutorialScreen(3);
            } else {
                // Exit tutorial
                onComplete();
            }
        }, 1000);
    };

    const renderTutorialWelcome = () => (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#ffffff',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
            }}
            pointerEvents="auto"
        >
            <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 48, fontWeight: '700', marginBottom: 40, color: '#000' }}>
                    Welcome
                </Text>

                <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 10, color: '#000' }}>
                    This challenge is designed to help you learn something:
                </Text>

                <Text style={{ fontSize: 20, color: '#ff9500', marginBottom: 60 }}>
                    Medium of Exchange
                </Text>

                <TouchableOpacity
                    onPress={() => setTutorialScreen(1)}
                    style={{
                        paddingVertical: 12,
                        paddingHorizontal: 32,
                        backgroundColor: '#ff9500',
                        borderRadius: 8,
                    }}
                >
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>
                        Tutorial
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTutorialIntroText = () => (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#ffffff',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 32,
            }}
            pointerEvents="auto"
        >
            <Text style={{
                fontSize: 20,
                textAlign: 'center',
                color: '#000',
                lineHeight: 30,
                maxWidth: 500,
            }}>
                It's easy to take for granted that everything has a set price.{'\n\n'}
                Before currency, every trade was a negotiation.
            </Text>

            <TouchableOpacity
                onPress={() => setTutorialScreen(2)}
                style={{
                    marginTop: 60,
                    paddingVertical: 12,
                    paddingHorizontal: 32,
                    backgroundColor: '#ff9500',
                    borderRadius: 8,
                }}
            >
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>
                    Continue
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderTutorialResourceSection = () => (
        <View style={styles.resourceSection}>
            {([['salt', 'apples'], ['tools', 'pottery', 'shells']] as ResourceType[][]).map((row, i) => (
                <View key={i} style={styles.resourceRow}>
                    {row.map((res: ResourceType) => {
                        if (res === 'cow') return null;

                        const currentTrade = tutorialScreen === 2 ? tutorialTrade1 : tutorialTrade2;
                        const isDisabled = tutorialResources[res] <= 0 || currentTrade.give === res;

                        return (
                            <TouchableOpacity
                                key={res}
                                disabled={isDisabled}
                                activeOpacity={0.7}
                                onPress={() => handleTutorialAddItem(res)}
                            >
                                <View
                                    ref={(ref) => {
                                        if (ref) inventoryRefs.current[res] = ref;
                                    }}
                                    collapsable={false}
                                    style={{
                                        alignItems: 'center',
                                        opacity: isDisabled ? 0.3 : 1,
                                    }}
                                >
                                    <ResourceDisplay
                                        name={res}
                                        amount={tutorialResources[res]}
                                    // Remove hideNumber prop until it's implemented in ResourceDisplay
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );

    const renderTutorialTradeOverlay = () => {
        const currentTrade = tutorialScreen === 2 ? tutorialTrade1 : tutorialTrade2;
        const currentValues = tutorialScreen === 2 ? tutorialNeutralValues : tutorialPreferenceValues;

        // Tutorial screen 2: no preferences, tutorial screen 3: fixed preferences
        const tutorialLikes: ResourceType[] = tutorialScreen === 3 ? ['apples'] : [];
        const tutorialDislikes: ResourceType[] = tutorialScreen === 3 ? ['shells'] : [];
        
        // Tutorial text for each screen
        const tutorialText = tutorialScreen === 2
            ? "Some items are seen as more valuable. Keep adding offers until the trader agrees."
            : "Value is subjective. Each trader judges items differently, and some items they simply don't need.";

        return (
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                pointerEvents="box-none"
            >
                <TradeModal
                    trade={currentTrade}
                    playerOffer={tutorialPlayerOffer}
                    unitValues={currentValues}
                    onAccept={handleTutorialAccept}
                    onDecline={() => {
                        const itemsToReturn = { ...tutorialPlayerOffer };
                        setTutorialPlayerOffer({});

                        setTutorialResources(prev => {
                            const updated = { ...prev };
                            Object.entries(itemsToReturn).forEach(([res, amount]) => {
                                if (amount) {
                                    updated[res as ResourceType] = (updated[res as ResourceType] || 0) + amount;
                                }
                            });
                            return updated;
                        });
                    }}
                    onRemoveItem={handleTutorialRemoveItem}
                    likes={tutorialLikes}
                    dislikes={tutorialDislikes}
                    onLeftPanMeasured={(pos) => { leftPanPositionRef.current = pos; setLeftPanPosition(pos); }}
                    onRightPanMeasured={(pos) => { rightPanPositionRef.current = pos; setRightPanPosition(pos); }}
                    introAnimatedRef={tradeIntroAnimatedRef}
                    // Tutorial-specific props
                    hideNumbers={true}
                    hideDecline={true}
                    tutorialText={tutorialText}
                />


            </View>
        );
    };

    // Wall width for wide screens
    const wallWidth = 600;

    if (tutorialScreen === 0) return renderTutorialWelcome();
    if (tutorialScreen === 1) return renderTutorialIntroText();

    return (
        <>
            {/* Tutorial Game Scene */}
            <View
                style={[
                    styles.container,
                    {
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        width: TOTAL_SCENE_WIDTH,
                        transform: [{ translateX: -TOTAL_SCENE_WIDTH / 2 }],
                    },
                ]}
            >
                {/* Empty NPC row for tutorial */}
                <View style={styles.npcRow} />
                <View style={styles.blackOverlayBox} />
                {renderTutorialResourceSection()}
                {renderTutorialTradeOverlay()}
            </View>

            {/* Walls for wide screens */}
            {width > MAX_PHONE_WIDTH && (
                <>
                    <View
                        style={[
                            styles.wallSide,
                            {
                                width: wallWidth,
                                left: (width - TOTAL_SCENE_WIDTH) / 2 - wallWidth,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.wallSide,
                            {
                                width: wallWidth,
                                left: (width + TOTAL_SCENE_WIDTH) / 2,
                            },
                        ]}
                    />
                </>
            )}
        </>
    );
};