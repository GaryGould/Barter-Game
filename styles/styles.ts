import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
topTab: {
  position: 'absolute',
  top: 20, // avoid notch / status bar
  alignSelf: 'center',
  paddingHorizontal: 24,
  paddingVertical: 10,
  backgroundColor: 'black',
  borderRadius: 20,
  zIndex: 100,
},
topTabText: {
  color: 'white',
  fontSize: 16,
  textAlign: 'center',
  userSelect: 'none' as const,
},


containerWrapper: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  top: 0,
  justifyContent: 'flex-end',
  alignItems: 'center',
  backgroundColor: '#000',
  overflow: 'hidden',
},


  container: {
    width: 390,
    height: 844,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },

  npcRow: {
    position: 'absolute',
    bottom: 200, // consistent offset from bottom
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    userSelect: 'none' as const,
  },
  tradeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
    flexDirection: 'column',
    gap: 12,
  },

  blackOverlayBox: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 180,
    backgroundColor: 'black',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 5,
  },
wallSide: {
  position: 'absolute',
  top: 0,
  bottom: 0,
  backgroundColor: 'black',
  zIndex: 99,
},
resourceSection: {
  position: 'absolute',
  bottom: 0,
  width: '100%',
  paddingVertical: 12,
  alignItems: 'center',
  zIndex: 6, 
},

resourceRow: {
  flexDirection: 'row',
  justifyContent: 'space-evenly',
  width: '100%',
  marginVertical: 4,
},
  victoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99,
  },
  victoryTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
    userSelect: 'none' as const,
  },
  victoryEmoji: {
    fontSize: 80,
    userSelect: 'none' as const,
  },
  victorySubtitle: {
    fontSize: 18,
    marginTop: 30,
    textAlign: 'center',
    userSelect: 'none' as const,
  },
  victoryButton: {
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  victoryButtonText: {
    color: 'white',
    fontSize: 16,
    userSelect: 'none' as const,
  },
  // --- Event popup ---
  eventPopupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  eventTextLg: {
    fontSize: 20,
    lineHeight: 24,
    color: '#222',
    textAlign: 'center',
    flexShrink: 1,
    userSelect: 'none' as const,
  },
  eventIconLg: {
    width: 36,
    height: 36,
    marginHorizontal: 4,
  },

});

// Helper style to prevent image selection and dragging
export const noSelectImage = {
  userSelect: 'none' as const,
  WebkitUserSelect: 'none' as const,
  MozUserSelect: 'none' as const,
  msUserSelect: 'none' as const,
  WebkitUserDrag: 'none' as const,
  userDrag: 'none' as const,
  pointerEvents: 'auto' as const,
} as any;

// Helper style to prevent text selection
export const noSelectText = {
  userSelect: 'none' as const,
} as const;
