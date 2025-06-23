import { action, map, onMount } from "nanostores";
import { RTCSession, SessionDirection } from "jssip/lib/RTCSession";
import { $sdk } from "./sdk.ts";
import { $settings } from "./settings.ts";
import ringtoneUrl from "../assets/ringtone.mp3";

type AdditionalInfo = {
	to: string;
	from: string;
};

type IncomingActions = {
	accept?: () => void;
	decline?: () => void;
};

export enum SESSION_STATE {
	PROGRESS,
	CONFIRMED,
	FAILED,
	ENDED,
}

export const DIRECTION_INCOMING = "incoming" as const;
export const DIRECTION_OUTGOING = "outgoing" as const;

export type SessionItem = {
	state: SESSION_STATE;
	duration: number;
	direction: SessionDirection;
	RTCSession: RTCSession;
	additionalInfo: AdditionalInfo;
	incomingActions?: IncomingActions;
	durationUpdater?: NodeJS.Timeout;
};

export const $session = map<SessionItem[]>([]);

function createAudioElement(src?: string) {
	const audioElement = Object.assign(document.createElement("audio"), {
		src,
		style: {
			display: "none",
		},
	});

	return {
		setSrc(src: string) {
			audioElement.setAttribute("src", src);
		},
		setSrcObject(srcObject: MediaStream) {
			audioElement.srcObject = srcObject;
			if (typeof audioElement.srcObject !== "undefined") {
				audioElement.srcObject = srcObject;
			} else {
				// Fallback для Safari
				audioElement.src = URL.createObjectURL(srcObject as unknown as Blob);
			}
		},
		play() {
			audioElement.play().catch(console.log);
		},
		stop() {
			audioElement.pause();
			audioElement.remove();
		},
	};
}

function pipeSessionAudio(session: RTCSession) {
	const audioElement = createAudioElement();

	session.addListener("sdp", () => {
		session.connection.addEventListener("addstream", (event: unknown) => {
			const typedEvent = event as { stream: MediaStream };
			audioElement.setSrcObject(typedEvent.stream);
			audioElement.play();

			console.log("Stream:", typedEvent.stream);
			console.log("Audio tracks:", typedEvent.stream.getAudioTracks());

			typedEvent.stream?.getAudioTracks().forEach(track => {
				console.log("Track enabled:", track.enabled);
				console.log("Track readyState:", track.readyState);
				console.log("Track muted:", track.muted);
			});
		});

		session.connection.addEventListener("removestream", () => {
			audioElement.stop();
		});

		session.connection.addEventListener("track", (event: unknown) => {
			const typedEvent = event as { track: MediaStreamTrack; streams: MediaStream[] };
			console.log("Track:", typedEvent.track);
			console.log("Track enabled:", typedEvent.track.enabled);
			console.log("Track readyState:", typedEvent.track.readyState);
			console.log("Track muted:", typedEvent.track.muted);

			// Для Safari: создать MediaStream из track и воспроизвести
			if (typedEvent.track.kind === "audio") {
				const stream = typedEvent.streams[0] || new MediaStream([typedEvent.track]);
				console.log("Creating audio from track for Safari");
				audioElement.setSrcObject(stream);
				audioElement.play();
			}

			typedEvent.track.addEventListener("enabledchange", () => {
				console.log("Track enabled:", typedEvent.track.enabled);
			});

			typedEvent.track.addEventListener("readystatechange", () => {
				console.log("Track readyState:", typedEvent.track.readyState);
			});

			typedEvent.track.addEventListener("mutechange", () => {
				console.log("Track muted:", typedEvent.track.muted);
			});
		});
	});

	session.addListener("ended", () => {
		audioElement.stop();
	});

	session.addListener("failed", () => {
		audioElement.stop();
	});
}

onMount($session, () => {
	const { instance } = $sdk.get();
	const { sipUserName } = $settings.get();

	if (!instance) return;

	instance.onIncomingCall(({ accept, decline, event }) => {
		const ringtoneAudioElement = createAudioElement(ringtoneUrl);
		ringtoneAudioElement.play();

		setSession({ from: event.request.from.display_name, to: sipUserName }, event.session, {
			accept: () => {
				accept();
				ringtoneAudioElement.stop();

				updateKey(event.session.id, {
					state: SESSION_STATE.CONFIRMED,
					durationUpdater: setInterval(
						() => updateKey(event.session.id, { duration: get(event.session.id).duration + 1 }),
						1000,
					),
				});
			},
			decline: () => {
				ringtoneAudioElement.stop();
				decline();
				remove(event.session.id);
			},
		});
	});
});

const setSession = action(
	$session,
	"setSession",
	(_, additionalInfo: AdditionalInfo, RTCSession: RTCSession, incomingActions?: IncomingActions) => {
		if (!RTCSession) return;

		pipeSessionAudio(RTCSession);

		const session: SessionItem = {
			state: SESSION_STATE.PROGRESS,
			duration: 0,
			direction: RTCSession.direction,
			RTCSession: RTCSession,
			additionalInfo: additionalInfo,
			incomingActions,
		};

		push(session);

		RTCSession.addListener("failed", () => {
			remove(RTCSession.id);
		});

		RTCSession.addListener("confirmed", () => {
			const session = get(RTCSession.id);

			updateKey(RTCSession.id, {
				state: SESSION_STATE.CONFIRMED,
				durationUpdater:
					session.durationUpdater ||
					setInterval(() => updateKey(RTCSession.id, { duration: get(RTCSession.id).duration + 1 }), 1000),
			});
		});

		RTCSession.addListener("ended", () => {
			remove(RTCSession.id);
		});
	},
);

const get = action($session, "get", (store, id) => {
	return store.get().find(v => v.RTCSession.id === id)!;
});

const remove = action($session, "remove", (store, id: string) => {
	store.set(
		store.get().filter(v => {
			if (v.RTCSession.id !== id) return true;
			clearInterval(v.durationUpdater);
			return false;
		}),
	);
});

const push = action($session, "push", (store, session: SessionItem) => {
	store.set([...store.get(), session]);
});

const updateKey = action($session, "updateKey", (store, id: string, sessionValues: Partial<SessionItem>) => {
	store.set(store.get().map(v => (v.RTCSession.id === id ? { ...v, ...sessionValues } : { ...v })));
});

const terminate = action($session, "terminate", (_, id: string) => {
	const sessionItem = get(id);
	if (!sessionItem?.RTCSession) return;
	sessionItem?.RTCSession?.terminate({ status_code: 486, reason_phrase: "Busy Here" });
	remove(id);
});

const hold = action($session, "hold", (_, id: string) => {
	const sessionItem = get(id);
	if (!sessionItem?.RTCSession) return;
	sessionItem.RTCSession.hold();
});

const unhold = action($session, "unhold", (_, id: string) => {
	const sessionItem = get(id);
	if (!sessionItem?.RTCSession) return;
	sessionItem.RTCSession.unhold();
});

export const $sessionMutations = {
	push,
	remove,
	updateKey,
	terminate,
	setSession,
	hold,
	unhold,
};
