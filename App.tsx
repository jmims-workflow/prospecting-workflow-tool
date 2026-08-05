import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  ListOrdered, 
  Search, 
  Settings, 
  LogOut, 
  Plus, 
  Mail, 
  Linkedin, 
  Phone, 
  Trash2, 
  Edit, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Loader2,
  Sparkles,
  ExternalLink,
  Send,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';

import { auth, db } from './firebase';
import { Prospect, Sequence, Enrollment, StepType, ProspectStatus, SentEmail } from './types';
import { researchProspect, generateSequenceTemplate } from './lib/gemini';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const info = JSON.parse(this.state.error?.message || "{}");
        if (info.error) message = info.error;
      } catch (e) {
        message = this.state.error?.message || message;
      }

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-500 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Sidebar = ({ user }: { user: User }) => {
  const location = useLocation();
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Prospects', path: '/prospects', icon: Users },
    { name: 'Sequences', path: '/sequences', icon: ListOrdered },
    { name: 'Sent Emails', path: '/sent-emails', icon: Mail },
    { name: 'Research', path: '/research', icon: Search },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          Solo Outreach
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
            alt="Avatar" 
            className="w-8 h-8 rounded-full"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ prospects, sequences, enrollments, sentEmails, onExecute, onSkip }: { prospects: Prospect[], sequences: Sequence[], enrollments: Enrollment[], sentEmails: SentEmail[], onExecute: (id: string) => Promise<void>, onSkip: (id: string) => Promise<void> }) => {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  
  const stats = [
    { name: 'Total Prospects', value: prospects.length, icon: Users, color: 'bg-blue-500' },
    { name: 'Active Sequences', value: sequences.length, icon: ListOrdered, color: 'bg-indigo-500' },
    { name: 'Active/Scheduled', value: enrollments.filter(e => e.status === 'active' || e.status === 'scheduled').length, icon: Play, color: 'bg-green-500' },
    { name: 'Replies', value: prospects.filter(p => p.status === 'replied').length, icon: Mail, color: 'bg-pink-500' },
  ];

  const scheduledEnrollments = useMemo(() => {
    return enrollments
      .filter(e => e.status === 'scheduled')
      .sort((a, b) => new Date(a.nextActionAt).getTime() - new Date(b.nextActionAt).getTime());
  }, [enrollments]);

  const handleExecute = async (id: string) => {
    setExecutingId(id);
    try {
      await onExecute(id);
    } finally {
      setExecutingId(null);
    }
  };

  const handleSkip = async (id: string) => {
    if (confirm("Are you sure you want to skip this action?")) {
      setSkippingId(id);
      try {
        await onSkip(id);
      } finally {
        setSkippingId(null);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Overview of your outreach activity.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-lg text-white", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Recent Prospects</h3>
              <Link to="/prospects" className="text-sm text-indigo-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {prospects.slice(0, 5).map((prospect) => (
                <div key={prospect.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                      {prospect.firstName[0]}{prospect.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{prospect.firstName} {prospect.lastName}</p>
                      <p className="text-xs text-gray-500">{prospect.company}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    prospect.status === 'new' ? "bg-blue-100 text-blue-700" :
                    prospect.status === 'replied' ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {prospect.status}
                  </span>
                </div>
              ))}
              {prospects.length === 0 && (
                <div className="p-8 text-center text-gray-500">No prospects yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Upcoming Actions</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {scheduledEnrollments.slice(0, 5).map((enrollment) => {
                const prospect = prospects.find(p => p.id === enrollment.prospectId);
                const sequence = sequences.find(s => s.id === enrollment.sequenceId);
                const nextStep = sequence?.steps[enrollment.currentStepIndex];
                const isOverdue = new Date(enrollment.nextActionAt) < new Date();
                const daysOverdue = Math.floor((new Date().getTime() - new Date(enrollment.nextActionAt).getTime()) / 86400000);
                
                return (
                  <div key={enrollment.id} className={cn("p-4 flex items-center justify-between hover:bg-gray-50 transition-colors", isOverdue && "bg-amber-50/30")}>
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", nextStep?.type === 'email' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600")}>
                        {nextStep?.type === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {nextStep?.type === 'email' ? 'Send Email' : 'Make Call'} to {prospect?.firstName}
                        </p>
                        <p className={cn("text-xs", isOverdue ? "text-amber-600 font-medium" : "text-gray-500")}>
                          {isOverdue ? `Overdue by ${daysOverdue} days` : `Scheduled for ${format(new Date(enrollment.nextActionAt), 'MMM d, h:mm a')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleSkip(enrollment.id)}
                        disabled={skippingId === enrollment.id || executingId === enrollment.id}
                        className="text-xs font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        {skippingId === enrollment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Skip'}
                      </button>
                      <button 
                        onClick={() => handleExecute(enrollment.id)}
                        disabled={executingId === enrollment.id || skippingId === enrollment.id}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {executingId === enrollment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Execute Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {scheduledEnrollments.length === 0 && (
                <div className="p-8 text-center text-gray-500">No scheduled actions.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Last Sent Emails</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {sentEmails.slice(0, 5).map((email) => (
                <div key={email.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-gray-900">{email.prospectName}</p>
                    <p className="text-[10px] text-gray-400">{format(new Date(email.sentAt), 'MMM d, h:mm a')}</p>
                  </div>
                  <p className="text-xs font-medium text-indigo-600 mb-1">{email.subject}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{email.body}</p>
                </div>
              ))}
              {sentEmails.length === 0 && (
                <div className="p-8 text-center text-gray-500">No emails sent yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Active Sequences</h3>
              <Link to="/sequences" className="text-sm text-indigo-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {sequences.slice(0, 5).map((sequence) => (
                <div key={sequence.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sequence.name}</p>
                    <p className="text-xs text-gray-500">{sequence.steps.length} steps</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
              {sequences.length === 0 && (
                <div className="p-8 text-center text-gray-500">No sequences yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SentEmailsPage = ({ sentEmails }: { sentEmails: SentEmail[] }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Sent Emails</h2>
        <p className="text-gray-500">History of all outreach emails sent.</p>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {sentEmails.map((email) => (
            <div key={email.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-lg font-bold text-gray-900">{email.prospectName}</p>
                  <p className="text-sm font-medium text-indigo-600">{email.subject}</p>
                </div>
                <p className="text-xs text-gray-400">{format(new Date(email.sentAt), 'PPP p')}</p>
              </div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">
                {email.body}
              </div>
            </div>
          ))}
          {sentEmails.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No emails sent yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Prospects = ({ prospects, sequences, user }: { prospects: Prospect[], sequences: Sequence[], user: User }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<Prospect | null>(null);
  const [isEnrolling, setIsEnrolling] = useState<Prospect | null>(null);
  const [enrollmentData, setEnrollmentData] = useState({
    sequenceId: '',
    delayValue: 0,
    delayUnit: 'minutes' as 'minutes' | 'days'
  });
  const [newProspect, setNewProspect] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    linkedinUrl: ''
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'prospects';
    try {
      await addDoc(collection(db, path), {
        ...newProspect,
        userId: user.uid,
        status: 'new',
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewProspect({ firstName: '', lastName: '', email: '', company: '', title: '', linkedinUrl: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    const path = `prospects/${isEditing.id}`;
    try {
      await updateDoc(doc(db, 'prospects', isEditing.id), {
        firstName: isEditing.firstName,
        lastName: isEditing.lastName,
        email: isEditing.email,
        company: isEditing.company,
        title: isEditing.title,
        linkedinUrl: isEditing.linkedinUrl || '',
        userId: user.uid
      });
      setIsEditing(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEnrolling || !enrollmentData.sequenceId) return;

    const enrollmentPath = 'enrollments';
    const prospectPath = `prospects/${isEnrolling.id}`;
    try {
      const now = new Date();
      const scheduledAt = new Date(now.getTime() + 
        (enrollmentData.delayUnit === 'minutes' 
          ? enrollmentData.delayValue * 60000 
          : enrollmentData.delayValue * 86400000)
      );

      // Create enrollment
      await addDoc(collection(db, enrollmentPath), {
        userId: user.uid,
        prospectId: isEnrolling.id,
        sequenceId: enrollmentData.sequenceId,
        currentStepIndex: 0,
        status: 'scheduled',
        lastActionAt: now.toISOString(),
        nextActionAt: scheduledAt.toISOString(),
        scheduledAt: scheduledAt.toISOString()
      });

      // Update prospect status - include userId to satisfy rules if needed
      await updateDoc(doc(db, 'prospects', isEnrolling.id), {
        status: 'contacted',
        userId: user.uid
      });

      setIsEnrolling(null);
      setEnrollmentData({ sequenceId: '', delayValue: 0, delayUnit: 'minutes' });
    } catch (err) {
      // Determine which operation failed for better error reporting
      const isEnrollmentError = (err as any)?.message?.includes(enrollmentPath);
      handleFirestoreError(err, isEnrollmentError ? OperationType.CREATE : OperationType.UPDATE, isEnrollmentError ? enrollmentPath : prospectPath);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this prospect?")) {
      const path = `prospects/${id}`;
      try {
        await deleteDoc(doc(db, 'prospects', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
          <p className="text-gray-500">Manage your leads and research.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Prospect
        </button>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prospects.map((prospect) => (
              <tr key={prospect.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      {prospect.firstName[0]}{prospect.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{prospect.firstName} {prospect.lastName}</p>
                      <p className="text-xs text-gray-500">{prospect.title}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{prospect.company}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{prospect.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    prospect.status === 'new' ? "bg-blue-100 text-blue-700" :
                    prospect.status === 'replied' ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {prospect.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsEnrolling(prospect)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Enroll
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setIsEditing(prospect)}
                        className="p-2 text-gray-400 hover:text-indigo-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(prospect.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {prospects.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No prospects found. Add your first one to get started!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Add New Prospect</h3>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newProspect.firstName}
                      onChange={e => setNewProspect({...newProspect, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newProspect.lastName}
                      onChange={e => setNewProspect({...newProspect, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProspect.email}
                    onChange={e => setNewProspect({...newProspect, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Company</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProspect.company}
                    onChange={e => setNewProspect({...newProspect, company: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProspect.title}
                    onChange={e => setNewProspect({...newProspect, title: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Add Prospect
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Edit Prospect</h3>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={isEditing.firstName}
                      onChange={e => setIsEditing({...isEditing, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={isEditing.lastName}
                      onChange={e => setIsEditing({...isEditing, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={isEditing.email}
                    onChange={e => setIsEditing({...isEditing, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Company</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={isEditing.company}
                    onChange={e => setIsEditing({...isEditing, company: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={isEditing.title}
                    onChange={e => setIsEditing({...isEditing, title: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEnrolling && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Enroll in Sequence</h3>
                <p className="text-sm text-gray-500">Enrolling {isEnrolling.firstName} {isEnrolling.lastName}</p>
              </div>
              <form onSubmit={handleEnroll} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Sequence</label>
                  <select 
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={enrollmentData.sequenceId}
                    onChange={e => setEnrollmentData({...enrollmentData, sequenceId: e.target.value})}
                  >
                    <option value="">Choose a sequence...</option>
                    {sequences.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Delay</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      min="0"
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={enrollmentData.delayValue}
                      onChange={e => setEnrollmentData({...enrollmentData, delayValue: parseInt(e.target.value) || 0})}
                    />
                    <select 
                      className="w-32 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={enrollmentData.delayUnit}
                      onChange={e => setEnrollmentData({...enrollmentData, delayUnit: e.target.value as any})}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Set to 0 minutes to start immediately.</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEnrolling(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!enrollmentData.sequenceId}
                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Start Sequence
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sequences = ({ sequences, user }: { sequences: Sequence[], user: User }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingSequence, setViewingSequence] = useState<Sequence | null>(null);
  const [newSequence, setNewSequence] = useState({
    name: '',
    description: '',
    niche: '',
    goal: ''
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'sequences';
    try {
      await addDoc(collection(db, path), {
        name: newSequence.name,
        description: newSequence.description,
        userId: user.uid,
        steps: [],
        createdAt: new Date().toISOString()
      });
      setIsCreating(false);
      setNewSequence({ name: '', description: '', niche: '', goal: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleGenerate = async () => {
    if (!newSequence.niche || !newSequence.goal) return;
    setIsGenerating(true);
    const path = 'sequences';
    try {
      const steps = await generateSequenceTemplate(newSequence.niche, newSequence.goal);
      await addDoc(collection(db, path), {
        name: `AI Sequence: ${newSequence.niche}`,
        description: `Generated for: ${newSequence.goal}`,
        userId: user.uid,
        steps: steps,
        createdAt: new Date().toISOString()
      });
      setIsCreating(false);
      setNewSequence({ name: '', description: '', niche: '', goal: '' });
    } catch (err) {
      if (err instanceof Error && (err.message.includes("AI") || err.message.includes("parse") || err.message.includes("JSON"))) {
        console.error("AI Generation Error:", err);
        alert(`AI Generation Error: ${err.message}. Please try again with a simpler niche or goal.`);
      } else {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this sequence?")) {
      const path = `sequences/${id}`;
      try {
        await deleteDoc(doc(db, 'sequences', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sequences</h2>
          <p className="text-gray-500">Build and automate your outreach workflows.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Sequence
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sequences.map((sequence) => (
          <div key={sequence.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <ListOrdered className="w-6 h-6" />
              </div>
              <button 
                onClick={() => handleDelete(sequence.id)}
                className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{sequence.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{sequence.description}</p>
            <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sequence.steps.filter(s => s.type === 'email').length}</span>
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sequence.steps.filter(s => s.type === 'call').length}</span>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{sequence.steps.length} Steps</span>
            </div>
            <button 
              onClick={() => setViewingSequence(sequence)}
              className="w-full mt-6 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              View Steps
            </button>
          </div>
        ))}
        {sequences.length === 0 && (
          <div className="col-span-full p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Sparkles className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
            <p className="text-gray-500">No sequences yet. Use AI to generate one!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Create Sequence</h3>
                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <div className="p-6">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Manual Build
                  </h4>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newSequence.name}
                        onChange={e => setNewSequence({...newSequence, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                      <textarea 
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                        value={newSequence.description}
                        onChange={e => setNewSequence({...newSequence, description: e.target.value})}
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                    >
                      Create Blank
                    </button>
                  </form>
                </div>
                <div className="p-6 bg-indigo-50/50">
                  <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Generator (13 Steps)
                  </h4>
                  <div className="space-y-4">
                    <p className="text-xs text-indigo-600 italic">Generates a 13-step Email/Call sequence with A/B variants in Demand Gen style.</p>
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Niche/Industry</label>
                      <input 
                        type="text" 
                        placeholder="e.g. SaaS Founders, HR Managers"
                        className="w-full px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newSequence.niche}
                        onChange={e => setNewSequence({...newSequence, niche: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Goal</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Book a demo, Get a referral"
                        className="w-full px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newSequence.goal}
                        onChange={e => setNewSequence({...newSequence, goal: e.target.value})}
                      />
                    </div>
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !newSequence.niche || !newSequence.goal}
                      className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Generate with AI
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {viewingSequence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{viewingSequence.name}</h3>
                  <p className="text-sm text-gray-500">{viewingSequence.steps.length} Steps</p>
                </div>
                <button onClick={() => setViewingSequence(null)} className="text-gray-400 hover:text-gray-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {viewingSequence.steps.map((step, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-gray-900 uppercase text-xs tracking-widest">
                          {step.type} - Day {step.day}
                        </span>
                      </div>
                      {step.variantB && (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold uppercase">A/B Testing Enabled</span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Variant A</p>
                        {step.subject && <p className="text-sm font-bold text-gray-900">Subject: {step.subject}</p>}
                        <div className="bg-white p-4 rounded-lg border border-gray-100 text-sm text-gray-600 whitespace-pre-wrap">
                          {step.template}
                        </div>
                      </div>
                      {step.variantB && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase">Variant B</p>
                          {step.subjectB && <p className="text-sm font-bold text-gray-900">Subject: {step.subjectB}</p>}
                          <div className="bg-indigo-50/30 p-4 rounded-lg border border-indigo-100 text-sm text-gray-600 whitespace-pre-wrap">
                            {step.variantB}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Research = ({ prospects }: { prospects: Prospect[] }) => {
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const handleResearch = async () => {
    if (!selectedProspect) return;
    setIsResearching(true);
    const path = `prospects/${selectedProspect.id}`;
    try {
      const data = await researchProspect(selectedProspect);
      setResults(data || "No data found.");
      // Update prospect in DB with research data - include userId to satisfy rules
      await updateDoc(doc(db, 'prospects', selectedProspect.id), {
        researchData: data,
        userId: selectedProspect.userId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">AI Research</h2>
        <p className="text-gray-500">Deep dive into your prospects with Gemini.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select a Prospect</label>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {prospects.map((prospect) => (
              <button
                key={prospect.id}
                onClick={() => {
                  setSelectedProspect(prospect);
                  setResults(prospect.researchData || null);
                }}
                className={cn(
                  "w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-3",
                  selectedProspect?.id === prospect.id && "bg-indigo-50 border-l-4 border-indigo-600"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                  {prospect.firstName[0]}{prospect.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{prospect.firstName} {prospect.lastName}</p>
                  <p className="text-xs text-gray-500">{prospect.company}</p>
                </div>
              </button>
            ))}
            {prospects.length === 0 && (
              <div className="p-8 text-center text-gray-500">No prospects to research.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedProspect ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 h-full min-h-[600px] flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedProspect.firstName} {selectedProspect.lastName}</h3>
                  <p className="text-gray-500">{selectedProspect.title} at {selectedProspect.company}</p>
                </div>
                <button 
                  onClick={handleResearch}
                  disabled={isResearching}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isResearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {results ? 'Refresh Research' : 'Start Research'}
                </button>
              </div>

              <div className="flex-1 prose prose-indigo max-w-none">
                {isResearching ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <p className="animate-pulse">Gemini is researching {selectedProspect.firstName}...</p>
                  </div>
                ) : results ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{results}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                    <Search className="w-16 h-16 mb-4 opacity-20" />
                    <p>Click "Start Research" to generate AI insights for this prospect.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 h-full min-h-[600px] flex flex-col items-center justify-center text-gray-400">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a prospect from the list to begin research.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsPage = ({ googleAccessToken, setGoogleAccessToken, handleLogin }: { googleAccessToken: string | null, setGoogleAccessToken: (t: string | null) => void, handleLogin: () => Promise<void> }) => {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/config-status')
      .then(res => res.json())
      .then(data => setIsConfigured(data.resendConfigured))
      .catch(() => setIsConfigured(false));
  }, []);

  const [isTesting, setIsTesting] = useState(false);
  const [diagResult, setDiagResult] = useState<{ type: 'ping' | 'diag', status: 'success' | 'error', message: string } | null>(null);
  const [isDiagLoading, setIsDiagLoading] = useState(false);

  const runPing = async () => {
    setIsDiagLoading(true);
    try {
      const res = await fetch('/api/ping');
      const data = await res.json();
      setDiagResult({ type: 'ping', status: 'success', message: `Server is reachable! Time: ${data.time}` });
    } catch (err) {
      setDiagResult({ type: 'ping', status: 'error', message: `Ping failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsDiagLoading(false);
    }
  };

  const runDiag = async () => {
    setIsDiagLoading(true);
    try {
      const res = await fetch('/api/diag');
      const data = await res.json();
      if (data.status === 'ok') {
        setDiagResult({ 
          type: 'diag', 
          status: 'success', 
          message: `Firestore Connected! Project: ${data.projectId}, Database: ${data.databaseId}. Collections: ${data.collections.join(', ') || 'none'}` 
        });
      } else {
        setDiagResult({ type: 'diag', status: 'error', message: `Firestore Error: ${data.message} (${data.code || 'no code'})` });
      }
    } catch (err) {
      setDiagResult({ type: 'diag', status: 'error', message: `Diagnostic failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsDiagLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!googleAccessToken) return;
    setIsTesting(true);
    try {
      const response = await fetch('/api/test-gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleAccessToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        // Check if it's a "Gmail API not enabled" error and show a better message
        if (data.error && data.error.includes('Gmail API is not enabled')) {
          const url = data.error.split('here: ')[1];
          if (confirm(`Gmail API is not enabled in your Google Cloud project. Would you like to open the Google Cloud Console to enable it?`)) {
            window.open(url, '_blank');
          }
          return;
        }
        throw new Error(data.error || 'Test failed');
      }
      alert('Test email sent successfully to yourself!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500">Configure your outreach integrations.</p>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Email Provider (Resend)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            To send real emails, you need to add your Resend API Key to the application secrets in the AI Studio settings menu.
          </p>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <p className="text-xs font-medium text-indigo-700 mb-2">How to configure:</p>
            <ol className="text-xs text-indigo-600 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline">resend.com</a> and get an API Key.</li>
              <li>Open the <b>Settings</b> menu in AI Studio (top right).</li>
              <li>Add a new secret named <code>RESEND_API_KEY</code> with your key.</li>
              <li>Restart the application.</li>
            </ol>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-600" />
            Gmail Integration (Test Mode)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            If you don't have a custom domain, you can send emails directly from your Gmail account.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className={cn("w-2 h-2 rounded-full", googleAccessToken ? "bg-green-500" : "bg-gray-300")} />
                <span className="text-gray-600">
                  {googleAccessToken ? "Gmail Connected" : "Gmail Not Connected"}
                </span>
              </div>
              <button 
                onClick={handleLogin}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                {googleAccessToken ? "Reconnect Gmail" : "Connect Gmail"}
              </button>
              {googleAccessToken && (
                <button 
                  onClick={() => {
                    setGoogleAccessToken(null);
                    localStorage.removeItem('google_access_token');
                  }}
                  className="text-xs font-bold text-red-600 hover:underline ml-4"
                >
                  Disconnect
                </button>
              )}
            </div>
            
            {googleAccessToken && (
              <button
                onClick={handleTestEmail}
                disabled={isTesting}
                className="w-full py-2 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test Email to Myself
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic">
            Note: This uses your current login session. You may need to grant "Send email on your behalf" permission.
          </p>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Troubleshooting
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            If you're seeing "Permission Denied" errors, use these tools to check the backend connection.
          </p>
          <div className="space-y-2">
            <button
              onClick={runPing}
              disabled={isDiagLoading}
              className="w-full py-2 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDiagLoading && diagResult?.type === 'ping' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              Test Server Reachability (Ping)
            </button>
            <button
              onClick={runDiag}
              disabled={isDiagLoading}
              className="w-full py-2 px-4 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDiagLoading && diagResult?.type === 'diag' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Check Backend Connection Status (Diag)
            </button>
          </div>

          {diagResult && (
            <div className={cn(
              "mt-4 p-3 rounded-lg text-xs font-mono break-all",
              diagResult.status === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
            )}>
              <div className="font-bold mb-1 uppercase flex items-center justify-between">
                <span>{diagResult.type} Result:</span>
                <button onClick={() => setDiagResult(null)} className="hover:underline">Clear</button>
              </div>
              {diagResult.message}
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2">Email Sending Status</h3>
          <div className="flex items-center gap-2 text-sm">
            <div className={cn("w-2 h-2 rounded-full", (isConfigured === true || googleAccessToken) ? "bg-green-500" : isConfigured === false ? "bg-red-500" : "bg-gray-300")} />
            <span className="text-gray-600">
              {(isConfigured === true || googleAccessToken) ? "Ready to Send" : "Provider Missing"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));

  const handleExecuteAction = async (enrollmentId: string) => {
    if (!user) return;
    console.log('Executing action for enrollment (Client-Side Logic):', enrollmentId);
    
    try {
      // 1. Fetch enrollment data from Firestore (Client has access)
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      const enrollmentDoc = await getDoc(enrollmentRef);
      if (!enrollmentDoc.exists()) throw new Error('Enrollment not found');
      const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as Enrollment;

      // 2. Fetch sequence and prospect data
      const sequenceDoc = await getDoc(doc(db, 'sequences', enrollment.sequenceId));
      const prospectDoc = await getDoc(doc(db, 'prospects', enrollment.prospectId));

      if (!sequenceDoc.exists() || !prospectDoc.exists()) {
        throw new Error('Sequence or Prospect not found');
      }

      const sequence = { id: sequenceDoc.id, ...sequenceDoc.data() } as Sequence;
      const prospect = { id: prospectDoc.id, ...prospectDoc.data() } as Prospect;
      
      if (!sequence.steps || sequence.steps.length === 0) {
        throw new Error('Sequence has no steps');
      }

      const currentStep = sequence.steps[enrollment.currentStepIndex];
      if (!currentStep) throw new Error('Current step not found in sequence');

      // 3. Handle Action based on type
      if (currentStep.type === 'email') {
        const useVariantB = !!(currentStep.variantB && Math.random() > 0.5);
        const subject = useVariantB ? (currentStep.subjectB || currentStep.subject) : currentStep.subject;
        const bodyTemplate = useVariantB ? currentStep.variantB : currentStep.template;

        if (!bodyTemplate) throw new Error('Email template is missing');

        const personalizedBody = String(bodyTemplate)
          .replace(/{{firstName}}/g, prospect.firstName || '')
          .replace(/{{lastName}}/g, prospect.lastName || '')
          .replace(/{{company}}/g, prospect.company || '');

        // Call backend to send email
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            to: prospect.email,
            subject: subject || 'Outreach',
            body: personalizedBody,
            googleAccessToken: googleAccessToken 
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMsg = error.error || 'Failed to send email';
          if (errorMsg.includes('Reconnect Gmail')) {
            setGoogleAccessToken(null);
            localStorage.removeItem('google_access_token');
            if (confirm('Your Gmail session has expired. Would you like to reconnect now?')) {
              await handleLogin();
              return;
            }
          }
          throw new Error(errorMsg);
        }

        // Save record of sent email
        await addDoc(collection(db, 'sent_emails'), {
          userId: user.uid,
          prospectId: prospect.id,
          prospectName: `${prospect.firstName} ${prospect.lastName}`,
          subject: subject || 'Outreach',
          body: personalizedBody,
          sentAt: new Date().toISOString()
        });
      } else if (currentStep.type === 'call') {
        // Mechanism to call prospect
        const confirmCall = confirm(`Call ${prospect.firstName} ${prospect.lastName} at ${prospect.company}?\n\nNotes: ${currentStep.template}\n\nClick OK once you have completed the call.`);
        if (!confirmCall) return;
      }

      // 4. Update enrollment for next step
      await moveToNextStep(enrollmentId, enrollment, sequence, currentStep);

      console.log('Action executed and enrollment updated successfully');
    } catch (err) {
      console.error('Execution handler error:', err);
      alert(err instanceof Error ? err.message : 'Failed to execute action');
    }
  };

  const moveToNextStep = async (enrollmentId: string, enrollment: Enrollment, sequence: Sequence, currentStep: any) => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    const nextStepIndex = enrollment.currentStepIndex + 1;
    const isCompleted = nextStepIndex >= sequence.steps.length;
    
    const nextStep = sequence.steps[nextStepIndex];
    let nextActionAt = null;
    if (nextStep && currentStep) {
      const dayDiff = (nextStep.day || 0) - (currentStep.day || 0);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + Math.max(0, dayDiff));
      nextActionAt = nextDate.toISOString();
    }

    await updateDoc(enrollmentRef, {
      currentStepIndex: nextStepIndex,
      status: isCompleted ? 'completed' : 'scheduled',
      lastActionAt: new Date().toISOString(),
      nextActionAt: nextActionAt,
      userId: user!.uid
    });
  };

  const handleSkipAction = async (enrollmentId: string) => {
    if (!user) return;
    try {
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      const enrollmentDoc = await getDoc(enrollmentRef);
      if (!enrollmentDoc.exists()) throw new Error('Enrollment not found');
      const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as Enrollment;

      const sequenceDoc = await getDoc(doc(db, 'sequences', enrollment.sequenceId));
      if (!sequenceDoc.exists()) throw new Error('Sequence not found');
      const sequence = { id: sequenceDoc.id, ...sequenceDoc.data() } as Sequence;

      const currentStep = sequence.steps[enrollment.currentStepIndex];
      
      await moveToNextStep(enrollmentId, enrollment, sequence, currentStep);
      console.log('Action skipped successfully');
    } catch (err) {
      console.error('Skip handler error:', err);
      alert(err instanceof Error ? err.message : 'Failed to skip action');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const qP = query(collection(db, 'prospects'), where('userId', '==', user.uid));
    const unsubP = onSnapshot(qP, (snap) => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'prospects'));

    const qS = query(collection(db, 'sequences'), where('userId', '==', user.uid));
    const unsubS = onSnapshot(qS, (snap) => {
      setSequences(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sequence)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sequences'));

    const qE = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
    const unsubE = onSnapshot(qE, (snap) => {
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments'));

    const qSE = query(collection(db, 'sent_emails'), where('userId', '==', user.uid));
    const unsubSE = onSnapshot(qSE, (snap) => {
      const emails = snap.docs.map(d => ({ id: d.id, ...d.data() } as SentEmail)).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      console.log('Sent emails updated:', emails.length, 'emails found');
      setSentEmails(emails);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sent_emails'));

    return () => {
      unsubP();
      unsubS();
      unsubE();
      unsubSE();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.setCustomParameters({ prompt: 'consent' });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem('google_access_token', token);
      }

      // Ensure user doc exists
      const userPath = `users/${result.user.uid}`;
      try {
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', result.user.uid), {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            role: 'user',
            createdAt: new Date().toISOString()
          });
        }
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, userPath);
      }
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-200">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Solo Outreach</h1>
          <p className="text-gray-500 mb-8">Your personal AI-powered sales sequencing assistant. Research, build, and automate.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <Sidebar user={user} />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard prospects={prospects} sequences={sequences} enrollments={enrollments} sentEmails={sentEmails} onExecute={handleExecuteAction} onSkip={handleSkipAction} />} />
              <Route path="/prospects" element={<Prospects prospects={prospects} sequences={sequences} user={user} />} />
              <Route path="/sequences" element={<Sequences sequences={sequences} user={user} />} />
              <Route path="/sent-emails" element={<SentEmailsPage sentEmails={sentEmails} />} />
              <Route path="/research" element={<Research prospects={prospects} />} />
              <Route path="/settings" element={<SettingsPage googleAccessToken={googleAccessToken} setGoogleAccessToken={setGoogleAccessToken} handleLogin={handleLogin} />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
