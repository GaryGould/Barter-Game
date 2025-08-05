// Tutorial.tsx 
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    Image,
    Animated,
    TextInput,
} from 'react-native';
import { styles } from '../styles/styles';
import {
    TOTAL_SCENE_WIDTH,
    MAX_PHONE_WIDTH,
} from '../normalize';
import { ResourceDisplay } from './ResourceDisplay';
import { TradeModal } from './TradeModal';
import { FlyingResourceManagerHandle } from './FlyingResourceManager';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ResourceType = 'salt' | 'apples' | 'tools' | 'pottery' | 'shells' | 'cow';

type Trade = {
    give: ResourceType;
    giveAmount: number;
    want: ResourceType;
    wantAmount: number;
};

type TutorialProps = {
    onComplete: (data?: {
        selectedStartingItem?: { resource: ResourceType, quantity: number, label: string };
        userReasoning?: string;
    }) => void;
    flyingRef: React.RefObject<FlyingResourceManagerHandle | null>;
    inventoryRefs: React.RefObject<Record<ResourceType, View | null>>;
};

type TutorialSlideConfig = {
    type: 'welcome' | 'text' | 'comparison' | 'trade' | 'item-selection' | 'text-input' | 'final';
    title?: string;
    content?: string;
    images?: Array<{ src: any; text?: string }>;
    comparison?: { left: any; right: any };
    animatedContent?: {
        text: string;
        chain?: any[];
        images?: Array<{ src: any; text?: string }>;
    };
    preferences?: {
        likes: any;
        dislikes: any | any[];
    };
    tradeConfig?: {
        trade: Trade;
        values: Record<ResourceType, number>;
        startingInventory: Record<ResourceType, number>;
        likes: ResourceType[];
        dislikes: ResourceType[];
        instructionText: string;
    };
    itemSelection?: {
        items: Array<{
            resource: ResourceType;
            quantity: number;
            icon: any;
            label: string;
        }>;
    };
    textInput?: {
        prompt: string;
        placeholder: string;
    };
};

// ============================================================================
// TUTORIAL CONFIGURATION
// ============================================================================

const TUTORIAL_SLIDES: TutorialSlideConfig[] = [
    // Slide 0: Welcome screen
    {
        type: 'welcome',
        title: 'Welcome',
        content: 'Time for a challenge:\n\nMedium of Exchange',
    },

    // Slide 1: Introduction to pricing with animation
    {
        type: 'text',
        content: 'Money makes buying goods simple and precise.',
        images: [
            { src: require('../assets/Icons/apple.png'), text: '= $1' }
        ],
        animatedContent: {
            text: 'But before money, every trade was a negotiation.',
            images: [
                { src: require('../assets/Icons/apple.png'), text: '= ?' }
            ]
        },
    },

    // Slide 2: Value comparison demonstration
    {
        type: 'comparison',
        content: 'an item\'s value may seem obvious at first',
        comparison: {
            left: require('../assets/Icons/apple.png'),
            right: require('../assets/Icons/Tools.png'),
        },
        animatedContent: {
            text: 'But things can quickly get complicated',
            chain: [
                require('../assets/Icons/Salt.png'),
                require('../assets/Icons/apple.png'),
                require('../assets/Icons/shell.png'),
                require('../assets/Icons/pottery.png'),
            ],
        },
    },

    // Slide 3: First trading experience (neutral values)
    {
        type: 'trade',
        tradeConfig: {
            trade: { give: 'tools', giveAmount: 1, want: 'salt', wantAmount: 3 },
            values: { salt: 1, apples: 5, tools: 25.5, pottery: 20, shells: 10, cow: 120 },
            startingInventory: { salt: 1, apples: 1, tools: 0, pottery: 1, shells: 1, cow: 0 },
            likes: [],
            dislikes: [],
            instructionText: 'Keep adding offers until the trader agrees',
        },
    },

    // Slide 4: Explaining subjective value
    {
        type: 'text',
        content: 'To make things worse, value is subjective',
        preferences: {
            likes: require('../assets/Icons/apple.png'),
            dislikes: [require('../assets/Icons/shell.png'), require('../assets/Icons/pottery.png')]
        },
    },

    // Slide 5: Second trading experience (with trader preferences)
    {
        type: 'trade',
        tradeConfig: {
            trade: { give: 'tools', giveAmount: 1, want: 'apples', wantAmount: 2 },
            values: { salt: 1, apples: 20, tools: 21, pottery: 5, shells: 2, cow: 120 },
            startingInventory: { salt: 0, apples: 1, tools: 0, pottery: 1, shells: 1, cow: 0 },
            likes: ['apples'],
            dislikes: ['shells', 'pottery'],
            instructionText: '',
        },
    },

    // Slide 6: Transition to master trader
    {
        type: 'text',
        content: 'Let\'s see if you can become a master trader',
    },

    // Slide 7: Item selection for starting the real game
    {
        type: 'item-selection',
        content: 'Which of these goods do you think would be the ideal item for trading?\n\nChoose carefully!',
        itemSelection: {
            items: [
                { resource: 'tools', quantity: 1, icon: require('../assets/Icons/Tools.png'), label: 'Tools' },
                { resource: 'salt', quantity: 25, icon: require('../assets/Icons/Salt.png'), label: 'Salt' },
                { resource: 'apples', quantity: 6, icon: require('../assets/Icons/apple.png'), label: 'Fruit' },
                { resource: 'pottery', quantity: 2, icon: require('../assets/Icons/pottery.png'), label: 'Pottery' },
                { resource: 'shells', quantity: 3, icon: require('../assets/Icons/shell.png'), label: 'Seashells' },
            ],
        },
    },

    // Slide 8: Text input for reasoning
    {
        type: 'text-input',
        textInput: {
            prompt: 'Explain briefly why you think [SELECTED_ITEM] will make the effective trade good?',
            placeholder: 'user text goes here',
        },
    },

    // Slide 9: Final slide before starting the game
    {
        type: 'final',
        content: 'Thanks — let\'s see how your view evolves after the activity',
    },
];

// ============================================================================
// STYLES
// ============================================================================

const tutorialStyles = {
    tutorialSlide: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 32,
    },
    tutorialTitle: {
        fontSize: 48,
        fontWeight: '700' as const,
        marginBottom: 40,
        color: '#000',
    },
    tutorialSubtext: {
        fontSize: 18,
        textAlign: 'center' as const,
        marginBottom: 10,
        color: '#000',
    },
    tutorialText: {
        fontSize: 20,
        textAlign: 'center' as const,
        color: '#000',
        lineHeight: 30,
        marginBottom: 20,
    },
    continueButton: {
        marginTop: 60,
        paddingVertical: 12,
        paddingHorizontal: 32,
        backgroundColor: '#ff9500',
        borderRadius: 8,
    },
    continueButtonText: {
        color: '#ffffff',
        fontWeight: '700' as const,
        fontSize: 16,
    },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Tutorial: React.FC<TutorialProps> = ({ onComplete, flyingRef, inventoryRefs }) => {
    const { width } = useWindowDimensions();

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Counts the number of words in a text string
     */
    const countWords = (text: string): number => {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    // Navigation state
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // Tutorial game state
    const [tutorialResources, setTutorialResources] = useState<Record<ResourceType, number>>({
        salt: 1,
        apples: 1,
        tools: 0,
        pottery: 1,
        shells: 1,
        cow: 0,
    });
    const [tutorialPlayerOffer, setTutorialPlayerOffer] = useState<Partial<Record<ResourceType, number>>>({});

    // Post-tutorial selection state
    const [selectedStartingItem, setSelectedStartingItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [userReasoning, setUserReasoning] = useState<string>('');
    const [tempSelectedItem, setTempSelectedItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);

    // Position tracking for animations
    const [leftPanPosition, setLeftPanPosition] = useState<{ x: number; y: number } | null>(null);
    const [rightPanPosition, setRightPanPosition] = useState<{ x: number; y: number } | null>(null);
    const leftPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const rightPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const tradeIntroAnimatedRef = useRef(false);

    // Animation states
    const [showAnimatedContent, setShowAnimatedContent] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideTransitionAnim = useRef(new Animated.Value(1)).current; // Start with white overlay

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================

    const currentSlide = TUTORIAL_SLIDES[currentSlideIndex];
    const isLastSlide = currentSlideIndex >= TUTORIAL_SLIDES.length - 1;

    // ========================================================================
    // NAVIGATION UTILITIES
    // ========================================================================

    /**
     * Advances to the next slide or completes the tutorial
     */
    const nextSlide = () => {
        if (isLastSlide) {
            onComplete();
        } else {
            setCurrentSlideIndex(prev => prev + 1);

            // Update inventory for slides that specify starting inventory
            const nextSlideConfig = TUTORIAL_SLIDES[currentSlideIndex + 1];
            if (nextSlideConfig?.tradeConfig?.startingInventory) {
                setTutorialResources(nextSlideConfig.tradeConfig.startingInventory);
            }
        }
    };

    /**
     * Triggers animated content for slides that support it
     */
    const triggerSlideAnimation = () => {
        if (currentSlide.animatedContent && !showAnimatedContent) {
            setShowAnimatedContent(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }).start();
        } else {
            // If animation already shown, go to next slide
            nextSlide();
        }
    };

    // ========================================================================
    // TRADE GAME LOGIC
    // ========================================================================

    /**
     * Adds an item from inventory to the trade offer
     */
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
    };

    /**
     * Removes an item from the trade offer back to inventory
     */
    const handleTutorialRemoveItem = (res: ResourceType) => {
        setTutorialPlayerOffer(prevOffer => {
            const currentCount = prevOffer[res] || 0;
            if (currentCount <= 0) return prevOffer;

            const newOffer = { ...prevOffer };
            newOffer[res] = currentCount - 1;
            if (newOffer[res] === 0) delete newOffer[res];

            // Return the resource to inventory
            setTutorialResources(prevResources => ({
                ...prevResources,
                [res]: (prevResources[res] || 0) + 1,
            }));

            // Animate the return if positions are available
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

    /**
     * Determines if the current trade offer meets the NPC's requirements
     */
    const isTutorialTradePassable = () => {
        const config = currentSlide.tradeConfig;
        if (!config) return false;

        const playerTotal = Object.entries(tutorialPlayerOffer).reduce((sum, [res, qty]) => {
            return sum + (config.values[res as ResourceType] || 0) * (qty || 0);
        }, 0);

        const npcTotal = config.values[config.trade.give] * config.trade.giveAmount;

        return playerTotal >= npcTotal;
    };

    /**
     * Handles accepting a trade and completing the transaction
     */
    const handleTutorialAccept = () => {
        if (!isTutorialTradePassable()) return;

        const config = currentSlide.tradeConfig;
        if (!config) return;

        // Add the received item to tutorial resources
        setTutorialResources(prev => ({
            ...prev,
            [config.trade.give]: prev[config.trade.give] + config.trade.giveAmount,
        }));

        // Clear offers
        setTutorialPlayerOffer({});

        // Handle special fade transitions for trade completion
        if (currentSlideIndex === 3 || currentSlideIndex === 5) {
            Animated.timing(slideTransitionAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start(() => {
                nextSlide();
            });
        } else {
            nextSlide();
        }
    };

    // ========================================================================
    // ANIMATION EFFECTS
    // ========================================================================

    // Reset animation state when changing slides
    React.useEffect(() => {
        setShowAnimatedContent(false);
        fadeAnim.setValue(0);
    }, [currentSlideIndex]);

    // Handle fade transitions for specific slides
    React.useEffect(() => {
        const tradeSlides = [3, 5]; // Both trade slides
        const textSlides = [4]; // Subjective value text slide

        if (tradeSlides.includes(currentSlideIndex) || textSlides.includes(currentSlideIndex)) {
            slideTransitionAnim.setValue(1);
            const duration = textSlides.includes(currentSlideIndex) ? 600 : 800; // Shorter for text slides, longer for trade slides

            const timer = setTimeout(() => {
                Animated.timing(slideTransitionAnim, {
                    toValue: 0,
                    duration: duration,
                    useNativeDriver: true,
                }).start();
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [currentSlideIndex]);

    // ========================================================================
    // RENDER METHODS
    // ========================================================================

    /**
     * Renders the welcome slide with title and continue button
     */
    const renderWelcomeSlide = () => (
        <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
            <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                <Text style={tutorialStyles.tutorialTitle}>Welcome</Text>
                <Text style={tutorialStyles.tutorialSubtext}>
                    This challenge is designed to help you learn something:
                </Text>
                <Text style={{ fontSize: 20, color: '#ff9500', marginBottom: 60 }}>
                    Medium of Exchange
                </Text>
                <TouchableOpacity
                    onPress={nextSlide}
                    style={tutorialStyles.continueButton}
                >
                    <Text style={tutorialStyles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    /**
     * Renders text-based slides with optional images and animations
     */
    const renderTextSlide = () => (
        <>
            <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
                <View style={{ maxWidth: 500, alignItems: 'center' }}>
                    <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                    {/* Initial images */}
                    {currentSlide.images && currentSlide.images.map((img, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                            <Image source={img.src} style={{ width: 40, height: 40, marginRight: 10 }} resizeMode="contain" />
                            <Text style={{ fontSize: 24, color: '#000', fontWeight: '600' }}>{img.text}</Text>
                        </View>
                    ))}

                    {/* Animated content that appears on continue */}
                    {showAnimatedContent && currentSlide.animatedContent && (
                        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginTop: 30 }}>
                            <Text style={[tutorialStyles.tutorialText, { marginBottom: 20 }]}>
                                {currentSlide.animatedContent.text}
                            </Text>
                            {currentSlide.animatedContent.images && currentSlide.animatedContent.images.map((img, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                                    <Image source={img.src} style={{ width: 40, height: 40, marginRight: 10 }} resizeMode="contain" />
                                    <Text style={{ fontSize: 24, color: '#000', fontWeight: '600' }}>{img.text}</Text>
                                </View>
                            ))}
                        </Animated.View>
                    )}

                    {/* Trader preferences display */}
                    {currentSlide.preferences && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 40 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, color: '#000', fontWeight: '600', marginRight: 10 }}>likes</Text>
                                <Image source={currentSlide.preferences.likes} style={{ width: 40, height: 40 }} resizeMode="contain" />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, color: '#000', fontWeight: '600', marginRight: 10 }}>dislikes</Text>
                                {Array.isArray(currentSlide.preferences.dislikes) ? (
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        {currentSlide.preferences.dislikes.map((dislike, index) => (
                                            <Image key={index} source={dislike} style={{ width: 40, height: 40 }} resizeMode="contain" />
                                        ))}
                                    </View>
                                ) : (
                                    <Image source={currentSlide.preferences.dislikes} style={{ width: 40, height: 40 }} resizeMode="contain" />
                                )}
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            // Handle different slide types
                            if (currentSlide.animatedContent) {
                                triggerSlideAnimation();
                            } else if (currentSlideIndex === 4) { // Subjective value slide
                                Animated.timing(slideTransitionAnim, {
                                    toValue: 1,
                                    duration: 600,
                                    useNativeDriver: true,
                                }).start(() => {
                                    nextSlide();
                                });
                            } else {
                                nextSlide();
                            }
                        }}
                        style={tutorialStyles.continueButton}
                    >
                        <Text style={tutorialStyles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* White fade overlay for slide transitions */}
            {currentSlideIndex === 4 && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#ffffff',
                        opacity: slideTransitionAnim,
                        pointerEvents: 'none',
                        zIndex: 1000,
                    }}
                />
            )}
        </>
    );

    /**
     * Renders comparison slides with before/after animations
     */
    const renderComparisonSlide = () => {
        const renderChain = () => {
            if (!currentSlide.animatedContent?.chain) return null;

            return currentSlide.animatedContent.chain.map((item, index) => (
                <React.Fragment key={index}>
                    <Image
                        source={item}
                        style={{ width: 40, height: 40 }}
                        resizeMode="contain"
                    />
                    {currentSlide.animatedContent?.chain && index < currentSlide.animatedContent.chain.length - 1 && (
                        <Text style={{ fontSize: 24, color: '#000', fontWeight: '600', marginHorizontal: 10 }}>
                            &lt;
                        </Text>
                    )}
                </React.Fragment>
            ));
        };

        return (
            <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
                <View style={{ maxWidth: 500, alignItems: 'center' }}>
                    <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                    {/* Initial comparison */}
                    {currentSlide.comparison && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 30 }}>
                            <Image source={currentSlide.comparison.left} style={{ width: 50, height: 50 }} resizeMode="contain" />
                            <Text style={{ fontSize: 32, color: '#000', fontWeight: '600', marginHorizontal: 20 }}>&lt;</Text>
                            <Image source={currentSlide.comparison.right} style={{ width: 50, height: 50 }} resizeMode="contain" />
                        </View>
                    )}

                    {/* Animated complexity demonstration */}
                    {showAnimatedContent && currentSlide.animatedContent && (
                        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginTop: 20 }}>
                            <Text style={[tutorialStyles.tutorialText, { marginBottom: 20 }]}>
                                {currentSlide.animatedContent.text}
                            </Text>
                            {currentSlide.animatedContent.chain && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {renderChain()}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    <TouchableOpacity onPress={triggerSlideAnimation} style={tutorialStyles.continueButton}>
                        <Text style={tutorialStyles.continueButtonText}>
                            {showAnimatedContent ? 'Continue' : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    /**
     * Renders interactive trading slides with game mechanics
     */
    const renderTradeSlide = () => (
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
                <View style={styles.npcRow} />
                <View style={styles.blackOverlayBox} />
                {renderTutorialResourceSection()}
                {renderTutorialTradeOverlay()}
            </View>

            {/* Side walls for wide screens */}
            {width > MAX_PHONE_WIDTH && (
                <>
                    <View style={[styles.wallSide, { width: 600, left: (width - TOTAL_SCENE_WIDTH) / 2 - 600 }]} />
                    <View style={[styles.wallSide, { width: 600, left: (width + TOTAL_SCENE_WIDTH) / 2 }]} />
                </>
            )}

            {/* White fade overlay for trade slide transitions */}
            {(currentSlideIndex === 3 || currentSlideIndex === 5) && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#ffffff',
                        opacity: slideTransitionAnim,
                        pointerEvents: 'none',
                        zIndex: 1000,
                    }}
                />
            )}
        </>
    );

    /**
     * Renders the resource inventory section for trading
     */
    const renderTutorialResourceSection = () => (
        <View style={styles.resourceSection}>
            {([['salt', 'apples'], ['tools', 'pottery', 'shells']] as ResourceType[][]).map((row, i) => (
                <View key={i} style={styles.resourceRow}>
                    {row.map((res: ResourceType) => {
                        if (res === 'cow') return null;

                        const config = currentSlide.tradeConfig;
                        const isDisabled = tutorialResources[res] <= 0 || config?.trade.give === res;

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
                                        showAmount={false}
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );

    /**
     * Renders the trade modal overlay for tutorial interactions
     */
    const renderTutorialTradeOverlay = () => {
        const config = currentSlide.tradeConfig;
        if (!config) return null;

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
                    trade={config.trade}
                    playerOffer={tutorialPlayerOffer}
                    unitValues={config.values}
                    onAccept={handleTutorialAccept}
                    onDecline={() => {
                        // Return all offered items to inventory
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
                    likes={config.likes}
                    dislikes={config.dislikes}
                    onLeftPanMeasured={(pos) => { leftPanPositionRef.current = pos; setLeftPanPosition(pos); }}
                    onRightPanMeasured={(pos) => { rightPanPositionRef.current = pos; setRightPanPosition(pos); }}
                    introAnimatedRef={tradeIntroAnimatedRef}
                    // Tutorial-specific configurations
                    hideNumbers={true}
                    hideDecline={true}
                    tutorialText={config.instructionText}
                />
            </View>
        );
    };

    /**
     * Renders the item selection slide where users choose their starting resource
     */
    const renderItemSelectionSlide = () => (
        <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
            <View style={{ maxWidth: 600, alignItems: 'center' }}>
                <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                {currentSlide.itemSelection && (
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: 20,
                        marginVertical: 30,
                        maxWidth: 400
                    }}>
                        {currentSlide.itemSelection.items.map((item, index) => {
                            const isSelected = tempSelectedItem?.resource === item.resource;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => {
                                        setTempSelectedItem({
                                            resource: item.resource,
                                            quantity: item.quantity,
                                            label: item.label
                                        });
                                    }}
                                    style={{
                                        alignItems: 'center',
                                        padding: 15,
                                        borderRadius: 8,
                                        backgroundColor: isSelected ? '#fff3cd' : '#f8f9fa',
                                        borderWidth: 2,
                                        borderColor: isSelected ? '#ff9500' : '#e9ecef',
                                        minWidth: 100,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Image
                                        source={item.icon}
                                        style={{ width: 50, height: 50, marginBottom: 8 }}
                                        resizeMode="contain"
                                    />
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: isSelected ? '700' : '600',
                                        color: '#000',
                                        textAlign: 'center'
                                    }}>
                                        {item.label}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                        x {item.quantity}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Barter Button */}
                <TouchableOpacity
                    onPress={() => {
                        if (tempSelectedItem) {
                            setSelectedStartingItem(tempSelectedItem);
                            nextSlide();
                        }
                    }}
                    disabled={!tempSelectedItem}
                    style={{
                        backgroundColor: tempSelectedItem ? '#28a745' : '#ccc',
                        paddingVertical: 12,
                        paddingHorizontal: 32,
                        borderRadius: 8,
                        marginTop: 20,
                    }}
                >
                    <Text style={{
                        color: tempSelectedItem ? '#ffffff' : '#999',
                        fontWeight: '700',
                        fontSize: 16,
                    }}>
                        Barter!
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    /**
     * Renders the text input slide for user reasoning
     */
    const renderTextInputSlide = () => {
        // Find the icon for the selected item from the item selection slide
        const itemSelectionSlide = TUTORIAL_SLIDES.find(slide => slide.type === 'item-selection');
        const selectedItemIcon = itemSelectionSlide?.itemSelection?.items.find(
            item => item.resource === selectedStartingItem?.resource
        )?.icon;

        const wordCount = countWords(userReasoning);
        const isValidInput = wordCount >= 3;

        return (
            <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
                <View style={{ maxWidth: 500, alignItems: 'center' }}>
                    {selectedStartingItem && selectedItemIcon && (
                        <View style={{ alignItems: 'center', marginBottom: 30 }}>
                            <Image
                                source={selectedItemIcon}
                                style={{ width: 80, height: 80, marginBottom: 15 }}
                                resizeMode="contain"
                            />
                        </View>
                    )}

                    <Text style={tutorialStyles.tutorialText}>
                        {currentSlide.textInput?.prompt.replace('[SELECTED_ITEM]', selectedStartingItem?.label || 'your choice')}
                    </Text>

                    <View style={{
                        width: '100%',
                        maxWidth: 400,
                        marginVertical: 30,
                        padding: 15,
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#e9ecef',
                        minHeight: 100,
                    }}>
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 14,
                                color: '#333',
                                textAlignVertical: 'top',
                            }}
                            placeholder={currentSlide.textInput?.placeholder}
                            placeholderTextColor="#666"
                            value={userReasoning}
                            onChangeText={setUserReasoning}
                            multiline={true}
                            numberOfLines={4}
                        />
                    </View>

                    {/* Word count indicator */}
                    <Text style={{
                        fontSize: 12,
                        color: isValidInput ? '#28a745' : '#dc3545',
                        marginBottom: 20
                    }}>
                        {wordCount}/3 words minimum
                    </Text>

                    <TouchableOpacity
                        onPress={nextSlide}
                        disabled={!isValidInput}
                        style={[
                            tutorialStyles.continueButton,
                            {
                                backgroundColor: isValidInput ? '#ff9500' : '#ccc',
                                opacity: isValidInput ? 1 : 0.6
                            }
                        ]}
                    >
                        <Text style={[
                            tutorialStyles.continueButtonText,
                            { color: isValidInput ? '#ffffff' : '#999' }
                        ]}>
                            Continue
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    /**
     * Renders the final slide before starting the real game
     */
    const renderFinalSlide = () => (
        <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
            <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                <TouchableOpacity
                    onPress={() => {
                        // Pass the selected starting item and reasoning to the parent component
                        if (selectedStartingItem) {
                            onComplete({
                                selectedStartingItem,
                                userReasoning
                            });
                        } else {
                            onComplete();
                        }
                    }}
                    style={[tutorialStyles.continueButton, { backgroundColor: '#28a745' }]}
                >
                    <Text style={tutorialStyles.continueButtonText}>Start</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    /**
     * Main render method that determines which slide type to display
     */
    const renderCurrentSlide = () => {
        switch (currentSlide.type) {
            case 'welcome':
                return renderWelcomeSlide();
            case 'text':
                return renderTextSlide();
            case 'comparison':
                return renderComparisonSlide();
            case 'trade':
                return renderTradeSlide();
            case 'item-selection':
                return renderItemSelectionSlide();
            case 'text-input':
                return renderTextInputSlide();
            case 'final':
                return renderFinalSlide();
            default:
                return null;
        }
    };

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

    return renderCurrentSlide();
};