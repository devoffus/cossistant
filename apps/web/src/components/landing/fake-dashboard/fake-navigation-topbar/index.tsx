"use client";

import Link from "next/link";
import Icon from "@/components/ui/icons";
import { TopbarItem } from "@/components/ui/layout/navigation-topbar/topbar-item";
import { Logo } from "@/components/ui/logo";

export function FakeNavigationTopbar({ className }: { className?: string }) {
	return (
		<header className="pointer-events-none flex h-16 min-h-16 w-full items-center justify-between gap-4 pr-3 pl-6.5">
			<div className="flex flex-1 items-center gap-3">
				<Link className="mr-2" href="/">
					<Logo className="size-5.5 text-primary" />
				</Link>
			</div>
			<div className="mr-2 flex items-center gap-3">
				<TopbarItem className="pr-1" hideLabelOnMobile href="/agent">
					<span className="flex items-center gap-1.5">Agent</span>
				</TopbarItem>
				<TopbarItem hideLabelOnMobile href="/contacts">
					Contacts
				</TopbarItem>
				<div className="group/btn relative flex items-center gap-2 rounded px-2 py-1 text-primary/80 text-sm transition-colors hover:bg-background-300 hover:text-primary">
					<Icon className="size-4" name="chat" variant="filled" />
					<span className="font-medium text-sm">Need help?</span>
				</div>
			</div>
		</header>
	);
}
