// Tutorial.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    Animated,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Linking
} from 'react-native';
import { Image } from 'expo-image';
import { posthog } from '../utils/posthog';
import { nextFrame, startFrameLoop } from '../utils/safeTimers';

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

export type TutorialProps = {
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
    startAtSlide?: number;
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
            likes: require('../assets/Icons/shell.png'),
            dislikes: [require('../assets/Icons/apple.png'), require('../assets/Icons/pottery.png')]
        },
    },

    // Slide 5: Second trading experience (with trader preferences)
    {
        type: 'trade',
        tradeConfig: {
            trade: { give: 'tools', giveAmount: 1, want: 'shells', wantAmount: 2 },
            values: { salt: 1, apples: 2, tools: 19, pottery: 5, shells: 20, cow: 120 },
            startingInventory: { salt: 0, apples: 1, tools: 0, pottery: 1, shells: 1, cow: 0 },
            likes: ['shells'],
            dislikes: ['apples', 'pottery'],
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
        content: 'Which of these goods do you think would be the ideal good to trade with?\n\nChoose carefully!',
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

export const Tutorial = ({
    onComplete,
    flyingRef,
    inventoryRefs,
    isOutroMode = false,
    tutorialData,
    onOutroComplete,
    startAtSlide = 0,
    prolificPid
}: TutorialProps) => {
    const { width } = useWindowDimensions();

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    // Navigation state
    const [currentSlideIndex, setCurrentSlideIndex] = useState(startAtSlide);
    const [isTransitioning, setIsTransitioning] = useState(false);

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
    
    // Keep a ref of current resources for the hold function to access
    const tutorialResourcesRef = useRef(tutorialResources);
    useEffect(() => {
        tutorialResourcesRef.current = tutorialResources;
    }, [tutorialResources]);
    
    // Press and hold for tutorial
    const tutorialHoldIntervalRef = useRef<null | (() => void)>(null);
    const tutorialHeldResourceRef = useRef<ResourceType | null>(null);
    const ADD_TO_PAN_BASE_MS = 150;
    const ADD_TO_PAN_ACCELERATION_RATE = 0.88;
    const ADD_TO_PAN_MIN_DELAY_MULTIPLIER = 0.13;
    const tutorialHoldDelayRef = useRef(ADD_TO_PAN_BASE_MS);
    const tutorialHoldCountRef = useRef(0);

    // Selection state for both tutorial and outro
    const [selectedStartingItem, setSelectedStartingItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [userReasoning, setUserReasoning] = useState<string>('');
    const [tempSelectedItem, setTempSelectedItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [welcomeConfirmation, setWelcomeConfirmation] = useState<string>('');

    // Outro-specific state
    const [outroSelectedBestItem, setOutroSelectedBestItem] = useState<{ resource: ResourceType, quantity: number, label: string } | null>(null);
    const [outroComparisonTexts, setOutroComparisonTexts] = useState<string[]>([]);
    const [currentOutroTextInput, setCurrentOutroTextInput] = useState<string>('');
    const [outroFeedback, setOutroFeedback] = useState<string>('');

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

            // Create exactly 4 comparison slides (one for each non-selected item)
            otherItems.forEach(item => {
                slides.push({
                    type: 'text-input',
                    textInput: {
                        prompt: `Explain briefly why wasn't as useful as ?`,
                        placeholder: 'Type here',
                        // Store the icons in a custom property for rendering
                        comparisonIcons: {
                            selected: selectedItemData?.icon,
                            other: item.icon
                        }
                    } as any,
                });
            });
            
            // Add 5th feedback slide AFTER the 4 comparison questions
            slides.push({
                type: 'text-input',
                textInput: {
                    prompt: 'Do you have any feedback?',
                    placeholder: 'Type here (optional)',
                    isOptional: true,  // Mark as optional so it doesn't require 4 words minimum
                    isFeedback: true   // Mark this as the feedback slide
                } as any,
            });
        }

        // Add final thanks slide - this should always be the last slide
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

    // Handle redirect for the final slide
    const handleFinalSlideRedirect = React.useCallback(() => {
        const redirectUrl = 'https://app.prolific.com/submissions/complete?cc=C1NY1UP7';
        
        // Attempt to open the URL
        Linking.openURL(redirectUrl).catch((err) => {
            console.error('Failed to redirect to Prolific:', err);
        });
    }, []);

    // Auto-redirect timer for final slide
    useEffect(() => {
        if (isOutroMode && currentSlide?.type === 'text' && currentSlide?.content === 'Thanks — all done') {
            // Set up 5-second auto-redirect
            const timer = setTimeout(() => {
                handleFinalSlideRedirect();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [currentSlideIndex, currentSlide, isOutroMode, handleFinalSlideRedirect]);
    
    // Cleanup hold interval on unmount
    useEffect(() => {
        return () => {
            if (tutorialHoldIntervalRef.current) {
                tutorialHoldIntervalRef.current();
                tutorialHoldIntervalRef.current = null;
            }
        };
    }, []);

    const nextSlide = () => {
        // Prevent double-calls
        if (isTransitioning) return;
        
        // Mark as transitioning
        setIsTransitioning(true);
        
        // Clean up any active hold interval when changing slides
        if (tutorialHoldIntervalRef.current) {
            tutorialHoldIntervalRef.current();
            tutorialHoldIntervalRef.current = null;
        }
        tutorialHeldResourceRef.current = null;
        tutorialHoldCountRef.current = 0;
        tutorialHoldDelayRef.current = ADD_TO_PAN_BASE_MS;
        
        // Handle outro text input saving
        if (isOutroMode && currentSlide.type === 'text-input') {
            const isFeedback = (currentSlide.textInput as any)?.isFeedback;
            
            if (isFeedback) {
                // Save feedback text (can be empty for optional field)
                setOutroFeedback(currentOutroTextInput);
            } else if (currentOutroTextInput.trim()) {
                // Save comparison text
                setOutroComparisonTexts(prev => [...prev, currentOutroTextInput]);
            }
            
            setCurrentOutroTextInput('');
        }

        if (isLastSlide) {
            if (isOutroMode) {
                // If this is the final "Thanks — all done" slide, redirect to Prolific
                if (currentSlide?.type === 'text' && currentSlide?.content === 'Thanks — all done') {
                    handleFinalSlideRedirect();
                }
                
                // Bundle all user responses into a single event
                posthog?.capture?.('Barter Game Survey Results', {
                    // Participant ID
                    prolific_pid: prolificPid || 'unknown',
                    
                    // Tutorial data
                    tutorial_selected_item: tutorialData?.selectedStartingItem?.label || 'unknown',
                    tutorial_selected_resource: tutorialData?.selectedStartingItem?.resource || 'unknown',
                    tutorial_reasoning: tutorialData?.userReasoning || '',
                    
                    // Outro data
                    outro_best_item: outroSelectedBestItem?.label || 'unknown',
                    outro_best_resource: outroSelectedBestItem?.resource || 'unknown',
                    outro_comparisons: outroComparisonTexts,
                    outro_comparisons_count: outroComparisonTexts.length,
                    outro_feedback: outroFeedback || 'none',
                    
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
            // Clear transition state after completion
            setIsTransitioning(false);
        } else {
            setCurrentSlideIndex(prev => prev + 1);

            // Update inventory for trade slides (tutorial only)
            if (!isOutroMode) {
                const nextSlideConfig = slides[currentSlideIndex + 1];
                if (nextSlideConfig?.tradeConfig?.startingInventory) {
                    setTutorialResources(nextSlideConfig.tradeConfig.startingInventory);
                }
            }
            
            // Clear transition state after slide change
            // Use a small timeout to ensure the new slide has rendered
            setTimeout(() => {
                setIsTransitioning(false);
            }, 100);
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
        // Prevent double-clicks
        if (isTransitioning) return;
        if (!isTutorialTradePassable()) return;

        const config = currentSlide.tradeConfig;
        if (!config) return;

        // Mark as transitioning immediately
        setIsTransitioning(true);

        setTutorialResources(prev => ({
            ...prev,
            [config.trade.give]: prev[config.trade.give] + config.trade.giveAmount,
        }));

        setTutorialPlayerOffer({});

        if (currentSlideIndex === 3 || currentSlideIndex === 5) {
            // Store the current slide index to validate later
            const slideIndexAtStart = currentSlideIndex;
            
            Animated.timing(slideTransitionAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start(() => {
                // Only proceed if we're still on the same slide
                if (currentSlideIndex === slideIndexAtStart) {
                    nextSlide();
                } else {
                    // If slide changed, just clear transition state
                    setIsTransitioning(false);
                }
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

    const renderWelcomeSlide = () => {
        const isValidInput = welcomeConfirmation.toLowerCase().trim() === 'i understand';
        
        return (
            <View style={tutorialStyles.tutorialSlide} pointerEvents="auto">
                <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                    <Text style={[tutorialStyles.tutorialSubtext, { marginBottom: 30, textAlign: 'center', fontSize: 18 }]}>
                        Be aware that this game requires strategy to win. Randomly guessing will take longer and <Text style={{ fontWeight: 'bold' }}>disqualify</Text> you. Type "I understand" to continue.
                    </Text>
                    
                    <View style={{
                        width: '100%',
                        maxWidth: 300,
                        marginBottom: 30,
                        padding: 12,
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: '#333',
                    }}>
                        <TextInput
                            style={{
                                fontSize: 14,
                                color: '#333',
                                textAlign: 'center',
                                outlineWidth: 0,
                                outlineStyle: 'none',
                                borderWidth: 0,
                            } as any}
                            placeholder="Type here"
                            placeholderTextColor="#999"
                            value={welcomeConfirmation}
                            onChangeText={setWelcomeConfirmation}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                    
                    <TouchableOpacity
                        onPress={() => {
                            if (!isTransitioning) {
                                nextSlide();
                            }
                        }}
                        disabled={!isValidInput || isTransitioning}
                        style={[
                            tutorialStyles.continueButton,
                            {
                                backgroundColor: isValidInput ? '#ff9500' : '#ccc',
                                opacity: isValidInput ? 1 : 0.6,
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

                    {/* Show completion code on final slide as backup */}
                    {isOutroMode && currentSlide?.type === 'text' && currentSlide?.content === 'Thanks — all done' && (
                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                                Redirecting to Prolific in 5 seconds...
                            </Text>
                            <Text style={{ fontSize: 12, color: '#999' }}>
                                If redirect fails, use completion code:
                            </Text>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 }}>
                                C1NY1UP7
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            // Prevent clicks during transitions
                            if (isTransitioning) return;
                            
                            if (currentSlide.animatedContent && !showAnimatedContent) {
                                triggerSlideAnimation();
                            } else if (!isOutroMode && currentSlideIndex === 4) {
                                // Mark as transitioning immediately
                                setIsTransitioning(true);
                                const slideIndexAtStart = currentSlideIndex;
                                
                                Animated.timing(slideTransitionAnim, {
                                    toValue: 1,
                                    duration: 600,
                                    useNativeDriver: true,
                                }).start(() => {
                                    // Only proceed if we're still on the same slide
                                    if (currentSlideIndex === slideIndexAtStart) {
                                        nextSlide();
                                    } else {
                                        // If slide changed, just clear transition state
                                        setIsTransitioning(false);
                                    }
                                });
                            } else {
                                nextSlide();
                            }
                        }}
                        style={tutorialStyles.continueButton}
                        disabled={isTransitioning}
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
                            // Prevent clicks during transitions
                            if (isTransitioning) return;
                            
                            if (currentSlide.animatedContent && !showAnimatedContent) {
                                triggerSlideAnimation();
                            } else {
                                nextSlide();
                            }
                        }}
                        style={tutorialStyles.continueButton}
                        disabled={isTransitioning}
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
                                activeOpacity={1}
                                delayPressIn={0}
                                delayLongPress={0}
                                onPressIn={() => {
                                    if (isDisabled) return;
                                    
                                    tutorialHeldResourceRef.current = res;
                                    
                                    // Send first item immediately
                                    handleTutorialAddItem(res);
                                    tutorialHoldCountRef.current = 1;
                                    tutorialHoldDelayRef.current = ADD_TO_PAN_BASE_MS;
                                    
                                    // Clear any existing interval
                                    if (tutorialHoldIntervalRef.current) {
                                        tutorialHoldIntervalRef.current();
                                        tutorialHoldIntervalRef.current = null;
                                    }
                                    
                                    // Start the hold interval
                                    tutorialHoldIntervalRef.current = startFrameLoop(
                                        () => tutorialHoldDelayRef.current,
                                        () => {
                                            if (tutorialHeldResourceRef.current !== res) return false;
                                            
                                            // Check current resources from ref
                                            if (tutorialResourcesRef.current[res] <= 0) {
                                                // Stop the hold if no more items
                                                tutorialHeldResourceRef.current = null;
                                                if (tutorialHoldIntervalRef.current) {
                                                    tutorialHoldIntervalRef.current();
                                                    tutorialHoldIntervalRef.current = null;
                                                }
                                                return false;
                                            }
                                            
                                            // We have items, so add one
                                            handleTutorialAddItem(res);
                                            tutorialHoldCountRef.current += 1;
                                            
                                            if (tutorialHoldCountRef.current >= 1) {
                                                const minDelay = ADD_TO_PAN_BASE_MS * ADD_TO_PAN_MIN_DELAY_MULTIPLIER;
                                                const next = Math.max(minDelay, tutorialHoldDelayRef.current * ADD_TO_PAN_ACCELERATION_RATE);
                                                if (next !== tutorialHoldDelayRef.current) {
                                                    tutorialHoldDelayRef.current = next;
                                                }
                                            }
                                            
                                            return true;
                                        }
                                    );
                                }}
                                onPressOut={() => {
                                    // Stop the hold
                                    tutorialHeldResourceRef.current = null;
                                    if (tutorialHoldIntervalRef.current) {
                                        tutorialHoldIntervalRef.current();
                                        tutorialHoldIntervalRef.current = null;
                                    }
                                    tutorialHoldCountRef.current = 0;
                                    tutorialHoldDelayRef.current = ADD_TO_PAN_BASE_MS;
                                }}
                            >
                                <View
                                    ref={(ref) => {
                                        if (ref) inventoryRefs.current[res] = ref;
                                    }}
                                    collapsable={false}
                                    style={{
                                        alignItems: 'center',
                                        opacity: isDisabled ? 0.3 : 1,
                                        cursor: 'pointer',
                                        ...({
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            MozUserSelect: 'none',
                                            msUserSelect: 'none',
                                            WebkitUserDrag: 'none',
                                            userDrag: 'none',
                                        } as any),
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                
                // Store for final survey submission
            } else {
                setSelectedStartingItem(tempSelectedItem);
                
                // Store for final survey submission
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
            const isOptional = (currentSlide.textInput as any)?.isOptional;
            const isFeedback = (currentSlide.textInput as any)?.isFeedback;
            const isValidInput = isOptional ? true : wordCount >= 4;  // Optional slides don't require minimum words
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
                            {isFeedback ? (
                                // Feedback slide shows simple text prompt
                                <Text style={[tutorialStyles.tutorialText, { marginBottom: 20 }]}>
                                    {currentSlide.textInput?.prompt}
                                </Text>
                            ) : (
                                // Comparison slides show icons
                                <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 20
                                    }}>
                                        <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>
                                            Explain briefly why
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
                                        <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>
                                            wasn't as useful as
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
                                        <Text style={[tutorialStyles.tutorialText, { marginBottom: 0 }]}>?</Text>
                                    </View>
                            )}

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

                            {!isValidInput && !isOptional && (
                                <Text style={{
                                    fontSize: 12,
                                    color: '#999',
                                    marginBottom: 15
                                }}>
                                    4 words minimum
                                </Text>
                            )}

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
        const isValidInput = wordCount >= 4;

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

                        {!isValidInput && (
                            <Text style={{
                                fontSize: 12,
                                color: '#999',
                                marginBottom: 15
                            }}>
                                4 words minimum
                            </Text>
                        )}

                        <TouchableOpacity
                            onPress={() => {
                                if (isValidInput) {
                                    // Store reasoning for final survey submission
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
                            posthog?.capture?.('Barter Game Survey Results', {
                                // Participant ID
                                prolific_pid: prolificPid || 'unknown',
                                
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