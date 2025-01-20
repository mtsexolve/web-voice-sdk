import { Badge, Box, Button, Input, InputGroup, InputLeftElement } from "@hope-ui/solid";
import { FiPhone } from "solid-icons/fi";
import { $settings, resetSettings } from "../stores/settings.ts";
import { useStore } from "@nanostores/solid";
import { $sdk, register, unregister } from "../stores/sdk.ts";
import { $target } from "../stores/target.ts";
import { $sessionMutations } from "../stores/session.ts";

export function BasedControls() {
	const sdk = useStore($sdk);
	const target = useStore($target);
	const settings = useStore($settings);

	const handleToggleRegistration = () => {
		sdk().registered ? unregister() : register();
	};

	const handleStartCall = async () => {
		if (!sdk().registered) await register().catch(console.log);
		const session = await sdk().instance?.call($target.get());
		session &&
			$sessionMutations.setSession({ from: settings().sipUserName, to: $target.get() }, session.session);
	};

	return (
		<Box>
			<Box css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Button onClick={handleToggleRegistration} size="sm" colorScheme="accent" variant="dashed">
					{sdk().registered ? "Снять регистрацию" : "Регистрация"}
				</Button>

				<Badge colorScheme={sdk().registered ? "success" : "warning"}>
					{sdk().registered ? "Registered" : "UnRegistered"}
				</Badge>
			</Box>

			<Box css={{ mt: 24 }}>
				<InputGroup>
					<InputLeftElement pointerEvents="none" color="$neutral9">
						<FiPhone />
					</InputLeftElement>
					<Input
						type="tel"
						value={target()}
						onInput={e => $target.set(e.currentTarget.value)}
						placeholder="Номер телефона"
					/>
				</InputGroup>
				<Button onClick={handleStartCall} colorScheme="accent" fullWidth css={{ mt: 12 }} size="sm">
					Начать звонок
				</Button>
			</Box>

			<Box css={{ mt: 24, fontSize: "0.9em", color: "$neutral10" }}>
				Авторизованы как <strong>{settings().sipUserName}</strong>
			</Box>
			<Button onClick={resetSettings} css={{ mt: 12 }} size="xs" colorScheme="danger" variant="dashed">
				Сбросить авторизацию
			</Button>
		</Box>
	);
}
