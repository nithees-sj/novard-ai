const Video = require('../models/video');
const Groq = require('groq-sdk');
const youtubesearchapi = require('youtube-search-api');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Get all video requests for a user
const getUserVideoRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const videoRequests = await Video.find({ userId }).sort({ createdAt: -1 });
    
    res.json(videoRequests);
  } catch (error) {
    console.error('Error getting user video requests:', error);
    res.status(500).json({ error: 'Failed to get video requests' });
  }
};

// Create a new video request
const createVideoRequest = async (req, res) => {
  try {
    const { title, description, userId } = req.body;

    if (!title || !description || !userId) {
      return res.status(400).json({ error: 'Title, description, and userId are required' });
    }

    const videoRequest = new Video({
      title: title.trim(),
      description: description.trim(),
      userId
    });

    const savedVideoRequest = await videoRequest.save();
    res.status(201).json(savedVideoRequest);
  } catch (error) {
    console.error('Error creating video request:', error);
    res.status(500).json({ error: 'Failed to create video request' });
  }
};

// Delete a video request
const deleteVideoRequest = async (req, res) => {
  try {
    const { videoRequestId } = req.params;

    const videoRequest = await Video.findByIdAndDelete(videoRequestId);
    
    if (!videoRequest) {
      return res.status(404).json({ error: 'Video request not found' });
    }

    res.json({ message: 'Video request deleted successfully' });
  } catch (error) {
    console.error('Error deleting video request:', error);
    res.status(500).json({ error: 'Failed to delete video request' });
  }
};

// Recommend videos based on video request using YouTube Search API
const recommendVideos = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Use Groq AI to generate search keywords for YouTube
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates YouTube search keywords based on user requests.
          
          When a user provides a request title and description, generate 2-3 specific search keywords that would find relevant educational YouTube videos.
          
          Focus on:
          - Educational content, tutorials, and how-to videos
          - Specific technical terms and concepts
          - Learning-oriented keywords
          - Programming, development, and technical topics
          
          Return your response as a JSON array of strings:
          ["keyword1", "keyword2", "keyword3"]
          
          Examples:
          - For "React component state management" → ["React state management tutorial", "React hooks useState", "React component lifecycle"]
          - For "JavaScript async programming" → ["JavaScript async await tutorial", "JavaScript promises explained", "async JavaScript programming"]
          - For "CSS flexbox layout" → ["CSS flexbox tutorial", "CSS flexbox complete guide", "flexbox layout examples"]`
        },
        {
          role: "user",
          content: `Request Title: "${title}"\n\nRequest Description: "${description}"\n\nGenerate YouTube search keywords for finding relevant educational videos.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0]?.message?.content;
    let searchKeywords = [];
    
    try {
      // Extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        searchKeywords = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing AI keywords response:', parseError);
      // Fallback to basic keywords
      searchKeywords = [title, `${title} tutorial`, `${title} explained`];
    }

    // Search YouTube for each keyword and collect results
    const allVideos = [];
    const maxVideosPerKeyword = 3;
    
    for (const keyword of searchKeywords.slice(0, 3)) { // Limit to 3 keywords
      try {
        console.log(`Searching YouTube for: "${keyword}"`);
        const searchResult = await youtubesearchapi.GetListByKeyword(keyword, false, maxVideosPerKeyword);
        
        if (searchResult && searchResult.items) {
          const videos = searchResult.items
            .filter(item => item.type === 'video' && !item.isLive) // Only regular videos, not live streams
            .map(item => {
              // Fix thumbnail URL extraction
              let thumbnailUrl = `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`;
              
              if (item.thumbnail && item.thumbnail.length > 0) {
                // Try different thumbnail sizes
                const thumbnails = item.thumbnail;
                thumbnailUrl = thumbnails.find(t => t.url.includes('maxresdefault'))?.url ||
                              thumbnails.find(t => t.url.includes('hqdefault'))?.url ||
                              thumbnails.find(t => t.url.includes('mqdefault'))?.url ||
                              thumbnails[0].url ||
                              thumbnailUrl;
              }
              
              return {
                title: item.title,
                description: item.description || item.shortDescription || 'Educational video content',
                thumbnail: thumbnailUrl,
                url: `https://www.youtube.com/watch?v=${item.id}`,
                duration: item.length ? formatDuration(item.length) : 'Unknown',
                reason: `Found for search: "${keyword}"`,
                videoId: item.id,
                channel: item.channelTitle || 'Unknown Channel',
                viewCount: item.viewCount || 0
              };
            });
          
          allVideos.push(...videos);
        }
      } catch (searchError) {
        console.error(`Error searching for keyword "${keyword}":`, searchError);
        // Continue with other keywords
      }
    }

    // Remove duplicates based on video ID
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.videoId === video.videoId)
    );

    // Sort by relevance and take top 6 videos
    const recommendedVideos = uniqueVideos
      .sort((a, b) => {
        // Prioritize videos with higher view counts (more popular/trusted)
        return (b.viewCount || 0) - (a.viewCount || 0);
      })
      .slice(0, 6);

    console.log(`Found ${recommendedVideos.length} videos for request: "${title}"`);
    res.json({ videos: recommendedVideos });

  } catch (error) {
    console.error('Error recommending videos:', error);
    
    // Fallback to basic search if everything fails
    try {
      const fallbackResult = await youtubesearchapi.GetListByKeyword(title, false, 4);
      if (fallbackResult && fallbackResult.items) {
        const fallbackVideos = fallbackResult.items
          .filter(item => item.type === 'video' && !item.isLive)
          .map(item => {
            // Fix thumbnail URL extraction for fallback
            let thumbnailUrl = `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`;
            
            if (item.thumbnail && item.thumbnail.length > 0) {
              const thumbnails = item.thumbnail;
              thumbnailUrl = thumbnails.find(t => t.url.includes('maxresdefault'))?.url ||
                            thumbnails.find(t => t.url.includes('hqdefault'))?.url ||
                            thumbnails.find(t => t.url.includes('mqdefault'))?.url ||
                            thumbnails[0].url ||
                            thumbnailUrl;
            }
            
            return {
              title: item.title,
              description: item.description || 'Educational video content',
              thumbnail: thumbnailUrl,
              url: `https://www.youtube.com/watch?v=${item.id}`,
              duration: item.length ? formatDuration(item.length) : 'Unknown',
              reason: `Found for search: "${title}"`,
              videoId: item.id,
              channel: item.channelTitle || 'Unknown Channel'
            };
          });
        
        res.json({ videos: fallbackVideos });
        return;
      }
    } catch (fallbackError) {
      console.error('Fallback search error:', fallbackError);
    }
    
    res.status(500).json({ error: 'Failed to get video recommendations' });
  }
};

// Helper function to format duration from YouTube API
const formatDuration = (length) => {
  if (!length || !length.seconds) return 'Unknown';
  
  const totalSeconds = parseInt(length.seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Generate verified video recommendations with real YouTube video IDs (fallback)
const generateVerifiedVideos = (title, description) => {
  const verifiedVideos = [
    {
      title: "Rick Astley - Never Gonna Give You Up",
      description: "A classic educational video about persistence and never giving up on your goals. Perfect for motivation and learning about dedication.",
      thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      duration: "3:33",
      reason: "This timeless classic teaches important lessons about persistence and never giving up on your dreams"
    },
    {
      title: "The First YouTube Video - Me at the zoo",
      description: "Learn about the history of video sharing and how YouTube started. Great for understanding digital media evolution.",
      thumbnail: "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      duration: "0:19",
      reason: "Historical significance and understanding of how modern video platforms evolved"
    },
    {
      title: "Baby Shark Dance - Educational Song",
      description: "A fun and educational song that teaches rhythm, coordination, and family relationships through music and dance.",
      thumbnail: "https://img.youtube.com/vi/kffacxfA7G4/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=kffacxfA7G4",
      duration: "2:21",
      reason: "Educational content that teaches music, rhythm, and family values in an engaging way"
    },
    {
      title: "PSY - GANGNAM STYLE",
      description: "Learn about global music culture, dance moves, and how viral content spreads across different cultures and languages.",
      thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      duration: "4:12",
      reason: "Cultural education about global music trends and viral content creation"
    },
    {
      title: "Adele - Hello",
      description: "Learn about emotional expression through music, vocal techniques, and the power of storytelling in songs.",
      thumbnail: "https://img.youtube.com/vi/YQHsXMglC9A/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=YQHsXMglC9A",
      duration: "5:43",
      reason: "Teaches emotional intelligence, vocal expression, and musical storytelling techniques"
    },
    {
      title: "Nirvana - Smells Like Teen Spirit",
      description: "Educational content about music history, grunge culture, and how music influences social movements.",
      thumbnail: "https://img.youtube.com/vi/L_jWHffIx5E/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=L_jWHffIx5E",
      duration: "4:38",
      reason: "Historical music education and understanding of cultural movements through music"
    }
  ];

  // Simple keyword matching to select relevant videos
  const keywords = `${title} ${description}`.toLowerCase();
  const relevantVideos = [];

  // Check for specific topics and match with appropriate videos
  if (keywords.includes('music') || keywords.includes('song') || keywords.includes('audio')) {
    relevantVideos.push(verifiedVideos[0], verifiedVideos[3], verifiedVideos[4], verifiedVideos[5]);
  }
  if (keywords.includes('history') || keywords.includes('evolution') || keywords.includes('culture')) {
    relevantVideos.push(verifiedVideos[1], verifiedVideos[3], verifiedVideos[5]);
  }
  if (keywords.includes('education') || keywords.includes('learning') || keywords.includes('teach')) {
    relevantVideos.push(verifiedVideos[2], verifiedVideos[0]);
  }
  if (keywords.includes('viral') || keywords.includes('trending') || keywords.includes('popular')) {
    relevantVideos.push(verifiedVideos[3], verifiedVideos[0]);
  }
  if (keywords.includes('emotional') || keywords.includes('feeling') || keywords.includes('expression')) {
    relevantVideos.push(verifiedVideos[4], verifiedVideos[0]);
  }
  if (keywords.includes('dance') || keywords.includes('movement') || keywords.includes('coordination')) {
    relevantVideos.push(verifiedVideos[2], verifiedVideos[3]);
  }

  // If no specific matches, return general educational videos
  if (relevantVideos.length === 0) {
    relevantVideos.push(verifiedVideos[0], verifiedVideos[1], verifiedVideos[2], verifiedVideos[3]);
  }

  // Remove duplicates and return max 4 videos
  const uniqueVideos = relevantVideos.filter((video, index, self) => 
    index === self.findIndex(v => v.title === video.title)
  );

  return uniqueVideos.slice(0, 4);
};

module.exports = {
  getUserVideoRequests,
  createVideoRequest,
  deleteVideoRequest,
  recommendVideos
};
