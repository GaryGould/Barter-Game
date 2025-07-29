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

  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const [currentProgress, setCurrentProgress] = useState(progress);

  useEffect(() => {
    if (animate) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 400,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.stopAnimation();
      animatedProgress.setValue(progress);
    }
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
      <Svg width={radius * 2} height={radius * 2}>
        <Circle cx={radius} cy={radius} r={radius} fill="#ccc" />
        <Circle cx={radius} cy={radius} r={radius * 0.5} fill="black" />
      </Svg>
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
    <Svg width={radius * 2} height={radius * 2}>
      <Circle cx={radius} cy={radius} r={radius} fill="#ccc" />
      <Path d={d} fill="#3cb043" />
      <Circle cx={radius} cy={radius} r={radius * 0.5} fill="black" />
    </Svg>
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
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heldResourceRef = useRef<ResourceType | null>(null);

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

  //fruit decaying 
  const [appleTimer, setAppleTimer] = useState(1);  // 1 = full pie
  const [hasSeenAppleTrade, setHasSeenAppleTrade] = useState(false);
  const [hasSpoilageTriggered, setHasSpoilageTriggered] = useState(false);
  // keep the UI pinned at 0 right after spoilage, even if appleTimer resets to 1
  const [freezeApplePieAtZero, setFreezeApplePieAtZero] = useState(false);
  // on the first frame of the next cycle, jump to 1 without animation, then animate down
  const [pieShouldInstantJumpToOne, setPieShouldInstantJumpToOne] = useState(false);


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

    if (invRef && typeof (invRef as any).measureInWindow === 'function') {
      (invRef as any).measureInWindow((x: number, y: number, w: number, h: number) => {
        const start = { x: x + w / 2, y: y + h / 2 };
        for (let i = 0; i < visuals; i++) {
          const jitterX = (Math.random() - 0.5) * 14;   // small horizontal variety
          const risePx = 60 + Math.random() * 20;       // vary rise distance a bit
          const duration = 550 + Math.random() * 200;   // vary duration a bit
          setTimeout(() => {
            flyingRef.current?.riseAndFade(
              'apples',
              { x: start.x + jitterX, y: start.y },
              risePx,
              duration
            );
          }, i * 60); // slight staggering
        }

        // NEW: white text bubble, rises slower and stays longer before fading
        flyingRef.current?.riseLabel(
          `${loss} apples spoiled`,
          start,
          90,     // rise a bit higher than icons
          1400,   // slower/longer total rise duration
          700     // linger ~0.7s before starting the fade
        );
      });
  
    }

    // Deduct inventory
    setResources(prev => ({
      ...prev,
      apples: Math.max(0, (prev.apples || 0) - loss),
    }));
  }, [resources.apples]);


  
  const handleTradeCompleted = React.useCallback(
    (trade: Trade, playerOffer: Partial<Record<ResourceType, number>>) => {
      if (!hasSeenAppleTrade && (trade.give === 'apples' || (playerOffer['apples'] ?? 0) > 0)) {
        setHasSeenAppleTrade(true);
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
    [hasSeenAppleTrade]
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

    return initialGoods.map((selling, i) => ({
      id: i + 1,
      key: `npc-${i + 1}`,
      sprite: spriteMap[selling],
      selling,
      visible: true,
      direction: Math.random() < 0.5 ? 'left' : 'right',
      speed: Math.floor(200 + Math.random() * 100),
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

  const [specialNpcSpawnedFirstTime, setSpecialNpcSpawnedFirstTime] = useState(false);
  type GameEventType = 'victory' | 'loss' | 'tutorial' | null;
  const [gameEvent, setGameEvent] = useState<GameEventType>(null);

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
            setTimeout(() => {
              flyingRef.current?.fly(trade.give, rightPanPosition, target);
            }, i * flyDuration);
          }

          setTimeout(() => {
            const newResources = { ...resources };
            newResources[trade.give] += trade.giveAmount;
            setResources(newResources);
            // after setResources(...)
            const appleCountAfter = newResources.apples;
            if (appleCountBefore === 0 && appleCountAfter > 0) {
              setAppleTimer(1); // reset pie to full if we just gained apples after having 0
            }

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
      };
      return updated;
    });
  

  const safeExitDelay = (VIRTUAL_WIDTH / 300) * 1000;

  setTimeout(() => {
    let basePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

    let selling: ResourceType;

    // Force salt to be sold if player has none and it hasn't been offered recently
    if (!recentlyOfferedGoods.includes('salt') && resources.salt === 0) {
      selling = 'salt';
    } else {
      // Filter out recently offered goods
      const filtered = basePool.filter(r => !recentlyOfferedGoods.includes(r));

      // Fallback if everything was recently offered
      const eligible = filtered.length > 0 ? filtered : basePool;

      // Weight salt higher in the random pool
      const weightedPool = eligible.flatMap(r =>
        r === 'salt' ? Array(5).fill(r) : [r]
      );

      // Pick one at random
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
  
  
  // Wait ~600ms to let flying animations finish before unmounting the modal
    setSelectedNpcIndex(null);
    setTrade(null);
    setPlayerOffer({});
  // Stop hold-to-add
  heldResourceRef.current = null;
  if (holdIntervalRef.current) {
    clearInterval(holdIntervalRef.current);
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
      triggerWorldEvent();
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
                        if (!leftPanPosition) return;
                        const start = { x: x + width / 2, y: y + height / 2 };
                        const destination = leftPanPosition;

                        // Defer fly() to avoid setState during render/layout
                        setTimeout(() => {
                          flyingRef.current?.fly(res, start, destination);
                        }, 0);
                      });

                      return updated;
                    });
                  };
                  

                  sendItem(); // Immediately send one
                  holdIntervalRef.current = setInterval(sendItem, 150); // Repeat every 150ms
                }}
                onPressOut={() => {
                  heldResourceRef.current = null;
                  if (holdIntervalRef.current) {
                    clearInterval(holdIntervalRef.current);
                    holdIntervalRef.current = null;
                  }
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
                            // First: do the actual spoilage and visuals.
                            handleAppleSpoilage();

                            // Then: pin UI at 0 briefly and reset the timer for the next cycle.
                            setFreezeApplePieAtZero(true);
                            setPieShouldInstantJumpToOne(true);
                            setAppleTimer(1);
                            setHasSpoilageTriggered(false);
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

          setTimeout(() => {
            flyingRef.current?.fly(res, start, end);
          }, 0);        });
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
        setWorldEventText('Storm washes up seashells, prices go down');
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
            onLeftPanMeasured={setLeftPanPosition}
            onRightPanMeasured={setRightPanPosition}
            introAnimatedRef={tradeIntroAnimatedRef}
          />
        )}
      </View>
    );
    
    
  };
  





return (
  
  <View style={styles.containerWrapper}>
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
    {renderGameEventOverlay()}
  </View>
);



}
