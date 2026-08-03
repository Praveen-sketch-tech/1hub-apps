export interface Experience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
  score: string;
}

export interface Project {
  id: string;
  title: string;
  techStack: string;
  link: string;
  description: string;
}

export interface ResumeData {
  personal: {
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    github: string;
    summary: string;
  };
  experiences: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
}

export interface StyleConfig {
  themeColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  template: 'classic' | 'modern' | 'minimal';
}