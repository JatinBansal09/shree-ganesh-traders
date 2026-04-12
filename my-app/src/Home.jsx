import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import heroBg from "./assets/images/Home_bg.png";
import logoImg from "./assets/images/Shree_Ganesh_Traders_logo.png";
import { toastAlert } from './alerts';
import apiFetch from "./utils/apiClient";

// ── Brand config ─────────────────────────────────────────────────────────────
const SHOP = {
  name: "Shree Ganesh Traders",
  location: "Ludhiana, Punjab",
  estYear: 1987,
  phone: "+91 98765 43210",
  email: "contact@shreeganeshtraders.com",
  gst: "03AAAAA0000A1Z5",
};

// Add these constants at the top of the file
const FALLBACK_CATEGORIES = [
  { name: "PVC Pipes", count: "200+ Items", icon: "🚰" },
  { name: "CPVC Fittings", count: "150+ Items", icon: "🛠️" },
  { name: "Sanitary Ware", count: "300+ Items", icon: "🚽" },
  { name: "Water Tanks", count: "40+ Sizes", icon: "🏢" },
];

const FALLBACK_BRANDS = ["Ashirvad", "Astral", "Supreme", "Finolex", "Prince", "Jaquar"];
const FALLBACK_STATS = [
  { val: "1,400+", label: "Product SKUs", bg: "#F7941D" },
  { val: "10+", label: "Partner Brands", bg: "#134e5e" },
  { val: "Pan-Punjab", label: "Delivery Network", bg: "#711c91" }
];
const INTEREST_TYPES = ["Dealer", "Retailer", "Contractor", "Builder", "Other"];

const LogoMark = ({ size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: 8, background: "#F7941D", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ color: "#fff", fontWeight: "bold", fontSize: size / 2 }}>🔧</span>
  </div>
);

// ── Navbar ───────────────────────────────────────────────────────────────────
const Navbar = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "#fff", borderBottom: "1px solid #eee", padding: "0 5vw"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 80 }}>
        {/* Logo matching the interlaced G style */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <img 
            src={logoImg} 
            alt="logo"
            style={{ 
              width: 100, 
              height: 100, 
              objectFit: "contain",
              borderRadius: 8,
              marginRight: "-15px" // Pulls the text 15px closer to the image
            }} 
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1a1a2e" }}>{SHOP.name}</div>
            <div style={{ fontSize: 10, color: "#F7941D", textTransform: "uppercase", letterSpacing: "1px" }}>{SHOP.location}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 30 }} className="nav-links">
          {[
            ["categories", "Categories"],
            ["brands", "Brands"],
            ["why-us", "Why Us"], // Changed from "WhyUs" to "why-us"
            ["contact", "Contact"]
          ].map(item => (
            <a key={item[0]} href={`#${item[0]}`} style={{ textDecoration: "none", color: "#1a1a2e", fontSize: 14, fontWeight: 500 }}>
              {item[1]}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => navigate('/login')} style={{ padding: "10px 20px", background: "#134e5e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Login</button>
          <button onClick={() => navigate('/register')} style={{ padding: "10px 20px", background: "#F7941D", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Sign Up</button>
        </div>
      </div>
    </nav>
  );
};

// ── Hero Section ─────────────────────────────────────────────────────────────
const Hero = () => (
  <section style={{
    padding: "160px 5vw 100px",
    position: "relative",
    overflow: "hidden",
    minHeight: "80vh",
    display: "flex",
    alignItems: "center",

    // 🔥 ADD THIS
    backgroundImage: `url(${heroBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}>
    {/* Technical Blueprint Pattern Overlay */}
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    }} />
    
    <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", zIndex: 1, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "40px" }}>
      <div>
        <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 100, background: "rgba(247, 148, 29, 0.1)", color: "#F7941D", fontSize: 12, fontWeight: 700, marginBottom: 20, border: "1px solid rgba(247, 148, 29, 0.3)" }}>
          ● EST. {SHOP.estYear} · {SHOP.location}
        </div>
        <h1 style={{ fontSize: "clamp(40px, 5vw, 72px)", fontWeight: 800, color: "#1a1a2e", lineHeight: 1.1, marginBottom: 24 }}>
          Your Trusted <br />
          <span style={{ color: "#F7941D" }}>Wholesale</span> Partner <br />
          for Pipes & Fittings
        </h1>
        <p style={{ fontSize: 18, color: "#475569", lineHeight: 1.6, marginBottom: 40, maxWidth: 550 }}>
          Supplying premium plumbing materials to retailers, builders, contractors, and dealers across Punjab. Competitive pricing and reliable delivery guaranteed.
        </p>
        
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "16px 32px", background: "#F7941D", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Get in Touch →
          </button>
          <button onClick={() => document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "16px 32px", background: "#134e5e", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Browse Categories
          </button>
        </div>
      </div>

      {/* Hero Stats Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
        {[
          { val: "1,400+", label: "Product SKUs", bg: "#F7941D" },
          { val: "10+", label: "Partner Brands", bg: "#134e5e" },
          { val: "20+", label: "Years in Business", bg: "#711c91" }
        ].map((stat, i) => (
          <div key={i} style={{ background: stat.bg, padding: "24px", borderRadius: 16, color: "#fff" }}>
            <div style={{ fontSize: 32, fontWeight: 800 }}>{stat.val}</div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
      
      /* Add these lines */
      html, body { 
        margin: 0; 
        padding: 0; 
        width: 100%;
        overflow-x: hidden; /* This kills the horizontal scroll */
      }

      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      
      html { scroll-behavior: smooth; }

      @media (max-width: 768px) {
        .nav-links { display: none !important; }
      }
    `}</style>
  </section>
);

// ── Section Heading ────────────────────────────────────────────────────────────
const SectionHeading = ({ eyebrow, title, subtitle }) => (
  <div style={{ textAlign: "center", marginBottom: 56 }}>
    <div style={{
      display: "inline-block", color: "#E8790A", fontSize: 11,
      letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
      marginBottom: 14, background: "rgba(232,121,10,0.08)",
      border: "1px solid rgba(232,121,10,0.22)", borderRadius: 100, padding: "4px 16px",
    }}>
      {eyebrow}
    </div>
    <h2 style={{
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(28px, 4vw, 46px)", color: "#1a1a2e",
      fontWeight: 700, lineHeight: 1.15, marginBottom: 14,
    }}>{title}</h2>
    {subtitle && (
      <p style={{ color: "#777", fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.75 }}>
        {subtitle}
      </p>
    )}
  </div>
);
 
// ── Categories ─────────────────────────────────────────────────────────────────
const Categories = ({ categories }) => (
  <section id="categories" style={{ padding: "100px 5vw", background: "#f9f9fb" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <SectionHeading
        eyebrow="Product Range"
        title="What We Supply"
        subtitle="Over 1,400 SKUs across all major plumbing and sanitary categories, sourced from India's top manufacturers."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
        {categories.map((cat, i) => (
          <div key={cat.id || i} className="card-lift" style={{
            background: "#ffffff", border: "1px solid #ebebeb",
            borderRadius: 14, padding: "26px 22px", cursor: "default",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{cat.icon || "📦"}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a2e", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{cat.name}</div>
            <div style={{ color: "#E8790A", fontSize: 12, fontWeight: 600 }}>{cat.count}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
 
// ── Brands ─────────────────────────────────────────────────────────────────────
const Brands = ({ brands }) => (
  <section id="brands" style={{ padding: "100px 5vw", background: "#ffffff" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <SectionHeading
        eyebrow="Our Partners"
        title="Brands We Carry"
        subtitle="Authorised dealer for 10+ premium Indian and international plumbing brands."
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {brands.map((brand, i) => (
          <div key={i} className="card-lift" style={{
            background: "#f5f5f7", border: "1px solid #e8e8e8",
            borderRadius: 10, padding: "12px 26px",
            color: "#333", fontSize: 14, fontWeight: 600,
            letterSpacing: "0.03em", cursor: "default",
          }}>
            {brand}
          </div>
        ))}
      </div>
    </div>
  </section>
);
 
// ── Why Us ─────────────────────────────────────────────────────────────────────
const WhyUs = () => {
  const points = [
    { icon: "🏆", title: "Genuine Products Only",      body: "Every item is sourced directly from manufacturers or authorised distributors. Zero counterfeits, guaranteed." },
    { icon: "💸", title: "Wholesale Pricing",          body: "Volume-linked pricing tiers for retailers, builders, and contractors. The more you buy, the better your margin." },
    { icon: "🚚", title: "Pan-Punjab Delivery",        body: "Our own logistics network covers Ludhiana, Jalandhar, Amritsar, Patiala, and 8 more cities with next-day dispatch." },
    { icon: "📱", title: "Digital Order Management",   body: "Place orders, track deliveries, and manage payments through our dedicated dealer portal — available 24×7." },
    { icon: "🤝", title: "Dedicated Account Manager",  body: "Every registered dealer gets a single point of contact for pricing, availability, and escalation support." },
    { icon: "📦", title: "Deep Stock Availability",    body: "1,400+ SKUs in warehouse with real-time stock visibility. No surprises on delivery day." },
  ];
 
  return (
    <section id="why-us" style={{ padding: "100px 5vw", background: "#f9f9fb" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="Why Choose Us"
          title="Built for Trade Partners"
          subtitle="We understand the demands of contractors, builders, and retailers. Everything we do is designed around your business."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 22 }}>
          {points.map((p, i) => (
            <div key={i} className="card-lift" style={{
              background: "#ffffff", border: "1px solid #ebebeb",
              borderRadius: 16, padding: "30px 26px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(232,121,10,0.08)", border: "1px solid rgba(232,121,10,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>
                {p.icon}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a2e", fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{p.title}</div>
              <div style={{ color: "#666", fontSize: 14, lineHeight: 1.75 }}>{p.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
 
// ── Contact Form ───────────────────────────────────────────────────────────────
const ContactForm = () => {
  const [form, setForm]       = useState({ Company_name: "", Interest_type: "", Interest_email: "", Interest_msg: "" });
  const [submitting, setSub]  = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");
 
  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
 
  const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validation
      if (!form.Company_name || !form.Interest_type || !form.Interest_email || !form.Interest_msg) {
        setError("Please fill in all fields.");
        return;
      }

      try {
        setSub(true);
        setError("");

        // 1. Make the call
        const responseData = await apiFetch("/api/home/interest/", { 
          method: "POST", 
          body: JSON.stringify(form) 
        });

        // 2. setDone(true) changes the UI to the "Success" screen
        setDone(true);

        // 3. Check the message from the backend JSON
        // Note: Most apiFetch wrappers return the parsed JSON directly.
        if (responseData && responseData.message === "Success") {
            toastAlert("Interest form submitted successfully!");
        }

      } catch (err) {
        setError("Something went wrong. Please try again or call us directly.");
      } finally {
        setSub(false);
      }
  };
 
  const inputStyle = {
    width: "100%", background: "#f7f7f9", border: "1.5px solid #e0e0e8",
    borderRadius: 9, padding: "12px 15px", color: "#1a1a2e",
    fontSize: 14, transition: "border-color 0.2s, box-shadow 0.2s",
  };
 
  return (
    <section id="contact" style={{ padding: "100px 5vw", background: "#ffffff" }}>
      <div className="contact-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
 
        {/* Left info */}
        <div>
          <div style={{ display: "inline-block", color: "#E8790A", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, marginBottom: 18, background: "rgba(232,121,10,0.08)", border: "1px solid rgba(232,121,10,0.22)", borderRadius: 100, padding: "4px 16px" }}>
            Get in Touch
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: "#1a1a2e", fontWeight: 700, lineHeight: 1.12, marginBottom: 20 }}>
            Let's Build a<br />Partnership
          </h2>
          <p style={{ color: "#777", fontSize: 15, lineHeight: 1.8, marginBottom: 40, maxWidth: 420 }}>
            Whether you're looking for bulk supply, a dealership, or a project quote — fill in your details and our team will reach out within one business day.
          </p>
 
          {[
            { icon: "📞", label: "Phone",    value: SHOP.phone    },
            { icon: "✉️",  label: "Email",    value: SHOP.email    },
            { icon: "📍", label: "Location", value: SHOP.location },
            { icon: "🏛️", label: "GST No.",  value: SHOP.gst      },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f5f5f7", border: "1px solid #e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ color: "#aaa", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{item.label}</div>
                <div style={{ color: "#1a1a2e", fontSize: 14, fontWeight: 500 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
 
        {/* Right form */}
        <div style={{ background: "#f9f9fb", border: "1px solid #e8e8e8", borderRadius: 18, padding: "40px 36px" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a2e", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Message Received!</h3>
              <p style={{ color: "#777", fontSize: 14, lineHeight: 1.7 }}>Our team will get back to you within one business day. Thank you for your interest in partnering with {SHOP.name}.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a2e", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Send an Enquiry</h3>
 
              <div>
                <label style={{ color: "#888", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Company / Your Name *</label>
                <input name="Company_name" value={form.Company_name} onChange={handleChange} placeholder="e.g. Sharma Builders" style={inputStyle} />
              </div>
 
              <div>
                <label style={{ color: "#888", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Enquiry Type *</label>
                <select name="Interest_type" value={form.Interest_type} onChange={handleChange} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                  <option value="">Select type...</option>
                  {INTEREST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
 
              <div>
                <label style={{ color: "#888", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Email Address *</label>
                <input type="email" name="Interest_email" value={form.Interest_email} onChange={handleChange} placeholder="you@company.com" style={inputStyle} />
              </div>
 
              <div>
                <label style={{ color: "#888", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Message *</label>
                <textarea name="Interest_msg" value={form.Interest_msg} onChange={handleChange} rows={4}
                  placeholder="Tell us about your requirements — quantities, categories, delivery location, etc."
                  style={{ ...inputStyle, resize: "vertical", minHeight: 110 }} />
              </div>
 
              {error && <p style={{ color: "#c0392b", fontSize: 13 }}>⚠ {error}</p>}
 
              <button type="submit" disabled={submitting} style={{
                padding: "13px", background: submitting ? "#aaa" : "#1a1a2e",
                color: "#fff", border: "none", borderRadius: 9, fontSize: 15,
                fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "background 0.2s",
              }}
                onMouseEnter={e => { if (!submitting) e.target.style.background="#E8790A"; }}
                onMouseLeave={e => { if (!submitting) e.target.style.background="#1a1a2e"; }}>
                {submitting ? "Sending..." : "Send Enquiry →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
 
// ── Footer ─────────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer style={{ background: "#1a1a2e", padding: "40px 5vw" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img 
            src={logoImg} 
            alt="logo"
            style={{ 
              width: 100, 
              height: 100, 
              objectFit: "contain",
              borderRadius: 8,
              marginRight: "-15px" // Pulls the text 15px closer to the image
            }} 
          />
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontWeight: 700, fontSize: 15 }}>{SHOP.name}</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>© {new Date().getFullYear()} All rights reserved · GST: {SHOP.gst}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {[["#categories","Categories"],["#brands","Brands"],["#why-us","Why Us"],["#contact","Contact"]].map(([href, label]) => (
          <a key={href} href={href} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => e.target.style.color="#E8790A"}
            onMouseLeave={e => e.target.style.color="rgba(255,255,255,0.4)"}>
            {label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);
 
// ── Main Page ──────────────────────────────────────────────────────────────────
const Home = () => {
  const [categories, setCategories]         = useState(FALLBACK_CATEGORIES);
  const [brands, setBrands]                 = useState(FALLBACK_BRANDS);
  const [stats, setStats]                   = useState(FALLBACK_STATS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
 
  // useEffect(() => {
  //   apiFetch("/api/auth/status/").then(d => {
  //     setIsAuthenticated(d.is_authenticated || false);
  //   }).catch(() => {});
 
  //   apiFetch("/api/home/data/").then(d => {
  //     if (d.categories?.length) setCategories(d.categories);
  //     if (d.brands?.length)     setBrands(d.brands);
  //     if (d.stats?.length)      setStats(d.stats);
  //   }).catch(() => {});
  // }, []);
 
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <Navbar isAuthenticated={isAuthenticated} />
      <Hero stats={stats} />
      <Categories categories={categories} />
      <Brands brands={brands} />
      <WhyUs />
      <ContactForm />
      <Footer />
    </div>
  );
};
 
export default Home;