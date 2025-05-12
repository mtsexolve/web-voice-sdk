import { Match, Switch } from "solid-js";
import { useStore } from "@nanostores/solid";
import { $settingsReady } from "./stores/settings.ts";
import { Setup } from "./components/Setup.tsx";

import { HopeProvider, NotificationsProvider } from "@hope-ui/solid";
import { Dashboard } from "./components/Dashboard.tsx";

function App() {
	const ready = useStore($settingsReady);

	return (
		<HopeProvider config={{ initialColorMode: "system" }}>
			<NotificationsProvider>
				<Switch>
					<Match when={ready()}>
						<Dashboard />
					</Match>
					<Match when={!ready()}>
						<Setup />
					</Match>
				</Switch>
			</NotificationsProvider>
		</HopeProvider>
	);
}

export default App;
