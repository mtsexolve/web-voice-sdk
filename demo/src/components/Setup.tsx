import { Environment, Settings, setupSettings } from "../stores/settings.ts";
import {
	Box,
	Button,
	FormControl,
	Heading,
	Input,
	Select,
	SelectContent,
	SelectIcon,
	SelectListbox,
	SelectOption,
	SelectOptionIndicator,
	SelectOptionText,
	SelectPlaceholder,
	SelectTrigger,
	SelectValue,
} from "@hope-ui/solid";
import { createStore } from "solid-js/store";
import { nativeEnum, object, string, ZodIssue } from "zod";
import { createMemo, createSignal, JSX } from "solid-js";

export function Setup() {
	const [form, setForm] = createStore<{
		values: Partial<Settings>;
		errors: Partial<Record<keyof Settings, ZodIssue>>;
	}>({
		values: {
			environment: Environment.PRODUCTION,
		},
		errors: {},
	});

	const isSwitchEnv = !!localStorage.getItem("switchEnv");
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

	const handleSelectEnvironment = (environment: Environment) => {
		setFormKey("environment", environment);
	};

	const isInvalid = createMemo(() => (key: keyof Settings) => {
		return !!form.errors[key];
	});

	const handleSave = async () => {
		const validationSchema = object({
			environment: nativeEnum(Environment),
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
				<Heading css={{ marginBottom: 24 }}>Настройка SIP аккаунта</Heading>

				{isSwitchEnv && (
					<FormControl>
						<Box css={{ marginBottom: 20 }}>
							<Select invalid={isInvalid()("environment")} onChange={handleSelectEnvironment}>
								<SelectTrigger>
									<SelectPlaceholder>Выберите окружение</SelectPlaceholder>
									<SelectValue />
									<SelectIcon />
								</SelectTrigger>
								<SelectContent>
									<SelectListbox>
										<SelectOption value={Environment.TEST}>
											<SelectOptionText>test</SelectOptionText>
											<SelectOptionIndicator />
										</SelectOption>

										<SelectOption value={Environment.PRE_PRODUCTION}>
											<SelectOptionText>pre production</SelectOptionText>
											<SelectOptionIndicator />
										</SelectOption>

										<SelectOption value={Environment.PRODUCTION}>
											<SelectOptionText>production</SelectOptionText>
											<SelectOptionIndicator />
										</SelectOption>
									</SelectListbox>
								</SelectContent>
							</Select>
						</Box>
					</FormControl>
				)}

				<FormControl>
					<Input
						size="md"
						invalid={isInvalid()("sipUserName")}
						onInput={handleInputUserName}
						placeholder="Введите SIP логин"
					/>
				</FormControl>

				<FormControl css={{ marginTop: 20 }}>
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
					css={{ marginTop: 20 }}
					size="sm"
					colorScheme="accent">
					Сохранить
				</Button>
			</Box>
		</Box>
	);
}
