// Agent tools déclarés pour D106 — 25 tools cibles
// 13 existants (à étendre) + 12 nouveaux (stubs)
// Statut : interfaces déclarées en 1d.5h-bis-NUKE, implémentations 1d.5i-C / 1d.5j / 1d.5k
// CE FICHIER N'EST PAS CÂBLÉ dans agent-converse à cette phase (D120).

// =============================================================================
// READ TOOLS (15)
// =============================================================================

export interface ReadDealSummaryInput { deal_id: string; }
export interface ReadDealSummaryOutput { deal: unknown; }

export interface ReadPatternMatchesInput { deal_id: string; min_confidence?: number; limit?: number; }
export interface ReadPatternMatchesOutput {
  matches: Array<{ pattern_code: string; confidence: number; triggered_at: string }>;
}

export interface ReadEcosystemMapInput { account_id: string; state_filter?: "all" | "confirmed" | "detected_unverified"; }
export interface ReadEcosystemMapOutput { viewers: unknown[]; }

export interface ReadForwardChainsInput { account_id: string; detection_method_filter?: string; }
export interface ReadForwardChainsOutput { chains: unknown[]; }

export interface ReadSilentWitnessesInput { account_id: string; }
export interface ReadSilentWitnessesOutput { silent_witnesses: unknown[]; }

export interface ReadEngagementGradientInput { account_id: string; window_days?: number; }
export interface ReadEngagementGradientOutput { ranking: unknown[]; }

export interface ClassifyUnknownDomainInput { domain: string; }
export interface ClassifyUnknownDomainOutput { category: string; confidence: number; }

export interface ReadCommitteeLayersInput { deal_id: string; }
export interface ReadCommitteeLayersOutput { layers: unknown[]; }

export interface ReadRecentSignalsInput { deal_id: string; hours?: number; }
export interface ReadRecentSignalsOutput { signals: unknown[]; }

export interface ReadTruthSystemFactsInput { deal_id: string; truth_layer?: "fact" | "inference" | "declared"; }
export interface ReadTruthSystemFactsOutput { facts: unknown[]; }

export interface ReadPendingActionsInput { ae_user_id: string; scope?: "deal" | "portfolio"; }
export interface ReadPendingActionsOutput { actions: unknown[]; }

export interface ReadPatternLifecycleStateInput { org_id: string; current_stage?: string; }
export interface ReadPatternLifecycleStateOutput { patterns: unknown[]; }

export interface ReadExecutiveBudgetRemainingInput { org_id: string; executive_role?: string; }
export interface ReadExecutiveBudgetRemainingOutput { budget: unknown; }

export interface ReadUpgradeSignalsInput { org_id: string; window_days?: number; }
export interface ReadUpgradeSignalsOutput { signals: unknown[]; }

export interface ReadDealStorylineInput { deal_id: string; audience?: "ae" | "vp" | "exec"; }
export interface ReadDealStorylineOutput { narrative: string; }

// =============================================================================
// WRITE TOOLS (10)
// =============================================================================

export interface ProposeExternalActionInput { pattern_match_id: string; arme_type: string; target_role: string; }
export interface ProposeExternalActionOutput { pending_external_action_id: string; }

export interface DeclareFactInput { deal_id: string; fact_type: string; payload: unknown; }
export interface DeclareFactOutput { declaration_id: string; }

export interface ConfirmViewerRoleInput { viewer_hash: string; confirmed_role: string; }
export interface ConfirmViewerRoleOutput { updated: boolean; }

export interface DismissInferenceInput { inference_id: string; reason?: string; }
export interface DismissInferenceOutput { dismissed: boolean; }

export interface RequestExecutiveInterventionInput {
  deal_id: string; executive_role: string; arme_type: string; pattern_code: string;
}
export interface RequestExecutiveInterventionOutput {
  decision: "allowed" | "upgrade_required" | "budget_exhausted"; fallback_action?: string;
}

export interface RequestTierUpgradeInput {
  org_id: string; current_tier: string; requested_tier: string; blocked_action: string;
}
export interface RequestTierUpgradeOutput { signal_logged: boolean; }

export interface MarkPatternOutcomeInput {
  pattern_match_id: string; outcome: "positive" | "neutral" | "negative" | "mixed"; evidence?: string;
}
export interface MarkPatternOutcomeOutput { logged: boolean; }

export interface ProposePatternToOrgInput { org_id: string; pattern_draft: unknown; rationale: string; }
export interface ProposePatternToOrgOutput { proposal_id: string; }

export interface ArchiveDealRoomInput { deal_room_id: string; }
export interface ArchiveDealRoomOutput { archived: boolean; }

export interface CloneDealRoomInput { source_deal_room_id: string; scope: string; }
export interface CloneDealRoomOutput { new_deal_room_id: string; }

// =============================================================================
// TOOL REGISTRY
// =============================================================================

export type ToolStatus =
  | "implemented_existing"
  | "stub_1d.5i-A1"
  | "stub_1d.5i-B"
  | "stub_1d.5i-C"
  | "stub_1d.5j"
  | "stub_1d.5k";

export const TOOL_REGISTRY: Record<string, { status: ToolStatus }> = {
  // READ
  read_deal_summary: { status: "implemented_existing" },
  read_pattern_matches: { status: "stub_1d.5i-B" },
  read_ecosystem_map: { status: "stub_1d.5i-A1" },
  read_forward_chains: { status: "stub_1d.5i-A1" },
  read_silent_witnesses: { status: "stub_1d.5j" },
  read_engagement_gradient: { status: "stub_1d.5j" },
  classify_unknown_domain: { status: "stub_1d.5i-A1" },
  read_committee_layers: { status: "implemented_existing" },
  read_recent_signals: { status: "implemented_existing" },
  read_truth_system_facts: { status: "stub_1d.5i-C" },
  read_pending_actions: { status: "implemented_existing" },
  read_pattern_lifecycle_state: { status: "stub_1d.5i-B" },
  read_executive_budget_remaining: { status: "stub_1d.5j" },
  read_upgrade_signals: { status: "stub_1d.5j" },
  read_deal_storyline: { status: "stub_1d.5j" },

  // WRITE
  propose_external_action: { status: "stub_1d.5i-C" },
  declare_fact: { status: "implemented_existing" },
  confirm_viewer_role: { status: "stub_1d.5i-A1" },
  dismiss_inference: { status: "stub_1d.5i-C" },
  request_executive_intervention: { status: "stub_1d.5j" },
  request_tier_upgrade: { status: "stub_1d.5j" },
  mark_pattern_outcome: { status: "stub_1d.5i-C" },
  propose_pattern_to_org: { status: "stub_1d.5i-C" },
  archive_deal_room: { status: "implemented_existing" },
  clone_deal_room: { status: "implemented_existing" },
};
