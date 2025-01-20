import { Settings, setupSettings } from "../stores/settings.ts";
import { Box, Button, FormControl, Heading, Input } from "@hope-ui/solid";
import { createStore } from "solid-js/store";
import { object, string, ZodIssue } from "zod";
import { createMemo, createSignal, JSX } from "solid-js";

export function Setup() {
	const [form, setForm] = createStore<{
		values: Partial<Settings>;
		errors: Partial<Record<keyof Settings, ZodIssue>>;
	}>({ values: {}, errors: {} });

	const [isLoading, setIsLoading] = createSignal(false);

	const setFormKey = <T extends keyof Settings>(key: T, value: Settings[T]) => {
		setForm(v => {
			return {
				...v,
				errors: Object.fromEntries(Object.entries(v.errors).filter(([k]) => k !== key)),
				values: { ...v.values, [key]: value },
			};
		});
	};

	const handleInputUserName: JSX.InputEventHandlerUnion<HTMLInputElement, InputEvent> = e => {
		setFormKey("sipUserName", e.currentTarget.value);
	};

	const handleInputPassword: JSX.InputEventHandlerUnion<HTMLInputElement, InputEvent> = e => {
		setFormKey("sipPassword", e.currentTarget.value);
	};

	const isInvalid = createMemo(() => (key: keyof Settings) => {
		return !!form.errors[key];
	});

	const handleSave = async () => {
		const validationSchema = object({
			sipUserName: string().min(1),
			sipPassword: string().min(1),
		});

		const validation = validationSchema.safeParse(form.values);

		if (!validation.success) {
			const errors = Object.fromEntries(
				validation.error.issues.map(value => [value.path[value.path.length - 1], value]),
			);

			return setForm(v => ({ ...v, errors }));
		}

		setIsLoading(true);
		await setupSettings(form.values as Settings).finally(() => setIsLoading(false));
	};

	return (
		<Box
			css={{
				display: "flex",
				minHeight: "100vh",
				alignItems: "center",
				flexDirection: "column",
				justifyContent: "center",
			}}>
			<Box css={{ width: "350px" }}>
				<Heading css={{ mb: 24 }}>Настройка SIP аккаунта</Heading>

				<FormControl>
					<Input
						size="md"
						invalid={isInvalid()("sipUserName")}
						onInput={handleInputUserName}
						placeholder="Введите SIP логин"
					/>
				</FormControl>

				<FormControl css={{ mt: 20 }}>
					<Input
						size="md"
						type="password"
						invalid={isInvalid()("sipPassword")}
						onInput={handleInputPassword}
						placeholder="Введите SIP пароль"
					/>
				</FormControl>

				<Button
					loading={isLoading()}
					loadingText="Проверка..."
					onClick={handleSave}
					css={{ mt: 20 }}
					size="sm"
					colorScheme="accent">
					Сохранить
				</Button>
			</Box>
		</Box>
	);
}
