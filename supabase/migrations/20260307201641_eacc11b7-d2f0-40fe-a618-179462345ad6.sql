-- Reset the approval request and campaign for re-testing
UPDATE approval_requests SET status = 'pending', decided_at = NULL, decision_comment = NULL WHERE id = '6317baf9-0def-4c7a-a6a3-e777dc7ced1e';
UPDATE campaigns SET status = 'pending_approval' WHERE id = 'a47d33ac-a3ab-480d-a684-03b496d91d1d';