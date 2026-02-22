"use client";

import React from "react";
import { FakeSupportWidget } from "@/components/landing/fake-support-widget";
import { BackgroundImage } from "@/components/ui/background-image";

function CossistantLandingSupport() {
	return (
		<div className="cossistant relative h-full w-full">
			<BackgroundImage
				alt="Cossistant Background"
				asciiOpacity={0.5}
				largeSrc="https://cdn.cossistant.com/landing/secondary-large.jpg"
				mediumSrc="https://cdn.cossistant.com/landing/secondary-medium.jpg"
				portraitOnMobile
				showImage={false}
				smallSrc="https://cdn.cossistant.com/landing/secondary-small.jpg"
			/>
			<FakeSupportWidget />
		</div>
	);
}

export default CossistantLandingSupport;
