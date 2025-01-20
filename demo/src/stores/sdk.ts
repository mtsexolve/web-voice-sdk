import { action, map, onMount } from "nanostores";
import { createSipInstance, SIPInstance } from "@mts-exolve/web-voice-sdk";
import { $settings } from "./settings.ts";
import { notificationService } from "@hope-ui/solid";

type SDKStore = {
	instance: SIPInstance | null;
	registered: boolean;
};

export const $sdk = map<SDKStore>({
	instance: null,
	registered: false,
});

export const register = action($sdk, "register", async store => {
	try {
		const { instance } = store.get();
		await instance?.register();
		store.setKey("registered", true);
	} catch (error) {
		notificationService.show({
			title: "Ошибка регистрации",
			status: "danger",
			description: "Проверьте корректность авторизационных данных",
		});

		console.log("error on registration", error);
	}
});

export const unregister = action($sdk, "unRegister", async store => {
	try {
		const { instance } = store.get();
		await instance?.unregister();
		store.setKey("registered", false);
	} catch (error) {
		notificationService.show({
			status: "danger",
			description: "Ошибка снятия регистрации",
		});

		console.log("error on unregister", error);
	}
});

onMount($sdk, () => {
	const settings = $settings.get();

	const instance = createSipInstance({
		ssl: true,
		sipLogin: settings.sipUserName,
		sipPassword: settings.sipPassword,
	});

	$sdk.setKey("instance", instance);

	window.addEventListener("unload", async function () {
		await instance.unregister();
	});

	return () => {
		instance.unregister().catch(console.log);
	};
});
