
<h1 align="center">🚀 Novard-AI</h1>

<p align="center">
  <strong>Your Personalised AI-Driven Career Development & Learning Hub</strong><br>
  Elevate your professional journey with intelligent insights, personalized roadmaps, and powerful AI tools.
</p>

---

### 🌟 Features at a Glance

> [!NOTE]
> Novard-AI is more than just a platform; it's your 24/7 career companion.

- 🔓 **Skill Unlocker** | Gamified skill assessments & adaptive learning paths.
- 🤖 **AI Career Mentor** | Real-time career guidance and doubt clearance.
- 🛣️ **Smart Roadmaps** | Professional paths tailored to your dream roles.
- 📑 **Resume Builder** | AI-optimized resumes that actually get past ATS.
- 🎥 **Video Summarizer** | Instant AI-generated insights from any YouTube video.
- 💡 **Project Hub** | Curated project ideas to boost your portfolio.
- 📋 **Integrated Notes** | Capture thoughts directly as you learn.
- 🏫 **Teacher Dashboard** | Advanced analytics and guidance tools for mentors.

---

### 🧩 Kiro IDE Integration (Master Steering)

> [!TIP]
> This section acts as a **Steering File** for Kiro IDE agents, providing critical project context.

#### 🎯 Product Steering
- **Mission**: Empower individuals to navigate their careers using AI-driven insights.
- **Core Value**: Personalized, adaptive, and highly interactive learning experiences.

#### 💻 Tech Steering
- **Stack**: Standard MERN (MongoDB, Express, React, Node) architecture.
- **Core AI**: Leverages **Groq** for high-speed chat and **Google Gemini** for deep analysis.
- **Auth**: Hybrid approach using **Firebase** and **Auth0**.

#### 📏 Conventions Steering
- **Clean Code**: Prioritize functional React components and modular Express controllers.
- **Styling**: Consistent use of **Tailwind CSS** utilities and **MUI** components for complex UI.
- **State**: React state hooks for local state; centralized API calls in the `/services` layer.

---

### 📋 Project Specifications (Kiro Specs)

*These files guide development and maintain project integrity.*

| Spec File | Description |
| :--- | :--- |
| 📌 [Requirements](.kiro/specs/requirements.md) | Business logic and user story mappings. |
| 🎨 [Design](.kiro/specs/design.md) | Architectural diagrams and UI components. |
| ✅ [Tasks](.kiro/specs/tasks.md) | Real-time development roadmap. |

---

### 🛠️ Tech Stack

| Frontend | Backend | AI & Auth |
| :--- | :--- | :--- |
| **Framework:** React + Vite | **Server:** Node.js + Express | **GenAI:** Google Gemini + Groq |
| **UI:** Tailwind CSS + MUI | **Database:** MongoDB | **Auth:** Firebase + Auth0 |

---

### ⚙️ Quick Start

#### 1️⃣ Environment Setup
Create a `.env` in both `/client` and `/server` directories.

**Client (`/client/.env`):**
```bash
VITE_FIREBASE_API_KEY=your_key
VITE_AUTH_DOMAIN=your_domain
VITE_API_BASE_URL=http://localhost:5000
```

**Server (`/server/.env`):**
```bash
MONGO_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

#### 2️⃣ Running the Engine

**Start Backend:**
```bash
cd server
npm install
npm start
```

**Start Frontend:**
```bash
cd client
npm install
npm run dev
```

---

### 🤝 Join the Journey

We welcome contributions! 
1. **Fork** the project
2. **Create** your feature branch (`git checkout -b feature/NewAwesomeFeature`)
3. **Commit** your changes (`git commit -m 'Add some feature'`)
4. **Push** to the branch (`git push origin feature/NewAwesomeFeature`)
5. **Open** a Pull Request

---

<p align="center">
  Built with ❤️ by the Novard-AI Team<br>
  <i>Transforming careers, one prompt at a time.</i>
</p>
