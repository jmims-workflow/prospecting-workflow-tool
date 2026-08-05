export type ProspectStatus = 'new' | 'contacted' | 'replied' | 'bounced' | 'unsubscribed';
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'replied' | 'scheduled';
export type StepType = 'email' | 'call';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Prospect {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  linkedinUrl?: string;
  status: ProspectStatus;
  researchData?: string;
  createdAt: string;
}

export interface SequenceStep {
  type: StepType;
  day: number;
  subject?: string;
  template: string;
  variantB?: string;
  subjectB?: string;
}

export interface Sequence {
  id: string;
  userId: string;
  name: string;
  description: string;
  steps: SequenceStep[];
  createdAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  prospectId: string;
  sequenceId: string;
  currentStepIndex: number;
  status: EnrollmentStatus;
  lastActionAt: string;
  nextActionAt: string;
  scheduledAt?: string;
}

export interface SentEmail {
  id: string;
  userId: string;
  prospectId: string;
  prospectName: string;
  subject: string;
  body: string;
  sentAt: string;
}
