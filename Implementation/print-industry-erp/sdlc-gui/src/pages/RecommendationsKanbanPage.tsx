/**
 * Recommendations Kanban Page
 * Interactive drag-and-drop Kanban board for managing recommendation workflow
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useSDLCStore } from '@/stores/useSDLCStore';
import type { RecommendationStatus, Recommendation } from '@/api/sdlc-client';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lightbulb,
  User,
  MousePointerClick,
} from 'lucide-react';
import { useFilterStore } from '@/stores/useFilterStore';
import { FilterBar, FilterActiveBadge } from '@/components/GlobalFilterBar';

// Kanban column configuration
const KANBAN_COLUMNS: {
  id: RecommendationStatus;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  { id: 'pending', title: 'Pending Review', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' },
  { id: 'approved', title: 'Approved', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
  { id: 'in_progress', title: 'In Progress', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
  { id: 'done', title: 'Done', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
  { id: 'rejected', title: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-300' },
  { id: 'failed', title: 'Failed', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' },
];

// Confirmation dialog component
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  showNotes = false,
  notesLabel = 'Notes',
  notesValue,
  onNotesChange,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  showNotes?: boolean;
  notesLabel?: string;
  notesValue?: string;
  onNotesChange?: (value: string) => void;
}) {
  if (!isOpen) return null;

  const buttonColors = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    danger: 'bg-red-600 hover:bg-red-700',
    success: 'bg-green-600 hover:bg-green-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-4">{message}</p>

        {showNotes && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">{notesLabel}</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={notesValue}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder={`Enter ${notesLabel.toLowerCase()}...`}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${buttonColors[confirmVariant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Recommendation card component
function RecommendationCard({
  recommendation,
  index,
  onApprove,
  onReject,
  isUpdating,
  onFocus,
  isFocused,
}: {
  recommendation: Recommendation;
  index: number;
  onApprove: (rec: Recommendation) => void;
  onReject: (rec: Recommendation) => void;
  isUpdating: boolean;
  onFocus: (recNumber: string) => void;
  isFocused: boolean;
}) {
  const urgencyColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  const impactColors: Record<string, string> = {
    high: 'bg-purple-100 text-purple-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-slate-100 text-slate-600',
  };

  const showActions = recommendation.status === 'pending';

  return (
    <Draggable draggableId={recommendation.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-sm border p-4 mb-3 transition-shadow ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'
          } ${isUpdating ? 'opacity-60' : ''} ${isFocused ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-slate-500">{recommendation.recNumber}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(recommendation.recNumber);
                }}
                className={`p-0.5 rounded transition-colors ${
                  isFocused
                    ? 'text-blue-600 bg-blue-100'
                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title={isFocused ? 'Currently focused' : 'Focus on this item across all pages'}
              >
                <MousePointerClick size={12} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded border ${urgencyColors[recommendation.urgency] || 'bg-slate-100'}`}>
                {recommendation.urgency}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${impactColors[recommendation.impactLevel] || 'bg-slate-100'}`}>
                {recommendation.impactLevel} impact
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-medium text-slate-800 mb-2 line-clamp-2">{recommendation.title}</h3>

          {/* Description */}
          {recommendation.description && (
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{recommendation.description}</p>
          )}

          {/* Recommended By */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Lightbulb size={12} />
            <span>By: {recommendation.recommendedBy}</span>
          </div>

          {/* Affected BUs */}
          {recommendation.affectedBus && recommendation.affectedBus.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {recommendation.affectedBus.slice(0, 3).map((bu) => (
                <span key={bu} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {bu}
                </span>
              ))}
              {recommendation.affectedBus.length > 3 && (
                <span className="text-xs text-slate-400">+{recommendation.affectedBus.length - 3}</span>
              )}
            </div>
          )}

          {/* Reviewer Info */}
          {recommendation.reviewedBy && (
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <User size={12} />
              <span>Reviewed by: {recommendation.reviewedBy}</span>
            </div>
          )}

          {/* Action Buttons for Pending Items */}
          {showActions && (
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(recommendation);
                }}
                disabled={isUpdating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={14} />
                Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(recommendation);
                }}
                disabled={isUpdating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
          )}

          {isUpdating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

// Kanban column component
function KanbanColumn({
  column,
  recommendations,
  onApprove,
  onReject,
  updatingId,
  onFocus,
  focusedItem,
}: {
  column: typeof KANBAN_COLUMNS[0];
  recommendations: Recommendation[];
  onApprove: (rec: Recommendation) => void;
  onReject: (rec: Recommendation) => void;
  updatingId: string | null;
  onFocus: (recNumber: string) => void;
  focusedItem: string | null;
}) {
  return (
    <div className="flex flex-col w-72 md:w-80 flex-shrink-0">
      {/* Column Header */}
      <div className={`flex items-center justify-between p-3 rounded-t-lg ${column.bgColor} border-b-2 ${column.borderColor}`}>
        <h2 className={`font-semibold ${column.color}`}>{column.title}</h2>
        <span className={`text-sm font-medium ${column.color} bg-white/60 px-2 py-0.5 rounded`}>
          {recommendations.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-3 rounded-b-lg border border-t-0 ${column.borderColor} min-h-[200px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-slate-50'
            }`}
          >
            {recommendations.length > 0 ? (
              recommendations.map((rec, index) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  index={index}
                  onApprove={onApprove}
                  onReject={onReject}
                  isUpdating={updatingId === rec.id}
                  onFocus={onFocus}
                  isFocused={focusedItem === rec.recNumber}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Clock size={24} className="mb-2" />
                <span className="text-sm">No recommendations</span>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function RecommendationsKanbanPage() {
  const {
    recommendations,
    recommendationsLoading,
    recommendationUpdating,
    fetchRecommendations,
    approveRecommendation,
    rejectRecommendation,
    moveRecommendation,
  } = useSDLCStore();

  // Global filters
  const {
    isEnabled: globalFiltersEnabled,
    type: globalType,
    status: globalStatus,
    priority: globalPriority,
    searchTerm: globalSearchTerm,
    focusedItem,
    focusOnRec,
  } = useFilterStore();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'move';
    recommendation: Recommendation | null;
    targetStatus?: RecommendationStatus;
    notes: string;
  }>({
    isOpen: false,
    type: 'approve',
    recommendation: null,
    notes: '',
  });

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Filter recommendations based on global filters
  const filteredRecommendations = useMemo(() => {
    if (!globalFiltersEnabled) return recommendations;

    // If type is set to REQ only, return empty (this page is for recommendations)
    if (globalType === 'REQ') return [];

    let filtered = [...recommendations];

    // Status filter (map recommendation statuses)
    if (globalStatus !== 'all') {
      filtered = filtered.filter((rec) => rec.status.toLowerCase() === globalStatus);
    }

    // Priority/urgency filter (recommendations use "urgency" not "priority")
    if (globalPriority !== 'all') {
      filtered = filtered.filter((rec) => rec.urgency.toLowerCase() === globalPriority);
    }

    // Search filter
    if (globalSearchTerm) {
      const term = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (rec) =>
          rec.title.toLowerCase().includes(term) ||
          rec.recNumber.toLowerCase().includes(term) ||
          rec.description?.toLowerCase().includes(term)
      );
    }

    // Focus filter
    if (focusedItem) {
      filtered = filtered.filter((rec) => rec.recNumber === focusedItem);
    }

    return filtered;
  }, [recommendations, globalFiltersEnabled, globalType, globalStatus, globalPriority, globalSearchTerm, focusedItem]);

  // Group recommendations by status
  const groupedRecommendations = useCallback(() => {
    const grouped: Record<RecommendationStatus, Recommendation[]> = {
      pending: [],
      approved: [],
      in_progress: [],
      done: [],
      rejected: [],
      failed: [],
    };

    filteredRecommendations.forEach((rec) => {
      const status = rec.status as RecommendationStatus;
      if (grouped[status]) {
        grouped[status].push(rec);
      } else {
        grouped.pending.push(rec); // Default to pending if unknown status
      }
    });

    return grouped;
  }, [filteredRecommendations]);

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const recommendation = recommendations.find((rec) => rec.id === draggableId);
    if (!recommendation) return;

    const targetStatus = destination.droppableId as RecommendationStatus;

    // If moving from pending, require approval/rejection through dialog
    if (recommendation.status === 'pending' && (targetStatus === 'approved' || targetStatus === 'rejected')) {
      setDialogState({
        isOpen: true,
        type: targetStatus === 'approved' ? 'approve' : 'reject',
        recommendation,
        targetStatus,
        notes: '',
      });
      return;
    }

    // For other transitions, show confirmation dialog
    setDialogState({
      isOpen: true,
      type: 'move',
      recommendation,
      targetStatus,
      notes: '',
    });
  };

  // Handle approve click
  const handleApproveClick = (rec: Recommendation) => {
    setDialogState({
      isOpen: true,
      type: 'approve',
      recommendation: rec,
      notes: '',
    });
  };

  // Handle reject click
  const handleRejectClick = (rec: Recommendation) => {
    setDialogState({
      isOpen: true,
      type: 'reject',
      recommendation: rec,
      notes: '',
    });
  };

  // Handle dialog confirm
  const handleDialogConfirm = async () => {
    const { type, recommendation, targetStatus, notes } = dialogState;
    if (!recommendation) return;

    let success = false;
    const reviewer = 'System User'; // TODO: Get from auth context

    if (type === 'approve') {
      success = await approveRecommendation(recommendation.id, reviewer, notes || undefined);
    } else if (type === 'reject') {
      success = await rejectRecommendation(recommendation.id, reviewer, notes || 'Rejected');
    } else if (type === 'move' && targetStatus) {
      success = await moveRecommendation(recommendation.id, targetStatus);
    }

    if (success) {
      fetchRecommendations(); // Refresh to get latest state
    }

    setDialogState({ isOpen: false, type: 'approve', recommendation: null, notes: '' });
  };

  // Handle dialog cancel
  const handleDialogCancel = () => {
    setDialogState({ isOpen: false, type: 'approve', recommendation: null, notes: '' });
  };

  const grouped = groupedRecommendations();

  if (recommendationsLoading && recommendations.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading recommendations...</span>
        </div>
      </div>
    );
  }

  // Show message if global filter is set to requests only
  if (globalFiltersEnabled && globalType === 'REQ') {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Recommendations Board</h1>
            <FilterActiveBadge />
          </div>
        </div>
        <FilterBar showSearch={true} showStatus={true} showPriority={true} />
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="text-center">
            <p>Global filter is set to show Requests only.</p>
            <p className="text-sm mt-1">This board displays Recommendations. Switch to "All" or "REC" type to see content.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">Recommendations Board</h1>
            <FilterActiveBadge />
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Drag and drop to change status. Click approve/reject for pending items.
          </p>
        </div>
        <button
          onClick={() => fetchRecommendations()}
          disabled={recommendationsLoading}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm md:text-base"
        >
          <RefreshCw size={16} className={recommendationsLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Global Filter Bar */}
      <FilterBar showSearch={true} showStatus={true} showPriority={true} />

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto -webkit-overflow-scrolling-touch">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 md:gap-4 h-full min-w-max pb-4 px-1">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                recommendations={grouped[column.id] || []}
                onApprove={handleApproveClick}
                onReject={handleRejectClick}
                updatingId={recommendationUpdating}
                onFocus={focusOnRec}
                focusedItem={focusedItem}
              />
            ))}
          </div>
        </DragDropContext>

        {filteredRecommendations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <AlertTriangle size={48} className="mb-4 text-slate-400" />
            <h3 className="text-lg font-medium">
              {globalFiltersEnabled && recommendations.length > 0
                ? 'No Matching Recommendations'
                : 'No Recommendations'}
            </h3>
            <p className="text-sm">
              {globalFiltersEnabled && recommendations.length > 0
                ? 'Try adjusting the global filters to see more items.'
                : 'Recommendations will appear here when created by the SDLC system.'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={
          dialogState.type === 'approve'
            ? 'Approve Recommendation'
            : dialogState.type === 'reject'
            ? 'Reject Recommendation'
            : `Move to ${dialogState.targetStatus?.replace('_', ' ')}`
        }
        message={
          dialogState.type === 'approve'
            ? `Are you sure you want to approve "${dialogState.recommendation?.title}"?`
            : dialogState.type === 'reject'
            ? `Are you sure you want to reject "${dialogState.recommendation?.title}"?`
            : `Move "${dialogState.recommendation?.title}" to ${dialogState.targetStatus?.replace('_', ' ')}?`
        }
        confirmLabel={
          dialogState.type === 'approve' ? 'Approve' : dialogState.type === 'reject' ? 'Reject' : 'Move'
        }
        confirmVariant={
          dialogState.type === 'approve' ? 'success' : dialogState.type === 'reject' ? 'danger' : 'primary'
        }
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
        showNotes={dialogState.type === 'approve' || dialogState.type === 'reject'}
        notesLabel={dialogState.type === 'reject' ? 'Rejection Reason' : 'Notes (optional)'}
        notesValue={dialogState.notes}
        onNotesChange={(value) => setDialogState((prev) => ({ ...prev, notes: value }))}
      />
    </div>
  );
}
