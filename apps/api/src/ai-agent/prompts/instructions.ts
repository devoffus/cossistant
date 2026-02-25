/**
 * Behavior Instructions
 *
 * Builds dynamic instructions based on behavior settings.
 */

import type { ResponseMode } from "../pipeline/2-decision";
import type { AiAgentBehaviorSettings } from "../settings/types";
import { PROMPT_TEMPLATES } from "./templates";

/**
 * Build behavior instructions based on settings
 */
export function buildBehaviorInstructions(
	settings: AiAgentBehaviorSettings,
	mode: ResponseMode
): string {
	const instructions: string[] = [];

	const escalationInstructions = buildEscalationInstructions(settings);
	if (escalationInstructions) {
		instructions.push(escalationInstructions);
	}

	// Add mode-specific behavior
	const modeInstructions = buildModeBehaviorInstructions(mode);
	if (modeInstructions) {
		instructions.push(modeInstructions);
	}

	return instructions.join("\n\n");
}

export function buildEscalationInstructions(
	settings: AiAgentBehaviorSettings
): string {
	return settings.canEscalate ? PROMPT_TEMPLATES.ESCALATION_GUIDELINES : "";
}

export function buildModeBehaviorInstructions(mode: ResponseMode): string {
	if (mode === "background_only") {
		return `## Current Mode: Background Only

You are in background mode. Do NOT send visible messages to the visitor.
Use sendPrivateMessage() if needed, then finish with respond or skip.`;
	}

	return "";
}

/**
 * Build a list of enabled capabilities
 */
export function buildCapabilitiesInstructions(
	settings: AiAgentBehaviorSettings
): string {
	const enabled: string[] = [];
	const disabled: string[] = [];

	if (settings.canResolve) {
		enabled.push("- Resolve conversations when the issue is addressed");
	} else {
		disabled.push("- You cannot resolve conversations directly");
	}

	if (settings.canMarkSpam) {
		enabled.push("- Mark obvious spam conversations");
	} else {
		disabled.push("- You cannot mark conversations as spam");
	}

	if (settings.canAssign) {
		enabled.push("- Assign conversations to specific team members");
	}

	if (settings.canSetPriority) {
		enabled.push("- Set conversation priority based on urgency");
	}

	if (settings.canCategorize) {
		enabled.push("- Categorize conversations into appropriate views");
	}

	if (settings.canEscalate) {
		enabled.push("- Escalate to human support when needed");
	} else {
		disabled.push("- You cannot escalate conversations");
	}

	const parts: string[] = [];

	if (enabled.length > 0) {
		parts.push(`## You CAN:\n${enabled.join("\n")}`);
	}

	if (disabled.length > 0) {
		parts.push(`## You CANNOT:\n${disabled.join("\n")}`);
	}

	return parts.join("\n\n");
}
