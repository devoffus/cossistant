"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { ulid } from "ulid";
import {
	type ConversationTimelineItem,
	createConversationTimelineItemsInfiniteQueryKey,
	removeConversationTimelineItemFromCache,
	upsertConversationTimelineItemInCache,
} from "@/data/conversation-message-cache";
import { type FileUploadPart, useFileUpload } from "@/hooks/use-file-upload";
import { useTRPC } from "@/lib/trpc/client";

type SubmitPayload = {
	message: string;
	files: File[];
	visibility?: "public" | "private";
};

type UseSendConversationMessageOptions = {
	conversationId: string;
	websiteSlug: string;
	currentUserId: string;
	pageLimit?: number;
	onSendForbidden?: () => void;
};

type UseSendConversationMessageReturn = {
	submit: (payload: SubmitPayload) => Promise<void>;
	isPending: boolean;
	isUploading: boolean;
	uploadProgress: number;
};

const DEFAULT_PAGE_LIMIT = 50;

export function useSendConversationMessage({
	conversationId,
	websiteSlug,
	currentUserId,
	pageLimit = DEFAULT_PAGE_LIMIT,
	onSendForbidden,
}: UseSendConversationMessageOptions): UseSendConversationMessageReturn {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		uploadFiles,
		isUploading,
		progress: uploadProgress,
	} = useFileUpload();

	const timelineItemsQueryKey = useMemo(
		() =>
			createConversationTimelineItemsInfiniteQueryKey(
				trpc.conversation.getConversationTimelineItems.queryOptions({
					conversationId,
					websiteSlug,
					limit: pageLimit,
				}).queryKey
			),
		[conversationId, pageLimit, trpc, websiteSlug]
	);

	const { mutateAsync: sendMessage, isPending: isSending } = useMutation(
		trpc.conversation.sendMessage.mutationOptions()
	);

	const submit = useCallback(
		async ({ message, files, visibility = "public" }: SubmitPayload) => {
			const trimmedMessage = message.trim();

			// Allow empty message if there are files
			if (!trimmedMessage && files.length === 0) {
				return;
			}

			setIsSubmitting(true);

			const timelineItemId = ulid();
			const timestamp = new Date().toISOString();

			try {
				// Upload files FIRST before sending the message
				let uploadedParts: FileUploadPart[] = [];
				if (files.length > 0) {
					uploadedParts = await uploadFiles(files, conversationId);
				}

				// Build parts for optimistic update and API call
				const parts: ConversationTimelineItem["parts"] = [
					{ type: "text", text: trimmedMessage },
					...uploadedParts,
				];

				const optimisticItem: ConversationTimelineItem = {
					id: timelineItemId,
					conversationId,
					organizationId: "", // Will be set by backend
					type: "message",
					text: trimmedMessage,
					parts,
					visibility,
					userId: currentUserId,
					aiAgentId: null,
					visitorId: null,
					createdAt: timestamp,
					deletedAt: null,
				};

				await queryClient.cancelQueries({ queryKey: timelineItemsQueryKey });

				upsertConversationTimelineItemInCache(
					queryClient,
					timelineItemsQueryKey,
					optimisticItem
				);

				const response = await sendMessage({
					conversationId,
					websiteSlug,
					text: trimmedMessage,
					visibility,
					timelineItemId,
					parts: uploadedParts.length > 0 ? uploadedParts : undefined,
				});

				const { item: createdItem } = response;

				upsertConversationTimelineItemInCache(
					queryClient,
					timelineItemsQueryKey,
					{
						...createdItem,
						parts: createdItem.parts as ConversationTimelineItem["parts"],
					}
				);
			} catch (error) {
				removeConversationTimelineItemFromCache(
					queryClient,
					timelineItemsQueryKey,
					timelineItemId
				);

				const dataCode =
					(
						error as {
							data?: {
								code?: string;
							};
						}
					)?.data?.code ??
					(
						error as {
							shape?: {
								data?: {
									code?: string;
								};
							};
						}
					)?.shape?.data?.code;

				if (dataCode === "FORBIDDEN") {
					onSendForbidden?.();
				}

				throw error;
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			conversationId,
			currentUserId,
			timelineItemsQueryKey,
			queryClient,
			sendMessage,
			onSendForbidden,
			uploadFiles,
			websiteSlug,
		]
	);

	return {
		submit,
		isPending: isSubmitting || isSending,
		isUploading,
		uploadProgress,
	};
}
