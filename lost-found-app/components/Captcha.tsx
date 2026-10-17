import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CaptchaProps {
  onVerify: (success: boolean) => void;
  width?: number;
}

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const COLORS = ['#1F2937', '#4F46E5', '#047857', '#B91C1C', '#0369A1', '#4338CA', '#A21CAF'];

export const VisualCaptcha: React.FC<CaptchaProps> = ({ onVerify, width }) => {
  // Measure the real container so the noise covers it exactly (no overflow on small screens).
  const [measuredWidth, setMeasuredWidth] = useState(width || Dimensions.get('window').width - 100);
  const containerWidth = width || measuredWidth;
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);
  const [chars, setChars] = useState<any[]>([]);
  const [dots, setDots] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  const generateCaptcha = useCallback(() => {
    onVerify(false);
    setVerified(false);
    setError(false);
    setInputCode('');

    let newCode = '';
    const newChars = [];
    for (let i = 0; i < 5; i++) {
      const char = CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
      newCode += char;
      newChars.push({
        id: i,
        char,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        fontSize: 24 + Math.random() * 12, // 24 to 36
        rotation: `${(Math.random() - 0.5) * 60}deg`, // -30deg to 30deg
        marginLeft: i === 0 ? 10 : 0,
        marginTop: (Math.random() - 0.5) * 15,
      });
    }
    setCode(newCode);
    setChars(newChars);

    // Generate noise dots
    const newDots = [];
    for (let i = 0; i < 40; i++) {
      newDots.push({
        id: i,
        left: Math.random() * containerWidth,
        top: Math.random() * 60,
        size: 2 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    setDots(newDots);

    // Generate noise lines
    const newLines = [];
    for (let i = 0; i < 6; i++) {
      newLines.push({
        id: i,
        left: -10 + Math.random() * containerWidth,
        top: Math.random() * 60,
        width: 30 + Math.random() * 100,
        rotation: `${(Math.random() - 0.5) * 180}deg`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    setLines(newLines);
  }, [containerWidth, onVerify]);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  const handleVerify = () => {
    if (inputCode.toUpperCase() === code) {
      setVerified(true);
      setError(false);
      onVerify(true);
    } else {
      setError(true);
      setVerified(false);
      onVerify(false);
      generateCaptcha();
    }
  };

  if (verified) {
    return (
      <View 
        className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl overflow-hidden flex-row items-center justify-center p-4"
      >
        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        <Text className="text-emerald-800 dark:text-emerald-200 font-bold ml-2">Verified</Text>
      </View>
    );
  }

  return (
    <View
      style={{ width: '100%' }}
      onLayout={e => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (!width && w > 0 && Math.abs(w - measuredWidth) > 4) setMeasuredWidth(w);
      }}
    >
      <View className="mb-2">
        <Text className="text-sm text-textLight dark:text-textLight-dark mb-1 font-medium">Verify you are human</Text>
        <View 
          className="bg-white dark:bg-gray-100 border border-gray-300 rounded-lg overflow-hidden relative"
          style={{ height: 60, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
        >
          {/* Noise Dots */}
          {dots.map(dot => (
            <View key={`dot-${dot.id}`} style={{ position: 'absolute', left: dot.left, top: dot.top, width: dot.size, height: dot.size, backgroundColor: dot.color, opacity: 0.5, borderRadius: dot.size/2 }} />
          ))}

          {/* Noise Lines */}
          {lines.map(line => (
            <View key={`line-${line.id}`} style={{ position: 'absolute', left: line.left, top: line.top, width: line.width, height: 1.5, backgroundColor: line.color, opacity: 0.4, transform: [{ rotate: line.rotation }] }} />
          ))}

          {/* Text Characters */}
          {chars.map(char => (
            <Text 
              key={`char-${char.id}`} 
              style={{
                fontSize: char.fontSize,
                fontWeight: '900',
                color: char.color,
                marginLeft: char.marginLeft,
                marginRight: 4,
                transform: [{ rotate: char.rotation }],
                marginTop: char.marginTop,
                fontFamily: 'serif'
              }}
            >
              {char.char}
            </Text>
          ))}

          <TouchableOpacity 
            style={{ position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(255,255,255,0.7)', padding: 4, borderRadius: 20 }}
            onPress={generateCaptcha}
          >
            <Ionicons name="refresh" size={16} color="#4b5563" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row">
        <TextInput
          className={`flex-1 bg-muted dark:bg-muted-dark border ${error ? 'border-danger' : 'border-line dark:border-line-dark'} rounded-xl px-4 py-3 text-text dark:text-text-dark`}
          placeholder="Enter the code..."
          placeholderTextColor="#9CA3AF"
          value={inputCode}
          onChangeText={(text) => {
            setInputCode(text);
            setError(false);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={5}
        />
        <TouchableOpacity 
          className="bg-primary dark:bg-primary-dark justify-center items-center px-5 ml-2 rounded-xl"
          onPress={handleVerify}
        >
          <Text className="text-white font-bold">Verify</Text>
        </TouchableOpacity>
      </View>
      {error && <Text className="text-red-500 text-xs mt-1">Incorrect code. Try again.</Text>}
    </View>
  );
};
