const Video = require('../models/video');
const Groq = require('groq-sdk');
const youtubesearchapi = require('youtube-search-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to get real course links using Gemini AI
const getRealCourseLinks = async (platform, keyword, maxVideos) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const platformPrompts = {
      udemy: `Find ${maxVideos} popular, currently available Udemy courses related to "${keyword}". Return ONLY a JSON array with this exact format:
      [{"title": "Course Title", "url": "https://www.udemy.com/course/course-slug/", "instructor": "Instructor Name", "rating": "4.5", "price": "$89.99", "enrollments": 50000, "description": "Course description"}]
      
      CRITICAL REQUIREMENTS:
      - Only return courses that are currently active and accessible on Udemy
      - Use real, verified course URLs that exist on the platform
      - Include popular courses with high enrollment numbers
      - Ensure all URLs follow the exact pattern: https://www.udemy.com/course/[course-slug]/
      - Use real instructor names and accurate course information
      - Focus on well-known, established courses that are likely to remain available
      
      Examples of real Udemy course patterns:
      - https://www.udemy.com/course/the-complete-web-developer-course-2/
      - https://www.udemy.com/course/the-complete-javascript-course/
      - https://www.udemy.com/course/complete-python-bootcamp/
      - https://www.udemy.com/course/aws-certified-solutions-architect-associate/
      - https://www.udemy.com/course/machinelearning/
      - 
      
      Do NOT generate fake or made-up course URLs. Only use real courses that exist on Udemy.
      Strong Note : Before giving the url of the course make sure that the course it present in the udemy, only give the course list by checking the udemy exising or not`,
      
      coursera: `Find ${maxVideos} popular, currently available Coursera courses related to "${keyword}". Return ONLY a JSON array with this exact format:
      [{"title": "Course Title", "url": "https://www.coursera.org/learn/course-slug", "instructor": "University/Instructor", "rating": "4.7", "price": "Free or $49/month", "enrollments": 100000, "description": "Course description"}]
      
      CRITICAL REQUIREMENTS:
      - Only return courses that are currently active and accessible on Coursera
      - Use real, verified course URLs that exist on the platform
      - Include popular courses from well-known universities
      - Ensure all URLs follow the exact pattern: https://www.coursera.org/learn/[course-slug]
      - Use real university names and accurate course information
      - Focus on established courses that are likely to remain available
      
      Examples of real Coursera course patterns:
      - https://www.coursera.org/learn/machine-learning
      - https://www.coursera.org/learn/python-data
      - https://www.coursera.org/learn/html-css-javascript-for-web-developers
      - https://www.coursera.org/learn/algorithmic-thinking-1
      - https://www.coursera.org/learn/neural-networks-deep-learning
      
      Do NOT generate fake or made-up course URLs. Only use real courses that exist on Coursera.
      Strong Note : Before giving the url of the course make sure that the course it present in the Coursera, only give the course list by checking the Coursera exising or not`,
      
      edureka: `Find ${maxVideos} popular, currently available Edureka courses related to "${keyword}". Return ONLY a JSON array with this exact format:
      [{"title": "Course Title", "url": "https://www.edureka.co/course-slug", "instructor": "Edureka Team", "rating": "4.4", "price": "$199", "enrollments": 25000, "description": "Course description"}]
      
      CRITICAL REQUIREMENTS:
      - Only return courses that are currently active and accessible on Edureka
      - Use real, verified course URLs that exist on the platform
      - Include popular courses with high enrollment numbers
      - Ensure all URLs follow the exact pattern: https://www.edureka.co/[course-slug]
      - Use real instructor information and accurate course details
      - Focus on established courses that are likely to remain available
      
      Examples of real Edureka course patterns:
      - https://www.edureka.co/data-science
      - https://www.edureka.co/aws-certification-training
      - https://www.edureka.co/python-programming-certification-training
      - https://www.edureka.co/machine-learning-certification-training
      - https://www.edureka.co/blockchain-training
      
      Do NOT generate fake or made-up course URLs. Only use real courses that exist on Edureka
      Strong Note : Before giving the url of the course make sure that the course it present in the Edureka, only give the course list by checking the Edureka exising or not`,
      
    };

    const prompt = platformPrompts[platform];
    if (!prompt) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response to extract JSON
    let cleanedText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Extract JSON array from the response
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    
    console.log(`Gemini response for ${platform} - ${keyword}:`, cleanedText);
    
    let courses;
    try {
      courses = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error parsing Gemini JSON response:', parseError);
      console.log('Raw response:', cleanedText);
      throw new Error('Failed to parse Gemini response as JSON');
    }
    
    // Validate that we got an array
    if (!Array.isArray(courses)) {
      console.error('Gemini response is not an array:', courses);
      throw new Error('Gemini response is not a valid array');
    }
    
    // Remove duplicates based on title and URL
    const uniqueCourses = courses.filter((course, index, self) => 
      index === self.findIndex(c => 
        c.title === course.title && c.url === course.url
      )
    );
    
    // Convert to the expected format with courses.jpg thumbnail
    return uniqueCourses
      .filter(course => course.title && course.url && course.description) // Filter out incomplete courses
      .map((course, index) => ({
        id: `${platform}_${keyword.replace(/\s+/g, '_')}_${index + 1}`,
        title: course.title.trim(),
        description: course.description.trim(),
        thumbnail: `/courses.jpg`, // Use courses.jpg for all course thumbnails
        url: course.url.trim(),
        duration: `${Math.floor(Math.random() * 3) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        instructor: course.instructor || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Instructor`,
        enrollments: course.enrollments || Math.floor(Math.random() * 10000) + 100,
        rating: course.rating || (Math.random() * 2 + 3).toFixed(1),
        price: course.price || 'Free',
        platform: platform
      }));
    
  } catch (error) {
    console.error(`Error getting real course links for ${platform}:`, error);
    // Fallback to mock data if Gemini fails
    return generateMockPlatformVideos(platform, keyword, maxVideos);
  }
};

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
    const { title, description, platform, userId } = req.body;

    if (!title || !description || !userId) {
      return res.status(400).json({ error: 'Title, description, and userId are required' });
    }

    const videoRequest = new Video({
      title: title.trim(),
      description: description.trim(),
      platform: platform || 'youtube',
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

// Recommend videos based on video request using platform-specific search
const recommendVideos = async (req, res) => {
  try {
    const { title, description, platform } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const selectedPlatform = platform || 'youtube';

    // Use Groq AI to generate search keywords for the selected platform
    const platformNames = {
      youtube: 'YouTube',
      udemy: 'Udemy',
      coursera: 'Coursera',
      edureka: 'Edureka'
    };

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates search keywords for educational platforms based on user requests.
          
          When a user provides a request title and description, generate 2-3 specific search keywords that would find relevant educational content on ${platformNames[selectedPlatform]}.
          
          Focus on:
          - Educational content, tutorials, and courses
          - Specific technical terms and concepts
          - Learning-oriented keywords
          - Programming, development, and technical topics
          - Platform-specific terminology and course structures
          
          Return your response as a JSON array of strings:
          ["keyword1", "keyword2", "keyword3"]
          
          Examples for different platforms:
          - YouTube: ["React tutorial", "JavaScript course", "CSS flexbox guide"]
          - Udemy: ["Complete React course", "JavaScript programming bootcamp", "Web development masterclass"]
          - Coursera: ["React specialization", "JavaScript algorithms course", "Web development certificate"]
          - Edureka: ["React training", "JavaScript certification", "Full stack development course"]`
        },
        {
          role: "user",
          content: `Request Title: "${title}"\n\nRequest Description: "${description}"\n\nPlatform: ${platformNames[selectedPlatform]}\n\nGenerate search keywords for finding relevant educational content on ${platformNames[selectedPlatform]}.`
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

    // Search the selected platform for each keyword and collect results
    const allVideos = [];
    const maxVideosPerKeyword = 3;
    
    for (const keyword of searchKeywords.slice(0, 3)) { // Limit to 3 keywords
      try {
        console.log(`Searching ${platformNames[selectedPlatform]} for: "${keyword}"`);
        
        let searchResult;
        if (selectedPlatform === 'youtube') {
          searchResult = await youtubesearchapi.GetListByKeyword(keyword, false, maxVideosPerKeyword);
        } else {
          // For other platforms, use Gemini AI to get real course links
          try {
            console.log(`Getting real course links for ${selectedPlatform} using Gemini AI...`);
            const realCourses = await getRealCourseLinks(selectedPlatform, keyword, maxVideosPerKeyword);
            console.log(`Found ${realCourses.length} real courses for ${selectedPlatform}`);
            searchResult = { items: realCourses };
          } catch (error) {
            console.error(`Error getting real course links for ${selectedPlatform}:`, error);
            console.log(`Falling back to mock courses for ${selectedPlatform}`);
            const fallbackCourses = await generateMockPlatformVideos(selectedPlatform, keyword, maxVideosPerKeyword);
            searchResult = { items: fallbackCourses };
          }
        }
        
        if (searchResult && searchResult.items) {
          const videos = searchResult.items
            .filter(item => selectedPlatform === 'youtube' ? (item.type === 'video' && !item.isLive) : true) // Only regular videos for YouTube
            .map(item => {
              if (selectedPlatform === 'youtube') {
                // YouTube-specific processing
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
                  viewCount: item.viewCount || 0,
                  platform: selectedPlatform
                };
              } else {
                // Other platforms processing
                return {
                  title: item.title,
                  description: item.description || 'Educational course content',
                  thumbnail: item.thumbnail || `https://via.placeholder.com/320x180?text=${platformNames[selectedPlatform]}`,
                  url: item.url || '#',
                  duration: item.duration || 'Unknown',
                  reason: `Found for search: "${keyword}"`,
                  videoId: item.id || item.videoId || Math.random().toString(36).substr(2, 9),
                  channel: item.instructor || item.channel || platformNames[selectedPlatform],
                  viewCount: item.enrollments || item.viewCount || 0,
                  platform: selectedPlatform
                };
              }
            });
          
          allVideos.push(...videos);
        }
      } catch (searchError) {
        console.error(`Error searching for keyword "${keyword}":`, searchError);
        // Continue with other keywords
      }
    }

    // Remove duplicates based on video ID, title, and URL
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => 
        v.videoId === video.videoId || 
        (v.title === video.title && v.url === video.url)
      )
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

// Fallback function for when Gemini AI fails
// Real course database with verified URLs
const getRealCourseDatabase = () => {
  return {
    udemy: [
      {
        title: "The Complete Web Developer Course 2.0",
        url: "https://www.udemy.com/course/the-complete-web-developer-course-2/",
        instructor: "Rob Percival",
        rating: "4.6",
        price: "$199.99",
        enrollments: 500000,
        description: "Learn to code and become a web developer with HTML, CSS, JavaScript, PHP, Python, MySQL & more!"
      },
      {
        title: "The Complete JavaScript Course 2024: From Zero to Expert!",
        url: "https://www.udemy.com/course/the-complete-javascript-course/",
        instructor: "Jonas Schmedtmann",
        rating: "4.7",
        price: "$89.99",
        enrollments: 800000,
        description: "The modern JavaScript course for everyone! Master JavaScript with projects, challenges and theory."
      },
      {
        title: "Complete Python Bootcamp From Zero to Hero in Python",
        url: "https://www.udemy.com/course/complete-python-bootcamp/",
        instructor: "Jose Portilla",
        rating: "4.6",
        price: "$89.99",
        enrollments: 1500000,
        description: "Learn Python like a Professional! Start from the basics and go all the way to creating your own applications."
      },
      {
        title: "AWS Certified Solutions Architect - Associate 2024",
        url: "https://www.udemy.com/course/aws-certified-solutions-architect-associate/",
        instructor: "Ryan Kroonenburg",
        rating: "4.6",
        price: "$94.99",
        enrollments: 400000,
        description: "Pass the AWS Certified Solutions Architect Associate Certification SAA-C03. Complete video course + practice exam."
      },
      {
        title: "Machine Learning A-Z: Hands-On Python & R In Data Science",
        url: "https://www.udemy.com/course/machinelearning/",
        instructor: "Kirill Eremenko",
        rating: "4.6",
        price: "$89.99",
        enrollments: 700000,
        description: "Learn to create Machine Learning Algorithms in Python and R from two Data Science experts."
      }
    ],
    coursera: [
      {
        title: "Machine Learning",
        url: "https://www.coursera.org/learn/machine-learning",
        instructor: "Stanford University",
        rating: "4.9",
        price: "Free",
        enrollments: 4000000,
        description: "Machine learning is the science of getting computers to act without being explicitly programmed."
      },
      {
        title: "Python for Everybody Specialization",
        url: "https://www.coursera.org/specializations/python",
        instructor: "University of Michigan",
        rating: "4.8",
        price: "Free",
        enrollments: 2000000,
        description: "Learn to Program and Analyze Data with Python. Develop programs to gather, clean, analyze, and visualize data."
      },
      {
        title: "HTML, CSS, and Javascript for Web Developers",
        url: "https://www.coursera.org/learn/html-css-javascript-for-web-developers",
        instructor: "Johns Hopkins University",
        rating: "4.7",
        price: "Free",
        enrollments: 1500000,
        description: "Learn the fundamental tools that every web page coder needs to know."
      },
      {
        title: "Algorithmic Thinking (Part 1)",
        url: "https://www.coursera.org/learn/algorithmic-thinking-1",
        instructor: "Rice University",
        rating: "4.6",
        price: "Free",
        enrollments: 800000,
        description: "Learn to think like a computer scientist. Master the fundamentals of the design and analysis of algorithms."
      },
      {
        title: "Neural Networks and Deep Learning",
        url: "https://www.coursera.org/learn/neural-networks-deep-learning",
        instructor: "DeepLearning.AI",
        rating: "4.9",
        price: "Free",
        enrollments: 3000000,
        description: "If you want to break into cutting-edge AI, this course will help you do so."
      }
    ],
    edureka: [
      {
        title: "Data Science with Python",
        url: "https://www.edureka.co/data-science",
        instructor: "Edureka Team",
        rating: "4.5",
        price: "$199",
        enrollments: 50000,
        description: "Learn Data Science with Python programming language. Master data analysis, visualization, and machine learning."
      },
      {
        title: "AWS Certification Training",
        url: "https://www.edureka.co/aws-certification-training",
        instructor: "Edureka Team",
        rating: "4.4",
        price: "$199",
        enrollments: 75000,
        description: "Master AWS cloud platform with hands-on projects and real-world scenarios."
      },
      {
        title: "Python Programming Certification Training",
        url: "https://www.edureka.co/python-programming-certification-training",
        instructor: "Edureka Team",
        rating: "4.6",
        price: "$199",
        enrollments: 100000,
        description: "Learn Python programming from scratch with live projects and industry-relevant curriculum."
      },
      {
        title: "Machine Learning Certification Training",
        url: "https://www.edureka.co/machine-learning-certification-training",
        instructor: "Edureka Team",
        rating: "4.5",
        price: "$199",
        enrollments: 60000,
        description: "Master machine learning algorithms and techniques with hands-on projects and real-world applications."
      },
      {
        title: "Blockchain Certification Training",
        url: "https://www.edureka.co/blockchain-training",
        instructor: "Edureka Team",
        rating: "4.3",
        price: "$199",
        enrollments: 40000,
        description: "Learn blockchain technology, cryptocurrency, and smart contracts with practical implementation."
      }
    ]
  };
};

const generateMockPlatformVideos = async (platform, keyword, maxVideos) => {
  const realCourses = getRealCourseDatabase();
  const platformCourses = realCourses[platform] || [];
  
  // Filter courses based on keyword relevance
  const relevantCourses = platformCourses.filter(course => 
    course.title.toLowerCase().includes(keyword.toLowerCase()) ||
    course.description.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // If no relevant courses found, return general courses
  const coursesToReturn = relevantCourses.length > 0 ? relevantCourses : platformCourses;
  
  return coursesToReturn.slice(0, maxVideos).map(course => ({
    id: `${platform}_${course.title.toLowerCase().replace(/\s+/g, '_')}`,
    title: course.title,
    url: course.url,
    description: course.description,
    thumbnail: '/courses.jpg',
    duration: `${Math.floor(Math.random() * 3) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
    instructor: course.instructor,
    enrollments: course.enrollments,
    rating: course.rating,
    price: course.price,
    platform: platform
  }));
};

module.exports = {
  getUserVideoRequests,
  createVideoRequest,
  deleteVideoRequest,
  recommendVideos
};
