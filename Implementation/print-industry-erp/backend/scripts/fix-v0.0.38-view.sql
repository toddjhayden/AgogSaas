-- Fix for V0.0.38 view creation errors
-- This script fixes column name mismatches in v_approval_queue view

CREATE OR REPLACE VIEW v_approval_queue AS
SELECT
    po.id AS purchase_order_id,
    po.tenant_id,
    po.po_number,
    po.purchase_order_date AS po_date,  -- Fixed: was po.po_date
    po.vendor_id,
    v.vendor_name,
    po.facility_id,
    f.facility_name,
    po.total_amount,
    po.po_currency_code,
    po.status,
    po.requested_delivery_date,
    po.current_approval_workflow_id,
    po.current_approval_step_number,
    po.approval_started_at,
    po.pending_approver_user_id,

    -- Workflow info
    wf.workflow_name,
    wf.sla_hours_per_step,

    -- Workflow step info
    ws.step_name AS current_step_name,

    -- SLA calculation
    po.approval_started_at + (wf.sla_hours_per_step || ' hours')::INTERVAL AS sla_deadline,
    EXTRACT(EPOCH FROM (po.approval_started_at + (wf.sla_hours_per_step || ' hours')::INTERVAL - NOW())) / 3600 AS hours_remaining,
    CASE
        WHEN NOW() > (po.approval_started_at + (wf.sla_hours_per_step || ' hours')::INTERVAL) THEN TRUE
        ELSE FALSE
    END AS is_overdue,

    -- Urgency level
    CASE
        WHEN NOW() > (po.approval_started_at + (wf.sla_hours_per_step || ' hours')::INTERVAL)
            OR po.total_amount > 100000 THEN 'URGENT'
        WHEN EXTRACT(EPOCH FROM (po.approval_started_at + (wf.sla_hours_per_step || ' hours')::INTERVAL - NOW())) / 3600 < 8
            OR po.total_amount > 25000 THEN 'WARNING'
        ELSE 'NORMAL'
    END AS urgency_level,

    -- Requester info (FIXED: created_by -> created_by_user_id)
    po.created_by_user_id AS requester_user_id,
    u.first_name || ' ' || u.last_name AS requester_name,

    -- Audit
    po.created_at,
    po.updated_at

FROM purchase_orders po
INNER JOIN vendors v ON po.vendor_id = v.id
INNER JOIN facilities f ON po.facility_id = f.id
LEFT JOIN po_approval_workflows wf ON po.current_approval_workflow_id = wf.id
LEFT JOIN po_approval_workflow_steps ws ON ws.workflow_id = wf.id
    AND ws.step_number = po.current_approval_step_number
LEFT JOIN users u ON po.created_by_user_id = u.id  -- Fixed: was po.created_by
WHERE po.status = 'PENDING_APPROVAL'
    AND po.pending_approver_user_id IS NOT NULL;

COMMENT ON VIEW v_approval_queue IS 'Optimized view for approval queue queries with SLA and urgency calculations';
