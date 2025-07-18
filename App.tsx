//app.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Image,
  Animated

} from 'react-native';

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


//import components
import { TradeScale } from './components/TradeScale';
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



export type ResourceType = 'salt' | 'apples' | 'tools' | 'pottery' | 'shells';
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
    favored: [1.5, 2],
    neutral: [1, 1],
    disliked: [0.5, 0.8],
  },
  apples: {
    favored: [6, 8],
    neutral: [3, 6],
    disliked: [2, 4],
  },
  shells: {
    favored: [12, 15],
    neutral: [8, 12],
    disliked: [6, 10],
  },
  pottery: {
    favored: [15, 20],
    neutral: [9, 15],
    disliked: [7, 12],
  },
  tools: {
    favored: [25, 30],
    neutral: [20, 25],
    disliked: [15, 20],
  },
};

// Used to determine how many units of each resource can appear in trade generation
const resourceQuantityRanges: Record<ResourceType, [number, number]> = {
  salt: [3, 25],
  apples: [2, 8],
  shells: [1, 4],
  pottery: [1, 3],
  tools: [1, 1],
};

export default function App() {


  const [showWorldEvent, setShowWorldEvent] = useState(false);
  const worldEventTimerRef = useRef<NodeJS.Timeout | null>(null);
  const worldEventOpacity = useRef(new Animated.Value(0)).current;

  const { width, height } = useWindowDimensions();

  const [resources, setResources] = useState<Record<ResourceType, number>>({
    salt: 10,
    apples: 5,
    tools: 1,
    pottery: 2,
    shells: 5,
  });

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
  
  //clickable npc traders
  const [npcs, setNpcs] = useState<NPC[]>(Array.from({ length: 3 }, (_, i) => {
    const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];
    const selling = resourcePool[Math.floor(Math.random() * resourcePool.length)];

    const spriteMap: Record<ResourceType, any> = {
      salt: require('./assets/npc_salt.png'),
      apples: require('./assets/npc_apples.png'),
      tools: require('./assets/npc_tools.png'),
      pottery: require('./assets/npc_pottery.png'),
      shells: require('./assets/npc_shells.png'),
    };

    return {
      id: i + 1,
      key: `npc-${i + 1}`,
      sprite: spriteMap[selling],
      selling,
      visible: true,
      direction: Math.random() < 0.5 ? 'left' : 'right',
      speed: Math.floor(200 + Math.random() * 100),
    };
  }));
  

  //trade values
  const [trade, setTrade] = useState<Trade | null>(null);
  const [tradePreferences, setTradePreferences] = useState<TradePreferences | null>(null);
  const [playerOffer, setPlayerOffer] = useState<Partial<Record<ResourceType, number>>>({});
  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);
  const [worldEventText, setWorldEventText] = useState<string>('');
  const [acceptedTradeCount, setAcceptedTradeCount] = useState(0);

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
  






const handleOptionSelect = (option: 'buy' | 'decline') => {
  if (selectedNpcIndex === null) return;

  if (option === 'buy' && trade) {
const unitValues = (setTrade as any).debug?.unitValues || {};
const playerTotal = Object.entries(playerOffer).reduce((total, [key, amount]) => {
  return total + (unitValues[key as ResourceType] || 0) * (amount || 0);
}, 0);

const npcTotal = (setTrade as any).debug?.giveTotalValue || 0;

if (playerTotal >= npcTotal) {
  // Player gives the offered items
  const newResources = { ...resources };


  // Player receives the NPC's item
  newResources[trade.give] += trade.giveAmount;

  setResources(newResources);
} else {
  return; // Not enough value
}

  }

  const index = selectedNpcIndex;
  const exitDirection: Direction = Math.random() < 0.5 ? 'left' : 'right';
  const enterDirection: Direction = Math.random() < 0.5 ? 'left' : 'right';

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
    const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];
    const selling = resourcePool[Math.floor(Math.random() * resourcePool.length)];

    const spriteMap: Record<ResourceType, any> = {
      salt: require('./assets/npc_salt.png'),
      apples: require('./assets/npc_apples.png'),
      tools: require('./assets/npc_tools.png'),
      pottery: require('./assets/npc_pottery.png'),
      shells: require('./assets/npc_shells.png'),
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
  
  
  setSelectedNpcIndex(null);
  setTrade(null);
  setPlayerOffer({});
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
          const isDisabled = !trade || resources[res] <= 0;
          return (
            <TouchableOpacity
              key={res}
              disabled={isDisabled}
              onPress={() => {
                if (isDisabled) return;
                // Remove from player inventory
                setResources(prev => ({
                  ...prev,
                  [res]: prev[res] - 1,
                }));
                // Add to offer
                setPlayerOffer(prev => ({
                  ...prev,
                  [res]: (prev[res] || 0) + 1,
                }));
              }}
            >
              <ResourceDisplay name={res} amount={resources[res]} />
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

      setResources(prevResources => ({
        ...prevResources,
        [res]: (prevResources[res] || 0) + 1,
      }));

      return newOffer;
    });
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
          />
        )}
      </View>
    );
    
    
  };
  





return (
  
  <View style={styles.containerWrapper}>
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

  </View>
);



}
