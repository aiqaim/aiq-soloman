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
  ImagePlus
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';

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
  const [appState, setAppState] = useState<'pin_setup' | 'pin_entry' | 'age_entry' | 'portal' | 'name_entry' | 'command_center'>('pin_setup');
  const [pin, setPin] = useState('');
  const [age, setAge] = useState('');
  const [gallery, setGallery] = useState<{id: number, type: string, url: string, prompt?: string}[]>([]);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [badges, setBadges] = useState<string[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<{title: string, points: number, completed: boolean}>({
    title: "Generate a picture of a 'Space Pizza'! 🍕",
    points: 50,
    completed: false
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playSound = (type: 'success' | 'pop' | 'sparkle' | 'claps') => {
    const sounds = {
      success: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2064.mp3',
      pop: 'https://assets.mixkit.co/sfx/preview/mixkit-pop-up-something-2002.mp3',
      sparkle: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-notification-ring-2359.mp3',
      claps: 'https://assets.mixkit.co/sfx/preview/mixkit-small-group-clapping-and-cheering-485.mp3'
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

  const handleEnterPortal = () => {
    // Try to play audio in case it was blocked
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
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
    if (!userName.trim() || !userProfilePic) {
      alert("Please enter your name and upload a cool picture of yourself! 📸");
      return;
    }
    localStorage.setItem('soloman_user_name', userName);
    localStorage.setItem('soloman_user_pic', userProfilePic);
    localStorage.setItem('soloman_voice_enabled', voiceEnabled.toString());
    setAppState('command_center');
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 }
    });
    if (voiceEnabled) speak(`Hi ${userName}! You look awesome! I'm SoloMan, your new AI best friend! Let's have some fun!`);
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
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
      const completedCount = data.filter((t: any) => t.status === 'completed').length;
      setStars(completedCount * 10);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChat = async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) throw new Error('Failed to fetch chat');
      const data = await res.json();
      setChat(data);
    } catch (err) {
      console.error(err);
    }
  };

  const clearChat = async () => {
    if (window.confirm("Are you sure you want to clear our chat history? 🧹")) {
      await fetch('/api/chat', { method: 'DELETE' });
      setChat([]);
      if (voiceEnabled) speak("Okay! Our chat is fresh and clean now! ✨");
    }
  };

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      if (!res.ok) throw new Error('Failed to fetch gallery');
      const data = await res.json();
      setGallery(data);
    } catch (err) {
      console.error(err);
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
      playSound('success');
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
      if (isEditRequest && selectedImageForEdit) {
        const res = await fetch('/api/edit-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: message, base64Image: selectedImageForEdit }),
        });
        const data = await res.json();
        const aiMsg: ChatMessage = { 
          role: 'model', 
          content: `I've edited the image for you! How does it look? ✨`,
          imageUrl: data.imageUrl 
        };
        setChat(prev => [...prev, aiMsg]);
        setSelectedImageForEdit(null); // Reset after edit
        fetchGallery();
        playSound('sparkle');
        if (voiceEnabled) speak(aiMsg.content);
      } else if (isImageRequest) {
        const prompt = message.replace(/show me|bring me|pic of|a pic of/gi, '').trim();
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        const aiMsg: ChatMessage = { 
          role: 'model', 
          content: `Here is the picture of ${prompt} you asked for! Isn't it cool? 🌟`,
          imageUrl: data.imageUrl 
        };
        setChat(prev => [...prev, aiMsg]);
        fetchGallery(); // Refresh gallery
        playSound('sparkle');
        if (voiceEnabled) speak(aiMsg.content);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();
        setChat(prev => [...prev, { role: 'model', content: data.response }]);
        playSound('sparkle');
        if (voiceEnabled) speak(data.response);
      }
    } catch (err) {
      console.error(err);
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
    if (age) {
      localStorage.setItem('soloman_age', age);
      setAppState('portal');
      playSound('claps');
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  };

  if (appState === 'pin_setup' || appState === 'pin_entry' || appState === 'age_entry') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        
        <motion.form 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onSubmit={appState === 'pin_setup' ? handleSavePin : appState === 'pin_entry' ? handleVerifyPin : handleSaveAge}
          className="w-full max-w-xl bg-white/5 backdrop-blur-2xl p-12 rounded-[4rem] shadow-2xl border-2 border-white/10 space-y-10 relative z-10"
        >
          <div className="flex justify-center mb-4">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
              <img 
                src="https://ais-pre-h67t4olchfmzhn5ezfoqnf-42228107017.asia-southeast1.run.app/api/images/1709225573456.png" 
                alt="AiQ Sol Logo" 
                className="h-12 w-auto"
              />
            </a>
          </div>
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tight">
              {appState === 'pin_setup' ? 'Set Secret PIN' : appState === 'pin_entry' ? 'Enter Secret PIN' : 'Enter Your Age'}
            </h2>
            <p className="text-blue-300 font-bold text-xl opacity-70">
              {appState === 'pin_setup' ? 'Create a PIN to secure your portal!' : appState === 'pin_entry' ? 'Welcome back! Unlock your portal.' : 'To optimize the safest possible content!'}
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-4">
              <input 
                autoFocus
                type={appState === 'age_entry' ? 'number' : 'password'} 
                placeholder={appState === 'age_entry' ? 'Your Age' : '4-Digit PIN'} 
                className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-6 text-2xl font-bold text-white focus:outline-none focus:border-blue-400 transition-all placeholder:text-white/20 text-center tracking-widest"
                value={appState === 'age_entry' ? age : pin}
                onChange={e => appState === 'age_entry' ? setAge(e.target.value) : setPin(e.target.value)}
                min={appState === 'age_entry' ? "1" : undefined}
                maxLength={appState === 'age_entry' ? undefined : 4}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-6 bg-blue-600 text-white rounded-3xl text-2xl font-black shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {appState === 'pin_setup' ? 'SAVE PIN 🔒' : appState === 'pin_entry' ? 'UNLOCK 🚀' : 'CONTINUE ✨'}
          </button>

          <div className="text-center">
            <p className="text-white/20 font-bold text-xs tracking-widest uppercase">
              Made with love by <span className="text-blue-400/50">Asghar Malik</span>
            </p>
          </div>
        </motion.form>
      </div>
    );
  }

  if (appState === 'portal') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        {/* Magical Background Image */}
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://picsum.photos/seed/quantum-portal/1920/1080?blur=2" 
            className="w-full h-full object-cover"
            alt="Quantum Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-transparent to-[#0a0a0a]" />
        </div>

        {/* Quantum Visual Loops */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border-[2px] border-blue-400/20 rounded-full"
          />
          <motion.div 
            animate={{ 
              scale: [1.1, 1, 1.1],
              rotate: [360, 180, 0],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border-[2px] border-purple-400/20 rounded-full"
          />
        </div>

        {/* Floating Particles */}
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              y: [0, -800],
              x: [0, (Math.random() - 0.5) * 300],
              opacity: [0, 0.8, 0],
              scale: [0, Math.random() * 1.5 + 0.5, 0],
              rotate: [0, 360]
            }}
            transition={{ 
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              delay: Math.random() * 8
            }}
            className="absolute"
            style={{ 
              bottom: '-20px',
              left: `${Math.random() * 100}%` 
            }}
          >
            {i % 3 === 0 ? <Sparkles className="w-4 h-4 text-yellow-300" /> : 
             i % 3 === 1 ? <Star className="w-3 h-3 text-blue-300 fill-current" /> : 
             <div className="w-2 h-2 bg-purple-400 rounded-full blur-[1px]" />}
          </motion.div>
        ))}

        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-12 relative z-10"
        >
          <div className="relative inline-block">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="absolute -top-20 left-1/2 -translate-x-1/2 transition-transform hover:scale-110 z-20">
              <img 
                src="https://ais-pre-h67t4olchfmzhn5ezfoqnf-42228107017.asia-southeast1.run.app/api/images/1709225573456.png" 
                alt="AiQ Sol Logo" 
                className="h-12 w-auto"
              />
            </a>
            <motion.div 
              animate={{ 
                boxShadow: ["0 0 30px rgba(59,130,246,0.3)", "0 0 80px rgba(59,130,246,0.6)", "0 0 30px rgba(59,130,246,0.3)"],
                scale: [1, 1.05, 1]
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="relative w-56 h-56 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border-4 border-white/30"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 animate-pulse" />
              <Smile className="w-32 h-32 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
            </motion.div>
            
            {/* SoloMan's Badge */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-4 -right-4 bg-yellow-400 p-3 rounded-2xl shadow-2xl border-4 border-white"
            >
              <Trophy className="w-8 h-8 text-white" />
            </motion.div>
          </div>
          
          <div className="space-y-4">
            <motion.h1 
              animate={{ 
                letterSpacing: ["-0.05em", "0.05em", "-0.05em"],
                textShadow: ["0 0 20px rgba(255,255,255,0.2)", "0 0 40px rgba(255,255,255,0.5)", "0 0 20px rgba(255,255,255,0.2)"]
              }}
              transition={{ duration: 6, repeat: Infinity }}
              className="text-7xl md:text-8xl font-black text-white tracking-tighter"
            >
              Welcome!
            </motion.h1>
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-12 bg-blue-400/50" />
              <p className="text-blue-300 text-xl md:text-2xl font-black tracking-[0.2em] uppercase opacity-90">A Fun Tour With AI Sol</p>
              <span className="h-px w-12 bg-blue-400/50" />
            </div>
          </div>

          <button 
            onClick={handleEnterPortal}
            className="group relative px-24 py-10 bg-white text-blue-600 rounded-full text-4xl font-black transition-all overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)] hover:scale-110 active:scale-95"
          >
            <span className="relative z-10 flex items-center gap-4">
              ENTER THE PORTAL <Rocket className="w-12 h-12 group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform" />
            </span>
            <motion.div 
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent"
            />
          </button>

          {/* Footer for Portal */}
          <div className="pt-12">
            <p className="text-white/40 font-bold text-sm tracking-widest uppercase">
              Made with love by <span className="text-blue-400">Asghar Malik</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (appState === 'name_entry') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        
        <motion.form 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onSubmit={handleSaveName}
          className="w-full max-w-xl bg-white/5 backdrop-blur-2xl p-12 rounded-[4rem] shadow-2xl border-2 border-white/10 space-y-10 relative z-10"
        >
          <div className="flex justify-center mb-4">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
              <img 
                src="https://ais-pre-h67t4olchfmzhn5ezfoqnf-42228107017.asia-southeast1.run.app/api/images/1709225573456.png" 
                alt="AiQ Sol Logo" 
                className="h-12 w-auto"
              />
            </a>
          </div>
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tight">Identify Yourself</h2>
            <p className="text-blue-300 font-bold text-xl opacity-70">The portal requires your bio-signature!</p>
          </div>
          
          <div className="space-y-8">
            {/* Profile Pic Upload */}
            <div className="flex flex-col items-center gap-6">
              <div 
                onClick={() => profilePicInputRef.current?.click()}
                className="group relative w-40 h-40 rounded-full border-4 border-dashed border-white/20 hover:border-blue-400 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-white/5"
              >
                {userProfilePic ? (
                  <img src={userProfilePic} className="w-full h-full object-cover" alt="Profile Preview" />
                ) : (
                  <div className="text-center space-y-2">
                    <Camera className="w-12 h-12 text-white/40 group-hover:text-blue-400 mx-auto" />
                    <p className="text-[10px] text-white/40 font-black uppercase">Add Photo</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
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
                autoFocus
                type="text" 
                placeholder="Enter Your Hero Name" 
                className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-8 py-6 text-2xl font-bold text-white focus:outline-none focus:border-blue-400 transition-all placeholder:text-white/20"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
              
              <label className="flex items-center gap-4 p-5 bg-white/5 rounded-3xl cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                <input 
                  type="checkbox" 
                  className="w-6 h-6 rounded-lg text-blue-500 focus:ring-blue-400 bg-transparent border-white/20"
                  checked={voiceEnabled}
                  onChange={e => setVoiceEnabled(e.target.checked)}
                />
                <span className="text-white/80 font-bold text-lg">Enable AI Voice Greeting 🔊</span>
              </label>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-6 bg-blue-600 text-white rounded-3xl text-2xl font-black shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all"
          >
            CONFIRM IDENTITY ⚡
          </button>

          {/* Footer for Name Entry */}
          <div className="text-center">
            <p className="text-white/20 font-bold text-xs tracking-widest uppercase">
              Made with love by <span className="text-blue-400/50">Asghar Malik</span>
            </p>
          </div>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFBEB] to-[#FEF3C7] text-[#1F2937] font-sans selection:bg-yellow-200 overflow-x-hidden">
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/music/preview/mixkit-mysterious-celestial-objects-542.mp3" 
        loop 
      />
      {/* Floating Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
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
          <div className="flex items-center justify-center gap-8">
            {/* SoloMan Avatar */}
            <div className="relative">
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-yellow-400 to-orange-400 rounded-[2rem] shadow-xl border-4 border-white"
              >
                <Smile className="w-14 h-14 text-white drop-shadow-md" />
              </motion.div>
              
              {/* AI Status Indicator */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute -top-2 -right-2 px-3 py-1 rounded-full shadow-lg border-2 border-white text-[10px] font-black text-white flex items-center gap-1 ${
                  aiStatus === 'online' ? 'bg-green-500' : 
                  aiStatus === 'busy' ? 'bg-blue-500' : 'bg-red-500'
                }`}
              >
                <div className={`w-2 h-2 rounded-full bg-white ${aiStatus === 'busy' ? 'animate-pulse' : ''}`} />
                {aiStatus === 'online' ? 'READY' : aiStatus === 'busy' ? 'BUSY' : 'SLEEPING'}
              </motion.div>
            </div>

            {/* Connection Line */}
            <div className="h-1 w-12 bg-gradient-to-r from-orange-200 to-blue-200 rounded-full" />

            {/* User Avatar */}
            <div className="relative">
              <motion.div 
                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                className="w-24 h-24 rounded-[2rem] shadow-xl border-4 border-white overflow-hidden bg-blue-100"
              >
                <img src={userProfilePic} className="w-full h-full object-cover" alt="User Profile" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1.5 rounded-full shadow-lg"
              >
                <Star className="w-4 h-4 fill-current" />
              </motion.div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-gray-900 drop-shadow-sm">
              {userName} & SoloMan
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-blue-200" />
              <p className="text-blue-600 font-black text-xl tracking-wide uppercase italic">AiQ Soloman's Best Friend</p>
              <span className="h-px w-8 bg-blue-200" />
            </div>
          </div>

          {/* Star Counter / Scoreboard */}
          <div className="flex flex-col items-center gap-4">
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full border-2 border-orange-100 shadow-lg"
            >
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-xl font-black text-gray-800">{stars}</span>
              <span className="text-sm font-bold text-orange-400 uppercase tracking-tighter">Star Points</span>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(stars/50) % 3 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-black shadow-md border-2 border-white"
            >
              LEVEL {level} EXPLORER 🚀
            </motion.div>

            {/* Badges Display */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {badges.map((badge, i) => (
                <motion.div
                  key={badge}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] px-3 py-1 rounded-lg font-black shadow-sm border border-white/20 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
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
              className="text-[10px] font-bold text-orange-300 hover:text-orange-500 transition-colors uppercase tracking-[0.2em]"
            >
              Check Mission Control
            </button>
          </div>
        </header>

        {/* Bubbly Tab Switcher */}
        <div className="flex bg-orange-100/50 p-2 rounded-[2rem] mb-8 shadow-inner border-2 border-orange-100 relative">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-lg font-black rounded-[1.5rem] transition-all duration-300 ${activeTab === 'tasks' ? 'bg-white shadow-xl text-orange-600 scale-[1.02] border-2 border-orange-200' : 'text-orange-400 hover:text-orange-500 hover:bg-white/30'}`}
          >
            <ListTodo className="w-6 h-6" />
            Missions
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-lg font-black rounded-[1.5rem] transition-all duration-300 ${activeTab === 'chat' ? 'bg-white shadow-xl text-blue-600 scale-[1.02] border-2 border-blue-200' : 'text-blue-400 hover:text-blue-500 hover:bg-white/30'}`}
          >
            <MessageCircle className="w-6 h-6" />
            Chat
            {chat.length > 0 && activeTab !== 'chat' && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
              >
                <span className="text-[10px] text-white font-black">!</span>
              </motion.div>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 text-lg font-black rounded-[1.5rem] transition-all duration-300 ${activeTab === 'gallery' ? 'bg-white shadow-xl text-purple-600 scale-[1.02] border-2 border-purple-200' : 'text-purple-400 hover:text-purple-500 hover:bg-white/30'}`}
          >
            <ImageIcon className="w-6 h-6" />
            Gallery
          </button>
        </div>

        <main>
          {activeTab === 'tasks' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-[2.5rem] border-4 border-orange-100 shadow-xl mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-400 p-2 rounded-xl">
                    <Smile className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-black text-gray-800">SoloMan's Challenge!</h3>
                </div>
                <p className="text-gray-600 font-bold mb-4 italic">"Hey {userName}! I've set some missions for you. Complete them to earn Star Points and level up! What should we do first?"</p>
                
                {/* Daily Challenge Card */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-2xl border-2 mb-4 ${dailyChallenge.completed ? 'bg-green-50 border-green-200' : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-orange-200 shadow-md'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Daily Challenge ⚡</span>
                    <span className="text-xs font-black text-orange-600">+{dailyChallenge.points} Stars</span>
                  </div>
                  <p className={`text-sm font-bold ${dailyChallenge.completed ? 'text-green-600 line-through' : 'text-gray-700'}`}>
                    {dailyChallenge.title}
                  </p>
                  {dailyChallenge.completed && (
                    <div className="flex items-center gap-2 mt-2 text-green-600 text-[10px] font-black uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Completed!
                    </div>
                  )}
                </motion.div>

                <div className="bg-blue-50 p-3 rounded-2xl flex items-center gap-3 border-2 border-blue-100">
                  <Rocket className="w-5 h-5 text-blue-400" />
                  <p className="text-blue-600 text-sm font-black uppercase tracking-tighter">Tip: Tap "Chat" to talk to me!</p>
                </div>
              </div>

              <form onSubmit={addTask} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <input 
                  type="text" 
                  placeholder="What's your next big mission?" 
                  className="relative w-full bg-white border-4 border-orange-100 rounded-[2.5rem] px-8 py-5 pr-20 text-xl font-bold focus:outline-none focus:border-orange-400 transition-all shadow-xl placeholder:text-gray-300"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-lg flex items-center justify-center">
                  <Plus className="w-8 h-8 stroke-[4px]" />
                </button>
              </form>

              <div className="space-y-5">
                <AnimatePresence mode="popLayout">
                  {tasks.length > 0 && tasks.every(t => t.status === 'completed') && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-[3rem] text-center shadow-2xl border-4 border-white"
                    >
                      <Trophy className="w-16 h-16 text-white mx-auto mb-4 animate-bounce" />
                      <h2 className="text-3xl font-black text-white">VICTORY!</h2>
                      <p className="text-white font-bold opacity-90">You completed all your missions! You're a superstar! 🌟</p>
                      <button 
                        onClick={() => {
                          confetti({
                            particleCount: 200,
                            spread: 100,
                            origin: { y: 0.6 }
                          });
                        }}
                        className="mt-4 px-6 py-2 bg-white text-orange-500 rounded-full font-black hover:scale-105 transition-transform"
                      >
                        CELEBRATE! 🎉
                      </button>
                    </motion.div>
                  )}
                  {tasks.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white/40 backdrop-blur-sm border-4 border-dashed border-orange-200 rounded-[3rem] p-16 text-center space-y-4"
                    >
                      <div className="flex justify-center">
                        <Rocket className="w-16 h-16 text-orange-200 animate-bounce" />
                      </div>
                      <p className="text-orange-400 font-black text-2xl">
                        No missions yet!<br/>
                        <span className="text-lg font-bold opacity-60">Add one above to start your journey!</span>
                      </p>
                    </motion.div>
                  ) : (
                    tasks.map((task) => (
                      <motion.div 
                        key={task.id}
                        layout
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        className={`flex items-center gap-5 p-6 rounded-[2.5rem] border-4 transition-all shadow-lg relative overflow-hidden ${task.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-white hover:border-orange-200'}`}
                      >
                        {task.status === 'completed' && (
                          <div className="absolute top-0 right-0 p-2">
                            <Sparkles className="w-6 h-6 text-green-300 animate-pulse" />
                          </div>
                        )}
                        <button 
                          onClick={() => toggleTask(task.id, task.status)}
                          className={`transition-all duration-500 active:scale-150 ${task.status === 'completed' ? 'text-green-500 scale-110' : 'text-orange-100 hover:text-orange-400'}`}
                        >
                          {task.status === 'completed' ? <CheckCircle2 className="w-10 h-10" /> : <Circle className="w-10 h-10" />}
                        </button>
                        <span className={`flex-1 text-xl font-black tracking-tight ${task.status === 'completed' ? 'line-through text-green-200' : 'text-gray-700'}`}>
                          {task.title}
                        </span>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-3 text-gray-100 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 className="w-6 h-6" />
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
              className="flex flex-col h-[650px] bg-white rounded-[3rem] border-4 border-blue-100 shadow-2xl overflow-hidden relative"
            >
              {/* Chat Background Pattern */}
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#3b82f6_2px,transparent_2px)] [background-size:30px_30px]" />

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative z-10">
                {chat.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-blue-300 font-black text-center space-y-6">
                    <motion.div
                      animate={{ y: [0, -15, 0], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      <PartyPopper className="w-20 h-20 text-blue-400" />
                    </motion.div>
                    <div className="space-y-4">
                      <p className="text-3xl">Ready for Fun?</p>
                      <p className="text-lg font-bold opacity-60">I'm SoloMan, your AI bestie!<br/>Try saying: "Show me a space cat!" 🐱🚀</p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-xs mx-auto">
                        {['"Show me a dragon"', '"Bring me a robot"', '"Pic of a unicorn"'].map(tip => (
                          <button 
                            key={tip}
                            onClick={() => setMessage(tip.replace(/"/g, ''))}
                            className="text-[10px] bg-blue-50 text-blue-500 px-3 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
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
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] min-w-[80px] rounded-[2.5rem] px-8 py-6 text-xl font-bold shadow-2xl relative ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-none' 
                        : 'bg-gradient-to-br from-white to-blue-50 border-4 border-blue-100 text-blue-900 rounded-tl-none'
                    }`}>
                      {msg.role === 'model' && (
                        <div className="absolute -top-6 -left-6 bg-yellow-400 p-3 rounded-2xl shadow-xl border-4 border-white">
                          <Smile className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words leading-relaxed">
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "SoloMan is processing..."}</Markdown>
                        {msg.imageUrl && (
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mt-4 rounded-2xl overflow-hidden shadow-lg border-4 border-white relative"
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Generated by SoloMan" 
                              className="w-full h-auto"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-[8px] text-white/80 font-bold text-center">
                              Made with love by Asghar Malik
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-br from-white to-blue-50 border-4 border-blue-100 rounded-[2.5rem] px-8 py-6 flex items-center gap-4 shadow-xl">
                      <motion.div 
                        animate={{ 
                          rotate: [0, 20, -20, 0],
                          scale: [1, 1.2, 1]
                        }} 
                        transition={{ repeat: Infinity, duration: 1 }} 
                      >
                        <Zap className="w-8 h-8 text-yellow-400 fill-current" />
                      </motion.div>
                      <p className="text-blue-900 font-black italic animate-pulse">SoloMan is processing...</p>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-8 border-t-4 border-blue-50 bg-white relative z-10">
                {selectedImageForEdit && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-4 p-3 bg-blue-50 rounded-2xl border-2 border-blue-200 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white shadow-sm">
                      <img src={selectedImageForEdit} className="w-full h-full object-cover" alt="To Edit" />
                    </div>
                    <div className="flex-1">
                      <p className="text-blue-600 text-xs font-black uppercase">Editing Mode Active! ✨</p>
                      <p className="text-blue-400 text-[10px] font-bold">Tell SoloMan what to change!</p>
                    </div>
                    <button 
                      onClick={() => setSelectedImageForEdit(null)}
                      className="text-blue-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
                <div className="flex gap-3">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-100 transition-all flex items-center justify-center shadow-md border-2 border-blue-100"
                  >
                    <ImagePlus className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={clearChat}
                    className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center shadow-md border-2 border-red-100"
                    title="Clear Chat"
                  >
                    <Trash2 className="w-8 h-8" />
                  </button>
                  <form onSubmit={sendMessage} className="relative group flex-1">
                    <div className="absolute -inset-1 bg-blue-400 rounded-[2rem] blur opacity-10 group-focus-within:opacity-30 transition duration-300"></div>
                    <input 
                      type="text" 
                      disabled={aiStatus === 'offline'}
                      placeholder={aiStatus === 'offline' ? "SoloMan is sleeping right now..." : "Tell SoloMan something awesome!"} 
                      className="relative w-full bg-blue-50 border-4 border-transparent rounded-[2rem] px-8 py-5 pr-20 text-xl font-bold focus:outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-blue-200 disabled:opacity-50"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                    />
                    <button 
                      disabled={isTyping || !message.trim() || aiStatus === 'offline'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl hover:scale-110 active:scale-95 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center"
                    >
                      <Send className="w-8 h-8" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <Sparkles className="w-24 h-24" />
                </div>
                <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                  <ImageIcon className="w-8 h-8" /> Creation Gallery
                </h2>
                <p className="text-purple-100 font-bold">All your creations and uploads are saved here! ✨</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {gallery.length === 0 ? (
                  <div className="col-span-2 bg-white/40 backdrop-blur-sm border-4 border-dashed border-purple-200 rounded-[3rem] p-16 text-center space-y-4">
                    <ImageIcon className="w-16 h-16 text-purple-200 mx-auto animate-pulse" />
                    <p className="text-purple-400 font-black text-2xl">Your Gallery is Empty!</p>
                    <p className="text-purple-300 font-bold">Upload a pic or ask SoloMan to generate one!</p>
                  </div>
                ) : (
                  gallery.map((img) => (
                    <motion.div 
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative bg-white rounded-[2rem] overflow-hidden shadow-xl border-4 border-white hover:border-purple-200 transition-all"
                    >
                      <img 
                        src={img.url} 
                        alt={img.prompt || "Gallery Image"} 
                        className="w-full aspect-square object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-[8px] text-white/80 font-bold text-center">
                        Made with love by Asghar Malik
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-white font-black text-sm mb-2">{img.type === 'generated' ? '✨ Generated' : '📸 Uploaded'}</p>
                        {img.prompt && <p className="text-white/80 text-[10px] font-bold italic line-clamp-2">"{img.prompt}"</p>}
                        <button 
                          onClick={() => {
                            setSelectedImageForEdit(img.url);
                            setActiveTab('chat');
                            if (voiceEnabled) speak("Okay! Let's edit this picture. What should I do to it?");
                          }}
                          className="mt-4 p-2 bg-blue-500 text-white rounded-xl hover:scale-110 transition-transform"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            await fetch(`/api/gallery/${img.id}`, { method: 'DELETE' });
                            fetchGallery();
                          }}
                          className="mt-4 p-2 bg-red-500 text-white rounded-xl hover:scale-110 transition-transform"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </main>

        {/* Footer with Logo and Credits */}
        <footer className="mt-16 pb-8 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <a href="https://aiqsol.io" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
              <img 
                src="https://ais-pre-h67t4olchfmzhn5ezfoqnf-42228107017.asia-southeast1.run.app/api/images/1709225573456.png" 
                alt="AiQ Sol Logo" 
                className="h-16 w-auto drop-shadow-lg"
              />
            </a>
            <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">
              Made with love by <span className="text-orange-500">Asghar Malik</span>
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FEF3C7;
          border: 2px solid white;
          border-radius: 20px;
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

