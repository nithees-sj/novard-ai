const { geminiGenerate } = require('../ai/gemini');
const { parseModelJson } = require('../utils/parseModelJson');
const { httpUrl } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * Course suggestions for Udemy, Coursera and Edureka requests.
 *
 * The UI now only offers YouTube, but requests saved earlier for the other
 * platforms still exist and are still recommended for: first by asking Gemini
 * for real course links, then from a small list of known courses.
 */

const PLATFORM_PROMPT_DETAILS = {
  udemy: {
    name: 'Udemy',
    example: '{"title": "Course Title", "url": "https://www.udemy.com/course/course-slug/", "instructor": "Instructor Name", "rating": "4.5", "price": "$89.99", "enrollments": 50000, "description": "Course description"}',
    pattern: 'https://www.udemy.com/course/[course-slug]/',
    examples: [
      'https://www.udemy.com/course/reactjs-design-patterns/',
      'https://www.udemy.com/course/react-part2/',
      'https://www.udemy.com/course/react-js-para-principiantes-desde-cero-curso-gratuito/',
      'https://www.udemy.com/course/reactjs-tic-tac-toe/',
      'https://www.udemy.com/course/hands-on-introduction-to-web-development-with-nextjs/',
      'https://www.udemy.com/course/react-js-course-build-a-complete-project-project-base/',
      'https://www.udemy.com/course/reactjs-for-beginners-reactjs-basics-react-level1/',
      'https://www.udemy.com/course/web-javascript-react-2022/',
      'https://www.udemy.com/course/learn-react-with-project/',
      'https://www.udemy.com/course/curso-de-react-js-desde-cero-gratis/',
      'https://www.udemy.com/course/react-js-inicia-en-el-mundo-de-los-frameworks-de-javascript/',
      'https://www.udemy.com/course/hands-on-introduction-to-frontend-development-with-react/',
    ],
    popularity: 'Include popular courses with high enrollment numbers',
    people: 'Use real instructor names and accurate course information',
  },
  coursera: {
    name: 'Coursera',
    example: '{"title": "Course Title", "url": "https://www.coursera.org/learn/course-slug", "instructor": "University/Instructor", "rating": "4.7", "price": "Free or $49/month", "enrollments": 100000, "description": "Course description"}',
    pattern: 'https://www.coursera.org/learn/[course-slug]',
    examples: [
      'https://www.coursera.org/learn/machine-learning',
      'https://www.coursera.org/learn/python-data',
      'https://www.coursera.org/learn/html-css-javascript-for-web-developers',
      'https://www.coursera.org/learn/algorithmic-thinking-1',
      'https://www.coursera.org/learn/neural-networks-deep-learning',
      'https://www.coursera.org/learn/programming-with-javascript',
      'https://www.coursera.org/specializations/javascript-beginner',
      'https://www.coursera.org/learn/introduction-html-css-javascript',
      'https://www.coursera.org/professional-certificates/ibm-full-stack-javascript-developer',
      'https://www.coursera.org/specializations/html-css-javascript-for-web-developers',
      'https://www.coursera.org/specializations/advanced-javascript',
      'https://www.coursera.org/learn/introduction-to-javascript-programming',
      'https://www.coursera.org/learn/javascript-programming-essentials',
      'https://www.coursera.org/specializations/javascript-programming-with-react-node-mongodb',
      'https://www.coursera.org/learn/learn-javascript',
      'https://www.coursera.org/professional-certificates/microsoft-javascript-starter-kit',
    ],
    popularity: 'Include popular courses from well-known universities',
    people: 'Use real university names and accurate course information',
  },
  edureka: {
    name: 'Edureka',
    example: '{"title": "Course Title", "url": "https://www.edureka.co/course-slug", "instructor": "Edureka Team", "rating": "4.4", "price": "$199", "enrollments": 25000, "description": "Course description"}',
    pattern: 'https://www.edureka.co/[course-slug]',
    examples: [
      'https://www.edureka.co/data-science',
      'https://www.edureka.co/aws-certification-training',
      'https://www.edureka.co/python-programming-certification-training',
      'https://www.edureka.co/machine-learning-certification-training',
      'https://www.edureka.co/blockchain-training',
      'https://www.edureka.co/css-certification-course',
      'https://www.edureka.co/python-scripting',
      'https://www.edureka.co/masters-program/python-developer-training',
      'https://www.edureka.co/data-science-python-certification-course',
      'https://www.edureka.co/python-django',
      'https://www.edureka.co/pyspark-certification-training',
    ],
    popularity: 'Include popular courses with high enrollment numbers',
    people: 'Use real instructor information and accurate course details',
  },
};

function coursePrompt(platform, keyword, count) {
  const p = PLATFORM_PROMPT_DETAILS[platform];
  return `Find ${count} popular, currently available ${p.name} courses related to "${keyword}". Return ONLY a JSON array with this exact format:
[${p.example}]

CRITICAL REQUIREMENTS:
- Only return courses that are currently active and accessible on ${p.name}
- Use real, verified course URLs that exist on the platform
- ${p.popularity}
- Ensure all URLs follow the exact pattern: ${p.pattern}
- ${p.people}
- Focus on well-known, established courses that are likely to remain available

Examples of real ${p.name} course URLs:
${p.examples.map((u) => `- ${u}`).join('\n')}

Do NOT generate fake or made-up course URLs. Only use real courses that exist on ${p.name}. Before giving the URL of a course, make sure the course exists on ${p.name}.`;
}

/** Known, verified courses: the fallback when Gemini is unavailable. */
const KNOWN_COURSES = {
  udemy: [
    { title: 'The Complete Web Developer Course 2.0', url: 'https://www.udemy.com/course/the-complete-web-developer-course-2/', instructor: 'Rob Percival', rating: '4.6', price: '$199.99', enrollments: 500000, description: 'Learn to code and become a web developer with HTML, CSS, JavaScript, PHP, Python, MySQL & more!' },
    { title: 'The Complete JavaScript Course 2024: From Zero to Expert!', url: 'https://www.udemy.com/course/the-complete-javascript-course/', instructor: 'Jonas Schmedtmann', rating: '4.7', price: '$89.99', enrollments: 800000, description: 'The modern JavaScript course for everyone! Master JavaScript with projects, challenges and theory.' },
    { title: 'Complete Python Bootcamp From Zero to Hero in Python', url: 'https://www.udemy.com/course/complete-python-bootcamp/', instructor: 'Jose Portilla', rating: '4.6', price: '$89.99', enrollments: 1500000, description: 'Learn Python like a Professional! Start from the basics and go all the way to creating your own applications.' },
    { title: 'AWS Certified Solutions Architect - Associate 2024', url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate/', instructor: 'Ryan Kroonenburg', rating: '4.6', price: '$94.99', enrollments: 400000, description: 'Pass the AWS Certified Solutions Architect Associate Certification SAA-C03. Complete video course + practice exam.' },
    { title: 'Machine Learning A-Z: Hands-On Python & R In Data Science', url: 'https://www.udemy.com/course/machinelearning/', instructor: 'Kirill Eremenko', rating: '4.6', price: '$89.99', enrollments: 700000, description: 'Learn to create Machine Learning Algorithms in Python and R from two Data Science experts.' },
  ],
  coursera: [
    { title: 'Machine Learning', url: 'https://www.coursera.org/learn/machine-learning', instructor: 'Stanford University', rating: '4.9', price: 'Free', enrollments: 4000000, description: 'Machine learning is the science of getting computers to act without being explicitly programmed.' },
    { title: 'Python for Everybody Specialization', url: 'https://www.coursera.org/specializations/python', instructor: 'University of Michigan', rating: '4.8', price: 'Free', enrollments: 2000000, description: 'Learn to Program and Analyze Data with Python. Develop programs to gather, clean, analyze, and visualize data.' },
    { title: 'HTML, CSS, and Javascript for Web Developers', url: 'https://www.coursera.org/learn/html-css-javascript-for-web-developers', instructor: 'Johns Hopkins University', rating: '4.7', price: 'Free', enrollments: 1500000, description: 'Learn the fundamental tools that every web page coder needs to know.' },
    { title: 'Algorithmic Thinking (Part 1)', url: 'https://www.coursera.org/learn/algorithmic-thinking-1', instructor: 'Rice University', rating: '4.6', price: 'Free', enrollments: 800000, description: 'Learn to think like a computer scientist. Master the fundamentals of the design and analysis of algorithms.' },
    { title: 'Neural Networks and Deep Learning', url: 'https://www.coursera.org/learn/neural-networks-deep-learning', instructor: 'DeepLearning.AI', rating: '4.9', price: 'Free', enrollments: 3000000, description: 'If you want to break into cutting-edge AI, this course will help you do so.' },
  ],
  edureka: [
    { title: 'Data Science with Python', url: 'https://www.edureka.co/data-science', instructor: 'Edureka Team', rating: '4.5', price: '$199', enrollments: 50000, description: 'Learn Data Science with Python programming language. Master data analysis, visualization, and machine learning.' },
    { title: 'AWS Certification Training', url: 'https://www.edureka.co/aws-certification-training', instructor: 'Edureka Team', rating: '4.4', price: '$199', enrollments: 75000, description: 'Master AWS cloud platform with hands-on projects and real-world scenarios.' },
    { title: 'Python Programming Certification Training', url: 'https://www.edureka.co/python-programming-certification-training', instructor: 'Edureka Team', rating: '4.6', price: '$199', enrollments: 100000, description: 'Learn Python programming from scratch with live projects and industry-relevant curriculum.' },
    { title: 'Machine Learning Certification Training', url: 'https://www.edureka.co/machine-learning-certification-training', instructor: 'Edureka Team', rating: '4.5', price: '$199', enrollments: 60000, description: 'Master machine learning algorithms and techniques with hands-on projects and real-world applications.' },
    { title: 'Blockchain Certification Training', url: 'https://www.edureka.co/blockchain-training', instructor: 'Edureka Team', rating: '4.3', price: '$199', enrollments: 40000, description: 'Learn blockchain technology, cryptocurrency, and smart contracts with practical implementation.' },
  ],
};

const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '_');

/** A course in the shape the Video Library shows. Model output is untrusted: only http(s) links survive. */
function toCourse(course, platform, id) {
  const url = httpUrl(String(course.url || '').trim());
  if (!url || !course.title || !course.description) return null;
  return {
    id,
    title: String(course.title).trim(),
    description: String(course.description).trim(),
    thumbnail: '/courses.jpg',
    url,
    duration: '',
    instructor: course.instructor || `${PLATFORM_PROMPT_DETAILS[platform].name} Instructor`,
    enrollments: Number(course.enrollments) || 0,
    rating: course.rating ? String(course.rating) : '',
    price: course.price || 'Free',
    platform,
  };
}

function knownCourses(platform, keyword, count) {
  const all = KNOWN_COURSES[platform] || [];
  const k = keyword.toLowerCase();
  const relevant = all.filter((c) => c.title.toLowerCase().includes(k) || c.description.toLowerCase().includes(k));
  return (relevant.length ? relevant : all)
    .slice(0, count)
    .map((c) => toCourse(c, platform, `${platform}_${slug(c.title)}`));
}

/** Course links for a keyword on a course platform: Gemini first, the known list as a fallback. */
async function findCourses(platform, keyword, count) {
  if (!PLATFORM_PROMPT_DETAILS[platform]) return [];
  try {
    const parsed = parseModelJson(await geminiGenerate(coursePrompt(platform, keyword, count)), { context: 'course list' });
    if (!Array.isArray(parsed)) throw new Error('Gemini response is not an array');
    const seen = new Set();
    const courses = parsed
      .map((c, i) => toCourse(c || {}, platform, `${platform}_${slug(keyword)}_${i + 1}`))
      .filter((c) => c && !seen.has(c.url) && seen.add(c.url));
    if (courses.length) return courses;
    throw new Error('Gemini returned no usable courses');
  } catch (error) {
    logger.warn(`Course discovery for ${platform} fell back to the known list`, { keyword, error: error.message });
    return knownCourses(platform, keyword, count);
  }
}

module.exports = { findCourses, PLATFORMS: Object.keys(PLATFORM_PROMPT_DETAILS), _internal: { toCourse, knownCourses, coursePrompt } };
