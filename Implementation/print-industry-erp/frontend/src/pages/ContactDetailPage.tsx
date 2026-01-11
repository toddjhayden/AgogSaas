import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Star,
  Edit,
  Trash2,
  Plus,
  Activity,
  CheckCircle,
  Tag,
  Globe,
  Linkedin,
  Twitter,
  PhoneCall,
  Video,
  MessageSquare
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuthStore } from '../store/authStore';
import {
  GET_CONTACT,
  GET_ACTIVITIES_BY_CONTACT,
  GET_NOTES_BY_CONTACT,
  DELETE_CONTACT,
  CREATE_ACTIVITY,
  CREATE_NOTE,
  TOGGLE_PIN_NOTE,
  DELETE_NOTE
} from '../graphql/queries/crm';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  phoneOffice?: string;
  phoneMobile?: string;
  phoneHome?: string;
  jobTitle?: string;
  department?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  contactType?: string;
  leadSource?: string;
  industry?: string;
  companySize?: string;
  interests?: string[];
  painPoints?: string[];
  buyingAuthority?: string;
  lastContactDate?: string;
  lastContactType?: string;
  nextFollowUpDate?: string;
  engagementScore?: number;
  isActive: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
  notes?: string;
  createdAt: string;
}

interface Activity {
  id: string;
  activityType: string;
  activitySubject: string;
  activityDescription?: string;
  activityDate: string;
  durationMinutes?: number;
  outcome?: string;
  nextSteps?: string;
  isCompleted: boolean;
  createdAt: string;
}

interface Note {
  id: string;
  noteTitle?: string;
  noteContent: string;
  noteType?: string;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
}

export const ContactDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state: { user: { id?: string } | null }) => state.user);

  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes'>('overview');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [activityFormData, setActivityFormData] = useState({
    activityType: 'CALL',
    activitySubject: '',
    activityDescription: '',
    activityDate: new Date().toISOString().split('T')[0],
    durationMinutes: ''
  });

  const [noteFormData, setNoteFormData] = useState({
    noteTitle: '',
    noteContent: '',
    noteType: 'GENERAL',
    isPinned: false
  });

  // Query contact details
  const { data: contactData, loading: contactLoading, refetch: _refetchContact } = useQuery(GET_CONTACT, {
    variables: { id },
    skip: !id
  });

  // Query activities
  const { data: activitiesData, refetch: refetchActivities } = useQuery(GET_ACTIVITIES_BY_CONTACT, {
    variables: { contactId: id },
    skip: !id
  });

  // Query notes
  const { data: notesData, refetch: refetchNotes } = useQuery(GET_NOTES_BY_CONTACT, {
    variables: { contactId: id },
    skip: !id
  });

  const [deleteContact] = useMutation(DELETE_CONTACT, {
    onCompleted: () => {
      navigate('/crm/contacts');
    },
    onError: (error) => {
      toast.error(t('Failed to delete contact: ') + error.message);
    }
  });

  const [createActivity] = useMutation(CREATE_ACTIVITY, {
    onCompleted: () => {
      refetchActivities();
      setShowActivityModal(false);
      resetActivityForm();
    },
    onError: (error) => {
      toast.error(t('Failed to create activity: ') + error.message);
    }
  });

  const [createNote] = useMutation(CREATE_NOTE, {
    onCompleted: () => {
      refetchNotes();
      setShowNoteModal(false);
      resetNoteForm();
    },
    onError: (error) => {
      toast.error(t('Failed to create note: ') + error.message);
    }
  });

  const [togglePinNote] = useMutation(TOGGLE_PIN_NOTE, {
    onCompleted: () => {
      refetchNotes();
    }
  });

  const [deleteNote] = useMutation(DELETE_NOTE, {
    onCompleted: () => {
      refetchNotes();
    }
  });

  const contact: Contact | null = contactData?.getContact || null;
  const activities: Activity[] = activitiesData?.getActivitiesByContact || [];
  const notes: Note[] = notesData?.getNotesByContact || [];

  const resetActivityForm = () => {
    setActivityFormData({
      activityType: 'CALL',
      activitySubject: '',
      activityDescription: '',
      activityDate: new Date().toISOString().split('T')[0],
      durationMinutes: ''
    });
  };

  const resetNoteForm = () => {
    setNoteFormData({
      noteTitle: '',
      noteContent: '',
      noteType: 'GENERAL',
      isPinned: false
    });
  };

  const handleDeleteContact = async () => {
    if (!confirm(t('Are you sure you want to delete this contact?'))) {
      return;
    }
    await deleteContact({ variables: { id } });
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    await createActivity({
      variables: {
        input: {
          ...activityFormData,
          contactId: id,
          durationMinutes: activityFormData.durationMinutes ? parseInt(activityFormData.durationMinutes) : undefined,
          ownerUserId: user?.id
        }
      }
    });
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNote({
      variables: {
        input: {
          ...noteFormData,
          contactId: id
        }
      }
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'call':
        return <PhoneCall className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'meeting':
        return <Video className="w-4 h-4" />;
      case 'note':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (contactLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-8 text-center text-gray-500">{t('Loading contact...')}</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-8 text-center text-red-600">{t('Contact not found')}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <Breadcrumb
        items={[
          { label: t('CRM'), path: '/crm' },
          { label: t('Contacts'), path: '/crm/contacts' },
          { label: `${contact.firstName} ${contact.lastName}`, path: `/crm/contacts/${id}` }
        ]}
      />

      <div className="p-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <User className="w-8 h-8 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {contact.firstName} {contact.middleName} {contact.lastName}
                </h1>
                {contact.jobTitle && (
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                    {contact.jobTitle} {contact.department && `• ${contact.department}`}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  {contact.contactType && (
                    <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                      {contact.contactType}
                    </span>
                  )}
                  {contact.leadSource && (
                    <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                      {contact.leadSource}
                    </span>
                  )}
                  {contact.engagementScore !== undefined && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                      <Star className="w-3 h-3" />
                      {t('Engagement')}: {contact.engagementScore}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/crm/contacts/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Edit className="w-4 h-4" />
                {t('Edit')}
              </button>
              <button
                onClick={handleDeleteContact}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900"
              >
                <Trash2 className="w-4 h-4" />
                {t('Delete')}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Overview')}
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'activities'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Activities')} ({activities.length})
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Notes')} ({notes.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('Contact Information')}
                  </h3>
                  <div className="space-y-3">
                    {contact.emailPrimary && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <a href={`mailto:${contact.emailPrimary}`} className="text-blue-600 hover:underline">
                          {contact.emailPrimary}
                        </a>
                      </div>
                    )}
                    {contact.emailSecondary && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <a href={`mailto:${contact.emailSecondary}`} className="text-blue-600 hover:underline">
                          {contact.emailSecondary}
                        </a>
                      </div>
                    )}
                    {contact.phoneMobile && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <a href={`tel:${contact.phoneMobile}`} className="text-blue-600 hover:underline">
                          {contact.phoneMobile}
                        </a>
                      </div>
                    )}
                    {contact.phoneOffice && (
                      <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-gray-400" />
                        <a href={`tel:${contact.phoneOffice}`} className="text-blue-600 hover:underline">
                          {contact.phoneOffice}
                        </a>
                      </div>
                    )}
                    {contact.phoneHome && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <a href={`tel:${contact.phoneHome}`} className="text-blue-600 hover:underline">
                          {contact.phoneHome}
                        </a>
                      </div>
                    )}
                    {(contact.addressLine1 || contact.city) && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                          {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                          {(contact.city || contact.state || contact.postalCode) && (
                            <div>
                              {contact.city}, {contact.state} {contact.postalCode}
                            </div>
                          )}
                          {contact.country && <div>{contact.country}</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-4">
                    {t('Social & Web')}
                  </h3>
                  <div className="space-y-3">
                    {contact.linkedinUrl && (
                      <div className="flex items-center gap-3">
                        <Linkedin className="w-5 h-5 text-gray-400" />
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {contact.twitterHandle && (
                      <div className="flex items-center gap-3">
                        <Twitter className="w-5 h-5 text-gray-400" />
                        <a href={`https://twitter.com/${contact.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          @{contact.twitterHandle}
                        </a>
                      </div>
                    )}
                    {contact.websiteUrl && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {contact.websiteUrl}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('Additional Details')}
                  </h3>
                  <div className="space-y-3">
                    {contact.industry && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Industry')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{contact.industry}</span>
                      </div>
                    )}
                    {contact.companySize && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Company Size')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{contact.companySize}</span>
                      </div>
                    )}
                    {contact.buyingAuthority && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Buying Authority')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{contact.buyingAuthority}</span>
                      </div>
                    )}
                    {contact.nextFollowUpDate && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{t('Next Follow-up')}:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{formatDate(contact.nextFollowUpDate)}</span>
                        </div>
                      </div>
                    )}
                    {contact.lastContactDate && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Last Contact')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {formatDate(contact.lastContactDate)}
                          {contact.lastContactType && ` (${contact.lastContactType})`}
                        </span>
                      </div>
                    )}
                  </div>

                  {contact.interests && contact.interests.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Interests')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {contact.interests.map((interest, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Tag className="w-3 h-3" />
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {contact.painPoints && contact.painPoints.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Pain Points')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {contact.painPoints.map((pain, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {pain}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {contact.notes && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Notes')}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{contact.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activities Tab */}
            {activeTab === 'activities' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('Activity Timeline')}
                  </h3>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Log Activity')}
                  </button>
                </div>

                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('No activities recorded')}</div>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="border-l-4 border-blue-600 bg-gray-50 dark:bg-gray-700 rounded-r-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${activity.isCompleted ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                              {getActivityIcon(activity.activityType)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {activity.activitySubject}
                                </span>
                                {activity.isCompleted && (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {activity.activityType} • {formatDateTime(activity.activityDate)}
                                {activity.durationMinutes && ` • ${activity.durationMinutes} min`}
                              </div>
                              {activity.activityDescription && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  {activity.activityDescription}
                                </p>
                              )}
                              {activity.outcome && (
                                <div className="mt-2 text-sm">
                                  <span className="font-medium text-gray-900 dark:text-white">{t('Outcome')}:</span>
                                  <span className="ml-2 text-gray-600 dark:text-gray-400">{activity.outcome}</span>
                                </div>
                              )}
                              {activity.nextSteps && (
                                <div className="mt-1 text-sm">
                                  <span className="font-medium text-gray-900 dark:text-white">{t('Next Steps')}:</span>
                                  <span className="ml-2 text-gray-600 dark:text-gray-400">{activity.nextSteps}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('Notes')}
                  </h3>
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Note')}
                  </button>
                </div>

                <div className="space-y-4">
                  {notes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('No notes added')}</div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {note.noteTitle && (
                              <h4 className="font-medium text-gray-900 dark:text-white">{note.noteTitle}</h4>
                            )}
                            {note.isPinned && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                            {note.noteType && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                {note.noteType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePinNote({ variables: { id: note.id } })}
                              className="p-1 text-gray-600 hover:text-yellow-600"
                            >
                              <Star className={`w-4 h-4 ${note.isPinned ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t('Delete this note?'))) {
                                  deleteNote({ variables: { id: note.id } });
                                }
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{note.noteContent}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          {formatDateTime(note.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('Log Activity')}
              </h2>
            </div>

            <form onSubmit={handleCreateActivity} className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Activity Type')} *
                  </label>
                  <select
                    required
                    value={activityFormData.activityType}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activityType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="NOTE">Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Subject')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={activityFormData.activitySubject}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activitySubject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Description')}
                  </label>
                  <textarea
                    rows={3}
                    value={activityFormData.activityDescription}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activityDescription: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Date')} *
                    </label>
                    <input
                      type="date"
                      required
                      value={activityFormData.activityDate}
                      onChange={(e) => setActivityFormData({ ...activityFormData, activityDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Duration (minutes)')}
                    </label>
                    <input
                      type="number"
                      value={activityFormData.durationMinutes}
                      onChange={(e) => setActivityFormData({ ...activityFormData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowActivityModal(false);
                    resetActivityForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('Log Activity')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('Add Note')}
              </h2>
            </div>

            <form onSubmit={handleCreateNote} className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Title')}
                  </label>
                  <input
                    type="text"
                    value={noteFormData.noteTitle}
                    onChange={(e) => setNoteFormData({ ...noteFormData, noteTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Note')} *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={noteFormData.noteContent}
                    onChange={(e) => setNoteFormData({ ...noteFormData, noteContent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Type')}
                    </label>
                    <select
                      value={noteFormData.noteType}
                      onChange={(e) => setNoteFormData({ ...noteFormData, noteType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="GENERAL">General</option>
                      <option value="MEETING">Meeting</option>
                      <option value="FOLLOW_UP">Follow-up</option>
                      <option value="INTERNAL">Internal</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={noteFormData.isPinned}
                        onChange={(e) => setNoteFormData({ ...noteFormData, isPinned: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('Pin this note')}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteModal(false);
                    resetNoteForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('Add Note')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
