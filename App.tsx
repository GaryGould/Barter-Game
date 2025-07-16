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

const wallWidth = 600;
const wallLeftPos = 0 - wallWidth;
const wallRightPos = 0 - wallWidth;

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

//hidden point value to determine trades
const resourcePointRanges: Record<ResourceType, [number, number]> = {
  salt: [1, 1],
  apples: [3, 6],
  shells: [8, 12],
  pottery: [9, 15],
  tools: [20, 25],
};

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
  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);

const handleNpcPress = (index: number) => {
  const resourcePool: ResourceType[] = ['salt', 'apples', 'tools', 'pottery', 'shells'];

  // Pick two different resources
  let give: ResourceType = resourcePool[Math.floor(Math.random() * resourcePool.length)];
  let want: ResourceType = give;
  while (want === give) {
    want = resourcePool[Math.floor(Math.random() * resourcePool.length)];
  }

  // Roll point values
  const [giveMinVal, giveMaxVal] = resourcePointRanges[give];
  const giveUnitValue = giveMinVal + Math.random() * (giveMaxVal - giveMinVal);

  const [wantMinVal, wantMaxVal] = resourcePointRanges[want];
  const wantUnitValue = wantMinVal + Math.random() * (wantMaxVal - wantMinVal);

  // Determine which is more valuable per unit
  const giveIsExpensive = giveUnitValue > wantUnitValue;

  // Roll quantity for the more valuable item
  const expensiveResource = giveIsExpensive ? give : want;
  const [minQty, maxQty] = resourceQuantityRanges[expensiveResource];
  const expensiveQty = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

  // Compute total value
  const totalValue = (giveIsExpensive ? giveUnitValue : wantUnitValue) * expensiveQty;

  // Compute needed amount for cheaper resource (rounded up)
  const cheapUnitValue = giveIsExpensive ? wantUnitValue : giveUnitValue;
  const cheapQty = Math.ceil(totalValue / cheapUnitValue);

  // Assign final values to trade struct
  const giveAmount = giveIsExpensive ? expensiveQty : cheapQty;
  const wantAmount = giveIsExpensive ? cheapQty : expensiveQty;

  setTrade({ give, giveAmount, want, wantAmount });

  // Attach debug info
  (setTrade as any).debug = {
    giveUnitValue,
    wantUnitValue,
    giveTotalValue: giveUnitValue * giveAmount,
    wantTotalValue: wantUnitValue * wantAmount,
  };

  setSelectedNpcIndex(index);
};




const handleOptionSelect = (option: 'buy' | 'decline') => {
  if (selectedNpcIndex === null) return;

  if (option === 'buy' && trade) {
    const playerHasEnough = resources[trade.want] >= trade.wantAmount;
    if (playerHasEnough) {
      setResources(prev => ({
        ...prev,
        [trade.want]: prev[trade.want] - trade.wantAmount,
        [trade.give]: prev[trade.give] + trade.giveAmount,
      }));
    } else {
      return; // Not enough, abort
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
};


const renderNpcRow = () => (
  <View style={styles.npcRow}>
    {npcs.map((npc, index) => (
      <NPCSlot key={npc.key} npc={npc} onPress={() => handleNpcPress(index)} />
    ))}
  </View>
);

const renderResourceSection = () => (
  <View style={styles.resourceSection}>
    <View style={styles.resourceRow}>
      <ResourceDisplay name="salt" amount={resources.salt} />
      <ResourceDisplay name="apples" amount={resources.apples} />
    </View>
    <View style={styles.resourceRow}>
      <ResourceDisplay name="tools" amount={resources.tools} />
      <ResourceDisplay name="pottery" amount={resources.pottery} />
      <ResourceDisplay name="shells" amount={resources.shells} />
    </View>
  </View>
);

const renderOverlay = () => {
  if (!trade) return null;

  const hasEnough = resources[trade.want] >= trade.wantAmount;

  return (
<View style={styles.tradeOverlay}>

  {/* debug trade values*/}
{(setTrade as any).debug && (
  <Text style={{ color: 'white', marginBottom: 8, textAlign: 'center' }}>
    {`${trade.giveAmount} ${trade.give} × ${((setTrade as any).debug.giveUnitValue).toFixed(2)} = ${((setTrade as any).debug.giveTotalValue).toFixed(2)} pts\n` +
      `${trade.wantAmount} ${trade.want} × ${((setTrade as any).debug.wantUnitValue).toFixed(2)} = ${((setTrade as any).debug.wantTotalValue).toFixed(2)} pts`}
  </Text>
)}

  {/* Trade Line */}
<View style={{ alignItems: 'center', marginBottom: 12 }}>
  <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>Selling:</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
    <Image source={resourceIcons[trade.give]} style={{ width: 32, height: 32, marginRight: 8 }} />
    <Text style={styles.buttonText}>{trade.giveAmount} {trade.give}</Text>
  </View>

  <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>Wants:</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image source={resourceIcons[trade.want]} style={{ width: 32, height: 32, marginRight: 8 }} />
    <Text style={styles.buttonText}>{trade.wantAmount} {trade.want}</Text>
  </View>
</View>


  {/* Accept + Decline buttons side by side */}
  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
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
