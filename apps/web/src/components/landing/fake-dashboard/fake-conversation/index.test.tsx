import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMarcEscalatedConversation, marcVisitor } from "../data";
import { FakeConversation } from "./index";

describe("FakeConversation shell", () => {
	it("renders escalation action instead of input while escalation is pending", () => {
		const html = renderToStaticMarkup(
			<React.StrictMode>
				<FakeConversation
					conversation={createMarcEscalatedConversation()}
					isEscalationPending={true}
					onJoinConversation={() => {}}
					timeline={[]}
					typingActors={[]}
					visitor={marcVisitor}
				/>
			</React.StrictMode>
		);

		expect(html).toContain("Human help requested by AI");
		expect(html).toContain("Join the conversation");
		expect(html).not.toContain("Type your message...");
	});

	it("renders input once escalation is handled", () => {
		const html = renderToStaticMarkup(
			<React.StrictMode>
				<FakeConversation
					conversation={createMarcEscalatedConversation()}
					isEscalationPending={false}
					onJoinConversation={() => {}}
					timeline={[]}
					typingActors={[]}
					visitor={marcVisitor}
				/>
			</React.StrictMode>
		);

		expect(html).toContain("Type your message...");
		expect(html).not.toContain("Join the conversation");
	});
});
