import { Box } from "@hope-ui/solid";

import { BasedControls } from "./BasedControls.tsx";
import { CallControls } from "./CallControls.tsx";
import { useStore } from "@nanostores/solid";
import { $session } from "../stores/session.ts";
import { For } from "solid-js";
import { $sdk } from "../stores/sdk.ts";

export function Dashboard() {
	const session = useStore($session);
	const _ = useStore($sdk);

	console.log(_);

	return (
		<Box css={{ pt: 64 }}>
			<Box css={{ width: 450, margin: "auto", backgroundColor: "$neutral2", p: 16, borderRadius: 8 }}>
				{!!session().length || <BasedControls />}
				<For each={session()}>{session => <CallControls session={session} />}</For>
			</Box>
		</Box>
	);
}
