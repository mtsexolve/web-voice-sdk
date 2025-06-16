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
			const { instance } = $sdk.get();
			if (!instance) {
				console.error("SDK инстанс не найден");
				return;
			}

			const rtcSession = props.session.RTCSession;
			if (!rtcSession) {
				console.error("RTC сессия не найдена");
				return;
			}

			// Проверяем реальное состояние удержания из RTCSession
			const isCurrentlyOnHold = isHeld();

			if (isCurrentlyOnHold) {
				rtcSession.unhold();
				setIsHeld(false);
				console.log("Звонок снят с удержания");
			} else {
				rtcSession.hold();
				setIsHeld(true);
				console.log("Звонок поставлен на удержание");
			}
		} catch (error: any) {
			console.error("Ошибка при изменении состояния удержания:", error.message);
		}
	};

	const handleTransfer = async () => {
		console.log("1. handleTransfer начат, номер:", transferNumber());
		if (!transferNumber()) {
			console.log("2. Ошибка: Пустой номер");
			notificationService.show({
				title: "Ошибка",
				status: "danger",
				description: "Введите номер для трансфера",
				duration: 3000,
			});
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

			// Находим текущую линию по remote URI
			const currentTarget = props.session.RTCSession.remote_identity.uri.toString();
			console.log("9. Текущий remote URI:", currentTarget);

			let currentLine = lines.find(line => {
				console.log("10. Сравниваем target линии", line.target, "с целевым URI", currentTarget);
				return line.target === currentTarget;
			});

			// Резервный поиск по номеру телефона
			if (!currentLine) {
				const target = props.session.additionalInfo.to || props.session.additionalInfo.from;
				console.log("11. Резервный поиск по номеру:", target);
				currentLine = lines.find(line => {
					console.log("12. Сравниваем target линии", line.target, "с номером", target);
					return line.target.includes(target);
				});
			}

			if (!currentLine) {
				console.log("13. Ошибка: Не найдена текущая линия для трансфера");
				throw new Error("Не найдена текущая линия для трансфера");
			}

			console.log("14. Найдена линия для слепого трансфера:", currentLine);
			console.log("15. Выполняем слепой трансфер на номер:", transferNumber());

			// Выполняем слепой трансфер напрямую (БЕЗ создания дополнительного звонка!)
			await instance.blindTransfer(currentLine.id, transferNumber());
			console.log("16. Слепой трансфер выполнен успешно");

			// Показываем нотификацию об успешном трансфере
			notificationService.show({
				title: "Трансфер выполнен",
				status: "success",
				description: `Звонок переведен на номер ${transferNumber()}`,
				duration: 5000,
			});

			console.log("17. Завершаем текущий звонок в интерфейсе");
			// Завершаем текущий звонок в интерфейсе
			$sessionMutations.terminate(props.session.RTCSession.id);

			setShowTransfer(false);
			setTransferNumber("");
			console.log("18. Трансфер полностью завершен");
		} catch (error: any) {
			console.error("19. Ошибка при слепом трансфере:", error);
			console.error("20. Стек вызовов:", error.stack);

			notificationService.show({
				title: "Ошибка при трансфере",
				status: "danger",
				description: error.message || "Не удалось выполнить перевод звонка",
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
