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

  const generateUnitValue = (resource: ResourceType): number => {
    const [min, max] = resourcePointRanges[resource];
    return min + Math.random() * (max - min);
  };

  const generateTrade = (forceAffordable = false): Trade | null => {
    let give: ResourceType = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    let want: ResourceType = give;
    while (want === give) {
      want = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    }

    const giveUnitValue = generateUnitValue(give);
    const wantUnitValue = generateUnitValue(want);

    const giveIsExpensive = giveUnitValue > wantUnitValue;

    const expensive = giveIsExpensive ? give : want;
    const cheap = giveIsExpensive ? want : give;

    const [minQty, maxQty] = resourceQuantityRanges[expensive];
    const expQty = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
    const totalValue = expQty * (giveIsExpensive ? giveUnitValue : wantUnitValue);
    const cheapQty = Math.ceil(totalValue / (giveIsExpensive ? wantUnitValue : giveUnitValue));

    const giveAmount = giveIsExpensive ? expQty : cheapQty;
    const wantAmount = giveIsExpensive ? cheapQty : expQty;

    const playerCanAfford = resources[want] >= wantAmount;

    if (!forceAffordable || playerCanAfford) {
      setTrade({ give, giveAmount, want, wantAmount });
      (setTrade as any).debug = {
        giveUnitValue,
        wantUnitValue,
        giveTotalValue: giveUnitValue * giveAmount,
        wantTotalValue: wantUnitValue * wantAmount,
        forced: forceAffordable,
      };
      return { give, giveAmount, want, wantAmount };
    }

    // Fallback: pick a want item from player's inventory
    const affordableResources = resourcePool.filter(r => resources[r] > 0);
    if (affordableResources.length === 0) return null;

    const fallbackWant = affordableResources[Math.floor(Math.random() * affordableResources.length)];
    const fallbackWantUnit = generateUnitValue(fallbackWant);

    const fallbackMax = Math.min(resourceQuantityRanges[fallbackWant][1], resources[fallbackWant]);
    const fallbackMin = resourceQuantityRanges[fallbackWant][0];
    if (fallbackMax < fallbackMin) return null;

    const fallbackWantQty = Math.floor(Math.random() * (fallbackMax - fallbackMin + 1)) + fallbackMin;
    const fallbackTotalValue = fallbackWantQty * fallbackWantUnit;

    let fallbackGive = fallbackWant;
    while (fallbackGive === fallbackWant) {
      fallbackGive = resourcePool[Math.floor(Math.random() * resourcePool.length)];
    }

    const fallbackGiveUnit = generateUnitValue(fallbackGive);
    const fallbackGiveQty = Math.ceil(fallbackTotalValue / fallbackGiveUnit);

    setTrade({
      give: fallbackGive,
      giveAmount: fallbackGiveQty,
      want: fallbackWant,
      wantAmount: fallbackWantQty,
    });

    (setTrade as any).debug = {
      giveUnitValue: fallbackGiveUnit,
      wantUnitValue: fallbackWantUnit,
      giveTotalValue: fallbackGiveUnit * fallbackGiveQty,
      wantTotalValue: fallbackWantUnit * fallbackWantQty,
    };

    return {
      give: fallbackGive,
      giveAmount: fallbackGiveQty,
      want: fallbackWant,
      wantAmount: fallbackWantQty,
    };
  };

  fairTradeCounter = (fairTradeCounter + 1) % 3;
const trade = generateTrade(fairTradeCounter === 0) || generateTrade(false);
if (!trade) return;

setTrade(trade);
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
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: 'white', textAlign: 'center', fontSize: 14 }}>
      {(setTrade as any).debug.forced ? 'Fair trade (forced)' : 'Normal trade'}
    </Text>
    <Text style={{ color: 'white', textAlign: 'center', fontSize: 14, marginTop: 4 }}>
      {`${trade.giveAmount} ${trade.give} × ${(setTrade as any).debug.giveUnitValue.toFixed(2)} = ${(setTrade as any).debug.giveTotalValue.toFixed(2)} pts`}
    </Text>
    <Text style={{ color: 'white', textAlign: 'center', fontSize: 14 }}>
      {`${trade.wantAmount} ${trade.want} × ${(setTrade as any).debug.wantUnitValue.toFixed(2)} = ${(setTrade as any).debug.wantTotalValue.toFixed(2)} pts`}
    </Text>
  </View>
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
