//app.tsx
import React, { useState, useRef, useEffect } from 'react';
import { preloadAllImages, IMAGE_SOURCES } from './imageCache';
// PostHog for analytics (safe for all platforms)
import { posthog } from './utils/posthog';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Animated,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { nextFrame, startFrameLoop } from './utils/safeTimers';

//styles
import { styles } from './styles/styles';
import {
  SCENE_SCALE,
  TOTAL_SCENE_WIDTH,
  HORIZONTAL_PADDING,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  BOTTOM_OFFSET,
  MAX_PHONE_WIDTH,
} from './normalize';

//walls on sides to hide exiting villages in wider screens
const wallWidth = 600;
const wallLeftPos = 0 - wallWidth;
const wallRightPos = 0 - wallWidth;


import { FlyingResourceManager, FlyingResourceManagerHandle } from './components/FlyingResourceManager';


//import components
import { TradeScale, cancelAllScaleRemovals } from './components/TradeScale';
import { NPCSlot } from './components/NPCSlot';
import { ResourceDisplay } from './components/ResourceDisplay';
import { TradeModal } from './components/TradeModal';
import { Tutorial } from './components/Tutorial';



type Direction = 'left' | 'right';

type NPC = {
  id: number;
  key: string;
  sprite: any;
  visible: boolean;
  direction: Direction;
  speed: number;
  selling: ResourceType;
  isExiting?: boolean; 
};



export type ResourceType = 'salt' | 'apples' | 'tools' | 'pottery' | 'shells' | 'cow';
type Trade = {
  give: ResourceType;
  giveAmount: number;
  want: ResourceType;
  wantAmount: number;
};

// Display-only icons (can include non-inventory visuals)
type DisplayIcon = ResourceType | 'brokenpottery';

const resourceIcons: Record<DisplayIcon, any> = {
  salt: IMAGE_SOURCES.salt,
  apples: IMAGE_SOURCES.apple,
  tools: IMAGE_SOURCES.tools,
  pottery: IMAGE_SOURCES.pottery,
  shells: IMAGE_SOURCES.shells,
  cow: IMAGE_SOURCES.cow,
  brokenpottery: IMAGE_SOURCES.brokenpottery,
};




//modify values when traders prefer a certain good
type PreferenceLevel = 'favored' | 'neutral' | 'disliked';

type ResourcePointRanges = {
  favored: [number, number];
  neutral: [number, number];
  disliked: [number, number];
};
type TradePreferences = {
  likes: ResourceType[];
  dislikes: ResourceType[];
  unitValues: Record<ResourceType, number>;
};

// Each resource has a hidden point value range used during trade generation
const editablePointRanges: Record<ResourceType, ResourcePointRanges> = {
  salt: {
    favored: [2, 2],
    neutral: [1, 1],
    disliked: [0.5, 0.8],
  },
  apples: {
    favored: [7, 8],
    neutral: [4, 5],
    disliked: [2, 3],
  },
  shells: {
    favored: [11, 12],
    neutral: [8, 9],
    disliked: [5, 6],
  },
  pottery: {
    favored: [15, 16],
    neutral: [12, 13],
    disliked: [9, 10],
  },
  tools: {
    favored: [28, 29],
    neutral: [24, 25],
    disliked: [15, 20],
  },
  cow:{
    favored: [0, 0],
    neutral: [0, 0],
    disliked: [0, 0],
  },
};

// Used to determine how many units of each resource can appear in trade generation
const resourceQuantityRanges: Record<ResourceType, [number, number]> = {
  salt: [10, 35],
  apples: [2, 8],
  shells: [1, 4],
  pottery: [1, 3],
  tools: [1, 1],
  cow:[1,1]
};


// how often to trigger the shell event
const SHELL_TRADE_INTERVAL = 12;
// fraction of apple‐pie decremented per trade
const APPLE_DECAY_STEP = 0.20;

const PieTimer = ({ progress, animate = true, onDepleted }: { progress: number; animate?: boolean; onDepleted?: () => void }) => {
  const radius = 12;
  // Pulse animation state (scale) 
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Remember the last target so we can detect decreases
  const prevProgressTargetRef = useRef(progress);
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const [currentProgress, setCurrentProgress] = useState(progress);

  useEffect(() => {
    if (!animate) {
      // Jump immediately, no pulse
      animatedProgress.stopAnimation();
      animatedProgress.setValue(progress);
      pulseScale.setValue(1);
      prevProgressTargetRef.current = progress;
      return;
    }

    const isDecrease = progress < prevProgressTargetRef.current;

    if (isDecrease) {
      // 1) Slight grow at the start
      pulseScale.stopAnimation();
      Animated.timing(pulseScale, {
        toValue: 1.40,
        duration: 120,
        useNativeDriver: true,
      }).start();

      // 2) Animate meter change
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 600,
        useNativeDriver: false, // Path/SVG angle needs layout driver
      }).start(() => {
        // 3) Shrink back when done
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // No pulse on increases or no change
      pulseScale.setValue(1);
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }

    prevProgressTargetRef.current = progress;
  }, [progress, animate]);


  const zeroNotifiedRef = useRef(false);
  
  const targetRef = useRef(progress);

  useEffect(() => {
    targetRef.current = progress;
    if (progress !== 0) zeroNotifiedRef.current = false;
  }, [progress]);

  useEffect(() => {
    const id = animatedProgress.addListener(({ value }) => {
      const clamped = Math.max(0, Math.min(1, value));
      setCurrentProgress(clamped);

      if (
        onDepleted &&
        animate &&
        targetRef.current === 0 &&
        clamped <= 0.001 &&
        !zeroNotifiedRef.current
      ) {
        zeroNotifiedRef.current = true;
        onDepleted();
      }
    });
    return () => animatedProgress.removeListener(id);
  }, [animate, onDepleted]);


  const angle = currentProgress * 2 * Math.PI;

  if (currentProgress <= 0) {
    return (
      <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
        <Svg width={radius * 2} height={radius * 2}>
          <Circle cx={radius} cy={radius} r={radius} fill="#ccc" />
          <Circle cx={radius} cy={radius} r={radius * 0.5} fill="black" />
        </Svg>
      </Animated.View>
    );
  }
  

  const largeArc = angle > Math.PI ? 1 : 0;
  const x = radius + radius * Math.sin(angle);
  const y = radius - radius * Math.cos(angle);
  const d = `
    M ${radius} ${radius}
    L ${radius} 0
    A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}
    Z
  `;

  return (
    <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
      <Svg width={radius * 2} height={radius * 2}>
        <Circle cx={radius} cy={radius} r={radius} fill="#505a51ff" />
        <Path d={d} fill="#46d850ff" />
        <Circle cx={radius} cy={radius} r={radius * 0.5} fill="black" />
      </Svg>
    </Animated.View>
  );
};




export default function App() {
  // --- Mobile Detection --- (removed - game works on all devices)
  
  // --- Image Loading ---
  const [imagesReady, setImagesReady] = useState(false);
  // --- Tutorial State ---
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStartSlide, setTutorialStartSlide] = useState(0);
  
  // --- Prolific Participant ID ---
  const [prolificPid, setProlificPid] = useState<string | null>(null);
  


  // --- Tutorial Data Storage ---
  const [tutorialData, setTutorialData] = useState<{
    selectedStartingItem?: { resource: ResourceType, quantity: number, label: string };
    userReasoning?: string;
  } | null>(null);

  // --- Outro State ---
  const [showOutro, setShowOutro] = useState(false);

  // --- First trader hint state ---
  const [showFirstTraderHint, setShowFirstTraderHint] = useState(false);

  // --- Debug cheat code ---
  const [debugKeySequence, setDebugKeySequence] = useState('');

  //world events
  const [showWorldEvent, setShowWorldEvent] = useState(false);
  const worldEventTimerRef = useRef<NodeJS.Timeout | null>(null);
  const specialNpcAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const worldEventOpacity = useRef(new Animated.Value(0)).current;
  const tradeIntroAnimatedRef = useRef(false);
  
  // --- Event priority & queuing (one event per trade) ---
  const tradeEventActiveRef = useRef(false);     // true once any event has fired this trade
  const suppressPieOnDepletedOnceRef = useRef(false); // prevent double spoil when handled inline
  // Shell cadence: every 10 trades (accept or decline)
  const totalTradesRef = useRef(0);
  const shellDueRef = useRef(false);             // true when a shell event is due to run
  const shellEventCountRef = useRef(0);  // Add this with your other useRef declarations


  //flying item animation
  const flyingRef = useRef<FlyingResourceManagerHandle>(null);


  //special npc animation
  const specialNpcAnimX = useRef(new Animated.Value(0)).current;
  const specialNpcRequestRef = useRef<number | null>(null);
  const specialNpcPaused = useRef(false);
  const specialNpcDirection = useRef<'left' | 'right'>('right');
  const specialNpcStart = useRef(0);
  const specialNpcEnd = useRef(0);
  const specialNpcSpeed = 20; // px per second
  const specialNpcLastTimestamp = useRef<number | null>(null);
  const specialNpcCurrentX = useRef(0);
  const { width, height } = useWindowDimensions();
  
  // Web-only: Dynamic scaling based on window size
  const [webScale, setWebScale] = useState(1);
  
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate scale to fit
      const scaleX = viewportWidth / VIRTUAL_WIDTH;
      const scaleY = viewportHeight / VIRTUAL_HEIGHT;
      const scale = Math.min(scaleX, scaleY, 1);
      
      console.log('Viewport:', viewportWidth, 'x', viewportHeight, 'Scale:', scale);
      setWebScale(scale);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  //tap vs hold for adding items to pan
  const holdIntervalRef = useRef<null | (() => void)>(null); // store cancel fn from startFrameLoop
  const heldResourceRef = useRef<ResourceType | null>(null);
  // acceleration for add-to-pan hold
  const ADD_TO_PAN_BASE_MS = 150;
  const ADD_TO_PAN_ACCELERATION_RATE = 0.88;  // Multiply delay by this each time 
  const ADD_TO_PAN_MIN_DELAY_MULTIPLIER = 0.13;  // Minimum delay as fraction of base (0.2 = 20% of base = 30ms)
  const holdDelayRef = useRef(ADD_TO_PAN_BASE_MS);
  const holdCountRef = useRef(0);
  


//flying item refs
  const inventoryRefs = useRef<Record<ResourceType, View | null>>({
    salt: null,
    apples: null,
    tools: null,
    pottery: null,
    shells: null,
    cow: null,
  });
  
  const [resources, setResources] = useState<Record<ResourceType, number>>({
    salt: 10,
    apples: 5,
    tools: 1,
    pottery: 2,
    shells: 5,
    cow: 0,
  });

  //references to the pan positions in the visual scale
  const [leftPanPosition, setLeftPanPosition] = useState<{ x: number; y: number } | null>(null);
  const [rightPanPosition, setRightPanPosition] = useState<{ x: number; y: number } | null>(null);
  // keep always-fresh copies to avoid stale y during press/hold
  const leftPanPositionRef = useRef<{ x: number; y: number } | null>(null);
  const rightPanPositionRef = useRef<{ x: number; y: number } | null>(null);

  //fruit decaying 
  const [appleTimer, setAppleTimer] = useState(1);  // 1 = full pie
  const [hasSeenAppleTrade, setHasSeenAppleTrade] = useState(false);
  const [hasSpoilageTriggered, setHasSpoilageTriggered] = useState(false);

  // keep the UI pinned at 0 right after spoilage, even if appleTimer resets to 1
  const [freezeApplePieAtZero, setFreezeApplePieAtZero] = useState(false);

  // on the first frame of the next cycle, jump to 1 without animation, then animate down
  const [pieShouldInstantJumpToOne, setPieShouldInstantJumpToOne] = useState(false);

  // --- Spoilage label timings---
  const SPOIL_LABEL_RISE_MS = 3000;
  const SPOIL_LABEL_LINGER_MS = 2400;


  // --- Tutorial completion handler ---
  const handleTutorialComplete = React.useCallback((data?: {
    selectedStartingItem?: { resource: ResourceType, quantity: number, label: string };
    userReasoning?: string;
  }) => {
    setShowTutorial(false);
    setTutorialData(data || null);
    setTutorialStartSlide(0); // Reset for next time
    
    // Show the first trader hint after tutorial
    setShowFirstTraderHint(true);

    // If user completed the full tutorial with item selection
    if (data?.selectedStartingItem) {
      console.log('User selected:', data.selectedStartingItem);
      console.log('User reasoning:', data.userReasoning);

      // Create starting inventory with only the selected item
      const startingInventory: Record<ResourceType, number> = {
        salt: 0,
        apples: 0,
        tools: 0,
        pottery: 0,
        shells: 0,
        cow: 0,
      };

      // Set the selected item quantity
      startingInventory[data.selectedStartingItem.resource] = data.selectedStartingItem.quantity;

      // Update the player's resources to start with only their chosen item
      setResources(startingInventory);

      // Generate initial NPCs that don't sell the player's chosen resource
      generateInitialNPCs(data.selectedStartingItem.resource);
    }
  }, []);
  // --- Outro completion handler ---
  const handleOutroComplete = React.useCallback(() => {
    setShowOutro(false);
    setGameEvent(null);
    setTutorialData(null);
  }, []);

  // --- Restart game handler ---
  const handleRestartGame = React.useCallback(() => {
    // Reset all game state
    setShowRestartDialog(false);
    setShowHintDialog(false);
    setShowHintBeforeRestart(false);
    setShowTutorial(true);
    setShowOutro(false);
    setShowFirstTraderHint(false);
    setGameEvent(null);
    setTutorialData(null);
    setNpcs([]);
    setResources({
      salt: 0,
      apples: 0,
      tools: 0,
      pottery: 0,
      shells: 0,
      cow: 0,
    });
    setTutorialStartSlide(7); // Start at item selection slide
    setTrade(null);
    setPlayerOffer({});
    setSelectedNpcIndex(null);
    setSpecialNpc(null);
    setAcceptedTradeCount(0);
    setRecentlyOfferedGoods([]);
    setSpecialNpcSpawnedFirstTime(false);
    setAppleTimer(1);
    setHasSeenAppleTrade(false);
    setHasSpoilageTriggered(false);
    setFreezeApplePieAtZero(false);
    setPieShouldInstantJumpToOne(false);
    setShowWorldEvent(false);
    setEventQueue([]);
    setActiveEvent(null);
    setEventLock(false);
    setSystemEventQueue([]);
    
    // Reset refs
    totalTradesRef.current = 0;
    shellDueRef.current = false;
    shellEventCountRef.current = 0;
    tradeEventActiveRef.current = false;
    suppressPieOnDepletedOnceRef.current = false;
    
    // Clear any timers
    if (worldEventTimerRef.current) {
      clearTimeout(worldEventTimerRef.current);
      worldEventTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      holdIntervalRef.current();
      holdIntervalRef.current = null;
    }
    if (specialNpcRequestRef.current) {
      cancelAnimationFrame(specialNpcRequestRef.current);
      specialNpcRequestRef.current = null;
    }
  }, []);

  // --- Generate initial NPCs excluding player's chosen resource ---
  // --- Generate initial NPCs excluding player's chosen resource ---
  const generateInitialNPCs = React.useCallback((excludeResource: ResourceType) => {
    const allGoods: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];
    const availableGoods = allGoods.filter(good => good !== excludeResource);

    // Take first 3 available goods
    const initialGoods = availableGoods.slice(0, 3);

    const spriteMap: Record<ResourceType, any> = {
      salt: IMAGE_SOURCES.npc_salt,
      apples: IMAGE_SOURCES.npc_apples,
      tools: IMAGE_SOURCES.npc_tools,
      pottery: IMAGE_SOURCES.npc_pottery,
      shells: IMAGE_SOURCES.npc_shells,
      cow: IMAGE_SOURCES.cow,
    };
    const newNPCs: NPC[] = initialGoods.map((selling, i) => ({
      id: i + 1,
      key: `npc-${i + 1}-${Date.now()}`,
      sprite: spriteMap[selling],
      selling,
      visible: true,
      direction: (Math.random() < 0.5 ? 'left' : 'right') as Direction,
      speed: Math.floor(200 + Math.random() * 100),
      isExiting: false,
    }));

    setNpcs(newNPCs);
  }, []);
  // --- Apple spoilage handler (runs when pie animation actually lands at 0) ---
  const handleAppleSpoilage = React.useCallback((overrideAppleCount?: number) => {
    const invRef = inventoryRefs.current.apples;
    const applesNow = overrideAppleCount ?? (resources.apples || 0);
    if (applesNow <= 0) return;

    // Choose a random integer strictly greater than 1/4 and strictly less than 1/2.
    // For tiny counts where that interval collapses, fall back to 1 (but never exceed apples).
    const lowExclusive = Math.floor(applesNow * 0.25);  // exclusive lower bound
    const highExclusive = Math.ceil(applesNow * 0.5);   // exclusive upper bound
    let minLoss = Math.max(1, lowExclusive + 1);
    let maxLossExclusive = Math.max(minLoss + 1, highExclusive); // ensure room for at least one integer

    // If range is still invalid (very small apples), just take 1 safely.
    let loss = 1;
    if (maxLossExclusive > minLoss) {
      const span = maxLossExclusive - minLoss; // at least 1
      loss = minLoss + Math.floor(Math.random() * span);
    }
    loss = Math.min(loss, applesNow);

    // Visuals: spawn two apples rising+fading from the inventory slot (or fewer if loss < 2)
    const visuals = Math.min(2, loss);

    (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
      // Icons: anchor on the apple  
      const APPLE_X_SHIFT = -30; // ~PieTimer radius (12) + ~2px right offset
      const iconStart = { x: x + w / 2 + APPLE_X_SHIFT, y: y + h / 2 };
      // Label: center on screen X; keep slot Y
      const labelStart = { x: width / 2, y: y + h / 2 };

      for (let i = 0; i < visuals; i++) {
        const jitterX = (Math.random() - 0.5) * 30;   // small horizontal variety
        const risePx = 150 + Math.random() * 60;       // vary rise distance a bit
        const duration = 1600 + Math.random() * 100;   // vary duration a bit
        nextFrame(() => setTimeout(() => {
          flyingRef.current?.riseAndFade(
            'apples',
            { x: iconStart.x + jitterX, y: iconStart.y },
            risePx,
            duration
          );
        }, i * 120)); // slight staggering
      }
      

      // Event popup apples spoil
      enqueueEventPopup({
        resource: 'apples',
        amount: loss,
        variant: 'apples_spoiled',
      });
            setFreezeApplePieAtZero(false);
      setPieShouldInstantJumpToOne(false);
      

    });
    

    // Deduct inventory
    setResources(prev => ({
      ...prev,
      apples: Math.max(0, (prev.apples || 0) - loss),
    }));
  }, [resources.apples]);
  // --- Pottery break visuals + inventory decrement ---
  const handlePotteryBreak = React.useCallback((onClosed?: () => void) => {
    // If we have no pottery, do nothing
    setResources(prev => {
      const current = prev.pottery || 0;
      if (current <= 0) return prev;

      // Visuals: one pottery rises + fades from the pottery slot, and a centered label
      const invRef = inventoryRefs.current.pottery;
      if (invRef && typeof (invRef as any).measureInWindow === 'function') {
        (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
          const POTTERY_X_SHIFT = -30; // match apples' fixed horizontal shift
          const iconStart = { x: x + w / 2 + POTTERY_X_SHIFT, y: y };

          const risePx = 160;   // single visual
          const duration = 2500; // fixed duration

          nextFrame(() => {
            flyingRef.current?.riseAndFade('pottery', iconStart, risePx, duration);

            enqueueEventPopup({
              resource: 'brokenpottery',
              variant: 'brokenpottery',
              onClose: onClosed, // release the lock only AFTER user taps OK
            });


          });
        });
      }

      return { ...prev, pottery: Math.max(0, current - 1) };
    });
  }, [width]);




  
  const handleTradeCompleted = React.useCallback(
    (trade: Trade, playerOffer: Partial<Record<ResourceType, number>>) => {
      // Does THIS completed trade involve apples?
      const involvesApples =
        trade.give === 'apples' || ((playerOffer['apples'] ?? 0) > 0);

      // If this is the first time apples are involved, flip the flag and show the intro bubble.
      if (involvesApples && !hasSeenAppleTrade) {
        setHasSeenAppleTrade(true);

        // Only show the rot message if player actually has apples after the trade
        // (not when they have 0 fruit)
        const applesAfterTrade = resources.apples || 0;
        
        if (applesAfterTrade > 0) {
          const invRef = inventoryRefs.current.apples;
          if (invRef && typeof (invRef as any).measureInWindow === 'function') {
            (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
              const start = { x: width / 2, y: y + h / 2 };
              flyingRef.current?.riseLabel(
                'your fruit is starting to rot',
                start,
                80,
                SPOIL_LABEL_RISE_MS,
                SPOIL_LABEL_LINGER_MS
              );
            });
          }
        }
      }

      // Before the first apple interaction, do NOT decay.
      if (!hasSeenAppleTrade && !involvesApples) {
        return;
      }

      const applyDecrement = () => {
        setAppleTimer(prev => {
          const next = Math.max(0, prev - APPLE_DECAY_STEP);
          if (prev > 0 && next === 0 && !hasSpoilageTriggered) {
            setHasSpoilageTriggered(true);
          }
          return next;
        });
      };

      if (freezeApplePieAtZero) {
        // Unfreeze UI: first frame jumps to 1 with no animation, then animate down on the next tick
        setFreezeApplePieAtZero(false);
        setTimeout(() => {
          setPieShouldInstantJumpToOne(false);
          applyDecrement();
        }, 0);
      } else {
        applyDecrement();
      }
    },
    [
      hasSeenAppleTrade,
      resources.apples,
      hasSpoilageTriggered,
      freezeApplePieAtZero
    ]
  );
  
  // Run exactly one event this trade, in priority order.
  // Returns true if an event fired (so lower priorities must be skipped/queued).
  const resolveTradeEvents = React.useCallback((
    opts: {
      accepted: boolean;
      npcGivesPottery: boolean;  // true if accepted AND trade.give === 'pottery'
      willAppleHitZero: boolean; // computed before we mutate appleTimer
      startPotteryDrop?: () => void; // kicks off the catch mini-event (sets/clears eventLock inside)
      requestShellNow?: () => void;  // fire shell event immediately
      totalApples?: number;
    }
  ) => {
    if (tradeEventActiveRef.current) return true;

    // 1) Apple rot (highest priority)
    if (opts.willAppleHitZero) {
      tradeEventActiveRef.current = true;

      // We are handling rot "now", so prevent PieTimer’s onDepleted from double-firing.
      suppressPieOnDepletedOnceRef.current = true;

      // Inline: replicate the onDepleted visuals/timers
      handleAppleSpoilage(opts.totalApples);
      setFreezeApplePieAtZero(true);
      setPieShouldInstantJumpToOne(true);
      setAppleTimer(1);
      setHasSpoilageTriggered(false);
      setTimeout(() => {
        setFreezeApplePieAtZero(false);
      }, SPOIL_LABEL_RISE_MS + SPOIL_LABEL_LINGER_MS);


      return true;
    }

    // 2) Pottery catch mini-event (only on accepted trades when NPC gives pottery)
    if (opts.accepted && opts.npcGivesPottery && opts.startPotteryDrop) {
      tradeEventActiveRef.current = true;
      opts.startPotteryDrop();

      return true;
    }

    // 3) Shell event (only if nothing else fired this trade)
    if (opts.requestShellNow) {
      tradeEventActiveRef.current = true;
      opts.requestShellNow();
      return true;
    }

    return false;
  }, [
    handleAppleSpoilage,
    SPOIL_LABEL_RISE_MS,
    SPOIL_LABEL_LINGER_MS
  ]);

  
  
  
  function assignUnitValues(
    likes: ResourceType[],
    dislikes: ResourceType[],
    sell: ResourceType
  ): Record<ResourceType, number> {
    const values: Partial<Record<ResourceType, number>> = {};
    const pool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

    for (const res of pool) {
      if (res === sell) {
        // NPC always sells at neutral price
        const [min, max] = editablePointRanges[res].neutral;
        values[res] = Math.random() * (max - min) + min;
      } else if (likes.includes(res)) {
        const [min, max] = editablePointRanges[res].favored;
        values[res] = Math.random() * (max - min) + min;
      } else if (dislikes.includes(res)) {
        const [min, max] = editablePointRanges[res].disliked;
        values[res] = Math.random() * (max - min) + min;
      } else {
        const [min, max] = editablePointRanges[res].neutral;
        values[res] = Math.random() * (max - min) + min;
      }
    }

    return values as Record<ResourceType, number>;
  }
  
  // npc traders - will be populated after tutorial
  const [npcs, setNpcs] = useState<NPC[]>([]);
  
  

  //trade values
  const [trade, setTrade] = useState<Trade | null>(null);
  const [tradePreferences, setTradePreferences] = useState<TradePreferences | null>(null);
  const [playerOffer, setPlayerOffer] = useState<Partial<Record<ResourceType, number>>>({});
  const [specialNpc, setSpecialNpc] = useState<{
    x: Animated.Value;
    direction: 'left' | 'right';
    sprite: any;
  } | null>(null);
  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);
  const [worldEventText, setWorldEventText] = useState<string>('');
  const [acceptedTradeCount, setAcceptedTradeCount] = useState(0);
  const [recentlyOfferedGoods, setRecentlyOfferedGoods] = useState<ResourceType[]>([]);

  const [specialNpcSpawnedFirstTime, setSpecialNpcSpawnedFirstTime] = useState(false);
  type GameEventType = 'victory' | 'loss' | 'tutorial' | null;
  const [gameEvent, setGameEvent] = useState<GameEventType>(null);
  
  // --- Intro overlay ---
  const [showIntro, setShowIntro] = useState(true);

  // --- Universal event popup queue ---
  type EventPopupData = {
    resource: DisplayIcon;
    amount?: number | null;
    message?: string;  // optional now (custom variants don't need it)
    variant?: 'brokenpottery' | 'shells_beach' | 'apples_spoiled';
    onClose?: () => void;
  };

  const [eventQueue, setEventQueue] = useState<EventPopupData[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventPopupData | null>(null);

  // --- Event gating (ensure only one system event runs at a time) ---
  const [eventLock, setEventLock] = useState(false);                 // ⟵ NEW
  const [systemEventQueue, setSystemEventQueue] = useState<(() => void)[]>([]); // ⟵ NEW

  // --- Restart confirmation state ---
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [showHintBeforeRestart, setShowHintBeforeRestart] = useState(false);

  const withEventGate = React.useCallback((fn: () => void) => {      // ⟵ NEW
    if (eventLock || activeEvent) {
      setSystemEventQueue(q => [...q, fn]);
    } else {
      fn();
    }
  }, [eventLock, activeEvent]);

  useEffect(() => {                                                  // ⟵ NEW
    if (!eventLock && !activeEvent && systemEventQueue.length > 0) {
      const [next, ...rest] = systemEventQueue;
      setSystemEventQueue(rest);
      nextFrame(() => next());
    }
  }, [eventLock, activeEvent, systemEventQueue.length]);

  // Mobile device detection removed - game works on all devices
  
  // Initialize PostHog and capture Prolific participant ID
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    
    try {
      // Extract Prolific parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get('PROLIFIC_PID') || urlParams.get('prolific_pid');
      const studyId = urlParams.get('STUDY_ID') || urlParams.get('study_id');
      const sessionId = urlParams.get('SESSION_ID') || urlParams.get('session_id');
      
      if (pid) {
        setProlificPid(pid);

        // Identify user in PostHog with Prolific ID
        if (posthog && typeof posthog.identify === 'function') {
          posthog.identify(pid, {
            prolific_pid: pid,
            study_id: studyId || 'unknown',
            session_id: sessionId || 'unknown',
            source: 'prolific'
          });

          // Explicitly ensure session recording is active
          if (posthog.sessionRecording && !posthog.sessionRecording.started) {
            posthog.startSessionRecordingg();
          }

          // Verify PostHog is working
          console.log('PostHog initialized with Prolific ID:', pid);
          console.log('PostHog session recording enabled:', posthog.sessionRecording.started);
          console.log('PostHog session ID:', posthog.get_session_id?.());
        } else {
          console.warn('PostHog not properly initialized');
        }
      
      } else {
        // If no Prolific ID, still identify with a unique ID for testing
        const testId = `test_user_${Date.now()}`;
        if (posthog && typeof posthog.identify === 'function') {
          posthog.identify(testId, {
            source: 'direct'
          });
          console.log('PostHog initialized with test ID:', testId);
        }
      }
    } catch (error) {
      console.error('Error initializing PostHog:', error);
    }
  }, []); // Run once on mount

  // Debug cheat codes for testing (web only)
  useEffect(() => {
    // Only run in web environment
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === '5' || event.key === '4' || event.key === '3') {
        setDebugKeySequence(prev => {
          const newSeq = prev + event.key;
          // Keep only last 3 characters
          return newSeq.slice(-3);
        });
      } else {
        setDebugKeySequence('');
      }
    };

    // Check if sequence matches our cheat codes
    if (debugKeySequence === '555') {
      // Skip directly to outro for testing
      setShowTutorial(false);
      setShowOutro(false);
      setGameEvent('victory');
      setDebugKeySequence('');
    } else if (debugKeySequence === '444') {
      // Give 10 tools to inventory
      setResources(prev => ({
        ...prev,
        tools: (prev.tools || 0) + 10
      }));
      console.log('Debug: Added 10 tools to inventory');
      setDebugKeySequence('');
    } else if (debugKeySequence === '333') {
      // Skip the intro tutorial
      setShowTutorial(false);
      console.log('Debug: Skipped intro tutorial');
      setDebugKeySequence('');
    }

    // Only add listener if addEventListener exists
    if (window.addEventListener) {
      window.addEventListener('keydown', handleKeyPress);
      return () => {
        window.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [debugKeySequence]);

  // Called when player taps on an NPC to initiate trade
  const handleNpcPress = (index: number) => {
    // Hide the first trader hint when any NPC is clicked
    if (showFirstTraderHint) {
      setShowFirstTraderHint(false);
    }
    
    const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

    // Choose different give/want resources
    const npc = npcs[index];
    const give: ResourceType = npc.selling;
    let want: ResourceType = give;
    while (want === give) {
      want = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    }

    // Generate 1–2 likes and 1–2 dislikes, excluding 'give' and salt for dislikes
    const available = resourcePool.filter(r => r !== give);
    const likeCount = Math.floor(Math.random() * 2) + 1;
    const dislikeCount = Math.floor(Math.random() * 2) + 1;

    const likes: ResourceType[] = [];
    const dislikes: ResourceType[] = [];

    // Every other trade, guarantee one liked good is in player's inventory
    const isGuaranteedTrade = totalTradesRef.current % 2 === 0;

    if (isGuaranteedTrade) {
      // Find resources the player has (excluding the give resource)
      const playerResources = available.filter(r => (resources[r] || 0) > 0);

      if (playerResources.length > 0) {
        // Pick one random resource from player's inventory to guarantee as liked
        const guaranteedLike = playerResources[Math.floor(Math.random() * playerResources.length)];
        likes.push(guaranteedLike);

        // Remove it from available pool for remaining likes
        const availableIndex = available.indexOf(guaranteedLike);
        if (availableIndex > -1) {
          available.splice(availableIndex, 1);
        }
      }
    }

    // Pick remaining likes randomly from what's left
    while (likes.length < likeCount && available.length) {
      const pick = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      likes.push(pick);
    }

    // For dislikes, exclude salt and already liked resources
    const dislikable = resourcePool.filter(
      r => r !== give && r !== 'salt' && !likes.includes(r)
    );
    while (dislikes.length < dislikeCount && dislikable.length) {
      const pick = dislikable.splice(Math.floor(Math.random() * dislikable.length), 1)[0];
      dislikes.push(pick);
    }

    // Assign unit values based on preferences
    const unitValues = assignUnitValues(likes, dislikes, give);

    // Give player advantage on all goods they might offer (except what NPC is selling)
    for (const resource in unitValues) {
      if (resource !== give) {
        unitValues[resource as ResourceType] *= 1.5;
      }
    }

    // Compute trade amounts
    const [minGiveQty, maxGiveQty] = resourceQuantityRanges[give];
    const giveAmount = Math.floor(Math.random() * (maxGiveQty - minGiveQty + 1)) + minGiveQty;
    const totalValue = giveAmount * unitValues[give];
    const wantAmount = Math.ceil(totalValue / unitValues[want]);

    const tradeData: Trade = { give, giveAmount, want, wantAmount };

    setTrade(tradeData);
    setSelectedNpcIndex(index);
    setTradePreferences({
      likes,
      dislikes,
      unitValues,
    });
  };
  





  const handleSpecialNpcPress = () => {
    const tradeData: Trade = {
      give: 'cow',
      giveAmount: 1,
      want: 'pottery',
      wantAmount: 4, // Keep fixed for now — avoids scale bugs
    };

    // Neutral-only pricing
    const unitValues: Record<ResourceType, number> = {
      salt: Math.random() * (editablePointRanges.salt.neutral[1] - editablePointRanges.salt.neutral[0]) + editablePointRanges.salt.neutral[0],
      apples: Math.random() * (editablePointRanges.apples.neutral[1] - editablePointRanges.apples.neutral[0]) + editablePointRanges.apples.neutral[0],
      tools: Math.random() * (editablePointRanges.tools.neutral[1] - editablePointRanges.tools.neutral[0]) + editablePointRanges.tools.neutral[0],
      pottery: Math.random() * (editablePointRanges.pottery.neutral[1] - editablePointRanges.pottery.neutral[0]) + editablePointRanges.pottery.neutral[0],
      shells: Math.random() * (editablePointRanges.shells.neutral[1] - editablePointRanges.shells.neutral[0]) + editablePointRanges.shells.neutral[0],
      cow: 120,
    };

    setTrade(tradeData);
    setTradePreferences({
      likes: [],
      dislikes: [],
      unitValues,
    });
    
    setSelectedNpcIndex(-999);

    // ⏸ Pause movement
    specialNpcPaused.current = true;
  };
  
  
  const handleOptionSelect = (option: 'buy' | 'decline') => {
    // Count this trade for shell cadence
    totalTradesRef.current += 1;
    if (totalTradesRef.current % SHELL_TRADE_INTERVAL === 0 && shellEventCountRef.current < 2) {
      shellDueRef.current = true;
    }

    const appleCountBefore = resources.apples;

  if (selectedNpcIndex === null) return;
  const isSpecialNpc = selectedNpcIndex === -999;

  if (option === 'buy' && trade) {
const unitValues = (setTrade as any).debug?.unitValues || {};
const playerTotal = Object.entries(playerOffer).reduce((total, [key, amount]) => {
  return total + (unitValues[key as ResourceType] || 0) * (amount || 0);
}, 0);

const npcTotal = (setTrade as any).debug?.giveTotalValue || 0;

    if (playerTotal >= npcTotal) {
      if (rightPanPosition && inventoryRefs.current[trade.give]) {
        inventoryRefs.current[trade.give]?.measureInWindow((x, y, width, height) => {
          const OFFSET_X = -32;
          const OFFSET_Y = -27;
          const target = {
            x: x + width / 2 + OFFSET_X,
            y: y + height / 2 + OFFSET_Y,
          };

          const maxFly = Math.min(trade.giveAmount, 10);
          const flyDuration = 50;
          const delay = maxFly * flyDuration + 100;

          for (let i = 0; i < maxFly; i++) {
            const launch = () => {
              flyingRef.current?.fly(trade.give, rightPanPosition, target);
            };
            nextFrame(() => setTimeout(launch, i * flyDuration));
          }

          nextFrame(() => {
            setTimeout(() => {
              const newResources = { ...resources };
              newResources[trade.give] += trade.giveAmount;
              setResources(newResources);
              // after setResources(...)
              const appleCountAfter = newResources.apples;
              if (appleCountBefore === 0 && appleCountAfter > 0) {
                setAppleTimer(1); // reset pie to full if we just gained apples after having 0
              }

              // Compute if the apple timer will hit zero *this* trade (priority #1)
              const currentPie = freezeApplePieAtZero ? 0 : appleTimer;
              const willAppleHitZero =
                hasSeenAppleTrade && currentPie > 0 && Math.max(0, currentPie - APPLE_DECAY_STEP) === 0;
              

              // Define pottery starter (priority #2)
              const startPotteryDrop = (trade.give === 'pottery')
                ? () => {
                  setEventLock(true);

                  // Use absolute position in virtual screen coordinates: 1/4 from the right, above center
                  // Virtual screen is 390x844, we want pottery at 3/4 width (292.5) and reasonable height
                  const virtualX = VIRTUAL_WIDTH * 0.75; // 1/4 from right in virtual coords
                  const virtualY = VIRTUAL_HEIGHT * 0.35; // Above center, similar to original pan position
                  
                  // Transform to actual screen coordinates
                  const startX = HORIZONTAL_PADDING + (virtualX * SCENE_SCALE);
                  const startY = virtualY * SCENE_SCALE;

                  console.log('Pottery drop at:', { startX, startY, virtualX, virtualY, scale: SCENE_SCALE }); // Debug log

                  nextFrame(() => {
                    flyingRef.current?.dropCatchablePottery(
                      { x: startX, y: startY },
                      {
                        onCaught: () => {
                          setEventLock(false);
                        },
                        onMiss: () => {
                          handlePotteryBreak(() => setEventLock(false));
                        },
                      }
                    );
                  });
                }
                : undefined;

              // Define shell request (priority #3): only if a shell is DUE, defer on the triggering trade
              const requestShellNow = shellDueRef.current
                && (totalTradesRef.current % SHELL_TRADE_INTERVAL !== 0)
                ? () => {
                  shellDueRef.current = false;
                  triggerShellBeachEvent();
                }
                : undefined;

              resolveTradeEvents({
                accepted: true,
                npcGivesPottery: trade.give === 'pottery',
                willAppleHitZero,
                startPotteryDrop,
                requestShellNow,
                totalApples: resources.apples || 0, // For accept path, use current inventory
              });
                
  

              // Always perform normal post-trade bookkeeping
              handleTradeCompleted(trade, playerOffer);
              setRecentlyOfferedGoods(prev => [trade.give, ...prev].slice(0, 2));


              if (trade.give === 'cow') {
                setGameEvent('victory');
              }

              if (!specialNpcSpawnedFirstTime && acceptedTradeCount >= 1) {
                spawnSpecialNpc();
                setSpecialNpcSpawnedFirstTime(true);
              }

              setSelectedNpcIndex(null);
              setTrade(null);
              setPlayerOffer({});
            }, delay);
          });

          
        });
      } else {
        // Fallback if position is missing
        const newResources = { ...resources };
        newResources[trade.give] += trade.giveAmount;
        setResources(newResources);
        handleTradeCompleted(trade, playerOffer);

        setRecentlyOfferedGoods(prev => [trade.give, ...prev].slice(0, 2));

        if (trade.give === 'cow') {
          setGameEvent('victory');
        }

        if (!specialNpcSpawnedFirstTime && acceptedTradeCount >= 1) {
          spawnSpecialNpc();
          setSpecialNpcSpawnedFirstTime(true);
        }

        setSelectedNpcIndex(null);
        setTrade(null);
        setPlayerOffer({});
      }
    }



  }

  const index = selectedNpcIndex;
  const exitDirection: Direction = Math.random() < 0.5 ? 'left' : 'right';
  const enterDirection: Direction = Math.random() < 0.5 ? 'left' : 'right';

  if (!isSpecialNpc) {
    setNpcs(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        direction: exitDirection,
        visible: false,
        isExiting: true,
      };
      return updated;
    });
  

  const safeExitDelay = (VIRTUAL_WIDTH / 300) * 1000;

    setTimeout(() => {
      let basePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

      // Block anything the *currently visible, non-exiting* traders are holding
      const blockedByVisible = npcs
        .filter(n => n.visible && !n.isExiting)
        .map(n => n.selling);
      let selling: ResourceType | undefined;

      // If the player has no salt, *try* to offer salt — but only if it keeps uniqueness.
      if (!recentlyOfferedGoods.includes('salt') && resources.salt === 0 && !blockedByVisible.includes('salt')) {
        selling = 'salt';
      }

      if (!selling) {
        // Prefer goods not recently offered AND not held by visible traders
        const primary = basePool.filter(
          r => !recentlyOfferedGoods.includes(r) && !blockedByVisible.includes(r)
        );

        // If that’s empty, still enforce uniqueness vs visible traders
        const secondary = basePool.filter(r => !blockedByVisible.includes(r));

        // If still empty (shouldn’t happen with 3 traders), fall back to basePool
        const eligible = primary.length > 0 ? primary : (secondary.length > 0 ? secondary : basePool);

        // Lightly weight salt when present in eligible
        const weightedPool = eligible.flatMap(r => (r === 'salt' ? [r, r] : [r]));

        selling = weightedPool[Math.floor(Math.random() * weightedPool.length)] as ResourceType;
      }
  
    

    // ignore recently offered goods
    setRecentlyOfferedGoods(prev => [selling, ...prev].slice(0, 2));

      const spriteMap: Record<ResourceType, any> = {
        salt: IMAGE_SOURCES.npc_salt,
        apples: IMAGE_SOURCES.npc_apples,
        tools: IMAGE_SOURCES.npc_tools,
        pottery: IMAGE_SOURCES.npc_pottery,
        shells: IMAGE_SOURCES.npc_shells,
        cow: IMAGE_SOURCES.cow
      };

    const newNpc: NPC = {
      id: Math.floor(Math.random() * 10000),
      key: Date.now().toString(),
      sprite: spriteMap[selling],
      selling,
      visible: false,
      direction: enterDirection,
      speed: Math.floor(200 + Math.random() * 100),
      isExiting: false,
    };

    setNpcs(prev => {
      const updated = [...prev];
      updated[index] = newNpc;
      return updated;
    });

    setTimeout(() => {
      setNpcs(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          visible: true,
        };
        return updated;
      });
    }, 0);
  }, safeExitDelay);
}
    // return offered resources if player declined
    if (option === 'decline') {
      // Calculate total apples (inventory + pan) for spoilage decision
      const totalApples = (resources.apples || 0) + (playerOffer.apples || 0);

      setResources(prevResources => {
        const updatedResources = { ...prevResources };
        for (const [res, amount] of Object.entries(playerOffer)) {
          if (!amount) continue;
          updatedResources[res as ResourceType] = (updatedResources[res as ResourceType] || 0) + amount;
        }
        return updatedResources;
      });

      // Wait for the state update to complete, THEN do all event resolution
      setTimeout(() => {
        const currentPie = freezeApplePieAtZero ? 0 : appleTimer;
        const willAppleHitZero =
          hasSeenAppleTrade && currentPie > 0 && Math.max(0, currentPie - 0.25) === 0;

        const requestShellNow = shellDueRef.current
          && (totalTradesRef.current % SHELL_TRADE_INTERVAL !== 0)
          ? () => {
            shellDueRef.current = false;
            triggerShellBeachEvent();
          }
          : undefined;

        resolveTradeEvents({
          accepted: false,
          npcGivesPottery: false,
          willAppleHitZero,
          startPotteryDrop: undefined,
          requestShellNow,
          totalApples, // Now this variable exists in scope
        });

        if (trade) {
          handleTradeCompleted(trade, playerOffer);
        }
      }, 0);
    }




  
  // Wait ~600ms to let flying animations finish before unmounting the modal
    setSelectedNpcIndex(null);
    setTrade(null);
    setPlayerOffer({});
  cancelAllScaleRemovals();
  // Stop hold-to-add
  heldResourceRef.current = null;
  if (holdIntervalRef.current) {
    holdIntervalRef.current(); // cancel frame loop
    holdIntervalRef.current = null;
  }
  
  //if stopped, special npc starts walking again
  if (isSpecialNpc) {
    specialNpcPaused.current = false;
    specialNpcLastTimestamp.current = null; // Reset time tracking to resume cleanly
  }
  // Hide world event early if active
  if (showWorldEvent) {
    if (worldEventTimerRef.current) {
      clearTimeout(worldEventTimerRef.current);
      worldEventTimerRef.current = null;
    }
    Animated.timing(worldEventOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setShowWorldEvent(false);
    });
  }

  // Count completed trades toward world events
  setAcceptedTradeCount(prev => {
    const newCount = prev + 1;
    if (newCount >= 3) {
      //triggerWorldEvent();
      return 0;
    }
    return newCount;
  });


  // Reset per-trade event flag for the next interaction  
  tradeEventActiveRef.current = false;

  

  // Reset per-trade event flag for the next interaction  
  tradeEventActiveRef.current = false;
};


const renderNpcRow = () => (
  <View style={styles.npcRow}>
    {npcs.map((npc, index) => (
      <NPCSlot key={npc.key} npc={npc} onPress={() => handleNpcPress(index)} />
    ))}
  </View>
);

// Render the player's resource inventory with tap-to-offer logic
  const renderResourceSection = () => (
    <View style={styles.resourceSection}>
      {([['salt', 'apples'], ['tools', 'pottery', 'shells']] as ResourceType[][]).map((row, i) => (
        <View key={i} style={styles.resourceRow}>
          {row.map((res: ResourceType) => {
            if (res === 'cow') return null; // hide cow from inventory UI

            //if we don't have, or if this item is disabled
            const isOfferingThis = trade?.give === res;
            const isDisabled = !trade || resources[res] <= 0 || isOfferingThis;            
            return (
              <TouchableOpacity
                key={res}
                disabled={isDisabled}
                activeOpacity={1}
                delayPressIn={0}
                delayLongPress={0}
                style={{
                  cursor: 'pointer',
                  // Prevent browser drag selection - cast to any for web-specific properties
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
                onPressIn={() => {
                  cancelAllScaleRemovals();
                  if (isDisabled) return;

                  heldResourceRef.current = res;

                  const sendItem = () => {
                    setResources(prev => {
                      if (prev[res] <= 0) return prev; // Prevent going below 0

                      const updated = { ...prev, [res]: prev[res] - 1 };

                      // Update player offer
                      setPlayerOffer(offer => ({
                        ...offer,
                        [res]: (offer[res] || 0) + 1,
                      }));

                      // Animate after confirming decrement
                      inventoryRefs.current[res]?.measureInWindow((x, y, width, height) => {
                        const start = { x: x + width / 2, y: y + height / 2 };

                        const fire = () => {
                          const base = leftPanPositionRef.current ?? leftPanPosition ?? start;
                          // small X nudge
                          const destination = { x: base.x - 20, y: base.y + 20 };
                          flyingRef.current?.fly(res, start, destination);
                        };

                        // Wait two frames so TradeScale can tilt and re-measure for THIS added item
                        nextFrame(fire);
                      });
                      
                      return updated;
                    });
                  };
                  

                  // immediate first item
                  sendItem();
                  holdCountRef.current = 1;
                  holdDelayRef.current = ADD_TO_PAN_BASE_MS;

                  // guard any stray timer
                  if (holdIntervalRef.current) {
                    holdIntervalRef.current(); // cancel prior frame loop
                    holdIntervalRef.current = null;
                  }

                  const tick = () => {
                    if (heldResourceRef.current !== res) return;

                    sendItem();
                    holdCountRef.current += 1;

                    if (holdCountRef.current >= 1) {
                      const minDelay = ADD_TO_PAN_BASE_MS * ADD_TO_PAN_MIN_DELAY_MULTIPLIER;          // floor = configurable % of base
                      const next = Math.max(minDelay, holdDelayRef.current * ADD_TO_PAN_ACCELERATION_RATE); // increase acceleration
                      if (next !== holdDelayRef.current) {
                        holdDelayRef.current = next;
                        // (with frame loop we just update the interval variable; loop keeps running)
                      }
                    }
                  };

                  holdIntervalRef.current = startFrameLoop(() => holdDelayRef.current, () => {
                    if (heldResourceRef.current !== res) return false;
                    tick();
                    return true;
                  });
                  
                  
                }}
                onPressOut={() => {
                  // Stop the hold + timer and reset the adaptive counters for next time.
                  heldResourceRef.current = null;
                  if (holdIntervalRef.current) {
                    holdIntervalRef.current(); // cancel frame loop
                    holdIntervalRef.current = null;
                  }
                  holdCountRef.current = 0;
                  holdDelayRef.current = ADD_TO_PAN_BASE_MS;
                  
                
                }}
              >

                <View
                  ref={(ref) => {
                    if (ref) inventoryRefs.current[res] = ref;
                  }}
                  collapsable={false}
                  style={{
                    alignItems: 'center',
                    opacity: trade && isDisabled ? 0.3 : 1,
                  }}
                >
                  <View style={{ position: 'relative' }}>
                    <ResourceDisplay name={res} amount={resources[res]} />
                    {res === 'apples' && hasSeenAppleTrade && (resources.apples > 0 || (playerOffer.apples || 0) > 0) && (
                      <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                        <PieTimer
                          progress={freezeApplePieAtZero ? 0 : appleTimer}
                          animate={!pieShouldInstantJumpToOne}
                          onDepleted={() => {
                            // If we already handled rot inline for this trade, skip this one frame.
                            if (suppressPieOnDepletedOnceRef.current) {
                              suppressPieOnDepletedOnceRef.current = false;
                              return;
                            }

                            // (Normal path) Run spoilage as a standalone event, but still respect global gating if used.
                            const run = () => {
                              handleAppleSpoilage();
                              setFreezeApplePieAtZero(true);
                              setPieShouldInstantJumpToOne(true);
                              setAppleTimer(1);
                              setHasSpoilageTriggered(false);
                              setTimeout(() => {
                                setFreezeApplePieAtZero(false);
                              }, SPOIL_LABEL_RISE_MS + SPOIL_LABEL_LINGER_MS);
                            };

                            if (eventLock || activeEvent) {
                              setSystemEventQueue(q => [...q, run]);
                            } else {
                              run();
                            }
                          }}
                        />



                      </View>
                    )}
                  </View>
                  </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const handleRemoveFromOffer = (res: ResourceType) => {
    setPlayerOffer(prevOffer => {
      const currentCount = prevOffer[res] || 0;
      if (currentCount <= 0) return prevOffer;

      const newOffer = { ...prevOffer };
      newOffer[res] = currentCount - 1;
      if (newOffer[res] === 0) delete newOffer[res];

      // Launch fly-back animation (non-blocking)
      if (leftPanPosition && inventoryRefs.current[res]) {
        inventoryRefs.current[res]?.measureInWindow((x, y, width, height) => {
          const start = {
            x: leftPanPosition.x,
            y: leftPanPosition.y,
          };
          const end = {
            x: x + width / 2,
            y: y + height / 2,
          };

          nextFrame(() => {
            flyingRef.current?.fly(res, start, end);
          });
          });
      }

      // Immediately return the resource
      setResources(prevResources => ({
        ...prevResources,
        [res]: (prevResources[res] || 0) + 1,
      }));

      return newOffer;
    });
  };
  const spawnSpecialNpc = () => {
    // Cancel any existing animation before starting new one
    if (specialNpcRequestRef.current) {
      cancelAnimationFrame(specialNpcRequestRef.current);
      specialNpcRequestRef.current = null;
    }

    const direction: Direction = Math.random() < 0.5 ? 'left' : 'right';
    const sprite = IMAGE_SOURCES.npc_special;
    const SPRITE_WIDTH = 80;
    const BUFFER = SPRITE_WIDTH + 20;

    const startX = direction === 'left' ? VIRTUAL_WIDTH + BUFFER : -BUFFER;
    const endX = direction === 'left' ? -BUFFER : VIRTUAL_WIDTH + BUFFER;

    specialNpcDirection.current = direction;
    specialNpcStart.current = startX;
    specialNpcEnd.current = endX;
    specialNpcAnimX.setValue(startX);
    specialNpcCurrentX.current = startX;

    // Clean up listeners before adding new ones
    specialNpcAnimX.removeAllListeners();
    specialNpcAnimX.addListener(({ value }) => {
      specialNpcCurrentX.current = value;
    });

    specialNpcPaused.current = false;
    specialNpcLastTimestamp.current = null;

    setSpecialNpc({ x: specialNpcAnimX, direction, sprite });

    const animate = (timestamp: number) => {
      if (specialNpcPaused.current) {
        specialNpcRequestRef.current = requestAnimationFrame(animate);
        return;
      }

      if (specialNpcLastTimestamp.current == null) {
        specialNpcLastTimestamp.current = timestamp;
        specialNpcRequestRef.current = requestAnimationFrame(animate);
        return;
      }

      const dt = (timestamp - specialNpcLastTimestamp.current) / 1000;
      specialNpcLastTimestamp.current = timestamp;

      const current = specialNpcCurrentX.current;
      const directionFactor = direction === 'left' ? -1 : 1;
      const nextX = current + specialNpcSpeed * dt * directionFactor;

      const finished = direction === 'left' ? nextX <= endX : nextX >= endX;

      if (finished) {
        setSpecialNpc(null);
        specialNpcAnimX.removeAllListeners();

        // Properly cleanup animation frame
        if (specialNpcRequestRef.current) {
          cancelAnimationFrame(specialNpcRequestRef.current);
          specialNpcRequestRef.current = null;
        }

        setTimeout(spawnSpecialNpc, 6000);
        return;
      }

      specialNpcAnimX.setValue(nextX);
      specialNpcRequestRef.current = requestAnimationFrame(animate);
    };

    specialNpcRequestRef.current = requestAnimationFrame(animate);
  };
  
  const triggerShellBeachEvent = React.useCallback(() => {
    withEventGate(() => {

      // increase event counter 
      shellEventCountRef.current += 1;

      // decrease value 1/4
      editablePointRanges.shells.favored = editablePointRanges.shells.favored.map(v => v * 0.75) as [number, number];
      editablePointRanges.shells.neutral = editablePointRanges.shells.neutral.map(v => v * 0.75) as [number, number];
      editablePointRanges.shells.disliked = editablePointRanges.shells.disliked.map(v => v * 0.75) as [number, number];
      
      // 2. Queue the popup message
      enqueueEventPopup({
        resource: 'shells',
        variant: 'shells_beach',
        amount: null,
      });


      // 3. Visual: Shell rain
      const screenWidth = width;
      const drops = 12; // number of shells
      for (let i = 0; i < drops; i++) {
        const startX = Math.random() * screenWidth;
        const startY = -50 - Math.random() * 150; // start slightly above screen
        const distance = height + 100; // fall past the bottom
        const duration = 2000 + Math.random() * 500;

        nextFrame(() => setTimeout(() => {
          flyingRef.current?.fallAndFade(
            'shells',
            { x: startX, y: startY },
            distance,
            duration
          );
        }, i * 100)); // slight stagger for rain effect
      }
    });
  }, [width, height, withEventGate]);


  
  const triggerWorldEvent = () => {

    //fade in event
    setShowWorldEvent(true);
    worldEventOpacity.setValue(0);
    Animated.timing(worldEventOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const events = [
      () => {
        const currentApples = resources.apples || 0;
        if (currentApples > 0) {
          const spoilCount = Math.floor(Math.random() * (currentApples / 2)) + 1;
          setResources(prev => ({
            ...prev,
            apples: Math.max(0, prev.apples - spoilCount),
          }));
          setWorldEventText(`${spoilCount} of your apples have spoiled`);
        } else {
          setWorldEventText('Some nearby apples have spoiled');
        }
      },
      () => {
        editablePointRanges.shells.favored = [
          editablePointRanges.shells.favored[0] * 0.75,
          editablePointRanges.shells.favored[1] * 0.75,
        ];
        editablePointRanges.shells.neutral = [
          editablePointRanges.shells.neutral[0] * 0.75,
          editablePointRanges.shells.neutral[1] * 0.75,
        ];
        editablePointRanges.shells.disliked = [
          editablePointRanges.shells.disliked[0] * 0.75,
          editablePointRanges.shells.disliked[1] * 0.75,
        ];
        setWorldEventText('Many seashells wash up on shore, prices go down');
      },
      () => {
        const currentPottery = resources.pottery || 0;
        if (currentPottery > 0) {
          setResources(prev => ({
            ...prev,
            pottery: Math.max(0, prev.pottery - 1),
          }));
          setWorldEventText('An earthquake knocks over your pottery');
        } else {
          setWorldEventText('An earthquake knocks over pottery in nearby stores');
        }
      },
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    randomEvent();

    // Start timeout to auto-hide after 6 seconds
    if (worldEventTimerRef.current) {
      clearTimeout(worldEventTimerRef.current);
    }
    worldEventTimerRef.current = setTimeout(() => {

      Animated.timing(worldEventOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowWorldEvent(false);
        worldEventTimerRef.current = null;
      });

    }, 6000);
  };
  

  

  const renderGameEventOverlay = () => {
    if (gameEvent === 'victory') {
      return (
        <View style={styles.victoryOverlay} pointerEvents="auto">
          <Text style={styles.victoryTitle}>You Win!</Text>
          <Text style={styles.victoryEmoji}>🐄</Text>
          <Text style={styles.victorySubtitle}>
            You have acquired the legendary cow.
          </Text>
          <TouchableOpacity
            style={styles.victoryButton}
            onPress={() => {
              setGameEvent(null);
              setShowOutro(true);
            }}          >
            <Text style={styles.victoryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // --- Universal Event Popup Queue Handlers ---  // NEW
  const enqueueEventPopup = React.useCallback((data: EventPopupData) => {
    setEventQueue(prev => {
      const newQueue = [...prev, data];
      // Start immediately if none active
      if (!activeEvent) setActiveEvent(newQueue[0]);
      return newQueue;
    });
  }, [activeEvent]);

  const handleCloseEvent = React.useCallback(() => {
    setEventQueue(prev => {
      const [closing, ...rest] = prev;
      // Advance the active popup
      if (rest.length > 0) {
        setActiveEvent(rest[0]);
      } else {
        setActiveEvent(null);
      }
      // Run closing callback AFTER we’ve advanced
      if (closing?.onClose) {
        // Defer a tick so state updates settle
        nextFrame(() => closing.onClose!());
      }
      return rest;
    });
  }, []);


  // --- Popup Renderer ---
  // --- Restart Dialog Renderer ---
  const renderRestartDialogs = () => {
    if (showHintBeforeRestart) {
      return (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          pointerEvents="auto"
        >
          <View
            style={[
              styles.eventPopupCard,
              { maxWidth: Math.min(width - 32, 420) } 
            ]}
          >
            <Text style={{ fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 10 }}>
              Hint:
            </Text>
            <Text style={{ fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 20 }}>
              Plan a few trades ahead
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#3498db',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 10,
              }}
              onPress={handleRestartGame}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Restart</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (showHintDialog) {
      return (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          pointerEvents="auto"
        >
          <View
            style={[
              styles.eventPopupCard,
              { maxWidth: Math.min(width - 32, 420) } 
            ]}
          >
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 }}>
              Want to start over with a different trade good?
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#3498db',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
                onPress={() => {
                  setShowHintDialog(false);
                  setShowHintBeforeRestart(true);
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#95a5a6',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
                onPress={() => setShowHintDialog(false)}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    if (showRestartDialog) {
      return (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          pointerEvents="auto"
        >
          <View
            style={[
              styles.eventPopupCard,
              { maxWidth: Math.min(width - 32, 420) } 
            ]}
          >
            <Text style={{ fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 20 }}>
              Restart with a different trade item?
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#e74c3c',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
                onPress={handleRestartGame}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#95a5a6',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
                onPress={() => setShowRestartDialog(false)}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }



    return null;
  };

  const renderFirstTraderHint = () => {
    if (!showFirstTraderHint) return null;

    return (
      <View
        style={{
          position: 'absolute',
          bottom: 40, // A bit higher up
          left: '50%',
          transform: [{ translateX: -150 }], // Center the 300px wide bubble
          width: 300,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          paddingVertical: 40, 
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 10,
          zIndex: 1000,
          borderWidth: 2,
          borderColor: '#ff9500',
        }}
        pointerEvents="none" // Don't block clicks
      >
        {/* Arrow pointing up to traders */}
        <View
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: [{ translateX: -10 }],
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderBottomWidth: 10,
            borderStyle: 'solid',
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: '#ff9500',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: [{ translateX: -8 }],
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderBottomWidth: 8,
            borderStyle: 'solid',
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: '#ffffff',
          }}
        />
        
        <Text
          style={{
            fontSize: 18,
            color: '#333',
            textAlign: 'center',
            fontWeight: '600',
          }}
        >
          Click a trader above to get started
        </Text>
      </View>
    );
  };

  const renderEventPopup = () => {
    if (!activeEvent) return null;
    const { resource, amount, message } = activeEvent;

    return (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="auto"
      >
        <View
          style={[
            styles.eventPopupCard,
            { maxWidth: Math.min(width - 32, 420) } 
          ]}
        >


          {/* Header content — custom variants first */}
          {activeEvent.variant === 'brokenpottery' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18, color: '#333' }}>
                a trader dropped one of your{' '}
              </Text>
              <Image
                source={resourceIcons['brokenpottery']}
                style={{ width: 28, height: 28, marginHorizontal: 2 }}
                resizeMode="contain"
              />
            </View>
          ) : activeEvent.variant === 'shells_beach' ? (
            <View
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: 16,
                justifyContent: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: '#333' }}>
                  a bunch of{' '}
                </Text>
                <Image
                  source={resourceIcons['shells']}
                  style={{ width: 28, height: 28, marginHorizontal: 2 }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: 18, color: '#333' }}>
                  {' '}washed up on the beach.
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: '#333', marginTop: 4, textAlign: 'center' }}>
                They are now less valuable.
              </Text>
            </View>

          ) : activeEvent.variant === 'apples_spoiled' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18, color: '#333' }}>
                {amount} of your{' '}
              </Text>
              <Image
                source={resourceIcons['apples']}
                style={{ width: 28, height: 28, marginHorizontal: 2 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, color: '#333' }}>
                {' '}spoiled
              </Text>
            </View>
          ) : (
            // Default layout (unchanged behavior)
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              {amount != null && (
                <Text style={{ fontSize: 18, color: '#333', marginRight: 6 }}>
                  {amount}
                </Text>
              )}
              <Image
                source={resourceIcons[resource]}
                style={{ width: 28, height: 28, marginRight: message ? 6 : 0 }}
                resizeMode="contain"
              />
              {message && (
                <Text style={{ fontSize: 18, color: '#333', textAlign: 'center' }}>
                  {message}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: '#2ecc71',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
            }}
            onPress={handleCloseEvent}
          >
            <Text style={{ color: '#0b2b13', fontWeight: '700' }}>OK</Text>
          </TouchableOpacity>
        </View>

      </View>
    );
  };
  
  
  


  

  

  const renderOverlay = () => {
    if (!trade) return null;

    const unitValues = (setTrade as any).debug?.unitValues || {};

    return (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        {trade && tradePreferences && (
          <TradeModal
            trade={trade}
            playerOffer={playerOffer}
            unitValues={tradePreferences.unitValues}
            onAccept={() => handleOptionSelect('buy')}
            onDecline={() => handleOptionSelect('decline')}
            onRemoveItem={handleRemoveFromOffer}
            likes={tradePreferences.likes}
            dislikes={tradePreferences.dislikes}
            onLeftPanMeasured={(pos) => { leftPanPositionRef.current = pos; setLeftPanPosition(pos); }}
            onRightPanMeasured={(pos) => { rightPanPositionRef.current = pos; setRightPanPosition(pos); }}
            introAnimatedRef={tradeIntroAnimatedRef}
          />
        )}
      </View>
    );
    
    
  };
  




  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (specialNpcRequestRef.current) {
        cancelAnimationFrame(specialNpcRequestRef.current);
        specialNpcRequestRef.current = null;
      }
      if (worldEventTimerRef.current) {
        clearTimeout(worldEventTimerRef.current);
        worldEventTimerRef.current = null;
      }
      if (holdIntervalRef.current) {
        holdIntervalRef.current();
        holdIntervalRef.current = null;
      }
    };
  }, []);

  // Mobile warning screen removed - game now works on all devices

  return (
    <View style={styles.containerWrapper}>
      <View style={{
        position: 'absolute',
        left: -500,  // Off screen but still "visible" to React Native
        top: -500,
        width: 500,
        height: 500,
      }}>
        {Object.values(IMAGE_SOURCES).map((source, index) => (
          <Image
            key={`preload-${index}`}
            source={source}
            style={{
              width: 80,  // Use real sizes
              height: 80,
              margin: 5,
            }}
            transition={0}
            contentFit="contain"
          />
        ))}
      </View>
      <FlyingResourceManager ref={flyingRef} />
      
      {/* Scaling wrapper - wraps everything except flying resources */}
      <View style={Platform.OS === 'web' ? {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        transform: [{ scale: webScale }],
        transformOrigin: 'center bottom',
      } : {
        flex: 1,
        width: '100%',
        height: '100%',
      }}>

      {/* Tutorial - Show first before main game */}
      {showTutorial ? (
        <Tutorial
          onComplete={handleTutorialComplete}
          flyingRef={flyingRef}
          inventoryRefs={inventoryRefs}
          startAtSlide={tutorialStartSlide}
        />
      ) : showOutro ? (
        <Tutorial
          isOutroMode={true}
          tutorialData={tutorialData}
          onComplete={() => { }} // Not used in outro mode
          onOutroComplete={handleOutroComplete}
          flyingRef={flyingRef}
          inventoryRefs={inventoryRefs}
        />
      ) : (
        <>
          {/* Top Tab */}
          {showWorldEvent && (
            <Animated.View
              style={[
                styles.topTab,
                {
                  width: Math.min(width, MAX_PHONE_WIDTH),
                  opacity: worldEventOpacity,
                },
              ]}
            >
              <Text style={styles.topTabText}>{worldEventText}</Text>
            </Animated.View>
          )}

          {/* Main Game Scene */}
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
                {/* Hint button - inside the virtual scene */}
                <View style={{
                  position: 'absolute',
                  top: 60,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                  zIndex: 1000,
                }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#f0f0f0',
                      borderWidth: 1,
                      borderColor: '#d0d0d0',
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 3,
                    }}
                    onPress={() => setShowHintDialog(true)}
                  >
                    <Text style={{
                      color: '#666',
                      fontSize: 14,
                      fontWeight: '500',
                    }}>Low on items?</Text>
                  </TouchableOpacity>
                </View>

      {specialNpc && (
        <View
          style={{
            position: 'absolute',
            top: VIRTUAL_HEIGHT / 2 - 40, // Centers vertically assuming ~80px sprite height
            left: '50%',
            width: VIRTUAL_WIDTH,
            height: 80,
            transform: [{ translateX: -VIRTUAL_WIDTH / 2 }],
            overflow: 'visible',
          }}
        >
          <Animated.View
            style={{
              transform: [{ translateX: specialNpc.x }],
              position: 'absolute',
            }}
          >
            <TouchableOpacity onPress={handleSpecialNpcPress}>
                        <Image
                          source={specialNpc.sprite}
                          style={{
                            width: 80,
                            height: 80,
                            transform: specialNpc.direction === 'left' ? [{ scaleX: -1 }] : [{ scaleX: 1 }],
                          }}
                          contentFit="contain"
                          transition={0}
                        />
            </TouchableOpacity>
          </Animated.View>

        </View>
      )}


      {renderNpcRow()}
      <View style={styles.blackOverlayBox} />
      {renderResourceSection()}
      {renderFirstTraderHint()}
      {selectedNpcIndex !== null && renderOverlay()}
    </View>

    {/* Left/Right Walls (only for wide screens) */}
    {/* Left/Right Walls (only for wide screens) */}
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
          {renderEventPopup()}
          {renderGameEventOverlay()}
          {renderRestartDialogs()}
        </>
      )}
      </View>
    </View>
  );



}
