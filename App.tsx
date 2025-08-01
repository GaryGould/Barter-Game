//app.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Image,
  Animated

} from 'react-native';
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

const resourceIcons: Record<ResourceType, any> = {
  salt: require('./assets/Icons/Salt.png'),
  apples: require('./assets/Icons/apple.png'),
  tools: require('./assets/Icons/Tools.png'),
  pottery: require('./assets/Icons/pottery.png'),
  shells: require('./assets/Icons/shell.png'),
  cow: require('./assets/Icons/cow.png')
};

// --- Warm up (decode) images once so they don't pop in late on first use ---
const WarmDecoder = React.memo(() => (
  <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
    {/* Scale assets that appear inside the trade modal */}
    <Image source={require('./assets/Scale/scaleBeam.png')} style={{ width: 1, height: 1 }} />
    <Image source={require('./assets/Scale/scalePan.png')} style={{ width: 1, height: 1 }} />
    {/* Resource icons used in pans and flying animations */}
    {Object.values(resourceIcons).map((src, i) => (
      <Image key={i} source={src} style={{ width: 1, height: 1 }} />
    ))}
  </View>
));

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

  //world events
  const [showWorldEvent, setShowWorldEvent] = useState(false);
  const worldEventTimerRef = useRef<NodeJS.Timeout | null>(null);
  const specialNpcAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const worldEventOpacity = useRef(new Animated.Value(0)).current;
  const tradeIntroAnimatedRef = useRef(false);

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

  //tap vs hold
  const holdIntervalRef = useRef<null | (() => void)>(null); // store cancel fn from startFrameLoop
  const heldResourceRef = useRef<ResourceType | null>(null);
  // acceleration for add-hold
  const HOLD_BASE_MS = 150;
  const holdDelayRef = useRef(HOLD_BASE_MS);
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

  // --- Pottery fragility ---
  const [potteryTradeCount, setPotteryTradeCount] = useState(0);
  const [pendingPotteryBreak, setPendingPotteryBreak] = useState(false);

  
  // --- Apple spoilage handler (runs when pie animation actually lands at 0) ---
  const handleAppleSpoilage = React.useCallback(() => {
    const invRef = inventoryRefs.current.apples;
    const applesNow = resources.apples || 0;
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
        message: `apples spoiled`,
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
  const handlePotteryBreak = React.useCallback(() => {
    // If we have no pottery, do nothing (pending break logic will handle later)
    setResources(prev => {
      const current = prev.pottery || 0;
      if (current <= 0) return prev;

      // Visuals: one pottery rises + fades from the pottery slot, and a centered label
      const invRef = inventoryRefs.current.pottery;
      if (invRef && typeof (invRef as any).measureInWindow === 'function') {
        (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
          const POTTERY_X_SHIFT = -30; // match apples' fixed horizontal shift
          const iconStart = { x: x + w / 2 + POTTERY_X_SHIFT, y: y  };

          const risePx = 160;   // single visual
          const duration = 2500; // fixed duration

          // Defer to next frame to avoid setState during App render
          nextFrame(() => {
            flyingRef.current?.riseAndFade('pottery', iconStart, risePx, duration);

            const labelStart = { x: x, y: y + h / 2 };
            enqueueEventPopup({
              resource: 'pottery',
              amount: 1,
              message: `pottery broke`,
            });
          });
          
        });
      }

      return { ...prev, pottery: Math.max(0, current - 1) };
    });
  }, [width]);

  // --- Tick pottery fragility each time a trade that involves pottery completes ---
  // If 3 pottery-involving trades occur, we break 1 pottery.
  // If we hit 3 but have 0 pottery, we set a pending flag and wait until the next pottery trade
  // where we *do* have pottery, then break 1 and reset.
  const tickPotteryFragility = React.useCallback(
    (
      trade: Trade,
      playerOffer: Partial<Record<ResourceType, number>>,
      updatedResources: Record<ResourceType, number>
    ) => {
      const involvesPottery =
        trade.give === 'pottery' || ((playerOffer['pottery'] ?? 0) > 0);

      if (!involvesPottery) return;

      setPotteryTradeCount(prevCount => {
        // If a break was pending, try to execute it now *without* incrementing
        if (pendingPotteryBreak) {
          if ((updatedResources.pottery ?? 0) > 0) {
            handlePotteryBreak();
            setPendingPotteryBreak(false);
            return 0; // reset counter after break
          }
          return prevCount; // still pending, keep as-is
        }

        const next = prevCount + 1;
        if (next >= 3) {
          if ((updatedResources.pottery ?? 0) > 0) {
            handlePotteryBreak();
            return 0; // reset after successful break
          } else {
            setPendingPotteryBreak(true); // wait for the next pottery trade where we have >0
            return 3; // hold at threshold while pending
          }
        }
        return next;
      });
    },
    [pendingPotteryBreak, handlePotteryBreak]
  );

  
  const handleTradeCompleted = React.useCallback(
    (trade: Trade, playerOffer: Partial<Record<ResourceType, number>>) => {
      // Does THIS completed trade involve apples?
      const involvesApples =
        trade.give === 'apples' || ((playerOffer['apples'] ?? 0) > 0);

      // If this is the first time apples are involved, flip the flag and show the intro bubble.
      if (involvesApples && !hasSeenAppleTrade) {
        setHasSeenAppleTrade(true);

        // Only show the intro bubble if we have apples after the trade (so it appears next to something visible).
        const applesNow = resources.apples || 0;
        if (applesNow > 0) {
          const invRef = inventoryRefs.current.apples;
          if (invRef && typeof (invRef as any).measureInWindow === 'function') {
            (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
              const start = { x: width / 2, y: y + h / 2 };
              // Reuse your flying text method + timings
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
          const next = Math.max(0, prev - 0.25);
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
  
  // npc traders
  const [npcs, setNpcs] = useState<NPC[]>(() => {
    const initialGoods: ResourceType[] = ['salt', 'pottery', 'apples'];
    const spriteMap: Record<ResourceType, any> = {
      salt: require('./assets/npc_salt.png'),
      apples: require('./assets/npc_apples.png'),
      tools: require('./assets/npc_tools.png'),
      pottery: require('./assets/npc_pottery.png'),
      shells: require('./assets/npc_shells.png'),
      cow: require('./assets/Icons/cow.png'),
    };

    // Sellers currently shown on screen (ignore any trader that's exiting)
    const getVisibleSelling = (list: NPC[]) =>
      new Set(list.filter(n => n.visible && !n.isExiting).map(n => n.selling));

    return initialGoods.map((selling, i) => ({
      id: i + 1,
      key: `npc-${i + 1}`,
      sprite: spriteMap[selling],
      selling,
      visible: true,
      direction: Math.random() < 0.5 ? 'left' : 'right',
      speed: Math.floor(200 + Math.random() * 100),
      isExiting: false,
    }));
  });
  
  

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
  const rejectedTradeCountRef = useRef(0);
  const shellEventTriggeredRef = useRef(false);

  const [specialNpcSpawnedFirstTime, setSpecialNpcSpawnedFirstTime] = useState(false);
  type GameEventType = 'victory' | 'loss' | 'tutorial' | null;
  const [gameEvent, setGameEvent] = useState<GameEventType>(null);
  
  // --- Intro overlay ---
  const [showIntro, setShowIntro] = useState(true);

  // --- Universal event popup queue ---
  type EventPopupData = {
    resource: ResourceType;
    message: string;
    amount?: number | null; // optional number
  };
    const [eventQueue, setEventQueue] = useState<EventPopupData[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventPopupData | null>(null);


  // Called when player taps on an NPC to initiate trade
  const handleNpcPress = (index: number) => {
    const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

    // Choose different give/want resources
    const npc = npcs[index];
    const give: ResourceType = npc.selling;    let want: ResourceType = give;
    while (want === give) {
      want = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    }

    // Generate 1–2 likes and 1–2 dislikes, excluding 'give' and salt for dislikes
    const available = resourcePool.filter(r => r !== give);
    const likeCount = Math.floor(Math.random() * 2) + 1;
    const dislikeCount = Math.floor(Math.random() * 2) + 1;

    const likes: ResourceType[] = [];
    const dislikes: ResourceType[] = [];

    // Pick likes first
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

              // --- Catch-the-pot: only for ACCEPTED trades where TRADER gives pottery ---
              if (trade.give === 'pottery' && Math.random() < 1) {
                // Prefer to start from the NPC (right) pan if we have it
                const rp = rightPanPositionRef.current || rightPanPosition;
                const startX = rp ? rp.x + (Math.random() - 0.5) * 60 : (width / 2 + (Math.random() - 0.5) * 120);
                const startY = rp ? rp.y - 80 : Math.min(140, Math.max(80, height * 0.18));

                nextFrame(() => {
                  flyingRef.current?.dropCatchablePottery(
                    { x: startX, y: startY },
                    {
                      onCaught: () => {
                        // handled inside FlyingResourceManager at the exact tap point
                      },
                      onMiss: () => {
                        // If they miss, use existing break flow to remove 1 & show popup
                        handlePotteryBreak();
                      },
                    }
                  );
                });
                
              }
              // --- End catch-the-pot ---

              handleTradeCompleted(trade, playerOffer);
              // Pottery fragility: count pottery-involving trades and break 1 every 3
              tickPotteryFragility(trade, playerOffer, newResources);
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
      salt: require('./assets/npc_salt.png'),
      apples: require('./assets/npc_apples.png'),
      tools: require('./assets/npc_tools.png'),
      pottery: require('./assets/npc_pottery.png'),
      shells: require('./assets/npc_shells.png'),
      cow: require('./assets/Icons/cow.png')
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
    setResources(prevResources => {
      const updatedResources = { ...prevResources };
      for (const [res, amount] of Object.entries(playerOffer)) {
        if (!amount) continue;
        updatedResources[res as ResourceType] = (updatedResources[res as ResourceType] || 0) + amount;
      }
      return updatedResources;
    });
  }
  // Track declines for shell beach event
  if (!shellEventTriggeredRef.current) {
    rejectedTradeCountRef.current += 1;
    if (rejectedTradeCountRef.current >= 5) {
      shellEventTriggeredRef.current = true;
      triggerShellBeachEvent();
    }
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
                activeOpacity={0.7}
                delayPressIn={0}
                delayLongPress={0}
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
                  holdDelayRef.current = HOLD_BASE_MS;

                  // guard any stray timer
                  if (holdIntervalRef.current) {
                    holdIntervalRef.current(); // cancel prior frame loop
                    holdIntervalRef.current = null;
                  }

                  const tick = () => {
                    if (heldResourceRef.current !== res) return;

                    sendItem();
                    holdCountRef.current += 1;

                    if (holdCountRef.current >= 3) {
                      const minDelay = HOLD_BASE_MS * 0.35;          // floor = 10% of base
                      const next = Math.max(minDelay, holdDelayRef.current * 0.90); // speed up 10%
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
                  holdDelayRef.current = HOLD_BASE_MS;
                  
                
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
                    {res === 'apples' && hasSeenAppleTrade && resources.apples > 0 && (
                      <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                        <PieTimer
                          progress={freezeApplePieAtZero ? 0 : appleTimer}
                          animate={!pieShouldInstantJumpToOne}
                          onDepleted={() => {
                            // 1) Do the spoilage + text visuals.
                            handleAppleSpoilage();

                            // 2) Pin the UI at 0 while the text bubble is visible.
                            setFreezeApplePieAtZero(true);

                            // 3) Prep the next cycle immediately (jump to full while hidden).
                            setPieShouldInstantJumpToOne(true);
                            setAppleTimer(1);
                            setHasSpoilageTriggered(false);

                            // 4) When the text finishes, unfreeze to reveal the full meter.
                            setTimeout(() => {
                              setFreezeApplePieAtZero(false);
                            }, SPOIL_LABEL_RISE_MS + SPOIL_LABEL_LINGER_MS);
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
    const direction: Direction = Math.random() < 0.5 ? 'left' : 'right';
    const sprite = require('./assets/npc_special.png');
    const SPRITE_WIDTH = 80;
    const BUFFER = SPRITE_WIDTH + 20;

    const startX = direction === 'left' ? VIRTUAL_WIDTH + BUFFER : -BUFFER;
    const endX = direction === 'left' ? -BUFFER : VIRTUAL_WIDTH + BUFFER;

    specialNpcDirection.current = direction;
    specialNpcStart.current = startX;
    specialNpcEnd.current = endX;
    specialNpcAnimX.setValue(startX);
    specialNpcCurrentX.current = startX;
    specialNpcAnimX.removeAllListeners();
    specialNpcAnimX.addListener(({ value }) => {
      specialNpcCurrentX.current = value;
    });    specialNpcPaused.current = false;
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

      const dt = (timestamp - specialNpcLastTimestamp.current) / 1000; // seconds
      specialNpcLastTimestamp.current = timestamp;

      const current = specialNpcCurrentX.current;
      const directionFactor = direction === 'left' ? -1 : 1;
      const nextX = current + specialNpcSpeed * dt * directionFactor;

      const finished = direction === 'left' ? nextX <= endX : nextX >= endX;

      if (finished) {
        setSpecialNpc(null);
        specialNpcAnimX.removeAllListeners();
        setTimeout(spawnSpecialNpc, 6000);
        return;
      }

      specialNpcAnimX.setValue(nextX);
      specialNpcRequestRef.current = requestAnimationFrame(animate);
    };

    specialNpcRequestRef.current = requestAnimationFrame(animate);
  };
  
  const triggerShellBeachEvent = React.useCallback(() => {
    // 1. Halve all shell values
    editablePointRanges.shells.favored = editablePointRanges.shells.favored.map(v => v / 2) as [number, number];
    editablePointRanges.shells.neutral = editablePointRanges.shells.neutral.map(v => v / 2) as [number, number];
    editablePointRanges.shells.disliked = editablePointRanges.shells.disliked.map(v => v / 2) as [number, number];

    // 2. Queue the popup message
    enqueueEventPopup({
      resource: 'shells',
      message: 'washed up on the beach, decreasing their value by half!',
      amount: null, // no number
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
  }, [width, height]);

  
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
            onPress={() => setGameEvent(null)}
          >
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
      const [, ...rest] = prev;
      if (rest.length > 0) {
        setActiveEvent(rest[0]);
      } else {
        setActiveEvent(null);
      }
      return rest;
    });
  }, []);

  // --- Popup Renderer --- 
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
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            maxWidth: 320,
            borderWidth: 1,
            borderColor: '#ccc',
          }}
        >
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
  
  

  // --- Intro overlay ---
  const renderIntroOverlay = () => {
    if (!showIntro) return null;
    return (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
        pointerEvents="auto"
      >
        <View
          style={{
            maxWidth: 520,
            width: '90%',
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#dddddd',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <Text
            style={{
              color: '#111111',
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            Welcome to the market!
          </Text>

          <Text
            style={{
              color: '#333333',
              fontSize: 16,
              lineHeight: 22,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Make smart trades, work your way up, and barter for the ultimate prize: a cow!
          </Text>

          <TouchableOpacity
            onPress={() => setShowIntro(false)}
            style={{
              alignSelf: 'center',
              paddingVertical: 12,
              paddingHorizontal: 18,
              backgroundColor: '#2ecc71',
              borderRadius: 10,
              minWidth: 180,
            }}
          >
            <Text
              style={{
                color: '#0b2b13',
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              Start trading!
            </Text>
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
  



  // Render ONLY the intro screen until the player taps Start trading!
  if (showIntro) {
    return (
      <View style={styles.containerWrapper}>
        <WarmDecoder />
        {renderIntroOverlay()}
      </View>
    );
  }

  return (

    <View style={styles.containerWrapper}>
      <WarmDecoder />

      {renderIntroOverlay()}

    <FlyingResourceManager ref={flyingRef} />

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
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Animated.View>

        </View>
      )}


      {renderNpcRow()}
      <View style={styles.blackOverlayBox} />
      {renderResourceSection()}
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
  </View>
);



}
