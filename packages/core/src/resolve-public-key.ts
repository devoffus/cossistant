/**
 * Supported framework types for environment variable detection.
 */
export type Framework = "nextjs" | "vite" | "other";

/**
 * Detect the current framework environment.
 *
 * Used primarily for user-facing error messages so we can suggest
 * the correct environment variable name.
 */
export function detectFramework(): Framework {
	// Next.js client-side
	if (typeof window !== "undefined" && "__NEXT_DATA__" in window) {
		return "nextjs";
	}

	// Next.js server-side
	if (
		typeof process !== "undefined" &&
		process.env &&
		"__NEXT_RUNTIME" in process.env
	) {
		return "nextjs";
	}

	// Vite — import.meta.env.MODE is always set by Vite
	try {
		if (import.meta.env?.MODE) {
			return "vite";
		}
	} catch {
		// import.meta not available
	}

	return "other";
}

/**
 * Returns the recommended environment variable name for the detected framework.
 */
export function getEnvVarName(framework?: Framework): string {
	const fw = framework ?? detectFramework();
	switch (fw) {
		case "nextjs":
			return "NEXT_PUBLIC_COSSISTANT_API_KEY";
		case "vite":
			return "VITE_COSSISTANT_API_KEY";
		default:
			return "COSSISTANT_API_KEY";
	}
}

/**
 * Resolve the Cossistant public API key from multiple sources.
 *
 * Priority order:
 * 1. Explicit value passed as argument
 * 2. `process.env.NEXT_PUBLIC_COSSISTANT_API_KEY` (Next.js / CRA / webpack)
 * 3. `process.env.COSSISTANT_API_KEY` (generic Node.js / CRA)
 * 4. `import.meta.env.VITE_COSSISTANT_API_KEY` (Vite)
 *
 * Safe across all environments: Node.js, browser, Vite, Next.js, CRA.
 */
export function resolvePublicKey(explicit?: string | null): string | undefined {
	const trimmed = explicit?.trim();
	if (trimmed) {
		return trimmed;
	}

	// Try process.env (Next.js, CRA, webpack, Node.js)
	// Double guard: process must exist AND process.env must be an object
	if (typeof process !== "undefined" && process.env) {
		try {
			const key =
				process.env.NEXT_PUBLIC_COSSISTANT_API_KEY ||
				process.env.COSSISTANT_API_KEY;
			const normalized = key?.trim();
			if (normalized) {
				return normalized;
			}
		} catch {
			// Defensive: some environments shim process but throw on env access
		}
	}

	// Try import.meta.env (Vite)
	// import.meta.env is a runtime object in Vite containing all VITE_* env vars
	try {
		const key = import.meta.env?.VITE_COSSISTANT_API_KEY;
		const normalized = key?.trim();
		if (normalized) {
			return normalized;
		}
	} catch {
		// import.meta.env not available (CJS, older bundlers)
	}

	return;
}
