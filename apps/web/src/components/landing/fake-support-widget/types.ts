export type FakeSupportTypingActor = {
	conversationId: string;
	actorId: string;
	actorType: "team_member" | "ai";
	preview: string | null;
};
