//app.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Image
} from 'react-native';
import { styles } from './styles';
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
let fairTradeCounter = 0;

import { NPCSlot } from './components/NPCSlot';
import { ResourceDisplay } from './components/ResourceDisplay';

type Direction = 'left' | 'right';

type NPC = {
  id: number;
  key: string;
  sprite: any;
  visible: boolean;
  direction: Direction;
  speed: number;
};
type ResourceType = 'salt' | 'apples' | 'tools' | 'pottery' | 'shells';
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

// Each resource has a hidden point value range used during trade generation
const resourcePointRanges: Record<ResourceType, [number, number]> = {
  salt: [1, 1],
  apples: [3, 6],
  shells: [8, 12],
  pottery: [9, 15],
  tools: [20, 25],
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
  const { width, height } = useWindowDimensions();

  const [resources, setResources] = useState<Record<ResourceType, number>>({
    salt: 10,
    apples: 5,
    tools: 1,
    pottery: 2,
    shells: 5,
  });


  //clickable npc traders
  const [npcs, setNpcs] = useState<NPC[]>([
    {
      id: 1,
      key: 'npc-1',
      sprite: require('./assets/npc1.png'),
      visible: true,
      direction: 'left',
      speed: Math.floor(200 + Math.random() * 100),
    },
    {
      id: 2,
      key: 'npc-2',
      sprite: require('./assets/npc1.png'),
      visible: true,
      direction: 'right',
      speed: Math.floor(200 + Math.random() * 100),
    },
    {
      id: 3,
      key: 'npc-3',
      sprite: require('./assets/npc1.png'),
      visible: true,
      direction: 'left',
      speed: Math.floor(200 + Math.random() * 100),
    },
  ]);

  const [trade, setTrade] = useState<Trade | null>(null);
  const [playerOffer, setPlayerOffer] = useState<Partial<Record<ResourceType, number>>>({});

  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);

  // Called when player taps on an NPC to initiate trade
  const handleNpcPress = (index: number) => {
  const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

  // When a trade starts, each resource is assigned a fixed value that lasts the whole trade
  const assignUnitValues = (): Record<ResourceType, number> => {
    const unitValues: Record<ResourceType, number> = {} as Record<ResourceType, number>;
    resourcePool.forEach(resource => {
      const [min, max] = resourcePointRanges[resource];
      const randomValue = min + Math.random() * (max - min);
      unitValues[resource] = parseFloat(randomValue.toFixed(2));
    });
    return unitValues;
  };

  const generateTrade = (unitValues: Record<ResourceType, number>, forceAffordable = false): Trade | null => {

    // Randomly choose different resource types for NPC's offer vs what they want
    let give: ResourceType = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    let want: ResourceType = give;
    while (want === give) {
      want = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    }

    const giveUnitValue = unitValues[give];
    const wantUnitValue = unitValues[want];

    const [minGiveQty, maxGiveQty] = resourceQuantityRanges[give];
    const giveAmount = Math.floor(Math.random() * (maxGiveQty - minGiveQty + 1)) + minGiveQty;
    const totalValue = giveAmount * giveUnitValue;
    const wantAmount = Math.ceil(totalValue / wantUnitValue);



    
const tradeData: Trade = { give, giveAmount, want, wantAmount };
setTrade(tradeData);
(setTrade as any).debug = {
  unitValues,
  giveUnitValue,
  wantUnitValue,
  giveTotalValue: giveUnitValue * giveAmount,
};
return tradeData;
  };

  // generate all unit values once per trade, store for consistent fairness
  const unitValues = assignUnitValues();

  fairTradeCounter = (fairTradeCounter + 1) % 3;
const newTrade = generateTrade(unitValues);
  if (!newTrade) return;

  setTrade(newTrade);
  setSelectedNpcIndex(index);
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
    const newNpc: NPC = {
      id: Math.floor(Math.random() * 10000),
      key: Date.now().toString(),
      sprite: require('./assets/npc1.png'),
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

  setSelectedNpcIndex(null);
  setTrade(null);
  setPlayerOffer({});

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




const renderOverlay = () => {
  if (!trade) return null;

  const unitValues = (setTrade as any).debug?.unitValues || {};
  const npcValue = (unitValues[trade.give] || 0) * trade.giveAmount;

  const playerTotal = Object.entries(playerOffer).reduce((sum, [res, qty]) => {
    return sum + (unitValues[res as ResourceType] || 0) * (qty || 0);
  }, 0);

  const hasEnough = playerTotal >= npcValue;

  return (
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          alignItems: 'center',
          maxWidth: 320,
          width: '100%',
        }}
        pointerEvents="auto"
      >
        {/* Value Comparison */}
        <Text style={{ textAlign: 'center', fontSize: 16, marginBottom: 10 }}>
          Trader's Offer: {npcValue.toFixed(2)} pts
        </Text>
        <Text style={{ textAlign: 'center', fontSize: 16, marginBottom: 16 }}>
          Your Offer: {playerTotal.toFixed(2)} pts
        </Text>

        {/* Trader Offer */}
        <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Trader Offers:</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Image source={resourceIcons[trade.give]} style={{ width: 32, height: 32, marginRight: 8 }} />
          <Text>{trade.giveAmount} {trade.give}</Text>
        </View>

        {/* Player Offer */}
        <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Your Offer:</Text>
        {Object.entries(playerOffer).length === 0 ? (
          <Text style={{ color: 'gray', marginBottom: 6 }}>(Tap your items below to offer)</Text>
        ) : (
          Object.entries(playerOffer).map(([key, amount]) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                setPlayerOffer(prev => {
                  const updated = { ...prev };
                  if (updated[key as ResourceType]! > 1) {
                    updated[key as ResourceType]!--;
                  } else {
                    delete updated[key as ResourceType];
                  }
                  return updated;
                });
                setResources(prev => ({
                  ...prev,
                  [key as ResourceType]: prev[key as ResourceType] + 1,
                }));
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Image source={resourceIcons[key as ResourceType]} style={{ width: 24, height: 24, marginRight: 6 }} />
                <Text>{amount} {key}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Accept Trade(if player has offered enough) / Decline (return items)*/}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.button, { opacity: hasEnough ? 1 : 0.5 }]}
            onPress={() => hasEnough && handleOptionSelect('buy')}
            disabled={!hasEnough}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => handleOptionSelect('decline')}
          >
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};





return (
  <View style={styles.containerWrapper}>
    {/* Top Tab */}
    <View style={[styles.topTab, { width: Math.min(width, MAX_PHONE_WIDTH) }]}>
      <Text style={styles.topTabText}>Sample Text</Text>
    </View>

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
    {width > MAX_PHONE_WIDTH && (
      <View style={[styles.wallSide, { width: 600, left: -600 }]} />
    )}
    {width > MAX_PHONE_WIDTH && (
      <View style={[styles.wallSide, { width: 600, right: -600 }]} />
    )}
  </View>
);



}
