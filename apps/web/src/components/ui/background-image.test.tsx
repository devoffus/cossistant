import { beforeEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const asciiImagePropsSpy = mock((_props: Record<string, unknown>) => {});

mock.module("./ascii-image", () => ({
	AsciiImage: (props: Record<string, unknown>) => {
		asciiImagePropsSpy(props);
		return React.createElement("div", { "data-testid": "ascii-image" });
	},
}));

mock.module("next/image", () => ({
	getImageProps: ({ src, alt }: { src: string; alt?: string }) => ({
		props: {
			alt,
			src,
			srcSet: `${src} 1x`,
		},
	}),
}));

const backgroundImageModulePromise = import("./background-image");

type TestProps = Partial<{
	showImage: boolean;
	resolution: number;
	desktopResolution: number;
	mobileResolution: number;
	asciiMotion: boolean;
	asciiMotionIntensity: number;
	asciiMotionSpeed: number;
	shimmerTintStrength: number;
}>;

async function renderBackgroundImage(props: TestProps = {}) {
	const { BackgroundImage } = await backgroundImageModulePromise;
	return renderToStaticMarkup(
		React.createElement(BackgroundImage, {
			alt: "Cossistant",
			largeSrc: "https://cdn.cossistant.com/landing/main-large.jpg",
			mediumSrc: "https://cdn.cossistant.com/landing/main-medium.jpg",
			smallSrc: "https://cdn.cossistant.com/landing/main-small.jpg",
			...props,
		})
	);
}

describe("BackgroundImage", () => {
	beforeEach(() => {
		asciiImagePropsSpy.mockClear();
	});

	it("hides picture layer in ASCII-only mode and keeps ASCII layer", async () => {
		const html = await renderBackgroundImage({ showImage: false });

		expect(html).not.toContain("<picture");
		expect(html).toContain('data-testid="ascii-image"');
		expect(asciiImagePropsSpy).toHaveBeenCalledTimes(1);

		const props = asciiImagePropsSpy.mock.calls[0]?.[0] as
			| Record<string, unknown>
			| undefined;
		expect(props?.asciiBlendMode).toBe("normal");
		expect(props?.imageOpacity).toBe(0);
	});

	it("keeps picture layer in default overlay mode", async () => {
		const html = await renderBackgroundImage();

		expect(html).toContain("<picture");
		expect(asciiImagePropsSpy).toHaveBeenCalledTimes(1);

		const props = asciiImagePropsSpy.mock.calls[0]?.[0] as
			| Record<string, unknown>
			| undefined;
		expect(props?.asciiBlendMode).toBeUndefined();
	});

	it("uses explicit resolution override instead of adaptive defaults", async () => {
		await renderBackgroundImage({
			desktopResolution: 0.06,
			mobileResolution: 0.08,
			resolution: 0.22,
		});

		const props = asciiImagePropsSpy.mock.calls[0]?.[0] as
			| Record<string, unknown>
			| undefined;
		expect(props?.resolution).toBe(0.22);
	});

	it("forwards motion and tint controls to AsciiImage", async () => {
		await renderBackgroundImage({
			asciiMotion: false,
			asciiMotionIntensity: 0.4,
			asciiMotionSpeed: 2.1,
			shimmerTintStrength: 0.7,
		});

		const props = asciiImagePropsSpy.mock.calls[0]?.[0] as
			| Record<string, unknown>
			| undefined;
		expect(props?.motionEnabled).toBe(false);
		expect(props?.motionIntensity).toBe(0.4);
		expect(props?.motionSpeed).toBe(2.1);
		expect(props?.shimmerTintStrength).toBe(0.7);
	});
});
