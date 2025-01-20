export function formatSeconds(seconds: number) {
	if (isNaN(seconds)) return "...";

	const minutes = Math.floor(seconds / 60);
	seconds = Math.floor(seconds % 60);
	let secs = seconds.toString();
	if (seconds < 10) secs = "0" + seconds;

	return `${minutes}:${secs}`;
}

export const formatPhoneNumber = (value: number | string) => {
	return value
		.toString()
		.split("")
		.reduce((acc, v) => acc.replace("x", v), "+x xxx xxx-xx-xx");
};
