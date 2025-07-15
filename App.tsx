import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
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

export default function App() {
  const { width, height } = useWindowDimensions();

  const [resources, setResources] = useState<Record<ResourceType, number>>({
    salt: 0,
    apples: 5,
    tools: 0,
    pottery: 0,
    shells: 0,
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

  const [selectedNpcIndex, setSelectedNpcIndex] = useState<number | null>(null);

  const handleNpcPress = (index: number) => {
    setSelectedNpcIndex(index);
  };

  const handleOptionSelect = (option: 'buy' | 'decline') => {
    if (selectedNpcIndex === null) return;

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

const renderOverlay = () => (
  <View style={styles.overlay}>
    <TouchableOpacity style={styles.button} onPress={() => handleOptionSelect('buy')}>
      <Text style={styles.buttonText}>Buy</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} onPress={() => handleOptionSelect('decline')}>
      <Text style={styles.buttonText}>Decline</Text>
    </TouchableOpacity>
  </View>
);

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
