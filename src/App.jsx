import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Info } from 'lucide-react';

const KeyboardSynth = () => {
  const [isPlaying, setIsPlaying] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef({});
  const gainNodesRef = useRef({});

  const sustainedKeys = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'u', 'i', 'o', 'p']);

  const keyMap = {
    '1': 261.63, '2': 293.66, '3': 329.63, '4': 392.00, '5': 440.00,
    '6': 523.25, '7': 587.33, '8': 659.25, '9': 783.99, '0': 880.00,
    'q': 261.63, 'w': 293.66, 'e': 329.63, 'r': 349.23, 't': 392.00,
    'y': 440.00, 'u': 493.88, 'i': 523.25, 'o': 587.33, 'p': 659.25,
    'a': 130.81, 's': 146.83, 'd': 164.81, 'f': 174.61, 'g': 196.00,
    'h': 220.00, 'j': 246.94, 'k': 261.63, 'l': 293.66, ';': 329.63,
    'z': 65.41, 'x': 73.42, 'c': 82.41, 'v': 87.31, 'b': 98.00,
    'n': 110.00, 'm': 123.47, ',': 130.81, '.': 146.83, '/': 164.81
  };

  const noteNames = {
    '1': 'C4', '2': 'D4', '3': 'E4', '4': 'G4', '5': 'A4',
    '6': 'C5', '7': 'D5', '8': 'E5', '9': 'G5', '0': 'A5',
    'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4',
    'y': 'A4', 'u': 'B4', 'i': 'C5', 'o': 'D5', 'p': 'E5',
    'a': 'C3', 's': 'D3', 'd': 'E3', 'f': 'F3', 'g': 'G3',
    'h': 'A3', 'j': 'B3', 'k': 'C4', 'l': 'D4', ';': 'E4',
    'z': 'C2', 'x': 'D2', 'c': 'E2', 'v': 'F2', 'b': 'G2',
    'n': 'A2', 'm': 'B2', ',': 'C3', '.': 'D3', '/': 'E3'
  };

  useEffect(() => {
    const initAudio = async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        setAudioReady(true);
      } catch (error) {
        console.error('Audio initialization failed:', error);
      }
    };
    
    initAudio();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playNote = async (key) => {
    const freq = keyMap[key.toLowerCase()];
    if (!freq || !audioContextRef.current || isMuted || oscillatorsRef.current[key]) return;
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const ctx = audioContextRef.current;
    const isSustained = sustainedKeys.has(key.toLowerCase());
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    if (isSustained) {
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq * 1.01, ctx.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(2, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.3);
    } else {
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.Q.setValueAtTime(1, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    }
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start();
    osc2.start();
    
    oscillatorsRef.current[key] = { osc1, osc2, isSustained };
    gainNodesRef.current[key] = gain;
    setIsPlaying(prev => ({ ...prev, [key]: true }));
  };

  const stopNote = (key) => {
    const oscs = oscillatorsRef.current[key];
    const gain = gainNodesRef.current[key];
    
    if (!oscs || !gain || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const releaseTime = oscs.isSustained ? 1.5 : 0.3;
    
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + releaseTime);
    
    setTimeout(() => {
      try {
        oscs.osc1.stop();
        oscs.osc2.stop();
        oscs.osc1.disconnect();
        oscs.osc2.disconnect();
        gain.disconnect();
      } catch (e) {}
      delete oscillatorsRef.current[key];
      delete gainNodesRef.current[key];
    }, (releaseTime + 0.1) * 1000);
    
    setIsPlaying(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat || !audioReady) return;
      playNote(e.key);
    };

    const handleKeyUp = (e) => {
      if (!audioReady) return;
      stopNote(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [audioReady, isMuted]);

  const handleMouseDown = (key) => {
    if (!audioReady) return;
    playNote(key);
  };

  const handleMouseUp = (key) => {
    if (!audioReady) return;
    stopNote(key);
  };

  const KeyButton = ({ keyChar, note }) => {
    const isSustained = sustainedKeys.has(keyChar.toLowerCase());
    
    return (
      <button
        onMouseDown={() => handleMouseDown(keyChar)}
        onMouseUp={() => handleMouseUp(keyChar)}
        onMouseLeave={() => handleMouseUp(keyChar)}
        onTouchStart={(e) => { e.preventDefault(); handleMouseDown(keyChar); }}
        onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(keyChar); }}
        className={`
          relative px-4 py-6 rounded-lg font-mono text-sm transition-all select-none
          ${isPlaying[keyChar] 
            ? isSustained 
              ? 'bg-cyan-500 text-white scale-95 shadow-lg shadow-cyan-500/50'
              : 'bg-purple-500 text-white scale-95 shadow-lg shadow-purple-500/50'
            : isSustained
              ? 'bg-gray-700 text-cyan-300 hover:bg-gray-600 border border-cyan-500/30'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }
        `}
      >
        <div className="font-bold text-lg">{keyChar.toUpperCase()}</div>
        <div className="text-xs mt-1 opacity-70">{note}</div>
        {isSustained && <div className="text-xs opacity-50 mt-1">PAD</div>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Keyboard Synth</h1>
            <p className="text-gray-400">Contemporary digital instrument</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              <Info size={24} />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>
        </div>

        {!audioReady && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-6 text-yellow-200">
            Initializing audio... If you don't hear sound, click anywhere on the page first.
          </div>
        )}

        {showHelp && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-purple-500/30">
            <h2 className="text-xl font-bold text-white mb-3">How to Play</h2>
            <div className="grid md:grid-cols-2 gap-4 text-gray-300 mb-4">
              <div>
                <p className="font-semibold text-cyan-400 mb-2">Number Keys (1-0) - PAD</p>
                <p className="text-sm">Sustained pads with slow attack - perfect for atmospheric chords</p>
              </div>
              <div>
                <p className="font-semibold text-purple-400 mb-2">QWERTY Row</p>
                <p className="text-sm">Main octave - keys U, I, O, P are pads</p>
              </div>
              <div>
                <p className="font-semibold text-purple-400 mb-2">ASDF Row</p>
                <p className="text-sm">Lower octave - quick pluck sounds</p>
              </div>
              <div>
                <p className="font-semibold text-purple-400 mb-2">ZXCV Row</p>
                <p className="text-sm">Bass notes - foundation</p>
              </div>
            </div>
            <div className="text-sm text-gray-400 border-t border-gray-700 pt-3">
              <p><span className="text-cyan-400">Cyan PAD keys</span> = Sustained, atmospheric pads with slow attack & long release</p>
              <p><span className="text-purple-400">Purple keys</span> = Quick pluck sounds with sharp attack</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-cyan-400 font-semibold mb-3 text-sm">Numbers (Sustained Pads)</h3>
            <div className="grid grid-cols-10 gap-2">
              {['1','2','3','4','5','6','7','8','9','0'].map(key => (
                <KeyButton key={key} keyChar={key} note={noteNames[key]} />
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-3 text-sm">QWERTY Row (Mixed)</h3>
            <div className="grid grid-cols-10 gap-2">
              {['q','w','e','r','t','y','u','i','o','p'].map(key => (
                <KeyButton key={key} keyChar={key} note={noteNames[key]} />
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-3 text-sm">ASDF Row (Pluck)</h3>
            <div className="grid grid-cols-10 gap-2">
              {['a','s','d','f','g','h','j','k','l',';'].map(key => (
                <KeyButton key={key} keyChar={key} note={noteNames[key]} />
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-purple-400 font-semibold mb-3 text-sm">ZXCV Row (Bass)</h3>
            <div className="grid grid-cols-10 gap-2">
              {['z','x','c','v','b','n','m',',','.','/'].map(key => (
                <KeyButton key={key} keyChar={key} note={noteNames[key]} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          Press and hold keys to play • Mouse and touch supported • Try combining pads with pluck sounds!
        </div>
      </div>
    </div>
  );
};

export default KeyboardSynth;
