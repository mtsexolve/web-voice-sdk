import { Box, Button } from "@hope-ui/solid";
import {
	$sessionMutations,
	DIRECTION_INCOMING,
	DIRECTION_OUTGOING,
	SESSION_STATE,
	SessionItem,
} from "../stores/session.ts";
import { createMemo } from "solid-js";
import { formatPhoneNumber, formatSeconds } from "../utils/format.ts";

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

	const handleHoldToggle = () => {
		const isOnHold = props.session.RTCSession.isOnHold().local;
		if (isOnHold) {
			$sessionMutations.unhold(props.session.RTCSession.id);
		} else {
			$sessionMutations.hold(props.session.RTCSession.id);
		}
	};

	return (
		<Box css={{ display: "flex", gap: 2, flexDirection: "column", alignItems: "center", paddingY: "12px" }}>
			<Box css={{ fontWeight: "bolder" }}>{formatPhoneNumber(titlePhone())}</Box>
			<Box>{directionTranslate[props.session.direction]}</Box>
			<Box css={{ fontSize: "0.8em" }}>{sessionStateTranslate[props.session.state]}</Box>
			<Box css={{ fontSize: "0.8em" }}>Длительность: {formatSeconds(props.session.duration)}</Box>

			<Box css={{ marginTop: "24px", display: "flex", gap: 12, alignItems: "center" }}>
				{isIncoming() && isProgressState() && (
					<Button size="sm" onClick={handleAccept} colorScheme="success" variant="dashed">
						Принять звонок
					</Button>
				)}

				{isConfirmedState() && (
					<Button size="sm" onClick={handleHoldToggle} colorScheme="info" variant="dashed">
						{props.session.RTCSession.isOnHold().local ? "Снять с удержания" : "Поставить на удержание"}
					</Button>
				)}

				<Button onClick={handleTerminate} size="sm" colorScheme="danger" variant="dashed">
					Завершить звонок
				</Button>
			</Box>
		</Box>
	);
}
