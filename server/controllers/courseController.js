const Course = require('../models/course');

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

// Get course by ID
const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};

// Create new course
const createCourse = async (req, res) => {
  try {
    const { title, description, image, teacherEmail } = req.body;
    
    if (!title || !description || !teacherEmail) {
      return res.status(400).json({ error: 'Title, description, and teacher email are required' });
    }

    const course = new Course({
      title,
      description,
      image,
      teacherEmail,
      videos: []
    });

    const savedCourse = await course.save();
    res.status(201).json(savedCourse);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { title, description, image } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.courseId,
      { title, description, image, updatedAt: Date.now() },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

// Add video to course
const addVideoToCourse = async (req, res) => {
  try {
    const { title, description, driveLink, thumbnail } = req.body;
    
    if (!title || !driveLink) {
      return res.status(400).json({ error: 'Title and drive link are required' });
    }

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const newVideo = {
      title,
      description,
      driveLink,
      thumbnail,
      createdAt: new Date()
    };

    course.videos.push(newVideo);
    course.updatedAt = new Date();
    
    const updatedCourse = await course.save();
    const addedVideo = updatedCourse.videos[updatedCourse.videos.length - 1];
    
    res.status(201).json(addedVideo);
  } catch (error) {
    console.error('Error adding video to course:', error);
    res.status(500).json({ error: 'Failed to add video to course' });
  }
};

// Update video in course
const updateVideoInCourse = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title, description, driveLink, thumbnail } = req.body;

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (driveLink) video.driveLink = driveLink;
    if (thumbnail !== undefined) video.thumbnail = thumbnail;

    course.updatedAt = new Date();
    const updatedCourse = await course.save();
    
    res.json(updatedCourse.videos.id(videoId));
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
};

// Delete video from course
const deleteVideoFromCourse = async (req, res) => {
  try {
    const { videoId } = req.params;

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Use pull to remove the video from the array
    course.videos.pull(videoId);
    course.updatedAt = new Date();
    await course.save();
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  addVideoToCourse,
  updateVideoInCourse,
  deleteVideoFromCourse
};
