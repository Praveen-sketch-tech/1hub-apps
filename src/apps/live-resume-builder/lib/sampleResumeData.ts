import { ResumeData } from '../types/resume';

export const sampleResumeData: ResumeData = {
  personal: {
    fullName: 'Praveen Sharma',
    jobTitle: 'Senior Credit & Risk Operations Analyst',
    email: 'praveen.sharma@example.com',
    phone: '+91 98765 43210',
    location: 'Madhya Pradesh, India',
    website: 'https://praveenportfolio.dev',
    linkedin: 'linkedin.com/in/praveen-sharma',
    github: 'github.com/praveen-dev',
    summary: 'Results-driven Credit Specialist with over 5 years of experience in loan appraisal, risk management, asset verification, and portfolio analysis. Adept at automation and technical workflow optimization.'
  },
  experiences: [
    {
      id: '1',
      company: 'Hinduja Housing Finance',
      role: 'Credit Manager',
      startDate: '2024-01',
      endDate: 'Present',
      location: 'Mandsaur, MP',
      description: 'Managed home loan & LAP underwriting portfolios. Streamlined verification pipelines and reduced loan processing TAT by 25%.'
    },
    {
      id: '2',
      company: 'Kotak Mahindra Bank',
      role: 'Assistant Credit Manager',
      startDate: '2022-03',
      endDate: '2023-12',
      location: 'Indore, MP',
      description: 'Evaluated retail borrower profiles, financial statements, and property title search reports for secured lending products.'
    }
  ],
  education: [
    {
      id: '1',
      institution: 'Vikram University',
      degree: 'Bachelor of Commerce (B.Com - Finance)',
      startDate: '2016',
      endDate: '2019',
      score: 'First Division'
    }
  ],
  skills: ['Credit Operations', 'Risk Assessment', 'Underwriting', 'Financial Analysis', 'React.js', 'Pine Script', 'Data Analysis'],
  projects: [
    {
      id: '1',
      title: 'Malwa Loan Hub Lead Automation',
      techStack: 'React, Node.js, Supabase',
      link: 'https://malwaloanhub.com',
      description: 'Built a localized DSA lead generation and eligibility calculator web app for regional banking operations.'
    }
  ]
};