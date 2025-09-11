# Groq API Setup Guide

## Getting Your Free Groq API Key

1. **Visit Groq Console**:
   - Go to [https://console.groq.com/](https://console.groq.com/)

2. **Sign up/Login**:
   - Create an account or sign in with your existing account

3. **Get API Key**:
   - Go to the "API Keys" section
   - Click "Create API Key"
   - Copy the generated API key

4. **Add to Environment Variables**:
   - Create or update your `.env` file in the server directory
   - Add the following line:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

## Free Tier Limits

- **Free tier includes**: 14,400 requests per day, unlimited tokens
- **Models available**: llama-3.1-8b-instant (ultra-fast inference)
- **No credit card required** for the free tier
- **Always free** - no usage limits that require payment

## Installation

The Groq SDK is already installed in your project:

```bash
npm install groq-sdk
```

## Usage

The Notes feature will automatically use Groq API for:
- Chat with notes
- Summarizing notes
- Generating quizzes

## Benefits of Groq API

- **Always free** - no usage costs ever
- **Ultra-fast responses** - fastest inference available
- **No credit card required**
- **High-quality responses** with Llama models
- **Excellent JSON formatting** for quiz generation
- **Reliable uptime** - no overload issues like other providers
