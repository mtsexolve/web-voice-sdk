# Web Voice SDK

Библиотека для работы с VoIP-телефонией в браузере, построенная на основе JsSIP.

## Содержание

- [Установка](#установка)
- [Основные возможности](#основные-возможности)
- [Быстрый старт](#быстрый-старт)
- [Подробное руководство](#подробное-руководство)
  - [Инициализация](#инициализация)
  - [Управление соединением](#управление-соединением)
  - [Входящие звонки](#входящие-звонки)
  - [Исходящие звонки](#исходящие-звонки)
  - [Управление звонком](#управление-звонком)
  - [Работа с линиями](#работа-с-линиями)
  - [Аудио устройства](#аудио-устройства)
  - [DTMF и IVR](#dtmf-и-ivr)
  - [Статистика и диагностика](#статистика-и-диагностика)
  - [Обработка ошибок](#обработка-ошибок)
- [TypeScript](#typescript)
- [Браузерная поддержка](#браузерная-поддержка)
- [Ограничения](#ограничения)
- [Лицензия](#лицензия)

## Установка

```bash
npm install web-voice-sdk
# или
yarn add web-voice-sdk
```

## Основные возможности

- 📞 Поддержка входящих и исходящих звонков
- 🔄 Управление несколькими линиями одновременно
- 🎚️ Управление аудио устройствами (микрофон/динамики)
- ⏸️ Постановка звонков на удержание
- 🔇 Управление микрофоном (mute/unmute)
- 📱 Отправка DTMF сигналов
- ↗️ Переадресация звонков
- 📊 Получение статистики звонков

## Быстрый старт

```typescript
import { createSipInstance } from "web-voice-sdk";

// Создание экземпляра SIP-клиента
const sip = createSipInstance({
	sipLogin: "your_login",
	sipPassword: "your_password",
	// Опционально: свои настройки
	WSUrl: "ws://your-sip-server:8080",
	realm: "your-sip-domain",
	debug: true,
});

// Регистрация на SIP-сервере
await sip.register();

// Обработка входящих звонков
sip.onIncomingCall(({ accept, decline, event }) => {
	const caller = event.session.remote_identity.uri.toString();
	console.log(`Входящий звонок от ${caller}`);

	// Принять звонок
	accept();
	// Или отклонить
	// decline();
});

// Совершить исходящий звонок
const call = await sip.call("sip:user@domain.com", {
	// События звонка
	confirmed: () => console.log("Звонок установлен"),
	ended: () => console.log("Звонок завершен"),
	failed: e => console.log("Ошибка звонка:", e),
});

// Управление звонком
call.mute(); // Выключить микрофон
call.unmute(); // Включить микрофон
call.hold(); // Поставить на удержание
call.unhold(); // Снять с удержания
call.terminate(); // Завершить звонок
```

## Подробное руководство

### Инициализация

Создание экземпляра с полной конфигурацией:

```typescript
const sip = createSipInstance({
	// Обязательные параметры
	sipLogin: "your_login",
	sipPassword: "your_password",

	// Настройки подключения
	WSUrl: "ws://your-sip-server:8080", // WebSocket URL
	realm: "your-sip-domain", // SIP домен
	ssl: true, // Использовать WSS вместо WS

	// Настройки звонков
	maxLines: 3, // Максимальное количество линий
	debug: true, // Включить отладку

	// STUN серверы для WebRTC
	stunServers: ["stun:stun.example.com:3478"],

	// Дополнительные настройки JsSIP
	UAConfig: {
		register_expires: 300,
		session_timers: false,
		use_preloaded_route: true,
	},

	// Настройки для звонков
	callOptions: {
		mediaConstraints: { audio: true, video: false },
		rtcOfferConstraints: {
			offerToReceiveAudio: true,
			offerToReceiveVideo: false,
		},
	},
});
```

### Управление соединением

```typescript
// Подписка на события соединения
sip.onConnectionEvent({
	// Начало подключения
	connecting: () => {
		console.log("Подключение к серверу...");
	},

	// Успешное подключение
	connected: () => {
		console.log("Подключено к серверу");
	},

	// Отключение
	disconnected: event => {
		console.log("Отключено от сервера:", event.cause);
	},

	// Успешная регистрация
	registered: event => {
		console.log("Зарегистрировано на сервере", {
			expiresIn: event.expires,
			contact: event.contact,
		});
	},

	// Регистрация скоро истечет
	registrationExpiring: () => {
		console.log("Регистрация скоро истечет");
	},
});

// Проверка состояния
if (sip.isRegistered()) {
	console.log("Клиент зарегистрирован");
}

if (sip.isConnected()) {
	console.log("Клиент подключен");
}

// Отмена регистрации
await sip.unregister();
```

### Входящие звонки

```typescript
sip.onIncomingCall(({ accept, decline, event }) => {
	// Информация о звонящем
	const caller = event.session.remote_identity.uri.toString();
	const displayName = event.session.remote_identity.display_name;

	console.log(`Входящий звонок от ${displayName} <${caller}>`);

	// Проверка возможности принять звонок
	if (sip.canAddLine()) {
		// Принять звонок с обработчиками событий
		accept();

		const session = event.session;

		// Подписка на события звонка
		session.on("confirmed", () => {
			console.log("Звонок установлен");
		});

		session.on("ended", () => {
			console.log("Звонок завершен");
		});

		session.on("failed", e => {
			console.log("Ошибка звонка:", e);
		});
	} else {
		// Отклонить если достигнут лимит линий
		decline();
	}
});
```

### Исходящие звонки

```typescript
// Базовый звонок
const call = await sip.call("sip:user@domain.com");

// Звонок с полной конфигурацией событий
const callWithEvents = await sip.call("sip:user@domain.com", {
	// Этап установки соединения
	connecting: event => {
		console.log("Устанавливается соединение", event);
	},

	// Идет дозвон
	progress: () => {
		console.log("Идет дозвон...");
	},

	// Звонок установлен
	confirmed: () => {
		console.log("Звонок установлен");
	},

	// Звонок завершен
	ended: event => {
		console.log("Звонок завершен", event.cause);
	},

	// Ошибка звонка
	failed: event => {
		console.log("Ошибка звонка", event.cause);
	},

	// Изменение состояния микрофона
	muted: () => console.log("Микрофон выключен"),
	unmuted: () => console.log("Микрофон включен"),

	// Изменение состояния удержания
	held: () => console.log("Звонок на удержании"),
	unheld: () => console.log("Звонок снят с удержания"),

	// Получение DTMF
	newDTMF: event => {
		console.log("Получен DTMF:", event.dtmf);
	},

	// События WebRTC
	icecandidate: event => {
		console.log("Новый ICE кандидат", event);
	},

	sdp: event => {
		console.log("Новый SDP", event);
	},
});
```

### Управление звонком

```typescript
// Базовое управление
call.mute(); // Выключить микрофон
call.unmute(); // Включить микрофон
call.hold(); // Поставить на удержание
call.unhold(); // Снять с удержания
call.terminate(); // Завершить звонок

// Расширенное управление микрофоном
call.muteWithConstraints({ audio: true }); // Только звук
call.unmuteWithConstraints({ audio: true });

// Расширенное управление удержанием
call.holdWithOptions(
	{
		useUpdate: true, // Использовать UPDATE вместо INVITE
	},
	() => {
		console.log("Звонок поставлен на удержание");
	},
);

call.unholdWithOptions(
	{
		useUpdate: true,
	},
	() => {
		console.log("Звонок снят с удержания");
	},
);

// Проверка состояния
console.log({
	isOnHold: call.isOnHold(),
	isMuted: call.isMuted(),
	isEstablished: call.isEstablished(),
	isEnded: call.isEnded(),
	isInProgress: call.isInProgress(),
	canReOffer: call.isReadyToReOffer(),
});

// Получение информации
console.log({
	startTime: call.getStartTime(),
	endTime: call.getEndTime(),
	direction: call.getDirection(),
	status: call.getStatus(),
	remoteIdentity: call.getRemoteIdentity(),
	localIdentity: call.getLocalIdentity(),
});

// Управление WebRTC
const rtcConnection = call.getConnection();
rtcConnection.getStats().then(stats => {
	console.log("Статистика WebRTC:", stats);
});
```

### Работа с линиями

```typescript
// События линий
const sip = createSipInstance({
	sipLogin: "login",
	sipPassword: "password",
	maxLines: 3,
	lineEvents: {
		// Добавлена новая линия
		onLineAdded: line => {
			console.log("Новая линия:", {
				id: line.id,
				target: line.target,
				direction: line.direction,
				status: line.status,
				isHeld: line.isHeld,
			});
		},

		// Удалена линия
		onLineRemoved: lineId => {
			console.log("Удалена линия:", lineId);
		},

		// Изменилось состояние линии
		onLineChanged: line => {
			console.log("Изменена линия:", line);
		},

		// Изменилась активная линия
		onActiveLineChanged: lineId => {
			console.log("Активная линия:", lineId);
		},
	},
});

// Управление линиями
const lines = sip.getCallLines(); // Получить все линии
const currentLine = sip.getCurrentLine(); // Получить текущую линию

// Поиск линии
const line = sip.findLineByTarget("sip:user@domain.com");
if (line) {
	console.log("Найдена линия:", line);
}

// Переключение между линиями
await sip.switchLine("line_id");

// Перевод звонка
await sip.transferCall("from_line_id", "to_line_id");

// Завершение линии
sip.terminateLine("line_id");

// Проверка возможности добавления линии
if (sip.canAddLine()) {
	console.log("Можно добавить новую линию");
}
```

### Аудио устройства

```typescript
// Получение списка устройств
const devices = await sip.getAudioDevices();
console.log(
	"Доступные устройства:",
	devices.map(d => ({
		id: d.deviceId,
		name: d.label,
		type: d.kind,
	})),
);

// Получение текущих устройств
const currentMic = sip.getCurrentMicrophone();
const currentSpeaker = sip.getCurrentSpeaker();

// Установка устройств
try {
	// Установка микрофона
	await sip.setMicrophone("microphone_id");
	console.log("Микрофон установлен");

	// Установка динамика
	await sip.setSpeaker("speaker_id");
	console.log("Динамик установлен");
} catch (error) {
	console.error("Ошибка установки устройства:", error);
}
```

### DTMF и IVR

```typescript
// Базовая отправка DTMF
call.sendDTMF("1");

// Расширенная отправка DTMF
call.sendDTMF("1", {
	duration: 100, // Длительность сигнала (мс)
	interToneGap: 50, // Пауза между сигналами (мс)
	transportType: "RFC2833", // Тип передачи
});

// Пример работы с IVR меню
call.sendDTMF("1"); // "Нажмите 1 для соединения с оператором"
await new Promise(resolve => setTimeout(resolve, 2000));
call.sendDTMF("3"); // "Нажмите 3 для подтверждения"

// Прослушивание входящих DTMF
const session = call.session;
session.on("newDTMF", event => {
	console.log("Получен DTMF:", {
		tone: event.dtmf.tone,
		duration: event.dtmf.duration,
	});
});
```

### Статистика и диагностика

```typescript
// Получение WebRTC статистики
const rtcConnection = call.getConnection();
const stats = await rtcConnection.getStats();

// Анализ статистики
stats.forEach(report => {
	if (report.type === "inbound-rtp") {
		console.log("Входящий поток:", {
			packetsReceived: report.packetsReceived,
			packetsLost: report.packetsLost,
			jitter: report.jitter,
		});
	} else if (report.type === "outbound-rtp") {
		console.log("Исходящий поток:", {
			packetsSent: report.packetsSent,
			bytesSent: report.bytesSent,
		});
	}
});

// Информация о звонке
console.log("Информация о звонке:", {
	direction: call.getDirection(),
	duration: call.getEndTime() - call.getStartTime(),
	status: call.getStatus(),
	remote: call.getRemoteIdentity(),
	local: call.getLocalIdentity(),
});

// Проверка состояния соединения
if (sip.isConnected() && sip.isRegistered()) {
	console.log("Соединение активно");
}
```

### Обработка ошибок

```typescript
try {
	// Регистрация
	await sip.register();
} catch (error) {
	console.error("Ошибка регистрации:", error);
}

// Обработка ошибок звонка
const call = await sip.call("sip:user@domain.com", {
	failed: event => {
		switch (event.cause) {
			case "Busy":
				console.log("Абонент занят");
				break;
			case "Rejected":
				console.log("Звонок отклонен");
				break;
			case "Not Found":
				console.log("Абонент не найден");
				break;
			case "WebRTC Error":
				console.log("Ошибка WebRTC");
				break;
			default:
				console.log("Ошибка звонка:", event.cause);
		}
	},
});

// Обработка ошибок аудио устройств
try {
	await sip.setMicrophone("device_id");
} catch (error) {
	if (error.message.includes("Permission denied")) {
		console.error("Нет доступа к микрофону");
	} else if (error.message.includes("not found")) {
		console.error("Устройство не найдено");
	} else {
		console.error("Ошибка установки микрофона:", error);
	}
}

// Обработка ошибок линий
try {
	await sip.switchLine("non_existent_line");
} catch (error) {
	console.error("Ошибка переключения линии:", error);
}
```

## TypeScript

Библиотека полностью типизирована. Основные типы:

```typescript
// Конфигурация SIP-клиента
type CreateSipInstanceProps = {
	sipLogin: string;
	sipPassword: string;
	WSUrl?: string;
	realm?: string;
	maxLines?: number;
	debug?: boolean;
	ssl?: boolean;
	stunServers?: string[];
	UAConfig?: UAConfiguration;
	callOptions?: CallOptions;
	lineEvents?: LineEvents;
};

// Информация о линии
type CallLine = {
	id: string;
	target: string;
	direction: SessionDirection;
	status: string;
	isHeld: boolean;
};

// Аудио устройство
type AudioDevice = {
	deviceId: string;
	label: string;
	kind: "audioinput" | "audiooutput";
};

// События звонка
type CallSessionEvents = {
	connecting?: (event: ConnectingEvent) => void;
	progress?: () => void;
	failed?: (event: EndEvent) => void;
	ended?: (event: EndEvent) => void;
	confirmed?: () => void;
	muted?: () => void;
	unmuted?: () => void;
	held?: () => void;
	unheld?: () => void;
	newDTMF?: (event: IncomingDTMFEvent) => void;
	refer?: () => void;
	replaces?: () => void;
	icecandidate?: (event: IceCandidateEvent) => void;
	sdp?: (event: SDPEvent) => void;
};

// События линий
type LineEvents = {
	onLineAdded: (line: CallLine) => void;
	onLineRemoved: (lineId: string) => void;
	onLineChanged: (line: CallLine) => void;
	onActiveLineChanged: (lineId: string | null) => void;
};

// События соединения
type SipConnectionEvents = {
	connecting: () => void;
	connected: () => void;
	disconnected: (event: DisconnectEvent) => void;
	registrationExpiring: () => void;
	registered: (event: RegisteredEvent) => void;
};
```

## Браузерная поддержка

Библиотека работает во всех современных браузерах, поддерживающих WebRTC:

- Chrome/Chromium (Desktop & Android)
- Firefox (Desktop & Android)
- Safari (Desktop & iOS)
- Edge (Chromium-based)

### Особенности браузеров

#### Chrome

- Полная поддержка всех функций
- Лучшая производительность WebRTC
- Поддержка выбора аудио устройств

#### Firefox

- Хорошая поддержка WebRTC
- Могут быть проблемы с некоторыми STUN/TURN серверами
- Ограниченная поддержка выбора динамиков

#### Safari

- Базовая поддержка WebRTC
- Проблемы с удержанием звонков
- Нет поддержки выбора динамиков
- Требуется явное разрешение на доступ к медиа

#### Edge

- Аналогично Chrome (использует Chromium)
- Полная поддержка всех функций

## Ограничения

1. Аудио устройства:

   - Выбор динамика работает только в Chrome и Edge
   - Требуется HTTPS для доступа к медиа устройствам
   - Необходимо разрешение пользователя

2. WebRTC:

   - Требуется поддержка браузером
   - Может блокироваться файрволами
   - Нужны STUN/TURN серверы для работы через NAT

3. Сеть:

   - Требуется стабильное соединение
   - WebSocket должен быть доступен
   - Порты для WebRTC должны быть открыты

4. Safari:
   - Ограниченная поддержка WebRTC
   - Проблемы с удержанием
   - Особые требования к медиа

## Лицензия

MIT
