# Environment Setup for Educational Video Platform

## Required Environment Variables

Create a `.env` file in the server directory with the following variables:

```env
# Google Gemini AI API Key (for real course link generation)
GEMINI_API_KEY=AIzaSyCStRxWTs-_AKs_wl3NAj5ldhw6oHB15tY

# Groq AI API Key (for chat and summarization)
GROQ_API_KEY=your_groq_api_key_here

# MongoDB Connection String
MONGODB_URI=your_mongodb_connection_string_here
```

## Features Enabled with Gemini AI

- **Real Course Links**: Generate actual, working course URLs from Udemy, Coursera, Edureka, and Unacademy
- **Dynamic Content**: Course information is fetched in real-time based on user search queries
- **Platform-Specific Data**: Each platform gets appropriate course recommendations with accurate pricing, ratings, and descriptions
- **Fallback Support**: If Gemini AI fails, the system falls back to mock data to ensure reliability

## Supported Platforms

1. **YouTube**: Uses YouTube Search API for real video data
2. **Udemy**: Uses Gemini AI to find real Udemy courses
3. **Coursera**: Uses Gemini AI to find real Coursera courses and specializations
4. **Edureka**: Uses Gemini AI to find real Edureka certification programs
5. **Unacademy**: Uses Gemini AI to find real Unacademy courses

## API Endpoints

- `POST /recommend-educational-videos` - Get course recommendations using Gemini AI
- `POST /educational-videos` - Add educational videos from any platform
- `GET /educational-videos/:userId` - Get user's educational videos
- `POST /chat-with-educational-video` - Chat with video content
- `POST /summarize-educational-video` - Generate video summaries
- `POST /generate-educational-quiz` - Create quizzes from video content
