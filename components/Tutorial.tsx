// Tutorial.tsx
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    Animated,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { posthog } from '../utils/posthog';

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
    isOutroMode?: boolean;
    tutorialData?: {
        selectedStartingItem?: { resource: ResourceType, quantity: number, label: string };
        userReasoning?: string;
    } | null;
    onOutroComplete?: () => void;
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
// SLIDE CONFIGURATIONS
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
            placeholder: 'Type here',
        },
    },

    // Slide 9: Final slide before starting the game
    {
        type: 'final',
        content: 'To win, trade for a cow',
    },
];

const BASE_OUTRO_SLIDES: TutorialSlideConfig[] = [
    // Slide 0: Brief questionnaire intro
    {
        type: 'text',
        content: 'Time for a brief questionnaire',
    },

    // Slide 1: Item effectiveness selection
    {
        type: 'item-selection',
        content: 'Which of these items do you think was the most effective good for use in trading?',
        itemSelection: {
            items: [
                { resource: 'tools', quantity: 1, icon: require('../assets/Icons/Tools.png'), label: 'Tools' },
                { resource: 'salt', quantity: 1, icon: require('../assets/Icons/Salt.png'), label: 'Salt' },
                { resource: 'apples', quantity: 1, icon: require('../assets/Icons/apple.png'), label: 'Fruit' },
                { resource: 'pottery', quantity: 1, icon: require('../assets/Icons/pottery.png'), label: 'Pottery' },
                { resource: 'shells', quantity: 1, icon: require('../assets/Icons/shell.png'), label: 'Seashells' },
            ],
        },
    },

    // Final slide: Thanks
    {
        type: 'text',
        content: 'Thanks — all done',
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

export const Tutorial: React.FC<TutorialProps> = ({
    onComplete,
    flyingRef,
    inventoryRefs,
    isOutroMode = false,
    tutorialData,
    onOutroComplete
}) => {
    const { width } = useWindowDimensions();

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

    // Selection state for both tutorial and outro
    const [selectedStartingItem, setSelectedStartingItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [userReasoning, setUserReasoning] = useState<string>('');
    const [tempSelectedItem, setTempSelectedItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);

    // Outro-specific state
    const [outroSelectedBestItem, setOutroSelectedBestItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [outroComparisonTexts, setOutroComparisonTexts] = useState<string[]>([]);
    const [currentOutroTextInput, setCurrentOutroTextInput] = useState<string>('');

    // Position tracking for animations
    const [leftPanPosition, setLeftPanPosition] = useState<{ x: number; y: number } | null>(null);
    const [rightPanPosition, setRightPanPosition] = useState<{ x: number; y: number } | null>(null);
    const leftPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const rightPanPositionRef = useRef<{ x: number; y: number } | null>(null);
    const tradeIntroAnimatedRef = useRef(false);

    // Animation states
    const [showAnimatedContent, setShowAnimatedContent] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideTransitionAnim = useRef(new Animated.Value(1)).current;


    // ========================================================================
    // IMAGE PRELOADING
    // ========================================================================

    React.useEffect(() => {
        // Only preload images on mobile platforms (not web)
        if (Platform.OS !== 'web') {
            const imagesToPreload = [
                require('../assets/Icons/apple.png'),
                require('../assets/Icons/Salt.png'),
                require('../assets/Icons/Tools.png'),
                require('../assets/Icons/pottery.png'),
                require('../assets/Icons/shell.png'),
                require('../assets/Icons/cow.png'),
                require('../assets/Icons/brokenpottery.png'),
                require('../assets/npc_salt.png'),
                require('../assets/npc_apples.png'),
                require('../assets/npc_tools.png'),
                require('../assets/npc_pottery.png'),
                require('../assets/npc_shells.png'),
                require('../assets/npc_special.png'),
                require('../assets/Scale/scaleBeam.png'),
                require('../assets/Scale/scalePan.png'),
            ];

            // Prefetch all images
            imagesToPreload.forEach(image => {
                Image.prefetch(image);
            });
        }
    }, []);
    // ========================================================================
    // OUTRO SLIDE GENERATION
    // ========================================================================

    const generateOutroSlides = React.useCallback((): TutorialSlideConfig[] => {
        if (!isOutroMode) return BASE_OUTRO_SLIDES;

        const slides: TutorialSlideConfig[] = [];

        // Add intro slide
        slides.push(BASE_OUTRO_SLIDES[0]);

        // Add item selection slide
        slides.push(BASE_OUTRO_SLIDES[1]);

        // If user has selected the best item, generate comparison slides
        if (outroSelectedBestItem) {
            const allItems = [
                { resource: 'tools' as ResourceType, label: 'Tools', icon: require('../assets/Icons/Tools.png') },
                { resource: 'salt' as ResourceType, label: 'Salt', icon: require('../assets/Icons/Salt.png') },
                { resource: 'apples' as ResourceType, label: 'Fruit', icon: require('../assets/Icons/apple.png') },
                { resource: 'pottery' as ResourceType, label: 'Pottery', icon: require('../assets/Icons/pottery.png') },
                { resource: 'shells' as ResourceType, label: 'Seashells', icon: require('../assets/Icons/shell.png') },
            ];

            // Get the icon for the selected best item
            const selectedItemData = allItems.find(item => item.resource === outroSelectedBestItem.resource);

            // Get the 4 items that are NOT the selected best item
            const otherItems = allItems.filter(
                item => item.resource !== outroSelectedBestItem.resource
            );

            // Create comparison slides for each other item
            otherItems.forEach(item => {
                slides.push({
                    type: 'text-input',
                    textInput: {
                        prompt: `Explain briefly why was more useful than ?`,
                        placeholder: 'Type here',
                        // Store the icons in a custom property for rendering
                        comparisonIcons: {
                            selected: selectedItemData?.icon,
                            other: item.icon
                        }
                    } as any,
                });
            });
        }

        // Add final thanks slide
        slides.push(BASE_OUTRO_SLIDES[BASE_OUTRO_SLIDES.length - 1]);

        return slides;
    }, [isOutroMode, outroSelectedBestItem]);

    const slides = isOutroMode ? generateOutroSlides() : TUTORIAL_SLIDES;

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================

    const currentSlide = slides[currentSlideIndex];
    const isLastSlide = currentSlideIndex >= slides.length - 1;

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    const countWords = (text: string): number => {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    // ========================================================================
    // NAVIGATION UTILITIES
    // ========================================================================

    const nextSlide = () => {
        // Handle outro text input saving
        if (isOutroMode && currentSlide.type === 'text-input' && currentOutroTextInput.trim()) {
            setOutroComparisonTexts(prev => [...prev, currentOutroTextInput]);
            
            // Track outro comparison text
            const comparisonIcons = (currentSlide.textInput as any)?.comparisonIcons;
            if (comparisonIcons) {
                posthog?.capture?.('outro_comparison_text_submitted', {
                    text: currentOutroTextInput,
                    word_count: countWords(currentOutroTextInput),
                    comparison_index: outroComparisonTexts.length
                });
            }
            
            setCurrentOutroTextInput('');
        }

        if (isLastSlide) {
            if (isOutroMode) {
                // Bundle all user responses into a single event
                posthog?.capture?.('user_complete_session', {
                    // Tutorial data
                    tutorial_selected_item: tutorialData?.selectedStartingItem?.label || 'unknown',
                    tutorial_selected_resource: tutorialData?.selectedStartingItem?.resource || 'unknown',
                    tutorial_reasoning: tutorialData?.userReasoning || '',
                    
                    // Outro data
                    outro_best_item: outroSelectedBestItem?.label || 'unknown',
                    outro_best_resource: outroSelectedBestItem?.resource || 'unknown',
                    outro_comparisons: outroComparisonTexts,
                    outro_comparisons_count: outroComparisonTexts.length,
                    
                    // Metadata
                    session_complete: true,
                    timestamp: new Date().toISOString()
                });
                
                onOutroComplete?.();
            } else {
                // Only pass data if we have a selected item
                if (selectedStartingItem && userReasoning) {
                    onComplete({
                        selectedStartingItem: {
                            resource: selectedStartingItem.resource,
                            quantity: selectedStartingItem.quantity,
                            label: selectedStartingItem.label
                        },
                        userReasoning: userReasoning
                    });
                } else {
                    onComplete();
                }
            }
        } else {
            setCurrentSlideIndex(prev => prev + 1);

            // Update inventory for trade slides (tutorial only)
            if (!isOutroMode) {
                const nextSlideConfig = slides[currentSlideIndex + 1];
                if (nextSlideConfig?.tradeConfig?.startingInventory) {
                    setTutorialResources(nextSlideConfig.tradeConfig.startingInventory);
                }
            }
        }
    };

    const triggerSlideAnimation = () => {
        if (currentSlide.animatedContent && !showAnimatedContent) {
            setShowAnimatedContent(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }).start();
        } else {
            nextSlide();
        }
    };

    // ========================================================================
    // TRADE GAME LOGIC
    // ========================================================================

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

    const handleTutorialRemoveItem = (res: ResourceType) => {
        setTutorialPlayerOffer(prevOffer => {
            const currentCount = prevOffer[res] || 0;
            if (currentCount <= 0) return prevOffer;

            const newOffer = { ...prevOffer };
            newOffer[res] = currentCount - 1;
            if (newOffer[res] === 0) delete newOffer[res];

            setTutorialResources(prevResources => ({
                ...prevResources,
                [res]: (prevResources[res] || 0) + 1,
            }));

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
        const config = currentSlide.tradeConfig;
        if (!config) return false;

        const playerTotal = Object.entries(tutorialPlayerOffer).reduce((sum, [res, qty]) => {
            return sum + (config.values[res as ResourceType] || 0) * (qty || 0);
        }, 0);

        const npcTotal = config.values[config.trade.give] * config.trade.giveAmount;

        return playerTotal >= npcTotal;
    };

    const handleTutorialAccept = () => {
        if (!isTutorialTradePassable()) return;

        const config = currentSlide.tradeConfig;
        if (!config) return;

        setTutorialResources(prev => ({
            ...prev,
            [config.trade.give]: prev[config.trade.give] + config.trade.giveAmount,
        }));

        setTutorialPlayerOffer({});

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

    React.useEffect(() => {
        setShowAnimatedContent(false);
        fadeAnim.setValue(0);
    }, [currentSlideIndex]);

    React.useEffect(() => {
        const tradeSlides = [3, 5];
        const textSlides = [4];

        if (tradeSlides.includes(currentSlideIndex) || textSlides.includes(currentSlideIndex)) {
            slideTransitionAnim.setValue(1);
            const duration = textSlides.includes(currentSlideIndex) ? 600 : 800;

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

    const renderTextSlide = () => (
        <>
            <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
                <View style={{ maxWidth: 500, alignItems: 'center' }}>
                    <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                    {currentSlide.images && currentSlide.images.map((img, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                            <Image source={img.src} style={{ width: 40, height: 40, marginRight: 10 }} contentFit="contain" transition={0} />
                            <Text style={{ fontSize: 24, color: '#000', fontWeight: '600' }}>{img.text}</Text>
                        </View>
                    ))}

                    {showAnimatedContent && currentSlide.animatedContent && (
                        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginTop: 30 }}>
                            <Text style={[tutorialStyles.tutorialText, { marginBottom: 20 }]}>
                                {currentSlide.animatedContent.text}
                            </Text>
                            {currentSlide.animatedContent.images && currentSlide.animatedContent.images.map((img, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                                    <Image source={img.src} style={{ width: 40, height: 40, marginRight: 10 }} contentFit="contain" transition={0} />
                                    <Text style={{ fontSize: 24, color: '#000', fontWeight: '600' }}>{img.text}</Text>
                                </View>
                            ))}
                        </Animated.View>
                    )}

                    {currentSlide.preferences && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 40 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, color: '#000', fontWeight: '600', marginRight: 10 }}>likes</Text>
                                <Image source={currentSlide.preferences.likes} style={{ width: 40, height: 40 }} contentFit="contain" transition={0} />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, color: '#000', fontWeight: '600', marginRight: 10 }}>dislikes</Text>
                                {Array.isArray(currentSlide.preferences.dislikes) ? (
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        {currentSlide.preferences.dislikes.map((dislike, index) => (
                                            <Image key={index} source={dislike} style={{ width: 40, height: 40 }} contentFit="contain" transition={0} />
                                        ))}
                                    </View>
                                ) : (
                                    <Image source={currentSlide.preferences.dislikes} style={{ width: 40, height: 40 }} contentFit="contain" transition={0} />
                                )}
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            if (currentSlide.animatedContent && !showAnimatedContent) {
                                triggerSlideAnimation();
                            } else if (!isOutroMode && currentSlideIndex === 4) {
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
                        <Text style={tutorialStyles.continueButtonText}>
                            {isOutroMode ? (isLastSlide ? 'Finish' : 'Next') : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

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

    const renderComparisonSlide = () => {
        const renderChain = () => {
            if (!currentSlide.animatedContent?.chain) return null;

            return currentSlide.animatedContent.chain.map((item, index) => (
                <React.Fragment key={index}>
                    <Image
                        source={item}
                        style={{ width: 40, height: 40 }}
                        contentFit="contain" transition={0}
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

                    {currentSlide.comparison && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 30 }}>
                            <Image source={currentSlide.comparison.left} style={{ width: 50, height: 50 }} contentFit="contain" transition={0} />
                            <Text style={{ fontSize: 32, color: '#000', fontWeight: '600', marginHorizontal: 20 }}>&lt;</Text>
                            <Image source={currentSlide.comparison.right} style={{ width: 50, height: 50 }} contentFit="contain" transition={0} />
                        </View>
                    )}

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

                    <TouchableOpacity
                        onPress={() => {
                            if (currentSlide.animatedContent && !showAnimatedContent) {
                                triggerSlideAnimation();
                            } else {
                                nextSlide();
                            }
                        }}
                        style={tutorialStyles.continueButton}
                    >
                        <Text style={tutorialStyles.continueButtonText}>
                            Continue
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderTradeSlide = () => (
        <>
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

            {width > MAX_PHONE_WIDTH && (
                <>
                    <View style={[styles.wallSide, { width: 600, left: (width - TOTAL_SCENE_WIDTH) / 2 - 600 }]} />
                    <View style={[styles.wallSide, { width: 600, left: (width + TOTAL_SCENE_WIDTH) / 2 }]} />
                </>
            )}

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
                    hideNumbers={true}
                    hideDecline={true}
                    tutorialText={config.instructionText}
                />
            </View>
        );
    };

    const renderItemSelectionSlide = () => {
        const handleSelection = () => {
            if (!tempSelectedItem) return;

            if (isOutroMode) {
                setOutroSelectedBestItem(tempSelectedItem);
                setTempSelectedItem(null);
                
                // Track outro best item selection
                posthog?.capture?.('outro_best_item_selected', {
                    selected_item: tempSelectedItem.label,
                    selected_resource: tempSelectedItem.resource
                });
            } else {
                setSelectedStartingItem(tempSelectedItem);
                
                // Track tutorial starting item selection
                posthog?.capture?.('tutorial_starting_item_selected', {
                    selected_item: tempSelectedItem.label,
                    selected_resource: tempSelectedItem.resource,
                    quantity: tempSelectedItem.quantity
                });
            }
            nextSlide();
        };

        return (
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
                                            contentFit="contain" transition={0}
                                        />
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: isSelected ? '700' : '600',
                                            color: '#000',
                                            textAlign: 'center'
                                        }}>
                                            {item.label}
                                        </Text>
                                        {!isOutroMode && (
                                            <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                x {item.quantity}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={handleSelection}
                        disabled={!tempSelectedItem}
                        style={{
                            backgroundColor: tempSelectedItem ? (isOutroMode ? '#ff9500' : '#28a745') : '#ccc',
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
                            {isOutroMode ? 'Next' : 'Barter!'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderTextInputSlide = () => {
        if (isOutroMode) {
            const wordCount = countWords(currentOutroTextInput);
            const isValidInput = wordCount >= 3;
            const comparisonIcons = (currentSlide.textInput as any)?.comparisonIcons;

            return (
                <KeyboardAvoidingView
                    style={tutorialStyles.tutorialSlide}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    pointerEvents="auto"
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={{ maxWidth: 500, alignItems: 'center', paddingVertical: 20 }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 20
                            }}>
                                <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>
                                    Explain briefly why
                                </Text>
                                {comparisonIcons?.selected && (
                                    <Image
                                        source={comparisonIcons.selected}
                                        style={{
                                            width: 30,
                                            height: 30,
                                            marginLeft: 8,
                                            marginRight: 8,
                                            marginBottom: -4
                                        }}
                                        contentFit="contain" transition={0}
                                    />
                                )}
                                <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>
                                    was more useful than
                                </Text>
                                {comparisonIcons?.other && (
                                    <Image
                                        source={comparisonIcons.other}
                                        style={{
                                            width: 30,
                                            height: 30,
                                            marginLeft: 8,
                                            marginRight: 8,
                                            marginBottom: -4
                                        }}
                                        contentFit="contain" transition={0}
                                    />
                                )}
                                <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>?</Text>
                            </View>

                            <View style={{
                                width: '100%',
                                maxWidth: 400,
                                marginVertical: 20,
                                padding: 15,
                                backgroundColor: '#f8f9fa',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#e9ecef',
                                height: 120,
                            }}>
                                <TextInput
                                    style={{
                                        flex: 1,
                                        fontSize: 14,
                                        color: '#333',
                                        textAlignVertical: 'top',
                                    }}
                                    placeholder="Type here"
                                    placeholderTextColor="#999"
                                    value={currentOutroTextInput}
                                    onChangeText={setCurrentOutroTextInput}
                                    multiline={true}
                                    numberOfLines={4}
                                />
                            </View>

                            <Text style={{
                                fontSize: 12,
                                color: isValidInput ? '#28a745' : '#dc3545',
                                marginBottom: 15
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
                                        opacity: isValidInput ? 1 : 0.6,
                                        marginTop: 10
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
                    </ScrollView>
                </KeyboardAvoidingView>
            );
        }

        // Tutorial text input
        const itemSelectionSlide = TUTORIAL_SLIDES.find(slide => slide.type === 'item-selection');
        const selectedItemIcon = itemSelectionSlide?.itemSelection?.items.find(
            item => item.resource === selectedStartingItem?.resource
        )?.icon;

        const wordCount = countWords(userReasoning);
        const isValidInput = wordCount >= 3;

        return (
            <KeyboardAvoidingView
                style={tutorialStyles.tutorialSlide}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                pointerEvents="auto"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ maxWidth: 500, alignItems: 'center', paddingVertical: 20 }}>
                        {selectedStartingItem && selectedItemIcon && (
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <Image
                                    source={selectedItemIcon}
                                    style={{ width: 60, height: 60, marginBottom: 10 }}
                                    contentFit="contain" transition={0}
                                />
                            </View>
                        )}

                        <Text style={[tutorialStyles.tutorialText, { marginBottom: 20 }]}>
                            {currentSlide.textInput?.prompt.replace('[SELECTED_ITEM]', selectedStartingItem?.label || 'your choice')}
                        </Text>

                        <View style={{
                            width: '100%',
                            maxWidth: 400,
                            marginVertical: 20,
                            padding: 15,
                            backgroundColor: '#f8f9fa',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#e9ecef',
                            height: 120,
                        }}>
                            <TextInput
                                style={{
                                    flex: 1,
                                    fontSize: 14,
                                    color: '#333',
                                    textAlignVertical: 'top',
                                }}
                                placeholder="Type here"
                                placeholderTextColor="#999"
                                value={userReasoning}
                                onChangeText={setUserReasoning}
                                multiline={true}
                                numberOfLines={4}
                            />
                        </View>

                        <Text style={{
                            fontSize: 12,
                            color: isValidInput ? '#28a745' : '#dc3545',
                            marginBottom: 15
                        }}>
                            {wordCount}/3 words minimum
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                if (isValidInput) {
                                    // Track tutorial reasoning text
                                    posthog?.capture?.('tutorial_reasoning_submitted', {
                                        selected_item: selectedStartingItem?.label,
                                        selected_resource: selectedStartingItem?.resource,
                                        reasoning_text: userReasoning,
                                        word_count: wordCount
                                    });
                                    nextSlide();
                                }
                            }}
                            disabled={!isValidInput}
                            style={[
                                tutorialStyles.continueButton,
                                {
                                    backgroundColor: isValidInput ? '#ff9500' : '#ccc',
                                    opacity: isValidInput ? 1 : 0.6,
                                    marginTop: 10
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
                </ScrollView>
            </KeyboardAvoidingView>
        );
    };

    const renderFinalSlide = () => (
        <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
            <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                <Text style={tutorialStyles.tutorialText}>{currentSlide.content}</Text>

                <TouchableOpacity
                    onPress={() => {
                        if (isOutroMode) {
                            // Bundle all user responses into a single event
                            posthog?.capture?.('user_complete_session', {
                                // Tutorial data
                                tutorial_selected_item: tutorialData?.selectedStartingItem?.label || 'unknown',
                                tutorial_selected_resource: tutorialData?.selectedStartingItem?.resource || 'unknown',
                                tutorial_reasoning: tutorialData?.userReasoning || '',
                                
                                // Outro data
                                outro_best_item: outroSelectedBestItem?.label || 'unknown',
                                outro_best_resource: outroSelectedBestItem?.resource || 'unknown',
                                outro_comparisons: outroComparisonTexts,
                                outro_comparisons_count: outroComparisonTexts.length,
                                
                                // Metadata
                                session_complete: true,
                                timestamp: new Date().toISOString()
                            });
                            
                            onOutroComplete?.();
                        } else {
                            if (selectedStartingItem) {
                                onComplete({
                                    selectedStartingItem,
                                    userReasoning
                                });
                            } else {
                                onComplete();
                            }
                        }
                    }}
                    style={[tutorialStyles.continueButton, { backgroundColor: isOutroMode ? '#ff9500' : '#28a745' }]}
                >
                    <Text style={tutorialStyles.continueButtonText}>
                        {isOutroMode ? 'Finish' : 'Start'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

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