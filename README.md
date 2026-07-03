# Novard-AI

**Your Personalized AI-Driven Career Development & Learning Platform**

Novard-AI is a comprehensive MERN stack platform that leverages AI to provide personalized career guidance, skill development, and learning resources. Built with Groq AI integration, it offers intelligent recommendations, adaptive learning paths, and interactive tools to accelerate your professional growth.

---

## 🚀 Features

### Core Modules

- **🔐 Authentication & User Management** - Secure Google OAuth 2.0 via Firebase with profile management
- **🎯 Skills Planning** - AI-powered career skills analysis and personalized roadmaps
- **💼 Projects Generation** - Career-specific project ideas to build your portfolio
- **📄 Resume Builder** - ATS-friendly resume templates tailored to your career path
- **🔓 Skill Unlocker** - Gamified day-by-day learning plans with quizzes and video recommendations
- **📚 Notes Management** - Upload PDFs, chat with documents, generate summaries and quizzes
- **🎥 Video Library** - AI-powered video recommendations based on learning needs
- **📹 YouTube Video Summarizer** - Extract transcripts, chat with content, generate quizzes
- **❓ Doubt Clearance** - Instant AI-powered explanations with practice quizzes
- **💬 Community Forum** - Stack Overflow-style Q&A with AI-generated responses and voting

---

## 🛠️ Tech Stack

**Frontend:**
- React 18+
- React Router v6
- Firebase SDK
- Axios
- CSS Modules

**Backend:**
- Node.js & Express.js
- MongoDB with Mongoose ODM
- Groq AI SDK
- Firebase Admin SDK
- Multer (file uploads)
- Langchain (vector embeddings)

**External Services:**
- Firebase Authentication
- Groq AI API
- YouTube Data API v3
- MongoDB Atlas

---

## 📦 Installation

### Prerequisites

- Node.js (v16+)
- MongoDB Atlas account
- Firebase project
- Groq AI API key
- YouTube Data API key

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/novard-ai.git
cd novard-ai
```

2. **Install dependencies**
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

3. **Configure environment variables**

Create `.env` in the `server` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
YOUTUBE_API_KEY=your_youtube_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

Create `.env` in the `client` directory:
```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_PROJECT_ID=your_firebase_project_id
REACT_APP_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_APP_ID=your_firebase_app_id
REACT_APP_API_ENDPOINT=http://localhost:5000
```

4. **Start the application**
```bash
# Start backend server (from server directory)
npm start

# Start frontend (from client directory, in a new terminal)
npm run dev
```

The application will be available at `http://localhost:5173` (frontend) and `http://localhost:5000` (backend).

---

## 📖 Usage

### Getting Started

1. **Sign In** - Use Google OAuth to authenticate
2. **Set Career Goals** - Define your target career path
3. **Generate Skills Plan** - Get AI-powered skill recommendations
4. **Unlock Learning Paths** - Follow day-by-day structured learning
5. **Build Projects** - Work on career-relevant projects
6. **Track Progress** - Monitor your skill development journey

### Example: Creating a Learning Plan

```javascript
// API Request to generate a 30-day learning plan
POST /api/skill-unlocker/generate-plan
{
  "userId": "user123",
  "skillName": "React Development",
  "duration": 30,
  "level": "intermediate"
}

// Response includes daily objectives, quizzes, and video recommendations
{
  "planId": "plan456",
  "days": [
    {
      "day": 1,
      "topic": "React Hooks Fundamentals",
      "objectives": ["Understand useState", "Learn useEffect"],
      "quiz": {...},
      "videos": [...]
    }
  ]
}
```

### Example: Chat with PDF Notes

```javascript
// Upload a PDF document
POST /upload-notes
FormData: { file: document.pdf, userId: "user123" }

// Chat with the document
POST /chat-with-notes
{
  "noteId": "note789",
  "message": "Explain the main concepts in chapter 3"
}

// AI responds with context-aware answers from the document
```

---

## 📊 Project Statistics

- **11 Core Modules**
- **60+ API Endpoints**
- **17 Backend Controllers**
- **14 Database Collections**
- **35+ Frontend Components**

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **Groq AI** - High-speed AI inference
- **Firebase** - Authentication services
- **MongoDB** - Database infrastructure
- **YouTube Data API** - Video recommendations

---

## 📧 Contact

For questions or support, please open an issue or contact the development team.

---

<p align="center">Built with ❤️ by the Novard-AI Team</p>
<p align="center"><i>Transforming careers, one prompt at a time.</i></p>
