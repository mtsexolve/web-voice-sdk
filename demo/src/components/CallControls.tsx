import { Box, Button, Input, notificationService } from "@hope-ui/solid";
import {
	$sessionMutations,
	DIRECTION_INCOMING,
	DIRECTION_OUTGOING,
	SESSION_STATE,
	SessionItem,
} from "../stores/session.ts";
import { createMemo, createSignal } from "solid-js";
import { formatPhoneNumber, formatSeconds } from "../utils/format.ts";
import { $sdk } from "../stores/sdk.ts";

const directionTranslate = {
	[DIRECTION_INCOMING]: "Входящий",
	[DIRECTION_OUTGOING]: "Исходящий",
};

const sessionStateTranslate = {
	[SESSION_STATE.ENDED]: "Завершен",
	[SESSION_STATE.FAILED]: "Звонок не удался",
	[SESSION_STATE.PROGRESS]: "Ждем ответа",
	[SESSION_STATE.CONFIRMED]: "Идет разговор",
};

export function CallControls(props: { session: SessionItem }) {
	const [transferNumber, setTransferNumber] = createSignal("");
	const [showTransfer, setShowTransfer] = createSignal(false);
	const [isHeld, setIsHeld] = createSignal(false);

	const titlePhone = createMemo(() =>
		props.session.direction === DIRECTION_INCOMING
			? props.session.additionalInfo.from
			: props.session.additionalInfo.to,
	);

	const isIncoming = createMemo(() => props.session.direction === DIRECTION_INCOMING);
	const isProgressState = createMemo(() => props.session.state === SESSION_STATE.PROGRESS);
	const isConfirmedState = createMemo(() => props.session.state === SESSION_STATE.CONFIRMED);

	const handleTerminate = () => {
		isIncoming()
			? props.session.incomingActions?.decline?.()
			: $sessionMutations.terminate(props.session.RTCSession.id);
	};

	const handleAccept = () => {
		console.log(props.session.incomingActions?.accept);
		props.session.incomingActions?.accept?.();
	};

	const handleHoldToggle = async () => {
		try {
			console.log("1. handleHoldToggle начат, текущее состояние:", isHeld() ? "На удержании" : "Активный");

			const { instance } = $sdk.get();
			if (!instance) {
				console.log("2. Ошибка: SDK инстанс не найден");
				return;
			}

			console.log("3. Текущая сессия ID в RTCSession:", props.session.RTCSession.id);
			console.log(
				"3.1. Текущая сессия - дополнительная информация:",
				JSON.stringify(props.session.additionalInfo),
			);
			console.log("3.2. Объект сессии:", props.session.RTCSession);

			// Получаем все линии и выводим их для отладки
			const lines = instance.getCallLines();
			console.log("4. Доступные линии:", lines);

			// Пробуем найти по всем возможным идентификаторам
			let currentLine = lines.find(line => {
				console.log("4.1. Сравниваем линию", line.id, "с сессией", props.session.RTCSession.id);
				return line.id === props.session.RTCSession.id;
			});

			if (!currentLine) {
				// Пробуем найти по target (номер телефона)
				currentLine = lines.find(line => {
					const target = props.session.additionalInfo.to || props.session.additionalInfo.from;
					console.log("4.2. Сравниваем target линии", line.target, "с целевым номером", target);
					return line.target.includes(target);
				});
			}

			if (!currentLine) {
				console.log("5. Ошибка: Не найдена текущая линия");
				return;
			}

			console.log("6. Найдена линия:", currentLine);

			// Проверяем, находится ли звонок на удержании
			const currentHoldState = currentLine.isHeld;
			console.log("7. Текущее состояние удержания:", currentHoldState);

			// Метод hold/unhold для текущей сессии напрямую, не создавая новый звонок
			if (currentHoldState) {
				// Снять с удержания
				console.log("8. Снимаем с удержания напрямую");
				props.session.RTCSession.unhold();
				console.log("9. Команда разудержания отправлена");
				setIsHeld(false);
			} else {
				// Поставить на удержание
				console.log("8. Ставим на удержание напрямую");
				props.session.RTCSession.hold();
				console.log("9. Команда удержания отправлена");
				setIsHeld(true);
			}
		} catch (error: any) {
			console.error("Ошибка при изменении состояния удержания:", error);
			console.error("Стек вызовов:", error.stack);
		}
	};

	const handleTransfer = async () => {
		console.log("1. handleTransfer начат, номер:", transferNumber());
		if (!transferNumber()) {
			console.log("2. Ошибка: Пустой номер");
			return;
		}

		try {
			console.log("3. Получаем инстанс SDK");
			const { instance } = $sdk.get();
			console.log("4. SDK инстанс получен:", !!instance);

			if (!instance) {
				console.log("5. Ошибка: SDK инстанс не найден");
				return;
			}

			// Выводим текущую сессию для отладки
			console.log("6. Текущая сессия:", props.session);
			console.log("7. ID текущей сессии:", props.session.RTCSession.id);

			// Получаем все линии
			const lines = instance.getCallLines();
			console.log("8. Доступные линии:", lines);

			// Новый подход: вместо сравнения по ID, находим линию по удаленной стороне (URI)
			// Проверяем по remote_identity.uri от RTCSession, что должно быть стабильным
			const currentTarget = props.session.RTCSession.remote_identity.uri.toString();
			console.log("9. Текущий remote URI:", currentTarget);

			let currentLine = lines.find(line => {
				console.log("10. Сравниваем target линии", line.target, "с целевым URI", currentTarget);
				return line.target === currentTarget;
			});

			// Резервный вариант: поиск по номеру телефона
			if (!currentLine) {
				const target = props.session.additionalInfo.to || props.session.additionalInfo.from;
				console.log("11. Резервный поиск по номеру:", target);

				currentLine = lines.find(line => {
					return line.target.includes(target);
				});
			}

			if (!currentLine) {
				console.log("12. Ошибка: Не найдена текущая линия");
				return;
			}

			console.log("13. Найдена линия для трансфера:", currentLine);

			// Создаем новый звонок на номер для трансфера
			console.log("14. Пытаемся создать новый звонок на номер:", transferNumber());
			const toCall = await instance.call(transferNumber());
			console.log("15. Создан новый звонок:", toCall);

			// Получаем ID линии нового звонка
			const newLineId = toCall.getLineId(); // Используем метод getLineId() из SDK
			console.log("16. ID новой линии:", newLineId);
			console.log("17. Состояние созданного звонка:", toCall.session.status);

			// После установления соединения выполняем трансфер
			console.log('18. Добавляем обработчик события "confirmed"');
			toCall.session.on("confirmed", async () => {
				console.log("19. Звонок подтвержден, выполняем трансфер");

				if (!currentLine) {
					console.log("20. Ошибка: currentLine не найдена при выполнении трансфера");
					return;
				}

				console.log("20. От линии:", currentLine.id, "к линии с ID:", newLineId);

				try {
					await instance.transferCall(currentLine.id, newLineId);
					console.log("21. Трансфер выполнен успешно");

					// Показываем нотификацию об успешном трансфере
					notificationService.show({
						title: "Трансфер выполнен",
						status: "success",
						description: `Звонок успешно переведен на номер ${transferNumber()}`,
						duration: 5000,
					});

					// Завершаем текущий звонок в интерфейсе
					$sessionMutations.terminate(props.session.RTCSession.id);

					setShowTransfer(false);
					setTransferNumber("");
				} catch (transferError) {
					console.error("22. Ошибка при transferCall:", transferError);
					console.error("23. Детали ошибки:", transferError);

					// Показываем нотификацию об ошибке
					notificationService.show({
						title: "Ошибка при трансфере",
						status: "danger",
						description: "Не удалось выполнить перевод звонка",
						duration: 5000,
					});
				}
			});

			// Добавим обработчики ошибок нового звонка
			toCall.session.on("failed", event => {
				console.error("24. Ошибка при создании звонка:", event);
				console.error("25. Причина:", event.cause);

				// Показываем нотификацию об ошибке
				notificationService.show({
					title: "Ошибка при создании звонка",
					status: "danger",
					description: `Причина: ${event.cause}`,
					duration: 5000,
				});
			});

			console.log("26. Обработчики событий установлены");
		} catch (error: any) {
			console.error("27. Общая ошибка трансфера:", error);
			console.error("28. Стек вызовов:", error.stack);

			// Показываем нотификацию об общей ошибке
			notificationService.show({
				title: "Ошибка при трансфере",
				status: "danger",
				description: error.message || "Неизвестная ошибка при трансфере",
				duration: 5000,
			});
		}
	};

	return (
		<Box css={{ display: "flex", gap: 2, flexDirection: "column", alignItems: "center", paddingY: 12 }}>
			<Box css={{ fontWeight: "bolder" }}>{formatPhoneNumber(titlePhone())}</Box>
			<Box>{directionTranslate[props.session.direction]}</Box>
			<Box css={{ fontSize: "0.8em" }}>{sessionStateTranslate[props.session.state]}</Box>
			<Box css={{ fontSize: "0.8em" }}>Длительность: {formatSeconds(props.session.duration)}</Box>

			<Box css={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center", flexDirection: "column" }}>
				{isIncoming() && isProgressState() && (
					<Button size="sm" onClick={handleAccept} colorScheme="success" variant="dashed">
						Принять звонок
					</Button>
				)}

				{isConfirmedState() && (
					<>
						<Box css={{ display: "flex", gap: 8, alignItems: "center" }}>
							<Button
								size="sm"
								onClick={handleHoldToggle}
								colorScheme={isHeld() ? "primary" : "warning"}
								variant="dashed">
								{isHeld() ? "Продолжить" : "Удержание"}
							</Button>
						</Box>

						{showTransfer() ? (
							<Box css={{ display: "flex", gap: 8, alignItems: "center" }}>
								<Input
									size="sm"
									placeholder="Номер для трансфера"
									value={transferNumber()}
									onInput={e => setTransferNumber(e.currentTarget.value)}
								/>
								<Button size="sm" onClick={handleTransfer} colorScheme="primary" variant="dashed">
									Перевести
								</Button>
								<Button
									size="sm"
									onClick={() => setShowTransfer(false)}
									colorScheme="neutral"
									variant="dashed">
									Отмена
								</Button>
							</Box>
						) : (
							<Button size="sm" onClick={() => setShowTransfer(true)} colorScheme="warning" variant="dashed">
								Трансфер звонка
							</Button>
						)}
					</>
				)}

				<Button onClick={handleTerminate} size="sm" colorScheme="danger" variant="dashed">
					Завершить звонок
				</Button>
			</Box>
		</Box>
	);
}
