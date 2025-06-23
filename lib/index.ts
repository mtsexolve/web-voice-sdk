import JsSIP from "jssip";
import {
	RTCSession,
	SessionDirection,
	DTFMOptions,
	RenegotiateOptions,
	EndEvent,
	IncomingDTMFEvent,
	ConnectingEvent,
	ReferOptions,
	HoldOptions,
	IceCandidateEvent,
	SDPEvent,
	TerminateOptions,
} from "jssip/lib/RTCSession";
import {
	CallOptions,
	IncomingRTCSessionEvent,
	UAConfiguration,
	DisconnectEvent,
	RegisteredEvent,
} from "jssip/lib/UA";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890qwertyuiopasdfghjklzxcvbnm", 16);

export const Originator = {
	LOCAL: "local",
	REMOTE: "remote",
	SYSTEM: "system",
} as const;

/**
 * События линий
 */
export type LineEvents = {
	/** Добавлена новая линия */
	onLineAdded: (line: CallLine) => void;
	/** Удалена линия */
	onLineRemoved: (lineId: string) => void;
	/** Изменилось состояние линии */
	onLineChanged: (line: CallLine) => void;
	/** Изменилась активная линия */
	onActiveLineChanged: (lineId: string | null) => void;
};

/**
 * Конфигурация для создания SIP-клиента
 */
export type CreateSipInstanceProps = {
	/** URL WebSocket сервера. По умолчанию используется webrtc.exolve.ru */
	WSUrl?: string;
	/** SIP домен. По умолчанию используется 80.75.132.120 */
	realm?: string;
	/** Дополнительные настройки JsSIP UA */
	UAConfig?: UAConfiguration;
	/** Список STUN серверов. По умолчанию используется webrtc.exolve.ru:3479 */
	stunServers?: string[];
	/** Настройки для исходящих и входящих звонков */
	callOptions?: CallOptions;
	/** SIP логин */
	sipLogin: string;
	/** SIP пароль */
	sipPassword: string;
	/** Включить режим отладки */
	debug?: boolean;
	/** Использовать защищенное соединение (WSS вместо WS) */
	ssl?: boolean;
	/** Максимальное количество линий */
	maxLines?: number;
	/** События линий */
	lineEvents?: LineEvents;
};

/**
 * Аргументы колбэка для входящего звонка
 */
export type OnIncomingCallCbArgs = {
	/** Событие входящего звонка */
	event: IncomingRTCSessionEvent;
	/** Принять звонок */
	accept(): void;
	/** Отклонить звонок */
	decline(): void;
};

/**
 * События SIP-соединения
 */
export type SipConnectionEvents = {
	/** Начало подключения к серверу */
	connecting: () => void;
	/** Успешное подключение к серверу */
	connected: () => void;
	/** Отключение от сервера */
	disconnected: (event: DisconnectEvent) => void;
	/** Регистрация на сервере скоро истечет */
	registrationExpiring: () => void;
	/** Успешная регистрация на сервере */
	registered: (event: RegisteredEvent) => void;
};

/**
 * События звонка
 */
export type CallSessionEvents = {
	/** Начало установки соединения */
	connecting: (event: ConnectingEvent) => void;
	/** Звонок в процессе установки */
	progress: () => void;
	/** Ошибка при звонке */
	failed: (event: EndEvent) => void;
	/** Звонок завершен */
	ended: (event: EndEvent) => void;
	/** Звонок установлен */
	confirmed: () => void;
	/** Микрофон выключен */
	muted: () => void;
	/** Микрофон включен */
	unmuted: () => void;
	/** Звонок поставлен на удержание */
	held: () => void;
	/** Звонок снят с удержания */
	unheld: () => void;
	/** Получен DTMF сигнал */
	newDTMF: (event: IncomingDTMFEvent) => void;
	/** Получен запрос на переадресацию */
	refer: () => void;
	/** Получен запрос на замену звонка */
	replaces: () => void;
	/** События ICE кандидатов */
	icecandidate: (event: IceCandidateEvent) => void;
	/** События SDP */
	sdp: (event: SDPEvent) => void;
};

/**
 * Информация о звонковой линии
 */
export type CallLine = {
	/** Уникальный идентификатор линии */
	id: string;
	/** Номер или SIP URI собеседника */
	target: string;
	/** Направление звонка */
	direction: SessionDirection;
	/** Статус звонка */
	status: RTCSession["status"];
	/** Находится ли на удержании */
	isHeld: boolean;
};

/**
 * Информация об аудио устройстве
 */
export type AudioDevice = {
	/** ID устройства */
	deviceId: string;
	/** Название устройства */
	label: string;
	/** Тип устройства */
	kind: "audioinput" | "audiooutput";
};

/**
 * Создает экземпляр SIP-клиента
 * @param props Конфигурация клиента
 */
export function createSipInstance(props: CreateSipInstanceProps) {
	// Значения по умолчанию
	const defaultWSUrl = props.ssl ? "wss://webrtc.exolve.ru:8443" : "ws://webrtc.exolve.ru:8080";
	const defaultRealm = "80.75.132.120";
	const defaultStunList = ["stun:webrtc.exolve.ru:3479"];

	const environment = {
		WSUri: props.WSUrl || defaultWSUrl,
		realm: props.realm || defaultRealm,
	};

	// Создаем WebSocket подключение
	const socket = new JsSIP.WebSocketInterface(environment.WSUri);

	// Настройки звонков
	const callOptions: CallOptions = {
		mediaConstraints: { audio: true, video: false },
		sessionTimersExpires: 500,
		pcConfig: {
			iceServers: [
				{
					urls: props.stunServers || defaultStunList,
				},
			],
			// Для Safari - без принудительного BUNDLE
			sdpSemantics: "unified-plan", // Критично для Safari
		} as RTCConfiguration,
		rtcOfferConstraints: {
			offerToReceiveAudio: true,
			offerToReceiveVideo: false,
		},
		...(props.callOptions || {}),
	};

	// Генерируем уникальный ID для контакта
	const uniqueID = nanoid();
	const contactUri = `sip:${props.sipLogin}-${uniqueID}@${uniqueID}.invalid`;

	// Создаем JsSIP UA (User Agent)
	const SIPInstance = new JsSIP.UA({
		uri: `sip:${props.sipLogin}@${environment.realm}`,
		realm: environment.realm,
		sockets: [socket],
		password: props.sipPassword,
		contact_uri: contactUri,
		display_name: props.sipLogin,
		register_expires: 100,
		...(props.UAConfig || {}),
	});

	// Включаем отладку если нужно
	props.debug && JsSIP.debug.enable("JsSIP:*");

	// Хранилище активных звонков
	const activeCalls = new Map<string, RTCSession>();
	let currentCallId: string | null = null;

	// Текущие аудио устройства
	let currentMicrophoneId: string | null = null;
	let currentSpeakerId: string | null = null;

	// Вспомогательная функция для уведомления об изменении линии
	const notifyLineChanged = (session: RTCSession, id: string) => {
		if (props.lineEvents?.onLineChanged) {
			props.lineEvents.onLineChanged({
				id,
				target: session.remote_identity.uri.toString(),
				direction: session.direction,
				status: session.status,
				isHeld: session.isOnHold().local,
			});
		}
	};

	// Вспомогательная функция для уведомления об изменении активной линии
	const notifyActiveLineChanged = (lineId: string | null) => {
		if (props.lineEvents?.onActiveLineChanged) {
			props.lineEvents.onActiveLineChanged(lineId);
		}
	};

	// Вспомогательная функция для получения следующей линии
	const getNextLineId = (): string | null => {
		const iterator = activeCalls.keys();
		const next = iterator.next();
		return next.done ? null : next.value;
	};

	return {
		/** Получить экземпляр JsSIP UA */
		get SIPInstance() {
			return SIPInstance;
		},

		/**
		 * Зарегистрироваться на SIP-сервере
		 * @throws {Error} Если регистрация не удалась или таймаут
		 */
		async register() {
			const registerPromise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject("registration timeout"), 2000);

				SIPInstance.on("registered", e => {
					clearTimeout(timeout);
					resolve(e);
				});

				SIPInstance.on("registrationFailed", e => {
					clearTimeout(timeout);
					reject(e);
				});
			});

			SIPInstance.start();
			return await registerPromise;
		},

		/**
		 * Отменить регистрацию на SIP-сервере
		 */
		async unregister() {
			SIPInstance.stop();
			return new Promise(resolve => SIPInstance.on("unregistered", resolve));
		},

		/**
		 * Обработчик входящих звонков
		 * @param cb Функция обратного вызова
		 */
		onIncomingCall(cb: (args: OnIncomingCallCbArgs) => void) {
			SIPInstance.on("newRTCSession", (event: IncomingRTCSessionEvent) => {
				if (event.originator !== Originator.REMOTE) return;

				// Проверяем лимит линий
				if (props.maxLines && activeCalls.size >= props.maxLines) {
					event.session.terminate({
						status_code: 486,
						reason_phrase: "Maximum calls reached",
					});
					return;
				}

				const { session } = event;
				const callId = nanoid();

				// Добавляем входящий звонок в хранилище
				activeCalls.set(callId, session);

				// Уведомляем о новой линии
				if (props.lineEvents?.onLineAdded) {
					props.lineEvents.onLineAdded({
						id: callId,
						target: session.remote_identity.uri.toString(),
						direction: session.direction,
						status: session.status,
						isHeld: false,
					});
				}

				const accept = () => {
					session.answer(callOptions);
					// Если уже есть активный звонок, ставим его на удержание
					if (currentCallId) {
						const currentSession = activeCalls.get(currentCallId);
						if (currentSession) {
							currentSession.hold();
							notifyLineChanged(currentSession, currentCallId);
						}
					}
					currentCallId = callId;
					notifyActiveLineChanged(callId);
				};

				const decline = () => {
					session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
					activeCalls.delete(callId);
					if (props.lineEvents?.onLineRemoved) {
						props.lineEvents.onLineRemoved(callId);
					}
				};

				// Отслеживаем изменения состояния
				session.on("hold", () => notifyLineChanged(session, callId));
				session.on("unhold", () => notifyLineChanged(session, callId));
				session.on("muted", () => notifyLineChanged(session, callId));
				session.on("unmuted", () => notifyLineChanged(session, callId));
				session.on("confirmed", () => notifyLineChanged(session, callId));

				// Удаляем звонок из хранилища при завершении
				session.on("ended", () => {
					activeCalls.delete(callId);
					if (props.lineEvents?.onLineRemoved) {
						props.lineEvents.onLineRemoved(callId);
					}
					if (currentCallId === callId) {
						const nextLineId = getNextLineId();
						currentCallId = nextLineId;
						notifyActiveLineChanged(nextLineId);
					}
				});

				session.on("failed", () => {
					activeCalls.delete(callId);
					if (props.lineEvents?.onLineRemoved) {
						props.lineEvents.onLineRemoved(callId);
					}
					if (currentCallId === callId) {
						const nextLineId = getNextLineId();
						currentCallId = nextLineId;
						notifyActiveLineChanged(nextLineId);
					}
				});

				return cb({ accept, decline, event });
			});
		},

		/**
		 * Подписаться на события SIP-соединения
		 * @param events Обработчики событий
		 */
		// prettier-ignore
		onConnectionEvent(events: Partial<SipConnectionEvents>) {
			if (events.connecting) {
				SIPInstance.on("connecting", events.connecting);
			}
			if (events.connected) {
				SIPInstance.on("connected", events.connected);
			}
			if (events.disconnected) {
				SIPInstance.on("disconnected", events.disconnected);
			}
			if (events.registrationExpiring) {
				SIPInstance.on("registrationExpiring", events.registrationExpiring);
			}
			if (events.registered) {
				SIPInstance.on("registered", events.registered);
			}
		},

		/**
		 * Совершить исходящий звонок
		 * @param target Номер телефона или SIP URI
		 * @param events Обработчики событий звонка
		 */
		// prettier-ignore
		async call(target: string, events?: Partial<CallSessionEvents>) {
			// Проверяем лимит линий до создания сессии
			if (props.maxLines && activeCalls.size >= props.maxLines) {
				throw new Error("Maximum calls reached");
			}

			const session = SIPInstance.call(target, callOptions);
			const callId = nanoid();

			// Добавляем звонок в хранилище
			activeCalls.set(callId, session);

			// Уведомляем о новой линии
			if (props.lineEvents?.onLineAdded) {
				props.lineEvents.onLineAdded({
					id: callId,
					target: session.remote_identity.uri.toString(),
					direction: session.direction,
					status: session.status,
					isHeld: false
				});
			}

			// Если это первый звонок, делаем его активным
			if (!currentCallId) {
				currentCallId = callId;
				notifyActiveLineChanged(callId);
			} else {
				// Иначе сразу ставим на удержание
				session.once('confirmed', () => {
					session.hold();
					notifyLineChanged(session, callId);
				});
			}

			// Отслеживаем изменения состояния
			session.on("hold", () => notifyLineChanged(session, callId));
			session.on("unhold", () => notifyLineChanged(session, callId));
			session.on("muted", () => notifyLineChanged(session, callId));
			session.on("unmuted", () => notifyLineChanged(session, callId));
			session.on("confirmed", () => notifyLineChanged(session, callId));

			// Удаляем звонок из хранилища при завершении
			session.on('ended', () => {
				activeCalls.delete(callId);
				if (props.lineEvents?.onLineRemoved) {
					props.lineEvents.onLineRemoved(callId);
				}
				if (currentCallId === callId) {
					const nextLineId = getNextLineId();
					currentCallId = nextLineId;
					notifyActiveLineChanged(nextLineId);
				}
			});

			session.on('failed', () => {
				activeCalls.delete(callId);
				if (props.lineEvents?.onLineRemoved) {
					props.lineEvents.onLineRemoved(callId);
				}
				if (currentCallId === callId) {
					const nextLineId = getNextLineId();
					currentCallId = nextLineId;
					notifyActiveLineChanged(nextLineId);
				}
			});

			// Применяем текущие аудио устройства если они установлены
			if (currentMicrophoneId) {
				navigator.mediaDevices.getUserMedia({
					audio: { deviceId: { exact: currentMicrophoneId } }
				}).then(stream => {
					const audioTrack = stream.getAudioTracks()[0];
					session.connection.getSenders()
						.find(s => s.track?.kind === 'audio')
						?.replaceTrack(audioTrack);
				}).catch(console.error);
			}

			// Добавляем data-атрибут к аудио элементу для идентификации
			session.on('confirmed', () => {
				const audioElement = document.querySelector(`audio[data-session-id="${session.id}"]`);
				if (audioElement && currentSpeakerId) {
					// @ts-ignore
					audioElement.setSinkId(currentSpeakerId).catch(console.error);
				}
			});

			if (events) {
				if (events.connecting) session.on("connecting", events.connecting);
				if (events.progress) session.on("progress", events.progress);
				if (events.failed) session.on("failed", events.failed);
				if (events.ended) session.on("ended", events.ended);
				if (events.confirmed) session.on("confirmed", events.confirmed);
				if (events.newDTMF) session.on("newDTMF", events.newDTMF);
				if (events.icecandidate) session.on("icecandidate", events.icecandidate);
				if (events.sdp) session.on("sdp", events.sdp);
			}

			session.on("icecandidate", function (candidate) {
				candidate.ready();
			});

			return {
				/** Оригинальная сессия JsSIP */
				session,

				/** Завершить звонок */
				terminate() {
					session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
				},

				/** Выключить микрофон */
				mute() {
					if (session.isMuted().audio) return;
					session.mute({ audio: true });
				},

				/** Включить микрофон */
				unmute() {
					if (!session.isMuted().audio) return;
					session.unmute({ audio: true });
				},

				/** Поставить звонок на удержание */
				hold() {
					if (session.isOnHold().local) return;
					session.hold();
				},

				/** Снять звонок с удержания */
				unhold() {
					if (!session.isOnHold().local) return;
					session.unhold();
				},

				/**
				 * Отправить DTMF сигнал
				 * @param tone DTMF тон (0-9,A-D,*,#)
				 * @param options Дополнительные настройки
				 */
				sendDTMF(tone: string, options?: DTFMOptions) {
					session.sendDTMF(tone, options);
				},

				/**
				 * Перезапустить медиа-переговоры
				 * @param options Настройки переговоров
				 */
				renegotiate(options?: RenegotiateOptions) {
					session.renegotiate(options);
				},

				/** Проверить, находится ли звонок на удержании */
				isOnHold() {
					return session.isOnHold().local;
				},

				/** Проверить, выключен ли микрофон */
				isMuted() {
					return session.isMuted().audio;
				},

				/**
				 * Перевести звонок на другой номер
				 * @param target Номер телефона или SIP URI
				 * @param options Настройки переадресации
				 */
				refer(target: string, options?: ReferOptions) {
					session.refer(target, options);
				},

				/**
				 * Сбросить локальные медиа-настройки
				 * Полезно при проблемах с аудио
				 */
				resetLocalMedia() {
					session.resetLocalMedia();
				},

				/**
				 * Проверить, установлен ли звонок
				 */
				isEstablished() {
					return session.isEstablished();
				},

				/**
				 * Проверить, завершен ли звонок
				 */
				isEnded() {
					return session.isEnded();
				},

				/**
				 * Проверить, идет ли установка звонка
				 */
				isInProgress() {
					return session.isInProgress();
				},

				/**
				 * Проверить, готов ли звонок к повторным медиа-переговорам
				 */
				isReadyToReOffer() {
					return session.isReadyToReOffer();
				},

				/**
				 * Поставить звонок на удержание с дополнительными опциями
				 * @param options Настройки удержания
				 * @param done Колбэк после выполнения
				 */
				holdWithOptions(options?: HoldOptions, done?: () => void) {
					return session.hold(options, done);
				},

				/**
				 * Снять звонок с удержания с дополнительными опциями
				 * @param options Настройки удержания
				 * @param done Колбэк после выполнения
				 */
				unholdWithOptions(options?: HoldOptions, done?: () => void) {
					return session.unhold(options, done);
				},

				/**
				 * Управление медиа-потоками
				 * @param constraints Ограничения медиа
				 */
				muteWithConstraints(constraints: { audio?: boolean; video?: boolean }) {
					session.mute(constraints);
				},

				/**
				 * Управление медиа-потоками
				 * @param constraints Ограничения медиа
				 */
				unmuteWithConstraints(constraints: { audio?: boolean; video?: boolean }) {
					session.unmute(constraints);
				},

				/**
				 * Получить время начала звонка
				 */
				getStartTime() {
					return session.start_time;
				},

				/**
				 * Получить время завершения звонка
				 */
				getEndTime() {
					return session.end_time;
				},

				/**
				 * Получить направление звонка (входящий/исходящий)
				 */
				getDirection() {
					return session.direction;
				},

				/**
				 * Получить информацию о собеседнике
				 */
				getRemoteIdentity() {
					return session.remote_identity;
				},

				/**
				 * Получить локальный SIP URI
				 */
				getLocalIdentity() {
					return session.local_identity;
				},

				/**
				 * Получить текущий статус звонка
				 */
				getStatus() {
					return session.status;
				},

				/**
				 * Получить RTCPeerConnection для прямого управления WebRTC
				 */
				getConnection() {
					return session.connection;
				},

				/**
				 * Получить ID линии
				 */
				getLineId() {
					return callId;
				},

				/**
				 * Проверить, является ли линия активной
				 */
				isCurrentLine() {
					return callId === currentCallId;
				}
			};
		},

		/**
		 * Завершить все активные звонки
		 * @param options Настройки завершения
		 */
		terminateSessions(options?: TerminateOptions) {
			SIPInstance.terminateSessions(options);
		},

		/**
		 * Проверить, зарегистрирован ли клиент на SIP-сервере
		 */
		isRegistered() {
			return SIPInstance.isRegistered();
		},

		/**
		 * Проверить, установлено ли соединение с SIP-сервером
		 */
		isConnected() {
			return SIPInstance.isConnected();
		},

		/**
		 * Получить список активных звонков
		 */
		getCallLines(): CallLine[] {
			const lines: CallLine[] = [];
			activeCalls.forEach((session, id) => {
				lines.push({
					id,
					target: session.remote_identity.uri.toString(),
					direction: session.direction,
					status: session.status,
					isHeld: session.isOnHold().local,
				});
			});
			return lines;
		},

		/**
		 * Получить текущую активную линию
		 */
		getCurrentLine(): string | null {
			return currentCallId;
		},

		/**
		 * Переключиться на другую линию
		 * @param lineId ID линии для активации
		 */
		async switchLine(lineId: string) {
			const targetSession = activeCalls.get(lineId);
			if (!targetSession) {
				throw new Error("Line not found");
			}

			// Если есть текущий активный звонок, ставим его на удержание
			if (currentCallId && currentCallId !== lineId) {
				const currentSession = activeCalls.get(currentCallId);
				if (currentSession && !currentSession.isOnHold().local) {
					await new Promise<void>(resolve => {
						currentSession.hold(undefined, () => {
							notifyLineChanged(currentSession, currentCallId!);
							resolve();
						});
					});
				}
			}

			// Снимаем новую линию с удержания если нужно
			if (targetSession.isOnHold().local) {
				await new Promise<void>(resolve => {
					targetSession.unhold(undefined, () => {
						notifyLineChanged(targetSession, lineId);
						resolve();
					});
				});
			}

			currentCallId = lineId;
			notifyActiveLineChanged(lineId);
		},

		/**
		 * Проверить, можно ли добавить новую линию
		 */
		canAddLine(): boolean {
			return !props.maxLines || activeCalls.size < props.maxLines;
		},

		/**
		 * Слепой перевод звонка (без сопровождения)
		 * @param fromLineId ID линии, которую переводим
		 * @param target Номер телефона или SIP URI для перевода
		 */
		async blindTransfer(fromLineId: string, target: string) {
			const fromSession = activeCalls.get(fromLineId);
			if (!fromSession) {
				throw new Error("Line not found");
			}

			// Проверяем, что линия установлена
			if (!fromSession.isEstablished()) {
				throw new Error("Call must be established");
			}

			// Отправляем REFER напрямую на указанный номер
			fromSession.refer(target);

			// После успешного REFER завершаем текущую линию
			fromSession.once("referAccepted", () => {
				fromSession.terminate();
			});

			fromSession.once("referFailed", () => {
				throw new Error("Blind transfer failed");
			});
		},

		/**
		 * Объединить две линии (перевод звонка)
		 * @param fromLineId ID линии, которую переводим
		 * @param toLineId ID линии, на которую переводим
		 */
		async transferCall(fromLineId: string, toLineId: string) {
			const fromSession = activeCalls.get(fromLineId);
			const toSession = activeCalls.get(toLineId);
			if (!fromSession || !toSession) {
				throw new Error("Line not found");
			}

			// Проверяем, что линия установлена
			if (!fromSession.isEstablished()) {
				throw new Error("Call must be established");
			}

			// Отправляем REFER без опции replaces для blind transfer
			fromSession.refer(toSession.remote_identity.uri.toString());

			// После успешного REFER завершаем текущую линию
			fromSession.once("referAccepted", () => {
				fromSession.terminate();
			});

			fromSession.once("referFailed", () => {
				throw new Error("Transfer failed");
			});
		},

		/**
		 * Найти линию по номеру телефона
		 * @param target Номер телефона или SIP URI
		 */
		findLineByTarget(target: string): CallLine | null {
			for (const [id, session] of activeCalls) {
				if (session.remote_identity.uri.toString() === target) {
					return {
						id,
						target,
						direction: session.direction,
						status: session.status,
						isHeld: session.isOnHold().local,
					};
				}
			}
			return null;
		},

		/**
		 * Завершить конкретную линию
		 * @param lineId ID линии для завершения
		 */
		terminateLine(lineId: string) {
			const session = activeCalls.get(lineId);
			if (session) {
				session.terminate();
			}
		},

		/**
		 * Получить список доступных аудио устройств
		 * @returns Список аудио устройств
		 * @throws {Error} Если нет доступа к медиа устройствам
		 */
		// prettier-ignore
		async getAudioDevices(): Promise<AudioDevice[]> {
			try {
				await navigator.mediaDevices.getUserMedia({ audio: true });
				const devices = await navigator.mediaDevices.enumerateDevices();
				return devices
					.filter(device => device.kind === "audioinput" || device.kind === "audiooutput")
					.map(device => ({
						deviceId: device.deviceId,
						label: device.label,
						kind: device.kind as "audioinput" | "audiooutput",
					}));
			} catch (error) {
				throw new Error("Failed to get audio devices: " + (error as Error).message);
			}
		},

		/**
		 * Получить текущий микрофон
		 */
		getCurrentMicrophone(): string | null {
			return currentMicrophoneId;
		},

		/**
		 * Получить текущий динамик
		 */
		getCurrentSpeaker(): string | null {
			return currentSpeakerId;
		},

		/**
		 * Установить микрофон для всех активных звонков
		 * @param deviceId ID микрофона
		 */
		async setMicrophone(deviceId: string) {
			// Проверяем существование устройства
			const devices = await this.getAudioDevices();
			const device = devices.find((d: AudioDevice) => d.deviceId === deviceId && d.kind === "audioinput");
			if (!device) {
				throw new Error("Microphone not found");
			}

			currentMicrophoneId = deviceId;

			// Применяем ко всем активным звонкам
			for (const [_, session] of activeCalls) {
				if (session.isEstablished()) {
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: { deviceId: { exact: deviceId } },
					});

					const audioTrack = stream.getAudioTracks()[0];
					const sender = session.connection.getSenders().find(s => s.track?.kind === "audio");
					if (sender) {
						await sender.replaceTrack(audioTrack);
					}
				}
			}
		},

		/**
		 * Установить динамик для всех активных звонков
		 * @param deviceId ID динамика
		 */
		async setSpeaker(deviceId: string) {
			// @ts-ignore (setSinkId может быть не определен в некоторых браузерах)
			if (!HTMLAudioElement.prototype.setSinkId) {
				throw new Error("Speaker selection is not supported in this browser");
			}

			// Проверяем существование устройства
			const devices = await this.getAudioDevices();
			const device = devices.find((d: AudioDevice) => d.deviceId === deviceId && d.kind === "audiooutput");
			if (!device) {
				throw new Error("Speaker not found");
			}

			currentSpeakerId = deviceId;

			// Применяем ко всем активным звонкам
			for (const [_, session] of activeCalls) {
				if (session.isEstablished()) {
					const audioElement = document.querySelector(`audio[data-session-id="${session.id}"]`);
					if (audioElement) {
						// @ts-ignore
						await audioElement.setSinkId(deviceId);
					}
				}
			}
		},
	};
}

// prettier-ignore
export type SIPInstance = ReturnType<typeof createSipInstance>;
