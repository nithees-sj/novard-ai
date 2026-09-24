import frontendImage from '../images/roadmaps/frontend_page-0001.jpg';
import backendImage from '../images/roadmaps/backend_page-0001.jpg';
import devopsImage from '../images/roadmaps/devops_page-0001.jpg';
import fullstackImage from '../images/roadmaps/full-stack_page-0001.jpg';
import aiEngineeringImage from '../images/roadmaps/ai-engineer_page-0001.jpg';
import aiDatascientistImage from '../images/roadmaps/ai-data-scientist_page-0001.jpg';
import androidImage from '../images/roadmaps/android_page-0001.jpg';
import cybersecurityImage from '../images/roadmaps/cyber-security_page-0001.jpg';
import dataanalystImage from '../images/roadmaps/data-analyst_page-0001.jpg';
import gamedevImage from '../images/roadmaps/game-developer_page-0001.jpg';
import iosImage from '../images/roadmaps/ios_page-0001.jpg';
import uxdesignImage from '../images/roadmaps/ux-design_page-0001.jpg';

/** The static, pre-drawn roadmaps that shipped with the app (kept as references). */
export const REFERENCE_ROADMAPS = [
  { name: 'Frontend', role: 'Frontend Developer', imageUrl: frontendImage },
  { name: 'Backend', role: 'Backend Developer', imageUrl: backendImage },
  { name: 'DevOps', role: 'DevOps Engineer', imageUrl: devopsImage },
  { name: 'Full Stack', role: 'Full Stack Developer', imageUrl: fullstackImage },
  { name: 'AI Engineering', role: 'AI Engineer', imageUrl: aiEngineeringImage },
  { name: 'AI Data Scientist', role: 'Data Scientist', imageUrl: aiDatascientistImage },
  { name: 'Android', role: 'Android Developer', imageUrl: androidImage },
  { name: 'Cyber Security', role: 'Cybersecurity Analyst', imageUrl: cybersecurityImage },
  { name: 'Data Analyst', role: 'Data Analyst', imageUrl: dataanalystImage },
  { name: 'Game Developer', role: 'Game Developer', imageUrl: gamedevImage },
  { name: 'iOS', role: 'iOS Developer', imageUrl: iosImage },
  { name: 'UX Design', role: 'UX Designer', imageUrl: uxdesignImage },
];

/** Roles offered as one-click suggestions in the generator. */
export const ROLE_SUGGESTIONS = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'DevOps Engineer',
  'Data Analyst', 'Data Scientist', 'Machine Learning Engineer', 'AI Engineer',
  'Android Developer', 'iOS Developer', 'Cloud Engineer', 'Cybersecurity Analyst',
  'UX Designer', 'Game Developer', 'QA Automation Engineer', 'Product Manager',
];
