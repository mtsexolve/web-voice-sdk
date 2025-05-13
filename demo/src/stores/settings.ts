import { action, computed, deepMap } from "nanostores";
import { createSipInstance } from "@mts-exolve/web-voice-sdk";
import { notificationService } from "@hope-ui/solid";
import { unregister } from "./sdk.ts";

const STORAGE_KEY = "settings";

export type Settings = {
	sipUserName: string;
	sipPassword: string;
	environment: Environment;
};

export enum Environment {
	TEST,
	PRE_PRODUCTION,
	PRODUCTION,
}

export const environments = {
	[Environment.TEST]: {
		WSUrl: "ws://webrtc-test.exolve.ru:8080",
		realm: "80.75.132.122:8080",
	},
	[Environment.PRE_PRODUCTION]: {
		WSUrl: "ws://80.75.132.121:8080",
		realm: "80.75.132.121",
	},
	[Environment.PRODUCTION]: {
		WSUrl: "wss://webrtc.exolve.ru:8443",
		realm: "80.75.132.120",
		ssl: true,
	},
} as const;

function getPersistentSettings(): Settings {
	const savedValue = localStorage.getItem(STORAGE_KEY);

	if (!savedValue) return {} as never;
	return JSON.parse(savedValue) as Settings;
}

export const $settings = deepMap<Settings>(getPersistentSettings());

export const setupSettings = action($settings, "setupActions", async (store, settings: Settings) => {
	const environment = environments[settings.environment];

	const instance = createSipInstance({
		...environment,
		sipLogin: settings.sipUserName,
		sipPassword: settings.sipPassword,
	});

	console.log({
		...environment,
		sipLogin: settings.sipUserName,
		sipPassword: settings.sipPassword,
	});

	try {
		await instance.register();
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		store.set(settings);
		await instance.unregister();
	} catch (error) {
		notificationService.show({
			status: "danger",
			title: "Ошибка",
			description: "Данные некорректны или сервер недоступен",
		});

		console.log(error);
	}
});

export const resetSettings = action($settings, "resetSettings", store => {
	unregister().catch();
	localStorage.removeItem(STORAGE_KEY);
	store.set({} as never);
});

export const $settingsReady = computed($settings, settings => Object.keys(settings).length > 0);
