import { describe, expect, it } from "bun:test";
import type { AiAgentSelect } from "@api/db/schema/ai-agent";
import type { ConversationSelect } from "@api/db/schema/conversation";
import type { RoleAwareMessage } from "../context/conversation";
import { getDefaultBehaviorSettings } from "../settings/defaults";
import { buildSystemPrompt, type PromptSkillDocument } from "./system";

function createAgent(): AiAgentSelect {
	return {
		id: "01JTESTAGENT0000000000000",
		name: "Agent",
		description: null,
		basePrompt: "You are helpful.",
		model: "openai/gpt-5-mini",
		temperature: 0.7,
		maxOutputTokens: 1024,
		organizationId: "01JTESTORG00000000000000",
		websiteId: "01JTESTWEB00000000000000",
		isActive: true,
		lastUsedAt: null,
		lastTrainedAt: null,
		trainingStatus: "idle",
		trainingProgress: 0,
		trainingError: null,
		trainingStartedAt: null,
		trainedItemsCount: null,
		usageCount: 0,
		goals: null,
		metadata: null,
		behaviorSettings:
			getDefaultBehaviorSettings() as AiAgentSelect["behaviorSettings"],
		onboardingCompletedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
	};
}

function createConversation(): ConversationSelect {
	return {
		id: "conv-test",
		createdAt: new Date().toISOString(),
	} as ConversationSelect;
}

function buildPromptWithSkills(skills?: PromptSkillDocument[]): string {
	return buildSystemPrompt({
		aiAgent: createAgent(),
		conversation: createConversation(),
		conversationHistory: [] as RoleAwareMessage[],
		visitorContext: null,
		mode: "respond_to_visitor",
		humanCommand: null,
		selectedSkillDocuments: skills,
	});
}

describe("buildSystemPrompt skill sections", () => {
	it("renders required tool skills and contextual custom skills in separate sections", () => {
		const prompt = buildPromptWithSkills([
			{
				name: "send-message",
				content: "Use sendMessage first.",
				source: "tool",
				toolId: "sendMessage",
				toolLabel: "Send Public Message",
			},
			{
				name: "refund-playbook",
				content: "Handle refund requests with policy references.",
				source: "custom",
			},
		]);

		const toolSectionIndex = prompt.indexOf("## Tool Skills (Required)");
		const customSectionIndex = prompt.indexOf("## Custom Skills (Contextual)");

		expect(toolSectionIndex).toBeGreaterThan(-1);
		expect(customSectionIndex).toBeGreaterThan(-1);
		expect(customSectionIndex).toBeGreaterThan(toolSectionIndex);
		expect(prompt).toContain("### Send Public Message");
		expect(prompt).toContain("Use sendMessage first.");
		expect(prompt).toContain("### refund-playbook");
	});

	it("omits skill sections when none are selected", () => {
		const prompt = buildPromptWithSkills();

		expect(prompt).not.toContain("## Tool Skills (Required)");
		expect(prompt).not.toContain("## Custom Skills (Contextual)");
	});
});
