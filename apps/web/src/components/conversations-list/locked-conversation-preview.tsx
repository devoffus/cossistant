"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

const WORD_BANK = [
	"atlas",
	"cinder",
	"signal",
	"ember",
	"vector",
	"harbor",
	"matrix",
	"prism",
	"echo",
	"anchor",
	"pulse",
	"delta",
	"orbit",
	"thread",
	"lumen",
	"cipher",
	"frame",
	"drift",
	"quartz",
	"nova",
	"kernel",
	"ripple",
	"flux",
	"arc",
	"scope",
	"node",
	"glint",
	"fable",
];

function toSeed(value: string): number {
	let seed = 0;
	for (let index = 0; index < value.length; index += 1) {
		seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
	}
	return seed || 1;
}

function nextSeed(seed: number): number {
	return (seed * 1_664_525 + 1_013_904_223) >>> 0;
}

export function buildLockedConversationPreview(
	conversationId: string,
	wordCount = 9
): string {
	let seed = toSeed(conversationId);
	const words: string[] = [];

	for (let index = 0; index < wordCount; index += 1) {
		seed = nextSeed(seed);
		words.push(WORD_BANK[seed % WORD_BANK.length] ?? "signal");
	}

	return words.join(" ");
}

type LockedConversationPreviewProps = {
	conversationId: string;
	className?: string;
};

export function LockedConversationPreview({
	conversationId,
	className,
}: LockedConversationPreviewProps) {
	const preview = useMemo(
		() => buildLockedConversationPreview(conversationId),
		[conversationId]
	);

	return (
		<span className={cn("select-none truncate blur-[2px]", className)}>
			{preview}
		</span>
	);
}
