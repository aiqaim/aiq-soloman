/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Send, 
  Trash2, 
  MessageCircle,
  ListTodo,
  Loader2,
  Star,
  Smile,
  Rocket,
  Sun,
  Trophy,
  Zap,
  PartyPopper,
  Sparkles,
  Image as ImageIcon,
  Camera,
  ImagePlus,
  LogOut,
  Music,
  VolumeX,
  Volume2
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from "@google/genai";

// Constants for models
const CHAT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'completed';
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  isSaved?: boolean;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'gallery'>('tasks');
  const [stars, setStars] = useState(0);
  const [level, setLevel] = useState(1);
  const [userName, setUserName] = useState('');
  const [userProfilePic, setUserProfilePic] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [licenseKey, setLicenseKey] = useState('');
  const [appState, setAppState] = useState<'pin_setup' | 'pin_entry' | 'age_entry' | 'portal' | 'name_entry' | 'command_center'>('pin_setup');
  const [pin, setPin] = useState('');
  const [age, setAge] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [gallery, setGallery] = useState<{id: number, type: string, url: string, prompt?: string}[]>([]);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [badges, setBadges] = useState<string[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<{title: string, points: number, completed: boolean}>({
    title: "Generate a pic of a 'Space Pizza'! 🍕",
    points: 50,
    completed: false
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement>(null);

  const playSound = (type: 'success' | 'pop' | 'sparkle' | 'claps' | 'level_music' | 'child_laugh' | 'magic_marimba') => {
    const sounds = {
      success: '/assets/mixkit-game-level-music-689.wav',
      pop: '/assets/mixkit-child-laughing-happily-2263.wav',
      sparkle: '/assets/mixkit-magic-marimba-2820.wav',
      claps: 'https://assets.mixkit.co/sfx/preview/mixkit-small-group-clapping-and-cheering-485.mp3',
      level_music: '/assets/mixkit-game-level-music-689.wav',
      child_laugh: '/assets/mixkit-child-laughing-happily-2263.wav',
      magic_marimba: '/assets/mixkit-magic-marimba-2820.wav'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    fetchTasks();
    fetchChat();
    fetchGallery();

    // Periodic health check
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.ai_configured) {
            setAiStatus(prev => prev === 'busy' ? 'busy' : 'online');
          } else {
            setAiStatus('offline');
          }
        } else {
          setAiStatus('offline');
        }
      } catch {
        setAiStatus('offline');
      }
    };

    const interval = setInterval(checkHealth, 10000);
    checkHealth();

    const savedStars = localStorage.getItem('soloman_stars');
    if (savedStars) {
      const s = parseInt(savedStars);
      setStars(s);
      setLevel(Math.floor(s / 100) + 1);
    }
    
    const savedName = localStorage.getItem('soloman_user_name');
    if (savedName) {
      setUserName(savedName);
    }

    const savedPic = localStorage.getItem('soloman_user_pic');
    if (savedPic) {
      setUserProfilePic(savedPic);
    }
    
    const savedVoice = localStorage.getItem('soloman_voice_enabled');
    if (savedVoice !== null) setVoiceEnabled(savedVoice === 'true');

    const savedLicense = localStorage.getItem('soloman_license_key');
    if (savedLicense) setLicenseKey(savedLicense);

    const savedPin = localStorage.getItem('soloman_pin');
    if (savedPin) {
      setAppState('pin_entry');
    } else {
      setAppState('pin_setup');
    }

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (appState === 'portal' && audioRef.current) {
      audioRef.current.volume = 0.2;
      audioRef.current.play().catch(() => {
        console.log("Audio autoplay blocked by browser");
      });
    } else if (appState === 'command_center' && audioRef.current) {
      audioRef.current.pause();
    }
  }, [appState]);

  useEffect(() => {
    localStorage.setItem('soloman_stars', stars.toString());
    setLevel(Math.floor(stars / 100) + 1);
    
    // Badge logic
    const newBadges = [];
    if (stars >= 50) newBadges.push('Novice Explorer');
    if (stars >= 200) newBadges.push('Mission Master');
    if (stars >= 500) newBadges.push('Quantum Hero');
    if (stars >= 1000) newBadges.push('SoloMan\'s Elite');
    setBadges(newBadges);
  }, [stars]);

  useEffect(() => {
    if (appState === 'command_center' && activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat, activeTab, appState]);

  useEffect(() => {
    if (bgMusicRef.current) {
      if (musicEnabled) {
        bgMusicRef.current.play().catch(e => console.error("Failed to play background music:", e));
      } else {
        bgMusicRef.current.pause();
      }
    }
  }, [musicEnabled]);

  const handleSaveToGallery = async (imageUrl: string, prompt?: string, index?: number) => {
    try {
      const res = await fetch('/api/gallery/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, prompt, type: 'generated' }),
      });
      
      if (res.ok) {
        playSound('sparkle');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        if (voiceEnabled) speak("Yay! I've saved this to your gallery! 🌟");
        
        // Update chat state to show it's saved
        if (index !== undefined) {
          setChat(prev => {
            const newChat = [...prev];
            newChat[index] = { ...newChat[index], isSaved: true };
            return newChat;
          });
        }
        fetchGallery();
      } else {
        throw new Error("Failed to save image");
      }
    } catch (err) {
      console.error(err);
      alert("Oops! I couldn't save the image right now. 🧠");
    }
  };

  const handleEnterPortal = () => {
    // Try to play audio in case it was blocked
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Failed to play sound effect:", e));
    }
    if (bgMusicRef.current && musicEnabled) {
      bgMusicRef.current.play().catch(e => console.error("Failed to play background music:", e));
    }
    
    if (userName && userProfilePic) {
      setAppState('command_center');
      if (voiceEnabled) speak(`Welcome back, ${userName}! I'm ready for our next mission!`);
    } else {
      setAppState('name_entry');
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userProfilePic || !licenseKey.trim()) {
      alert("Please enter your name, select a pic, and provide a license key! 📸");
      return;
    }
    localStorage.setItem('soloman_user_name', userName);
    localStorage.setItem('soloman_user_pic', userProfilePic);
    localStorage.setItem('soloman_voice_enabled', voiceEnabled.toString());
    localStorage.setItem('soloman_license_key', licenseKey);
    setAppState('command_center');
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 }
    });
    if (voiceEnabled) speak(`Hi ${userName}! You look awesome! I'm SoloMan, your new AI best friend! Let's have some fun!`);
    playSound('child_laugh');
  };

  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUserProfilePic(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setTasks(data);
        const completedCount = data.filter((t: any) => t.status === 'completed').length;
        setStars(completedCount * 10);
      } else {
        console.error('Tasks fetch failed or returned non-JSON');
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchChat = async () => {
    if (!licenseKey) {
      console.warn("Cannot fetch chat: license key is missing.");
      return;
    }
    try {
      const res = await fetch('/api/chat', {
        headers: { 'x-license-key': licenseKey }
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          setChat(data);
        } else {
          console.warn('Chat fetch returned error:', data.error);
        }
      } else {
        console.error('Chat fetch returned non-JSON response');
      }
    } catch (err) {
      console.error('Failed to fetch chat:', err);
    }
  };

  const clearChat = async () => {
    if (window.confirm("Are you sure you want to clear our chat history? 🧹")) {
      await fetch('/api/chat', { 
        method: 'DELETE',
        headers: { 'x-license-key': licenseKey }
      });
      setChat([]);
      if (voiceEnabled) speak("Okay! Our chat is fresh and clean now! ✨");
      playSound('magic_marimba');
    }
  };

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setGallery(data);
      } else {
        console.error('Gallery fetch failed or returned non-JSON');
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const res = await fetch('/api/gallery/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: base64String }),
        });
        if (res.ok) {
          fetchGallery();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
          });
          if (voiceEnabled) speak("Wow! What a cool picture! I've added it to your gallery!");
          playSound('magic_marimba');
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle, description: '' }),
    });
    const data = await res.json();
    setTasks([data, ...tasks]);
    setNewTaskTitle('');
    
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#fbbf24', '#f59e0b', '#f97316']
    });
    playSound('magic_marimba');
  };

  const toggleTask = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    
    if (newStatus === 'completed') {
      setStars(prev => prev + 10);
      playSound('level_music');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444']
      });
      if (voiceEnabled) speak("Mission accomplished! Great job!");
    } else {
      setStars(prev => Math.max(0, prev - 10));
    }
    
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
  };

  const deleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter(t => t.id !== id));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isTyping || aiStatus === 'offline') return;
    if (!licenseKey) {
      alert("SoloMan's brain is not connected! Please provide a valid license key.");
      setAiStatus('offline');
      return;
    }

    const lowerMsg = message.toLowerCase();
    const isImageRequest = lowerMsg.includes('show me') || lowerMsg.includes('bring me') || lowerMsg.includes('pic of');
    const isEditRequest = selectedImageForEdit && (lowerMsg.includes('add') || lowerMsg.includes('remove') || lowerMsg.includes('change') || lowerMsg.includes('edit') || lowerMsg.includes('make it'));

    // Check daily challenge
    if (!dailyChallenge.completed && isImageRequest && lowerMsg.includes('space pizza')) {
      setDailyChallenge(prev => ({ ...prev, completed: true }));
      setStars(prev => prev + dailyChallenge.points);
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 }
      });
      if (voiceEnabled) speak(`WOW! You completed the Daily Challenge! Here are ${dailyChallenge.points} bonus Star Points!`);
    }

    const userMsg: ChatMessage = { role: 'user', content: message };
    setChat(prev => [...prev, userMsg]);
    setMessage('');
    setIsTyping(true);
    setAiStatus('busy');
    playSound('pop');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("SoloMan's brain is not connected! (API Key Missing)");
      }
      const genAI = new GoogleGenAI({ apiKey });

      // Save user message to backend history first for all cases
      const saveRes = await fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey },
        body: JSON.stringify({ role: 'user', content: message }),
      });

      if (!saveRes.ok) {
        const contentType = saveRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await saveRes.json();
          if (saveRes.status === 403) {
            setChat(prev => [...prev, { role: 'model', content: data.error || "SoloMan is sleeping! Please provide a valid license key." }]);
            if (voiceEnabled) speak("SoloMan is sleeping! Please provide a valid license key.");
            return;
          }
          throw new Error(data.error || `Server error: ${saveRes.status}`);
        } else {
          const text = await saveRes.text();
          console.error("Non-JSON error from /api/chat/save:", text);
          throw new Error(`Server error: ${saveRes.status}`);
        }
      }

      if (isEditRequest && selectedImageForEdit) {
        // Extract the base64 data and mime type
        const matches = selectedImageForEdit.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error("Invalid pic format");
        }
        const mimeType = matches[1];
        const data = matches[2];

        const response = await genAI.models.generateContent({
          model: IMAGE_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  data,
                  mimeType,
                },
              },
              {
                text: `Apply this edit to the pic: ${message}. Keep it fun and kid-friendly!`,
              },
            ],
          },
        });

        let imageUrl = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          const aiMsg: ChatMessage = { 
            role: 'model', 
            content: `I've edited the pic for you! How does it look? ✨`,
            imageUrl,
            imagePrompt: `Edit: ${message}`
          };
          setChat(prev => [...prev, aiMsg]);
          
          // Save to backend chat history
          await fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey },
            body: JSON.stringify({ role: 'model', content: aiMsg.content }),
          });

          setSelectedImageForEdit(null);
          playSound('sparkle');
          if (voiceEnabled) speak(aiMsg.content);
        } else {
          throw new Error("Failed to edit pic");
        }
      } else if (isImageRequest) {
        const prompt = message.replace(/show me|bring me|pic of|a pic of|an pic of/gi, '').trim();
        const response = await genAI.models.generateContent({
          model: IMAGE_MODEL,
          contents: {
            parts: [{ text: `A vibrant, high-quality, futuristic and kid-friendly 3D illustration of: ${prompt}. The style should be modern, colorful, and full of energy, similar to a high-end animated movie. No text in the image.` }]
          }
        });

        let imageUrl = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          const aiMsg: ChatMessage = { 
            role: 'model', 
            content: `Here is the pic of ${prompt} you asked for! Isn't it cool? 🌟`,
            imageUrl,
            imagePrompt: prompt
          };
          setChat(prev => [...prev, aiMsg]);

          // Save to backend chat history
          await fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey },
            body: JSON.stringify({ role: 'model', content: aiMsg.content }),
          });

          playSound('sparkle');
          if (voiceEnabled) speak(aiMsg.content);
        } else {
          throw new Error("Failed to generate pic");
        }
      } else {
        // Regular chat with thinking
        // Get history for context
        const historyRes = await fetch('/api/chat', {
          headers: { 'x-license-key': licenseKey }
        });
        
        if (!historyRes.ok) {
          const contentType = historyRes.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await historyRes.json();
            throw new Error(data.error || `Server error: ${historyRes.status}`);
          } else {
            const text = await historyRes.text();
            console.error("Non-JSON error from /api/chat:", text);
            throw new Error(`Server error: ${historyRes.status}`);
          }
        }
        
        const historyData = await historyRes.json();
        
        const contents = historyData.map((h: any) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        }));

        const response = await genAI.models.generateContent({
          model: CHAT_MODEL,
          contents,
          config: {
            systemInstruction: "You are SoloMan, a super friendly, enthusiastic, and loveable AI mentor for kids aged 6-15! You live in a high-tech quantum portal. Your goal is to be their best friend, encourage their curiosity, and help them with missions. If they ask for a pic or creation, describe it with wonder and excitement. Use lots of emojis! Keep your answers short, fun, and very positive. Never be mean or boring!",
            temperature: 0.8,
            topP: 0.9
          }
        });

        const aiResponse = response.text?.trim();
        if (aiResponse) {
          const aiMsg: ChatMessage = { role: 'model', content: aiResponse };
          setChat(prev => [...prev, aiMsg]);

          // Save AI response to backend
          await fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-license-key': licenseKey },
            body: JSON.stringify({ role: 'model', content: aiResponse }),
          });

          playSound('magic_marimba');
          if (voiceEnabled) speak(aiResponse);
        } else {
          throw new Error("Empty response from SoloMan");
        }
      }
    } catch (err: any) {
      console.error("SoloMan Error:", err);
      const fallback = "Oops! My super-brain had a little hiccup. 🧠 Can you say that again? I'm ready to help!";
      setChat(prev => [...prev, { role: 'model', content: fallback }]);
      setAiStatus('offline');
    } finally {
      setIsTyping(false);
      setAiStatus('online');
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 4) {
      localStorage.setItem('soloman_pin', pin);
      setAppState('age_entry');
      playSound('pop');
    } else {
      alert("PIN must be at least 4 characters!");
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem('soloman_pin');
    if (pin === savedPin) {
      setAppState('portal');
      playSound('claps');
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    } else {
      alert("Incorrect PIN!");
    }
  };

  const handleSaveAge = (e: React.FormEvent) => {
    e.preventDefault();
    if (ageGroup) {
      localStorage.setItem('soloman_age_group', ageGroup);
      setAppState('portal');
      playSound('claps');
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  };

  if (appState === 'pin_setup' || appState === 'pin_entry' || appState === 'age_entry') {
    return (
      <div className="min-h-screen bg-m3-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(103,80,164,0.08),transparent_50%)]" />
        
        <motion.form 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onSubmit={appState === 'pin_setup' ? handleSavePin : appState === 'pin_entry' ? handleVerifyPin : handleSaveAge}
          className="w-full max-w-md bg-m3-surface-container-high p-10 rounded-[32px] shadow-xl border border-m3-outline/10 space-y-8 relative z-10"
        >
          <div className="flex justify-center mb-2">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
              <img 
                src="https://placehold.co/400x120/6750a4/ffffff?text=AiQ+Sol&font=outfit" 
                alt="AiQ Sol Logo" 
                className="h-10 w-auto"
              />
            </a>
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-m3-on-surface tracking-tight">
              {appState === 'pin_setup' ? 'Set Secret PIN' : appState === 'pin_entry' ? 'Enter Secret PIN' : 'Select Age Group'}
            </h2>
            <p className="text-m3-on-surface-variant font-medium text-base">
              {appState === 'pin_setup' ? 'Create a PIN to secure your portal!' : appState === 'pin_entry' ? 'Welcome back! Unlock your portal.' : 'To help SoloMan find the best missions for you!'}
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              {appState === 'age_entry' ? (
                <select 
                  className="w-full bg-m3-surface-variant/30 border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary focus:bg-m3-surface-variant/50 transition-all appearance-none text-center"
                  value={ageGroup}
                  onChange={e => setAgeGroup(e.target.value)}
                >
                  <option value="" disabled>Select Age Group</option>
                  <option value="6-9">6 - 9 Years Old</option>
                  <option value="10-12">10 - 12 Years Old</option>
                  <option value="13-15">13 - 15 Years Old</option>
                </select>
              ) : (
                <input 
                  autoFocus
                  type="password" 
                  placeholder="4-Digit PIN" 
                  className="w-full bg-m3-surface-variant/30 border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary focus:bg-m3-surface-variant/50 transition-all placeholder:text-m3-on-surface-variant/40 text-center tracking-widest"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  maxLength={4}
                />
              )}
            </div>
          </div>

          <button 
            type="submit"
            className="m3-button-filled w-full py-4 text-lg shadow-lg shadow-m3-primary/20"
          >
            {appState === 'pin_setup' ? 'Save PIN 🔒' : appState === 'pin_entry' ? 'Unlock 🚀' : 'Continue ✨'}
          </button>

          <div className="text-center pt-4">
            <p className="text-m3-on-surface-variant/40 font-bold text-[10px] tracking-widest uppercase">
              Made with love by <span className="text-m3-primary/60">Asghar Malik</span>
            </p>
          </div>
        </motion.form>
      </div>
    );
  }

  if (appState === 'portal') {
    return (
      <div className="min-h-screen bg-m3-surface flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        {/* Magical Background Image */}
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://picsum.photos/seed/quantum-portal/1920/1080?blur=2" 
            className="w-full h-full object-cover"
            alt="Quantum Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-m3-surface via-transparent to-m3-surface" />
        </div>

        {/* Quantum Visual Loops */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 180, 360],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border-[1px] border-m3-primary/10 rounded-full"
          />
        </div>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-12 relative z-10"
        >
          <div className="relative inline-block">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="absolute -top-16 left-1/2 -translate-x-1/2 transition-transform hover:scale-110 z-20">
              <img 
                src="https://placehold.co/400x120/6750a4/ffffff?text=AiQ+Sol&font=outfit" 
                alt="AiQ Sol Logo" 
                className="h-10 w-auto"
              />
            </a>
            <motion.div 
              animate={{ 
                boxShadow: ["0 0 20px rgba(103,80,164,0.1)", "0 0 50px rgba(103,80,164,0.3)", "0 0 20px rgba(103,80,164,0.1)"],
                scale: [1, 1.02, 1]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="relative w-48 h-48 bg-m3-primary-container rounded-full flex items-center justify-center border-4 border-white shadow-xl"
            >
              <Smile className="w-24 h-24 text-m3-on-primary-container drop-shadow-md" />
            </motion.div>
            
            {/* SoloMan's Badge */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-2 -right-2 bg-m3-tertiary p-3 rounded-2xl shadow-lg border-4 border-white"
            >
              <Trophy className="w-6 h-6 text-m3-on-tertiary" />
            </motion.div>
          </div>
          
          <div className="space-y-4">
            <motion.h1 
              className="text-6xl md:text-7xl font-black text-m3-on-surface tracking-tighter"
            >
              Welcome!
            </motion.h1>
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-10 bg-m3-outline/20" />
              <p className="text-m3-primary font-bold text-lg md:text-xl tracking-[0.1em] uppercase">A Fun Tour With AI Sol</p>
              <span className="h-px w-10 bg-m3-outline/20" />
            </div>
          </div>

          <button 
            onClick={handleEnterPortal}
            className="m3-button-filled group relative px-16 py-6 text-2xl shadow-xl shadow-m3-primary/30"
          >
            <span className="relative z-10 flex items-center gap-4">
              Enter Portal <Rocket className="w-8 h-8 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
            </span>
          </button>

          {/* Footer for Portal */}
          <div className="pt-8">
            <p className="text-m3-on-surface-variant/40 font-bold text-xs tracking-widest uppercase">
              Made with love by <span className="text-m3-primary/60">Asghar Malik</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (appState === 'name_entry') {
    return (
      <div className="min-h-screen bg-m3-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(103,80,164,0.08),transparent_50%)]" />
        
        <motion.form 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onSubmit={handleSaveName}
          className="w-full max-w-md bg-m3-surface-container-high p-10 rounded-[32px] shadow-xl border border-m3-outline/10 space-y-8 relative z-10"
        >
          <div className="flex justify-center mb-2">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
              <img 
                src="https://placehold.co/400x120/6750a4/ffffff?text=AiQ+Sol&font=outfit" 
                alt="AiQ Sol Logo" 
                className="h-10 w-auto"
              />
            </a>
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-m3-on-surface tracking-tight">Identify Yourself</h2>
            <p className="text-m3-on-surface-variant font-medium text-base">The portal requires your bio-signature!</p>
          </div>
          
          <div className="space-y-6">
            {/* Pic Selection */}
            <div className="flex flex-col items-center gap-4">
              <div 
                onClick={() => profilePicInputRef.current?.click()}
                className="group relative w-32 h-32 rounded-full border-2 border-dashed border-m3-outline/30 hover:border-m3-primary transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-m3-surface-variant/20"
              >
                {userProfilePic ? (
                  <img src={userProfilePic} className="w-full h-full object-cover" alt="Pic Preview" />
                ) : (
                  <div className="text-center space-y-1">
                    <Camera className="w-8 h-8 text-m3-on-surface-variant/40 group-hover:text-m3-primary mx-auto" />
                    <p className="text-[8px] text-m3-on-surface-variant/40 font-black uppercase">Add Pic</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-m3-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={profilePicInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleProfilePicUpload} 
              />
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Enter Your Hero Name" 
                className="w-full bg-m3-surface-variant/30 border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary focus:bg-m3-surface-variant/50 transition-all placeholder:text-m3-on-surface-variant/40"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />

              <input 
                type="text" 
                placeholder="Enter License Key" 
                className="w-full bg-m3-surface-variant/30 border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-semibold text-m3-on-surface focus:outline-none focus:border-m3-primary focus:bg-m3-surface-variant/50 transition-all placeholder:text-m3-on-surface-variant/40"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
              />
              
              <label className="flex items-center gap-4 p-4 bg-m3-surface-variant/20 rounded-2xl cursor-pointer hover:bg-m3-surface-variant/30 transition-colors border border-transparent">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded-md text-m3-primary focus:ring-m3-primary bg-transparent border-m3-outline/30"
                  checked={voiceEnabled}
                  onChange={e => setVoiceEnabled(e.target.checked)}
                />
                <span className="text-m3-on-surface-variant font-semibold text-sm">Enable AI Voice Greeting 🔊</span>
              </label>
            </div>
          </div>

          <button 
            type="submit"
            className="m3-button-filled w-full py-4 text-lg shadow-lg shadow-m3-primary/20"
          >
            Confirm Identity ⚡
          </button>

          <div className="text-center pt-4">
            <p className="text-m3-on-surface-variant/40 font-bold text-[10px] tracking-widest uppercase">
              Made with love by <span className="text-m3-primary/60">Asghar Malik</span>
            </p>
          </div>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-m3-surface text-m3-on-surface font-sans selection:bg-m3-primary-container overflow-x-hidden">
      <audio 
        ref={audioRef} 
        src="/assets/mixkit-game-level-music-689.wav" 
        loop 
      />
      <audio 
        ref={bgMusicRef} 
        src="/assets/mixkit-game-level-music-689.wav" 
        loop 
        autoPlay={musicEnabled}
      />
      <audio 
        ref={bgMusicRef} 
        src="/assets/mixkit-game-level-music-689.wav" 
        loop 
        autoPlay={musicEnabled}
      />
      
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 relative z-10">
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute top-20 left-[10%] text-yellow-200 opacity-50"
        >
          <Star className="w-24 h-24 fill-current" />
        </motion.div>
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
          className="absolute bottom-40 right-[10%] text-orange-200 opacity-50"
        >
          <Rocket className="w-32 h-32 fill-current" />
        </motion.div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Playful Header */}
        <header className="mb-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-6">
            {/* SoloMan Pic */}
            <div className="relative">
              <motion.div 
                animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.02, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="inline-flex items-center justify-center w-20 h-20 bg-m3-primary-container rounded-[24px] shadow-md border-2 border-white"
              >
                <Smile className="w-12 h-12 text-m3-on-primary-container" />
              </motion.div>
              
              {/* AI Status Indicator */}
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full shadow-sm border border-white text-[8px] font-bold text-white flex items-center gap-1 ${
                  aiStatus === 'online' ? 'bg-green-600' : 
                  aiStatus === 'busy' ? 'bg-blue-600' : 'bg-red-600'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full bg-white ${aiStatus === 'busy' ? 'animate-pulse' : ''}`} />
                {aiStatus === 'online' ? 'READY' : aiStatus === 'busy' ? 'BUSY' : 'SLEEPING'}
              </motion.div>
            </div>

            {/* Connection Line */}
            <div className="h-0.5 w-8 bg-m3-outline/10 rounded-full" />

            {/* User Pic */}
            <div className="relative">
              <motion.div 
                animate={{ rotate: [0, -2, 2, 0], scale: [1, 1.02, 1] }}
                transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
                className="w-20 h-20 rounded-[24px] shadow-md border-2 border-white overflow-hidden bg-m3-secondary-container"
              >
                <img src={userProfilePic} className="w-full h-full object-cover" alt="User Profile" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-1 -right-1 bg-m3-primary text-white p-1 rounded-full shadow-sm"
              >
                <Star className="w-3 h-3 fill-current" />
              </motion.div>
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-m3-on-surface">
              {userName} & SoloMan
            </h1>
            <p className="text-m3-primary font-semibold text-sm tracking-widest uppercase opacity-80">AiQ Soloman's Best Friend</p>
          </div>

          {/* Star Counter / Scoreboard */}
          <div className="flex flex-col items-center gap-3">
            <motion.div 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-flex items-center gap-3 bg-m3-surface-container-high px-5 py-2 rounded-2xl shadow-sm border border-m3-outline/5"
            >
              <Trophy className="w-4 h-4 text-m3-tertiary" />
              <span className="text-lg font-bold text-m3-on-surface">{stars}</span>
              <span className="text-xs font-semibold text-m3-on-surface-variant uppercase tracking-tight">Star Points</span>
              <div className="flex gap-0.5">
                {[...Array(3)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < Math.floor(stars/50) % 3 ? 'fill-m3-tertiary text-m3-tertiary' : 'text-m3-outline/20'}`} />
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-m3-secondary text-m3-on-secondary px-4 py-1 rounded-full text-[10px] font-bold shadow-sm"
            >
              LEVEL {level} EXPLORER 🚀
            </motion.div>

            {/* Badges Display */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-1">
              {badges.map((badge, i) => (
                <motion.div
                  key={badge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-m3-tertiary-container text-m3-on-tertiary-container text-[9px] px-2.5 py-0.5 rounded-lg font-bold shadow-sm border border-m3-tertiary/10 flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {badge}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/health');
                  const data = await res.json();
                  alert(`🚀 Mission Control Status: ${data.status.toUpperCase()}!\n✨ AI Brain: ${data.ai_configured ? 'READY' : 'OFFLINE'}\n📚 Memory: ${data.db_connected ? 'READY' : 'OFFLINE'}`);
                } catch (err) {
                  alert(`💥 Oh no! Mission Control is having trouble: ${err}`);
                }
              }}
              className="text-[9px] font-bold text-m3-outline hover:text-m3-primary transition-colors uppercase tracking-[0.2em]"
            >
              Check Mission Control
            </button>
          </div>

          <div className="flex justify-center gap-4 mt-4">
            <button 
              onClick={() => setVoiceEnabled(prev => !prev)}
              className="m3-button-icon text-m3-on-surface-variant hover:text-m3-primary transition-colors"
            >
              {voiceEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
            <button 
              onClick={() => setMusicEnabled(prev => !prev)}
              className="m3-button-icon text-m3-on-surface-variant hover:text-m3-primary transition-colors"
            >
              {musicEnabled ? <Music size={24} /> : <VolumeX size={24} />}
            </button>
          </div>
        </header>

        {/* Material 3 Navigation Rail / Tabs */}
        <div className="flex bg-m3-surface-container-low p-1.5 rounded-[32px] mb-8 shadow-sm border border-m3-outline/5 relative">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-[28px] transition-all duration-300 ${activeTab === 'tasks' ? 'bg-m3-primary-container text-m3-on-primary-container shadow-sm' : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/30'}`}
          >
            <ListTodo className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Missions</span>
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-[28px] transition-all duration-300 relative ${activeTab === 'chat' ? 'bg-m3-primary-container text-m3-on-primary-container shadow-sm' : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/30'}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
            {chat.length > 0 && activeTab !== 'chat' && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute top-2 right-1/4 bg-m3-tertiary w-4 h-4 rounded-full border border-white flex items-center justify-center"
              >
                <span className="text-[8px] text-white font-bold">!</span>
              </motion.div>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-[28px] transition-all duration-300 ${activeTab === 'gallery' ? 'bg-m3-primary-container text-m3-on-primary-container shadow-sm' : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/30'}`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Gallery</span>
          </button>
        </div>

        <main>
          {activeTab === 'tasks' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="m3-card-elevated p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-m3-tertiary-container p-2 rounded-xl">
                    <Smile className="w-5 h-5 text-m3-on-tertiary-container" />
                  </div>
                  <h3 className="text-lg font-bold text-m3-on-surface">SoloMan's Challenge!</h3>
                </div>
                <p className="text-m3-on-surface-variant font-medium mb-4 italic text-sm">"Hey {userName}! I've set some missions for you. Complete them to earn Star Points and level up! What should we do first?"</p>
                
                {/* Daily Challenge Card */}
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className={`p-4 rounded-2xl border mb-4 transition-colors ${dailyChallenge.completed ? 'bg-green-50 border-green-200' : 'bg-m3-surface-container-high border-m3-outline/10 shadow-sm'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-m3-primary uppercase tracking-widest">Daily Challenge ⚡</span>
                    <span className="text-[10px] font-bold text-m3-primary">+{dailyChallenge.points} Stars</span>
                  </div>
                  <p className={`text-sm font-bold ${dailyChallenge.completed ? 'text-green-600 line-through' : 'text-m3-on-surface'}`}>
                    {dailyChallenge.title}
                  </p>
                  {dailyChallenge.completed && (
                    <div className="flex items-center gap-1.5 mt-2 text-green-600 text-[9px] font-bold uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Completed!
                    </div>
                  )}
                </motion.div>

                <div className="bg-m3-primary-container/30 p-3 rounded-2xl flex items-center gap-3 border border-m3-primary/10">
                  <Rocket className="w-4 h-4 text-m3-primary" />
                  <p className="text-m3-primary text-[10px] font-bold uppercase tracking-tight">Tip: Tap "Chat" to talk to me!</p>
                </div>
              </div>

              <form onSubmit={addTask} className="relative group">
                <input 
                  type="text" 
                  placeholder="What's your next big mission?" 
                  className="w-full bg-m3-surface-container-high border border-m3-outline/20 rounded-[28px] px-6 py-4 pr-16 text-base font-medium focus:outline-none focus:border-m3-primary focus:ring-4 focus:ring-m3-primary/10 transition-all shadow-sm placeholder:text-m3-outline/50"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-m3-primary text-m3-on-primary rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </button>
              </form>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {tasks.length > 0 && tasks.every(t => t.status === 'completed') && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-m3-tertiary text-m3-on-tertiary p-8 rounded-[32px] text-center shadow-md border border-white/10"
                    >
                      <Trophy className="w-12 h-12 text-m3-on-tertiary mx-auto mb-4 animate-bounce" />
                      <h2 className="text-2xl font-bold">VICTORY!</h2>
                      <p className="font-medium opacity-90 text-sm">You completed all your missions! You're a superstar! 🌟</p>
                      <button 
                        onClick={() => {
                          confetti({
                            particleCount: 200,
                            spread: 100,
                            origin: { y: 0.6 }
                          });
                        }}
                        className="mt-4 px-6 py-2 bg-m3-on-tertiary text-m3-tertiary rounded-full font-bold text-sm hover:scale-105 transition-transform"
                      >
                        CELEBRATE! 🎉
                      </button>
                    </motion.div>
                  )}
                  {tasks.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-m3-surface-container-low border-2 border-dashed border-m3-outline/20 rounded-[32px] p-12 text-center space-y-3"
                    >
                      <Rocket className="w-12 h-12 text-m3-outline/30 mx-auto animate-bounce" />
                      <p className="text-m3-outline font-bold text-lg">
                        No missions yet!<br/>
                        <span className="text-sm font-medium opacity-60">Add one above to start your journey!</span>
                      </p>
                    </motion.div>
                  ) : (
                    tasks.map((task) => (
                      <motion.div 
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`flex items-center gap-4 p-4 rounded-[24px] border transition-all shadow-sm relative overflow-hidden ${task.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-m3-surface-container border-m3-outline/5 hover:border-m3-primary/30'}`}
                      >
                        <button 
                          onClick={() => toggleTask(task.id, task.status)}
                          className={`transition-all duration-300 active:scale-125 ${task.status === 'completed' ? 'text-green-600' : 'text-m3-outline/40 hover:text-m3-primary'}`}
                        >
                          {task.status === 'completed' ? <CheckCircle2 className="w-8 h-8" /> : <Circle className="w-8 h-8" />}
                        </button>
                        <span className={`flex-1 text-base font-bold ${task.status === 'completed' ? 'line-through text-green-300' : 'text-m3-on-surface'}`}>
                          {task.title}
                        </span>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-2 text-m3-outline/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : activeTab === 'chat' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col h-[600px] bg-m3-surface-container-low rounded-[32px] border border-m3-outline/10 shadow-md overflow-hidden relative"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                {chat.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-m3-outline/40 font-bold text-center space-y-4">
                    <motion.div
                      animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      <PartyPopper className="w-16 h-16 text-m3-primary/30" />
                    </motion.div>
                    <div className="space-y-2">
                      <p className="text-2xl text-m3-on-surface">Ready for Fun?</p>
                      <p className="text-sm font-medium opacity-60 text-m3-on-surface-variant">I'm SoloMan, your AI bestie!<br/>Try saying: "Show me a space cat!" 🐱🚀</p>
                      <div className="flex flex-wrap justify-center gap-1.5 max-w-xs mx-auto mt-4">
                        {['"Show me a dragon"', '"Bring me a robot"', '"Pic of a unicorn"'].map(tip => (
                          <button 
                            key={tip}
                            onClick={() => setMessage(tip.replace(/"/g, ''))}
                            className="text-[9px] bg-m3-primary-container text-m3-on-primary-container px-3 py-1 rounded-full border border-m3-primary/10 hover:bg-m3-primary/20 transition-colors"
                          >
                            {tip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {chat.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] min-w-[60px] rounded-[24px] px-5 py-3.5 text-base font-medium shadow-sm relative ${
                      msg.role === 'user' 
                        ? 'bg-m3-primary text-m3-on-primary rounded-tr-none' 
                        : 'bg-m3-surface-container-high border border-m3-outline/5 text-m3-on-surface rounded-tl-none'
                    }`}>
                      {msg.role === 'model' && (
                        <div className="absolute -top-4 -left-4 bg-m3-tertiary p-1.5 rounded-xl shadow-sm border-2 border-white">
                          <Smile className="w-4 h-4 text-m3-on-tertiary" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "SoloMan is processing..."}</Markdown>
                        {msg.imageUrl && (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mt-3 rounded-xl overflow-hidden shadow-sm border-2 border-white relative"
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Generated by SoloMan" 
                              className="w-full h-auto"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 p-1.5 text-[7px] text-white/90 font-bold text-center">
                              Made with love by Asghar Malik
                            </div>
                          </motion.div>
                        )}
                        {msg.imageUrl && msg.role === 'model' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleSaveToGallery(msg.imageUrl!, msg.imagePrompt, i)}
                              disabled={msg.isSaved}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                                msg.isSaved 
                                  ? 'bg-green-100 text-green-700 cursor-default' 
                                  : 'bg-m3-primary text-m3-on-primary hover:scale-[1.02] active:scale-[0.98]'
                              }`}
                            >
                              {msg.isSaved ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                              ) : (
                                <><Star className="w-3.5 h-3.5 fill-current" /> Save to Gallery</>
                              )}
                            </button>
                            {!msg.isSaved && (
                              <button
                                onClick={() => {
                                  setChat(prev => prev.filter((_, idx) => idx !== i));
                                  if (voiceEnabled) speak("No problem! Let's try something else! ✨");
                                }}
                                className="px-3 py-2 bg-m3-surface-variant/20 text-m3-on-surface-variant rounded-xl text-xs font-bold hover:bg-m3-surface-variant/40 transition-all"
                              >
                                Let it go
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-m3-surface-container-high border border-m3-outline/5 rounded-[24px] px-5 py-3.5 flex items-center gap-3 shadow-sm">
                      <motion.div 
                        animate={{ 
                          rotate: [0, 15, -15, 0],
                          scale: [1, 1.1, 1]
                        }} 
                        transition={{ repeat: Infinity, duration: 1 }} 
                      >
                        <Zap className="w-5 h-5 text-m3-tertiary fill-current" />
                      </motion.div>
                      <p className="text-m3-on-surface font-bold text-sm italic animate-pulse">SoloMan is thinking...</p>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-m3-outline/10 bg-m3-surface-container-low relative z-10">
                {selectedImageForEdit && (
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-4 p-2 bg-m3-primary-container/30 rounded-xl border border-m3-primary/10 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white shadow-sm">
                      <img src={selectedImageForEdit} className="w-full h-full object-cover" alt="To Edit" />
                    </div>
                    <div className="flex-1">
                      <p className="text-m3-primary text-[9px] font-bold uppercase">Editing Mode Active! ✨</p>
                      <p className="text-m3-on-primary-container text-[8px] font-medium opacity-70">Tell SoloMan what to change!</p>
                    </div>
                    <button 
                      onClick={() => setSelectedImageForEdit(null)}
                      className="text-m3-outline hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 m3-button-tonal !p-0 flex items-center justify-center"
                  >
                    <ImagePlus className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={clearChat}
                    className="w-12 h-12 m3-button-tonal !bg-red-50 !text-red-600 !p-0 flex items-center justify-center"
                    title="Clear Chat"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                  <form onSubmit={sendMessage} className="relative flex-1">
                    <input 
                      type="text" 
                      disabled={aiStatus === 'offline'}
                      placeholder={aiStatus === 'offline' ? "SoloMan is sleeping..." : "Tell SoloMan something!"} 
                      className="w-full bg-m3-surface-container-high border border-m3-outline/10 rounded-[24px] px-6 py-3.5 pr-14 text-sm font-medium focus:outline-none focus:border-m3-primary focus:ring-4 focus:ring-m3-primary/5 transition-all placeholder:text-m3-outline/40 disabled:opacity-50"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                    />
                    <button 
                      disabled={isTyping || !message.trim() || aiStatus === 'offline'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 bg-m3-primary text-m3-on-primary rounded-full hover:scale-105 active:scale-95 disabled:opacity-30 transition-all shadow-sm flex items-center justify-center"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="bg-m3-primary text-m3-on-primary p-6 rounded-[32px] shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-20 h-20" />
                </div>
                <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6" /> Creation Gallery
                </h2>
                <p className="text-m3-on-primary/80 font-medium text-sm">All your creations and uploads are saved here! ✨</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {gallery.length === 0 ? (
                  <div className="col-span-2 bg-m3-surface-container-low border-2 border-dashed border-m3-outline/20 rounded-[32px] p-12 text-center space-y-3">
                    <ImageIcon className="w-12 h-12 text-m3-outline/30 mx-auto animate-pulse" />
                    <p className="text-m3-outline font-bold text-lg">Your Gallery is Empty!</p>
                    <p className="text-m3-outline/60 text-sm font-medium">Upload a pic or ask SoloMan to generate one!</p>
                  </div>
                ) : (
                  gallery.map((img) => (
                    <motion.div 
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative bg-m3-surface-container rounded-[24px] overflow-hidden shadow-sm border border-m3-outline/5 hover:border-m3-primary/30 transition-all"
                    >
                      <img 
                        src={img.url} 
                        alt={img.prompt || "Gallery Image"} 
                        className="w-full aspect-square object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/30 p-1.5 text-[6px] text-white/80 font-bold text-center">
                        Made with love by Asghar Malik
                      </div>
                      <div className="absolute inset-0 bg-m3-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-center">
                        <p className="text-m3-on-primary font-bold text-xs mb-2">{img.type === 'generated' ? '✨ Generated' : '📸 Uploaded'}</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setSelectedImageForEdit(img.url);
                              setActiveTab('chat');
                              if (voiceEnabled) speak("Okay! Let's edit this pic. What should I do to it?");
                            }}
                            className="p-2 bg-m3-surface text-m3-primary rounded-xl hover:scale-110 transition-transform shadow-sm"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              await fetch(`/api/gallery/${img.id}`, { method: 'DELETE' });
                              fetchGallery();
                            }}
                            className="p-2 bg-red-500 text-white rounded-xl hover:scale-110 transition-transform shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </main>

        {/* Footer with Logo and Credits */}
        <footer className="mt-12 pb-8 text-center space-y-4">
          <div className="flex flex-col items-center gap-3">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
              <img 
                src="https://placehold.co/400x120/6750a4/ffffff?text=AiQ+Sol&font=outfit" 
                alt="AiQ Sol Logo" 
                className="h-12 w-auto opacity-80"
              />
            </a>
            <p className="text-m3-outline/40 font-bold text-[10px] tracking-[0.2em] uppercase">
              Made with love by <span className="text-m3-primary/60">Asghar Malik</span>
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-m3-primary-container);
          border: 2px solid transparent;
          background-clip: padding-box;
          border-radius: 10px;
        }
        .whitespace-pre-wrap p {
          margin-bottom: 1rem;
          color: inherit;
        }
        .whitespace-pre-wrap p:last-child {
          margin-bottom: 0;
        }
        .whitespace-pre-wrap ul, .whitespace-pre-wrap ol {
          margin-left: 2rem;
          margin-bottom: 1rem;
          color: inherit;
        }
        .whitespace-pre-wrap li {
          margin-bottom: 0.5rem;
          color: inherit;
        }
        .whitespace-pre-wrap strong {
          color: inherit;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}

