import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  Star,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import {
  GET_CONTACTS_BY_OWNER,
  SEARCH_CONTACTS,
  CREATE_CONTACT,
  UPDATE_CONTACT,
  DELETE_CONTACT
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
  jobTitle?: string;
  department?: string;
  customerId?: string;
  contactType?: string;
  leadSource?: string;
  nextFollowUpDate?: string;
  lastContactDate?: string;
  engagementScore?: number;
  isActive: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
  notes?: string;
  createdAt: string;
}

export const ContactManagementPage: React.FC = () => {
  const { t } = useTranslation();
  useNavigate(); // Navigation hook available
  const user = useAuthStore((state: { user: { id?: string } | null }) => state.user);

  const [filters, setFilters] = useState({
    searchTerm: '',
    contactType: '',
    leadSource: '',
    isActive: true
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    emailPrimary: '',
    phoneMobile: '',
    jobTitle: '',
    department: '',
    contactType: 'LEAD',
    leadSource: '',
    notes: ''
  });

  // Query contacts by owner
  const { data, loading, error, refetch } = useQuery(GET_CONTACTS_BY_OWNER, {
    variables: { ownerUserId: user?.id },
    skip: !user?.id
  });

  // Search contacts query (triggered separately)
  const { data: searchData, refetch: _searchContacts } = useQuery(SEARCH_CONTACTS, {
    variables: { searchTerm: filters.searchTerm },
    skip: !filters.searchTerm || filters.searchTerm.length < 2
  });

  const [createContact] = useMutation(CREATE_CONTACT, {
    onCompleted: () => {
      refetch();
      setShowCreateModal(false);
      resetForm();
      toast.success(t('Contact created successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to create contact: ') + error.message);
    }
  });

  const [updateContact] = useMutation(UPDATE_CONTACT, {
    onCompleted: () => {
      refetch();
      setSelectedContact(null);
      resetForm();
      toast.success(t('Contact updated successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to update contact: ') + error.message);
    }
  });

  const [deleteContact] = useMutation(DELETE_CONTACT, {
    onCompleted: () => {
      refetch();
      toast.success(t('Contact deleted successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to delete contact: ') + error.message);
    }
  });

  const contacts: Contact[] = filters.searchTerm
    ? (searchData?.searchContacts || [])
    : (data?.getContactsByOwner || []);

  const filteredContacts = contacts.filter((contact) => {
    if (filters.contactType && contact.contactType !== filters.contactType) return false;
    if (filters.leadSource && contact.leadSource !== filters.leadSource) return false;
    if (contact.isActive !== filters.isActive) return false;
    return true;
  });

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      emailPrimary: '',
      phoneMobile: '',
      jobTitle: '',
      department: '',
      contactType: 'LEAD',
      leadSource: '',
      notes: ''
    });
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    await createContact({
      variables: {
        input: {
          ...formData,
          ownerUserId: user?.id
        }
      }
    });
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;

    await updateContact({
      variables: {
        input: {
          id: selectedContact.id,
          ...formData
        }
      }
    });
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm(t('Are you sure you want to delete this contact?'))) {
      return;
    }

    await deleteContact({ variables: { id: contactId } });
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      emailPrimary: contact.emailPrimary || '',
      phoneMobile: contact.phoneMobile || '',
      jobTitle: contact.jobTitle || '',
      department: contact.department || '',
      contactType: contact.contactType || 'LEAD',
      leadSource: contact.leadSource || '',
      notes: contact.notes || ''
    });
    setShowCreateModal(true);
  };

  const getEngagementBadge = (score?: number) => {
    if (!score) return null;

    let color = 'bg-gray-100 text-gray-700';
    let label = 'Low';

    if (score >= 80) {
      color = 'bg-green-100 text-green-700';
      label = 'High';
    } else if (score >= 50) {
      color = 'bg-yellow-100 text-yellow-700';
      label = 'Medium';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Star className="w-3 h-3" />
        {label} ({score})
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isFollowUpOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const columns = [
    {
      header: t('Name'),
      accessor: (contact: Contact) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {contact.firstName} {contact.lastName}
          </div>
          {contact.jobTitle && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {contact.jobTitle}
            </div>
          )}
        </div>
      )
    },
    {
      header: t('Contact Info'),
      accessor: (contact: Contact) => (
        <div className="text-sm">
          {contact.emailPrimary && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Mail className="w-3 h-3" />
              {contact.emailPrimary}
            </div>
          )}
          {contact.phoneMobile && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mt-1">
              <Phone className="w-3 h-3" />
              {contact.phoneMobile}
            </div>
          )}
        </div>
      )
    },
    {
      header: t('Type'),
      accessor: (contact: Contact) => (
        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          {contact.contactType || 'N/A'}
        </span>
      )
    },
    {
      header: t('Engagement'),
      accessor: (contact: Contact) => getEngagementBadge(contact.engagementScore)
    },
    {
      header: t('Follow-up'),
      accessor: (contact: Contact) => (
        <div className="text-sm">
          {contact.nextFollowUpDate ? (
            <div className={`flex items-center gap-1 ${isFollowUpOverdue(contact.nextFollowUpDate) ? 'text-red-600' : 'text-gray-600'}`}>
              <Calendar className="w-3 h-3" />
              {formatDate(contact.nextFollowUpDate)}
            </div>
          ) : (
            <span className="text-gray-400">No follow-up</span>
          )}
        </div>
      )
    },
    {
      header: t('Status'),
      accessor: (contact: Contact) => (
        <div className="flex items-center gap-2">
          {contact.isActive ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-400" />
          )}
          {contact.doNotContact && (
            <span title={t('Do Not Contact')}><AlertCircle className="w-4 h-4 text-red-600" /></span>
          )}
          {contact.emailOptOut && (
            <span title={t('Email Opt-out')}><Mail className="w-4 h-4 text-orange-600" /></span>
          )}
        </div>
      )
    },
    {
      header: t('Actions'),
      accessor: (contact: Contact) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEditContact(contact)}
            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
            title={t('Edit')}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteContact(contact.id)}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
            title={t('Delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 overflow-auto">
      <Breadcrumb
        items={[
          { label: t('CRM'), path: '/crm' },
          { label: t('Contacts'), path: '/crm/contacts' }
        ]}
      />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('Contact Management')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('Manage your business contacts and leads')}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setSelectedContact(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            {t('Add Contact')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('Search contacts...')}
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="w-5 h-5" />
              {t('Filters')}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('Contact Type')}
                </label>
                <select
                  value={filters.contactType}
                  onChange={(e) => setFilters({ ...filters, contactType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">{t('All Types')}</option>
                  <option value="LEAD">Lead</option>
                  <option value="PROSPECT">Prospect</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="PARTNER">Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('Lead Source')}
                </label>
                <select
                  value={filters.leadSource}
                  onChange={(e) => setFilters({ ...filters, leadSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">{t('All Sources')}</option>
                  <option value="WEBSITE">Website</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="COLD_CALL">Cold Call</option>
                  <option value="TRADE_SHOW">Trade Show</option>
                  <option value="SOCIAL_MEDIA">Social Media</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('Status')}
                </label>
                <select
                  value={filters.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFilters({ ...filters, isActive: e.target.value === 'active' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="active">{t('Active')}</option>
                  <option value="inactive">{t('Inactive')}</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Contacts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">{t('Loading contacts...')}</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{t('Error loading contacts')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredContacts}
              emptyMessage={t('No contacts found')}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedContact ? t('Edit Contact') : t('Create New Contact')}
              </h2>
            </div>

            <form onSubmit={selectedContact ? handleUpdateContact : handleCreateContact} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('First Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Last Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Email')}
                  </label>
                  <input
                    type="email"
                    value={formData.emailPrimary}
                    onChange={(e) => setFormData({ ...formData, emailPrimary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Mobile Phone')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneMobile}
                    onChange={(e) => setFormData({ ...formData, phoneMobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Job Title')}
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Department')}
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Contact Type')}
                  </label>
                  <select
                    value={formData.contactType}
                    onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="LEAD">Lead</option>
                    <option value="PROSPECT">Prospect</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="PARTNER">Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Lead Source')}
                  </label>
                  <select
                    value={formData.leadSource}
                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">Select source</option>
                    <option value="WEBSITE">Website</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="COLD_CALL">Cold Call</option>
                    <option value="TRADE_SHOW">Trade Show</option>
                    <option value="SOCIAL_MEDIA">Social Media</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Notes')}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedContact(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedContact ? t('Update Contact') : t('Create Contact')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
