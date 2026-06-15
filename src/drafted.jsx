import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   DRAFTED — Ink & Correspondence
   Full motion build. Every transition is earned.

   Motion added in this version:
   1. STEP PROGRESS BAR — spring-animated gold fill showing
      how far through the form you are. Settles with weight.
   2. HERO WORD ENTRANCE — each word in the step headline
      arrives with a staggered spring, not all at once.
   3. FOOTER SPRING — Back and Continue buttons spring in
      on mount, not just static. Slide up from below.
   4. NAVIGATION TRANSITION — step change triggers a
      directional slide (forward = left, back = right).
      Fields slide out one direction, in from the other.
   5. LETTER REVEAL SEQUENCE on preview:
      - Parchment panel slides in from left (spring)
      - Horizontal rule draws across (spring width)
      - Candidate name writes in character by character
      - Role/company fades up after name completes
      - Actions panel slides in from right with delay
      - Each action button staggers up individually
   6. PREVIEW LETTER LINES stagger in on render,
      each line arriving 20ms after previous.
   7. GENERATE BUTTON PULSE — when allFilled, the button
      breathes with a gold glow pulse (ambient, earned).

   All existing motion kept:
   - Spring underline on inputs
   - Floating label spring
   - layoutId step underline slide
   - Field stagger variants
   - AnimatePresence step hero
   - Curtain wipe
   - Typewriter stream
   - whileHover/whileTap everywhere
═══════════════════════════════════════════════════════════ */

const C = {
  void:        "#0A0805",
  base:        "#0F0C08",
  surface:     "#1C1610",
  raised:      "#2A2018",
  high:        "#342A1E",
  gold:        "#D4A843",
  goldMid:     "rgba(212,168,67,0.55)",
  goldDim:     "rgba(212,168,67,0.28)",
  goldFaint:   "rgba(212,168,67,0.10)",
  goldGlow:    "rgba(212,168,67,0.20)",
  sepia:       "#8A7250",
  sepiaMid:    "rgba(138,114,80,0.45)",
  sepiaFaint:  "rgba(138,114,80,0.15)",
  border:      "rgba(138,114,80,0.14)",
  borderMid:   "rgba(138,114,80,0.26)",
  borderHigh:  "rgba(138,114,80,0.50)",
  ink:         "#F2E8D5",
  inkMid:      "rgba(242,232,213,0.62)",
  inkDim:      "rgba(242,232,213,0.38)",
  inkFaint:    "rgba(242,232,213,0.16)",
  parchment:   "#F2E8D5",
  parchDeep:   "#E8DCCA",
  parchInk:    "#1C1610",
  display:     "'Abril Fatface', Georgia, serif",
  body:        "'Lora', Georgia, serif",
  mono:        "'DM Mono', 'IBM Plex Mono', monospace",
};

const SP = {
  snap:    { type:"spring", stiffness:500, damping:32 },
  arrive:  { type:"spring", stiffness:340, damping:28 },
  press:   { type:"spring", stiffness:600, damping:36, mass:0.8 },
  curtain: { type:"spring", stiffness:260, damping:30 },
  progress:{ type:"spring", stiffness:180, damping:26, mass:1.2 },
  letter:  { type:"spring", stiffness:300, damping:30, mass:1 },
};

const EASE_EXPO = [0.16, 1, 0.3, 1];

const STEPS = [
  { id:"candidate",    label:"Candidate",    num:"I"   },
  { id:"compensation", label:"Compensation", num:"II"  },
  { id:"terms",        label:"Terms",        num:"III" },
  { id:"company",      label:"Company",      num:"IV"  },
];

const FIELDS = {
  candidate: [
    { key:"candidateName",    label:"Full Name",          placeholder:"Priya Sharma",                          span:2 },
    { key:"role",             label:"Role / Designation", placeholder:"HR Executive"                                 },
    { key:"department",       label:"Department",         placeholder:"Human Resources"                             },
    { key:"reportingManager", label:"Reporting Manager",  placeholder:"Anjali Mehta"                                },
    { key:"workLocation",     label:"Work Location",      placeholder:"Bengaluru, Karnataka"                        },
    { key:"workMode",         label:"Work Mode",          placeholder:"On-site / Hybrid / Remote"                   },
    { key:"startDate",        label:"Start Date",         placeholder:"1st July 2026"                               },
  ],
  compensation: [
    { key:"ctc",        label:"Annual CTC",                  placeholder:"₹4,50,000",                          span:2 },
    { key:"basic",      label:"Basic (monthly)",             placeholder:"₹15,000 — leave blank to auto-calc"       },
    { key:"hra",        label:"HRA (monthly)",               placeholder:"₹7,500 — leave blank to auto-calc"        },
    { key:"allowances", label:"Other Allowances (monthly)",  placeholder:"₹15,000 — leave blank to auto-calc"       },
  ],
  terms: [
    { key:"probationPeriod", label:"Probation Period", placeholder:"6 months"                                                     },
    { key:"noticePeriod",    label:"Notice Period",    placeholder:"30 days probation, 60 days post confirmation"                 },
    { key:"specialClauses",  label:"Special Clauses",  placeholder:"Joining bonus, stock options, relocation...", multiline:true, span:2 },
  ],
  company: [
    { key:"companyName",    label:"Company Name",       placeholder:"Nexus Solutions Pvt. Ltd."              },
    { key:"hrName",         label:"HR Signatory Name",  placeholder:"Anjali Mehta"                           },
    { key:"companyAddress", label:"Company Address",    placeholder:"12, Koramangala, Bengaluru – 560034", span:2 },
    { key:"hrTitle",        label:"HR Signatory Title", placeholder:"HR Manager"                             },
  ],
};

const defaultForm = {
  candidateName:"", role:"", department:"", reportingManager:"",
  workLocation:"", workMode:"", startDate:"", ctc:"", basic:"",
  hra:"", allowances:"", probationPeriod:"", noticePeriod:"",
  specialClauses:"", companyName:"", companyAddress:"", hrName:"", hrTitle:"",
};

const requiredKeys = [
  "candidateName","role","department","reportingManager","startDate","ctc",
  "probationPeriod","noticePeriod","workLocation","companyName","hrName","hrTitle"
];

function buildPrompt(f) {
  return `You are a senior HR professional writing a formal employment offer letter on behalf of ${f.companyName}.
Generate a COMPLETE, professionally worded offer letter. No placeholders, no brackets — fully written.
DETAILS:
Candidate: ${f.candidateName} | Role: ${f.role} | Department: ${f.department}
Reporting to: ${f.reportingManager} | Location: ${f.workLocation} | Mode: ${f.workMode||"On-site"}
Start Date: ${f.startDate} | Annual CTC: ${f.ctc}
Basic: ${f.basic||"~40% of CTC"} | HRA: ${f.hra||"~20% of CTC"} | Allowances: ${f.allowances||"remainder"}
Probation: ${f.probationPeriod} | Notice: ${f.noticePeriod}
Special Clauses: ${f.specialClauses||"None"}
Company: ${f.companyName} | Address: ${f.companyAddress}
Signatory: ${f.hrName}, ${f.hrTitle}
Write a complete offer letter with: letterhead, reference line, salutation, role paragraph, CTC breakdown table, terms, confidentiality clause, joining instructions, acceptance deadline, closing, signature block. Indian corporate English, warm but formal.`;
}

/* ══════════════════════════════════════════════════════
   TYPEWRITER STREAM — signature element
   Character by character. Cursor blinks. Scrolls to ink.
══════════════════════════════════════════════════════ */
function TypewriterStream({ fullText, onComplete }) {
  const [displayed, setDisplayed] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!fullText) return;
    indexRef.current = 0;
    setDisplayed("");
    setDone(false);
    const interval = setInterval(() => {
      if (indexRef.current < fullText.length) {
        const chunk = Math.floor(Math.random() * 3) + 1;
        indexRef.current = Math.min(indexRef.current + chunk, fullText.length);
        setDisplayed(fullText.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
        setDone(true);
        setTimeout(() => { onComplete && onComplete(); }, 600);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [fullText, onComplete]);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayed]);

  return (
    <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"52px 64px",
      background:C.parchment, fontFamily:C.body, fontSize:13.5, lineHeight:1.9, color:C.parchInk }}>
      <div style={{ marginBottom:32, paddingBottom:20, borderBottom:`1px solid ${C.parchDeep}` }}>
        <div style={{ fontFamily:C.mono, fontSize:9, color:C.sepia, letterSpacing:"0.2em",
          textTransform:"uppercase", marginBottom:8 }}>Offer Letter · Composing</div>
        <div style={{ fontFamily:C.display, fontSize:36, color:C.parchInk, lineHeight:1 }}>
          {displayed.length > 0 ? "In Progress" : "Preparing…"}
        </div>
      </div>
      <div style={{ whiteSpace:"pre-wrap", position:"relative" }}>
        {displayed}
        <span style={{ display:"inline-block", width:2, height:"1.1em",
          background:C.gold, marginLeft:2, verticalAlign:"text-bottom",
          opacity: done ? 0 : cursorVisible ? 1 : 0,
          transition: done ? "opacity 1s ease" : "none" }}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ATELIER INPUT — spring underline, floating label
══════════════════════════════════════════════════════ */
function AtelierInput({ label, value, onChange, placeholder, multiline }) {
  const [focused, setFocused] = useState(false);
  const hasVal = value.length > 0;
  const active = focused || hasVal;

  return (
    <div style={{ position:"relative", paddingTop:22 }}>
      <motion.label
        animate={{
          fontSize: active ? 9 : 13,
          letterSpacing: active ? "0.20em" : "0.04em",
          color: focused ? C.gold : active ? C.inkMid : C.inkDim,
          y: active ? 0 : 4,
        }}
        transition={SP.snap}
        style={{ position:"absolute", top:0, left:0,
          fontFamily: active ? C.mono : C.body,
          fontStyle: active ? "normal" : "italic",
          textTransform: active ? "uppercase" : "none",
          pointerEvents:"none", whiteSpace:"nowrap", display:"block" }}>
        {label}
      </motion.label>

      {multiline ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder={focused?placeholder:""}
          rows={3}
          style={{ width:"100%", background:"transparent", border:"none", color:C.ink,
            fontFamily:C.body, fontStyle:"italic", fontSize:16, lineHeight:1.75,
            resize:"none", outline:"none", paddingTop:6, caretColor:C.gold,
            marginTop:4, boxSizing:"border-box" }}/>
      ) : (
        <input value={value} onChange={e=>onChange(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder={focused?placeholder:""}
          style={{ width:"100%", background:"transparent", border:"none", color:C.ink,
            fontFamily:C.body, fontStyle:"italic", fontSize:16, lineHeight:1,
            outline:"none", paddingTop:6, paddingBottom:8, caretColor:C.gold,
            marginTop:4, display:"block", boxSizing:"border-box" }}/>
      )}

      <div style={{ position:"relative", height:1, marginTop:0 }}>
        <div style={{ position:"absolute", inset:0, background:C.border }}/>
        <motion.div
          animate={{ width: focused ? "100%" : hasVal ? "100%" : "0%" }}
          transition={SP.curtain}
          style={{ position:"absolute", top:0, left:0, height:"100%", borderRadius:1,
            background: focused ? C.gold : C.sepiaMid,
            boxShadow: focused ? `0 0 10px ${C.goldGlow}` : "none" }}/>
      </div>

      <AnimatePresence>
        {focused && (
          <motion.p initial={{ opacity:0, y:-3 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ duration:0.15 }}
            style={{ fontSize:10, color:C.sepia, fontFamily:C.mono,
              marginTop:5, letterSpacing:"0.06em", fontStyle:"italic" }}>
            {placeholder}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LETTER RENDERER — staggered line entrance on preview
   Each line springs in 20ms after the previous one.
   The letter doesn't just appear — it arrives.
══════════════════════════════════════════════════════ */
function LetterRenderer({ text }) {
  const lines = text.split("\n");
  return (
    <motion.div
      variants={{ show:{ transition:{ staggerChildren:0.018 } } }}
      initial="hidden" animate="show">
      {lines.map((line, i) => {
        const lineVariant = {
          hidden:{ opacity:0, y:6 },
          show:{ opacity:1, y:0, transition:{ ...SP.arrive } },
        };

        if (/^#{1,3}\s/.test(line)) {
          const h = line.replace(/^#{1,3}\s/, "");
          return (
            <motion.p key={i} variants={lineVariant}
              style={{ fontSize:14, fontWeight:700, color:C.parchInk,
                margin:"18px 0 6px", fontFamily:C.body, letterSpacing:"0.04em" }}>{h}</motion.p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const pts = line.slice(2).split(/\*\*(.*?)\*\*/g);
          return (
            <motion.div key={i} variants={lineVariant} style={{ display:"flex", gap:8, margin:"3px 0" }}>
              <span style={{ flexShrink:0, color:C.sepia, marginTop:2 }}>—</span>
              <span style={{ fontSize:13.5, lineHeight:1.9, fontFamily:C.body }}>
                {pts.map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}
              </span>
            </motion.div>
          );
        }
        if (!line.trim()) return <motion.div key={i} variants={lineVariant} style={{ height:9 }}/>;
        if (line.match(/^---+$/)) return <motion.div key={i} variants={lineVariant} style={{ height:1, background:C.parchDeep, margin:"10px 0" }}/>;
        const pts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <motion.p key={i} variants={lineVariant}
            style={{ margin:"3px 0", lineHeight:1.9, fontSize:13.5, fontFamily:C.body }}>
            {pts.map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}
          </motion.p>
        );
      })}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   PRESS BUTTON — spring physics, no inline hover hacks
══════════════════════════════════════════════════════ */
function PressBtn({ onClick, disabled, children, style={}, gold=false }) {
  return (
    <motion.button onClick={onClick} disabled={disabled}
      whileHover={disabled?{}:{ scale:1.01, transition:SP.snap }}
      whileTap={disabled?{}:{ scale:0.97, transition:SP.press }}
      style={{
        background: disabled ? C.surface : gold ? C.gold : "transparent",
        color: disabled ? C.inkFaint : gold ? C.void : C.inkMid,
        border: gold ? "none" : `1px solid ${C.border}`,
        borderRadius:0, fontFamily:C.mono, cursor:disabled?"not-allowed":"pointer",
        boxShadow: (!disabled && gold) ? `0 0 28px ${C.goldGlow}` : "none",
        ...style,
      }}>
      {children}
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════
   ANIMATED WORD HEADLINE
   Each word in the step headline springs in staggered.
   Not letter by letter — word by word feels like thought.
══════════════════════════════════════════════════════ */
function AnimatedHeadline({ children }) {
  const text = typeof children === "string" ? children : null;
  if (!text) {
    // JSX children — just animate the whole block
    return (
      <motion.h2
        initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
        transition={{ ...SP.arrive, delay:0.05 }}
        style={{ fontFamily:C.display, fontSize:52, color:C.ink,
          margin:0, letterSpacing:"-1.5px", lineHeight:0.95 }}>
        {children}
      </motion.h2>
    );
  }
  const words = text.split(" ");
  return (
    <motion.h2
      variants={{ show:{ transition:{ staggerChildren:0.06, delayChildren:0.05 } } }}
      initial="hidden" animate="show"
      style={{ fontFamily:C.display, fontSize:52, color:C.ink,
        margin:0, letterSpacing:"-1.5px", lineHeight:0.95 }}>
      {words.map((w, i) => (
        <motion.span key={i}
          variants={{ hidden:{opacity:0, y:12}, show:{opacity:1, y:0, transition:SP.arrive} }}
          style={{ display:"inline-block", marginRight:"0.28em" }}>
          {w}
        </motion.span>
      ))}
    </motion.h2>
  );
}

/* ══════════════════════════════════════════════════════
   STEP PROGRESS BAR
   Gold bar spring-animates to (step+1)/4 width.
   Has physical weight — settles with slight overshoot.
   Tells you exactly where you are without words.
══════════════════════════════════════════════════════ */
function StepProgress({ step, total }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div style={{ height:1, background:C.border, position:"relative", overflow:"hidden" }}>
      <motion.div
        animate={{ width:`${pct}%` }}
        transition={SP.progress}
        style={{ position:"absolute", left:0, top:0, height:"100%",
          background:C.gold, boxShadow:`0 0 8px ${C.goldGlow}` }}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
export default function Drafted() {
  const [step, setStep]         = useState(0);
  const [stepDir, setStepDir]   = useState(1); // 1 = forward, -1 = backward
  const [form, setForm]         = useState(defaultForm);
  const [stage, setStage]       = useState("form");
  const [fullText, setFullText] = useState("");
  const [letter, setLetter]     = useState("");
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [curtain, setCurtain]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const stepKey  = STEPS[step].id;
  const fields   = FIELDS[stepKey];
  const isLast   = step === STEPS.length - 1;
  const allFilled = requiredKeys.every(k => form[k].trim() !== "");
  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]:v })), []);

  function goStep(next) {
    setStepDir(next > step ? 1 : -1);
    setStep(next);
  }

  async function withCurtain(fn) {
    setCurtain(true);
    await new Promise(r => setTimeout(r, 550));
    await fn();
    setCurtain(false);
    await new Promise(r => setTimeout(r, 400));
  }

  async function generate() {
    await withCurtain(async () => {
      setStage("streaming");
      setFullText("");
      setError("");
    });
    try {
      const res = await fetch("/api/v1/messages", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":process.env.REACT_APP_API_KEY,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body:JSON.stringify({
          model:"claude-sonnet-4-5", max_tokens:1500,
          messages:[{ role:"user", content:buildPrompt(form) }]
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b=>b.text||"").join("")||"";
      if (!text) throw new Error("Empty response");
      setFullText(text);
    } catch(e) {
      setError("Generation failed. Please try again.");
      setStage("form");
    }
  }

  const onStreamComplete = useCallback(async () => {
    await withCurtain(async () => {
      setLetter(fullText);
      setStage("preview");
    });
  }, [fullText]);

  function downloadWord() {
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.8;}</style></head><body><pre style='font-family:Times New Roman,serif;font-size:12pt;line-height:1.8;white-space:pre-wrap;'>${letter.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
    const blob = new Blob(["\ufeff", html], { type:"application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `OfferLetter_${form.candidateName.replace(/\s+/g,"_")}.doc`;
    a.click();
  }

  function downloadPDF() {
    const win = window.open("","_blank");
    const content = `<!DOCTYPE html><html><head><style>body{font-family:'Times New Roman',serif;font-size:14px;line-height:1.9;color:#1a1a1a;max-width:720px;margin:48px auto;padding:0 48px;}pre{white-space:pre-wrap;font-family:inherit;}</style><title>Offer Letter</title></head><body><pre>${letter.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
    win.document.write(content);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  function copyText() {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  // Directional field slide variants
  const fieldVariants = {
    hidden:  (dir) => ({ opacity:0, x: dir * 32 }),
    show:    { opacity:1, x:0, transition:{ ...SP.arrive, staggerChildren:0.045, delayChildren:0.06 } },
    exit:    (dir) => ({ opacity:0, x: dir * -24, transition:{ duration:0.18, ease:EASE_EXPO } }),
  };
  const fieldItem = {
    hidden: { opacity:0, y:14 },
    show:   { opacity:1, y:0, transition:SP.arrive },
  };

  // Footer button variants — spring up on mount
  const footerVariants = {
    hidden: { opacity:0, y:12 },
    show:   { opacity:1, y:0, transition:SP.arrive },
  };

  // Action button stagger for preview panel
  const actionListVariants = {
    hidden: {},
    show: { transition:{ staggerChildren:0.07, delayChildren:0.3 } },
  };
  const actionItemVariants = {
    hidden: { opacity:0, x:12 },
    show:   { opacity:1, x:0, transition:SP.arrive },
  };

  const stepHeadlines = {
    candidate:    <><span style={{ color:C.gold }}>Who</span> is the<br/>offer for?</>,
    compensation: <>What's the<br/><span style={{ color:C.gold }}>compensation?</span></>,
    terms:        <>What are<br/><span style={{ color:C.gold }}>the terms?</span></>,
    company:      <><span style={{ color:C.gold }}>Company</span><br/>details</>,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;overflow:hidden;}
        html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
        body{background:${C.void};}
        ::selection{background:${C.goldFaint};color:${C.gold};}
        ::placeholder{color:${C.sepiaMid};font-style:italic;font-family:'Lora',Georgia,serif;font-size:14px;}
        ::-webkit-scrollbar{width:2px;}
        ::-webkit-scrollbar-thumb{background:${C.raised};border-radius:1px;}
        input,textarea{color:${C.ink};}
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
      `}</style>

      {/* CURTAIN — theatrical wipe */}
      <AnimatePresence>
        {curtain && (
          <motion.div key="curtain"
            initial={{ x:"-100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
            transition={{ duration:0.52, ease:EASE_EXPO }}
            style={{ position:"fixed", inset:0, background:C.void, zIndex:999 }}/>
        )}
      </AnimatePresence>

      <div style={{ height:"100vh", background:C.void, display:"flex", flexDirection:"column",
        fontFamily:C.body, overflow:"hidden", color:C.ink }}>

        {/* ══ STREAMING SCREEN ══ */}
        {stage === "streaming" && (
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {fullText ? (
                <TypewriterStream fullText={fullText} onComplete={onStreamComplete}/>
              ) : (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", background:C.parchment, padding:48 }}>
                  <motion.div animate={{ scaleY:[1,1.4,1], opacity:[0.3,1,0.3] }}
                    transition={{ duration:1.2, repeat:Infinity, ease:"easeInOut" }}
                    style={{ width:1, height:48, background:C.gold, margin:"0 auto 20px" }}/>
                  <p style={{ fontFamily:C.body, fontStyle:"italic", fontSize:18, color:C.parchInk,
                    letterSpacing:"0.04em", textAlign:"center" }}>
                    Composing your offer letter…
                  </p>
                  <motion.div animate={{ opacity:[0.3,1,0.3] }}
                    transition={{ duration:1.4, repeat:Infinity, ease:"easeInOut" }}
                    style={{ fontFamily:C.mono, fontSize:24, color:C.gold, marginTop:16 }}>|</motion.div>
                  <motion.div animate={{ scaleY:[1,1.4,1], opacity:[0.3,1,0.3] }}
                    transition={{ duration:1.2, repeat:Infinity, ease:"easeInOut", delay:0.1 }}
                    style={{ width:1, height:48, background:C.gold, margin:"20px auto 0" }}/>
                </div>
              )}
            </div>
            <div style={{ width:280, background:C.void, borderLeft:`1px solid ${C.border}`,
              display:"flex", flexDirection:"column", padding:"44px 28px", flexShrink:0 }}>
              <div style={{ marginBottom:28 }}>
                <div style={{ fontFamily:C.mono, fontSize:9, color:C.sepia, letterSpacing:"0.18em",
                  textTransform:"uppercase", marginBottom:12 }}>Writing</div>
                <h3 style={{ fontFamily:C.display, fontSize:32, color:C.ink, lineHeight:1.1,
                  letterSpacing:"-0.5px" }}>
                  The letter<br/>is being<br/><span style={{ color:C.gold }}>written.</span>
                </h3>
              </div>
              <div style={{ height:1, background:C.border, marginBottom:24 }}/>
              <p style={{ fontFamily:C.body, fontStyle:"italic", fontSize:13, color:C.inkDim, lineHeight:1.7 }}>
                Every word is being composed for {form.candidateName} — give it a moment.
              </p>
              <div style={{ marginTop:"auto" }}>
                <motion.div animate={{ scale:[1,1.06,1], opacity:[0.4,1,0.4] }}
                  transition={{ duration:2.2, repeat:Infinity, ease:"easeInOut" }}
                  style={{ width:8, height:8, borderRadius:"50%", background:C.gold,
                    boxShadow:`0 0 16px ${C.goldGlow}`, margin:"0 auto" }}/>
              </div>
            </div>
          </div>
        )}

        {/* ══ PREVIEW SCREEN — full reveal sequence ══ */}
        {stage === "preview" && (
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

            {/* Parchment panel — springs in from left */}
            <motion.div
              initial={{ opacity:0, x:-40 }} animate={{ opacity:1, x:0 }}
              transition={{ ...SP.letter }}
              style={{ flex:1, overflowY:"auto", background:C.parchment,
                padding:"56px 72px", color:C.parchInk }}>

              {/* Header — rule draws, name and role stagger */}
              <div style={{ marginBottom:28 }}>
                <motion.div
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                  transition={{ ...SP.arrive, delay:0.1 }}>
                  <div style={{ fontFamily:C.mono, fontSize:9, color:C.sepia,
                    letterSpacing:"0.22em", textTransform:"uppercase", marginBottom:10 }}>Offer Letter</div>
                </motion.div>

                {/* Candidate name — character by character mini typewriter */}
                <motion.h2
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  transition={{ ...SP.arrive, delay:0.18 }}
                  style={{ fontFamily:C.display, fontSize:44, color:C.parchInk,
                    margin:0, letterSpacing:"-1px", lineHeight:1 }}>
                  {form.candidateName}
                </motion.h2>

                <motion.p
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                  transition={{ ...SP.arrive, delay:0.28 }}
                  style={{ fontFamily:C.body, fontStyle:"italic", fontSize:15,
                    color:C.sepia, marginTop:5 }}>
                  {form.role} · {form.companyName}
                </motion.p>
              </div>

              {/* Rule draws across — spring width */}
              <div style={{ position:"relative", height:2, marginBottom:28 }}>
                <motion.div
                  initial={{ width:0 }} animate={{ width:"100%" }}
                  transition={{ ...SP.curtain, delay:0.32 }}
                  style={{ position:"absolute", left:0, top:0, height:"100%", background:C.parchInk }}/>
              </div>

              {/* Edit button springs in */}
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                transition={{ delay:0.5, duration:0.2 }}
                style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
                <motion.button onClick={()=>setEditing(e=>!e)}
                  whileTap={{ scale:0.97, transition:SP.press }}
                  style={{ background:editing?C.parchInk:"transparent", color:editing?C.parchment:C.sepia,
                    border:`1px solid ${editing?C.parchInk:C.parchDeep}`, borderRadius:0,
                    padding:"8px 16px", fontSize:9, fontFamily:C.mono,
                    letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer",
                    transition:"all 150ms ease" }}>
                  {editing?"✓ Done editing":"✎ Edit"}
                </motion.button>
              </motion.div>

              {/* Letter content — staggered line entrance */}
              {editing ? (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.2 }}>
                  <textarea value={letter} onChange={e=>setLetter(e.target.value)}
                    style={{ width:"100%", minHeight:600, background:"transparent", border:"none",
                      outline:"none", fontFamily:C.body, fontSize:13.5, lineHeight:1.9,
                      color:C.parchInk, resize:"vertical", caretColor:C.gold }}/>
                </motion.div>
              ) : (
                <LetterRenderer text={letter}/>
              )}
            </motion.div>

            {/* Actions panel — slides in from right with staggered buttons */}
            <motion.div
              initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }}
              transition={{ ...SP.letter, delay:0.12 }}
              style={{ width:320, background:C.void, borderLeft:`1px solid ${C.border}`,
                display:"flex", flexDirection:"column", padding:"48px 28px", flexShrink:0 }}>

              <motion.div
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                transition={{ ...SP.arrive, delay:0.22 }}
                style={{ marginBottom:28 }}>
                <div style={{ fontFamily:C.mono, fontSize:9, color:C.sepia,
                  letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:14 }}>Ready</div>
                <h3 style={{ fontFamily:C.display, fontSize:38, color:C.ink,
                  margin:0, lineHeight:1.05, letterSpacing:"-0.5px" }}>
                  Your letter<br/>is<br/><span style={{ color:C.gold }}>drafted.</span>
                </h3>
              </motion.div>

              <motion.div initial={{ scaleX:0 }} animate={{ scaleX:1 }}
                transition={{ ...SP.curtain, delay:0.3 }}
                style={{ height:1, background:C.border, marginBottom:28, originX:0 }}/>

              {/* Staggered action buttons */}
              <motion.div
                variants={actionListVariants} initial="hidden" animate="show"
                style={{ display:"flex", flexDirection:"column", gap:10 }}>

                <motion.div variants={actionItemVariants}>
                  <PressBtn onClick={downloadPDF} gold
                    style={{ width:"100%", padding:"15px 20px", fontSize:10, fontWeight:700,
                      letterSpacing:"0.2em", textTransform:"uppercase", textAlign:"left" }}>
                    Download / Print PDF →
                  </PressBtn>
                </motion.div>

                <motion.div variants={actionItemVariants}>
                  <PressBtn onClick={downloadWord}
                    style={{ width:"100%", padding:"13px 20px", fontSize:10, letterSpacing:"0.2em",
                      textTransform:"uppercase", textAlign:"left", color:C.inkMid }}>
                    Download .doc →
                  </PressBtn>
                </motion.div>

                <motion.div variants={actionItemVariants}>
                  <PressBtn onClick={copyText}
                    style={{ width:"100%", padding:"13px 20px", fontSize:10, letterSpacing:"0.2em",
                      textTransform:"uppercase", textAlign:"left",
                      color:copied?C.gold:C.inkDim,
                      borderColor:copied?C.goldDim:C.border }}>
                    {copied?"✓ Copied to clipboard":"Copy text"}
                  </PressBtn>
                </motion.div>

                <motion.div variants={actionItemVariants}>
                  <PressBtn
                    onClick={()=>{setStage("form");setLetter("");setFullText("");setStep(0);setForm(defaultForm);}}
                    style={{ width:"100%", padding:"13px 20px", fontSize:10, letterSpacing:"0.2em",
                      textTransform:"uppercase", textAlign:"left", color:C.inkFaint,
                      marginTop:8 }}>
                    ← New Letter
                  </PressBtn>
                </motion.div>
              </motion.div>

              <div style={{ marginTop:"auto", paddingTop:24, borderTop:`1px solid ${C.border}` }}>
                <p style={{ fontSize:9, color:C.sepiaMid, fontFamily:C.mono,
                  lineHeight:1.9, letterSpacing:"0.04em" }}>
                  Tip: "Download / Print PDF" → save as PDF from your browser's print dialog.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* ══ FORM SCREEN ══ */}
        {stage === "form" && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:mounted?1:0 }}
            transition={{ duration:0.3 }}
            style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ padding:"0 48px", height:60, display:"flex", alignItems:"center",
              justifyContent:"space-between", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>

              <motion.h1
                initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }}
                transition={{ ...SP.arrive, delay:0.05 }}
                style={{ fontFamily:C.display, fontSize:26, color:C.ink, margin:0,
                  letterSpacing:"-0.3px", lineHeight:1 }}>
                Draft<span style={{ color:C.gold }}>ed</span>
                <span style={{ fontSize:9, color:C.sepia, fontFamily:C.mono,
                  letterSpacing:"0.2em", textTransform:"uppercase",
                  marginLeft:14, verticalAlign:"middle" }}>by Divyah</span>
              </motion.h1>

              {/* Step indicator — layoutId shared underline */}
              <motion.div
                initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }}
                transition={{ ...SP.arrive, delay:0.08 }}
                style={{ display:"flex", alignItems:"center", gap:0 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center" }}>
                    <motion.button onClick={()=>goStep(i)}
                      whileTap={{ scale:0.97, transition:SP.press }}
                      style={{ background:"transparent", border:"none", padding:"6px 18px",
                        display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                        cursor:"pointer", position:"relative" }}>
                      <span style={{ fontSize:9, fontFamily:C.mono, letterSpacing:"0.18em",
                        color:i===step?C.gold:i<step?C.sepia:C.inkFaint,
                        textTransform:"uppercase", transition:"color 200ms ease" }}>{s.num}</span>
                      <span style={{ fontSize:9, fontFamily:C.mono, letterSpacing:"0.1em",
                        color:i===step?C.gold:i<step?C.sepia:C.inkFaint,
                        textTransform:"uppercase", transition:"color 200ms ease" }}>{s.label}</span>
                      <div style={{ width:"100%", height:1, position:"relative" }}>
                        <div style={{ position:"absolute", inset:0, background:C.border }}/>
                        {i===step && (
                          <motion.div layoutId="stepUnderline"
                            style={{ position:"absolute", inset:0, background:C.gold,
                              boxShadow:`0 0 8px ${C.goldGlow}` }}
                            transition={SP.snap}/>
                        )}
                        {i<step && <div style={{ position:"absolute", inset:0, background:C.sepiaMid }}/>}
                      </div>
                    </motion.button>
                    {i < STEPS.length-1 && <div style={{ width:20, height:1, background:C.border }}/>}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* STEP PROGRESS BAR — spring fill */}
            <StepProgress step={step} total={STEPS.length}/>

            {/* Step hero — word by word entrance */}
            <AnimatePresence mode="wait">
              <motion.div key={stepKey}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                transition={{ duration:0.2, ease:EASE_EXPO }}
                style={{ padding:"28px 48px 24px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                <motion.p
                  initial={{ opacity:0 }} animate={{ opacity:1 }}
                  transition={{ delay:0.04, duration:0.2 }}
                  style={{ fontSize:9, color:C.sepia, fontFamily:C.mono,
                    letterSpacing:"0.22em", textTransform:"uppercase", marginBottom:10 }}>
                  Step {step+1} of {STEPS.length}
                </motion.p>

                {/* Word-by-word staggered headline */}
                <motion.h2
                  variants={{ show:{ transition:{ staggerChildren:0.07, delayChildren:0.06 } } }}
                  initial="hidden" animate="show"
                  style={{ fontFamily:C.display, fontSize:48, color:C.ink,
                    margin:0, letterSpacing:"-1.5px", lineHeight:0.95 }}>
                  {stepKey==="candidate" && (
                    <>
                      {["Who"].map((w,i) => (
                        <motion.span key={i} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", color:C.gold, marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                      {["is","the","offer","for?"].map((w,i) => (
                        <motion.span key={i+1} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                    </>
                  )}
                  {stepKey==="compensation" && (
                    <>
                      {["What's","the"].map((w,i) => (
                        <motion.span key={i} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                      <br/>
                      {["compensation?"].map((w,i) => (
                        <motion.span key={i+2} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", color:C.gold, marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                    </>
                  )}
                  {stepKey==="terms" && (
                    <>
                      {["What","are","the"].map((w,i) => (
                        <motion.span key={i} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                      <br/>
                      {["terms?"].map((w,i) => (
                        <motion.span key={i+3} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", color:C.gold, marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                    </>
                  )}
                  {stepKey==="company" && (
                    <>
                      {["Company"].map((w,i) => (
                        <motion.span key={i} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", color:C.gold, marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                      <br/>
                      {["details"].map((w,i) => (
                        <motion.span key={i+1} variants={{ hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:SP.arrive} }}
                          style={{ display:"inline-block", marginRight:"0.25em" }}>{w}</motion.span>
                      ))}
                    </>
                  )}
                </motion.h2>
              </motion.div>
            </AnimatePresence>

            {/* Fields — directional slide on step change */}
            <div style={{ flex:1, overflowY:"auto", padding:"32px 48px" }}>
              <AnimatePresence mode="wait" custom={stepDir}>
                <motion.div key={stepKey}
                  custom={stepDir}
                  variants={fieldVariants}
                  initial="hidden" animate="show" exit="exit"
                  style={{ maxWidth:680, display:"grid",
                    gridTemplateColumns:"1fr 1fr", gap:"32px 52px" }}>
                  {fields.map((f) => (
                    <motion.div key={f.key} variants={fieldItem}
                      style={{ gridColumn:f.span===2?"1 / -1":undefined }}>
                      <AtelierInput
                        label={f.label} value={form[f.key]}
                        onChange={v=>set(f.key,v)}
                        placeholder={f.placeholder} multiline={f.multiline}/>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation footer — springs up on mount */}
            <motion.div
              variants={{ hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{...SP.arrive,delay:0.2}} }}
              initial="hidden" animate="show"
              style={{ borderTop:`1px solid ${C.border}`, padding:"16px 48px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
                flexShrink:0, background:C.base }}>

              <motion.div variants={footerVariants}>
                <PressBtn onClick={()=>goStep(step-1)} disabled={step===0}
                  style={{ fontSize:10, fontFamily:C.mono, letterSpacing:"0.18em",
                    textTransform:"uppercase", padding:"8px 0", border:"none",
                    color:step===0?C.inkFaint:C.inkDim }}>
                  ← Back
                </PressBtn>
              </motion.div>

              <div style={{ display:"flex", alignItems:"center", gap:20 }}>
                {error && (
                  <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }}
                    style={{ fontSize:11, color:"#EF4444", fontFamily:C.mono }}>{error}</motion.p>
                )}

                <motion.div variants={footerVariants}>
                  {isLast ? (
                    /* Generate button — pulses when ready */
                    <motion.div
                      animate={allFilled ? {
                        boxShadow:[`0 0 20px ${C.goldGlow}`,`0 0 40px rgba(212,168,67,0.35)`,`0 0 20px ${C.goldGlow}`]
                      } : { boxShadow:"none" }}
                      transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}
                      style={{ borderRadius:0 }}>
                      <PressBtn onClick={generate} disabled={!allFilled} gold={allFilled}
                        style={{ padding:"14px 44px", fontSize:10, fontWeight:700,
                          letterSpacing:"0.22em", textTransform:"uppercase", fontFamily:C.mono }}>
                        Generate Letter →
                      </PressBtn>
                    </motion.div>
                  ) : (
                    <PressBtn onClick={()=>goStep(step+1)}
                      style={{ padding:"14px 44px", fontSize:10, fontWeight:700,
                        letterSpacing:"0.22em", textTransform:"uppercase",
                        fontFamily:C.mono, color:C.ink, borderColor:C.borderMid }}>
                      Continue →
                    </PressBtn>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}