# Web Voice SDK Demo

Демонстрационное приложение для работы с Web Voice SDK.

## Установка

```bash
# Установка зависимостей
npm install
# или
yarn install
```

## Запуск

```bash
# Запуск в режиме разработки
npm run dev
# или
yarn dev
```

Приложение будет доступно по адресу `http://localhost:5173`

## Настройка подключения к SIP-серверу

Настройки подключения находятся в файле `src/stores/settings.ts`.

По умолчанию используются следующие параметры:

```typescript
{
  WSUrl: "ws://webrtc.exolve.ru:8080",  // WebSocket URL сервера
  realm: "80.75.132.120",               // SIP домен
  stunServers: ["webrtc.exolve.ru:3479"], // STUN серверы
  debug: true,                          // Режим отладки
  ssl: false                            // Использовать WSS вместо WS
}
```

Чтобы изменить настройки:

1. Откройте файл `src/stores/settings.ts`
2. Найдите объект с настройками по умолчанию
3. Измените нужные параметры:
   ```typescript
   const defaultSettings: Settings = {
   	sipUserName: "", // SIP логин
   	sipPassword: "", // SIP пароль
   	WSUrl: "ws://your-sip-server:8080",
   	realm: "your-sip-domain",
   	stunServers: ["stun:your-stun-server:3478"],
   	debug: true,
   	ssl: false,
   };
   ```

## Функциональность

Демо приложение поддерживает:

1. Регистрацию на SIP-сервере
2. Исходящие звонки
3. Входящие звонки
4. Постановку звонка на удержание
5. Переключение между звонками
6. DTMF

## Отладка

1. Включите режим отладки в настройках (`debug: true`)
2. Откройте консоль браузера
3. Все SIP сообщения и события будут логироваться в консоль

## Известные проблемы

1. Функция hold может не работать, если SIP-сервер не поддерживает WebRTC или неправильно настроен
2. При использовании WSS (ssl: true) убедитесь, что сервер имеет валидный SSL сертификат

## Требования к браузеру

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+ (Chromium-based)

## Требования к SIP-серверу

- Поддержка WebSocket транспорта
- Поддержка WebRTC (для аудио)
- Желательна поддержка ICE/STUN/TURN
