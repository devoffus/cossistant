import Link from "next/link";
import { CodeBlockCommand } from "@/components/code-block-command";
import { ComponentPreview } from "@/components/component-preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Install = () => (
	<section
		className="mt-40 flex flex-col gap-6 border-primary/10 border-y border-dashed md:gap-12"
		suppressHydrationWarning
	>
		<div className="flex w-full flex-1 flex-col-reverse justify-stretch gap-0 lg:flex-row">
			<div
				className={cn(
					"relative flex flex-col justify-center gap-4 border-primary/10 border-dashed p-4 py-20 lg:border-r"
				)}
			>
				<p className="font-mono text-primary/70 text-xs">{"<Support />"}</p>
				<h2 className="w-full max-w-3xl text-pretty font-f37-stout text-4xl md:text-balance md:text-4xl">
					Support widget built for NextJS and React
				</h2>
				<p className="w-5/6 max-w-3xl text-pretty text-primary/70">
					Meet Cossistant, the programmatic support platform that matches
					shadcn/ui philosophy. React components, production-ready blocks,
					styled with Tailwind CSS.
				</p>
				<div className="mt-6 border border-primary/10 border-dashed bg-background-100 lg:w-5/6">
					<CodeBlockCommand
						__bun__="bun add @cossistant/next @cossistant/react"
						__npm__="npm install @cossistant/next @cossistant/react"
						__pnpm__="pnpm add @cossistant/next @cossistant/react"
						__yarn__="yarn add @cossistant/next @cossistant/react"
					/>
				</div>
				<div className="mt-6 flex w-full flex-row gap-3 md:max-w-[75%] md:gap-6 lg:max-w-full lg:items-center">
					<Button
						asChild
						className="h-12 border border-transparent font-medium text-md has-[>svg]:px-4 lg:w-[250px]"
					>
						<Link href="/sign-up">Start integration now</Link>
					</Button>
					<Button
						asChild
						className="h-12 border border-transparent font-medium text-md has-[>svg]:px-4"
						variant="ghost"
					>
						<Link href="/docs">See the docs first</Link>
					</Button>
				</div>
			</div>
			<div className="h-full w-full flex-1 pt-8">
				<ComponentPreview
					name="support"
					sizeClasses="min-h-[450px] md:min-h-[730px]"
				/>
			</div>
		</div>
	</section>
);
