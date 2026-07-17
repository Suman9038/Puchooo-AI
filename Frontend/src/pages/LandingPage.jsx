import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, BookOpen, MessageSquare, Brain, Play, Shield, Zap } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import logo from "../assets/logo.png";

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const { scrollYProgress } = useScroll();
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  const springBounce = {
    type: "spring",
    stiffness: 400,
    damping: 15,
    bounce: 0.6
  };

  const fadeIn = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { ...springBounce, delay: 0.1 }
  };

  return (
    <div className="w-full relative bg-pastel-yellow overflow-hidden min-h-screen">
      
      {/* Cartoon Polka Dot Background */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
          backgroundSize: '40px 40px',
        }}
      >
        <motion.div 
          animate={{ backgroundPosition: ['0px 0px', '40px 40px'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'radial-gradient(var(--border-color-cartoon) 3px, transparent 3px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        
        {/* SECTION 1: HERO */}
        <section className="min-h-screen w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center pt-24 pb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-4xl"
          >
            <motion.div 
              initial={{ opacity: 0, y: -20, rotate: -5 }}
              animate={{ opacity: 1, y: 0, rotate: -2 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
              className="mb-8"
            >
              <img src={logo} alt="Puchooo.AI Logo" className="h-32 md:h-40 object-contain drop-shadow-md" />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: -20, rotate: -5 }}
              animate={{ opacity: 1, y: 0, rotate: -2 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pastel-mint border-cartoon shadow-neubrutalism-sm mb-8 transform -rotate-2"
            >
              <Sparkles size={16} className="text-slate-900" />
              <span className="text-sm font-bold text-slate-900 tracking-wide uppercase">The Smarter Way to Study</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-8xl font-heading font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
              Turn YouTube Videos <br />
              <span className="text-pastel-peach relative inline-block">
                <span className="absolute -inset-1 bg-slate-900 transform -skew-x-12 z-[-1]"></span>
                <span className="relative text-white px-2">Into Dialogues.</span>
              </span>
            </h1>
            
            <p className="text-lg md:text-2xl text-slate-800 font-bold max-w-2xl mb-12 leading-relaxed bg-white/50 backdrop-blur-sm p-4 border-cartoon rounded-3xl">
              Paste any YouTube video link and instantly chat with it. Ask complex questions, extract summaries, and generate study notes in seconds.
            </p>
            
            {isAuthenticated ? (
              <Link to="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative flex items-center gap-3 px-8 py-5 bg-pastel-blue text-slate-900 border-cartoon shadow-neubrutalism rounded-full font-black text-xl hover:bg-pastel-mint transition-colors duration-300"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <Link to="/login?tab=signup">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative flex items-center gap-3 px-8 py-4 bg-pastel-peach text-slate-900 border-cartoon shadow-neubrutalism rounded-full font-black text-xl hover:bg-pastel-yellow transition-colors duration-300"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </Link>
                <Link to="/login">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-white text-slate-900 border-cartoon rounded-full font-black text-xl shadow-neubrutalism-sm hover:bg-pastel-lavender transition-colors"
                  >
                    Log In
                  </motion.button>

                </Link>
              </div>
            )}
          </motion.div>
        </section>

        {/* SECTION 2: HOW IT WORKS */}
        <section className="w-full py-32 bg-pastel-lavender border-y-cartoon relative z-10">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              {...fadeIn}
              className="text-center mb-24"
            >
              <h2 className="text-4xl md:text-6xl font-heading font-black text-slate-900 mb-4 tracking-tight">How it works</h2>
              <p className="text-xl text-slate-800 font-bold max-w-xl mx-auto">Three simple steps to unlock the knowledge inside any video.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[var(--border-width-cartoon)] bg-slate-900 -z-10"></div>
              
              {[
                { 
                  icon: <BookOpen size={40} />, 
                  title: "1. Paste Link", 
                  desc: "Drop any YouTube URL into the dashboard. We handle the transcript retrieval instantly.",
                  color: "bg-pastel-peach"
                },
                { 
                  icon: <Brain size={40} />, 
                  title: "2. AI Processing", 
                  desc: "Our Hybrid RAG engine analyzes the transcripts, building an index for semantic questioning.",
                  color: "bg-pastel-mint"
                },
                { 
                  icon: <MessageSquare size={40} />, 
                  title: "3. Start Chatting", 
                  desc: "Ask questions, generate summaries, and interact with the video content like a real tutor.",
                  color: "bg-pastel-blue"
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 50, scale: 0.5 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ ...springBounce, delay: i * 0.2 }}
                  whileHover={{ y: -10, rotate: (i%2===0)?-2:2 }}
                  className="card-cartoon p-8 flex flex-col gap-6"
                >
                  <div className={`w-20 h-20 ${feature.color} border-cartoon shadow-neubrutalism-sm rounded-full flex items-center justify-center text-slate-900`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-3xl font-heading font-black text-slate-900 tracking-tight">{feature.title}</h3>
                  <p className="text-slate-800 font-bold text-lg leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: FEATURES / HIGHLIGHTS */}
        <section className="w-full py-32 bg-pastel-blue max-w-full px-6 overflow-hidden border-b-cartoon relative z-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={springBounce}
              className="flex flex-col gap-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pastel-yellow border-cartoon shadow-neubrutalism-sm self-start">
                <Zap size={20} className="text-slate-900" />
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Features</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-heading font-black text-slate-900 tracking-tight leading-tight">
                Designed for efficient learning.
              </h2>
              <p className="text-xl text-slate-800 font-bold leading-relaxed">
                Puchooo AI doesn't just read transcripts. It listens, processes, and allows you to cross-reference multiple segments instantly.
              </p>
              
              <ul className="flex flex-col gap-5 mt-4">
                {[
                  "Hybrid Vector Search for pinpoint accuracy",
                  "Preserves video timestamps to jump right to the source",
                  "Supports long lectures and multi-hour podcasts",
                  "Secure and private study environment"
                ].map((item, i) => (
                  <motion.li 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ ...springBounce, delay: 0.3 + (i * 0.1) }}
                    className="flex items-center gap-4 text-slate-900 font-black text-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-pastel-mint border-cartoon flex items-center justify-center shrink-0 shadow-neubrutalism-sm">
                      ✓
                    </div>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 50, scale: 0.5, rotate: 10 }}
              whileInView={{ opacity: 1, x: 0, scale: 1, rotate: 2 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={springBounce}
              className="relative w-full aspect-square md:aspect-video lg:aspect-square bg-pastel-peach card-cartoon overflow-hidden flex items-center justify-center p-8 transform rotate-2"
            >
              {/* Abstract UI representation */}
              <div className="w-full h-full bg-white border-cartoon shadow-neubrutalism flex flex-col overflow-hidden rounded-2xl">
                <div className="w-full h-14 bg-slate-900 border-b-cartoon flex items-center px-4 gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-400 border-2 border-black"></div>
                  <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-black"></div>
                  <div className="w-4 h-4 rounded-full bg-green-400 border-2 border-black"></div>
                </div>
                <div className="p-8 flex flex-col gap-6">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: "70%" }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="h-6 bg-slate-200 border-2 border-black rounded-full"
                  ></motion.div>
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: "90%" }}
                    transition={{ delay: 0.7, type: "spring" }}
                    className="h-6 bg-slate-200 border-2 border-black rounded-full"
                  ></motion.div>
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: "50%" }}
                    transition={{ delay: 0.9, type: "spring" }}
                    className="h-6 bg-slate-200 border-2 border-black rounded-full"
                  ></motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 1.2, type: "spring", bounce: 0.7 }}
                    className="mt-6 p-6 bg-pastel-yellow border-cartoon rounded-2xl shadow-neubrutalism transform -rotate-2"
                  >
                    <p className="text-slate-900 font-black text-lg">AI: The key concept discussed at 14:20 is quantum entanglement...</p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FOOTER CTA */}
        <section className="w-full py-32 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={springBounce}
            className="max-w-4xl mx-auto px-6 text-center relative z-10 flex flex-col items-center"
          >
            <h2 className="text-5xl md:text-7xl font-heading font-black mb-6 tracking-tight text-pastel-yellow transform -rotate-1">Ready to ace your exams?</h2>
            <p className="text-2xl text-slate-300 font-bold mb-12 max-w-2xl">
              Join thousands of students learning faster with Puchooo AI. No credit card required.
            </p>
            <Link to="/login?tab=signup">
              <motion.button
                whileHover={{ scale: 1.1, rotate: -2 }}
                whileTap={{ scale: 0.9 }}
                className="group relative flex items-center gap-3 px-12 py-6 bg-pastel-peach text-slate-900 border-cartoon rounded-full font-black text-2xl shadow-neubrutalism hover:bg-pastel-mint transition-colors duration-300"
              >
                <span>Create Free Account</span>
                <ArrowRight size={28} className="group-hover:translate-x-2 transition-transform" />
              </motion.button>
            </Link>
          </motion.div>
        </section>
        
      </div>
    </div>
  );
}
